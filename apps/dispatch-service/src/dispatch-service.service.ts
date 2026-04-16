import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from './entities/incident.entity';
import { CreateIncidentDto } from './dto/create-incident.dto';

@Injectable()
export class DispatchServiceService {
  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
  ) {}

  async createIncident(dto: CreateIncidentDto, requestUserId: string) {
    // Overwrite the caller_id with the authenticated user ID if one wasn't explicitly passed
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
}
