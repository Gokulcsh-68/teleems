import {
  Injectable,
  NotFoundException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SymptomMaster,
  IncidentCategoryMaster,
  InventoryItemMaster,
  Hospital,
  IcdMaster,
  AllergyMaster,
  MedicationMaster,
  SurgeryMaster,
  HospitalisationMaster,
  ChiefComplaintMaster,
  InterventionMaster,
  MedicationRouteMaster,
  AuditLogService,
  COMMON_ICD10_CODES,
  COMMON_ALLERGENS,
  COMMON_MEDICATIONS,
  COMMON_SURGERIES,
  COMMON_HOSPITALISATION_REASONS,
  COMMON_CHIEF_COMPLAINTS,
  COMMON_INTERVENTIONS,
  COMMON_MEDICATION_ROUTES,
  COMMON_ACUTE_MEDICATIONS,
  COMMON_INCIDENT_CATEGORIES,
  PaginatedResponse,
} from '@app/common';
import {
  CreateSymptomDto,
  CreateIncidentCategoryDto,
  CreateInventoryItemDto,
  UpdateHospitalMasterDto,
  MasterQueryDto,
  CreateAllergenDto,
  CreateMedicationDto,
  CreateSurgeryDto,
  CreateHospitalisationReasonDto,
  CreateChiefComplaintDto,
  CreateInterventionMasterDto,
  CreateMedicationRouteDto,
  UpdateIncidentCategoryDto,
} from './dto/master-data.dto';
import { ILike } from 'typeorm';
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
    @InjectRepository(IcdMaster)
    private readonly icdRepo: Repository<IcdMaster>,
    @InjectRepository(AllergyMaster)
    private readonly allergyRepo: Repository<AllergyMaster>,
    @InjectRepository(MedicationMaster)
    private readonly medicationRepo: Repository<MedicationMaster>,
    @InjectRepository(SurgeryMaster)
    private readonly surgeryRepo: Repository<SurgeryMaster>,
    @InjectRepository(HospitalisationMaster)
    private readonly hospitalisationRepo: Repository<HospitalisationMaster>,
    @InjectRepository(MedicationRouteMaster)
    private readonly routeRepo: Repository<MedicationRouteMaster>,
    @InjectRepository(ChiefComplaintMaster)
    private readonly complaintRepo: Repository<ChiefComplaintMaster>,
    @InjectRepository(InterventionMaster)
    private readonly interventionMasterRepo: Repository<InterventionMaster>,
    private readonly auditLogService: AuditLogService,
    private readonly authService: AuthService,
  ) {}

  async onModuleInit() {
    await this.seedIcdCodes();
    await this.seedAllergens();
    await this.seedMedications();
    await this.seedSurgeries();
    await this.seedHospitalisations();
    await this.seedChiefComplaints();
    await this.seedInterventionMasters();
    await this.seedAcuteMedications();
    await this.seedMedicationRoutes();
    await this.seedIncidentCategories();
  }

  private async seedIcdCodes() {
    console.log('[SEED] Synchronizing ICD-10 Master Registry...');
    let count = 0;
    for (const codeDef of COMMON_ICD10_CODES) {
      const existing = await this.icdRepo.findOneBy({ code: codeDef.code });
      if (!existing) {
        await this.icdRepo.save(this.icdRepo.create(codeDef));
        count++;
      }
    }
    console.log(`[SEED] Success: Added ${count} new ICD codes to registry.`);
  }

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

  async findAllSymptoms(query: MasterQueryDto) {
    const { page = 1, limit = 50, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.names = ILike(`%${search}%`);
    }

    const [data, total] = await this.symptomRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });

    return new PaginatedResponse(
      data,
      null,
      total,
      limit,
      data.length,
      page,
      Math.ceil(total / limit),
    );
  }

  // --- Incident Category Master ---

  async createCategory(
    dto: CreateIncidentCategoryDto,
    adminId: string,
    ip: string,
  ) {
    const existing = await this.categoryRepo.findOneBy({ id: dto.id });
    if (existing)
      throw new ConflictException(`Category with ID ${dto.id} already exists`);

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

  async findAllCategories(query: MasterQueryDto) {
    const { page = 1, limit = 50, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.name = ILike(`%${search}%`);
    }

    const [data, total] = await this.categoryRepo.findAndCount({
      where,
      order: { name: 'ASC' },
      take: limit,
      skip,
    });

    return new PaginatedResponse(
      data,
      null,
      total,
      limit,
      data.length,
      page,
      Math.ceil(total / limit),
    );
  }

  async updateCategory(
    id: string,
    dto: UpdateIncidentCategoryDto,
    adminId: string,
    ip: string,
  ) {
    const category = await this.categoryRepo.findOneBy({ id });
    if (!category)
      throw new NotFoundException(`Category with ID ${id} not found`);

    Object.assign(category, dto);
    await this.categoryRepo.save(category);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_CATEGORY_UPDATED',
      ipAddress: ip,
      metadata: { categoryId: id, updates: dto },
    });

    return category;
  }

  async toggleCategoryStatus(
    id: string,
    isActive: boolean,
    adminId: string,
    ip: string,
  ) {
    const category = await this.categoryRepo.findOneBy({ id });
    if (!category)
      throw new NotFoundException(`Category with ID ${id} not found`);

    category.isActive = isActive;
    await this.categoryRepo.save(category);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_CATEGORY_STATUS_UPDATED',
      ipAddress: ip,
      metadata: { categoryId: id, isActive },
    });

    return category;
  }

  async deleteCategory(id: string, adminId: string, ip: string) {
    const category = await this.categoryRepo.findOneBy({ id });
    if (!category)
      throw new NotFoundException(`Category with ID ${id} not found`);

    await this.categoryRepo.remove(category);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_CATEGORY_DELETED',
      ipAddress: ip,
      metadata: { categoryId: id, name: category.name },
    });

    return { success: true };
  }

  private async seedIncidentCategories() {
    console.log('[SEED] Synchronizing Incident Category Master Registry...');
    let count = 0;
    for (const catDef of COMMON_INCIDENT_CATEGORIES) {
      const existing = await this.categoryRepo.findOneBy({ id: catDef.id });
      if (!existing) {
        await this.categoryRepo.save(this.categoryRepo.create(catDef));
        count++;
      } else {
        // Sync existing categories with default values if they differ
        let changed = false;
        if (existing.description !== catDef.description) {
          existing.description = catDef.description;
          changed = true;
        }
        if (existing.name !== catDef.name) {
          existing.name = catDef.name;
          changed = true;
        }
        if (existing.hex_color !== catDef.hex_color) {
          existing.hex_color = catDef.hex_color;
          changed = true;
        }
        if (changed) {
          await this.categoryRepo.save(existing);
        }
      }
    }
    console.log(`[SEED] Success: Added ${count} new incident categories.`);
  }

  // --- Inventory Item Master ---

  async createInventoryItem(
    dto: CreateInventoryItemDto,
    adminId: string,
    ip: string,
  ) {
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

  async findAllInventoryItems(query: MasterQueryDto) {
    const { page = 1, limit = 50, search, category } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.name = ILike(`%${search}%`);
    }
    if (category) {
      where.category = category;
    }

    const [data, total] = await this.inventoryRepo.findAndCount({
      where,
      order: { name: 'ASC' },
      take: limit,
      skip,
    });

    return new PaginatedResponse(
      data,
      null,
      total,
      limit,
      data.length,
      page,
      Math.ceil(total / limit),
    );
  }

  // --- Hospital Specialty Mapping ---

  async updateHospitalMaster(
    id: string,
    dto: UpdateHospitalMasterDto,
    adminId: string,
    ip: string,
  ) {
    const hospital = await this.hospitalRepo.findOneBy({ id });
    if (!hospital)
      throw new NotFoundException(`Hospital with ID ${id} not found`);

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

  // --- ICD-10 Master ---

  async findAllIcdCodes(query: MasterQueryDto) {
    const {
      page = 1,
      limit = 50,
      search,
      category,
      isCommon,
      isActive,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.description = ILike(`%${search}%`);
      // Optionally search code too
      // where.code = ILike(`%${search}%`);
    }
    if (category) {
      where.category = category;
    }
    if (isCommon !== undefined) {
      where.isCommon = isCommon;
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await this.icdRepo.findAndCount({
      where,
      order: { code: 'ASC' },
      take: limit,
      skip,
    });

    return new PaginatedResponse(
      data,
      null,
      total,
      limit,
      data.length,
      page,
      Math.ceil(total / limit),
    );
  }

  async createIcdCode(dto: any, adminId: string, ip: string) {
    const existing = await this.icdRepo.findOneBy({ code: dto.code });
    if (existing)
      throw new ConflictException(`ICD code ${dto.code} already exists`);

    const icd = this.icdRepo.create({
      code: dto.code,
      description: dto.description,
      category: dto.category,
      isCommon: dto.isCommon,
    });
    await this.icdRepo.save(icd);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_ICD_CODE_CREATED',
      ipAddress: ip,
      metadata: { code: icd.code, description: icd.description },
    });

    return icd;
  }

  async toggleIcdStatus(
    id: string,
    isActive: boolean,
    adminId: string,
    ip: string,
  ) {
    const icd = await this.icdRepo.findOneBy({ id });
    if (!icd) throw new NotFoundException(`ICD record with ID ${id} not found`);

    icd.isActive = isActive;
    await this.icdRepo.save(icd);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_ICD_STATUS_UPDATED',
      ipAddress: ip,
      metadata: { id, code: icd.code, description: icd.description, isActive },
    });

    return icd;
  }

  // --- Allergy Master ---

  private async seedAllergens() {
    console.log('[SEED] Synchronizing Allergy Master Registry...');
    let count = 0;
    for (const allergenDef of COMMON_ALLERGENS) {
      const existing = await this.allergyRepo.findOneBy({
        name: allergenDef.name,
      });
      if (!existing) {
        await this.allergyRepo.save(this.allergyRepo.create(allergenDef));
        count++;
      }
    }
    console.log(`[SEED] Success: Added ${count} new allergens to registry.`);
  }

  async findAllAllergens(query: MasterQueryDto) {
    const {
      page = 1,
      limit = 50,
      search,
      category,
      isCommon,
      isActive,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.name = ILike(`%${search}%`);
    }
    if (category) {
      where.category = category;
    }
    if (isCommon !== undefined) {
      where.isCommon = isCommon;
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await this.allergyRepo.findAndCount({
      where,
      order: { isCommon: 'DESC', name: 'ASC' },
      take: limit,
      skip,
    });

    return new PaginatedResponse(
      data,
      null,
      total,
      limit,
      data.length,
      page,
      Math.ceil(total / limit),
    );
  }

  async createAllergen(dto: CreateAllergenDto, adminId: string, ip: string) {
    const existing = await this.allergyRepo.findOneBy({ name: dto.name });
    if (existing)
      throw new ConflictException(`Allergen ${dto.name} already exists`);

    const allergen = this.allergyRepo.create(dto);
    await this.allergyRepo.save(allergen);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_ALLERGEN_CREATED',
      ipAddress: ip,
      metadata: { name: allergen.name, category: allergen.category },
    });

    return allergen;
  }

  async toggleAllergenStatus(
    id: string,
    isActive: boolean,
    adminId: string,
    ip: string,
  ) {
    const allergen = await this.allergyRepo.findOneBy({ id });
    if (!allergen)
      throw new NotFoundException(`Allergen with ID ${id} not found`);

    allergen.isActive = isActive;
    await this.allergyRepo.save(allergen);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_ALLERGEN_STATUS_UPDATED',
      ipAddress: ip,
      metadata: { id, name: allergen.name, isActive },
    });

    return allergen;
  }

  // --- Medication Master ---

  private async seedMedications() {
    console.log('[SEED] Synchronizing Medication Master Registry...');
    let count = 0;
    for (const medDef of COMMON_MEDICATIONS) {
      const existing = await this.medicationRepo.findOneBy({
        name: medDef.name,
      });
      if (!existing) {
        await this.medicationRepo.save(this.medicationRepo.create(medDef));
        count++;
      }
    }
    console.log(`[SEED] Success: Added ${count} new medications to registry.`);
  }

  async findAllMedications(query: MasterQueryDto) {
    const {
      page = 1,
      limit = 50,
      search,
      category,
      isCommon,
      isActive,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.name = ILike(`%${search}%`);
    }
    if (category) {
      where.category = category;
    }
    if (isCommon !== undefined) {
      where.isCommon = isCommon;
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await this.medicationRepo.findAndCount({
      where,
      order: { isCommon: 'DESC', name: 'ASC' },
      take: limit,
      skip,
    });

    return new PaginatedResponse(
      data,
      null,
      total,
      limit,
      data.length,
      page,
      Math.ceil(total / limit),
    );
  }

  async createMedication(
    dto: CreateMedicationDto,
    adminId: string,
    ip: string,
  ) {
    const existing = await this.medicationRepo.findOneBy({ name: dto.name });
    if (existing)
      throw new ConflictException(`Medication ${dto.name} already exists`);

    const medication = this.medicationRepo.create(dto);
    await this.medicationRepo.save(medication);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_MEDICATION_CREATED',
      ipAddress: ip,
      metadata: { name: medication.name, category: medication.category },
    });

    return medication;
  }

  async toggleMedicationStatus(
    id: string,
    isActive: boolean,
    adminId: string,
    ip: string,
  ) {
    const medication = await this.medicationRepo.findOneBy({ id });
    if (!medication)
      throw new NotFoundException(`Medication with ID ${id} not found`);

    medication.isActive = isActive;
    await this.medicationRepo.save(medication);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_MEDICATION_STATUS_UPDATED',
      ipAddress: ip,
      metadata: { id, name: medication.name, isActive },
    });

    return medication;
  }

  // --- Surgery Master ---

  private async seedSurgeries() {
    console.log('[SEED] Synchronizing Surgery Master Registry...');
    let count = 0;
    for (const surgeryDef of COMMON_SURGERIES) {
      const existing = await this.surgeryRepo.findOneBy({
        name: surgeryDef.name,
      });
      if (!existing) {
        await this.surgeryRepo.save(this.surgeryRepo.create(surgeryDef));
        count++;
      }
    }
    console.log(`[SEED] Success: Added ${count} new surgeries to registry.`);
  }

  async findAllSurgeries(query: MasterQueryDto) {
    const {
      page = 1,
      limit = 50,
      search,
      category,
      isCommon,
      isActive,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.name = ILike(`%${search}%`);
    }
    if (category) {
      where.category = category;
    }
    if (isCommon !== undefined) {
      where.isCommon = isCommon;
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await this.surgeryRepo.findAndCount({
      where,
      order: { isCommon: 'DESC', name: 'ASC' },
      take: limit,
      skip,
    });

    return new PaginatedResponse(
      data,
      null,
      total,
      limit,
      data.length,
      page,
      Math.ceil(total / limit),
    );
  }

  async createSurgery(dto: CreateSurgeryDto, adminId: string, ip: string) {
    const existing = await this.surgeryRepo.findOneBy({ name: dto.name });
    if (existing)
      throw new ConflictException(`Surgery ${dto.name} already exists`);

    const surgery = this.surgeryRepo.create(dto);
    await this.surgeryRepo.save(surgery);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_SURGERY_CREATED',
      ipAddress: ip,
      metadata: { name: surgery.name, category: surgery.category },
    });

    return surgery;
  }

  async toggleSurgeryStatus(
    id: string,
    isActive: boolean,
    adminId: string,
    ip: string,
  ) {
    const surgery = await this.surgeryRepo.findOneBy({ id });
    if (!surgery)
      throw new NotFoundException(`Surgery with ID ${id} not found`);

    surgery.isActive = isActive;
    await this.surgeryRepo.save(surgery);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_SURGERY_STATUS_UPDATED',
      ipAddress: ip,
      metadata: { id, name: surgery.name, isActive },
    });

    return surgery;
  }

  // --- Hospitalisation Master ---

  private async seedHospitalisations() {
    console.log('[SEED] Synchronizing Hospitalisation Master Registry...');
    let count = 0;
    for (const reasonDef of COMMON_HOSPITALISATION_REASONS) {
      const existing = await this.hospitalisationRepo.findOneBy({
        reason: reasonDef.reason,
      });
      if (!existing) {
        await this.hospitalisationRepo.save(
          this.hospitalisationRepo.create(reasonDef),
        );
        count++;
      }
    }
    console.log(
      `[SEED] Success: Added ${count} new hospitalisation reasons to registry.`,
    );
  }

  async findAllHospitalisations(query: MasterQueryDto) {
    const {
      page = 1,
      limit = 50,
      search,
      category,
      isCommon,
      isActive,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.reason = ILike(`%${search}%`);
    }
    if (category) {
      where.category = category;
    }
    if (isCommon !== undefined) {
      where.isCommon = isCommon;
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await this.hospitalisationRepo.findAndCount({
      where,
      order: { isCommon: 'DESC', reason: 'ASC' },
      take: limit,
      skip,
    });

    return new PaginatedResponse(
      data,
      null,
      total,
      limit,
      data.length,
      page,
      Math.ceil(total / limit),
    );
  }

  async createHospitalisationReason(
    dto: CreateHospitalisationReasonDto,
    adminId: string,
    ip: string,
  ) {
    const existing = await this.hospitalisationRepo.findOneBy({
      reason: dto.reason,
    });
    if (existing)
      throw new ConflictException(
        `Hospitalisation reason ${dto.reason} already exists`,
      );

    const reason = this.hospitalisationRepo.create(dto);
    await this.hospitalisationRepo.save(reason);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_HOSPITALISATION_REASON_CREATED',
      ipAddress: ip,
      metadata: { reason: reason.reason, category: reason.category },
    });

    return reason;
  }

  async toggleHospitalisationStatus(
    id: string,
    isActive: boolean,
    adminId: string,
    ip: string,
  ) {
    const reason = await this.hospitalisationRepo.findOneBy({ id });
    if (!reason)
      throw new NotFoundException(
        `Hospitalisation reason with ID ${id} not found`,
      );

    reason.isActive = isActive;
    await this.hospitalisationRepo.save(reason);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_HOSPITALISATION_REASON_STATUS_UPDATED',
      ipAddress: ip,
      metadata: { id, reason: reason.reason, isActive },
    });

    return reason;
  }

  // --- Chief Complaint Master ---

  private async seedChiefComplaints() {
    console.log('[SEED] Synchronizing Chief Complaint Master Registry...');
    let count = 0;
    for (const def of COMMON_CHIEF_COMPLAINTS) {
      const existing = await this.complaintRepo.findOneBy({ name: def.name });
      if (!existing) {
        await this.complaintRepo.save(this.complaintRepo.create(def));
        count++;
      }
    }
    console.log(`[SEED] Success: Added ${count} new chief complaints.`);
  }

  async findAllChiefComplaints(query: MasterQueryDto) {
    const { page = 1, limit = 50, search, isActive } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) where.name = ILike(`%${search}%`);
    if (isActive !== undefined) where.isActive = isActive;

    const [data, total] = await this.complaintRepo.findAndCount({
      where,
      order: { isCommon: 'DESC', name: 'ASC' },
      take: limit,
      skip,
    });

    return new PaginatedResponse(
      data,
      null,
      total,
      limit,
      data.length,
      page,
      Math.ceil(total / limit),
    );
  }

  async createChiefComplaint(
    dto: CreateChiefComplaintDto,
    adminId: string,
    ip: string,
  ) {
    const existing = await this.complaintRepo.findOneBy({ name: dto.name });
    if (existing) throw new ConflictException('Chief complaint already exists');

    const complaint = this.complaintRepo.create(dto);
    await this.complaintRepo.save(complaint);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_CHIEF_COMPLAINT_CREATED',
      ipAddress: ip,
      metadata: { complaintId: complaint.id, name: dto.name },
    });

    return complaint;
  }

  async toggleChiefComplaintStatus(
    id: string,
    isActive: boolean,
    adminId: string,
    ip: string,
  ) {
    const complaint = await this.complaintRepo.findOneBy({ id });
    if (!complaint) throw new NotFoundException('Chief complaint not found');

    complaint.isActive = isActive;
    await this.complaintRepo.save(complaint);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_CHIEF_COMPLAINT_STATUS_UPDATED',
      ipAddress: ip,
      metadata: { id, isActive },
    });

    return complaint;
  }

  // --- Intervention Master ---

  private async seedInterventionMasters() {
    console.log('[SEED] Synchronizing Intervention Master Registry...');
    let count = 0;
    for (const def of COMMON_INTERVENTIONS) {
      const existing = await this.interventionMasterRepo.findOneBy({
        name: def.name,
      });
      if (!existing) {
        await this.interventionMasterRepo.save(
          this.interventionMasterRepo.create(def),
        );
        count++;
      }
    }
    console.log(`[SEED] Success: Added ${count} new interventions.`);
  }

  async findAllInterventionMasters(query: MasterQueryDto) {
    const { page = 1, limit = 50, search, isActive } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) where.name = ILike(`%${search}%`);
    if (isActive !== undefined) where.isActive = isActive;

    const [data, total] = await this.interventionMasterRepo.findAndCount({
      where,
      order: { isCommon: 'DESC', name: 'ASC' },
      take: limit,
      skip,
    });

    return new PaginatedResponse(
      data,
      null,
      total,
      limit,
      data.length,
      page,
      Math.ceil(total / limit),
    );
  }

  async createInterventionMaster(
    dto: CreateInterventionMasterDto,
    adminId: string,
    ip: string,
  ) {
    const existing = await this.interventionMasterRepo.findOneBy({
      name: dto.name,
    });
    if (existing) throw new ConflictException('Intervention already exists');

    const intervention = this.interventionMasterRepo.create(dto);
    await this.interventionMasterRepo.save(intervention);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_INTERVENTION_CREATED',
      ipAddress: ip,
      metadata: { id: intervention.id, name: dto.name },
    });

    return intervention;
  }

  async toggleInterventionMasterStatus(
    id: string,
    isActive: boolean,
    adminId: string,
    ip: string,
  ) {
    const intervention = await this.interventionMasterRepo.findOneBy({ id });
    if (!intervention)
      throw new NotFoundException('Intervention master not found');

    intervention.isActive = isActive;
    await this.interventionMasterRepo.save(intervention);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_INTERVENTION_STATUS_UPDATED',
      ipAddress: ip,
      metadata: { id, isActive },
    });

    return intervention;
  }

  // --- Medication Route Master ---

  private async seedMedicationRoutes() {
    console.log('[SEED] Synchronizing Medication Route Master Registry...');
    let count = 0;
    for (const def of COMMON_MEDICATION_ROUTES) {
      const existing = await this.routeRepo.findOneBy({ code: def.code });
      if (!existing) {
        await this.routeRepo.save(this.routeRepo.create(def));
        count++;
      }
    }
    console.log(`[SEED] Success: Added ${count} new medication routes.`);
  }

  async findAllMedicationRoutes(query: MasterQueryDto) {
    const { page = 1, limit = 50, search, isActive } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) where.name = ILike(`%${search}%`);
    if (isActive !== undefined) where.isActive = isActive;

    const [data, total] = await this.routeRepo.findAndCount({
      where,
      order: { isCommon: 'DESC', name: 'ASC' },
      take: limit,
      skip,
    });

    return new PaginatedResponse(
      data,
      null,
      total,
      limit,
      data.length,
      page,
      Math.ceil(total / limit),
    );
  }

  async createMedicationRoute(
    dto: CreateMedicationRouteDto,
    adminId: string,
    ip: string,
  ) {
    const existing = await this.routeRepo.findOneBy({ code: dto.code });
    if (existing)
      throw new ConflictException(
        `Medication route with code '${dto.code}' already exists`,
      );

    const route = this.routeRepo.create(dto);
    await this.routeRepo.save(route);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_MEDICATION_ROUTE_CREATED',
      ipAddress: ip,
      metadata: { routeId: route.id, code: route.code },
    });

    return route;
  }

  async toggleMedicationRouteStatus(
    id: string,
    isActive: boolean,
    adminId: string,
    ip: string,
  ) {
    const route = await this.routeRepo.findOneBy({ id });
    if (!route) throw new NotFoundException('Medication route not found');

    route.isActive = isActive;
    await this.routeRepo.save(route);

    await this.auditLogService.log({
      userId: adminId,
      action: 'MASTER_MEDICATION_ROUTE_STATUS_UPDATED',
      ipAddress: ip,
      metadata: { id, isActive },
    });

    return route;
  }

  // --- Acute Medication Seeding ---

  private async seedAcuteMedications() {
    console.log('[SEED] Synchronizing Acute Care Medication Registry...');
    let count = 0;
    for (const def of COMMON_ACUTE_MEDICATIONS) {
      const existing = await this.medicationRepo.findOneBy({ name: def.name });
      if (!existing) {
        await this.medicationRepo.save(this.medicationRepo.create(def));
        count++;
      }
    }
    console.log(`[SEED] Success: Added ${count} new acute care medications.`);
  }
}
