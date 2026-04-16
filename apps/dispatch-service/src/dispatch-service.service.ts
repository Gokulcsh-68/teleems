import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from './entities/incident.entity';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentStatusDto, AssignVehicleDto, UpdateIncidentDto, CancelIncidentDto } from './dto/update-incident.dto';
import { IncidentQueryDto } from './dto/incident-query.dto';
import { PaginatedResponse, encodeCursor, decodeCursor } from '../../../libs/common/src';

@Injectable()
export class DispatchServiceService {
  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
  ) {}

  async createIncident(dto: CreateIncidentDto, requestUserId: string) {
    const incidentData = {
      ...dto,
      caller_id: dto.caller_id || requestUserId,
      status: 'PENDING',
    };

    const incident = this.incidentRepository.create(incidentData);
    await this.incidentRepository.save(incident);

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

  async updateIncident(id: string, dto: UpdateIncidentDto) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) throw new NotFoundException('Incident not found');

    // Only apply fields if they are provided in the DTO
    if (dto.category) incident.category = dto.category;
    if (dto.severity) incident.severity = dto.severity;
    if (dto.address) incident.address = dto.address;
    if (dto.notes) {
      incident.notes = incident.notes ? `${incident.notes}\n${dto.notes}` : dto.notes;
    }

    await this.incidentRepository.save(incident);
    return { data: incident };
  }

  async cancelIncident(id: string, dto: CancelIncidentDto) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) throw new NotFoundException('Incident not found');

    if (incident.status !== 'PENDING') {
      throw new BadRequestException('Incident can only be cancelled before dispatch (status: PENDING)');
    }

    incident.status = 'CANCELLED';
    const cancelNote = `[CANCELLED] Reason: ${dto.reason}`;
    incident.notes = incident.notes ? `${incident.notes}\n${cancelNote}` : cancelNote;

    await this.incidentRepository.save(incident);
    return { data: incident };
  }

  async updateStatus(id: string, dto: UpdateIncidentStatusDto) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) throw new NotFoundException('Incident not found');

    incident.status = dto.status;
    if (dto.notes) {
      incident.notes = incident.notes ? `${incident.notes}\n${dto.notes}` : dto.notes;
    }

    await this.incidentRepository.save(incident);
    return { data: incident };
  }

  async assignVehicle(id: string, dto: AssignVehicleDto) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) throw new NotFoundException('Incident not found');

    incident.assigned_vehicle = dto.vehicle_id;
    incident.status = 'ASSIGNED';
    if (dto.eta_seconds !== undefined) {
      incident.eta_seconds = dto.eta_seconds;
    }

    await this.incidentRepository.save(incident);
    return { data: incident };
  }
}
