import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from './entities/incident.entity';
import { IncidentTimeline } from './entities/incident-timeline.entity';
import { Dispatch } from './entities/dispatch.entity';
import { DispatchIncidentDto } from './dto/dispatch-incident.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentStatusDto, AssignVehicleDto, UpdateIncidentDto, CancelIncidentDto } from './dto/update-incident.dto';
import { ReassignVehicleDto } from './dto/reassign-vehicle.dto';
import { CancelDispatchDto } from './dto/cancel-dispatch.dto';
import { IncidentQueryDto } from './dto/incident-query.dto';
import { PaginatedResponse, encodeCursor, decodeCursor } from '../../../libs/common/src';
import { Vehicle, VehicleStatus } from '../../fleet-service/src/entities/vehicle.entity';

import { AuditLogService } from '../../auth-service/src/audit-log.service';

export interface AuditContext {
  userId: string;
  ip: string;
  userAgent: string;
}

@Injectable()
export class DispatchServiceService {
  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(IncidentTimeline)
    private readonly timelineRepository: Repository<IncidentTimeline>,
    @InjectRepository(Dispatch)
    private readonly dispatchRepository: Repository<Dispatch>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    private readonly auditLogService: AuditLogService,
  ) {}

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
    metadata?: Record<string, any>
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

  private getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  private async findNearestVehicle(lat: number, lon: number): Promise<Vehicle | null> {
    const availableVehicles = await this.vehicleRepository.find({
      where: { status: VehicleStatus.AVAILABLE }
    });

    if (availableVehicles.length === 0) return null;

    let nearest: Vehicle | null = null;
    let minDistance = Infinity;

    for (const vehicle of availableVehicles) {
      const distance = this.getDistance(
        Number(lat), 
        Number(lon), 
        Number(vehicle.gps_lat), 
        Number(vehicle.gps_lon)
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearest = vehicle;
      }
    }

    return nearest;
  }

  async createIncident(dto: CreateIncidentDto, context: AuditContext) {
    const incidentData = {
      ...dto,
      caller_id: dto.caller_id || context.userId,
      status: 'PENDING',
    };

    const incident = this.incidentRepository.create(incidentData);
    await this.incidentRepository.save(incident);

    await this.logTimelineEvent(
      incident.id, 
      'CREATED', 
      `Incident reported by ${incident.caller_id}`,
      context.userId,
      { category: incident.category, severity: incident.severity }
    );

    await this.logSecurityAudit(
      context.userId,
      'INCIDENT_CREATED',
      incident.id,
      context,
      { category: incident.category, severity: incident.severity }
    );

    return {
      data: incident,
      assigned_vehicle: null,
      eta_seconds: null,
    };
  }

  async findAll(query: IncidentQueryDto, callerIdOverride?: string) {
    const { 
      status, category, severity, org_id, caller_id, 
      date_from, date_to, limit, cursor 
    } = query;

    const queryBuilder = this.incidentRepository.createQueryBuilder('incident');

    // 1. Apply Basic Filters
    if (status) queryBuilder.andWhere('incident.status = :status', { status });
    if (category) queryBuilder.andWhere('incident.category = :category', { category });
    if (severity) queryBuilder.andWhere('incident.severity = :severity', { severity });
    if (org_id) queryBuilder.andWhere('incident.organisationId = :org_id', { org_id });

    // 2. Caller Isolation (Security + Filter)
    const effectiveCallerId = callerIdOverride || caller_id;
    if (effectiveCallerId) {
      queryBuilder.andWhere('incident.caller_id = :effectiveCallerId', { effectiveCallerId });
    }

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
          { cursorDate, cursorId }
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
      next_cursor = encodeCursor(`${lastItem.createdAt.toISOString()}|${lastItem.id}`);
    }

    const total_count = await queryBuilder.getCount(); // Optional: might be expensive on very large tables

    return new PaginatedResponse(data, next_cursor, total_count);
  }


  async findOne(id: string, requestUser?: any) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }

    // Security: Non-admins/CCE/Hospital can only view their own incidents
    if (requestUser) {
      const isPrivileged = requestUser.roles.includes('CURESELECT_ADMIN') || 
                           requestUser.roles.includes('CCE') ||
                           requestUser.roles.includes('HOSPITAL');
      if (!isPrivileged && incident.caller_id !== requestUser.userId) {
        throw new ForbiddenException('You do not have permission to view this incident');
      }
    }

    return { data: incident };
  }

  async updateIncident(id: string, dto: UpdateIncidentDto, context: AuditContext) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) throw new NotFoundException('Incident not found');

    const originalData = { ...incident };

    // Only apply fields if they are provided in the DTO
    if (dto.category) incident.category = dto.category;
    if (dto.severity) incident.severity = dto.severity;
    if (dto.address) incident.address = dto.address;
    if (dto.notes) {
      incident.notes = incident.notes ? `${incident.notes}\n${dto.notes}` : dto.notes;
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
          address: originalData.address 
        } 
      }
    );

    await this.logSecurityAudit(
      context.userId,
      'INCIDENT_UPDATED',
      incident.id,
      context,
      { updates: dto }
    );

    return { data: incident };
  }

  async cancelIncident(id: string, dto: CancelIncidentDto, context: AuditContext) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) throw new NotFoundException('Incident not found');

    if (incident.status !== 'PENDING') {
      throw new BadRequestException('Incident can only be cancelled before dispatch (status: PENDING)');
    }

    incident.status = 'CANCELLED';
    const cancelNote = `[CANCELLED] Reason: ${dto.reason}`;
    incident.notes = incident.notes ? `${incident.notes}\n${cancelNote}` : cancelNote;

    await this.incidentRepository.save(incident);

    await this.logTimelineEvent(
      incident.id,
      'CANCELLED',
      `Incident cancelled: ${dto.reason}`,
      context.userId,
      { reason: dto.reason }
    );

    await this.logSecurityAudit(
      context.userId,
      'INCIDENT_CANCELLED',
      incident.id,
      context,
      { reason: dto.reason }
    );

    return { data: incident };
  }

  async getAuditLogs(id: string, limit = 50, cursor?: string) {
    return this.auditLogService.getLogsByEntity('incident', id, limit, cursor);
  }

  async updateStatus(id: string, dto: UpdateIncidentStatusDto, context: AuditContext) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) throw new NotFoundException('Incident not found');

    const oldStatus = incident.status;
    incident.status = dto.status;
    if (dto.notes) {
      incident.notes = incident.notes ? `${incident.notes}\n${dto.notes}` : dto.notes;
    }

    await this.incidentRepository.save(incident);

    await this.logTimelineEvent(
      incident.id,
      'STATUS_CHANGE',
      `Status changed from ${oldStatus} to ${dto.status}`,
      context.userId,
      { oldStatus, newStatus: dto.status, notes: dto.notes }
    );

    await this.logSecurityAudit(
      context.userId,
      'INCIDENT_STATUS_CHANGE',
      incident.id,
      context,
      { oldStatus, newStatus: dto.status }
    );

    return { data: incident };
  }

  async assignVehicle(id: string, dto: AssignVehicleDto, context: AuditContext) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) throw new NotFoundException('Incident not found');

    const vehicle = await this.vehicleRepository.findOneBy({ identifier: dto.vehicle_id });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    
    if (vehicle.status !== VehicleStatus.AVAILABLE) {
      throw new BadRequestException(`Vehicle '${dto.vehicle_id}' is not available (Status: ${vehicle.status})`);
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
      { vehicle_id: dto.vehicle_id, eta_seconds: dto.eta_seconds }
    );

    await this.logSecurityAudit(
      context.userId,
      'INCIDENT_VEHICLE_ASSIGNED',
      incident.id,
      context,
      { vehicle_id: dto.vehicle_id, eta_seconds: dto.eta_seconds }
    );

    return { data: incident };
  }

  async dispatchIncident(id: string, dto: DispatchIncidentDto, context: AuditContext) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) throw new NotFoundException('Incident not found');

    if (incident.status !== 'PENDING' && incident.status !== 'ASSIGNED') {
      throw new BadRequestException(
        `Cannot dispatch incident with status '${incident.status}'. Must be PENDING or ASSIGNED.`
      );
    }

    // Determine vehicle: manual override or auto-assign nearest
    const isManualOverride = !!dto.manual_vehicle_id;
    let targetVehicle: Vehicle | null = null;
    let vehicleId: string;
    let eta: number;

    if (isManualOverride) {
      targetVehicle = await this.vehicleRepository.findOneBy({ identifier: dto.manual_vehicle_id! });
      if (!targetVehicle) throw new NotFoundException('Selected vehicle not found');
      if (targetVehicle.status !== VehicleStatus.AVAILABLE) {
        throw new BadRequestException(`Vehicle '${dto.manual_vehicle_id}' is not available.`);
      }
      vehicleId = targetVehicle.identifier;
      // Simulated ETA for manually selected vehicle (distance based)
      const dist = this.getDistance(incident.gps_lat, incident.gps_lon, targetVehicle.gps_lat, targetVehicle.gps_lon);
      eta = Math.floor((dist / 30) * 3600); // 30km/h avg speed
    } else {
      targetVehicle = await this.findNearestVehicle(incident.gps_lat, incident.gps_lon);
      if (!targetVehicle) {
        throw new BadRequestException('No available ambulances found in the system for auto-assignment.');
      }
      vehicleId = targetVehicle.identifier;
      const dist = this.getDistance(incident.gps_lat, incident.gps_lon, targetVehicle.gps_lat, targetVehicle.gps_lon);
      eta = Math.floor((dist / 30) * 3600);
    }

    // Buffer minimum ETA (2 mins)
    if (eta < 120) eta = 120;

    // Update the vehicle status to BUSY
    targetVehicle.status = VehicleStatus.BUSY;
    await this.vehicleRepository.save(targetVehicle);

    // Create the dispatch record
    const dispatch = new Dispatch();
    dispatch.incident_id = incident.id;
    dispatch.vehicle_id = vehicleId;
    dispatch.dispatched_by = context.userId;
    dispatch.status = 'DISPATCHED';
    dispatch.eta_seconds = eta;
    dispatch.manual_vehicle_id = dto.manual_vehicle_id || null;
    dispatch.override_reason = dto.override_reason || null;
    dispatch.is_manual_override = isManualOverride;
    await this.dispatchRepository.save(dispatch);

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
      { vehicle_id: vehicleId, eta_seconds: eta, is_manual: isManualOverride }
    );

    // Audit log
    await this.logSecurityAudit(
      context.userId,
      'INCIDENT_DISPATCHED',
      incident.id,
      context,
      { vehicle_id: vehicleId, eta_seconds: eta, is_manual: isManualOverride, override_reason: dto.override_reason }
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

  async reassignVehicle(id: string, dto: ReassignVehicleDto, context: AuditContext) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) throw new NotFoundException('Incident not found');

    // 1. Find the active dispatch for this incident
    // We look for the most recent record that isn't COMPLETED or CANCELLED
    const currentDispatch = await this.dispatchRepository.findOne({
      where: { incident_id: id },
      order: { dispatched_at: 'DESC' }
    });

    if (!currentDispatch) {
      throw new BadRequestException('No active dispatch found for this incident.');
    }

    if (incident.status === 'COMPLETED' || incident.status === 'CANCELLED' || incident.status === 'ON_SCENE') {
      throw new BadRequestException(`Cannot reassign vehicle for incident with status '${incident.status}'.`);
    }

    // 2. Identify and release the old vehicle
    const oldVehicle = await this.vehicleRepository.findOneBy({ identifier: currentDispatch.vehicle_id });
    if (oldVehicle) {
      oldVehicle.status = VehicleStatus.AVAILABLE;
      await this.vehicleRepository.save(oldVehicle);
    }

    // 3. Identify and lock the new vehicle
    const newVehicle = await this.vehicleRepository.findOneBy({ identifier: dto.new_vehicle_id });
    if (!newVehicle) throw new NotFoundException(`New vehicle '${dto.new_vehicle_id}' not found.`);
    if (newVehicle.status !== VehicleStatus.AVAILABLE) {
      throw new BadRequestException(`Vehicle '${dto.new_vehicle_id}' is not available.`);
    }

    newVehicle.status = VehicleStatus.BUSY;
    await this.vehicleRepository.save(newVehicle);

    // 4. Update the Dispatch record
    // We keep the record history by updating the existing one or marking it as reassigned and creating new. 
    // Usually, updating the active record is cleaner for active dispatch tracking.
    const oldVehicleId = currentDispatch.vehicle_id;
    currentDispatch.vehicle_id = dto.new_vehicle_id;
    
    // Recalculate ETA from new vehicle location
    const dist = this.getDistance(incident.gps_lat, incident.gps_lon, newVehicle.gps_lat, newVehicle.gps_lon);
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
      { old_vehicle: oldVehicleId, new_vehicle: dto.new_vehicle_id, reason: dto.reason }
    );

    await this.logSecurityAudit(
      context.userId,
      'INCIDENT_REASSIGNED',
      incident.id,
      context,
      { old_vehicle: oldVehicleId, new_vehicle: dto.new_vehicle_id, reason: dto.reason }
    );

    return { data: currentDispatch };
  }

  async cancelDispatch(id: string, dto: CancelDispatchDto, context: AuditContext) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) throw new NotFoundException('Incident not found');

    // 1. Find the active dispatch
    const currentDispatch = await this.dispatchRepository.findOne({
      where: { incident_id: id },
      order: { dispatched_at: 'DESC' }
    });

    if (!currentDispatch || currentDispatch.status === 'CANCELLED') {
      throw new BadRequestException('No active dispatch found to cancel.');
    }

    // 2. Release current vehicle
    const vehicle = await this.vehicleRepository.findOneBy({ identifier: currentDispatch.vehicle_id });
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
        where: { status: VehicleStatus.AVAILABLE }
      });

      const backupVehicle = availableVehicles
        .filter(v => v.identifier !== cancelledVehicleId)
        .map(v => ({ v, dist: this.getDistance(incident.gps_lat, incident.gps_lon, v.gps_lat, v.gps_lon) }))
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
          { reason: dto.reason }
        );
      } else {
        // Dispatch backup
        backupVehicle.status = VehicleStatus.BUSY;
        await this.vehicleRepository.save(backupVehicle);

        const backupDispatch = new Dispatch();
        backupDispatch.incident_id = incident.id;
        backupDispatch.vehicle_id = backupVehicle.identifier;
        backupDispatch.dispatched_by = context.userId;
        backupDispatch.status = 'DISPATCHED';
        
        const dist = this.getDistance(incident.gps_lat, incident.gps_lon, backupVehicle.gps_lat, backupVehicle.gps_lon);
        let eta = Math.floor((dist / 30) * 3600);
        if (eta < 120) eta = 120;
        backupDispatch.eta_seconds = eta;
        backupDispatch.override_reason = `BACKUP for ${cancelledVehicleId}`;
        await this.dispatchRepository.save(backupDispatch);

        incident.assigned_vehicle = backupVehicle.identifier;
        incident.status = 'DISPATCHED';
        incident.eta_seconds = eta;
        await this.incidentRepository.save(incident);

        await this.logTimelineEvent(
          incident.id,
          'BACKUP_DISPATCHED',
          `Dispatch for ${cancelledVehicleId} cancelled. Backup unit ${backupVehicle.identifier} dispatched.`,
          context.userId,
          { reason: dto.reason, backup_vehicle: backupVehicle.identifier }
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
        { reason: dto.reason }
      );
    }

    // 5. Audit Logging
    await this.logSecurityAudit(
      context.userId,
      'INCIDENT_DISPATCH_CANCELLED',
      incident.id,
      context,
      { reason: dto.reason, backup_requested: dto.request_backup }
    );

    return responseData;
  }

  async getTimeline(id: string) {
    const events = await this.timelineRepository.find({
      where: { incident_id: id },
      order: { createdAt: 'ASC' },
    });
    return { data: events };
  }
}
