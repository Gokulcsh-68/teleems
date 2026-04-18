import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Organisation, OrganisationStatus, SubscriptionPlan, AuditLogService, Hospital } from '@app/common';
import { CreateOrganisationDto, UpdateOrganisationDto } from './dto/organisation.dto';
import { RegisterHospitalDto } from './dto/register-hospital.dto';
import { AuthService } from '../../auth-service/src/auth.service';

@Injectable()
export class AdminServiceService {
  constructor(
    @InjectRepository(Organisation)
    private readonly orgRepo: Repository<Organisation>,
    @InjectRepository(Hospital)
    private readonly hospitalRepo: Repository<Hospital>,
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
}
