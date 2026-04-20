import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { 
  PatientProfile, 
  PatientAssessment, 
  PatientIntervention, 
  PatientCondition,
  PatientAllergy,
  PatientMedication,
  PatientSurgery,
  PatientHospitalisation,
  AuditLogService 
} from '@app/common';
import { CreatePatientDto } from './dto/create-patient.dto';
import { RecordVitalsDto } from './dto/record-vitals.dto';
import { RecordGcsDto } from './dto/record-gcs.dto';
import { RecordInterventionDto } from './dto/record-intervention.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { FullUpdatePatientDto } from './dto/full-update-patient.dto';
import { MrnLookupDto } from './dto/mrn-lookup.dto';
import { AbhaLookupDto } from './dto/abha-lookup.dto';
import { AddConditionDto } from './dto/add-condition.dto';
import { RecordMedicationDto } from './dto/record-medication.dto';
import { RecordAllergyDto } from './dto/record-allergy.dto';
import { UpdateMedicalHistoryDto } from './dto/update-medical-history.dto';
import { DataSource } from 'typeorm';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(PatientProfile)
    private readonly patientRepo: Repository<PatientProfile>,
    @InjectRepository(PatientAssessment)
    private readonly assessmentRepo: Repository<PatientAssessment>,
    @InjectRepository(PatientIntervention)
    private readonly interventionRepo: Repository<PatientIntervention>,
    @InjectRepository(PatientCondition)
    private readonly conditionRepo: Repository<PatientCondition>,
    @InjectRepository(PatientAllergy)
    private readonly allergyRepo: Repository<PatientAllergy>,
    @InjectRepository(PatientMedication)
    private readonly medicationRepo: Repository<PatientMedication>,
    @InjectRepository(PatientSurgery)
    private readonly surgeryRepo: Repository<PatientSurgery>,
    @InjectRepository(PatientHospitalisation)
    private readonly hospitalisationRepo: Repository<PatientHospitalisation>,
    private readonly auditLogService: AuditLogService,
    private readonly dataSource: DataSource,
  ) {}

  async createPatient(dto: CreatePatientDto, reqUser: any, ip: string, userAgent: string) {
    const orgId = dto.organisationId || reqUser.organisationId || reqUser.org_id;
    
    const patient = await this.patientRepo.save(
      this.patientRepo.create({
        ...dto,
        organisationId: orgId,
      }),
    );

    await this.auditLogService.log({
      userId: reqUser.userId,
      action: 'PATIENT_PROFILE_CREATED',
      ipAddress: ip,
      userAgent,
      metadata: { 
        patientId: patient.id, 
        incident_id: dto.incident_id,
        trip_id: dto.trip_id,
        orgId
      },
    });

    return { data: patient };
  }

  async recordVitals(patientId: string, dto: RecordVitalsDto, reqUser: any, ip: string) {
    const patient = await this.findOneWithIsolation(patientId, reqUser);

    const vitals = this.assessmentRepo.create({
      patient_id: patientId,
      type: 'VITALS',
      bp_systolic: dto.bp_systolic,
      bp_diastolic: dto.bp_diastolic,
      heart_rate: dto.heart_rate,
      spo2: dto.spo2,
      respiratory_rate: dto.respiratory_rate,
      temp_celsius: dto.temp_celsius,
      taken_at: dto.taken_at ? new Date(dto.taken_at) : new Date(),
      recorded_by_id: reqUser?.userId || 'SYSTEM',
    });

    const saved = await this.assessmentRepo.save(vitals);

    try {
      await this.auditLogService.log({
        userId: reqUser?.userId || 'SYSTEM',
        action: 'PATIENT_VITALS_RECORDED',
        ipAddress: ip || '0.0.0.0',
        metadata: { patientId, assessmentId: saved.id },
      });
    } catch (e) {
      console.error('Audit Log failed:', e.message);
    }

    return { data: saved };
  }

  async recordGcs(patientId: string, dto: RecordGcsDto, reqUser: any, ip: string) {
    const patient = await this.findOneWithIsolation(patientId, reqUser);

    const total = dto.eye + dto.verbal + dto.motor;

    const gcs = this.assessmentRepo.create({
      patient_id: patientId,
      type: 'GCS',
      gcs_eye: dto.eye,
      gcs_verbal: dto.verbal,
      gcs_motor: dto.motor,
      gcs_total: total,
      taken_at: dto.taken_at ? new Date(dto.taken_at) : new Date(),
      recorded_by_id: reqUser?.userId || 'SYSTEM',
    });

    const saved = await this.assessmentRepo.save(gcs);

    try {
      await this.auditLogService.log({
        userId: reqUser?.userId || 'SYSTEM',
        action: 'PATIENT_GCS_RECORDED',
        ipAddress: ip || '0.0.0.0',
        metadata: { patientId, assessmentId: saved.id, total },
      });
    } catch (e) {
      console.error('Audit Log failed:', e.message);
    }

    return { data: saved };
  }

  async addCondition(patientId: string, dto: AddConditionDto, reqUser: any, ip: string) {
    const patient = await this.findOneWithIsolation(patientId, reqUser);
    const recordedBy = reqUser.userId || 'SYSTEM';

    const condition = this.conditionRepo.create({
      ...dto,
      patient_id: patientId,
      recorded_by_id: recordedBy
    });
    await this.conditionRepo.save(condition);

    try {
      await this.auditLogService.log({
        userId: recordedBy,
        action: 'PATIENT_CONDITION_RECORDED',
        ipAddress: ip || '0.0.0.0',
        metadata: { patientId, name: dto.name, icd10: dto.icd10_code },
      });
    } catch (e) {
      console.error('Failed to log audit for condition recording', e);
    }

    return { data: condition };
  }

  async recordMedication(patientId: string, dto: RecordMedicationDto, reqUser: any, ip: string) {
    const patient = await this.findOneWithIsolation(patientId, reqUser);
    const recordedBy = reqUser.userId || 'SYSTEM';

    const medication = this.medicationRepo.create({
      ...dto,
      patient_id: patientId,
      recorded_by_id: recordedBy
    });
    await this.medicationRepo.save(medication);

    try {
      await this.auditLogService.log({
        userId: recordedBy,
        action: 'PATIENT_MEDICATION_RECORDED',
        ipAddress: ip || '0.0.0.0',
        metadata: { patientId, name: dto.name, dose: dto.dose, route: dto.route },
      });
    } catch (e) {
      console.error('Failed to log audit for medication recording', e);
    }

    return { data: medication };
  }

  async recordAllergy(patientId: string, dto: RecordAllergyDto, reqUser: any, ip: string) {
    const patient = await this.findOneWithIsolation(patientId, reqUser);
    const recordedBy = reqUser.userId || 'SYSTEM';

    const allergy = this.allergyRepo.create({
      ...dto,
      patient_id: patientId,
      recorded_by_id: recordedBy
    });
    await this.allergyRepo.save(allergy);

    try {
      await this.auditLogService.log({
        userId: recordedBy,
        action: 'PATIENT_ALLERGY_RECORDED',
        ipAddress: ip || '0.0.0.0',
        metadata: { patientId, allergen: dto.allergen, severity: dto.severity },
      });
    } catch (e) {
      console.error('Failed to log audit for allergy recording', e);
    }

    return { data: allergy };
  }

  async removeCondition(patientId: string, condId: string, reqUser: any) {
    await this.findOneWithIsolation(patientId, reqUser);
    await this.conditionRepo.delete({ id: condId, patient_id: patientId });
    
    await this.auditLogService.log({
      userId: reqUser.userId || 'SYSTEM',
      action: 'PATIENT_CONDITION_REMOVED',
      metadata: { patientId, condId },
      ipAddress: '0.0.0.0'
    });
  }

  async removeMedication(patientId: string, medId: string, reqUser: any) {
    await this.findOneWithIsolation(patientId, reqUser);
    await this.medicationRepo.delete({ id: medId, patient_id: patientId });

    await this.auditLogService.log({
      userId: reqUser.userId || 'SYSTEM',
      action: 'PATIENT_MEDICATION_REMOVED',
      metadata: { patientId, medId },
      ipAddress: '0.0.0.0'
    });
  }

  async removeAllergy(patientId: string, allergyId: string, reqUser: any) {
    await this.findOneWithIsolation(patientId, reqUser);
    await this.allergyRepo.delete({ id: allergyId, patient_id: patientId });

    await this.auditLogService.log({
      userId: reqUser.userId || 'SYSTEM',
      action: 'PATIENT_ALLERGY_REMOVED',
      metadata: { patientId, allergyId },
      ipAddress: '0.0.0.0'
    });
  }

  async recordIntervention(patientId: string, dto: RecordInterventionDto, reqUser: any, ip: string) {
    const patient = await this.findOneWithIsolation(patientId, reqUser);

    const intervention = this.interventionRepo.create({
      patient_id: patientId,
      type: dto.type,
      description: dto.description,
      dosage: dto.dosage,
      administered_at: dto.administered_at ? new Date(dto.administered_at) : new Date(),
      recorded_by_id: reqUser?.userId || 'SYSTEM',
    });

    const saved = await this.interventionRepo.save(intervention);

    try {
      await this.auditLogService.log({
        userId: reqUser?.userId || 'SYSTEM',
        action: 'PATIENT_INTERVENTION_RECORDED',
        ipAddress: ip || '0.0.0.0',
        metadata: { patientId, interventionId: saved.id, type: dto.type },
      });
    } catch (e) {
      console.error('Audit Log failed:', e.message);
    }

    return { data: saved };
  }

  async fullUpdatePatient(id: string, dto: FullUpdatePatientDto, requestUser: any, ip: string) {
    const patient = await this.findOneWithIsolation(id, requestUser);

    Object.assign(patient, dto);
    const saved = await this.patientRepo.save(patient);

    await this.auditLogService.log({
      userId: requestUser.userId,
      action: 'PATIENT_PROFILE_FULL_UPDATED',
      ipAddress: ip,
      metadata: { patientId: id, mrn: dto.mrn },
    });

    return { data: saved };
  }

  async updatePatient(id: string, dto: UpdatePatientDto, requestUser: any, ip: string) {
    const patient = await this.findOneWithIsolation(id, requestUser);

    Object.assign(patient, dto);
    const saved = await this.patientRepo.save(patient);

    await this.auditLogService.log({
      userId: requestUser.userId,
      action: 'PATIENT_PROFILE_UPDATED',
      ipAddress: ip,
      metadata: { patientId: id, updates: dto },
    });

    return { data: saved };
  }

  async findOneWithIsolation(id: string, requestUser: any) {
    const patient = await this.patientRepo.findOneBy({ id });
    if (!patient) throw new NotFoundException('Patient not found');

    const roles = requestUser.roles || [];
    const isPlatformAdmin = roles.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN', 'Call Centre Executive (CCE)', 'CCE'].includes(r)
    );

    if (!isPlatformAdmin) {
      const userOrgId = requestUser.organisationId || requestUser.org_id;
      if (patient.organisationId && patient.organisationId !== userOrgId) {
        throw new ForbiddenException('Access to this patient record is denied');
      }
    }

    return patient;
  }

  async getClinicalHistory(patientId: string, requestUser: any) {
    const patient = await this.findOneWithIsolation(patientId, requestUser);

    const assessments = await this.assessmentRepo.find({
      where: { patient_id: patientId },
      order: { taken_at: 'DESC' },
    });

    const interventions = await this.interventionRepo.find({
      where: { patient_id: patientId },
      order: { administered_at: 'DESC' },
    });

    return {
      data: {
        profile: patient,
        assessments,
        interventions,
      },
    };
  }

  async getMedicalHistory(patientId: string, reqUser: any) {
    const patient = await this.findOneWithIsolation(patientId, reqUser);

    const [conditions, medications, allergies, surgeries, hospitalisations] = await Promise.all([
      this.conditionRepo.find({ 
        where: { patient_id: patientId },
        order: { createdAt: 'DESC' }
      }),
      this.medicationRepo.find({ 
        where: { patient_id: patientId },
        order: { createdAt: 'DESC' }
      }),
      this.allergyRepo.find({ 
        where: { patient_id: patientId },
        order: { createdAt: 'DESC' }
      }),
      this.surgeryRepo.find({
        where: { patient_id: patientId },
        order: { createdAt: 'DESC' }
      }),
      this.hospitalisationRepo.find({
        where: { patient_id: patientId },
        order: { createdAt: 'DESC' }
      })
    ]);

    return {
      data: {
        patient_id: patientId,
        conditions,
        medications,
        allergies,
        surgeries,
        hospitalisations
      }
    };
  }

  async updateMedicalHistory(patientId: string, dto: UpdateMedicalHistoryDto, reqUser: any) {
    const patient = await this.findOneWithIsolation(patientId, reqUser);
    const recordedBy = reqUser.userId || 'SYSTEM';

    await this.dataSource.transaction(async (manager) => {
      // 1. Clear existing history (Replace Sync)
      await manager.delete(PatientCondition, { patient_id: patientId });
      await manager.delete(PatientMedication, { patient_id: patientId });
      await manager.delete(PatientAllergy, { patient_id: patientId });
      await manager.delete(PatientSurgery, { patient_id: patientId });
      await manager.delete(PatientHospitalisation, { patient_id: patientId });

      // 2. Bulk Insert new history
      if (dto.conditions?.length) {
        await manager.save(PatientCondition, dto.conditions.map(c => ({ ...c, patient_id: patientId, recorded_by_id: recordedBy })));
      }
      if (dto.medications?.length) {
        await manager.save(PatientMedication, dto.medications.map(m => ({ ...m, patient_id: patientId, recorded_by_id: recordedBy })));
      }
      if (dto.allergies?.length) {
        await manager.save(PatientAllergy, dto.allergies.map(a => ({ ...a, patient_id: patientId, recorded_by_id: recordedBy })));
      }
      if (dto.surgeries?.length) {
        await manager.save(PatientSurgery, dto.surgeries.map(s => ({ ...s, patient_id: patientId, recorded_by_id: recordedBy })));
      }
      if (dto.hospitalisations?.length) {
        await manager.save(PatientHospitalisation, dto.hospitalisations.map(h => ({ ...h, patient_id: patientId, recorded_by_id: recordedBy })));
      }
    });

    await this.auditLogService.log({
      userId: recordedBy,
      action: 'PATIENT_MEDICAL_HISTORY_SYNCED',
      metadata: { patient_id: patientId },
      ipAddress: '0.0.0.0'
    });

    return this.getMedicalHistory(patientId, reqUser);
  }

  async recordMedicalHistory(patientId: string, dto: UpdateMedicalHistoryDto, reqUser: any, ip: string) {
    const patient = await this.findOneWithIsolation(patientId, reqUser);
    const recordedBy = reqUser.userId || 'SYSTEM';

    await this.dataSource.transaction(async (manager) => {
      // Append Mode: Directly insert without deleting existing records
      if (dto.conditions?.length) {
        await manager.save(PatientCondition, dto.conditions.map(c => ({ ...c, patient_id: patientId, recorded_by_id: recordedBy })));
      }
      if (dto.medications?.length) {
        await manager.save(PatientMedication, dto.medications.map(m => ({ ...m, patient_id: patientId, recorded_by_id: recordedBy })));
      }
      if (dto.allergies?.length) {
        await manager.save(PatientAllergy, dto.allergies.map(a => ({ ...a, patient_id: patientId, recorded_by_id: recordedBy })));
      }
      if (dto.surgeries?.length) {
        await manager.save(PatientSurgery, dto.surgeries.map(s => ({ ...s, patient_id: patientId, recorded_by_id: recordedBy })));
      }
      if (dto.hospitalisations?.length) {
        await manager.save(PatientHospitalisation, dto.hospitalisations.map(h => ({ ...h, patient_id: patientId, recorded_by_id: recordedBy })));
      }
    });

    await this.auditLogService.log({
      userId: recordedBy,
      action: 'PATIENT_MEDICAL_HISTORY_RECORDED',
      metadata: { patient_id: patientId, types: Object.keys(dto).filter(k => (dto as any)[k]?.length) },
      ipAddress: ip || '0.0.0.0'
    });

    return this.getMedicalHistory(patientId, reqUser);
  }

  async getGlobalHistory(id: string, requestUser: any) {
    const primaryPatient = await this.findOneWithIsolation(id, requestUser);

    // Identify unique linking keys
    const keys: { mrn?: string, abha_id?: string, phone?: string } = {
      mrn: primaryPatient.mrn,
      abha_id: primaryPatient.abha_id,
      phone: primaryPatient.phone,
    };

    // If no unique keys are present, we can only return this incident
    if (!keys.mrn && !keys.abha_id && !keys.phone) {
      return { data: [primaryPatient] };
    }

    // Build query for matching profiles
    const query = this.patientRepo.createQueryBuilder('patient')
      .where('patient.id != :primaryId', { primaryId: id });

    const conditions: string[] = [];
    if (keys.mrn) conditions.push('patient.mrn = :mrn');
    if (keys.abha_id) conditions.push('patient.abha_id = :abha');
    if (keys.phone) conditions.push('patient.phone = :phone');

    query.andWhere(`(${conditions.join(' OR ')})`, { 
      mrn: keys.mrn, 
      abha: keys.abha_id, 
      phone: keys.phone 
    });

    // Security Isolation: For now, we restrict to records the user can actually see
    // unless this is a platform admin.
    const roles = requestUser.roles || [];
    const isPlatformAdmin = roles.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN', 'Call Centre Executive (CCE)', 'CCE'].includes(r)
    );

    if (!isPlatformAdmin) {
      const userOrgId = requestUser.organisationId || requestUser.org_id;
      query.andWhere('patient.organisationId = :userOrgId', { userOrgId });
    }

    const history = await query.orderBy('patient.createdAt', 'DESC').getMany();

    // Include the primary (current) patient in the result as the first item
    return { data: [primaryPatient, ...history] };
  }

  async lookupByMrn(dto: MrnLookupDto, requestUser: any) {
    const orgId = dto.hospitalId || requestUser.organisationId || requestUser.org_id;

    const patient = await this.patientRepo.findOne({
      where: { 
        mrn: ILike(dto.mrn),
        organisationId: orgId
      },
      order: { createdAt: 'DESC' }
    });

    return { data: patient };
  }

  async lookupByAbha(dto: AbhaLookupDto, requestUser: any) {
    // If consent_artefact_id is provided, we perform a global search (Multi-Tenant PHR)
    // without enforcing the requestUser's organisationId restriction.
    const patient = await this.patientRepo.findOne({
      where: { 
        abha_id: ILike(dto.abha_id) 
      },
      order: { createdAt: 'DESC' }
    });

    if (!patient) return { data: null };

    // Audit the consent-based lookup
    await this.auditLogService.log({
      userId: requestUser.userId,
      action: 'PATIENT_ABHA_LOOKUP',
      ipAddress: '0.0.0.0', // Placeholders if needed
      metadata: { 
        abha_id: dto.abha_id, 
        consent_artefact_id: dto.consent_artefact_id,
        matchedPatientId: patient.id
      },
    });

    return { data: patient };
  }

  async findOneForUser(id: string, requestUser: any) {
    const patient = await this.findOneWithIsolation(id, requestUser);
    return { data: patient };
  }

  async findByIncident(incidentId: string) {
    return this.patientRepo.find({
      where: { incident_id: incidentId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    return this.patientRepo.findOneBy({ id });
  }
}
