import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hospital, HospitalStatus, AuditLogService, Dispatch, Admission, Department, PatientProfile, AdmissionStatus } from '@app/common';
import { In, Not } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

@Injectable()
export class HospitalOpsService {
  constructor(
    @InjectRepository(Hospital)
    private readonly hospitalRepo: Repository<Hospital>,
    @InjectRepository(HospitalStatus)
    private readonly statusRepo: Repository<HospitalStatus>,
    @InjectRepository(Dispatch)
    private readonly dispatchRepo: Repository<Dispatch>,
    @InjectRepository(Admission)
    private readonly admissionRepo: Repository<Admission>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(PatientProfile)
    private readonly patientRepo: Repository<PatientProfile>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async admitPatient(hospitalId: string, dto: { patientId: string; departmentId: string; bedType?: string; bedNumber?: string }, userId: string, ip: string) {
    const department = await this.departmentRepo.findOneBy({ id: dto.departmentId, hospitalId });
    if (!department) throw new NotFoundException('Department not found in this hospital');

    let patient = await this.patientRepo.findOneBy({ id: dto.patientId });
    
    if (!patient) {
      // If patient profile doesn't exist, try to find them in incoming dispatches for this hospital
      const dispatch = await this.dispatchRepo.createQueryBuilder('dispatch')
        .leftJoinAndSelect('dispatch.incident', 'incident')
        .where('dispatch.destination_hospital_id = :hospitalId', { hospitalId })
        .andWhere('incident.patients @> :patientFilter', { 
          patientFilter: JSON.stringify([{ id: dto.patientId }]) 
        })
        .getOne();

      if (!dispatch || !dispatch.incident) {
        throw new NotFoundException('Patient record not found in system or incoming dispatches');
      }

      // Find the specific patient data in the incident JSON
      const patientData = dispatch.incident.patients.find(p => p.id === dto.patientId);
      
      // Create a formal PatientProfile record so Admission FK works
      const pData = patientData as any;
      patient = this.patientRepo.create({
        id: dto.patientId,
        name: pData.name,
        age: pData.age,
        gender: pData.gender,
        triage_code: pData.triage_level || pData.triage_code || 'WHITE',
        incident_id: dispatch.incident_id,
        trip_id: dispatch.id,
        organisationId: dispatch.organisationId
      });
      await this.patientRepo.save(patient);
    }

    const bedType = dto.bedType ? dto.bedType.toLowerCase() as 'icu' | 'general' | 'isolation' : null;

    // 1. Check Hospital-wide Capacity (only if bedType is specified)
    if (bedType) {
      const status = await this.getStatus(hospitalId);
      if (status.beds[bedType]?.available <= 0) {
        throw new BadRequestException(`No available ${bedType} beds in the hospital`);
      }
      // Update Hospital-wide Capacity
      status.beds[bedType].available -= 1;
      await this.statusRepo.save(status);
    }

    // 2. Create Admission Record
    const admission = new Admission();
    admission.patient_id = dto.patientId;
    admission.hospital_id = hospitalId;
    admission.department_id = dto.departmentId;
    admission.bed_type = bedType;
    admission.bed_number = dto.bedNumber || null;
    admission.status = AdmissionStatus.ADMITTED;
    admission.admitted_by_id = userId;

    await this.admissionRepo.save(admission);

    // 3. Update Department-specific Occupancy
    department.occupiedBeds += 1;
    await this.departmentRepo.save(department);

    await this.auditLogService.log({
      userId,
      action: 'PATIENT_ADMITTED',
      ipAddress: ip,
      metadata: { admissionId: admission.id, patientId: dto.patientId, departmentId: dto.departmentId },
    });

    return admission;

  }

  async dischargePatient(hospitalId: string, admissionId: string, userId: string, ip: string) {
    const admission = await this.admissionRepo.findOne({
      where: { id: admissionId, hospital_id: hospitalId },
    });

    if (!admission) throw new NotFoundException('Admission record not found');
    if (admission.status === AdmissionStatus.DISCHARGED) {
      throw new BadRequestException('Patient is already discharged');
    }

    // 1. Update Admission Record
    admission.status = AdmissionStatus.DISCHARGED;
    admission.discharged_at = new Date();
    await this.admissionRepo.save(admission);

    // 2. Update Hospital-wide Capacity (only if bed_type was set)
    if (admission.bed_type) {
      const status = await this.getStatus(hospitalId);
      const bedType = admission.bed_type.toLowerCase() as 'icu' | 'general' | 'isolation';
      status.beds[bedType].available += 1;
      await this.statusRepo.save(status);
    }

    // 3. Update Department-specific Occupancy
    const department = await this.departmentRepo.findOneBy({ id: admission.department_id, hospitalId });
    if (department) {
      department.occupiedBeds = Math.max(0, department.occupiedBeds - 1);
      await this.departmentRepo.save(department);
    }

    await this.auditLogService.log({
      userId,
      action: 'PATIENT_DISCHARGED',
      ipAddress: ip,
      metadata: { admissionId, patientId: admission.patient_id, departmentId: admission.department_id },
    });

    return { message: 'Patient discharged successfully', admission };
  }

  async getAdmissions(hospitalId: string, page = 1, limit = 10) {
    const [items, total] = await this.admissionRepo.findAndCount({
      where: { hospital_id: hospitalId, status: AdmissionStatus.ADMITTED },
      relations: ['patient', 'department'],
      order: { admitted_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      meta: {
        total_count: total,
        page,
        per_page: limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // --- Bed & Resource Tracking (Spec 6.2) ---

  async getStatus(hospitalId: string) {
    let status = await this.statusRepo.findOneBy({ hospitalId });
    if (!status) {
      // Auto-initialize if first access
      status = this.statusRepo.create({ hospitalId });
      await this.statusRepo.save(status);
    }
    return status;
  }

  async updateStatus(
    hospitalId: string,
    dto: { beds?: any; equipment?: any; systemStatus?: string },
    userId: string,
    ip: string,
  ) {
    let status = await this.statusRepo.findOneBy({ hospitalId });
    if (!status) {
      status = this.statusRepo.create({ hospitalId });
    }

    if (dto.beds) status.beds = { ...status.beds, ...dto.beds };
    if (dto.equipment)
      status.equipment = { ...status.equipment, ...dto.equipment };
    if (dto.systemStatus) status.systemStatus = dto.systemStatus as any;
    status.updatedBy = userId;

    await this.statusRepo.save(status);

    await this.auditLogService.log({
      userId,
      action: 'HOSPITAL_STATUS_UPDATED',
      ipAddress: ip,
      metadata: { hospitalId, updates: dto },
    });

    return status;
  }

  // --- Hospital Dashboard Summary ---

  async getDashboard(
    hospitalId: string,
    filters: { status?: string; severity?: string; category?: string } = {},
  ) {
    const hospital = await this.hospitalRepo.findOneBy({ id: hospitalId });
    if (!hospital)
      throw new NotFoundException(`Hospital ${hospitalId} not found`);

    const status = await this.getStatus(hospitalId);
    const incomingIncidents = await this.getIncoming(hospitalId, filters);

    return {
      hospital: {
        id: hospital.id,
        name: hospital.name,
        type: hospital.type,
        district: hospital.district,
        specialties: hospital.specialties,
      },
      status,
      incoming_incidents: incomingIncidents,
    };
  }

  async getIncoming(
    hospitalId: string,
    filters: {
      status?: string;
      severity?: string;
      category?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    // Build query for incoming incidents
    const queryBuilder = this.dispatchRepo
      .createQueryBuilder('dispatch')
      .leftJoinAndSelect('dispatch.incident', 'incident')
      .where('dispatch.destination_hospital_id = :hospitalId', { hospitalId })
      .andWhere('dispatch.status NOT IN (:...excludedStatuses)', {
        excludedStatuses: ['COMPLETED', 'CANCELLED'],
      });

    if (filters.status) {
      queryBuilder.andWhere('dispatch.status = :status', {
        status: filters.status,
      });
    }

    if (filters.severity) {
      // Check both incident.severity AND if any patient has matching triage_level
      queryBuilder.andWhere(
        '(incident.severity = :severity OR incident.patients @> :triageFilter)',
        {
          severity: filters.severity,
          triageFilter: JSON.stringify([{ triage_level: filters.severity }]),
        },
      );
    }

    if (filters.category) {
      queryBuilder.andWhere('incident.category = :category', {
        category: filters.category,
      });
    }

    const [items, total] = await queryBuilder
      .orderBy('dispatch.dispatched_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // 1. Collect all patient IDs from the incidents
    const patientIds = items.flatMap(d => d.incident?.patients?.map(p => p.id) || []);

    // 2. Fetch active/recent admissions for these patients at this hospital
    const admissions = patientIds.length > 0 
      ? await this.admissionRepo.find({
          where: { 
            patient_id: In(patientIds),
            hospital_id: hospitalId 
          },
          relations: ['department'],
          order: { admitted_at: 'DESC' }
        })
      : [];

    // 3. Map admissions by patient_id for quick lookup
    const admissionMap = new Map();
    admissions.forEach(a => {
      if (!admissionMap.has(a.patient_id)) {
        admissionMap.set(a.patient_id, a);
      }
    });

    const data = items.map((d) => {
      const enrichedPatients = d.incident?.patients?.map(p => {
        const admission = admissionMap.get(p.id);
        return {
          ...p,
          admission_status: admission?.status || null,
          department_name: admission?.department?.name || null,
          admitted_at: admission?.admitted_at || null,
          discharged_at: admission?.discharged_at || null
        };
      }) || [];

      // Determine top-level status based on patient admissions
      let displayStatus = d.status;
      const hasAdmitted = enrichedPatients.some(p => p.admission_status === 'ADMITTED');
      const allDischarged = enrichedPatients.length > 0 && enrichedPatients.every(p => p.admission_status === 'DISCHARGED');

      if (hasAdmitted) {
        displayStatus = 'ADMITTED';
      } else if (allDischarged) {
        displayStatus = 'DISCHARGED';
      }

      return {
        dispatch_id: d.id,
        incident_id: d.incident_id,
        status: displayStatus,
        eta_seconds: d.eta_seconds,
        category: d.incident?.category,
        severity: d.incident?.severity,
        patients: enrichedPatients,
        dispatched_at: d.dispatched_at,
      };
    });

    return {
      items: data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getProfile(hospitalId: string) {
    const hospital = await this.hospitalRepo.findOneBy({ id: hospitalId });
    if (!hospital)
      throw new NotFoundException(`Hospital ${hospitalId} not found`);
    return hospital;
  }

  async updateProfile(hospitalId: string, dto: any, userId: string, ip: string) {
    const hospital = await this.getProfile(hospitalId);

    // Remove sensitive or restricted fields from dto
    delete dto.id;
    delete dto.createdAt;
    delete dto.updatedAt;

    Object.assign(hospital, dto);

    await this.hospitalRepo.save(hospital);

    await this.auditLogService.log({
      userId,
      action: 'HOSPITAL_PROFILE_SELF_UPDATED',
      ipAddress: ip,
      metadata: { hospitalId, updates: dto },
    });

    return hospital;
  }
}
