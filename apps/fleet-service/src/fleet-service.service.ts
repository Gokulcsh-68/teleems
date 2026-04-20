import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehicleQueryDto } from './dto/vehicle-query.dto';
import { CreateFleetOperatorDto, UpdateFleetOperatorDto } from './dto/fleet-operator.dto';
import { 
  PaginatedResponse, encodeCursor, decodeCursor, AuditLogService, 
  Organisation, FleetOperator 
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
    const { status, type, limit = 50, cursor } = query;
    const isPlatformAdmin = requestUser.roles?.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN', 'Call Centre Executive (CCE)', 'CCE'].includes(r)
    );

    const queryBuilder = this.vehicleRepo.createQueryBuilder('vehicle');

    // Tenant Isolation
    if (!isPlatformAdmin) {
      queryBuilder.andWhere('vehicle.organisationId = :orgId', { orgId: requestUser.organisationId });
    } else if (query.org_id) {
      queryBuilder.andWhere('vehicle.organisationId = :orgId', { orgId: query.org_id });
    }

    // Filters
    if (status) queryBuilder.andWhere('vehicle.status = :status', { status });
    if (type) queryBuilder.andWhere('vehicle.type = :type', { type });

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
    const isPlatformAdmin = requestUser.roles?.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r)
    );

    const orgId = (isPlatformAdmin && dto.organisationId) ? dto.organisationId : requestUser.organisationId;

    // Check Capacity (Spec 5.4)
    const org = await this.orgRepo.findOneBy({ id: orgId });
    if (!org) throw new NotFoundException('Organisation not found');

    const currentCount = await this.vehicleRepo.count({ where: { organisationId: orgId } });
    if (currentCount >= org.vehicle_capacity) {
      throw new ConflictException(`Organisation '${org.name}' has reached its vehicle capacity (${org.vehicle_capacity})`);
    }

    const vehicleData = {
      ...dto,
      organisationId: orgId,
    };

    const vehicle = this.vehicleRepo.create(vehicleData);
    const saved = await this.vehicleRepo.save(vehicle);

    return { data: saved };
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
