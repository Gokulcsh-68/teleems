import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehicleQueryDto } from './dto/vehicle-query.dto';
import { PaginatedResponse, encodeCursor, decodeCursor } from '../../../libs/common/src';

@Injectable()
export class FleetServiceService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
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

    return new PaginatedResponse(data, next_cursor, total_count, limit, data.length);
  }

  async registerVehicle(dto: CreateVehicleDto, requestUser: any) {
    const isPlatformAdmin = requestUser.roles?.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r)
    );

    const vehicleData = {
      ...dto,
      organisationId: (isPlatformAdmin && dto.organisationId) ? dto.organisationId : requestUser.organisationId,
    };

    const vehicle = this.vehicleRepo.create(vehicleData);
    const saved = await this.vehicleRepo.save(vehicle);

    return { data: saved };
  }
}
