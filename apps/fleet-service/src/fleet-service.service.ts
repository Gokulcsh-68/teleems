import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehicleQueryDto } from './dto/vehicle-query.dto';
import { CreateFleetOperatorDto, UpdateFleetOperatorDto } from './dto/fleet-operator.dto';
import { 
  PaginatedResponse, encodeCursor, decodeCursor, AuditLogService, 
  Organisation, FleetOperator, Vehicle, VehicleStatus, Station, StaffProfile, StaffType, StaffStatus,
  DutyShift, DutyShiftStatus, InventoryItem, VehicleInventory, InventoryCategory,
  DutyRoster, ShiftType
} from '@app/common';
import { CreateStationDto, UpdateStationDto } from './dto/station.dto';
import { CreateStaffDto, UpdateStaffDto } from './dto/staff.dto';
import { StartShiftDto, EndShiftDto } from './dto/duty.dto';
import { CreateInventoryItemDto, UpdateVehicleInventoryDto } from './dto/inventory.dto';
import { CreateRosterDto, RosterQueryDto } from './dto/roster.dto';
import * as bcrypt from 'bcrypt';
import { User } from '../../auth-service/src/entities/user.entity';
import { Role } from '../../auth-service/src/entities/role.entity';

@Injectable()
export class FleetServiceService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(FleetOperator)
    private readonly operatorRepo: Repository<FleetOperator>,
    @InjectRepository(Organisation)
    private readonly orgRepo: Repository<Organisation>,
    @InjectRepository(Station)
    private readonly stationRepo: Repository<Station>,
    @InjectRepository(StaffProfile)
    private readonly staffProfileRepo: Repository<StaffProfile>,
    @InjectRepository(DutyShift)
    private readonly dutyShiftRepo: Repository<DutyShift>,
    @InjectRepository(DutyRoster)
    private readonly rosterRepo: Repository<DutyRoster>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepo: Repository<InventoryItem>,
    @InjectRepository(VehicleInventory)
    private readonly vehicleInventoryRepo: Repository<VehicleInventory>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAllVehicles(query: VehicleQueryDto, requestUser: any) {
    const { 
      status, type, vehicle_type, registration_number, 
      brand, model, limit = 50, cursor 
    } = query;
    const isPlatformAdmin = requestUser.roles?.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN', 'Call Centre Executive (CCE)', 'CCE'].includes(r)
    );

    const queryBuilder = this.vehicleRepo.createQueryBuilder('vehicle');
    
    // Default: Only show active vehicles (Super Admin can override)
    if (!isPlatformAdmin) {
      queryBuilder.andWhere('vehicle.isActive = :isActive', { isActive: true });
    } else if (query.show_inactive !== 'true') {
      queryBuilder.andWhere('vehicle.isActive = :isActive', { isActive: true });
    }

    // Tenant Isolation
    if (!isPlatformAdmin) {
      queryBuilder.andWhere('vehicle.organisationId = :orgId', { orgId: requestUser.organisationId });
    } else if (query.org_id) {
      queryBuilder.andWhere('vehicle.organisationId = :orgId', { orgId: query.org_id });
    }

    // Filters
    if (status) queryBuilder.andWhere('vehicle.status = :status', { status });
    
    // Support both 'type' and 'vehicle_type' from query params
    const vType = vehicle_type || type;
    if (vType) queryBuilder.andWhere('vehicle.vehicle_type = :vType', { vType });

    if (registration_number) {
      queryBuilder.andWhere('vehicle.registration_number ILIKE :reg', { reg: `%${registration_number}%` });
    }

    if (brand) {
      queryBuilder.andWhere('vehicle.brand ILIKE :brand', { brand: `%${brand}%` });
    }

    if (model) {
      queryBuilder.andWhere('vehicle.model ILIKE :model', { model: `%${model}%` });
    }

    // Pagination
    if (cursor) {
      const decodedCursor = decodeCursor(cursor);
      const [cursorId] = decodedCursor.split('|');
      if (cursorId) {
        queryBuilder.andWhere('vehicle.id > :cursorId', { cursorId });
      }
    }

    queryBuilder.orderBy('vehicle.id', 'ASC');
    queryBuilder.take(limit + 1);

    const vehicles = await queryBuilder.getMany();
    
    let next_cursor: string | null = null;
    const hasNextPage = vehicles.length > limit;
    const data = hasNextPage ? vehicles.slice(0, limit) : vehicles;

    if (hasNextPage) {
      const lastItem = data[data.length - 1];
      next_cursor = encodeCursor(`${lastItem.id}`);
    }

    const total_count = await queryBuilder.getCount();
    const total_pages = Math.ceil(total_count / limit);
    const currentPage = 1; // Basic offset support, can be expanded if needed

    return new PaginatedResponse(
      data, 
      next_cursor, 
      total_count, 
      limit, 
      data.length,
      currentPage,
      total_pages
    );
  }

  async registerVehicle(dto: CreateVehicleDto, requestUser: any) {
    const roles = requestUser.roles || [];
    const isPlatformAdmin = roles.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r)
    );

    const orgId = (isPlatformAdmin && dto.organisationId) 
      ? dto.organisationId 
      : (requestUser.org_id || requestUser.organisationId);

    if (!orgId) {
      throw new ConflictException('Organisation ID is required for vehicle registration');
    }

    // Check for duplicate registration
    const existing = await this.vehicleRepo.findOneBy({ registration_number: dto.registration_number });
    if (existing) {
      throw new ConflictException(`Vehicle with registration number '${dto.registration_number}' already exists`);
    }

    // Check Capacity (Spec 5.4)
    const org = await this.orgRepo.findOneBy({ id: orgId });
    if (!org) throw new NotFoundException('Organisation not found');

    const currentCount = await this.vehicleRepo.count({ where: { organisationId: orgId } });
    if (currentCount >= (org.vehicle_capacity || 10)) {
      throw new ConflictException(`Organisation '${org.name}' has reached its vehicle capacity (${org.vehicle_capacity})`);
    }

    // Validate Station if provided
    if (dto.station_id) {
      const station = await this.stationRepo.findOneBy({ id: dto.station_id });
      if (!station) throw new NotFoundException(`Station with ID ${dto.station_id} not found`);
      if (station.organisationId !== orgId) {
        throw new ForbiddenException('Access denied: Station does not belong to the selected organisation');
      }
    }

    const vehicle = this.vehicleRepo.create({
      ...dto,
      organisationId: orgId,
    });
    
    const saved = await this.vehicleRepo.save(vehicle);

    return { data: saved };
  }

  async findOneVehicle(id: string, requestUser: any) {
    const vehicle = await this.vehicleRepo.findOneBy({ id });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const isPlatformAdmin = requestUser.roles?.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r)
    );

    // Tenant Isolation
    if (!isPlatformAdmin && vehicle.organisationId !== (requestUser.organisationId || requestUser.org_id)) {
      throw new ForbiddenException('Access denied: You can only view vehicles in your own organization');
    }

    return { data: vehicle };
  }

  async updateVehicle(id: string, dto: any, requestUser: any) {
    const vehicle = await this.vehicleRepo.findOneBy({ id });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const isPlatformAdmin = requestUser.roles?.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r)
    );

    // Tenant Isolation
    if (!isPlatformAdmin && vehicle.organisationId !== requestUser.organisationId) {
      throw new ForbiddenException('Access denied: You can only update vehicles in your own organization');
    }

    // Validate Station if being updated
    if (dto.station_id) {
      const station = await this.stationRepo.findOneBy({ id: dto.station_id });
      if (!station) throw new NotFoundException(`Station with ID ${dto.station_id} not found`);
      if (station.organisationId !== vehicle.organisationId) {
        throw new ForbiddenException('Access denied: Station does not belong to the same organisation as the vehicle');
      }
    }

    Object.assign(vehicle, dto);
    const saved = await this.vehicleRepo.save(vehicle);
    return { data: saved };
  }

  async deleteVehicle(id: string, requestUser: any) {
    const vehicle = await this.vehicleRepo.findOneBy({ id });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const isPlatformAdmin = requestUser.roles?.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r)
    );

    // Tenant Isolation
    if (!isPlatformAdmin && vehicle.organisationId !== requestUser.organisationId) {
      throw new ForbiddenException('Access denied: You can only delete vehicles in your own organization');
    }

    // Soft Delete
    vehicle.isActive = false;
    await this.vehicleRepo.save(vehicle);

    return { message: 'Vehicle soft-deleted successfully' };
  }

  async createOperator(dto: CreateFleetOperatorDto, adminId: string, ip: string): Promise<FleetOperator> {
    const operator = (await this.operatorRepo.save(this.operatorRepo.create(dto))) as FleetOperator;

    await this.auditLogService.log({
      userId: adminId,
      action: 'FLEET_OPERATOR_CREATED',
      ipAddress: ip,
      metadata: { operatorId: operator.id, name: operator.name },
    });

    return operator;
  }

  async findAllOperators(): Promise<FleetOperator[]> {
    return this.operatorRepo.find({ order: { name: 'ASC' } });
  }

  async findOneOperator(id: string): Promise<FleetOperator> {
    const operator = await this.operatorRepo.findOneBy({ id });
    if (!operator) throw new NotFoundException(`Fleet Operator with ID ${id} not found`);
    return operator;
  }

  async updateOperator(id: string, dto: UpdateFleetOperatorDto, adminId: string, ip: string): Promise<FleetOperator> {
    const operator = await this.findOneOperator(id);
    Object.assign(operator, dto);
    const saved = (await this.operatorRepo.save(operator)) as FleetOperator;

    await this.auditLogService.log({
      userId: adminId,
      action: 'FLEET_OPERATOR_UPDATED',
      ipAddress: ip,
      metadata: { operatorId: id, updates: dto },
    });

    return saved;
  }

  async createOrganisation(dto: any, adminId: string, ip: string) {
    const orgData = {
      ...dto,
      registration_number: dto.reg_number,
      country: dto.country || 'India',
    };

    const org = this.orgRepo.create(orgData);
    const saved = (await this.orgRepo.save(org)) as any;

    await this.auditLogService.log({
      userId: adminId,
      action: 'FLEET_ORGANISATION_CREATED',
      ipAddress: ip,
      metadata: { orgId: saved.id, name: saved.name },
    });

    return { data: saved };
  }

  // --- Station Management (Step 1 of Phase 1) ---

  async createStation(dto: CreateStationDto, requestUser: any) {
    const isPlatformAdmin = requestUser.roles?.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r)
    );

    const orgId = (isPlatformAdmin && dto.organisationId) 
      ? dto.organisationId 
      : (requestUser.org_id || requestUser.organisationId);

    if (!orgId) {
      throw new ConflictException('Organisation ID is required for station creation');
    }

    // Validate that the organization exists
    const org = await this.orgRepo.findOneBy({ id: orgId });
    if (!org) {
      throw new NotFoundException(`Organisation with ID ${orgId} not found`);
    }

    const station = this.stationRepo.create({
      ...dto,
      organisationId: orgId,
    });

    return { data: await this.stationRepo.save(station) };
  }

  async findAllStations(requestUser: any) {
    const isPlatformAdmin = requestUser.roles?.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r)
    );

    const queryBuilder = this.stationRepo.createQueryBuilder('station');

    if (!isPlatformAdmin) {
      queryBuilder.andWhere('station.organisationId = :orgId', { orgId: requestUser.organisationId || requestUser.org_id });
    }

    queryBuilder.orderBy('station.name', 'ASC');
    const data = await queryBuilder.getMany();
    return { data };
  }

  async findOneStation(id: string, requestUser: any) {
    const station = await this.stationRepo.findOneBy({ id });
    if (!station) throw new NotFoundException('Station not found');

    const isPlatformAdmin = requestUser.roles?.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r)
    );

    if (!isPlatformAdmin && station.organisationId !== (requestUser.organisationId || requestUser.org_id)) {
      throw new ForbiddenException('Access denied: You can only view stations in your own organization');
    }

    return { data: station };
  }

  async updateStation(id: string, dto: UpdateStationDto, requestUser: any) {
    const { data: station } = await this.findOneStation(id, requestUser);
    
    Object.assign(station, dto);
    const saved = await this.stationRepo.save(station);
    return { data: saved };
  }

  // --- Staff Management (Step 3 of Phase 1) ---

  async createStaff(dto: CreateStaffDto, requestUser: any) {
    const isPlatformAdmin = requestUser.roles?.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r)
    );

    const orgId = (isPlatformAdmin && dto.organisationId) 
      ? dto.organisationId 
      : (requestUser.org_id || requestUser.organisationId);

    if (!orgId) {
      throw new ConflictException('Organisation ID is required for staff creation');
    }

    // 1. Check if user already exists
    const existingUser = await this.userRepo.findOneBy({ phone: dto.phone });
    if (existingUser) {
      throw new ConflictException(`User with phone ${dto.phone} already exists`);
    }

    // 2. Resolve Role
    // Default roles mapping based on StaffType
    const roleMap = {
      [StaffType.DRIVER]: 'Ambulance Pilot (Driver)',
      [StaffType.EMT]: 'EMT / Paramedic',
      [StaffType.DOCTOR]: 'Hospital ED Doctor (ERCP)',
      [StaffType.HEALTH_AID]: 'EMT / Paramedic'
    };
    
    // Fallback to "EMT / Paramedic" if unknown
    const roleName = roleMap[dto.type] || 'EMT / Paramedic';
    const role = await this.roleRepo.findOneBy({ name: roleName });
    if (!role) throw new NotFoundException(`Role '${roleName}' not found in system`);

    // 3. Create User account
    const hashedPassword = await bcrypt.hash(dto.password || 'Welcome@123', 10);
    const userData: any = {
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      username: dto.username || dto.phone,
      password: hashedPassword,
      roles: [role.name],
      organisationId: orgId,
      status: 'ACTIVE',
    };

    const user = this.userRepo.create(userData);

    const savedUser = (await this.userRepo.save(user)) as any as User;

    // 4. Create Staff Profile
    const profileData: any = {
      userId: savedUser.id,
      type: dto.type,
      status: dto.status || StaffStatus.ACTIVE,
      organisationId: orgId,
      aadhaar_number: dto.aadhaar_number,
      dob: dto.dob ? new Date(dto.dob) : undefined,
      gender: dto.gender,
      photo_url: dto.photo_url,
      blood_group: dto.blood_group,
      emergency_contact_phone: dto.emergency_contact_phone,
      address: dto.address,
      professional_details: dto.professional_details || {},
    };

    const profile = this.staffProfileRepo.create(profileData);

    const savedProfile = (await this.staffProfileRepo.save(profile)) as any as StaffProfile;

    return { 
      data: {
        ...savedProfile,
        user: {
          id: savedUser.id,
          name: savedUser.name,
          phone: savedUser.phone,
          roles: savedUser.roles
        }
      }
    };
  }

  async findAllStaff(requestUser: any, type?: StaffType) {
    try {
      const isPlatformAdmin = requestUser.roles?.some((r: string) => 
        ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r)
      );

      const queryBuilder = this.staffProfileRepo.createQueryBuilder('profile')
        .leftJoinAndMapOne('profile.user', User, 'user', 'user.id = profile.user_id::uuid');

      if (!isPlatformAdmin) {
        // Use the property name 'organisationId' for the where clause
        queryBuilder.andWhere('profile.organisationId = :orgId', { 
          orgId: requestUser.organisationId || requestUser.org_id 
        });
      }

      if (type) {
        queryBuilder.andWhere('profile.type = :type', { type });
      }

      queryBuilder.orderBy('profile.createdAt', 'DESC');
      
      const data = await queryBuilder.getMany();
      return { data };
    } catch (error) {
      console.error('[FleetService] Error fetching staff:', error);
      throw new BadRequestException(`Failed to fetch staff: ${error.message}`);
    }
  }

  async findOneStaff(id: string, requestUser: any) {
    const profile = await this.staffProfileRepo.findOneBy({ id });
    if (!profile) throw new NotFoundException('Staff profile not found');

    const isPlatformAdmin = requestUser.roles?.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r)
    );

    if (!isPlatformAdmin && profile.organisationId !== (requestUser.organisationId || requestUser.org_id)) {
      throw new ForbiddenException('Access denied: You can only view staff in your own organization');
    }

    const user = await this.userRepo.findOneBy({ id: profile.userId });
    
    return { 
      data: {
        ...profile,
        user: {
          id: user?.id,
          name: user?.name,
          phone: user?.phone,
          email: user?.email,
          roles: user?.roles
        }
      }
    };
  }

  async updateStaff(id: string, dto: UpdateStaffDto, requestUser: any) {
    const { data: profile } = await this.findOneStaff(id, requestUser);
    
    // Update profile fields
    if (dto.name) {
      await this.userRepo.update(profile.userId, { name: dto.name });
    }

    Object.assign(profile, dto);
    // Don't overwrite the nested user object returned by findOneStaff
    delete (profile as any).user;

    const saved = await this.staffProfileRepo.save(profile);
    return { data: saved };
  }

  // --- Duty Shift Management (Step 4 of Phase 1) ---

  async startShift(dto: StartShiftDto, requestUser: any) {
    const orgId = requestUser.organisationId || requestUser.org_id;

    // 1. Validate Vehicle
    const vehicle = await this.vehicleRepo.findOneBy({ id: dto.vehicleId });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (vehicle.organisationId !== orgId) throw new ForbiddenException('Access denied: Vehicle belongs to another organisation');
    if (vehicle.status === VehicleStatus.OFFLINE || !vehicle.isActive) {
      throw new BadRequestException('Vehicle is currently inactive or offline');
    }

    // 2. Resolve Crew (From DTO or Roster)
    let driverId = dto.driverId;
    let staffId = dto.staffId;

    if (!driverId || !staffId) {
      const today = new Date().toISOString().split('T')[0];
      const hour = new Date().getHours();
      
      // Determine probable shift type (Standard: Day 8am-8pm, Night 8pm-8am)
      const currentShiftType = (hour >= 8 && hour < 20) ? ShiftType.DAY : ShiftType.NIGHT;

      // Try matching specific shift first, then fallback to 24H
      let roster = await this.rosterRepo.createQueryBuilder('roster')
        .where('roster.vehicleId = :vId', { vId: dto.vehicleId })
        .andWhere('roster.startDate <= :today', { today })
        .andWhere('roster.endDate >= :today', { today })
        .andWhere('roster.shiftType = :sType', { sType: currentShiftType })
        .andWhere('roster.isActive = :active', { active: true })
        .getOne();

      if (!roster) {
        // Fallback to 24H or any active roster
        roster = await this.rosterRepo.createQueryBuilder('roster')
          .where('roster.vehicleId = :vId', { vId: dto.vehicleId })
          .andWhere('roster.startDate <= :today', { today })
          .andWhere('roster.endDate >= :today', { today })
          .andWhere('roster.isActive = :active', { active: true })
          .getOne();
      }

      if (!roster) {
        throw new BadRequestException('No crew IDs provided and no active roster found for this vehicle today.');
      }
      
      driverId = driverId || roster.driverId;
      staffId = staffId || roster.staffId;
    }

    // 3. Validate Driver
    const driver = await this.staffProfileRepo.findOneBy({ id: driverId });
    if (!driver || driver.type !== StaffType.DRIVER) {
      throw new BadRequestException(`Invalid driver selected or rostered: ${driverId}`);
    }
    if (driver.organisationId !== orgId) throw new ForbiddenException('Access denied: Driver belongs to another organisation');

    // 4. Validate Staff (EMT/Doctor)
    const staff = await this.staffProfileRepo.findOneBy({ id: staffId });
    if (!staff || (staff.type !== StaffType.EMT && staff.type !== StaffType.DOCTOR)) {
      throw new BadRequestException(`Invalid staff (EMT/Doctor) selected or rostered: ${staffId}`);
    }
    if (staff.organisationId !== orgId) throw new ForbiddenException('Access denied: Staff member belongs to another organisation');

    // 5. Check for active shifts (No double assignments)
    const activeVehicleShift = await this.dutyShiftRepo.findOneBy({ 
      vehicleId: dto.vehicleId, 
      status: DutyShiftStatus.ON_DUTY 
    });
    if (activeVehicleShift) throw new ConflictException('Vehicle is already on an active shift');

    const activeDriverShift = await this.dutyShiftRepo.findOneBy({ 
      driverId: driverId, 
      status: DutyShiftStatus.ON_DUTY 
    });
    if (activeDriverShift) throw new ConflictException('Driver is already on an active shift');

    const activeStaffShift = await this.dutyShiftRepo.findOneBy({ 
      staffId: staffId, 
      status: DutyShiftStatus.ON_DUTY 
    });
    if (activeStaffShift) throw new ConflictException('Staff member is already on an active shift');

    // 6. Create Shift
    const shift = this.dutyShiftRepo.create({
      ...dto,
      driverId,
      staffId,
      organisationId: orgId,
      startTime: new Date(),
      status: DutyShiftStatus.ON_DUTY
    });

    const savedShift = await this.dutyShiftRepo.save(shift);

    // 7. Update Vehicle Status
    vehicle.status = VehicleStatus.AVAILABLE;
    await this.vehicleRepo.save(vehicle);

    return { data: savedShift };
  }

  async endShift(id: string, dto: EndShiftDto, requestUser: any) {
    const shift = await this.dutyShiftRepo.findOne({
      where: { id },
      relations: ['vehicle']
    });

    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.organisationId !== (requestUser.organisationId || requestUser.org_id)) {
      throw new ForbiddenException('Access denied');
    }
    if (shift.status !== DutyShiftStatus.ON_DUTY) {
      throw new BadRequestException('Shift is already completed or cancelled');
    }

    // 1. Close Shift
    shift.status = DutyShiftStatus.COMPLETED;
    shift.endTime = new Date();
    shift.notes = dto.notes || shift.notes;
    
    if (dto.checklist) {
      shift.checklist = { ...shift.checklist, ...dto.checklist };
    }

    await this.dutyShiftRepo.save(shift);

    // 2. Update Vehicle Status
    const vehicle = await this.vehicleRepo.findOneBy({ id: shift.vehicleId });
    if (vehicle) {
      vehicle.status = VehicleStatus.OFFLINE;
      await this.vehicleRepo.save(vehicle);
    }

    return { message: 'Shift completed successfully', data: shift };
  }

  async getActiveShifts(requestUser: any) {
    const orgId = requestUser.organisationId || requestUser.org_id;

    const data = await this.dutyShiftRepo.find({
      where: { 
        organisationId: orgId,
        status: DutyShiftStatus.ON_DUTY
      },
      relations: ['vehicle', 'driver', 'staff'],
      order: { startTime: 'DESC' }
    });

    return { data };
  }

  // --- Inventory Management (Step 5 of Phase 1) ---

  async createInventoryItem(dto: CreateInventoryItemDto) {
    const item = this.inventoryItemRepo.create(dto);
    const saved = await this.inventoryItemRepo.save(item);
    return { data: saved };
  }

  async getMasterInventory() {
    const items = await this.inventoryItemRepo.find({
      order: { category: 'ASC', name: 'ASC' }
    });
    return { data: items };
  }

  async getVehicleInventory(vehicleId: string, requestUser: any) {
    // 1. Validate Vehicle
    const vehicle = await this.vehicleRepo.findOneBy({ id: vehicleId });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    
    // In a real env, check orgId here for multi-tenant isolation
    
    const inventory = await this.vehicleInventoryRepo.find({
      where: { vehicleId },
      relations: ['item'],
      order: { item: { category: 'ASC', name: 'ASC' } }
    });
    return { data: inventory };
  }

  async updateVehicleInventory(vehicleId: string, dto: UpdateVehicleInventoryDto, requestUser: any) {
    const vehicle = await this.vehicleRepo.findOneBy({ id: vehicleId });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const item = await this.inventoryItemRepo.findOneBy({ id: dto.itemId });
    if (!item) throw new NotFoundException('Inventory item not found');

    let inventory = await this.vehicleInventoryRepo.findOneBy({ 
      vehicleId, 
      itemId: dto.itemId 
    });

    if (inventory) {
      inventory.currentQuantity = dto.quantity;
      if (dto.minRequired !== undefined) inventory.minRequiredQuantity = dto.minRequired;
      inventory.lastRestockedAt = new Date();
    } else {
      inventory = this.vehicleInventoryRepo.create({
        vehicleId,
        itemId: dto.itemId,
        currentQuantity: dto.quantity,
        minRequiredQuantity: dto.minRequired || 0,
        lastRestockedAt: new Date()
      });
    }

    const saved = await this.vehicleInventoryRepo.save(inventory);
    return { data: saved };
  }

  /**
   * Helper to seed basic inventory if empty
   */
  async seedDefaultInventory() {
    const count = await this.inventoryItemRepo.count();
    if (count > 0) return { message: 'Inventory already seeded' };

    const defaults = [
      { name: 'Oxygen Cylinder (10L)', category: InventoryCategory.EQUIPMENT, unit: 'Liters' },
      { name: 'Oxygen Cylinder (2L)', category: InventoryCategory.EQUIPMENT, unit: 'Liters' },
      { name: 'Stretcher - Main', category: InventoryCategory.EQUIPMENT, unit: 'Pieces' },
      { name: 'Stretcher - Scoop', category: InventoryCategory.EQUIPMENT, unit: 'Pieces' },
      { name: 'First Aid Kit - Level 1', category: InventoryCategory.CONSUMABLE, unit: 'Packets' },
      { name: 'N95 Masks', category: InventoryCategory.SAFETY, unit: 'Pieces' },
      { name: 'Disposable Gloves', category: InventoryCategory.SAFETY, unit: 'Boxes' },
      { name: 'Defibrillator Pad', category: InventoryCategory.CONSUMABLE, unit: 'Sets' }
    ];

    const entities = this.inventoryItemRepo.create(defaults);
    await this.inventoryItemRepo.save(entities);

    return { message: 'Default inventory seeded successfully', count: entities.length };
  }

  // --- Roster Management (Step 6 of Phase 1) ---

  async createRoster(dto: CreateRosterDto, requestUser: any) {
    const isPlatformAdmin = requestUser.roles?.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r)
    );

    const orgId = (isPlatformAdmin && dto.organisationId) 
      ? dto.organisationId 
      : (requestUser.org_id || requestUser.organisationId);

    // 1. Validate Vehicle & Staff
    const vehicle = await this.vehicleRepo.findOneBy({ id: dto.vehicleId, organisationId: orgId });
    if (!vehicle) throw new NotFoundException('Vehicle not found or access denied');

    const driver = await this.staffProfileRepo.findOneBy({ id: dto.driverId, organisationId: orgId });
    if (!driver || driver.type !== StaffType.DRIVER) throw new BadRequestException('Invalid driver for roster');

    const staff = await this.staffProfileRepo.findOneBy({ id: dto.staffId, organisationId: orgId });
    if (!staff || (staff.type !== StaffType.EMT && staff.type !== StaffType.DOCTOR)) throw new BadRequestException('Invalid medic for roster');

    // 2. Create Roster
    const roster = this.rosterRepo.create({
      ...dto,
      organisationId: orgId,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate)
    });

    const saved = await this.rosterRepo.save(roster);
    return { data: saved };
  }

  async getVehicleRoster(vehicleId: string, requestUser: any) {
    const orgId = requestUser.organisationId || requestUser.org_id;

    const data = await this.rosterRepo.find({
      where: { vehicleId, organisationId: orgId, isActive: true },
      relations: ['driver', 'staff'],
      order: { startDate: 'DESC' }
    });

    return { data };
  }
}
