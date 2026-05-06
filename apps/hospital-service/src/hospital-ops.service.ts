import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hospital, HospitalStatus, AuditLogService, Dispatch } from '@app/common';
import { In, Not } from 'typeorm';

@Injectable()
export class HospitalOpsService {
  constructor(
    @InjectRepository(Hospital)
    private readonly hospitalRepo: Repository<Hospital>,
    @InjectRepository(HospitalStatus)
    private readonly statusRepo: Repository<HospitalStatus>,
    @InjectRepository(Dispatch)
    private readonly dispatchRepo: Repository<Dispatch>,
    private readonly auditLogService: AuditLogService,
  ) {}

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

  async getDashboard(hospitalId: string) {
    const hospital = await this.hospitalRepo.findOneBy({ id: hospitalId });
    if (!hospital)
      throw new NotFoundException(`Hospital ${hospitalId} not found`);

    const status = await this.getStatus(hospitalId);

    // Fetch incoming incidents (Dispatches bound for this hospital)
    const incomingDispatches = await this.dispatchRepo.find({
      where: {
        destination_hospital_id: hospitalId,
        status: Not(In(['COMPLETED', 'CANCELLED'])),
      },
      relations: ['incident'],
      order: { dispatched_at: 'DESC' },
    });

    return {
      hospital: {
        id: hospital.id,
        name: hospital.name,
        type: hospital.type,
        district: hospital.district,
        specialties: hospital.specialties,
      },
      status,
      incoming_incidents: incomingDispatches.map((d) => ({
        dispatch_id: d.id,
        incident_id: d.incident_id,
        status: d.status,
        eta_seconds: d.eta_seconds,
        category: d.incident?.category,
        severity: d.incident?.severity,
        patients: d.incident?.patients,
        dispatched_at: d.dispatched_at,
      })),
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
