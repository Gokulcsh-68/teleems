import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, In, Not } from 'typeorm';
import { IncidentTimeline } from './entities/incident-timeline.entity';
import { IncidentEscalation } from './entities/incident-escalation.entity';
import { DispatchIncidentDto } from './dto/dispatch-incident.dto';
import { CreateIncidentDto, TriageLevel, IncidentSeverity } from './dto/create-incident.dto';
import { UpdateIncidentStatusDto, AssignVehicleDto, UpdateIncidentDto, CancelIncidentDto } from './dto/update-incident.dto';
import { ReassignVehicleDto } from './dto/reassign-vehicle.dto';
import { CancelDispatchDto } from './dto/cancel-dispatch.dto';
import { RecommendVehicleDto } from './dto/recommend-vehicle.dto';
import { AddPatientDto } from './dto/add-patient.dto';
import { BulkAddPatientsDto } from './dto/bulk-add-patients.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { IncidentQueryDto } from './dto/incident-query.dto';
import {
  SLAStatusDto,
  SLATimerStatus,
  SLATimerDetail,
} from './dto/sla-status.dto';
import { SlaBreachQueryDto } from './dto/sla-breach-query.dto';
import { EscalateIncidentDto } from './dto/escalate-incident.dto';
import { IncidentAnalyticsQueryDto } from './dto/incident-analytics-query.dto';
import {
  PaginationQueryDto,
  OffsetPaginationQueryDto,
} from './dto/pagination-query.dto';
import { v4 as uuid } from 'uuid';
import {
  PaginatedResponse,
  encodeCursor,
  decodeCursor,
  MapsService,
  AuditLogService,
  Incident,
  Dispatch,
  Vehicle,
  VehicleStatus,
  DutyShift,
  DutyShiftStatus,
  VehicleInventory,
  StaffProfile,
  IncidentFeedback,
  User,
  StaffType,
} from '@app/common';

export interface AuditContext {
  userId: string;
  ip: string;
  userAgent: string;
  organisationId?: string;
}

import { DispatchGateway } from './dispatch.gateway';

@Injectable()
export class DispatchServiceService implements OnModuleInit {
  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(IncidentTimeline)
    private readonly timelineRepository: Repository<IncidentTimeline>,
    @InjectRepository(Dispatch)
    private readonly dispatchRepository: Repository<Dispatch>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(IncidentEscalation)
    private readonly escalationRepository: Repository<IncidentEscalation>,
    @InjectRepository(DutyShift)
    private readonly dutyShiftRepository: Repository<DutyShift>,
    @InjectRepository(VehicleInventory)
    private readonly inventoryRepository: Repository<VehicleInventory>,
    @InjectRepository(StaffProfile)
    private readonly staffProfileRepository: Repository<StaffProfile>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(IncidentFeedback)
    private readonly feedbackRepository: Repository<IncidentFeedback>,
    private readonly auditLogService: AuditLogService,
    private readonly mapsService: MapsService,
    private readonly dispatchGateway: DispatchGateway,
  ) {}

  onModuleInit() {
    // Periodically retry auto-assignment for PENDING incidents
    // This handles the case where staff wasn't on duty when the incident was booked.
    setInterval(() => {
      this.retryPendingIncidents();
    }, 15000); // Check every 15 seconds
  }

  private async retryPendingIncidents() {
    try {
      const pendingIncidents = await this.incidentRepository.find({
        where: { status: 'PENDING' },
        order: { createdAt: 'ASC' }
      });

      for (const incident of pendingIncidents) {
        try {
          await this.startAutoAssignment(incident.id, {
            userId: 'SYSTEM',
            ip: '127.0.0.1',
            userAgent: 'Auto-Retry-Cron',
          });
        } catch (err) {
          // If startAutoAssignment fails (e.g. still no vehicle available), it throws an error.
          // We can safely ignore it and it will retry next time.
        }
      }
    } catch (err) {
      console.error('[DispatchService] Error in retryPendingIncidents:', err);
    }
  }

  private async getStaffProfileId(userId: string): Promise<string | null> {
    const profile = await this.staffProfileRepository.findOneBy({ userId });
    return profile ? profile.id : null;
  }

  private async logSecurityAudit(
    userId: string,
    action: string,
    incidentId: string,
    request: { ip: string; userAgent: string },
    metadata: Record<string, any> = {},
  ) {
    await this.auditLogService.log({
      userId,
      action,
      ipAddress: request.ip,
      userAgent: request.userAgent,
      metadata: {
        ...metadata,
        entityType: 'incident',
        entityId: incidentId,
      },
    });
  }

  private async logTimelineEvent(
    incidentId: string,
    type: string,
    description: string,
    userId?: string,
    metadata?: Record<string, any>,
  ) {
    const event = this.timelineRepository.create({
      incident_id: incidentId,
      type,
      description,
      user_id: userId,
      metadata,
    });
    await this.timelineRepository.save(event);
  }

  private getDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  /**
   * New Fleet-Aware search logic (Sequential Dispatch).
   * Finds the best ambulance that is AVAILABLE, has an ACTIVE SHIFT, 
   * and is NOT in the excluded list (already rejected).
   */
  private async findNextBestAmbulance(
    lat: number, 
    lon: number, 
    excludeVehicleIds: string[] = []
  ): Promise<{ vehicle: Vehicle; duration: number } | null> {
    // 1. Find all active shifts (crews that are currently on duty)
    // CRITICAL: We only consider shifts that have BOTH a driver and a medical staff (EMT/Doctor)
    const activeShifts = await this.dutyShiftRepository.find({
      where: { status: 'ON_DUTY' as any },
      relations: ['vehicle']
    });

    // 2. Identify unique available vehicles with active FULL crews
    const candidateVehicles = activeShifts.length === 0 ? [] : activeShifts
      .filter(s => s && s.driverId && s.staffId && s.vehicle) // Safely check for vehicle relation
      .map(s => s.vehicle)
      .filter(v => 
        v && // Double safety check for the vehicle object
        v.status === VehicleStatus.AVAILABLE && 
        !excludeVehicleIds.includes(v.id) &&
        !excludeVehicleIds.includes(v.registration_number)
      );

    if (candidateVehicles.length === 0) {
      // FOR TESTING/LOCAL: Fallback to ANY available vehicle if no shifts are found
      // But still MUST respect the exclusion list (already rejected)
      const qb = this.vehicleRepository.createQueryBuilder('vehicle')
        .where('vehicle.status = :status', { status: VehicleStatus.AVAILABLE });
      
      if (excludeVehicleIds.length > 0) {
        qb.andWhere('vehicle.registration_number NOT IN (:...excludes)', { excludes: excludeVehicleIds });
        qb.andWhere('vehicle.id NOT IN (:...excludes)', { excludes: excludeVehicleIds });
      }

      const anyAvailable = await qb.getOne();
      if (anyAvailable) return { vehicle: anyAvailable, duration: 300 };
      return null;
    }

    // 3. Proximity Search (Haversine)
    const candidates = candidateVehicles.map(vehicle => {
      const distance = this.getHaversine(
        Number(lat), 
        Number(lon), 
        Number(vehicle.gps_lat), 
        Number(vehicle.gps_lon)
      );
      return { vehicle, distance };
    });

    candidates.sort((a, b) => a.distance - b.distance);
    const topCandidates = candidates.slice(0, 5);

    // 4. Travel Time Search
    let bestVehicle: Vehicle | null = topCandidates[0].vehicle;
    let minDuration = Infinity;

    for (const item of topCandidates) {
      try {
        const routeData = await this.mapsService.getTravelTime(
          { lat: Number(lat), lng: Number(lon) },
          { lat: Number(item.vehicle.gps_lat), lng: Number(item.vehicle.gps_lon) }
        );

        if (routeData.duration < minDuration) {
          minDuration = routeData.duration;
          bestVehicle = item.vehicle;
        }
      } catch (err) {
        // Fallback to haversine if maps fail
        if (item.distance < minDuration) {
          minDuration = item.distance;
          bestVehicle = item.vehicle;
        }
      }
    }

    return bestVehicle ? { vehicle: bestVehicle, duration: minDuration } : null;
  }

  private async findNearestVehicle(lat: number, lon: number): Promise<Vehicle | null> {
    const availableVehicles = await this.vehicleRepository.find({
      where: { status: VehicleStatus.AVAILABLE },
    });

    if (availableVehicles.length === 0) return null;

    // 1. Filter to top 5 candidates by physical distance (Haversine)
    const candidates = availableVehicles.map((vehicle) => {
      const distance = this.getHaversine(
        Number(lat),
        Number(lon),
        Number(vehicle.gps_lat),
        Number(vehicle.gps_lon),
      );
      return { vehicle, distance };
    });

    candidates.sort((a, b) => a.distance - b.distance);
    const topCandidates = candidates.slice(0, 5);

    // 2. Get real travel time from Google for these candidates
    let bestVehicle: Vehicle | null = topCandidates[0].vehicle;
    let minDuration = Infinity;

    for (const item of topCandidates) {
      const routeData = await this.mapsService.getTravelTime(
        { lat: Number(lat), lng: Number(lon) },
        {
          lat: Number(item.vehicle.gps_lat),
          lng: Number(item.vehicle.gps_lon),
        },
      );

      if (routeData.duration < minDuration) {
        minDuration = routeData.duration;
        bestVehicle = item.vehicle;
      }
    }

    return bestVehicle;
  }

  private getHaversine(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371;
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

  private async notifyEmergencyContacts(incident: Incident) {
    if (!incident.caller_id) return;

    try {
      const user = await this.userRepository.findOne({
        where: { id: incident.caller_id }
      });

      if (user && user.metadata?.emergency_contacts) {
        const contacts = user.metadata.emergency_contacts;
        for (const contact of contacts) {
          console.log(`[NOTIFICATION] Sending SMS to emergency contact ${contact.name} (${contact.phone}): ` +
            `Emergency booked for ${user.name || 'User'}. Location: ${incident.address}. ` +
            `Mission ID: ${incident.id.slice(0, 8)}`);
          // Integration point for SMS gateway (Twilio, Msg91, etc.)
        }
      }
    } catch (err) {
      console.error('[DispatchService] Failed to notify emergency contacts:', err);
    }
  }

  async createIncident(dto: CreateIncidentDto, context: Partial<AuditContext>) {
    // Construct a full AuditContext with defaults for mandatory fields
    const fullContext: AuditContext = {
      userId: context.userId || dto.caller_id || 'GUEST',
      ip: context.ip || '0.0.0.0',
      userAgent: context.userAgent || 'unknown',
      organisationId: context.organisationId || dto.organisationId,
    };

    // Step 1 & 2: Map TriageLevel to internal severity if explicit severity is missing
    let severity = dto.severity;
    if (!severity && dto.triage_level) {
      if (dto.triage_level === TriageLevel.RED) severity = IncidentSeverity.CRITICAL;
      else if (dto.triage_level === TriageLevel.ORANGE) severity = IncidentSeverity.HIGH;
      else if (dto.triage_level === TriageLevel.GREEN) severity = IncidentSeverity.MEDIUM;
      else severity = IncidentSeverity.LOW;
    }

    const incidentData: Partial<Incident> = {
      ...dto,
      severity: severity || IncidentSeverity.LOW,
      organisationId: fullContext.organisationId,
      patients: dto.patients.map(p => ({
        id: uuid(),
        ...p,
        triage_level: p.triage_level || dto.triage_level || TriageLevel.GREEN,
        symptoms: p.symptoms || [],
      })),
      caller_id: fullContext.userId,
      guest_name: dto.guest_name,
      guest_phone: dto.guest_phone,
      status: 'PENDING',
    };

    const incident = this.incidentRepository.create(incidentData);
    await this.incidentRepository.save(incident);

    // Trigger emergency contact notifications
    await this.notifyEmergencyContacts(incident);

    await this.logTimelineEvent(
      incident.id,
      'CREATED',
      `Incident reported by ${incident.caller_id}`,
      fullContext.userId,
      { category: incident.category, severity: incident.severity }
    );

    await this.logSecurityAudit(
      fullContext.userId,
      'INCIDENT_CREATED',
      incident.id,
      fullContext,
      { category: incident.category, severity: incident.severity }
    );

    // --- AUTOMATED TRIGGER: Start Auto-Assignment immediately ---
    let assigned_vehicle: string | null = null;
    let eta_seconds: number | null = null;

    try {
      const autoAssignResult = await this.startAutoAssignment(incident.id, fullContext);
      if (autoAssignResult && autoAssignResult.data) {
        assigned_vehicle = autoAssignResult.data.vehicle_id;
        eta_seconds = autoAssignResult.data.eta_seconds;
        
        // Reload incident to get latest status and assignment fields
        const latest = await this.incidentRepository.findOne({
          where: { id: incident.id }
        });
        if (latest) {
          // Notify Caller via WebSocket about the assignment
          this.dispatchGateway.notifyCaller(latest.caller_id, 'dispatch:assigned', {
            incident_id: latest.id,
            vehicle_id: assigned_vehicle,
            eta_seconds,
          });

          return {
            data: latest,
            assigned_vehicle,
            eta_seconds,
          };
        }
      }
    } catch (err) {
      console.log(`Auto-assignment skipped or failed for incident ${incident.id}: ${err.message}`);
    }

    return {
      data: incident,
      assigned_vehicle,
      eta_seconds,
    };
  }

  async findAll(query: IncidentQueryDto, requestUser: any) {
    const {
      status,
      category,
      severity,
      org_id,
      caller_id,
      date_from,
      date_to,
      limit,
      cursor,
    } = query;

    const queryBuilder = this.incidentRepository.createQueryBuilder('incident');

    // 1. RBAC & Tenant Isolation
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
      console.log('--- MISSION HISTORY DEBUG ---');
      console.log('Request User ID:', requestUser.userId);
      console.log('Request User Roles:', requestUser.roles);
      console.log('Request User Org:', requestUser.organisationId);
      console.log('-----------------------------');

      queryBuilder.andWhere(
        new Brackets((qb) => {
          // Rule 1: Always show incidents where the user is the reporter
          qb.where('incident.caller_id = :userId', { userId: requestUser.userId });

          // Rule 2: Also show missions assigned to their organization (if they have one)
          const orgId = requestUser.organisationId || requestUser.org_id;
          if (orgId) {
            qb.orWhere('incident.organisationId = :orgId', { orgId });
          }

          // Rule 3: Auto-claim GUEST incidents if the phone number matches
          if (requestUser.phone) {
            qb.orWhere(
              new Brackets((inner) => {
                inner
                  .where('incident.caller_id = :guest', { guest: 'GUEST' })
                  .andWhere('incident.guest_phone = :phone', {
                    phone: requestUser.phone,
                  });
              }),
            );
          }
        }),
      );
    } else {
      // Platform Admin Filters
      if (org_id)
        queryBuilder.andWhere('incident.organisationId = :org_id', { org_id });
      if (caller_id)
        queryBuilder.andWhere('incident.caller_id = :caller_id', { caller_id });
    }

    // 2. Filters
    if (status) queryBuilder.andWhere('incident.status = :status', { status });
    if (category)
      queryBuilder.andWhere('incident.category = :category', { category });
    if (severity)
      queryBuilder.andWhere('incident.severity = :severity', { severity });

    // 3. Date Range Filters
    if (date_from) {
      queryBuilder.andWhere('incident.createdAt >= :date_from', { date_from });
    }
    if (date_to) {
      queryBuilder.andWhere('incident.createdAt <= :date_to', { date_to });
    }

    // 4. Cursor Pagination Logic
    // Using (createdAt, id) for stable, unique sorting
    if (cursor) {
      const decodedCursor = decodeCursor(cursor);
      const [cursorDate, cursorId] = decodedCursor.split('|');

      if (cursorDate && cursorId) {
        queryBuilder.andWhere(
          '(incident.createdAt < :cursorDate OR (incident.createdAt = :cursorDate AND incident.id < :cursorId))',
          { cursorDate, cursorId },
        );
      }
    }

    // Sort: Newest to Oldest
    queryBuilder.orderBy('incident.createdAt', 'DESC');
    queryBuilder.addOrderBy('incident.id', 'DESC');

    // Fetch limit + 1 to determine if there is a next page
    queryBuilder.take(limit + 1);

    const incidents = await queryBuilder.getMany();

    let next_cursor: string | null = null;
    const hasNextPage = incidents.length > limit;
    const data = hasNextPage ? incidents.slice(0, limit) : incidents;

    if (hasNextPage) {
      const lastItem = data[data.length - 1];
      next_cursor = encodeCursor(
        `${lastItem.createdAt.toISOString()}|${lastItem.id}`,
      );
    }

    const total_count = await queryBuilder.getCount(); // Optional: might be expensive on very large tables

    return new PaginatedResponse(
      data,
      next_cursor,
      total_count,
      limit,
      data.length,
    );
  }

  async findAllWithoutPagination(query: IncidentQueryDto, requestUser: any) {
    const { status, category, severity, org_id, caller_id, date_from, date_to } = query;
    const queryBuilder = this.incidentRepository.createQueryBuilder('incident');

    // 1. RBAC & Tenant Isolation
    const roles = requestUser.roles || [];
    const isPlatformAdmin = roles.some((r: string) =>
      ['CureSelect Admin', 'CURESELECT_ADMIN', 'Call Centre Executive (CCE)', 'CCE'].includes(r),
    );

    if (!isPlatformAdmin) {
      if (roles.includes('Hospital Admin') || roles.includes('Fleet Operator')) {
        const orgId = requestUser.organisationId || requestUser.org_id;
        if (!orgId) throw new ForbiddenException('User organization context missing');
        queryBuilder.andWhere('incident.organisationId = :orgId', { orgId });
      } else if (roles.includes('Caller (Public)') || roles.includes('Individual Dispatcher')) {
        queryBuilder.andWhere('incident.caller_id = :userId', { userId: requestUser.userId });
      } else {
        throw new ForbiddenException('Insufficient permissions to list incidents');
      }
    } else {
      if (org_id) queryBuilder.andWhere('incident.organisationId = :org_id', { org_id });
      if (caller_id) queryBuilder.andWhere('incident.caller_id = :caller_id', { caller_id });
    }

    // 2. Filters
    if (status) queryBuilder.andWhere('incident.status = :status', { status });
    if (category) queryBuilder.andWhere('incident.category = :category', { category });
    if (severity) queryBuilder.andWhere('incident.severity = :severity', { severity });
    if (date_from) queryBuilder.andWhere('incident.createdAt >= :date_from', { date_from });
    if (date_to) queryBuilder.andWhere('incident.createdAt <= :date_to', { date_to });

    queryBuilder.orderBy('incident.createdAt', 'DESC');
    queryBuilder.addOrderBy('incident.id', 'DESC');

    const data = await queryBuilder.getMany();
    return {
      status: 200,
      message: 'Success',
      data,
      total: data.length
    };
  }

  async findOne(id: string, requestUser?: any) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }

    // Security: Enforce Tenant and User Isolation
    if (requestUser) {
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
        // 1. Case-insensitive check for Hospital Admin
        const isHospitalAdmin = roles.some(
          (r) => r.toUpperCase() === 'HOSPITAL ADMIN',
        );

        if (isHospitalAdmin) {
          if (incident.organisationId !== requestUser.org_id) {
            throw new ForbiddenException(
              'Access denied: You can only access incidents in your own organization',
            );
          }
        }
        // 2. Regular User / Fleet Operator Isolation (must be the caller)
        else if (incident.caller_id !== requestUser.userId) {
          throw new ForbiddenException(
            'You do not have permission to access this incident',
          );
        }
      }
    }

    const response: any = { data: incident };

    if (incident.assigned_vehicle) {
      const vehicle = await this.vehicleRepository.findOneBy({
        registration_number: incident.assigned_vehicle,
      });
      if (vehicle) {
        response.vehicle = vehicle;
        
        // Fetch active duty shift with crew details (Driver info)
        const activeShift = await this.dutyShiftRepository.createQueryBuilder('shift')
          .leftJoinAndMapOne('shift.driver', StaffProfile, 'driver', 'driver.id = shift.driverId')
          .leftJoinAndMapOne('driver.user', User, 'driverUser', 'driverUser.id = driver.userId')
          .where('shift.vehicleId = :vehicleId', { vehicleId: vehicle.id })
          .andWhere('shift.status = :status', { status: 'ON_DUTY' })
          .getOne();

        if (activeShift && (activeShift as any).driver?.user) {
          const driverUser = (activeShift as any).driver.user;
          response.driver = {
            name: driverUser.name,
            phone: driverUser.phone,
          };
        }
      }
    }

    return response;
  }

  async updateIncident(
    id: string,
    dto: UpdateIncidentDto,
    context: AuditContext,
  ) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) throw new NotFoundException('Incident not found');

    const originalData = { ...incident };

    // Only apply fields if they are provided in the DTO
    if (dto.category) incident.category = dto.category;
    if (dto.severity) incident.severity = dto.severity;
    if (dto.address) incident.address = dto.address;
    if (dto.notes) {
      incident.notes = incident.notes
        ? `${incident.notes}\n${dto.notes}`
        : dto.notes;
    }

    await this.incidentRepository.save(incident);

    await this.logTimelineEvent(
      incident.id,
      'UPDATED',
      'Incident details updated',
      context.userId,
      {
        updates: dto,
        previous: {
          category: originalData.category,
          severity: originalData.severity,
          address: originalData.address,
        },
      },
    );

    await this.logSecurityAudit(
      context.userId,
      'INCIDENT_UPDATED',
      incident.id,
      context,
      { updates: dto },
    );

    return { data: incident };
  }

  async cancelIncident(
    id: string,
    dto: CancelIncidentDto,
    context: AuditContext,
  ) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) throw new NotFoundException('Incident not found');

    if (incident.status !== 'PENDING') {
      throw new BadRequestException(
        'Incident can only be cancelled before dispatch (status: PENDING)',
      );
    }

    incident.status = 'CANCELLED';
    const cancelNote = `[CANCELLED] Reason: ${dto.reason}`;
    incident.notes = incident.notes
      ? `${incident.notes}\n${cancelNote}`
      : cancelNote;

    await this.incidentRepository.save(incident);

    await this.logTimelineEvent(
      incident.id,
      'CANCELLED',
      `Incident cancelled: ${dto.reason}`,
      context.userId,
      { reason: dto.reason },
    );

    await this.logSecurityAudit(
      context.userId,
      'INCIDENT_CANCELLED',
      incident.id,
      context,
      { reason: dto.reason },
    );

    return { data: incident };
  }

  async getAuditLogs(id: string, limit = 50, cursor?: string) {
    return this.auditLogService.getLogsByEntity('incident', id, limit, cursor);
  }

  async updateStatus(
    id: string,
    dto: UpdateIncidentStatusDto,
    context: AuditContext,
    user?: any
  ) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) throw new NotFoundException('Incident not found');

    // RBAC: Public callers can only cancel their OWN incidents
    if (user && user.roles.includes('Caller (Public)')) {
      if (incident.caller_id !== user.userId) {
        throw new ForbiddenException('You can only update status of your own incidents');
      }
      if (dto.status !== 'CANCELLED') {
        throw new BadRequestException('Public callers can only cancel incidents');
      }
    }

    const oldStatus = incident.status;
    incident.status = dto.status;
    if (dto.notes) {
      incident.notes = incident.notes
        ? `${incident.notes}\n${dto.notes}`
        : dto.notes;
    }

    await this.incidentRepository.save(incident);

    await this.logTimelineEvent(
      incident.id,
      'STATUS_CHANGE',
      `Status changed from ${oldStatus} to ${dto.status}`,
      context.userId,
      { oldStatus, newStatus: dto.status, notes: dto.notes },
    );

    await this.logSecurityAudit(
      context.userId,
      'INCIDENT_STATUS_CHANGE',
      incident.id,
      context,
      { oldStatus, newStatus: dto.status },
    );

    return { data: incident };
  }

  async assignVehicle(
    id: string,
    dto: AssignVehicleDto,
    context: AuditContext,
  ) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) throw new NotFoundException('Incident not found');

    const vehicle = await this.vehicleRepository.findOneBy({
      registration_number: dto.vehicle_id,
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    if (vehicle.status !== VehicleStatus.AVAILABLE) {
      throw new BadRequestException(
        `Vehicle '${dto.vehicle_id}' is not available (Status: ${vehicle.status})`,
      );
    }

    // Update vehicle status
    vehicle.status = VehicleStatus.BUSY;
    await this.vehicleRepository.save(vehicle);

    incident.assigned_vehicle = dto.vehicle_id;
    incident.status = 'ASSIGNED';
    if (dto.eta_seconds !== undefined) {
      incident.eta_seconds = dto.eta_seconds;
    }

    await this.incidentRepository.save(incident);

    await this.logTimelineEvent(
      incident.id,
      'VEHICLE_ASSIGNED',
      `Vehicle ${dto.vehicle_id} assigned to incident`,
      context.userId,
      { vehicle_id: dto.vehicle_id, eta_seconds: dto.eta_seconds },
    );

    await this.logSecurityAudit(
      context.userId,
      'INCIDENT_VEHICLE_ASSIGNED',
      incident.id,
      context,
      { vehicle_id: dto.vehicle_id, eta_seconds: dto.eta_seconds },
    );

    return { data: incident };
  }

  async dispatchIncident(
    id: string,
    dto: DispatchIncidentDto,
    context: AuditContext,
  ) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) throw new NotFoundException('Incident not found');

    if (incident.status !== 'PENDING' && incident.status !== 'ASSIGNED') {
      throw new BadRequestException(
        `Cannot dispatch incident with status '${incident.status}'. Must be PENDING or ASSIGNED.`,
      );
    }

    // Determine vehicle: manual override or auto-assign nearest
    const isManualOverride = !!dto.manual_vehicle_id;
    let targetVehicle: Vehicle | null = null;
    let vehicleId: string;
    let eta: number;

    if (isManualOverride) {
      targetVehicle = await this.vehicleRepository.findOneBy({
        registration_number: dto.manual_vehicle_id!,
      });
      if (!targetVehicle)
        throw new NotFoundException('Selected vehicle not found');
      if (targetVehicle.status !== VehicleStatus.AVAILABLE) {
        throw new BadRequestException(
          `Vehicle '${dto.manual_vehicle_id}' is not available.`,
        );
      }
      vehicleId = targetVehicle.registration_number;
      // Simulated ETA for manually selected vehicle (distance based)
      const dist = this.getDistance(
        Number(incident.gps_lat),
        Number(incident.gps_lon),
        Number(targetVehicle.gps_lat),
        Number(targetVehicle.gps_lon),
      );
      eta = Math.floor((dist / 30) * 3600); // 30km/h avg speed
    } else {
      targetVehicle = await this.findNearestVehicle(
        incident.gps_lat,
        incident.gps_lon,
      );
      if (!targetVehicle) {
        throw new BadRequestException(
          'No available ambulances found in the system for auto-assignment.',
        );
      }
      vehicleId = targetVehicle.registration_number;
      const dist = this.getDistance(
        Number(incident.gps_lat),
        Number(incident.gps_lon),
        Number(targetVehicle.gps_lat),
        Number(targetVehicle.gps_lon),
      );
      eta = Math.floor((dist / 30) * 3600);
    }

    // Buffer minimum ETA (2 mins)
    if (eta < 120) eta = 120;

    // Update the vehicle status to BUSY
    targetVehicle.status = VehicleStatus.BUSY;
    await this.vehicleRepository.save(targetVehicle);

    // 3. Find the Active Shift to get Driver/EMT IDs
    const activeShift = await this.dutyShiftRepository.findOne({
      where: { 
        vehicleId: targetVehicle.id, 
        status: 'ON_DUTY' as any 
      }
    });

    // Create the dispatch record
    const dispatch = this.dispatchRepository.create({
      incident_id: incident.id,
      vehicle_id: vehicleId,
      dispatched_by: context.userId,
      status: 'DISPATCHED',
      driver_id: activeShift?.driverId,
      emt_id: activeShift?.staffId,
      eta_seconds: eta,
      manual_vehicle_id: dto.manual_vehicle_id || null,
      override_reason: dto.override_reason || null,
      is_manual_override: isManualOverride,
      organisationId: incident.organisationId,
    });
    await this.dispatchRepository.save(dispatch);

    // --- REAL-TIME NOTIFICATION: WebSocket Alert ---
    try {
      const crewUserIds: string[] = [];
      if (dispatch.driver_id) {
        const driverProfile = await this.staffProfileRepository.findOneBy({ id: dispatch.driver_id });
        if (driverProfile?.userId) crewUserIds.push(driverProfile.userId);
      }
      if (dispatch.emt_id) {
        const emtProfile = await this.staffProfileRepository.findOneBy({ id: dispatch.emt_id });
        if (emtProfile?.userId) crewUserIds.push(emtProfile.userId);
      }

      for (const userId of crewUserIds) {
        this.dispatchGateway.server.to(`user_${userId}`).emit('dispatch:assigned', {
          id: dispatch.id,
          incident,
          eta_seconds: eta,
        });
      }
    } catch (err) {
      console.warn(`[DISPATCH] Failed to send real-time notification: ${err.message}`);
    }

    // Update the incident
    incident.assigned_vehicle = vehicleId;
    incident.status = 'DISPATCHED';
    incident.eta_seconds = eta;
    await this.incidentRepository.save(incident);

    // Timeline event
    const description = isManualOverride
      ? `Dispatch triggered (manual override: ${vehicleId}). Reason: ${dto.override_reason || 'N/A'}`
      : `Dispatch triggered (auto-assigned nearest: ${vehicleId})`;

    await this.logTimelineEvent(
      incident.id,
      'DISPATCHED',
      description,
      context.userId,
      { vehicle_id: vehicleId, eta_seconds: eta, is_manual: isManualOverride },
    );

    // Audit log
    await this.logSecurityAudit(
      context.userId,
      'INCIDENT_DISPATCHED',
      incident.id,
      context,
      {
        vehicle_id: vehicleId,
        eta_seconds: eta,
        is_manual: isManualOverride,
        override_reason: dto.override_reason,
      },
    );

    return {
      data: dispatch,
      vehicle: {
        id: vehicleId,
        status: 'DISPATCHED',
      },
      eta_seconds: eta,
    };
  }

  async reassignVehicle(
    id: string,
    dto: ReassignVehicleDto,
    context: AuditContext,
  ) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) throw new NotFoundException('Incident not found');

    // 1. Find the active dispatch for this incident
    // We look for the most recent record that isn't COMPLETED or CANCELLED
    const currentDispatch = await this.dispatchRepository.findOne({
      where: { incident_id: id },
      order: { dispatched_at: 'DESC' },
    });

    if (!currentDispatch) {
      throw new BadRequestException(
        'No active dispatch found for this incident.',
      );
    }

    if (
      incident.status === 'COMPLETED' ||
      incident.status === 'CANCELLED' ||
      incident.status === 'ON_SCENE'
    ) {
      throw new BadRequestException(
        `Cannot reassign vehicle for incident with status '${incident.status}'.`,
      );
    }

    // 2. Identify and release the old vehicle
    const oldVehicle = await this.vehicleRepository.findOneBy({ registration_number: currentDispatch.vehicle_id! });
    if (oldVehicle) {
      oldVehicle.status = VehicleStatus.AVAILABLE;
      await this.vehicleRepository.save(oldVehicle);
    }

    // 3. Identify and lock the new vehicle
    const newVehicle = await this.vehicleRepository.findOneBy({
      registration_number: dto.new_vehicle_id,
    });
    if (!newVehicle)
      throw new NotFoundException(
        `New vehicle '${dto.new_vehicle_id}' not found.`,
      );
    if (newVehicle.status !== VehicleStatus.AVAILABLE) {
      throw new BadRequestException(
        `Vehicle '${dto.new_vehicle_id}' is not available.`,
      );
    }

    newVehicle.status = VehicleStatus.BUSY;
    await this.vehicleRepository.save(newVehicle);

    // 4. Update the Dispatch record
    // We keep the record history by updating the existing one or marking it as reassigned and creating new.
    // Usually, updating the active record is cleaner for active dispatch tracking.
    const oldVehicleId = currentDispatch.vehicle_id;
    currentDispatch.vehicle_id = dto.new_vehicle_id;

    // Recalculate ETA from new vehicle location
    const dist = this.getDistance(
      incident.gps_lat,
      incident.gps_lon,
      newVehicle.gps_lat,
      newVehicle.gps_lon,
    );
    let newEta = Math.floor((dist / 30) * 3600);
    if (newEta < 120) newEta = 120; // 2 min min

    currentDispatch.eta_seconds = newEta;
    currentDispatch.is_manual_override = true; // Reassignment is always manual
    currentDispatch.override_reason = `REASSIGNED: ${dto.reason}`;
    await this.dispatchRepository.save(currentDispatch);

    // 5. Update Incident
    incident.assigned_vehicle = dto.new_vehicle_id;
    incident.eta_seconds = newEta;
    await this.incidentRepository.save(incident);

    // 6. Logging
    await this.logTimelineEvent(
      incident.id,
      'REASSIGNED',
      `Vehicle reassigned from ${oldVehicleId} to ${dto.new_vehicle_id}. Reason: ${dto.reason}`,
      context.userId,
      {
        old_vehicle: oldVehicleId,
        new_vehicle: dto.new_vehicle_id,
        reason: dto.reason,
      },
    );

    await this.logSecurityAudit(
      context.userId,
      'INCIDENT_VEHICLE_REASSIGNED',
      id,
      context,
      { old_vehicle: oldVehicleId, new_vehicle: dto.new_vehicle_id }
    );

    return { data: currentDispatch };
  }

  // --- NEW: Sequential Auto-Assignment (Phase 3) ---

  async startAutoAssignment(incidentId: string, context: AuditContext, extraExcludeIds: string[] = []) {
    const incident = await this.incidentRepository.findOneBy({ id: incidentId });
    if (!incident) throw new NotFoundException('Incident not found');

    // 1. Get exclusion list (who has already rejected this incident?)
    const previousDispatches = await this.dispatchRepository.find({
      where: { incident_id: incidentId, status: 'REJECTED' }
    });
    const dbExcludeIds = previousDispatches.map(d => d.vehicle_id).filter(id => !!id);
    const excludeIds = [...new Set([...dbExcludeIds, ...extraExcludeIds])];

    // 2. Find Next Best Ambulance
    const target = await this.findNextBestAmbulance(
      incident.gps_lat, 
      incident.gps_lon, 
      excludeIds
    );

    if (!target) {
      await this.logTimelineEvent(
        incident.id,
        'AUTO_ASSIGN_FAILED',
        'No available crewed ambulances found for auto-assignment.',
        context.userId
      );
      throw new BadRequestException('No available crewed ambulances found.');
    }

    const { vehicle: targetVehicle, duration } = target;

    // 3. Find the Active Shift to get Driver/EMT IDs
    const activeShift = await this.dutyShiftRepository.findOne({
      where: { 
        vehicleId: targetVehicle.id, 
        status: 'ON_DUTY' as any 
      }
    });

    // --- LOCK VEHICLE: Mark as BUSY immediately to prevent double assignment ---
    targetVehicle.status = VehicleStatus.BUSY;
    await this.vehicleRepository.save(targetVehicle);

    // 4. Create PENDING Dispatch
    const dispatch = this.dispatchRepository.create({
      incident_id: incidentId,
      vehicle_id: targetVehicle.registration_number,
      dispatched_by: context.userId || 'SYSTEM',
      status: 'DISPATCHED',
      driver_id: activeShift?.driverId,
      emt_id: activeShift?.staffId,
      organisationId: incident.organisationId,
      eta_seconds: duration
    });

    const savedDispatch = await this.dispatchRepository.save(dispatch);

    // --- REAL-TIME NOTIFICATION: WebSocket Alert ---
    try {
      // Find User IDs for the assigned crew to notify them specifically
      const crewUserIds: string[] = [];
      
      if (dispatch.driver_id) {
        const driverProfile = await this.staffProfileRepository.findOneBy({ id: dispatch.driver_id });
        if (driverProfile?.userId) crewUserIds.push(driverProfile.userId);
      }
      
      if (dispatch.emt_id) {
        const emtProfile = await this.staffProfileRepository.findOneBy({ id: dispatch.emt_id });
        if (emtProfile?.userId) crewUserIds.push(emtProfile.userId);
      }

      // Notify via Gateway
      for (const userId of crewUserIds) {
        this.dispatchGateway.server.to(`user_${userId}`).emit('dispatch:assigned', {
          id: savedDispatch.id,
          incident,
          eta_seconds: duration,
        });
      }
    } catch (err) {
      console.error(`Failed to send real-time notification: ${err.message}`);
    }

    // 5. Update Incident Status & Assignment
    incident.status = 'DISPATCHED';
    incident.assigned_vehicle = targetVehicle.registration_number;
    incident.eta_seconds = duration;
    await this.incidentRepository.save(incident);

    // 6. Log Events
    await this.logTimelineEvent(
      incident.id,
      'AUTO_ASSIGN_INITIATED',
      `Auto-assignment sent to ${targetVehicle.registration_number}. Waiting for acceptance.`,
      context.userId,
      { vehicle_id: targetVehicle.registration_number }
    );

    return { data: savedDispatch };
  }

  async acceptDispatch(dispatchId: string, requestUser: any) {
    const dispatch = await this.dispatchRepository.findOne({
      where: { id: dispatchId },
      relations: ['incident']
    });

    if (!dispatch) throw new NotFoundException('Dispatch request not found');
    if (dispatch.status !== 'PENDING_ACCEPTANCE') {
      throw new BadRequestException(`Cannot accept dispatch with status ${dispatch.status}`);
    }

    // 1. Update Dispatch Status
    dispatch.status = 'DISPATCHED';
    await this.dispatchRepository.save(dispatch);

    // 2. Update Incident Status
    const incident = dispatch.incident;
    incident.status = 'DISPATCHED';
    incident.assigned_vehicle = dispatch.vehicle_id;
    await this.incidentRepository.save(incident);

    // 3. Update Vehicle Status
    const vehicle = await this.vehicleRepository.findOneBy({ registration_number: dispatch.vehicle_id! });
    if (vehicle) {
      vehicle.status = VehicleStatus.BUSY;
      await this.vehicleRepository.save(vehicle);
    }

    // 5. Notify assigned crew members via WebSocket
    try {
      const crewUserIds: string[] = [];
      if (dispatch.driver_id) {
        const driver = await this.staffProfileRepository.findOneBy({ id: dispatch.driver_id });
        if (driver?.userId) crewUserIds.push(driver.userId);
      }
      if (dispatch.emt_id) {
        const emt = await this.staffProfileRepository.findOneBy({ id: dispatch.emt_id });
        if (emt?.userId) crewUserIds.push(emt.userId);
      }

      crewUserIds.forEach(userId => {
        this.dispatchGateway.server.to(`user_${userId}`).emit('dispatch:updated', {
          dispatch_id: dispatchId,
          status: 'DISPATCHED',
          action: 'ACCEPTED',
          by: requestUser.userId
        });
      });
    } catch (e) {
      console.warn('[WS] Failed to notify crew of acceptance:', e);
    }

    return { message: 'Dispatch accepted successfully', data: dispatch };
  }

  async rejectDispatch(dispatchId: string, reason: string, requestUser: any) {
    const dispatch = await this.dispatchRepository.findOne({
      where: { id: dispatchId },
      relations: ['incident']
    });

    if (!dispatch) {
      // Check if the user accidentally passed an Incident ID
      const incidentExists = await this.incidentRepository.findOneBy({ id: dispatchId });
      if (incidentExists) {
        throw new BadRequestException('Invalid ID: You provided an Incident ID, but this endpoint requires a Dispatch ID. Please use the ID of the ambulance request found in the initial assignment response.');
      }
      throw new NotFoundException('Dispatch request not found');
    }

    if (dispatch.status !== 'PENDING_ACCEPTANCE') {
      throw new BadRequestException('Can only reject a pending dispatch');
    }

    try {
      // 1. Mark current dispatch as REJECTED
      dispatch.status = 'REJECTED';
      // @ts-ignore
      dispatch.cancellation_reason = reason; 
      await this.dispatchRepository.save(dispatch);
    } catch (err) {
      console.error(`[RejectDispatch] Error saving dispatch ${dispatchId}:`, err);
      throw err;
    }

    // --- RELEASE VEHICLE: Set status back to AVAILABLE ---
    const vehicle = await this.vehicleRepository.findOneBy({ registration_number: dispatch.vehicle_id! });
    if (vehicle) {
      vehicle.status = VehicleStatus.AVAILABLE;
      await this.vehicleRepository.save(vehicle);
    }

    // 3. Log Timeline
    await this.logTimelineEvent(
      dispatch.incident_id,
      'DISPATCH_REJECTED',
      `Crew member rejected the trip. Reason: ${reason}`,
      requestUser.userId,
      { reason }
    );

    // 4. Notify other crew members via WebSocket
    try {
      const crewUserIds: string[] = [];
      if (dispatch.driver_id) {
        const driver = await this.staffProfileRepository.findOneBy({ id: dispatch.driver_id });
        if (driver?.userId) crewUserIds.push(driver.userId);
      }
      if (dispatch.emt_id) {
        const emt = await this.staffProfileRepository.findOneBy({ id: dispatch.emt_id });
        if (emt?.userId) crewUserIds.push(emt.userId);
      }

      crewUserIds.forEach(userId => {
        this.dispatchGateway.server.to(`user_${userId}`).emit('dispatch:updated', {
          dispatch_id: dispatchId,
          status: 'REJECTED',
          action: 'REJECTED',
          by: requestUser.userId,
          reason
        });
      });
    } catch (e) {
      console.warn('[WS] Failed to notify crew of rejection:', e);
    }

    // 3. TRIGGER AUTO-ASSIGNMENT for NEXT NEAREST
    // Add a small delay (1500ms) to allow mobile UI to show the rejection alert before the next one pops up
    setTimeout(() => {
      this.startAutoAssignment(dispatch.incident_id, { 
        userId: requestUser.id || requestUser.userId,
        ip: '0.0.0.0',
        userAgent: 'sequential-reassignment'
      }, [dispatch.vehicle_id]).catch(err => {
        console.error('[AUTO-ASSIGN] Background assignment failed:', err.message);
      });
    }, 1500);

    return { status: 'REJECTED_AND_REASSIGNING' };
  }

  async cancelDispatch(id: string, dto: CancelDispatchDto, context: AuditContext) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) throw new NotFoundException('Incident not found');

    // 1. Find the active dispatch
    const currentDispatch = await this.dispatchRepository.findOne({
      where: { incident_id: id },
      order: { dispatched_at: 'DESC' },
    });

    if (!currentDispatch || currentDispatch.status === 'CANCELLED') {
      throw new BadRequestException('No active dispatch found to cancel.');
    }

    // 2. Release current vehicle
    const vehicle = await this.vehicleRepository.findOneBy({ registration_number: currentDispatch.vehicle_id! });
    if (vehicle) {
      vehicle.status = VehicleStatus.AVAILABLE;
      await this.vehicleRepository.save(vehicle);
    }

    // 3. Mark current dispatch as CANCELLED
    currentDispatch.status = 'CANCELLED';
    currentDispatch.override_reason = `CANCELLED: ${dto.reason}`;
    await this.dispatchRepository.save(currentDispatch);

    const cancelledVehicleId = currentDispatch.vehicle_id;
    let responseData: any = { data: currentDispatch };

    // 4. Handle Backup Request vs Reversion
    if (dto.request_backup) {
      // Find backup (excluding the one just cancelled)
      // Note: findNearestVehicle already filters by AVAILABLE, and we just marked the old one as AVAILABLE.
      // To strictly avoid picking the same one, we'd need to modify findNearestVehicle or filter here.
      const availableVehicles = await this.vehicleRepository.find({
        where: { status: VehicleStatus.AVAILABLE },
      });

      const backupVehicle = availableVehicles
        .filter((v) => v.registration_number !== cancelledVehicleId)
        .map((v) => ({
          v,
          dist: this.getDistance(
            incident.gps_lat,
            incident.gps_lon,
            v.gps_lat,
            v.gps_lon,
          ),
        }))
        .sort((a, b) => a.dist - b.dist)[0]?.v;

      if (!backupVehicle) {
        // Fallback: No other vehicles available
        incident.status = 'PENDING';
        incident.assigned_vehicle = null;
        incident.eta_seconds = null;
        await this.incidentRepository.save(incident);

        await this.logTimelineEvent(
          incident.id,
          'DISPATCH_CANCELLED',
          `Dispatch for ${cancelledVehicleId} cancelled. Backup requested but none available. Incident reverted to PENDING.`,
          context.userId,
          { reason: dto.reason },
        );
      } else {
        // Dispatch backup
        backupVehicle.status = VehicleStatus.BUSY;
        await this.vehicleRepository.save(backupVehicle);

        const backupDispatch = new Dispatch();
        backupDispatch.incident_id = incident.id;
        backupDispatch.vehicle_id = backupVehicle.registration_number;
        backupDispatch.dispatched_by = context.userId;
        backupDispatch.status = 'DISPATCHED';

        const dist = this.getDistance(
          incident.gps_lat,
          incident.gps_lon,
          backupVehicle.gps_lat,
          backupVehicle.gps_lon,
        );
        let eta = Math.floor((dist / 30) * 3600);
        if (eta < 120) eta = 120;
        backupDispatch.eta_seconds = eta;
        backupDispatch.override_reason = `BACKUP for ${cancelledVehicleId}`;
        await this.dispatchRepository.save(backupDispatch);

        incident.assigned_vehicle = backupVehicle.registration_number;
        incident.status = 'DISPATCHED';
        incident.eta_seconds = eta;
        await this.incidentRepository.save(incident);

        await this.logTimelineEvent(
          incident.id,
          'BACKUP_DISPATCHED',
          `Dispatch for ${cancelledVehicleId} cancelled. Backup unit ${backupVehicle.registration_number} dispatched.`,
          context.userId,
          {
            reason: dto.reason,
            backup_vehicle: backupVehicle.registration_number,
          },
        );

        responseData = { data: backupDispatch };
      }
    } else {
      // No backup requested, revert to PENDING
      incident.status = 'PENDING';
      incident.assigned_vehicle = null;
      incident.eta_seconds = null;
      await this.incidentRepository.save(incident);

      await this.logTimelineEvent(
        incident.id,
        'DISPATCH_CANCELLED',
        `Dispatch for ${cancelledVehicleId} cancelled. Incident reverted to PENDING.`,
        context.userId,
        { reason: dto.reason },
      );
    }

    // 5. Audit Logging
    await this.logSecurityAudit(
      context.userId,
      'INCIDENT_DISPATCH_CANCELLED',
      incident.id,
      context,
      { reason: dto.reason, backup_requested: dto.request_backup },
    );

    // 6. Notify crew about cancellation
    try {
      const crewUserIds: string[] = [];
      if (currentDispatch.driver_id) {
        const driver = await this.staffProfileRepository.findOneBy({ id: currentDispatch.driver_id });
        if (driver?.userId) crewUserIds.push(driver.userId);
      }
      if (currentDispatch.emt_id) {
        const emt = await this.staffProfileRepository.findOneBy({ id: currentDispatch.emt_id });
        if (emt?.userId) crewUserIds.push(emt.userId);
      }

      crewUserIds.forEach(userId => {
        this.dispatchGateway.server.to(`user_${userId}`).emit('dispatch:updated', {
          dispatch_id: currentDispatch.id,
          status: 'CANCELLED',
          action: 'CANCELLED',
          by: context.userId,
          reason: dto.reason
        });
      });
    } catch (e) {
      console.warn('[WS] Failed to notify crew of cancellation:', e);
    }

    return responseData;
  }

  async getActiveDispatch(incidentId: string, requestUser: any) {
    const dispatch = await this.dispatchRepository.findOne({
      where: { incident_id: incidentId },
      order: { dispatched_at: 'DESC' },
    });

    if (!dispatch) {
      throw new NotFoundException(
        `No dispatch records found for incident ${incidentId}`,
      );
    }

    // RBAC & Personal Isolation
    const roles = requestUser.roles || [];
    const isPlatformAdmin = roles.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN', 'Call Centre Executive (CCE)', 'CCE'].includes(r)
    );

    if (!isPlatformAdmin) {
      const orgId = requestUser.organisationId || requestUser.org_id;

      // 1. Hospital Admin / Fleet Operator isolation (by organization)
      if (roles.includes('Hospital Admin') || roles.includes('Fleet Operator')) {
        if (dispatch.organisationId && orgId && dispatch.organisationId !== orgId) {
          throw new ForbiddenException('Access denied: Dispatch belongs to another organization');
        }
      } 
      // 2. Personal Isolation for Crew (Pilot / EMT)
      else if (roles.includes('Ambulance Pilot (Driver)') || roles.includes('EMT / Paramedic')) {
        const staffId = await this.getStaffProfileId(requestUser.userId);
        if (!staffId || (dispatch.driver_id !== staffId && dispatch.emt_id !== staffId)) {
          throw new ForbiddenException('Access denied: You are not assigned to this dispatch');
        }
      } else {
        throw new ForbiddenException('Access denied: Insufficient permissions to view dispatch details');
      }
    }

    return { data: dispatch };
  }

  /**
   * Finds the latest active dispatch for the current crew member
   */
  async findActiveDispatchForUser(requestUser: any) {
    console.log(`[DISPATCH] Fetching active dispatch for user: ${requestUser.userId} (${requestUser.roles})`);
    const staffProfile = await this.staffProfileRepository.findOneBy({ userId: requestUser.userId });
    if (!staffProfile) {
      throw new NotFoundException('Staff profile not found');
    }

    // 1. Primary search: Check if they are already linked to a dispatch record
    const activeStatuses = [
      'PENDING_ACCEPTANCE', 
      'DISPATCHED', 
      'EN_ROUTE_SCENE', 
      'AT_SCENE', 
      'PATIENT_LOADED', 
      'EN_ROUTE_HOSPITAL', 
      'AT_HOSPITAL'
    ];

    let dispatch = await this.dispatchRepository.findOne({
      where: [
        { driver_id: staffProfile.id, status: In(activeStatuses) },
        { emt_id: staffProfile.id, status: In(activeStatuses) },
      ],
      relations: ['incident', 'destination_hospital'],
      order: { dispatched_at: 'DESC' }
    });

    // 2. Fallback: If no direct link exists, check if their vehicle has an active dispatch
    if (!dispatch) {
      const activeShift = await this.dutyShiftRepository.findOne({
        where: [
          { driverId: staffProfile.id, status: DutyShiftStatus.ON_DUTY as any },
          { staffId: staffProfile.id, status: DutyShiftStatus.ON_DUTY as any }
        ],
        relations: ['vehicle']
      });

      if (activeShift && activeShift.vehicle) {
        dispatch = await this.dispatchRepository.findOne({
          where: {
            vehicle_id: activeShift.vehicle.registration_number,
            status: Not(In(['COMPLETED', 'CANCELLED', 'REJECTED', 'HANDOFF_COMPLETE']))
          },
          relations: ['incident', 'destination_hospital'],
          order: { dispatched_at: 'DESC' }
        });

        // Auto-link the user to the dispatch record for seamless sync
        if (dispatch) {
          if (staffProfile.type === StaffType.DRIVER) {
            dispatch.driver_id = staffProfile.id;
          } else {
            dispatch.emt_id = staffProfile.id;
          }
          await this.dispatchRepository.save(dispatch);
        }
      }
    }

    if (!dispatch) {
      return { data: null };
    }

    return { data: dispatch };
  }

  async recommendVehicles(dto: RecommendVehicleDto) {
    const { gps_lat, gps_lon, vehicle_type_required } = dto;

    const query = this.vehicleRepository
      .createQueryBuilder('vehicle')
      .where('vehicle.status = :status', { status: VehicleStatus.AVAILABLE });

    if (vehicle_type_required) {
      query.andWhere('vehicle.type = :type', { type: vehicle_type_required });
    }

    const availableVehicles = await query.getMany();

    const recommendations = availableVehicles.map((vehicle) => {
      const distance = this.getDistance(
        Number(gps_lat),
        Number(gps_lon),
        Number(vehicle.gps_lat),
        Number(vehicle.gps_lon),
      );

      // ETA simulation (30 km/h average)
      let eta = Math.floor((distance / 30) * 3600);
      if (eta < 120) eta = 120; // 2 min minimum

      return {
        id: vehicle.id,
        identifier: vehicle.registration_number,
        type: vehicle.vehicle_type,
        distance_km: parseFloat(distance.toFixed(2)),
        eta_seconds: eta,
        gps_lat: vehicle.gps_lat,
        gps_lon: vehicle.gps_lon,
      };
    });

    // Rank by nearest first
    recommendations.sort((a, b) => a.distance_km - b.distance_km);

    return {
      data: recommendations.slice(0, 5), // Return top 5
    };
  }

  async getTimeline(id: string, query: PaginationQueryDto) {
    const { limit, cursor } = query;
    const queryBuilder = this.timelineRepository.createQueryBuilder('timeline');
    queryBuilder.where('timeline.incident_id = :id', { id });

    if (cursor) {
      const decodedCursor = decodeCursor(cursor);
      const [cursorDate, cursorId] = decodedCursor.split('|');
      if (cursorDate && cursorId) {
        queryBuilder.andWhere(
          '(timeline.createdAt > :cursorDate OR (timeline.createdAt = :cursorDate AND timeline.id > :cursorId))',
          { cursorDate, cursorId },
        );
      }
    }

    queryBuilder.orderBy('timeline.createdAt', 'ASC');
    queryBuilder.addOrderBy('timeline.id', 'ASC');
    queryBuilder.take(limit + 1);

    const incidents = await queryBuilder.getMany();

    let next_cursor: string | null = null;
    const hasNextPage = incidents.length > limit;
    const data = hasNextPage ? incidents.slice(0, limit) : incidents;

    if (hasNextPage) {
      const lastItem = data[data.length - 1];
      next_cursor = encodeCursor(
        `${lastItem.createdAt.toISOString()}|${lastItem.id}`,
      );
    }

    const total_count = await queryBuilder.getCount();

    return { data, meta: { next_cursor, total_count } };
  }

  private getSLATargets(severity: string) {
    const s = severity?.toUpperCase();
    if (s === 'CRITICAL' || s === 'RED') {
      return { dispatch: 480, on_scene: 960, total: 3600 };
    } else if (s === 'HIGH' || s === 'YELLOW') {
      return { dispatch: 900, on_scene: 1800, total: 7200 };
    } else if (s === 'MEDIUM' || s === 'GREEN') {
      return { dispatch: 1800, on_scene: 3600, total: 14400 };
    }
    return { dispatch: 3600, on_scene: 7200, total: 28800 };
  }

  private calculateTimer(
    target: number,
    actual: number | null,
  ): SLATimerDetail {
    let status = SLATimerStatus.PENDING;
    if (actual !== null) {
      status =
        actual <= target ? SLATimerStatus.WITHIN_SLA : SLATimerStatus.EXCEEDED;
    }
    return { target_seconds: target, actual_seconds: actual, status };
  }

  async getSlaStatus(id: string): Promise<{ data: SLAStatusDto }> {
    const incidentWrapper = await this.findOne(id);
    const incident = incidentWrapper.data;

    const timeline = await this.timelineRepository.find({
      where: { incident_id: id },
      order: { createdAt: 'ASC' },
    });

    const dispatch = await this.dispatchRepository.findOne({
      where: { incident_id: id },
      order: { dispatched_at: 'ASC' },
    });

    const targets = this.getSLATargets(incident.severity);
    const start = incident.createdAt.getTime();

    // 1. Dispatch Timer
    const dispatchedAt = dispatch?.dispatched_at?.getTime() || null;
    const dispatchActual = dispatchedAt
      ? Math.floor((dispatchedAt - start) / 1000)
      : null;
    const dispatchTimer = this.calculateTimer(targets.dispatch, dispatchActual);

    // 2. On-Scene Timer
    const onSceneEvent = timeline.find(
      (e) => e.type === 'STATUS_CHANGE' && e.metadata?.newStatus === 'ON_SCENE',
    );
    const onSceneAt = onSceneEvent?.createdAt?.getTime() || null;
    const onSceneActual = onSceneAt
      ? Math.floor((onSceneAt - start) / 1000)
      : null;
    const onSceneTimer = this.calculateTimer(targets.on_scene, onSceneActual);

    // 3. Total Resolution Timer
    const completedEvent = timeline.find(
      (e) =>
        e.type === 'STATUS_CHANGE' && e.metadata?.newStatus === 'COMPLETED',
    );
    const completedAt = completedEvent?.createdAt?.getTime() || null;
    const totalActual = completedAt
      ? Math.floor((completedAt - start) / 1000)
      : null;
    const totalTimer = this.calculateTimer(targets.total, totalActual);

    // Overall Status
    let overall: 'HEALTHY' | 'WARNING' | 'VIOLATED' = 'HEALTHY';
    if (
      dispatchTimer.status === SLATimerStatus.EXCEEDED ||
      onSceneTimer.status === SLATimerStatus.EXCEEDED ||
      totalTimer.status === SLATimerStatus.EXCEEDED
    ) {
      overall = 'VIOLATED';
    } else if (
      dispatchTimer.status === SLATimerStatus.PENDING &&
      (Date.now() - start) / 1000 > targets.dispatch
    ) {
      overall = 'WARNING'; // Approaching or just passed but not yet closed
    }

    return {
      data: {
        incident_id: id,
        severity: incident.severity,
        timers: {
          dispatch: dispatchTimer,
          on_scene: onSceneTimer,
          total_resolution: totalTimer,
        },
        overall_sla_status: overall,
      },
    };
  }

  async getSlaBreaches(query: SlaBreachQueryDto) {
    const { limit, cursor, org_id, category } = query;
    const queryBuilder = this.incidentRepository.createQueryBuilder('incident');

    // Only active incidents that haven't been dispatched yet are counted as "active dispatch breaches"
    queryBuilder.where('incident.status IN (:...statuses)', {
      statuses: ['PENDING', 'ASSIGNED'],
    });

    if (org_id) {
      queryBuilder.andWhere('incident.organisationId = :org_id', { org_id });
    }
    if (category) {
      queryBuilder.andWhere('incident.category = :category', { category });
    }

    // Thresholds: CRITICAL 8m, HIGH 15m, MEDIUM 30m, LOW 60m
    const now = new Date();
    const criticalT = new Date(now.getTime() - 480 * 1000);
    const highT = new Date(now.getTime() - 900 * 1000);
    const mediumT = new Date(now.getTime() - 1800 * 1000);
    const lowT = new Date(now.getTime() - 3600 * 1000);

    queryBuilder.andWhere(
      new Brackets((qb) => {
        qb.where(
          "(incident.severity IN ('CRITICAL', 'RED') AND incident.createdAt < :criticalT)",
          { criticalT },
        )
          .orWhere(
            "(incident.severity IN ('HIGH', 'YELLOW') AND incident.createdAt < :highT)",
            { highT },
          )
          .orWhere(
            "(incident.severity IN ('MEDIUM', 'GREEN') AND incident.createdAt < :mediumT)",
            { mediumT },
          )
          .orWhere(
            "(incident.severity = 'LOW' AND incident.createdAt < :lowT)",
            { lowT },
          );
      }),
    );

    if (cursor) {
      const decodedCursor = decodeCursor(cursor);
      const [cursorDate, cursorId] = decodedCursor.split('|');
      if (cursorDate && cursorId) {
        queryBuilder.andWhere(
          '(incident.createdAt > :cursorDate OR (incident.createdAt = :cursorDate AND incident.id > :cursorId))',
          { cursorDate, cursorId },
        );
      }
    }

    queryBuilder.orderBy('incident.createdAt', 'ASC'); // Oldest breaches first
    queryBuilder.addOrderBy('incident.id', 'ASC');
    queryBuilder.take(limit + 1);

    const incidents = await queryBuilder.getMany();

    let next_cursor: string | null = null;
    const hasNextPage = incidents.length > limit;
    const data = hasNextPage ? incidents.slice(0, limit) : incidents;

    if (hasNextPage) {
      const lastItem = data[data.length - 1];
      next_cursor = encodeCursor(
        `${lastItem.createdAt.toISOString()}|${lastItem.id}`,
      );
    }

    const total_count = await queryBuilder.getCount();

    return { data, meta: { next_cursor, total_count } };
  }

  async addPatient(
    incidentId: string,
    dto: BulkAddPatientsDto,
    context: AuditContext,
  ) {
    const incident = await this.incidentRepository.findOneBy({
      id: incidentId,
    });
    if (!incident) throw new NotFoundException('Incident not found');

    const newPatients = dto.patients.map((p) => ({
      id: uuid(),
      name: p.name,
      age: p.age,
      gender: p.gender,
      triage_level: p.triage_level || TriageLevel.GREEN,
      symptoms: p.symptoms || [],
    }));

    incident.patients = [...(incident.patients || []), ...newPatients];
    await this.incidentRepository.save(incident);

    // Timeline Event
    await this.logTimelineEvent(
      incident.id,
      'PATIENTS_ADDED',
      `${newPatients.length} new patient(s) added. Total: ${incident.patients.length}`,
      context.userId,
      { 
        patient_count: newPatients.length, 
        triages: newPatients.map(p => p.triage_level) 
      }
    );

    // Security Audit
    await this.logSecurityAudit(
      context.userId,
      'INCIDENT_BULK_PATIENT_ADDED',
      incident.id,
      context,
      { count: newPatients.length, total: incident.patients.length },
    );

    return {
      message: 'Patients added successfully',
      data: newPatients,
      total_count: incident.patients.length,
    };
  }

  async getPatients(
    incidentId: string,
    requestUser: any,
    query: OffsetPaginationQueryDto,
  ) {
    const { limit, offset } = query;
    const incidentWrapper = await this.findOne(incidentId, requestUser);
    const patients = incidentWrapper.data.patients || [];

    // Slice for simple offset-based pagination on the JSONB array
    const paginatedPatients = patients.slice(offset, offset + limit);

    const mapped = paginatedPatients.map(({ id, ...rest }) => ({
      id,
      ...rest,
    }));

    return new PaginatedResponse(
      mapped,
      null,
      patients.length,
      limit,
      mapped.length,
    );
  }

  async updatePatient(
    incidentId: string,
    patientId: string,
    dto: UpdatePatientDto,
    context: AuditContext,
  ) {
    const incidentWrapper = await this.findOne(incidentId, {
      roles: ['CureSelect Admin'],
      userId: context.userId,
    });
    const incident = incidentWrapper.data;

    const patientIndex = incident.patients.findIndex((p) => p.id === patientId);
    if (patientIndex === -1) {
      throw new NotFoundException(
        `Patient with ID ${patientId} not found in this incident`,
      );
    }

    const patient = incident.patients[patientIndex];
    if (dto.name) patient.name = dto.name;
    if (dto.age) patient.age = dto.age;
    if (dto.gender) patient.gender = dto.gender;
    if (dto.triage_level) patient.triage_level = dto.triage_level;
    if (dto.symptoms) {
      patient.symptoms = [...(patient.symptoms || []), ...dto.symptoms];
    }

    incident.patients[patientIndex] = patient;
    await this.incidentRepository.save(incident);

    await this.logTimelineEvent(
      incident.id,
      'PATIENT_UPDATED',
      `Patient update: ${dto.triage_level ? `Triage changed to ${dto.triage_level}` : 'Profile updated.'}`,
      context.userId,
      { patient_id: patientId, updates: dto },
    );

    await this.logSecurityAudit(
      context.userId,
      'INCIDENT_PATIENT_UPDATED',
      incident.id,
      context,
      { patient_id: patientId, updates: dto },
    );

    return {
      data: patient,
    };
  }

  async escalateIncident(
    id: string,
    requestUser: any,
    dto: EscalateIncidentDto,
    context: AuditContext,
  ) {
    // Use findOne with requestUser to automatically enforce tenant isolation
    const incidentWrapper = await this.findOne(id, requestUser);
    const incident = incidentWrapper.data;

    const escalatedBy = requestUser.userId;

    // 1. Create Escalation Record
    const escalation = this.escalationRepository.create({
      incident_id: id,
      escalated_by: escalatedBy,
      escalate_to: dto.escalate_to,
      reason: dto.reason,
    });
    const saved = await this.escalationRepository.save(escalation);

    // 2. Add to Timeline
    const timeline = this.timelineRepository.create({
      incident_id: id,
      user_id: escalatedBy,
      type: 'ESCALATION',
      description: `Incident manually escalated by ${escalatedBy} to ${dto.escalate_to}. Reason: ${dto.reason}`,
      metadata: {
        escalationId: saved.id,
        escalateTo: dto.escalate_to,
        reason: dto.reason,
      },
    });
    await this.timelineRepository.save(timeline);

    // 3. Security Audit Log
    await this.logSecurityAudit(
      escalatedBy,
      'MANUAL_ESCALATION_RECORDED',
      id,
      {
        ip: context.ip,
        userAgent: context.userAgent,
      },
      {
        escalateTo: dto.escalate_to,
        reason: dto.reason,
      },
    );

    return { data: saved };
  }

  async submitFeedback(incidentId: string, dto: any, user: any) {
    console.log('--- SUBMIT FEEDBACK DEBUG ---');
    console.log('Incident ID:', incidentId);
    console.log('DTO:', JSON.stringify(dto, null, 2));
    console.log('User Context:', JSON.stringify(user, null, 2));

    const incident = await this.incidentRepository.findOneBy({ id: incidentId });
    if (!incident) {
      console.error('Feedback Error: Incident not found');
      throw new NotFoundException('Incident not found');
    }

    const feedback = this.feedbackRepository.create({
      incidentId,
      rating: dto.rating,
      comment: dto.comment,
      userId: user?.userId,
    });

    console.log('Feedback Object to Save:', JSON.stringify(feedback, null, 2));
    console.log('------------------------------');

    await this.feedbackRepository.save(feedback);
    return { message: 'Thank you for your feedback!' };
  }

  async getAnalyticsSummary(
    query: IncidentAnalyticsQueryDto,
    requestUser: any,
  ) {
    const roles = requestUser.roles || [];
    const isPlatformAdmin = roles.some((r: string) =>
      [
        'CureSelect Admin',
        'CURESELECT_ADMIN',
        'Call Centre Executive (CCE)',
        'CCE',
      ].includes(r),
    );

    const applyFilters = (qb: any) => {
      if (!isPlatformAdmin) {
        const isHospitalAdmin = roles.some(
          (r) => r.toUpperCase() === 'HOSPITAL ADMIN',
        );
        const isFleetOperator = roles.some(
          (r) => r.toUpperCase() === 'FLEET OPERATOR',
        );

        if (isHospitalAdmin || isFleetOperator) {
          qb.andWhere('incident.organisationId = :orgId', {
            orgId: requestUser.org_id,
          });
        } else {
          throw new ForbiddenException(
            'Insufficient permissions for analytics',
          );
        }
      } else if (query.org_id) {
        qb.andWhere('incident.organisationId = :orgId', {
          orgId: query.org_id,
        });
      }

      if (query.date_from) {
        qb.andWhere('incident.createdAt >= :dateFrom', {
          dateFrom: query.date_from,
        });
      }
      if (query.date_to) {
        qb.andWhere('incident.createdAt <= :dateTo', { dateTo: query.date_to });
      }
      return qb;
    };

    const format = (arr: any[]) =>
      arr.reduce(
        (acc, curr) => ({ ...acc, [curr.key]: parseInt(curr.count, 10) }),
        {},
      );

    const byStatus = await applyFilters(
      this.incidentRepository.createQueryBuilder('incident'),
    )
      .select('incident.status', 'key')
      .addSelect('COUNT(*)', 'count')
      .groupBy('incident.status')
      .getRawMany();

    const byCategory = await applyFilters(
      this.incidentRepository.createQueryBuilder('incident'),
    )
      .select('incident.category', 'key')
      .addSelect('COUNT(*)', 'count')
      .groupBy('incident.category')
      .getRawMany();

    const bySeverity = await applyFilters(
      this.incidentRepository.createQueryBuilder('incident'),
    )
      .select('incident.severity', 'key')
      .addSelect('COUNT(*)', 'count')
      .groupBy('incident.severity')
      .getRawMany();

    const totalCount = await applyFilters(
      this.incidentRepository.createQueryBuilder('incident'),
    )
      .select('COUNT(*)', 'total')
      .getRawOne();

    return {
      data: {
        total_incidents: parseInt(totalCount?.total || '0', 10),
        by_status: format(byStatus),
        by_category: format(byCategory),
        by_severity: format(bySeverity),
      },
    };
  }
}
