import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispatch } from './entities/dispatch.entity';
import { Incident } from './entities/incident.entity';
import { IncidentTimeline } from './entities/incident-timeline.entity';
import { Vehicle, VehicleStatus } from '../../fleet-service/src/entities/vehicle.entity';
import { LocationLog } from '../../fleet-service/src/entities/location-log.entity';
import { TripQueryDto } from './dto/trip-query.dto';
import { UpdateTripStatusDto } from './dto/update-trip-status.dto';
import { StartTripDto } from './dto/start-trip.dto';
import { PatientLoadedDto } from './dto/patient-loaded.dto';
import { AtHospitalDto } from './dto/at-hospital.dto';
import { CancelTripDto } from './dto/cancel-trip.dto';
import { BreakdownDto } from './dto/breakdown.dto';
import { TripStatus } from './enums/trip-status.enum';
import { PaginatedResponse, encodeCursor, decodeCursor } from '../../../libs/common/src';

@Injectable()
export class TripService {
  constructor(
    @InjectRepository(Dispatch)
    private readonly dispatchRepo: Repository<Dispatch>,
    @InjectRepository(LocationLog)
    private readonly locationRepo: Repository<LocationLog>,
    @InjectRepository(IncidentTimeline)
    private readonly timelineRepo: Repository<IncidentTimeline>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
  ) {}

  private readonly validTransitions: Record<string, string[]> = {
    [TripStatus.CREATED]: [TripStatus.DISPATCHED],
    [TripStatus.DISPATCHED]: [TripStatus.EN_ROUTE_SCENE, TripStatus.CANCELLED, TripStatus.BREAKDOWN],
    [TripStatus.EN_ROUTE_SCENE]: [TripStatus.AT_SCENE, TripStatus.CANCELLED, TripStatus.BREAKDOWN],
    [TripStatus.AT_SCENE]: [TripStatus.PATIENT_LOADED, TripStatus.CANCELLED, TripStatus.BREAKDOWN],
    [TripStatus.PATIENT_LOADED]: [TripStatus.EN_ROUTE_HOSPITAL, TripStatus.CANCELLED, TripStatus.BREAKDOWN],
    [TripStatus.EN_ROUTE_HOSPITAL]: [TripStatus.AT_HOSPITAL, TripStatus.CANCELLED, TripStatus.BREAKDOWN],
    [TripStatus.AT_HOSPITAL]: [TripStatus.HANDOFF_COMPLETE, TripStatus.CANCELLED, TripStatus.BREAKDOWN],
    [TripStatus.HANDOFF_COMPLETE]: [],
    [TripStatus.CANCELLED]: [],
    [TripStatus.BREAKDOWN]: [TripStatus.CANCELLED, TripStatus.EN_ROUTE_SCENE, TripStatus.EN_ROUTE_HOSPITAL],
  };

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

  async findLocationHistory(tripId: string, requestUser: any) {
    // 1. Find the trip and ensure isolation
    const response = await this.findOneTrip(tripId, requestUser);
    const trip = response.data;

    // 2. Identify the time window
    const startTime = trip.dispatched_at;
    const endTime = trip.status === 'COMPLETED' ? trip.updatedAt : new Date();

    // 3. Query LocationLog table
    const logs = await this.locationRepo.createQueryBuilder('log')
      .where('log.vehicle_id = :vehicleId', { vehicleId: trip.vehicle_id })
      .andWhere('log.timestamp >= :startTime', { startTime })
      .andWhere('log.timestamp <= :endTime', { endTime })
      .orderBy('log.timestamp', 'ASC')
      .getMany();

    // 4. Transform to standardized format
    const data = logs.map(log => ({
      latitude: Number(log.latitude),
      longitude: Number(log.longitude),
      timestamp: log.timestamp,
      speed: Number(log.speed)
    }));

    return { data };
  }

  async updateTripStatus(id: string, dto: UpdateTripStatusDto, requestUser: any) {
    // 1. Fetch trip and validate ownership/isolation
    const response = await this.findOneTrip(id, requestUser);
    const trip = response.data;

    // 2. Validate Transition
    const currentStatus = trip.status || TripStatus.CREATED;
    const allowed = this.validTransitions[currentStatus] || [];
    
    if (!allowed.includes(dto.status)) {
      throw new ForbiddenException(`Invalid transition from ${currentStatus} to ${dto.status}`);
    }

    // 3. Update Trip Status
    trip.status = dto.status;
    await this.dispatchRepo.save(trip);

    // 4. Update Vehicle Status & Location
    const vehicle = await this.vehicleRepo.findOne({ where: { identifier: trip.vehicle_id } });
    if (vehicle) {
      if (dto.status === TripStatus.HANDOFF_COMPLETE || dto.status === TripStatus.CANCELLED) {
        vehicle.status = VehicleStatus.AVAILABLE;
      } else if (dto.status === TripStatus.BREAKDOWN) {
        vehicle.status = VehicleStatus.MAINTENANCE;
      } else {
        vehicle.status = VehicleStatus.DISPATCHED;
      }
      
      vehicle.gps_lat = dto.gps_lat;
      vehicle.gps_lon = dto.gps_lon;
      await this.vehicleRepo.save(vehicle);
    }

    // 5. Log GPS Point
    const log = this.locationRepo.create({
      vehicle_id: trip.vehicle_id,
      latitude: dto.gps_lat,
      longitude: dto.gps_lon,
      speed: dto.speed || 0,
      timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
      organisationId: trip['organisationId'] || requestUser.organisationId,
    });
    await this.locationRepo.save(log);

    // 6. Log Timeline Event
    const timeline = this.timelineRepo.create({
      incident_id: trip.incident_id,
      type: dto.status,
      description: dto.notes || `Trip status updated to ${dto.status}`,
      user_id: requestUser.userId,
    });
    await this.timelineRepo.save(timeline);

    return { data: trip };
  }

  async startTrip(id: string, dto: StartTripDto, requestUser: any) {
    // 1. Fetch trip and parent incident
    const qb = this.dispatchRepo.createQueryBuilder('trip')
      .innerJoin(Incident, 'incident', 'incident.id = CAST(trip.incident_id AS uuid)')
      .addSelect(['incident.gps_lat', 'incident.gps_lon'])
      .where('trip.id = :id', { id });

    const roles = requestUser.roles || [];
    if (!(roles.includes('Pilot') || roles.includes('CureSelect Admin'))) {
      throw new ForbiddenException('Only Pilots can start a trip');
    }

    const trip = await qb.getOne();
    if (!trip) throw new NotFoundException('Trip not found');

    // 2. Perform transition to EN_ROUTE_SCENE
    const updateDto: UpdateTripStatusDto = {
      status: TripStatus.EN_ROUTE_SCENE,
      gps_lat: dto.gps_lat,
      gps_lon: dto.gps_lon,
      notes: dto.notes || 'Trip started by Pilot',
    };

    await this.updateTripStatus(id, updateDto, requestUser);

    // 3. Calculate ETA to scene
    const incident = await this.dispatchRepo.manager.findOne(Incident, { where: { id: trip.incident_id } });
    let eta_seconds = 120; // Default fallback

    if (incident) {
      const distance = this.getDistance(
        Number(dto.gps_lat), 
        Number(dto.gps_lon), 
        Number(incident.gps_lat), 
        Number(incident.gps_lon)
      );
      // Rough estimate: distance in km / 45 km/h * 3600 seconds
      eta_seconds = Math.round((distance / 45) * 3600);
      if (eta_seconds < 60) eta_seconds = 60; // Min 1 min
    }

    return {
      data: { ...trip, status: TripStatus.EN_ROUTE_SCENE },
      eta_seconds,
    };
  }

  async markAtScene(id: string, dto: StartTripDto, requestUser: any) {
    const updateDto: UpdateTripStatusDto = {
      status: TripStatus.AT_SCENE,
      gps_lat: dto.gps_lat,
      gps_lon: dto.gps_lon,
      notes: dto.notes || 'Arrived at scene',
    };

    return this.updateTripStatus(id, updateDto, requestUser);
  }

  async markPatientLoaded(id: string, dto: PatientLoadedDto, requestUser: any) {
    const updateDto: UpdateTripStatusDto = {
      status: TripStatus.PATIENT_LOADED,
      gps_lat: dto.gps_lat,
      gps_lon: dto.gps_lon,
      notes: dto.notes || 'Patient loaded into ambulance',
    };

    const result = await this.updateTripStatus(id, updateDto, requestUser);
    const trip = result.data;
    trip.destination_hospital_id = dto.destination_hospital_id;
    await this.dispatchRepo.save(trip);

    // Simulation: ETA to Hospital (Defaulting to 8 mins if no location service)
    const eta_to_hospital = 480; 

    return { data: trip, eta_to_hospital };
  }

  async markAtHospital(id: string, dto: AtHospitalDto, requestUser: any) {
    const updateDto: UpdateTripStatusDto = {
      status: TripStatus.AT_HOSPITAL,
      gps_lat: dto.gps_lat,
      gps_lon: dto.gps_lon,
      notes: dto.notes || 'Arrived at Hospital Emergency Department',
    };

    const result = await this.updateTripStatus(id, updateDto, requestUser);
    const trip = result.data;
    trip.actual_hospital_id = dto.hospital_id;
    await this.dispatchRepo.save(trip);

    return { data: trip };
  }

  async markHandoff(id: string, dto: StartTripDto, requestUser: any) {
    const updateDto: UpdateTripStatusDto = {
      status: TripStatus.HANDOFF_COMPLETE,
      gps_lat: dto.gps_lat,
      gps_lon: dto.gps_lon,
      notes: dto.notes || 'Clinical handoff complete',
    };

    const result = await this.updateTripStatus(id, updateDto, requestUser);
    const trip = result.data;
    trip.epcr_draft_url = `https://teleems.com/epcr/draft/${trip.id}`;
    await this.dispatchRepo.save(trip);

    return { data: trip, epcr_draft_url: trip.epcr_draft_url };
  }

  async cancelTrip(id: string, dto: CancelTripDto, requestUser: any) {
    const updateDto: UpdateTripStatusDto = {
      status: TripStatus.CANCELLED,
      gps_lat: dto.gps_lat,
      gps_lon: dto.gps_lon,
      notes: dto.reason,
    };

    const result = await this.updateTripStatus(id, updateDto, requestUser);
    const trip = result.data;
    trip.cancellation_reason = dto.reason;
    await this.dispatchRepo.save(trip);

    return { data: trip };
  }

  async reportBreakdown(id: string, dto: BreakdownDto, requestUser: any) {
    const updateDto: UpdateTripStatusDto = {
      status: TripStatus.BREAKDOWN,
      gps_lat: dto.gps_lat,
      gps_lon: dto.gps_lon,
      notes: `Breakdown reported: ${dto.category} - ${dto.reason}`,
    };

    const result = await this.updateTripStatus(id, updateDto, requestUser);
    const trip = result.data;
    trip.breakdown_reason = dto.reason;
    trip.breakdown_category = dto.category;
    await this.dispatchRepo.save(trip);

    return { 
      data: trip, 
      backup_request_id: `BACKUP-${trip.incident_id.split('-')[0]}` 
    };
  }

  private getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
