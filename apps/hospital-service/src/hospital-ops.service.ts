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

  async admitPatient(hospitalId: string, dto: { patientId: string; departmentId: string; bedType: string; bedNumber?: string }, userId: string, ip: string) {
    const department = await this.departmentRepo.findOneBy({ id: dto.departmentId, hospitalId });
    if (!department) throw new NotFoundException('Department not found in this hospital');

    // 1. Check Capacity
    const status = await this.getStatus(hospitalId);
    const bedType = dto.bedType.toLowerCase() as 'icu' | 'general' | 'isolation';
    
    if (status.beds[bedType].available <= 0) {
       throw new BadRequestException(`No available ${bedType} beds in the hospital`);
    }

    // 2. Create Admission Record
    const admission = this.admissionRepo.create({
      patient_id: dto.patientId,
      hospital_id: hospitalId,
      department_id: dto.departmentId,
      bed_type: bedType,
      bed_number: dto.bedNumber,
      status: AdmissionStatus.ADMITTED,
      admitted_by_id: userId,
    });

    await this.admissionRepo.save(admission);

    // 3. Update Hospital-wide Capacity
    status.beds[bedType].available -= 1;
    await this.statusRepo.save(status);

    // 4. Update Department-specific Occupancy
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

    // 2. Update Hospital-wide Capacity
    const status = await this.getStatus(hospitalId);
    const bedType = admission.bed_type.toLowerCase() as 'icu' | 'general' | 'isolation';
    
    // Increment available beds (making sure we don't exceed capacity, though usually we just add back)
    status.beds[bedType].available += 1;
    await this.statusRepo.save(status);

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

    const data = items.map((d) => ({
      dispatch_id: d.id,
      incident_id: d.incident_id,
      status: d.status,
      eta_seconds: d.eta_seconds,
      category: d.incident?.category,
      severity: d.incident?.severity,
      patients: d.incident?.patients,
      dispatched_at: d.dispatched_at,
    }));

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
