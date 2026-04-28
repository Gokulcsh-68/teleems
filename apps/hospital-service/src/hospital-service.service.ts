import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hospital, AuditLogService } from '@app/common';
import { CreateHospitalDto, UpdateHospitalDto } from './dto/hospital.dto';

@Injectable()
export class HospitalServiceService {
  constructor(
    @InjectRepository(Hospital)
    private readonly hospitalRepo: Repository<Hospital>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createHospital(dto: CreateHospitalDto, adminId: string, ip: string) {
    const hospital = await this.hospitalRepo.save(
      this.hospitalRepo.create(dto),
    );

    await this.auditLogService.log({
      userId: adminId,
      action: 'HOSPITAL_CREATED',
      ipAddress: ip,
      metadata: { hospitalId: hospital.id, name: hospital.name },
    });

    return hospital;
  }

  async findAll() {
    return this.hospitalRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const hospital = await this.hospitalRepo.findOneBy({ id });
    if (!hospital)
      throw new NotFoundException(`Hospital with ID ${id} not found`);
    return hospital;
  }

  async update(
    id: string,
    dto: UpdateHospitalDto,
    adminId: string,
    ip: string,
  ) {
    const hospital = await this.findOne(id);
    Object.assign(hospital, dto);
    await this.hospitalRepo.save(hospital);

    await this.auditLogService.log({
      userId: adminId,
      action: 'HOSPITAL_UPDATED',
      ipAddress: ip,
      metadata: { hospitalId: id, updates: dto },
    });

    return hospital;
  }

  async remove(id: string, adminId: string, ip: string) {
    const hospital = await this.findOne(id);
    hospital.status = 'INACTIVE';
    await this.hospitalRepo.save(hospital);

    await this.auditLogService.log({
      userId: adminId,
      action: 'HOSPITAL_DEACTIVATED',
      ipAddress: ip,
      metadata: { hospitalId: id },
    });

    return { message: `Hospital ${id} deactivated successfully` };
  }
}
