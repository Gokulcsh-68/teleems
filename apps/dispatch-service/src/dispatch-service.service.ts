import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from './entities/incident.entity';
import { IncidentTimeline } from './entities/incident-timeline.entity';
import { Dispatch } from './entities/dispatch.entity';
import { DispatchIncidentDto } from './dto/dispatch-incident.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentStatusDto, AssignVehicleDto, UpdateIncidentDto, CancelIncidentDto } from './dto/update-incident.dto';
import { IncidentQueryDto } from './dto/incident-query.dto';
import { PaginatedResponse, encodeCursor, decodeCursor } from '../../../libs/common/src';

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
    let vehicleId: string;
    let eta: number;

    if (isManualOverride) {
      vehicleId = dto.manual_vehicle_id!;
      // Simulated ETA for manually selected vehicle
      eta = Math.floor(Math.random() * 600) + 120; // 2-12 minutes
    } else {
      // Auto-assign: simulate nearest unit selection based on GPS
      // In production, this would query the fleet service for available vehicles
      // sorted by distance to incident.gps_lat / incident.gps_lon
      vehicleId = `AMB-${String(Math.floor(Math.random() * 50) + 1).padStart(3, '0')}`;
      eta = Math.floor(Math.random() * 480) + 60; // 1-9 minutes
    }

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
      : `Dispatch triggered (auto-assigned: ${vehicleId})`;

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

  async getTimeline(id: string) {
    const events = await this.timelineRepository.find({
      where: { incident_id: id },
      order: { createdAt: 'ASC' },
    });
    return { data: events };
  }
}
