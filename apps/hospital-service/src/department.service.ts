import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Department, Hospital, AuditLogService } from '@app/common';
import { CreateDepartmentDto, UpdateDepartmentDto, DepartmentQueryDto } from './dto/department.dto';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(Hospital)
    private readonly hospitalRepo: Repository<Hospital>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(dto: CreateDepartmentDto, user: any, ip: string) {
    const hospital = await this.hospitalRepo.findOneBy({ id: dto.hospitalId });
    if (!hospital) {
      throw new NotFoundException(`Hospital with ID ${dto.hospitalId} not found`);
    }

    // Permission check: Hospital Admin must belong to the hospital
    const userHospitalId = user.hospitalId || user.organisationId;
    if (!user.roles.includes('CURESELECT_ADMIN') && userHospitalId !== dto.hospitalId) {
      throw new ForbiddenException('Access denied: You can only manage departments for your own hospital');
    }

    const department = await this.departmentRepo.save(this.departmentRepo.create(dto));

    await this.auditLogService.log({
      userId: user.id,
      action: 'DEPARTMENT_CREATED',
      ipAddress: ip,
      metadata: { departmentId: department.id, name: department.name, hospitalId: dto.hospitalId },
    });

    return department;
  }

  async findAll(query: DepartmentQueryDto) {
    const { hospitalId, search } = query;
    const where: any = {};

    if (hospitalId) {
      where.hospitalId = hospitalId;
    }

    if (search) {
      where.name = Like(`%${search}%`);
      // You can also search by headOfDepartment if needed
    }

    return this.departmentRepo.find({
      where,
      order: { name: 'ASC' },
      relations: ['hospital'],
    });
  }

  async findOne(id: string) {
    const department = await this.departmentRepo.findOne({
      where: { id },
      relations: ['hospital'],
    });
    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }
    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto, user: any, ip: string) {
    const department = await this.findOne(id);

    // Permission check
    const userHospitalId = user.hospitalId || user.organisationId;
    if (!user.roles.includes('CURESELECT_ADMIN') && userHospitalId !== department.hospitalId) {
      throw new ForbiddenException('Access denied: You can only manage departments for your own hospital');
    }

    Object.assign(department, dto);
    await this.departmentRepo.save(department);

    await this.auditLogService.log({
      userId: user.id,
      action: 'DEPARTMENT_UPDATED',
      ipAddress: ip,
      metadata: { departmentId: id, updates: dto },
    });

    return department;
  }

  async remove(id: string, user: any, ip: string) {
    const department = await this.findOne(id);

    // Permission check
    const userHospitalId = user.hospitalId || user.organisationId;
    if (!user.roles.includes('CURESELECT_ADMIN') && userHospitalId !== department.hospitalId) {
      throw new ForbiddenException('Access denied: You can only manage departments for your own hospital');
    }

    await this.departmentRepo.remove(department);

    await this.auditLogService.log({
      userId: user.id,
      action: 'DEPARTMENT_DELETED',
      ipAddress: ip,
      metadata: { departmentId: id, name: department.name },
    });

    return { message: `Department ${department.name} deleted successfully` };
  }
}
