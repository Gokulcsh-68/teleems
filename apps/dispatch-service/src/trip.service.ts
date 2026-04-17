import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispatch } from './entities/dispatch.entity';
import { Incident } from './entities/incident.entity';
import { TripQueryDto } from './dto/trip-query.dto';
import { PaginatedResponse, encodeCursor, decodeCursor } from '../../../libs/common/src';

@Injectable()
export class TripService {
  constructor(
    @InjectRepository(Dispatch)
    private readonly dispatchRepo: Repository<Dispatch>,
  ) {}

  async findAllTrips(query: TripQueryDto, requestUser: any) {
    const { 
      status, vehicle_id, driver_id, emt_id, 
      date_from, date_to, incident_id, limit: limitStr, cursor 
    } = query;

    const parsedLimit = parseInt(limitStr || '50', 10);
    const limit = isNaN(parsedLimit) ? 50 : Math.min(parsedLimit, 100);

    const qb = this.dispatchRepo.createQueryBuilder('trip')
      .innerJoin(Incident, 'incident', 'incident.id = CAST(trip.incident_id AS uuid)')
      .orderBy('trip.dispatched_at', 'DESC')
      .addOrderBy('trip.id', 'DESC');

    // 1. Tenant Isolation
    const roles = requestUser.roles || [];
    const isPlatformAdmin = roles.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN', 'Call Centre Executive (CCE)', 'CCE'].includes(r)
    );

    if (!isPlatformAdmin) {
      const orgId = requestUser.organisationId;
      if (!orgId) {
        throw new ForbiddenException('User organization context missing');
      }

      if (roles.includes('Hospital Admin') || roles.includes('Fleet Operator')) {
        qb.andWhere('incident.organisationId = :orgId', { orgId });
      } else {
        throw new ForbiddenException('Insufficient permissions to view trips');
      }
    } else if (query['org_id'] || query['organisationId']) {
      // Platform admin can optionally filter by org
      const filterOrgId = query['org_id'] || query['organisationId'];
      qb.andWhere('incident.organisationId = :orgId', { orgId: filterOrgId });
    }

    // 2. Filters
    if (status) qb.andWhere('trip.status = :status', { status });
    if (vehicle_id) qb.andWhere('trip.vehicle_id = :vehicle_id', { vehicle_id });
    if (driver_id) qb.andWhere('trip.driver_id = :driver_id', { driver_id });
    if (emt_id) qb.andWhere('trip.emt_id = :emt_id', { emt_id });
    if (incident_id) qb.andWhere('trip.incident_id = :incident_id', { incident_id });

    if (date_from) qb.andWhere('trip.dispatched_at >= :dateFrom', { dateFrom: date_from });
    if (date_to) qb.andWhere('trip.dispatched_at <= :dateTo', { dateTo: date_to });

    // 3. Pagination
    if (cursor) {
      const decoded = decodeCursor(cursor);
      const [cursorDate, cursorId] = decoded.split('|');
      if (cursorDate && cursorId) {
        qb.andWhere(
          '(trip.dispatched_at < :cursorDate OR (trip.dispatched_at = :cursorDate AND trip.id < :cursorId))',
          { cursorDate, cursorId }
        );
      }
    }

    // Set limit and get data
    qb.limit(limit);
    const [data, total_count] = await qb.getManyAndCount();

    const hasNextPage = data.length >= limit;
    let next_cursor: string | null = null;
    
    if (hasNextPage) {
      const last = data[data.length - 1];
      next_cursor = encodeCursor(`${last.dispatched_at.toISOString()}|${last.id}`);
    }

    return new PaginatedResponse(data, next_cursor, total_count, limit, data.length);
  }

  async findOneTrip(id: string, requestUser: any) {
    const qb = this.dispatchRepo.createQueryBuilder('trip')
      .innerJoin(Incident, 'incident', 'incident.id = CAST(trip.incident_id AS uuid)')
      .where('trip.id = :id', { id });

    const roles = requestUser.roles || [];
    const isPlatformAdmin = roles.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN', 'Call Centre Executive (CCE)', 'CCE'].includes(r)
    );

    if (!isPlatformAdmin) {
      if (roles.includes('Hospital Admin') || roles.includes('Fleet Operator')) {
        qb.andWhere('incident.organisationId = :orgId', { orgId: requestUser.organisationId });
      } else {
        throw new ForbiddenException('Insufficient permissions to view this trip');
      }
    }

    const trip = await qb.getOne();
    if (!trip) {
      throw new NotFoundException('Trip not found or access denied');
    }

    return { data: trip };
  }

  async getTripCrew(id: string, requestUser: any) {
    const response = await this.findOneTrip(id, requestUser);
    const trip = response.data;

    return {
      data: {
        trip_id: trip.id,
        driver_id: trip.driver_id,
        emt_id: trip.emt_id,
        assigned_at: trip.dispatched_at
      }
    };
  }
}
