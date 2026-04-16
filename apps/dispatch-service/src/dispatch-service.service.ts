import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from './entities/incident.entity';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentStatusDto, AssignVehicleDto } from './dto/update-incident.dto';

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

  async findAll(status?: string, callerId?: string) {
    const queryBuilder = this.incidentRepository.createQueryBuilder('incident');

    if (status) {
      queryBuilder.andWhere('incident.status = :status', { status });
    }

    if (callerId) {
      queryBuilder.andWhere('incident.caller_id = :callerId', { callerId });
    }

    queryBuilder.orderBy('incident.createdAt', 'DESC');

    const incidents = await queryBuilder.getMany();
    return { data: incidents };
  }

  async findOne(id: string, requestUser?: any) {
    const incident = await this.incidentRepository.findOneBy({ id });
    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }

    // Security: Non-admins/CCE can only view their own incidents
    if (requestUser) {
      const isAdmin = requestUser.roles.includes('CURESELECT_ADMIN') || requestUser.roles.includes('CCE');
      if (!isAdmin && incident.caller_id !== requestUser.userId) {
        throw new ForbiddenException('You do not have permission to view this incident');
      }
    }

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
