import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientProfile } from './entities/patient-profile.entity';
import { Incident } from './entities/incident.entity';
import { CreatePatientProfileDto } from './dto/create-patient-profile.dto';
import { AuditLogService } from '../../auth-service/src/audit-log.service';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(PatientProfile)
    private readonly patientRepo: Repository<PatientProfile>,
    @InjectRepository(Incident)
    private readonly incidentRepo: Repository<Incident>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createPatient(dto: CreatePatientProfileDto, userId: string, ip: string, userAgent: string) {
    // 1. Verify Incident exists
    const incident = await this.incidentRepo.findOneBy({ id: dto.incident_id });
    if (!incident) {
      throw new NotFoundException(`Incident with ID ${dto.incident_id} not found`);
    }

    // 2. Create Profile
    const profile = this.patientRepo.create({
      ...dto,
      organisationId: incident.organisationId,
    });
    const saved = await this.patientRepo.save(profile);

    // 3. Security Audit
    await this.auditLogService.log({
      userId,
      action: 'PATIENT_PROFILE_CREATED',
      ipAddress: ip,
      userAgent,
      metadata: {
        patientId: saved.id,
        incidentId: dto.incident_id,
        tripId: dto.trip_id,
      },
    });

    return { data: saved };
  }

  async findByIncident(incidentId: string, requestUser?: any) {
    const where: any = { incident_id: incidentId };

    if (requestUser) {
      const isPlatformAdmin = requestUser.roles.some((r: string) =>
        ['CureSelect Admin', 'CURESELECT_ADMIN', 'Call Centre Executive (CCE)', 'CCE'].includes(r)
      );
      if (!isPlatformAdmin) {
        where.organisationId = requestUser.organisationId;
      }
    }

    const data = await this.patientRepo.find({
      where,
      order: { createdAt: 'DESC' }
    });
    return { data };
  }
}
