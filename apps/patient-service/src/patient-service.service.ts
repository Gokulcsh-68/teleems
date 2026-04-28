import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import {
  PatientProfile,
  PatientAssessment,
  PatientAssessmentNote,
  PatientIntervention,
  PatientCondition,
  PatientAllergy,
  PatientMedication,
  PatientSurgery,
  PatientHospitalisation,
  PatientMedicationLog,
  PatientPhoto,
  PatientDocument,
  PatientValuable,
  VehicleInventory,
  Dispatch,
  AuditLogService,
  StorageService,
} from '@app/common';
import { CreatePatientDto } from './dto/create-patient.dto';
import { RecordVitalsDto } from './dto/record-vitals.dto';
import { RecordGcsDto } from './dto/record-gcs.dto';
import {
  CreateInterventionDto,
  RecordCprDto,
  RecordDefibDto,
  RecordIntubationDto,
} from './dto/clinical-intervention.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { FullUpdatePatientDto } from './dto/full-update-patient.dto';
import { MrnLookupDto } from './dto/mrn-lookup.dto';
import { AbhaLookupDto } from './dto/abha-lookup.dto';
import { AddConditionDto } from './dto/add-condition.dto';
import { RecordMedicationDto } from './dto/record-medication.dto';
import { LogMedicationDto } from './dto/medication-administration.dto';
import { RecordAllergyDto } from './dto/record-allergy.dto';
import { UpdateMedicalHistoryDto } from './dto/update-medical-history.dto';
import {
  CreateClinicalAssessmentDto,
  UpdateClinicalAssessmentDto,
  CreateAssessmentNoteDto,
} from './dto/clinical-assessment.dto';
import { UploadPhotoDto } from './dto/upload-photo.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { LogValuableDto } from './dto/log-valuable.dto';
import { Express } from 'express';
import { DataSource } from 'typeorm';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(PatientProfile)
    private readonly patientRepo: Repository<PatientProfile>,
    @InjectRepository(PatientAssessment)
    private readonly assessmentRepo: Repository<PatientAssessment>,
    @InjectRepository(PatientAssessmentNote)
    private readonly noteRepo: Repository<PatientAssessmentNote>,
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
    @InjectRepository(PatientMedicationLog)
    private readonly medLogRepo: Repository<PatientMedicationLog>,
    @InjectRepository(VehicleInventory)
    private readonly vehicleInventoryRepo: Repository<VehicleInventory>,
    @InjectRepository(Dispatch)
    private readonly dispatchRepo: Repository<Dispatch>,
    @InjectRepository(PatientPhoto)
    private readonly photoRepo: Repository<PatientPhoto>,
    @InjectRepository(PatientDocument)
    private readonly documentRepo: Repository<PatientDocument>,
    @InjectRepository(PatientValuable)
    private readonly valuableRepo: Repository<PatientValuable>,
    private readonly auditLogService: AuditLogService,
    private readonly storageService: StorageService,
    private readonly dataSource: DataSource,
  ) {}

  async createPatient(
    dto: CreatePatientDto,
    reqUser: any,
    ip: string,
    userAgent: string,
  ) {
    const orgId =
      dto.organisationId || reqUser.organisationId || reqUser.org_id;

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
        orgId,
      },
    });

    return { data: patient };
  }

  async recordVitals(
    patientId: string,
    dto: RecordVitalsDto,
    reqUser: any,
    ip: string,
  ) {
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

  async recordGcs(
    patientId: string,
    dto: RecordGcsDto,
    reqUser: any,
    ip: string,
  ) {
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

  // --- Spec 5.3: Clinical Assessment ---

  async recordAssessment(
    patientId: string,
    dto: CreateClinicalAssessmentDto,
    reqUser: any,
    ip: string,
  ) {
    const patient = await this.findOneWithIsolation(patientId, reqUser);
    const recordedBy = reqUser.userId || 'SYSTEM';

    const assessment = this.assessmentRepo.create({
      patient_id: patientId,
      recorded_by_id: recordedBy,
      taken_at: dto.taken_at ? new Date(dto.taken_at) : new Date(),
      // Neurological GCS
      gcs_eye: dto.gcs?.eye,
      gcs_verbal: dto.gcs?.verbal,
      gcs_motor: dto.gcs?.motor,
      gcs_total: dto.gcs ? dto.gcs.eye + dto.gcs.verbal + dto.gcs.motor : null,
      avpu: dto.avpu,
      // Pupils
      pupil_left_size: dto.pupils?.left?.size,
      pupil_left_reactivity: dto.pupils?.left?.reactivity,
      pupil_right_size: dto.pupils?.right?.size,
      pupil_right_reactivity: dto.pupils?.right?.reactivity,
      // Triage & CC
      triage_code: dto.triage_code,
      chief_complaint: dto.chief_complaint,
      // HPI
      hpi_onset: dto.hpi?.onset,
      hpi_duration: dto.hpi?.duration,
      hpi_character: dto.hpi?.character,
      hpi_severity: dto.hpi?.severity,
      hpi_radiation: dto.hpi?.radiation,
      hpi_associated_symptoms: dto.hpi?.associated_symptoms,
      trauma_json: dto.trauma_json,
      type: 'CLINICAL',
    });

    const saved = await this.assessmentRepo.save(assessment);

    try {
      await this.auditLogService.log({
        userId: recordedBy,
        action: 'PATIENT_ASSESSMENT_RECORDED',
        ipAddress: ip,
        metadata: { patientId, assessmentId: saved.id },
      });
    } catch (e) {
      console.error('Audit Log failed for clinical assessment:', e.message);
    }

    return { data: saved };
  }

  async getAssessments(patientId: string, reqUser: any) {
    await this.findOneWithIsolation(patientId, reqUser);

    const assessments = await this.assessmentRepo.find({
      where: { patient_id: patientId },
      order: { taken_at: 'DESC' },
      relations: ['notes'],
    });

    return { data: assessments };
  }

  async getLatestAssessment(patientId: string, reqUser: any) {
    await this.findOneWithIsolation(patientId, reqUser);

    const latest = await this.assessmentRepo.findOne({
      where: { patient_id: patientId },
      order: { taken_at: 'DESC' },
      relations: ['notes'],
    });

    return { data: latest };
  }

  async updateAssessment(
    assessmentId: string,
    dto: UpdateClinicalAssessmentDto,
    reqUser: any,
    ip: string,
  ) {
    const assessment = await this.assessmentRepo.findOneBy({
      id: assessmentId,
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    await this.findOneWithIsolation(assessment.patient_id, reqUser);

    if (dto.gcs) {
      assessment.gcs_eye = dto.gcs.eye;
      assessment.gcs_verbal = dto.gcs.verbal;
      assessment.gcs_motor = dto.gcs.motor;
      assessment.gcs_total = dto.gcs.eye + dto.gcs.verbal + dto.gcs.motor;
    }

    if (dto.pupils) {
      assessment.pupil_left_size = dto.pupils.left.size;
      assessment.pupil_left_reactivity = dto.pupils.left.reactivity;
      assessment.pupil_right_size = dto.pupils.right.size;
      assessment.pupil_right_reactivity = dto.pupils.right.reactivity;
    }

    if (dto.hpi) {
      assessment.hpi_onset = dto.hpi.onset ?? assessment.hpi_onset;
      assessment.hpi_duration = dto.hpi.duration ?? assessment.hpi_duration;
      assessment.hpi_character = dto.hpi.character ?? assessment.hpi_character;
      assessment.hpi_severity = dto.hpi.severity ?? assessment.hpi_severity;
      assessment.hpi_radiation = dto.hpi.radiation ?? assessment.hpi_radiation;
      assessment.hpi_associated_symptoms =
        dto.hpi.associated_symptoms ?? assessment.hpi_associated_symptoms;
    }

    if (dto.avpu) assessment.avpu = dto.avpu;
    if (dto.triage_code) assessment.triage_code = dto.triage_code;
    if (dto.chief_complaint) assessment.chief_complaint = dto.chief_complaint;
    if (dto.trauma_json) assessment.trauma_json = dto.trauma_json;

    const saved = await this.assessmentRepo.save(assessment);

    try {
      await this.auditLogService.log({
        userId: reqUser.userId,
        action: 'PATIENT_ASSESSMENT_UPDATED',
        ipAddress: ip,
        metadata: { assessmentId, patientId: assessment.patient_id },
      });
    } catch (e) {
      console.error(
        'Audit Log failed for clinical assessment update:',
        e.message,
      );
    }

    return { data: saved };
  }

  async addAssessmentNote(
    assessmentId: string,
    dto: CreateAssessmentNoteDto,
    reqUser: any,
    ip: string,
  ) {
    const assessment = await this.assessmentRepo.findOneBy({
      id: assessmentId,
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    const note = this.noteRepo.create({
      assessment_id: assessmentId,
      note_text: dto.note_text,
      source: dto.source,
      timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
    });

    const saved = await this.noteRepo.save(note);

    try {
      await this.auditLogService.log({
        userId: reqUser.userId,
        action: 'PATIENT_ASSESSMENT_NOTE_ADDED',
        ipAddress: ip,
        metadata: { assessmentId, noteId: saved.id },
      });
    } catch (e) {
      console.error('Audit Log failed for assessment note:', e.message);
    }

    return { data: saved };
  }

  async addCondition(
    patientId: string,
    dto: AddConditionDto,
    reqUser: any,
    ip: string,
  ) {
    const patient = await this.findOneWithIsolation(patientId, reqUser);
    const recordedBy = reqUser.userId || 'SYSTEM';

    const condition = this.conditionRepo.create({
      ...dto,
      patient_id: patientId,
      recorded_by_id: recordedBy,
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

  async administerMedication(
    patientId: string,
    dto: LogMedicationDto,
    reqUser: any,
    ip: string,
  ) {
    const patient = await this.findOneWithIsolation(patientId, reqUser);
    const recordedBy = reqUser.userId || 'SYSTEM';

    // 1. Record the medication administration
    const log = this.medLogRepo.create({
      patient_id: patientId,
      drug_name: dto.drug_name,
      dose_mg: dto.dose_mg,
      route: dto.route,
      time: dto.time ? new Date(dto.time) : new Date(),
      recorded_by_id: recordedBy,
      inventory_item_id: dto.inventory_item_id,
    });
    const savedLog = await this.medLogRepo.save(log);

    // 2. Inventory Deduction Logic
    if (dto.inventory_item_id) {
      try {
        // Attempt to find the active vehicle for this incident/EMT
        // We find the active dispatch for the patient's current (last) incident
        const latestDispatch = await this.dispatchRepo.findOne({
          where: { emt_id: recordedBy, status: 'TRANSPORTING' }, // Or just active status
          order: { dispatched_at: 'DESC' },
        });

        if (latestDispatch) {
          const vehicleId = latestDispatch.vehicle_id;
          const inventory = await this.vehicleInventoryRepo.findOneBy({
            vehicle_id: vehicleId!,
            inventory_item_id: dto.inventory_item_id,
          });

          if (inventory && inventory.quantity > 0) {
            inventory.quantity -= 1;
            await this.vehicleInventoryRepo.save(inventory);

            await this.auditLogService.log({
              userId: recordedBy,
              action: 'VEHICLE_INVENTORY_DEDUCTED',
              ipAddress: ip || '0.0.0.0',
              metadata: {
                vehicleId,
                itemId: dto.inventory_item_id,
                remaining: inventory.quantity,
              },
            });
          }
        }
      } catch (e) {
        console.error(
          'Inventory deduction failed, but medication log saved:',
          e.message,
        );
      }
    }

    try {
      await this.auditLogService.log({
        userId: recordedBy,
        action: 'PATIENT_MEDICATION_ADMINISTERED',
        ipAddress: ip || '0.0.0.0',
        metadata: { patientId, drugName: dto.drug_name, dose: dto.dose_mg },
      });
    } catch (e) {
      console.error('Audit Log failed:', e.message);
    }

    return { data: savedLog };
  }

  async getMedicationLogs(patientId: string, reqUser: any) {
    await this.findOneWithIsolation(patientId, reqUser);
    const logs = await this.medLogRepo.find({
      where: { patient_id: patientId },
      order: { time: 'DESC' },
    });
    return { data: logs };
  }

  async deleteMedicationLog(
    patientId: string,
    logId: string,
    reqUser: any,
    ip: string,
  ) {
    await this.findOneWithIsolation(patientId, reqUser);
    const log = await this.medLogRepo.findOneBy({
      id: logId,
      patient_id: patientId,
    });
    if (!log) throw new NotFoundException('Medication log not found');

    await this.medLogRepo.remove(log);

    await this.auditLogService.log({
      userId: reqUser.userId || 'SYSTEM',
      action: 'PATIENT_MEDICATION_LOG_DELETED',
      ipAddress: ip || '0.0.0.0',
      metadata: { patientId, logId, drugName: log.drug_name },
    });
  }

  async recordAllergy(
    patientId: string,
    dto: RecordAllergyDto,
    reqUser: any,
    ip: string,
  ) {
    const patient = await this.findOneWithIsolation(patientId, reqUser);
    const recordedBy = reqUser.userId || 'SYSTEM';

    const allergy = this.allergyRepo.create({
      ...dto,
      patient_id: patientId,
      recorded_by_id: recordedBy,
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
      ipAddress: '0.0.0.0',
    });
  }

  async removeMedication(patientId: string, medId: string, reqUser: any) {
    await this.findOneWithIsolation(patientId, reqUser);
    await this.medicationRepo.delete({ id: medId, patient_id: patientId });

    await this.auditLogService.log({
      userId: reqUser.userId || 'SYSTEM',
      action: 'PATIENT_MEDICATION_REMOVED',
      metadata: { patientId, medId },
      ipAddress: '0.0.0.0',
    });
  }

  async removeAllergy(patientId: string, allergyId: string, reqUser: any) {
    await this.findOneWithIsolation(patientId, reqUser);
    await this.allergyRepo.delete({ id: allergyId, patient_id: patientId });

    await this.auditLogService.log({
      userId: reqUser.userId || 'SYSTEM',
      action: 'PATIENT_ALLERGY_REMOVED',
      metadata: { patientId, allergyId },
      ipAddress: '0.0.0.0',
    });
  }

  async getInterventions(patientId: string, reqUser: any) {
    await this.findOneWithIsolation(patientId, reqUser);

    const interventions = await this.interventionRepo.find({
      where: { patient_id: patientId },
      order: { timestamp: 'DESC' },
    });

    return { data: interventions };
  }

  async deleteIntervention(
    patientId: string,
    interventionId: string,
    reqUser: any,
    ip: string,
  ) {
    await this.findOneWithIsolation(patientId, reqUser);

    const intervention = await this.interventionRepo.findOneBy({
      id: interventionId,
      patient_id: patientId,
    });
    if (!intervention) throw new NotFoundException('Intervention not found');

    await this.interventionRepo.remove(intervention);

    try {
      await this.auditLogService.log({
        userId: reqUser?.userId || 'SYSTEM',
        action: 'PATIENT_INTERVENTION_DELETED',
        ipAddress: ip || '0.0.0.0',
        metadata: { patientId, interventionId, type: intervention.type },
      });
    } catch (e) {
      console.error('Audit Log failed:', e.message);
    }
  }

  async recordIntervention(
    patientId: string,
    dto: CreateInterventionDto,
    reqUser: any,
    ip: string,
  ) {
    await this.findOneWithIsolation(patientId, reqUser);
    const recordedBy = reqUser?.userId || 'SYSTEM';

    const intervention = this.interventionRepo.create({
      patient_id: patientId,
      type: dto.type,
      description: dto.description,
      dosage: dto.dosage,
      detail_json: dto.detail_json,
      timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
      recorded_by_id: recordedBy,
    });

    const saved = await this.interventionRepo.save(intervention);

    try {
      await this.auditLogService.log({
        userId: recordedBy,
        action: 'PATIENT_INTERVENTION_RECORDED',
        ipAddress: ip || '0.0.0.0',
        metadata: { patientId, interventionId: saved.id, type: dto.type },
      });
    } catch (e) {
      console.error('Audit Log failed:', e.message);
    }

    return { data: saved };
  }

  async recordCpr(
    patientId: string,
    dto: RecordCprDto,
    reqUser: any,
    ip: string,
  ) {
    await this.findOneWithIsolation(patientId, reqUser);
    const recordedBy = reqUser?.userId || 'SYSTEM';

    const intervention = this.interventionRepo.create({
      patient_id: patientId,
      type: 'CPR',
      detail_json: dto,
      timestamp: new Date(dto.start_time),
      recorded_by_id: recordedBy,
    });

    const saved = await this.interventionRepo.save(intervention);

    try {
      await this.auditLogService.log({
        userId: recordedBy,
        action: 'PATIENT_CPR_LOGGED',
        ipAddress: ip || '0.0.0.0',
        metadata: { patientId, interventionId: saved.id },
      });
    } catch (e) {
      console.error('Audit Log failed:', e.message);
    }

    return { data: saved };
  }

  async recordDefibrillation(
    patientId: string,
    dto: RecordDefibDto,
    reqUser: any,
    ip: string,
  ) {
    await this.findOneWithIsolation(patientId, reqUser);
    const recordedBy = reqUser?.userId || 'SYSTEM';

    const intervention = this.interventionRepo.create({
      patient_id: patientId,
      type: 'DEFIB',
      detail_json: dto,
      timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
      recorded_by_id: recordedBy,
    });

    const saved = await this.interventionRepo.save(intervention);

    try {
      await this.auditLogService.log({
        userId: recordedBy,
        action: 'PATIENT_DEFIB_LOGGED',
        ipAddress: ip || '0.0.0.0',
        metadata: { patientId, interventionId: saved.id },
      });
    } catch (e) {
      console.error('Audit Log failed:', e.message);
    }

    return { data: saved };
  }

  async recordIntubation(
    patientId: string,
    dto: RecordIntubationDto,
    reqUser: any,
    ip: string,
  ) {
    await this.findOneWithIsolation(patientId, reqUser);
    const recordedBy = reqUser?.userId || 'SYSTEM';

    const intervention = this.interventionRepo.create({
      patient_id: patientId,
      type: 'INTUBATION',
      detail_json: dto,
      timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
      recorded_by_id: recordedBy,
    });

    const saved = await this.interventionRepo.save(intervention);

    try {
      await this.auditLogService.log({
        userId: recordedBy,
        action: 'PATIENT_INTUBATION_LOGGED',
        ipAddress: ip || '0.0.0.0',
        metadata: { patientId, interventionId: saved.id },
      });
    } catch (e) {
      console.error('Audit Log failed:', e.message);
    }

    return { data: saved };
  }

  async fullUpdatePatient(
    id: string,
    dto: FullUpdatePatientDto,
    requestUser: any,
    ip: string,
  ) {
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

  async updatePatient(
    id: string,
    dto: UpdatePatientDto,
    requestUser: any,
    ip: string,
  ) {
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
      [
        'CureSelect Admin',
        'CURESELECT_ADMIN',
        'Call Centre Executive (CCE)',
        'CCE',
      ].includes(r),
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
      order: { timestamp: 'DESC' },
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

    const [conditions, medications, allergies, surgeries, hospitalisations] =
      await Promise.all([
        this.conditionRepo.find({
          where: { patient_id: patientId },
          order: { createdAt: 'DESC' },
        }),
        this.medicationRepo.find({
          where: { patient_id: patientId },
          order: { createdAt: 'DESC' },
        }),
        this.allergyRepo.find({
          where: { patient_id: patientId },
          order: { createdAt: 'DESC' },
        }),
        this.surgeryRepo.find({
          where: { patient_id: patientId },
          order: { createdAt: 'DESC' },
        }),
        this.hospitalisationRepo.find({
          where: { patient_id: patientId },
          order: { createdAt: 'DESC' },
        }),
      ]);

    return {
      data: {
        patient_id: patientId,
        conditions,
        medications,
        allergies,
        surgeries,
        hospitalisations,
      },
    };
  }

  async updateMedicalHistory(
    patientId: string,
    dto: UpdateMedicalHistoryDto,
    reqUser: any,
  ) {
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
        await manager.save(
          PatientCondition,
          dto.conditions.map((c) => ({
            ...c,
            patient_id: patientId,
            recorded_by_id: recordedBy,
          })),
        );
      }
      if (dto.medications?.length) {
        await manager.save(
          PatientMedication,
          dto.medications.map((m) => ({
            ...m,
            patient_id: patientId,
            recorded_by_id: recordedBy,
          })),
        );
      }
      if (dto.allergies?.length) {
        await manager.save(
          PatientAllergy,
          dto.allergies.map((a) => ({
            ...a,
            patient_id: patientId,
            recorded_by_id: recordedBy,
          })),
        );
      }
      if (dto.surgeries?.length) {
        await manager.save(
          PatientSurgery,
          dto.surgeries.map((s) => ({
            ...s,
            patient_id: patientId,
            recorded_by_id: recordedBy,
          })),
        );
      }
      if (dto.hospitalisations?.length) {
        await manager.save(
          PatientHospitalisation,
          dto.hospitalisations.map((h) => ({
            ...h,
            patient_id: patientId,
            recorded_by_id: recordedBy,
          })),
        );
      }
    });

    await this.auditLogService.log({
      userId: recordedBy,
      action: 'PATIENT_MEDICAL_HISTORY_SYNCED',
      metadata: { patient_id: patientId },
      ipAddress: '0.0.0.0',
    });

    return this.getMedicalHistory(patientId, reqUser);
  }

  async recordMedicalHistory(
    patientId: string,
    dto: UpdateMedicalHistoryDto,
    reqUser: any,
    ip: string,
  ) {
    const patient = await this.findOneWithIsolation(patientId, reqUser);
    const recordedBy = reqUser.userId || 'SYSTEM';

    await this.dataSource.transaction(async (manager) => {
      // Append Mode: Directly insert without deleting existing records
      if (dto.conditions?.length) {
        await manager.save(
          PatientCondition,
          dto.conditions.map((c) => ({
            ...c,
            patient_id: patientId,
            recorded_by_id: recordedBy,
          })),
        );
      }
      if (dto.medications?.length) {
        await manager.save(
          PatientMedication,
          dto.medications.map((m) => ({
            ...m,
            patient_id: patientId,
            recorded_by_id: recordedBy,
          })),
        );
      }
      if (dto.allergies?.length) {
        await manager.save(
          PatientAllergy,
          dto.allergies.map((a) => ({
            ...a,
            patient_id: patientId,
            recorded_by_id: recordedBy,
          })),
        );
      }
      if (dto.surgeries?.length) {
        await manager.save(
          PatientSurgery,
          dto.surgeries.map((s) => ({
            ...s,
            patient_id: patientId,
            recorded_by_id: recordedBy,
          })),
        );
      }
      if (dto.hospitalisations?.length) {
        await manager.save(
          PatientHospitalisation,
          dto.hospitalisations.map((h) => ({
            ...h,
            patient_id: patientId,
            recorded_by_id: recordedBy,
          })),
        );
      }
    });

    await this.auditLogService.log({
      userId: recordedBy,
      action: 'PATIENT_MEDICAL_HISTORY_RECORDED',
      metadata: {
        patient_id: patientId,
        types: Object.keys(dto).filter((k) => (dto as any)[k]?.length),
      },
      ipAddress: ip || '0.0.0.0',
    });

    return this.getMedicalHistory(patientId, reqUser);
  }

  async getGlobalHistory(id: string, requestUser: any) {
    const primaryPatient = await this.findOneWithIsolation(id, requestUser);

    // Identify unique linking keys
    const keys: { mrn?: string; abha_id?: string; phone?: string } = {
      mrn: primaryPatient.mrn,
      abha_id: primaryPatient.abha_id,
      phone: primaryPatient.phone,
    };

    // If no unique keys are present, we can only return this incident
    if (!keys.mrn && !keys.abha_id && !keys.phone) {
      return { data: [primaryPatient] };
    }

    // Build query for matching profiles
    const query = this.patientRepo
      .createQueryBuilder('patient')
      .where('patient.id != :primaryId', { primaryId: id });

    const conditions: string[] = [];
    if (keys.mrn) conditions.push('patient.mrn = :mrn');
    if (keys.abha_id) conditions.push('patient.abha_id = :abha');
    if (keys.phone) conditions.push('patient.phone = :phone');

    query.andWhere(`(${conditions.join(' OR ')})`, {
      mrn: keys.mrn,
      abha: keys.abha_id,
      phone: keys.phone,
    });

    // Security Isolation: For now, we restrict to records the user can actually see
    // unless this is a platform admin.
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
      const userOrgId = requestUser.organisationId || requestUser.org_id;
      query.andWhere('patient.organisationId = :userOrgId', { userOrgId });
    }

    const history = await query.orderBy('patient.createdAt', 'DESC').getMany();

    // Include the primary (current) patient in the result as the first item
    return { data: [primaryPatient, ...history] };
  }

  async lookupByMrn(dto: MrnLookupDto, requestUser: any) {
    const orgId =
      dto.hospitalId || requestUser.organisationId || requestUser.org_id;

    const patient = await this.patientRepo.findOne({
      where: {
        mrn: ILike(dto.mrn),
        organisationId: orgId,
      },
      order: { createdAt: 'DESC' },
    });

    return { data: patient };
  }

  async lookupByAbha(dto: AbhaLookupDto, requestUser: any) {
    // If consent_artefact_id is provided, we perform a global search (Multi-Tenant PHR)
    // without enforcing the requestUser's organisationId restriction.
    const patient = await this.patientRepo.findOne({
      where: {
        abha_id: ILike(dto.abha_id),
      },
      order: { createdAt: 'DESC' },
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
        matchedPatientId: patient.id,
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

  // --- Spec 5.6: Documents & Photos ---

  async uploadPhoto(
    patientId: string,
    file: any,
    dto: UploadPhotoDto,
    reqUser: any,
    ip: string,
  ) {
    const patient = await this.findOneWithIsolation(patientId, reqUser);
    const recordedBy = reqUser?.userId || 'SYSTEM';

    // 1. Storage Folder Convention: /patients/:id/photos/:category/
    const folder = `patients/${patientId}/photos/${dto.category.toLowerCase()}/`;
    const extension = file.originalname.split('.').pop() || 'png';
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${extension}`;

    // 2. Upload to S3
    const { dbUrl, readUrl } = await this.storageService.uploadBuffer(
      file.buffer,
      folder,
      fileName,
      file.mimetype,
    );

    // 3. Save metadata to DB
    const photo = this.photoRepo.create({
      patient_id: patientId,
      url: dbUrl,
      category: dto.category,
      description: dto.description,
      uploaded_by_id: recordedBy,
    });
    const saved = await this.photoRepo.save(photo);

    // 4. Special Logic: Update Patient Profile Picture if category is PATIENT_FACE
    if (dto.category === 'PATIENT_FACE') {
      patient.photo_url = dbUrl;
      await this.patientRepo.save(patient);
    }

    // 5. Audit Log
    try {
      await this.auditLogService.log({
        userId: recordedBy,
        action: 'PATIENT_PHOTO_UPLOADED',
        ipAddress: ip || '0.0.0.0',
        metadata: { patientId, photoId: saved.id, category: dto.category },
      });
    } catch (e) {
      console.error('Audit Log failed for photo upload:', e.message);
    }

    return { data: { ...saved, url: readUrl } };
  }

  async getPhotos(patientId: string, reqUser: any) {
    await this.findOneWithIsolation(patientId, reqUser);

    const photos = await this.photoRepo.find({
      where: { patient_id: patientId },
      order: { timestamp: 'DESC' },
    });

    const data = await Promise.all(
      photos.map(async (p) => {
        if (p.url && !p.url.includes('X-Amz-Algorithm')) {
          p.url = await this.storageService.generatePresignedGetUrl(p.url);
        }
        return p;
      }),
    );

    return { data };
  }

  async deletePhoto(
    patientId: string,
    photoId: string,
    reqUser: any,
    ip: string,
  ) {
    await this.findOneWithIsolation(patientId, reqUser);

    const photo = await this.photoRepo.findOneBy({
      id: photoId,
      patient_id: patientId,
    });
    if (!photo) throw new NotFoundException('Photo not found');

    await this.photoRepo.remove(photo);

    try {
      await this.auditLogService.log({
        userId: reqUser?.userId || 'SYSTEM',
        action: 'PATIENT_PHOTO_DELETED',
        ipAddress: ip || '0.0.0.0',
        metadata: { patientId, photoId, category: photo.category },
      });
    } catch (e) {
      console.error('Audit Log failed:', e.message);
    }
  }

  // --- Spec 5.6: Documents ---
  async uploadDocument(
    patientId: string,
    file: any,
    dto: UploadDocumentDto,
    reqUser: any,
    ip: string,
  ) {
    const patient = await this.findOneWithIsolation(patientId, reqUser);
    const recordedBy = reqUser?.userId || 'SYSTEM';

    const folder = `patients/${patientId}/documents/${dto.doc_type.toLowerCase()}/`;
    const extension = file.originalname.split('.').pop() || 'pdf';
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${extension}`;

    const { dbUrl, readUrl } = await this.storageService.uploadBuffer(
      file.buffer,
      folder,
      fileName,
      file.mimetype,
    );

    const doc = this.documentRepo.create({
      patient_id: patientId,
      url: dbUrl,
      doc_type: dto.doc_type,
      description: dto.description,
      uploaded_by_id: recordedBy,
    });
    const saved = await this.documentRepo.save(doc);

    try {
      await this.auditLogService.log({
        userId: recordedBy,
        action: 'PATIENT_DOCUMENT_UPLOADED',
        ipAddress: ip || '0.0.0.0',
        metadata: { patientId, documentId: saved.id, type: dto.doc_type },
      });
    } catch (e) {
      console.error('Audit Log failed for document upload:', e.message);
    }

    return { data: { ...saved, url: readUrl } };
  }

  async getDocuments(patientId: string, reqUser: any) {
    await this.findOneWithIsolation(patientId, reqUser);

    const docs = await this.documentRepo.find({
      where: { patient_id: patientId },
      order: { timestamp: 'DESC' },
    });

    const data = await Promise.all(
      docs.map(async (d) => {
        if (d.url && !d.url.includes('X-Amz-Algorithm')) {
          d.url = await this.storageService.generatePresignedGetUrl(d.url);
        }
        return d;
      }),
    );

    return { data };
  }

  async deleteDocument(
    patientId: string,
    documentId: string,
    reqUser: any,
    ip: string,
  ) {
    await this.findOneWithIsolation(patientId, reqUser);

    const doc = await this.documentRepo.findOneBy({
      id: documentId,
      patient_id: patientId,
    });
    if (!doc) throw new NotFoundException('Document not found');

    await this.documentRepo.remove(doc);

    try {
      await this.auditLogService.log({
        userId: reqUser?.userId || 'SYSTEM',
        action: 'PATIENT_DOCUMENT_DELETED',
        ipAddress: ip || '0.0.0.0',
        metadata: { patientId, documentId, type: doc.doc_type },
      });
    } catch (e) {
      console.error('Audit Log failed:', e.message);
    }
  }

  // --- Spec 5.6: Valuables ---
  async logValuable(
    patientId: string,
    file: any,
    dto: LogValuableDto,
    reqUser: any,
    ip: string,
  ) {
    await this.findOneWithIsolation(patientId, reqUser);
    const recordedBy = reqUser?.userId || 'SYSTEM';

    let finalPhotoUrl = dto.photo_url;

    // 1. Handle Multipart File if present
    if (file) {
      const folder = `patients/${patientId}/valuables/`;
      const extension = file.originalname.split('.').pop() || 'png';
      const fileName = `${Date.now()}_valuable.${extension}`;
      const { dbUrl } = await this.storageService.uploadBuffer(
        file.buffer,
        folder,
        fileName,
        file.mimetype,
      );
      finalPhotoUrl = dbUrl;
    }
    // 2. Fallback to Base64 if photo_url is provided as data URI
    else if (dto.photo_url && dto.photo_url.startsWith('data:')) {
      const folder = `patients/${patientId}/valuables/`;
      const fileName = `${Date.now()}_valuable.png`;
      const { dbUrl } = await this.storageService.uploadBase64(
        dto.photo_url,
        folder,
        fileName,
      );
      finalPhotoUrl = dbUrl;
    }

    const valuable = this.valuableRepo.create({
      patient_id: patientId,
      description: dto.description,
      photo_url: finalPhotoUrl,
      location_type: dto.location_type,
      gps_lat: dto.gps_lat,
      gps_lon: dto.gps_lon,
      logged_by_id: recordedBy,
      timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
    });

    const saved = await this.valuableRepo.save(valuable);

    try {
      await this.auditLogService.log({
        userId: recordedBy,
        action: 'PATIENT_VALUABLE_LOGGED',
        ipAddress: ip || '0.0.0.0',
        metadata: { patientId, valuableId: saved.id },
      });
    } catch (e) {
      // ignore
    }

    // Attach signed URL if it's an S3 link
    let readUrl = saved.photo_url;
    if (saved.photo_url && saved.photo_url.includes('s3')) {
      readUrl = await this.storageService.generatePresignedGetUrl(
        saved.photo_url,
      );
    }

    return { data: { ...saved, photo_url: readUrl } };
  }

  async getValuables(patientId: string, reqUser: any) {
    await this.findOneWithIsolation(patientId, reqUser);

    const records = await this.valuableRepo.find({
      where: { patient_id: patientId },
      order: { timestamp: 'DESC' },
    });

    const data = await Promise.all(
      records.map(async (record) => {
        if (
          record.photo_url &&
          record.photo_url.includes('s3') &&
          !record.photo_url.includes('X-Amz-Algorithm')
        ) {
          record.photo_url = await this.storageService.generatePresignedGetUrl(
            record.photo_url,
          );
        }
        return record;
      }),
    );

    return { data };
  }
}
