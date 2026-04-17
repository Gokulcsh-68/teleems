import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientProfile } from './entities/patient-profile.entity';
import { PatientAssessment } from './entities/patient-assessment.entity';
import { PatientIntervention } from './entities/patient-intervention.entity';
import { Incident } from './entities/incident.entity';
import { CreatePatientProfileDto } from './dto/create-patient-profile.dto';
import { RecordVitalsDto } from './dto/record-vitals.dto';
import { RecordGcsDto } from './dto/record-gcs.dto';
import { RecordInterventionDto } from './dto/record-intervention.dto';
import { AuditLogService } from '../../auth-service/src/audit-log.service';
import { StorageService, RedisService } from '../../../libs/common/src';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(PatientProfile)
    private readonly patientRepo: Repository<PatientProfile>,
    @InjectRepository(PatientAssessment)
    private readonly assessmentRepo: Repository<PatientAssessment>,
    @InjectRepository(PatientIntervention)
    private readonly interventionRepo: Repository<PatientIntervention>,
    @InjectRepository(Incident)
    private readonly incidentRepo: Repository<Incident>,
    private readonly auditLogService: AuditLogService,
    private readonly storageService: StorageService,
    private readonly redisService: RedisService,
  ) {}

  async createPatient(dto: CreatePatientProfileDto, userId: string, ip: string, userAgent: string) {
    // 1. Verify Incident exists
    const incident = await this.incidentRepo.findOneBy({ id: dto.incident_id });
    if (!incident) {
      throw new NotFoundException(`Incident with ID ${dto.incident_id} not found`);
    }

    // 2. Resolve organization context
    const orgId = incident.organisationId || dto.organisationId;
    if (!orgId) {
      throw new BadRequestException('Organization context missing: Incident has no assigned organization, and none provided in payload');
    }

    // 3. Create Profile
    const profile = this.patientRepo.create({
      ...dto,
      organisationId: orgId,
    });
    const saved = await this.patientRepo.save(profile);

    // 4. Handle Patient Photo (Upload to S3 if base64)
    if (dto.photo_url && dto.photo_url.startsWith('data:')) {
      const fileName = `${saved.id}_profile_photo.jpg`;
      const photoUrl = await this.storageService.uploadBase64(
        dto.photo_url,
        'patients/photos/',
        fileName
      );
      
      // Update saved profile with real S3 URL
      saved.photo_url = photoUrl;
      await this.patientRepo.save(saved);
    }

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

  async recordVitals(patientId: string, dto: RecordVitalsDto, userId: string) {
    const patient = await this.patientRepo.findOneBy({ id: patientId });
    if (!patient) throw new NotFoundException('Patient not found');

    const assessment = this.assessmentRepo.create({
      patient_id: patientId,
      type: 'VITALS',
      ...dto,
      taken_at: dto.taken_at ? new Date(dto.taken_at) : new Date(),
      recorded_by_id: userId,
    });

    const saved = await this.assessmentRepo.save(assessment);
    await this.redisService.publish(`vitals:stream:${patientId}`, {
      type: 'VITALS',
      patient_id: patientId,
      data: saved,
    });

    return { data: saved };
  }

  async recordGcs(patientId: string, dto: RecordGcsDto, userId: string) {
    const patient = await this.patientRepo.findOneBy({ id: patientId });
    if (!patient) throw new NotFoundException('Patient not found');

    const total = dto.eye + dto.verbal + dto.motor;

    const assessment = this.assessmentRepo.create({
      patient_id: patientId,
      type: 'GCS',
      gcs_eye: dto.eye,
      gcs_verbal: dto.verbal,
      gcs_motor: dto.motor,
      gcs_total: total,
      taken_at: dto.taken_at ? new Date(dto.taken_at) : new Date(),
      recorded_by_id: userId,
    });

    const saved = await this.assessmentRepo.save(assessment);
    await this.redisService.publish(`vitals:stream:${patientId}`, {
      type: 'GCS',
      patient_id: patientId,
      data: saved,
    });

    return { data: saved };
  }

  async recordIntervention(patientId: string, dto: RecordInterventionDto, userId: string) {
    const patient = await this.patientRepo.findOneBy({ id: patientId });
    if (!patient) throw new NotFoundException('Patient not found');

    const intervention = this.interventionRepo.create({
      patient_id: patientId,
      ...dto,
      administered_at: dto.administered_at ? new Date(dto.administered_at) : new Date(),
      recorded_by_id: userId,
    });

    return { data: await this.interventionRepo.save(intervention) };
  }

  async getClinicalHistory(patientId: string, requestUser: any) {
    const patient = await this.patientRepo.findOneBy({ id: patientId });
    if (!patient) throw new NotFoundException('Patient not found');

    // Tenant Isolation
    const isPlatformAdmin = requestUser.roles.some((r: string) =>
        ['CureSelect Admin', 'CURESELECT_ADMIN', 'Call Centre Executive (CCE)', 'CCE'].includes(r)
    );
    if (!isPlatformAdmin && patient.organisationId !== requestUser.organisationId) {
        throw new ForbiddenException('You do not have permission to view clinical data for this patient');
    }

    const assessments = await this.assessmentRepo.find({
      where: { patient_id: patientId },
      order: { taken_at: 'DESC' }
    });

    const interventions = await this.interventionRepo.find({
      where: { patient_id: patientId },
      order: { administered_at: 'DESC' }
    });

    return { 
      data: {
        patient_id: patientId,
        assessments,
        interventions
      } 
    };
  }
}
