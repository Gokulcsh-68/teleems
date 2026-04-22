import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Organisation, OrganisationStatus, SubscriptionPlan, AuditLogService, Hospital, FleetOperator } from '@app/common';
import { CreateOrganisationDto, UpdateOrganisationDto } from './dto/organisation.dto';
import { RegisterHospitalDto } from './dto/register-hospital.dto';
import { RegisterFleetOperatorDto } from './dto/register-fleet-operator.dto';
import { FleetOperatorQueryDto } from './dto/fleet-operator-query.dto';
import { AuthService } from '../../auth-service/src/auth.service';
import { Like } from 'typeorm';
import { PaginatedResponse } from '@app/common';

@Injectable()
export class AdminServiceService {
  constructor(
    @InjectRepository(Organisation)
    private readonly orgRepo: Repository<Organisation>,
    @InjectRepository(Hospital)
    private readonly hospitalRepo: Repository<Hospital>,
    @InjectRepository(FleetOperator)
    private readonly fleetOperatorRepo: Repository<FleetOperator>,
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly authService: AuthService,
  ) {}

  async createOrganisation(dto: CreateOrganisationDto, adminId: string, ip: string) {
    const existing = await this.orgRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Organisation with name '${dto.name}' already exists`);

    const org = this.orgRepo.create(dto);
    await this.orgRepo.save(org);

    await this.auditLogService.log({
      userId: adminId,
      action: 'ORGANISATION_CREATED',
      ipAddress: ip,
      metadata: { orgId: org.id, name: org.name },
    });

    return org;
  }

  async findAllOrganisations() {
    return this.orgRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOneOrganisation(id: string) {
    const org = await this.orgRepo.findOneBy({ id });
    if (!org) throw new NotFoundException(`Organisation with ID ${id} not found`);
    return org;
  }

  async updateOrganisation(id: string, dto: UpdateOrganisationDto, adminId: string, ip: string) {
    const org = await this.findOneOrganisation(id);
    
    Object.assign(org, dto);
    await this.orgRepo.save(org);

    await this.auditLogService.log({
      userId: adminId,
      action: 'ORGANISATION_UPDATED',
      ipAddress: ip,
      metadata: { orgId: id, updates: dto },
    });

    return org;
  }

  async updateFleetOperatorDetails(id: string, dto: UpdateOrganisationDto, user: any, ip: string) {
    const roles = user.roles || [];
    const isSuperAdmin = roles.some((r: string) => ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r));
    const userOrgId = user.org_id || user.organisationId;

    // Security Check: If not Super Admin, can only update own organisation
    if (!isSuperAdmin) {
      if (id !== userOrgId) {
        throw new ForbiddenException('You are not authorized to update this fleet operator record');
      }
    }

    const updatedOrg = await this.updateOrganisation(id, dto, user.userId, ip);

    // Sync changes to FleetOperator profile(s)
    const fleetOps = await this.fleetOperatorRepo.find({ where: { organisationId: id } });
    for (const op of fleetOps) {
      if (dto.name) op.name = dto.name;
      if (dto.address) op.address = dto.address;
      if (dto.contact_name) op.contact_person = dto.contact_name;
      if (dto.contact_phone) op.contact_phone = dto.contact_phone;
      if (dto.vehicle_capacity) op.vehicle_count_cap = dto.vehicle_capacity;
      if (dto.status) op.status = dto.status as any;
      
      await this.fleetOperatorRepo.save(op);
    }

    return updatedOrg;
  }

  async setOrganisationStatus(id: string, status: OrganisationStatus, adminId: string, ip: string) {
    const org = await this.findOneOrganisation(id);
    org.status = status;
    await this.orgRepo.save(org);

    await this.auditLogService.log({
      userId: adminId,
      action: 'ORGANISATION_STATUS_CHANGED',
      ipAddress: ip,
      metadata: { orgId: id, newStatus: status },
    });

    return org;
  }

  async getGlobalAuditLogs(limit: number, offset: number) {
    return this.auditLogService.getAllLogs(limit, offset);
  }

  async findAllFleetOperators(query: FleetOperatorQueryDto, user: any) {
    const { search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.name = Like(`%${search}%`);
    }

    // Role-based filtering:
    const roles = user.roles || [];
    const isSuperAdmin = roles.some((r: string) => ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r));
    
    if (roles.includes('Fleet Operator') && !isSuperAdmin) {
      where.organisationId = user.org_id || user.organisationId;
    }

    const [items, total] = await this.fleetOperatorRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });

    const totalPages = Math.ceil(total / limit);
    return new PaginatedResponse(items, null, total, limit, items.length, page, totalPages);
  }

  async generateInvoice(orgId: string, adminId: string, ip: string) {
    const org = await this.findOneOrganisation(orgId);
    
    // Simulate billing logic based on plan
    const rates = {
      [SubscriptionPlan.BASIC]: 500,
      [SubscriptionPlan.PREMIUM]: 1500,
      [SubscriptionPlan.ENTERPRISE]: 5000,
    };

    const amount = rates[org.subscription_plan] || 0;
    const invoice = {
      invoiceId: `INV-${Date.now()}`,
      orgId,
      orgName: org.name,
      plan: org.subscription_plan,
      amount,
      currency: 'INR',
      status: 'DRAFT',
      generatedAt: new Date(),
    };

    await this.auditLogService.log({
      userId: adminId,
      action: 'INVOICE_GENERATED',
      ipAddress: ip,
      metadata: { orgId, invoiceId: invoice.invoiceId },
    });

    return invoice;
  }

  // --- Unified Hospital Registration ---

  async registerHospitalWithAdmin(dto: RegisterHospitalDto, creator: any, ip: string) {
    // 1. Pre-flight checks for unique constraints
    const existingHosp = await this.hospitalRepo.findOne({ where: { name: dto.hospital.name } });
    if (existingHosp) throw new ConflictException(`Hospital with name '${dto.hospital.name}' already exists.`);

    return await this.dataSource.transaction(async (manager) => {
      // 1. Automatic Hospital Code Generation (e.g. Apollo -> APOL)
      const hospitalData = { ...dto.hospital };
      if (!hospitalData.code) {
        hospitalData.code = dto.hospital.name
          .replace(/[^a-zA-Z]/g, '')
          .slice(0, 4)
          .toUpperCase();
          
        // Check if code exists, if so append a random digit
        const exists = await manager.findOne(Hospital, { where: { code: hospitalData.code } });
        if (exists) {
          hospitalData.code = `${hospitalData.code}${Math.floor(10 + Math.random() * 89)}`;
        }
      }

      // 2. Create the Hospital within transaction
      const hospital = manager.create(Hospital, hospitalData);
      const savedHospital = await manager.save(hospital);

      // 3. Create the Admin User for this Hospital (Passing the manager)
      const adminUser = await this.authService.createUser({
        ...dto.admin,
        role: 'Hospital Admin',
        org_id: savedHospital.id,
      }, creator, manager);

      await this.auditLogService.log({
        userId: creator.userId,
        action: 'HOSPITAL_REGISTERED_WITH_ADMIN',
        ipAddress: ip,
        metadata: { hospitalId: savedHospital.id, adminId: adminUser.id, code: savedHospital.code },
      });

      return {
        hospital: savedHospital,
        admin: {
          id: adminUser.id,
          username: adminUser.username,
          employee_id: adminUser.employeeId,
          email: adminUser.email,
          roles: adminUser.roles,
        }
      };
    });
  }

  async registerFleetOperatorWithAdmin(dto: RegisterFleetOperatorDto, creator: any, ip: string) {
    // 1. Pre-flight checks for unique constraints
    const existingOrg = await this.orgRepo.findOne({ where: { name: dto.organisation.name } });
    if (existingOrg) throw new ConflictException(`Organisation with name '${dto.organisation.name}' already exists.`);

    if (dto.organisation.reg_number) {
      const existingReg = await this.orgRepo.findOne({ where: { registration_number: dto.organisation.reg_number } });
      if (existingReg) throw new ConflictException(`Organisation with registration number '${dto.organisation.reg_number}' already exists.`);
    }

    if (dto.organisation.gstin) {
      const existingGstin = await this.orgRepo.findOne({ where: { gstin: dto.organisation.gstin } });
      if (existingGstin) throw new ConflictException(`Organisation with GSTIN '${dto.organisation.gstin}' already exists.`);
    }

    return await this.dataSource.transaction(async (manager) => {
      // 1. Create Organisation (using flattened fields)
      const orgData: any = {
        ...dto.organisation,
        registration_number: dto.organisation.reg_number,
        country: dto.organisation.country || 'India',
      };
      
      const org = manager.create(Organisation, orgData);
      const savedOrg = await manager.save(org);

      // 2. Create Fleet Operator Profile
      const operatorProfile = manager.create(FleetOperator, {
        name: savedOrg.name,
        organisationId: savedOrg.id,
        contact_person: savedOrg.contact_name,
        contact_phone: savedOrg.contact_phone,
        address: savedOrg.address,
        vehicle_count_cap: dto.organisation.vehicle_capacity || 10,
        status: savedOrg.status as any || 'ACTIVE'
      });
      const savedOperator = await manager.save(operatorProfile);

      // 3. Create Admin User (with fallbacks if admin details are missing)
      const adminUser = await this.authService.createUser({
        name: dto.admin.name || savedOrg.contact_name || savedOrg.name,
        email: dto.admin.email || savedOrg.contact_email,
        phone: dto.admin.phone || savedOrg.contact_phone,
        username: dto.admin.username,
        password: dto.admin.password,
        role: 'Fleet Operator',
        org_id: savedOrg.id,
      }, creator, manager);

      await this.auditLogService.log({
        userId: creator.userId,
        action: 'FLEET_OPERATOR_REGISTERED',
        ipAddress: ip,
        metadata: { orgId: savedOrg.id, operatorId: savedOperator.id, adminId: adminUser.id },
      });

      return {
        organisation: savedOrg,
        operator: savedOperator,
        admin: {
          id: adminUser.id,
          username: adminUser.username,
          phone: adminUser.phone,
          email: adminUser.email,
          roles: adminUser.roles,
        }
      };
    });
  }
}
