import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehicleQueryDto } from './dto/vehicle-query.dto';
import { CreateFleetOperatorDto, UpdateFleetOperatorDto } from './dto/fleet-operator.dto';
import { 
  PaginatedResponse, encodeCursor, decodeCursor, AuditLogService, 
  Organisation, FleetOperator, Vehicle 
} from '@app/common';

@Injectable()
export class FleetServiceService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(FleetOperator)
    private readonly operatorRepo: Repository<FleetOperator>,
    @InjectRepository(Organisation)
    private readonly orgRepo: Repository<Organisation>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAllVehicles(query: VehicleQueryDto, requestUser: any) {
    const { 
      status, type, vehicle_type, registration_number, 
      brand, model, limit = 50, cursor 
    } = query;
    const isPlatformAdmin = requestUser.roles?.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN', 'Call Centre Executive (CCE)', 'CCE'].includes(r)
    );

    const queryBuilder = this.vehicleRepo.createQueryBuilder('vehicle');
    
    // Default: Only show active vehicles (Super Admin can override)
    if (!isPlatformAdmin) {
      queryBuilder.andWhere('vehicle.isActive = :isActive', { isActive: true });
    } else if (query.show_inactive !== 'true') {
      queryBuilder.andWhere('vehicle.isActive = :isActive', { isActive: true });
    }

    // Tenant Isolation
    if (!isPlatformAdmin) {
      queryBuilder.andWhere('vehicle.organisationId = :orgId', { orgId: requestUser.organisationId });
    } else if (query.org_id) {
      queryBuilder.andWhere('vehicle.organisationId = :orgId', { orgId: query.org_id });
    }

    // Filters
    if (status) queryBuilder.andWhere('vehicle.status = :status', { status });
    
    // Support both 'type' and 'vehicle_type' from query params
    const vType = vehicle_type || type;
    if (vType) queryBuilder.andWhere('vehicle.vehicle_type = :vType', { vType });

    if (registration_number) {
      queryBuilder.andWhere('vehicle.registration_number ILIKE :reg', { reg: `%${registration_number}%` });
    }

    if (brand) {
      queryBuilder.andWhere('vehicle.brand ILIKE :brand', { brand: `%${brand}%` });
    }

    if (model) {
      queryBuilder.andWhere('vehicle.model ILIKE :model', { model: `%${model}%` });
    }

    // Pagination
    if (cursor) {
      const decodedCursor = decodeCursor(cursor);
      const [cursorId] = decodedCursor.split('|');
      if (cursorId) {
        queryBuilder.andWhere('vehicle.id > :cursorId', { cursorId });
      }
    }

    queryBuilder.orderBy('vehicle.id', 'ASC');
    queryBuilder.take(limit + 1);

    const vehicles = await queryBuilder.getMany();
    
    let next_cursor: string | null = null;
    const hasNextPage = vehicles.length > limit;
    const data = hasNextPage ? vehicles.slice(0, limit) : vehicles;

    if (hasNextPage) {
      const lastItem = data[data.length - 1];
      next_cursor = encodeCursor(`${lastItem.id}`);
    }

    const total_count = await queryBuilder.getCount();
    const total_pages = Math.ceil(total_count / limit);
    const currentPage = 1; // Basic offset support, can be expanded if needed

    return new PaginatedResponse(
      data, 
      next_cursor, 
      total_count, 
      limit, 
      data.length,
      currentPage,
      total_pages
    );
  }

  async registerVehicle(dto: CreateVehicleDto, requestUser: any) {
    const roles = requestUser.roles || [];
    const isPlatformAdmin = roles.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r)
    );

    const orgId = (isPlatformAdmin && dto.organisationId) 
      ? dto.organisationId 
      : (requestUser.org_id || requestUser.organisationId);

    if (!orgId) {
      throw new ConflictException('Organisation ID is required for vehicle registration');
    }

    // Check for duplicate registration
    const existing = await this.vehicleRepo.findOneBy({ registration_number: dto.registration_number });
    if (existing) {
      throw new ConflictException(`Vehicle with registration number '${dto.registration_number}' already exists`);
    }

    // Check Capacity (Spec 5.4)
    const org = await this.orgRepo.findOneBy({ id: orgId });
    if (!org) throw new NotFoundException('Organisation not found');

    const currentCount = await this.vehicleRepo.count({ where: { organisationId: orgId } });
    if (currentCount >= (org.vehicle_capacity || 10)) {
      throw new ConflictException(`Organisation '${org.name}' has reached its vehicle capacity (${org.vehicle_capacity})`);
    }

    const vehicle = this.vehicleRepo.create({
      ...dto,
      organisationId: orgId,
    });
    
    const saved = await this.vehicleRepo.save(vehicle);

    return { data: saved };
  }

  async updateVehicle(id: string, dto: any, requestUser: any) {
    const vehicle = await this.vehicleRepo.findOneBy({ id });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const isPlatformAdmin = requestUser.roles?.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r)
    );

    // Tenant Isolation
    if (!isPlatformAdmin && vehicle.organisationId !== requestUser.organisationId) {
      throw new ForbiddenException('Access denied: You can only update vehicles in your own organization');
    }

    Object.assign(vehicle, dto);
    const saved = await this.vehicleRepo.save(vehicle);
    return { data: saved };
  }

  async deleteVehicle(id: string, requestUser: any) {
    const vehicle = await this.vehicleRepo.findOneBy({ id });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const isPlatformAdmin = requestUser.roles?.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r)
    );

    // Tenant Isolation
    if (!isPlatformAdmin && vehicle.organisationId !== requestUser.organisationId) {
      throw new ForbiddenException('Access denied: You can only delete vehicles in your own organization');
    }

    // Soft Delete
    vehicle.isActive = false;
    await this.vehicleRepo.save(vehicle);

    return { message: 'Vehicle soft-deleted successfully' };
  }

  async createOperator(dto: CreateFleetOperatorDto, adminId: string, ip: string): Promise<FleetOperator> {
    const operator = (await this.operatorRepo.save(this.operatorRepo.create(dto))) as FleetOperator;

    await this.auditLogService.log({
      userId: adminId,
      action: 'FLEET_OPERATOR_CREATED',
      ipAddress: ip,
      metadata: { operatorId: operator.id, name: operator.name },
    });

    return operator;
  }

  async findAllOperators(): Promise<FleetOperator[]> {
    return this.operatorRepo.find({ order: { name: 'ASC' } });
  }

  async findOneOperator(id: string): Promise<FleetOperator> {
    const operator = await this.operatorRepo.findOneBy({ id });
    if (!operator) throw new NotFoundException(`Fleet Operator with ID ${id} not found`);
    return operator;
  }

  async updateOperator(id: string, dto: UpdateFleetOperatorDto, adminId: string, ip: string): Promise<FleetOperator> {
    const operator = await this.findOneOperator(id);
    Object.assign(operator, dto);
    const saved = (await this.operatorRepo.save(operator)) as FleetOperator;

    await this.auditLogService.log({
      userId: adminId,
      action: 'FLEET_OPERATOR_UPDATED',
      ipAddress: ip,
      metadata: { operatorId: id, updates: dto },
    });

    return saved;
  }

  async createOrganisation(dto: any, adminId: string, ip: string) {
    const orgData = {
      ...dto,
      registration_number: dto.reg_number,
      country: dto.country || 'India',
    };

    const org = this.orgRepo.create(orgData);
    const saved = (await this.orgRepo.save(org)) as any;

    await this.auditLogService.log({
      userId: adminId,
      action: 'FLEET_ORGANISATION_CREATED',
      ipAddress: ip,
      metadata: { orgId: saved.id, name: saved.name },
    });

    return { data: saved };
  }
}
