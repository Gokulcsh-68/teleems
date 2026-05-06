import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentTimeline } from './entities/incident-timeline.entity';
import { Vehicle, VehicleStatus } from '@app/common';
import { LocationLog } from '../../fleet-service/src/entities/location-log.entity';
import { TripQueryDto } from './dto/trip-query.dto';
import { UpdateTripStatusDto } from './dto/update-trip-status.dto';
import { StartTripDto } from './dto/start-trip.dto';
import { PatientLoadedDto } from './dto/patient-loaded.dto';
import { AtHospitalDto } from './dto/at-hospital.dto';
import { CancelTripDto } from './dto/cancel-trip.dto';
import { BreakdownDto } from './dto/breakdown.dto';
import { CreateIftTripDto } from './dto/create-ift-trip.dto';
import { VerifyIftDocumentsDto } from './dto/verify-ift-documents.dto';
import { RecordRefusalDto } from './dto/record-refusal.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';
import { RecordVitalsDto } from './dto/record-vitals.dto';
import { RecordInterventionDto } from './dto/record-intervention.dto';
import { CreatePatientProfileDto } from './dto/create-patient-profile.dto';
import { 
  PatientProfile,
  PatientAssessment,
  PatientIntervention,
  PaginatedResponse,
  encodeCursor,
  decodeCursor,
  StorageService,
  MapsService,
  Incident,
  Dispatch,
  StaffProfile,
  Hospital,
  RedisService
} from '@app/common';

import { TripStatus } from './enums/trip-status.enum';
import { DispatchGateway } from './dispatch.gateway';

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
    @InjectRepository(PatientProfile)
    private readonly patientRepo: Repository<PatientProfile>,
    @InjectRepository(PatientAssessment)
    private readonly assessmentRepo: Repository<PatientAssessment>,
    @InjectRepository(PatientIntervention)
    private readonly interventionRepo: Repository<PatientIntervention>,
    @InjectRepository(StaffProfile)
    private readonly staffProfileRepo: Repository<StaffProfile>,
    @InjectRepository(Hospital)
    private readonly hospitalRepo: Repository<Hospital>,
    @InjectRepository(Incident)
    private readonly incidentRepo: Repository<Incident>,
    private readonly storageService: StorageService,
    private readonly mapsService: MapsService,
    private readonly dispatchGateway: DispatchGateway,
    private readonly redisService: RedisService,
  ) {}

  private async getStaffProfileId(userId: string): Promise<string | null> {
    const profile = await this.staffProfileRepo.findOneBy({ userId });
    return profile ? profile.id : null;
  }

  private readonly validTransitions: Record<string, string[]> = {
    [TripStatus.CREATED]: [TripStatus.DISPATCHED],
    [TripStatus.DISPATCHED]: [
      TripStatus.EN_ROUTE_SCENE,
      TripStatus.AT_SCENE,
      TripStatus.CANCELLED,
      TripStatus.BREAKDOWN,
    ],
    [TripStatus.EN_ROUTE_SCENE]: [
      TripStatus.AT_SCENE,
      TripStatus.CANCELLED,
      TripStatus.BREAKDOWN,
    ],
    [TripStatus.AT_SCENE]: [
      TripStatus.PATIENT_LOADED,
      TripStatus.CANCELLED,
      TripStatus.BREAKDOWN,
    ],
    [TripStatus.PATIENT_LOADED]: [
      TripStatus.EN_ROUTE_HOSPITAL,
      TripStatus.AT_HOSPITAL,
      TripStatus.CANCELLED,
      TripStatus.BREAKDOWN,
    ],
    [TripStatus.EN_ROUTE_HOSPITAL]: [
      TripStatus.AT_HOSPITAL,
      TripStatus.CANCELLED,
      TripStatus.BREAKDOWN,
    ],
    [TripStatus.AT_HOSPITAL]: [
      TripStatus.HANDOFF_COMPLETE,
      TripStatus.CANCELLED,
      TripStatus.BREAKDOWN,
    ],
    [TripStatus.HANDOFF_COMPLETE]: [],
    [TripStatus.CANCELLED]: [],
    [TripStatus.BREAKDOWN]: [
      TripStatus.CANCELLED,
      TripStatus.EN_ROUTE_SCENE,
      TripStatus.EN_ROUTE_HOSPITAL,
    ],
  };

  async findAllTrips(query: TripQueryDto, requestUser: any) {
    const {
      status,
      vehicle_id,
      driver_id,
      emt_id,
      date_from,
      date_to,
      incident_id,
      limit: limitStr,
      cursor,
    } = query;

    const parsedLimit = parseInt(limitStr || '50', 10);
    const limit = isNaN(parsedLimit) ? 50 : Math.min(parsedLimit, 100);

    const qb = this.dispatchRepo
      .createQueryBuilder('trip')
      .innerJoin(
        Incident,
        'incident',
        'incident.id = CAST(trip.incident_id AS uuid)',
      )
      .orderBy('trip.dispatched_at', 'DESC')
      .addOrderBy('trip.id', 'DESC');

    // 1. Tenant Isolation
    const roles = requestUser.roles || [];
    const isPlatformAdmin = roles.some((r: string) =>
      [
        'CureSelect Admin',
        'CURESELECT_ADMIN',
        'Call Centre Executive (CCE)',
        'CCE',
      ].includes(r),
    );

    if (!isPlatformAdmin) {
      const orgId = requestUser.organisationId;
      if (!orgId) {
        throw new ForbiddenException('User organization context missing');
      }

      if (
        roles.includes('Hospital Admin') ||
        roles.includes('Fleet Operator')
      ) {
        qb.andWhere('incident.organisationId = :orgId', { orgId });
      } else if (roles.includes('Pilot') || roles.includes('Ambulance Pilot (Driver)') || roles.includes('EMT / Paramedic')) {
        const staffId = await this.getStaffProfileId(requestUser.userId);
        if (!staffId) {
          throw new ForbiddenException('Staff profile not found for current user');
        }
        qb.andWhere('(trip.driver_id = :staffId OR trip.emt_id = :staffId)', { staffId });
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
    if (vehicle_id)
      qb.andWhere('trip.vehicle_id = :vehicle_id', { vehicle_id });
    if (driver_id) qb.andWhere('trip.driver_id = :driver_id', { driver_id });
    if (emt_id) qb.andWhere('trip.emt_id = :emt_id', { emt_id });
    if (incident_id)
      qb.andWhere('trip.incident_id = :incident_id', { incident_id });

    if (date_from)
      qb.andWhere('trip.dispatched_at >= :dateFrom', { dateFrom: date_from });
    if (date_to)
      qb.andWhere('trip.dispatched_at <= :dateTo', { dateTo: date_to });

    // 3. Pagination
    if (cursor) {
      const decoded = decodeCursor(cursor);
      const [cursorDate, cursorId] = decoded.split('|');
      if (cursorDate && cursorId) {
        qb.andWhere(
          '(trip.dispatched_at < :cursorDate OR (trip.dispatched_at = :cursorDate AND trip.id < :cursorId))',
          { cursorDate, cursorId },
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
      next_cursor = encodeCursor(
        `${last.dispatched_at.toISOString()}|${last.id}`,
      );
    }

    return new PaginatedResponse(
      data,
      next_cursor,
      total_count,
      limit,
      data.length,
    );
  }

  async findOneTrip(id: string, requestUser: any) {
    const trip = await this.dispatchRepo.findOne({
      where: { id },
      relations: ['incident', 'destination_hospital']
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    const roles = requestUser.roles || [];
    const isPlatformAdmin = roles.some((r: string) =>
      [
        'CureSelect Admin',
        'CURESELECT_ADMIN',
        'Call Centre Executive (CCE)',
        'CCE',
      ].includes(r),
    );

    if (!isPlatformAdmin) {
      const orgId = requestUser.organisationId || requestUser.org_id;
      const incidentOrgId = trip.incident?.organisationId;

      if (roles.includes('Hospital Admin') || roles.includes('Fleet Operator')) {
        // Organization-level check for admins
        if (incidentOrgId && orgId && incidentOrgId !== orgId) {
          throw new ForbiddenException('Insufficient permissions to view this trip (Organization mismatch)');
        }
      } else if (roles.includes('Pilot') || roles.includes('Ambulance Pilot (Driver)')) {
        // Personal check for Pilots
        const staffId = await this.getStaffProfileId(requestUser.userId);
        if (trip.driver_id !== staffId) {
          throw new ForbiddenException('Insufficient permissions to view this trip (You are not the assigned driver)');
        }
      } else if (roles.includes('EMT / Paramedic')) {
        // Personal check for EMTs
        const staffId = await this.getStaffProfileId(requestUser.userId);
        if (trip.emt_id !== staffId) {
          throw new ForbiddenException('Insufficient permissions to view this trip (You are not the assigned EMT)');
        }
      } else {
        throw new ForbiddenException(
          'Insufficient permissions to view this trip',
        );
      }
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
        assigned_at: trip.dispatched_at,
      },
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
    const logs = await this.locationRepo
      .createQueryBuilder('log')
      .where('log.vehicle_id = :vehicleId', { vehicleId: trip.vehicle_id })
      .andWhere('log.timestamp >= :startTime', { startTime })
      .andWhere('log.timestamp <= :endTime', { endTime })
      .orderBy('log.timestamp', 'ASC')
      .getMany();

    // 4. Transform to standardized format
    const data = logs.map((log) => ({
      latitude: Number(log.latitude),
      longitude: Number(log.longitude),
      timestamp: log.timestamp,
      speed: Number(log.speed),
    }));

    return { data };
  }

  async updateTripStatus(
    id: string,
    dto: UpdateTripStatusDto,
    requestUser: any,
  ) {
    // 1. Fetch trip and validate ownership/isolation
    const response = await this.findOneTrip(id, requestUser);
    const trip = response.data;

    // 2. Validate Transition
    const currentStatus = trip.status || TripStatus.CREATED;
    const allowed = this.validTransitions[currentStatus] || [];

    if (!allowed.includes(dto.status)) {
      throw new ForbiddenException(
        `Invalid transition from ${currentStatus} to ${dto.status}`,
      );
    }

    // 3. Update Trip Status
    trip.status = dto.status;
    await this.dispatchRepo.save(trip);

    // --- SYNC INCIDENT STATUS ---
    let incidentStatus: string | null = null;
    switch (dto.status) {
      case TripStatus.EN_ROUTE_SCENE:
        incidentStatus = 'EN_ROUTE';
        break;
      case TripStatus.AT_SCENE:
        incidentStatus = 'ON_SCENE';
        break;
      case TripStatus.PATIENT_LOADED:
      case TripStatus.EN_ROUTE_HOSPITAL:
        incidentStatus = 'TRANSPORTING';
        break;
      case TripStatus.AT_HOSPITAL:
        incidentStatus = 'AT_HOSPITAL';
        break;
      case TripStatus.HANDOFF_COMPLETE:
        incidentStatus = 'COMPLETED';
        break;
    }

    if (incidentStatus && trip.incident_id) {
      await this.dispatchRepo.manager.update(Incident, trip.incident_id, {
        status: incidentStatus
      });
    }

    // 4. Update Vehicle Status & Location
    const vehicle = await this.vehicleRepo.findOne({ where: { registration_number: trip.vehicle_id! } });
    if (vehicle) {
      if (
        dto.status === TripStatus.HANDOFF_COMPLETE ||
        dto.status === TripStatus.CANCELLED
      ) {
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
      vehicle_id: trip.vehicle_id!,
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

    // 7. Emit WebSocket update to crew and caller
    this.dispatchGateway.notifyStatusUpdate(trip, dto.status);
    if (trip.incident?.caller_id) {
      this.dispatchGateway.notifyCaller(trip.incident.caller_id, 'dispatch:status_updated', {
        trip_id: trip.id,
        status: dto.status,
        timestamp: new Date(),
      });
      
      this.dispatchGateway.notifyVehicleLocation(trip.incident.caller_id, trip.vehicle_id!, {
        lat: dto.gps_lat,
        lon: dto.gps_lon,
        speed: dto.speed,
      });
    }

    return { data: trip };
  }

  async startTrip(id: string, dto: StartTripDto, requestUser: any) {
    // 1. Fetch trip and parent incident
    const qb = this.dispatchRepo
      .createQueryBuilder('trip')
      .innerJoin(
        Incident,
        'incident',
        'incident.id = CAST(trip.incident_id AS uuid)',
      )
      .addSelect(['incident.gps_lat', 'incident.gps_lon'])
      .where('trip.id = :id', { id });

    const roles = requestUser.roles || [];
    const isCrew = roles.some(r => ['Pilot', 'Ambulance Pilot (Driver)', 'EMT / Paramedic'].includes(r));
    const isAdmin = roles.some(r => ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r));

    if (!isCrew && !isAdmin) {
      throw new ForbiddenException('Only assigned crew members or admins can start a trip');
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
    const incident = await this.dispatchRepo.manager.findOne(Incident, {
      where: { id: trip.incident_id },
    });
    let eta_seconds = 120; // Default fallback

    if (incident) {
      const travelData = await this.mapsService.getTravelTime(
        { lat: Number(dto.gps_lat), lng: Number(dto.gps_lon) },
        { lat: Number(incident.gps_lat), lng: Number(incident.gps_lon) },
      );
      eta_seconds = travelData.duration;
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

    // Calculate Real ETA to Hospital
    const hospitalCoords = await this.getHospitalLocation(dto.destination_hospital_id);
    const travelData = await this.mapsService.getTravelTime(
      { lat: Number(dto.gps_lat), lng: Number(dto.gps_lon) },
      { lat: hospitalCoords.lat, lng: hospitalCoords.lon },
    );

    return { data: trip, eta_to_hospital: travelData.duration };
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
      backup_request_id: `BACKUP-${trip.incident_id.split('-')[0]}`,
    };
  }

  async createIftTrip(dto: CreateIftTripDto, requestUser: any) {
    const roles = requestUser.roles || [];
    const isPlatformAdmin = roles.some((r: string) =>
      [
        'CureSelect Admin',
        'CURESELECT_ADMIN',
        'Call Centre Executive (CCE)',
        'CCE',
      ].includes(r),
    );

    const orgId =
      isPlatformAdmin && dto.organisationId
        ? dto.organisationId
        : requestUser.organisationId || requestUser.org_id;

    if (!orgId) throw new ForbiddenException('Organization context missing');

    // 1. Create IFT Incident
    const incident = this.dispatchRepo.manager.create(Incident, {
      category: 'IFT',
      severity: dto.urgency,
      organisationId: orgId,
      gps_lat: 0, // Will be updated by vehicle location
      gps_lon: 0,
      address: `IFT Transfer from ${dto.origin_hospital_id}`,
      patients: [
        {
          id: encodeCursor('PAT'),
          gender: 'UNKNOWN',
          triage_code: dto.urgency,
        },
      ],
      notes: `Patient Summary: ${JSON.stringify(dto.patient_summary)}`,
      status: 'DISPATCHED',
    });
    const savedIncident = await this.dispatchRepo.manager.save(
      Incident,
      incident,
    );

    // 2. Find available vehicle of requested type
    const vehicle = await this.vehicleRepo.findOne({
      where: {
        status: VehicleStatus.AVAILABLE,
        vehicle_type: dto.requested_vehicle_type as any,
        organisationId: orgId,
      },
    });

    // 3. Create IFT Trip
    const trip = this.dispatchRepo.create({
      incident_id: savedIncident.id,
      organisationId: orgId,
      vehicle_id: vehicle?.registration_number || 'TBD',
      dispatched_by: requestUser.userId,
      status: TripStatus.CREATED,
      is_ift: true,
      origin_hospital_id: dto.origin_hospital_id,
      destination_hospital_id: dto.destination_hospital_id,
      ift_metadata: {
        patient_summary: dto.patient_summary,
        urgency: dto.urgency,
        checklist: [
          { name: 'Transfer Certificate', verified: false },
          { name: 'Discharge Summary', verified: false },
          { name: 'Imaging Records (CD/Film)', verified: false },
          { name: 'Patient Belongings', verified: false },
        ],
      },
    });

    const savedTrip = await this.dispatchRepo.save(trip);

    // Timeline Log
    const timeline = this.timelineRepo.create({
      incident_id: savedIncident.id,
      type: 'IFT_CREATED',
      description: `IFT Trip created from ${dto.origin_hospital_id} to ${dto.destination_hospital_id}`,
      user_id: requestUser.userId,
    });
    await this.timelineRepo.save(timeline);

    return { data: savedTrip };
  }

  async getIftDocuments(id: string, requestUser: any) {
    const response = await this.findOneTrip(id, requestUser);
    const trip = response.data;

    if (!trip.is_ift) {
      throw new ForbiddenException('This endpoint is only for IFT trips');
    }

    return {
      data: {
        trip_id: trip.id,
        documents: trip.ift_metadata?.checklist || [],
      },
    };
  }

  async verifyIftDocuments(
    id: string,
    dto: VerifyIftDocumentsDto,
    requestUser: any,
  ) {
    const response = await this.findOneTrip(id, requestUser);
    const trip = response.data;

    if (!trip.is_ift) {
      throw new ForbiddenException('This endpoint is only for IFT trips');
    }

    const metadata = trip.ift_metadata || {};
    metadata.checklist = dto.documents;

    trip.ift_metadata = metadata;
    await this.dispatchRepo.save(trip);

    // Timeline Log for verification
    const timeline = this.timelineRepo.create({
      incident_id: trip.incident_id,
      type: 'IFT_DOCS_VERIFIED',
      description: `IFT transfer documents verified by ${requestUser.userId}`,
      user_id: requestUser.userId,
    });
    await this.timelineRepo.save(timeline);

    return {
      data: {
        trip_id: trip.id,
        documents: trip.ift_metadata?.checklist || [],
      },
    };
  }

  async recordRefusal(id: string, dto: RecordRefusalDto, requestUser: any) {
    const response = await this.findOneTrip(id, requestUser);
    const trip = response.data;

    // 1. Upload Signature to S3
    let signatureUrl = dto.signature_image_base64;
    if (dto.signature_image_base64.startsWith('data:')) {
      const fileName = `${trip.incident_id}_refusal_sig.png`;
      const { dbUrl } = await this.storageService.uploadBase64(
        dto.signature_image_base64,
        'missions/refusals/',
        fileName,
      );
      signatureUrl = dbUrl;
    }

    // 2. Store the Refusal Record
    trip.refusal_record = {
      ...dto,
      signature_image_base64: signatureUrl, // Store URL instead of raw base64
      recorded_at: new Date().toISOString(),
      emt_user_id: requestUser.userId,
    };

    // 2. Automate Mission Termination
    trip.status = TripStatus.CANCELLED;
    trip.cancellation_reason = 'Patient/Family Refusal';

    await this.dispatchRepo.save(trip);

    // 3. Update associated Incident
    await this.dispatchRepo.manager.update(Incident, trip.incident_id, {
      status: 'CANCELLED',
      notes: `[TERMINATED] Patient/Family Refusal recorded by EMT ${requestUser.userId}`,
    });

    // 4. Release Vehicle
    if (trip.vehicle_id && trip.vehicle_id !== 'TBD') {
      await this.vehicleRepo.update(
        { registration_number: trip.vehicle_id },
        { status: VehicleStatus.AVAILABLE },
      );
    }

    // 5. Audit & Timeline
    const timeline = this.timelineRepo.create({
      incident_id: trip.incident_id,
      type: 'TREATMENT_REFUSED',
      description: `Patient/Family Refusal recorded by EMT ${requestUser.userId} at lat:${dto.gps_lat}, lon:${dto.gps_lon}`,
      user_id: requestUser.userId,
    });
    await this.timelineRepo.save(timeline);

    return {
      message: 'Refusal recorded successfully and mission terminated',
      data: trip.refusal_record,
    };
  }

  async getRefusalRecord(id: string, requestUser: any) {
    const response = await this.findOneTrip(id, requestUser);
    const trip = response.data;

    if (!trip.refusal_record) {
      throw new NotFoundException('No refusal record found for this trip');
    }

    return { data: trip.refusal_record };
  }

  async getTripEta(id: string, requestUser: any) {
    const response = await this.findOneTrip(id, requestUser);
    const trip = response.data;

    const vehicle = await this.vehicleRepo.findOneBy({ registration_number: trip.vehicle_id! });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const hospitalCoords = await this.getHospitalLocation(
      trip.destination_hospital_id || 'HOSP-DEFAULT',
    );
    const routeData = await this.mapsService.getTravelTime(
      { lat: Number(vehicle.gps_lat), lng: Number(vehicle.gps_lon) },
      { lat: hospitalCoords.lat, lng: hospitalCoords.lon },
    );

    return {
      eta_seconds: routeData.duration,
      distance_m: routeData.distance,
      vehicle_location: {
        lat: Number(vehicle.gps_lat),
        lon: Number(vehicle.gps_lon),
      },
    };
  }

  async updateDestination(
    id: string,
    dto: UpdateDestinationDto,
    requestUser: any,
  ) {
    const response = await this.findOneTrip(id, requestUser);
    const trip = response.data;

    const oldDest = trip.destination_hospital_id;
    trip.destination_hospital_id = dto.hospital_id;
    await this.dispatchRepo.save(trip);

    // Recalculate ETA for response
    const etaResponse = await this.getTripEta(id, requestUser);

    // Audit Log
    const timeline = this.timelineRepo.create({
      incident_id: trip.incident_id,
      type: 'DESTINATION_CHANGED',
      description: `Destination updated from ${oldDest} to ${dto.hospital_id}. Reason: ${dto.reason || 'N/A'}`,
      user_id: requestUser.userId,
    });
    await this.timelineRepo.save(timeline);

    return {
      data: trip,
      new_eta_seconds: etaResponse.eta_seconds,
    };
  }

  async createOrUpdatePatient(id: string, dto: CreatePatientProfileDto, requestUser: any) {
    const response = await this.findOneTrip(id, requestUser);
    const trip = response.data;

    let patient: PatientProfile | null = null;
    
    if (dto.id) {
      patient = await this.patientRepo.findOneBy({ id: dto.id });
    }

    if (!patient) {
      patient = this.patientRepo.create({
        ...dto as any,
        incident_id: trip.incident_id,
        organisationId: trip.organisationId,
      }) as unknown as PatientProfile;
    } else {
      Object.assign(patient, dto);
    }

    const savedPatient = await this.patientRepo.save(patient!);

    // --- SYNC WITH INCIDENT JSONB ---
    // This ensures my-dispatch/dashboard fetch shows the updated name/data
    const incident = await this.incidentRepo.findOneBy({ id: trip.incident_id });
    if (incident) {
      if (!incident.patients) incident.patients = [];
      const pIdx = incident.patients.findIndex(p => p.id === savedPatient.id || p.name === savedPatient.name);
      const updatedPatientJson = {
        id: savedPatient.id,
        name: savedPatient.name,
        age: savedPatient.age,
        age_range: savedPatient.age_range,
        gender: savedPatient.gender,
        triage_level: savedPatient.triage_code,
        mrn: savedPatient.mrn,
        phone: savedPatient.phone,
        informer_name: savedPatient.informer_name,
        informer_relation: savedPatient.informer_relation,
        informer_phone: savedPatient.informer_phone,
        is_mlc: savedPatient.is_mlc,
        mlc_fir_number: savedPatient.mlc_fir_number,
        mlc_police_station: savedPatient.mlc_police_station,
        mlc_officer_contact: savedPatient.mlc_officer_contact,
        conditions: dto.conditions || [],
        medications: dto.medications || [],
        allergies: dto.allergies || [],
      };

      if (pIdx > -1) {
        incident.patients[pIdx] = updatedPatientJson;
      } else {
        incident.patients.push(updatedPatientJson);
      }
      await this.incidentRepo.save(incident);
    }

    // Handle Medical History...
    if (dto.conditions) {
      await this.patientRepo.manager.delete('patient_conditions', { patient_id: savedPatient.id });
      for (const cond of dto.conditions) {
        await this.patientRepo.manager.insert('patient_conditions', {
          patient_id: savedPatient.id,
          name: cond,
          recorded_by_id: requestUser.userId,
        });
      }
    }

    if (dto.medications) {
      await this.patientRepo.manager.delete('patient_medications', { patient_id: savedPatient.id });
      for (const med of dto.medications) {
        await this.patientRepo.manager.insert('patient_medications', {
          patient_id: savedPatient.id,
          name: med,
          recorded_by_id: requestUser.userId,
        });
      }
    }

    if (dto.allergies) {
      await this.patientRepo.manager.delete('patient_allergies', { patient_id: savedPatient.id });
      for (const allergy of dto.allergies) {
        await this.patientRepo.manager.insert('patient_allergies', {
          patient_id: savedPatient.id,
          allergen: allergy.name,
          severity: allergy.severity?.toUpperCase() || 'MODERATE',
          recorded_by_id: requestUser.userId,
        });
      }
    }

    return { data: savedPatient };
  }

  async recordVitals(id: string, dto: RecordVitalsDto, requestUser: any) {
    const response = await this.findOneTrip(id, requestUser);
    const trip = response.data;

    const patient = await this.patientRepo.findOne({
      where: { incident_id: trip.incident_id },
    });

    if (!patient) throw new NotFoundException('Patient profile not found. Create profile first.');

    const assessment = this.assessmentRepo.create({
      ...dto as any,
      patient_id: patient.id,
      taken_at: dto.taken_at ? new Date(dto.taken_at) : new Date(),
    });

    const savedAssessment = await this.assessmentRepo.save(assessment);
    
    // Broadcast via WebSocket
    this.dispatchGateway.notifyVitalsUpdate(trip.id, {
      patient_id: patient.id,
      vitals: savedAssessment,
    });

    // Stream via Redis for RTVS integration
    this.redisService.publish(`vitals:stream:${patient.id}`, JSON.stringify({
      patient_id: patient.id,
      trip_id: trip.id,
      type: 'manual_entry',
      ...savedAssessment,
      timestamp: new Date(),
    }));

    // Log to timeline
    await this.timelineRepo.save(this.timelineRepo.create({
      incident_id: trip.incident_id,
      type: 'VITALS_RECORDED',
      description: `Vitals recorded: HR ${dto.heart_rate}, BP ${dto.bp_systolic}/${dto.bp_diastolic}`,
      user_id: requestUser.userId,
    }));

    return { data: savedAssessment };
  }

  async recordIntervention(id: string, dto: RecordInterventionDto, requestUser: any) {
    const response = await this.findOneTrip(id, requestUser);
    const trip = response.data;

    const patient = await this.patientRepo.findOne({
      where: { incident_id: trip.incident_id },
    });

    if (!patient) throw new NotFoundException('Patient profile not found.');

    const intervention = this.interventionRepo.create({
      ...dto as any,
      patient_id: patient.id,
      timestamp: new Date(),
    });

    const savedIntervention = await this.interventionRepo.save(intervention);

    // Log to timeline
    await this.timelineRepo.save(this.timelineRepo.create({
      incident_id: trip.incident_id,
      type: 'INTERVENTION',
      description: `Clinical Intervention: ${dto.intervention_name} (${dto.notes || 'No notes'})`,
      user_id: requestUser.userId,
    }));

    return { data: savedIntervention };
  }

  async getNavigationRoute(id: string, requestUser: any) {
    const response = await this.findOneTrip(id, requestUser);
    const trip = response.data;

    const vehicle = await this.vehicleRepo.findOneBy({ registration_number: trip.vehicle_id! });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    // Determine target based on trip status
    const isEnRouteScene = [
      TripStatus.DISPATCHED,
      TripStatus.EN_ROUTE_SCENE,
    ].includes(trip.status as TripStatus);
    const destination = isEnRouteScene
      ? {
          lat: Number(trip.incident.gps_lat),
          lng: Number(trip.incident.gps_lon),
        }
      : await (async () => {
          const h = await this.getHospitalLocation(
            trip.destination_hospital_id || 'HOSP-DEFAULT',
          );
          return { lat: h.lat, lng: h.lon };
        })();

    const route = await this.mapsService.getDirections(
      { lat: Number(vehicle.gps_lat), lng: Number(vehicle.gps_lon) },
      destination,
    );

    return {
      data: {
        polyline: route.polyline,
        bounds: route.bounds,
        steps: route.steps,
        destination_label: isEnRouteScene ? 'Scene' : 'Hospital',
      },
    };
  }

  async getMissionBundle(id: string, requestUser: any) {
    const response = await this.findOneTrip(id, requestUser);
    const trip = response.data;
    const incident = trip.incident;

    // 1. Get Patient Profile
    const patient = await this.patientRepo.findOne({
      where: { incident_id: trip.incident_id },
    });

    let clinical: any = { assessments: [], interventions: [] };
    if (patient) {
      // 2. Get Assessments (Vitals & GCS)
      clinical.assessments = await this.assessmentRepo.find({
        where: { patient_id: patient.id },
        order: { taken_at: 'ASC' },
      });

      // 3. Get Interventions
      clinical.interventions = await this.interventionRepo.find({
        where: { patient_id: patient.id },
        order: { timestamp: 'ASC' },
      });
    }

    return {
      data: {
        meta: {
          trip_id: trip.id,
          incident_id: trip.incident_id,
          organisation_id: trip.organisationId || incident.organisationId,
          generated_at: new Date().toISOString(),
        },
        operational: {
          trip,
          incident,
        },
        clinical: {
          patient,
          assessments: clinical.assessments,
          interventions: clinical.interventions,
        },
      },
    };
  }

  private async getHospitalLocation(id: string): Promise<{ lat: number; lon: number }> {
    // 1. Try to find by UUID (standard lookup)
    const hospital = await this.hospitalRepo.findOne({
      where: [{ id }, { code: id }]
    });

    if (hospital && hospital.gps_lat && hospital.gps_lon) {
      return { 
        lat: Number(hospital.gps_lat), 
        lon: Number(hospital.gps_lon) 
      };
    }

    // 2. Fallback to default if not found (using Bangalore coordinates as base)
    return { lat: 12.9716, lon: 77.5946 };
  }

  private getDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async updateLocation(id: string, dto: { gps_lat: number, gps_lon: number, speed?: number }, requestUser: any) {
    const trip = await this.dispatchRepo.findOne({
      where: { id },
      relations: ['incident']
    });

    if (!trip) throw new NotFoundException('Trip not found');

    if (trip.vehicle_id) {
      await this.vehicleRepo.update({ registration_number: trip.vehicle_id }, {
        gps_lat: dto.gps_lat,
        gps_lon: dto.gps_lon
      });

      if (trip.incident?.caller_id) {
        this.dispatchGateway.notifyVehicleLocation(trip.incident.caller_id, trip.vehicle_id, {
          lat: dto.gps_lat,
          lon: dto.gps_lon,
          speed: dto.speed
        });
      }
    }

    return { success: true };
  }
}
