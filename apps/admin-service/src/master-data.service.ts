import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { 
  SymptomMaster, 
  IncidentCategoryMaster, 
  InventoryItemMaster, 
  Hospital,
  AuditLogService 
} from '@app/common';
import { 
  CreateSymptomDto, 
  CreateIncidentCategoryDto, 
  CreateInventoryItemDto,
  UpdateHospitalMasterDto
} from './dto/master-data.dto';
import { RegisterHospitalDto } from './dto/register-hospital.dto';
import { AuthService } from '../../auth-service/src/auth.service';

@Injectable()
export class MasterDataService {
  constructor(
    @InjectRepository(SymptomMaster)
    private readonly symptomRepo: Repository<SymptomMaster>,
    @InjectRepository(IncidentCategoryMaster)
    private readonly categoryRepo: Repository<IncidentCategoryMaster>,
    @InjectRepository(InventoryItemMaster)
    private readonly inventoryRepo: Repository<InventoryItemMaster>,
    @InjectRepository(Hospital)
    private readonly hospitalRepo: Repository<Hospital>,
    private readonly auditLogService: AuditLogService,
    private readonly authService: AuthService,
  ) {}

  // --- Symptom Master ---

  async createSymptom(dto: CreateSymptomDto, adminId: string, ip: string) {
    const symptom = this.symptomRepo.create(dto);
    await this.symptomRepo.save(symptom);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_SYMPTOM_CREATED',
      ipAddress: ip,
      metadata: { symptomId: symptom.id, names: dto.names },
    });

    return symptom;
  }

  async findAllSymptoms() {
    return this.symptomRepo.find({ order: { createdAt: 'DESC' } });
  }

  // --- Incident Category Master ---

  async createCategory(dto: CreateIncidentCategoryDto, adminId: string, ip: string) {
    const existing = await this.categoryRepo.findOneBy({ id: dto.id });
    if (existing) throw new ConflictException(`Category with ID ${dto.id} already exists`);

    const category = this.categoryRepo.create(dto);
    await this.categoryRepo.save(category);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_CATEGORY_CREATED',
      ipAddress: ip,
      metadata: { categoryId: dto.id, name: dto.name },
    });

    return category;
  }

  async findAllCategories() {
    return this.categoryRepo.find({ order: { name: 'ASC' } });
  }

  // --- Inventory Item Master ---

  async createInventoryItem(dto: CreateInventoryItemDto, adminId: string, ip: string) {
    const item = this.inventoryRepo.create(dto);
    await this.inventoryRepo.save(item);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_INVENTORY_ITEM_CREATED',
      ipAddress: ip,
      metadata: { itemId: item.id, name: dto.name },
    });

    return item;
  }

  async findAllInventoryItems() {
    return this.inventoryRepo.find({ order: { name: 'ASC' } });
  }

  // --- Hospital Specialty Mapping ---

  async updateHospitalMaster(id: string, dto: UpdateHospitalMasterDto, adminId: string, ip: string) {
    const hospital = await this.hospitalRepo.findOneBy({ id });
    if (!hospital) throw new NotFoundException(`Hospital with ID ${id} not found`);

    Object.assign(hospital, dto);
    await this.hospitalRepo.save(hospital);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_HOSPITAL_UPDATED',
      ipAddress: ip,
      metadata: { hospitalId: id, updates: dto },
    });

    return hospital;
  }

  // --- Unified Registration ---

  async registerHospitalWithAdmin(dto: RegisterHospitalDto, creator: any, ip: string) {
    // 1. Create the Hospital
    const hospital = this.hospitalRepo.create(dto.hospital);
    await this.hospitalRepo.save(hospital);

    // 2. Create the Admin User for this Hospital
    const adminUser = await this.authService.createUser({
      ...dto.admin,
      role: 'Hospital Admin',
      org_id: hospital.id,
    }, creator);

    await this.auditLogService.log({
      userId: creator.userId,
      action: 'HOSPITAL_REGISTERED_WITH_ADMIN',
      ipAddress: ip,
      metadata: { hospitalId: hospital.id, adminId: adminUser.id },
    });

    return {
      hospital,
      admin: {
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        roles: adminUser.roles,
      }
    };
  }
}
