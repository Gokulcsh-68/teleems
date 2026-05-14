import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehicleQueryDto } from './dto/vehicle-query.dto';
import { CreateFleetOperatorDto, UpdateFleetOperatorDto } from './dto/fleet-operator.dto';
import { 
  PaginatedResponse, encodeCursor, decodeCursor, AuditLogService, 
  Organisation, FleetOperator, Vehicle, VehicleStatus, Station, StaffProfile, StaffType, StaffStatus,
  DutyShift, DutyShiftStatus, InventoryItemMaster, VehicleInventory,
  DutyRoster, ShiftType, InventoryItemCategory, InventoryLog, InventoryLogType,
  User, Role, RestockRequest, RestockRequestStatus,
  WarehouseInventory,
  RedisService
} from '@app/common';
import { DataSource } from 'typeorm';
import { CreateStationDto, UpdateStationDto } from './dto/station.dto';
import { CreateStaffDto, UpdateStaffDto } from './dto/staff.dto';
import { StartShiftDto, EndShiftDto } from './dto/duty.dto';
import { CreateInventoryItemDto, UpdateVehicleInventoryDto, BulkUpdateInventoryDto, CreateRestockRequestDto, UpdateRestockRequestStatusDto, UpdateWarehouseStockDto } from './dto/inventory.dto';
import { CreateRosterDto, RosterQueryDto } from './dto/roster.dto';
import * as bcrypt from 'bcrypt';

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
    @InjectRepository(InventoryItemMaster)
    private readonly inventoryItemRepo: Repository<InventoryItemMaster>,
    @InjectRepository(VehicleInventory)
    private readonly vehicleInventoryRepo: Repository<VehicleInventory>,
    @InjectRepository(InventoryLog)
    private readonly inventoryLogRepo: Repository<InventoryLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(RestockRequest)
    private readonly restockRepo: Repository<RestockRequest>,
    @InjectRepository(WarehouseInventory)
    private readonly warehouseRepo: Repository<WarehouseInventory>,
    private readonly auditLogService: AuditLogService,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
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

    const isPublicCaller = requestUser.roles?.includes('CALLER');

    // Tenant Isolation
    if (!isPlatformAdmin && !isPublicCaller) {
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

    if (query.station_id) {
      queryBuilder.andWhere('vehicle.station_id = :stationId', { stationId: query.station_id });
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

    // Fetch active shifts for the org to map to vehicles (Prevents N+1)
    const orgId = requestUser.organisationId || requestUser.org_id;
    const activeShifts = await this.dutyShiftRepo.createQueryBuilder('shift')
      .leftJoinAndMapOne('shift.driver', StaffProfile, 'driver', 'driver.id = shift.driverId')
      .leftJoinAndMapOne('driver.user', User, 'driverUser', 'driverUser.id = driver.userId')
      .leftJoinAndMapOne('shift.staff', StaffProfile, 'staff', 'staff.id = shift.staffId')
      .leftJoinAndMapOne('staff.user', User, 'staffUser', 'staffUser.id = staff.userId')
      .where('shift.organisationId = :orgId', { orgId })
      .andWhere('shift.status = :status', { status: DutyShiftStatus.ON_DUTY })
      .getMany();

    // Map shifts to vehicles
    const shiftMap = new Map(activeShifts.map(s => [s.vehicleId, s]));

    // Fetch active rosters for today
    const today = new Date();
    const activeRosters = await this.rosterRepo.createQueryBuilder('roster')
      .leftJoinAndMapOne('roster.driver', StaffProfile, 'driver', 'driver.id = roster.driverId')
      .leftJoinAndMapOne('driver.user', User, 'driverUser', 'driverUser.id = driver.userId')
      .leftJoinAndMapOne('roster.staff', StaffProfile, 'staff', 'staff.id = roster.staffId')
      .leftJoinAndMapOne('staff.user', User, 'staffUser', 'staffUser.id = staff.userId')
      .where('roster.organisationId = :orgId', { orgId })
      .andWhere('roster.isActive = :isActive', { isActive: true })
      .andWhere('roster.startDate <= :today AND roster.endDate >= :today', { today })
      .getMany();

    const rosterMap = new Map(activeRosters.map(r => [r.vehicleId, r]));
    
    const dataWithAssignments = vehicles.map(v => ({
      ...v,
      activeShift: shiftMap.get(v.id) || null,
      activeRoster: rosterMap.get(v.id) || null
    }));
    
    let next_cursor: string | null = null;
    const hasNextPage = vehicles.length > limit;
    const data = hasNextPage ? dataWithAssignments.slice(0, limit) : dataWithAssignments;

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
      ['CureSelect Admin', 'CURESELECT_ADMIN', 'Call Centre Executive (CCE)', 'CCE'].includes(r)
    );

    // Tenant Isolation
    if (!isPlatformAdmin && vehicle.organisationId !== (requestUser.organisationId || requestUser.org_id)) {
      throw new ForbiddenException('Access denied: You can only view vehicles in your own organization');
    }

    // Fetch active duty shift with crew details
    const activeShift = await this.dutyShiftRepo.createQueryBuilder('shift')
      .leftJoinAndMapOne('shift.driver', StaffProfile, 'driver', 'driver.id = shift.driverId')
      .leftJoinAndMapOne('driver.user', User, 'driverUser', 'driverUser.id = driver.userId')
      .leftJoinAndMapOne('shift.staff', StaffProfile, 'staff', 'staff.id = shift.staffId')
      .leftJoinAndMapOne('staff.user', User, 'staffUser', 'staffUser.id = staff.userId')
      .where('shift.vehicleId = :vehicleId', { vehicleId: id })
      .andWhere('shift.status = :status', { status: DutyShiftStatus.ON_DUTY })
      .getOne();

    return { 
      data: {
        ...vehicle,
        activeShift: activeShift || null
      }
    };
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

    // Broadcast live location update if GPS coords were changed
    if (dto.gps_lat !== undefined || dto.gps_lon !== undefined) {
      await this.redisService.publish('fleet:location_updated', {
        vehicle_id: vehicle.id,
        registration_number: vehicle.registration_number,
        lat: vehicle.gps_lat,
        lon: vehicle.gps_lon,
        status: vehicle.status,
        timestamp: new Date(),
      });
    }

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

  async resetAllVehicles(requestUser: any) {
    const orgId = requestUser.organisationId || requestUser.org_id;
    if (!orgId) throw new ForbiddenException('Organization context missing');

    const result = await this.vehicleRepo.update(
      { organisationId: orgId, isActive: true },
      { status: VehicleStatus.AVAILABLE }
    );

    return { 
      message: `Successfully reset ${result.affected} vehicles to AVAILABLE status.`,
      affected: result.affected 
    };
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

  async findAllStations(requestUser: any, filterOrgId?: string) {
    const isPlatformAdmin = requestUser.roles?.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r)
    );

    const queryBuilder = this.stationRepo.createQueryBuilder('station');

    if (!isPlatformAdmin) {
      queryBuilder.andWhere('station.organisationId = :orgId', { orgId: requestUser.organisationId || requestUser.org_id });
    } else if (filterOrgId) {
      queryBuilder.andWhere('station.organisationId = :orgId', { orgId: filterOrgId });
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
    if (shift.vehicleId) {
      const vehicle = await this.vehicleRepo.findOneBy({ id: shift.vehicleId });
      if (vehicle) {
        vehicle.status = VehicleStatus.OFFLINE;
        await this.vehicleRepo.save(vehicle);
      }
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

  /**
   * SELF-SERVICE: Start Duty for the logged in staff member.
   * Allows them to join as Driver or EMT on a specific vehicle.
   */
  async startDutySelf(vehicleId: string, requestUser: any) {
    const userId = requestUser.id || requestUser.userId;
    const orgId = requestUser.organisationId || requestUser.org_id;

    // 1. Get Staff Profile
    const profile = await this.staffProfileRepo.findOneBy({ userId });
    if (!profile) throw new NotFoundException('Your staff profile was not found. Please contact admin.');

    // 2. Validate Vehicle
    const vehicle = await this.vehicleRepo.findOneBy({ id: vehicleId });
    if (!vehicle) throw new NotFoundException('Ambulance not found');
    if (vehicle.organisationId !== orgId) throw new ForbiddenException('Access denied');

    // 3. Prevent double duty
    const existingUserShift = await this.dutyShiftRepo.findOne({
      where: [
        { driverId: profile.id, status: DutyShiftStatus.ON_DUTY },
        { staffId: profile.id, status: DutyShiftStatus.ON_DUTY }
      ]
    });
    if (existingUserShift) throw new ConflictException('You are already on an active shift elsewhere');

    // 4. Find or Create Vehicle Shift
    let shift = await this.dutyShiftRepo.findOneBy({ 
      vehicleId, 
      status: DutyShiftStatus.ON_DUTY 
    });

    if (!shift) {
      // Create new shift starting with this user
      shift = this.dutyShiftRepo.create({
        vehicleId,
        organisationId: orgId,
        startTime: new Date(),
        status: DutyShiftStatus.ON_DUTY,
        driverId: profile.type === StaffType.DRIVER ? profile.id : null,
        staffId: (profile.type === StaffType.EMT || profile.type === StaffType.DOCTOR) ? profile.id : null,
      });
    } else {
      // Join existing shift
      if (profile.type === StaffType.DRIVER) {
        if (shift.driverId) throw new ConflictException('This vehicle already has a driver on duty');
        shift.driverId = profile.id;
      } else if (profile.type === StaffType.EMT || profile.type === StaffType.DOCTOR) {
        if (shift.staffId) throw new ConflictException('This vehicle already has a medical staff on duty');
        shift.staffId = profile.id;
      } else {
        throw new BadRequestException('Your staff type is not allowed to join a duty shift');
      }
    }

    const savedShift = await this.dutyShiftRepo.save(shift);

    // 5. Update Vehicle Status
    // Vehicle is only AVAILABLE if it has BOTH a driver and medical staff
    if (savedShift.driverId && savedShift.staffId) {
      if (vehicle.status !== VehicleStatus.BUSY) {
         vehicle.status = VehicleStatus.AVAILABLE;
         await this.vehicleRepo.save(vehicle);
      }
    }

    return { message: 'Duty started successfully', data: savedShift };
  }

  /**
   * SELF-SERVICE: End Duty for the logged in staff member.
   * Finds their current active shift and completes it.
   */
  async endDutySelf(requestUser: any) {
    const userId = requestUser.id || requestUser.userId;

    // 1. Get Staff Profile
    const profile = await this.staffProfileRepo.findOneBy({ userId });
    if (!profile) throw new NotFoundException('Staff profile not found');

    // 2. Find their active shift
    const shift = await this.dutyShiftRepo.findOne({
      where: [
        { driverId: profile.id, status: DutyShiftStatus.ON_DUTY },
        { staffId: profile.id, status: DutyShiftStatus.ON_DUTY }
      ],
      relations: ['vehicle']
    });

    if (!shift) throw new NotFoundException('You do not have an active duty shift');

    // 3. Close Shift
    shift.status = DutyShiftStatus.COMPLETED;
    shift.endTime = new Date();
    await this.dutyShiftRepo.save(shift);

    // 4. Update Vehicle Status
    // If ANY member of the crew leaves, the vehicle is no longer AVAILABLE
    const vehicle = shift.vehicle;
    if (vehicle && vehicle.status !== VehicleStatus.BUSY) {
      vehicle.status = VehicleStatus.OFFLINE;
      await this.vehicleRepo.save(vehicle);
    }

    return { message: 'Duty ended successfully', data: shift };
  }

  // --- Inventory Management (Step 5 of Phase 1) ---

  async createInventoryItem(dto: CreateInventoryItemDto, requestUser: any) {
    const orgId = requestUser.organisationId || requestUser.org_id;
    const item = this.inventoryItemRepo.create({
      ...dto,
      organisation_id: orgId
    });
    const saved = await this.inventoryItemRepo.save(item);
    return { data: saved };
  }

  async updateInventoryItem(id: string, dto: Partial<CreateInventoryItemDto>, requestUser: any) {
    const orgId = requestUser.organisationId || requestUser.org_id;
    const item = await this.inventoryItemRepo.findOneBy({ id, organisation_id: orgId });
    if (!item) throw new NotFoundException('Inventory item not found or unauthorized');
    
    Object.assign(item, dto);
    const saved = await this.inventoryItemRepo.save(item);
    return { data: saved };
  }

  async bulkCreateInventoryMaster(items: CreateInventoryItemDto[], requestUser: any) {
    const orgId = requestUser.organisationId || requestUser.org_id;
    const entities = items.map(item => {
      // Ensure category is uppercase to match enum
      if (item.category) {
        item.category = item.category.toUpperCase() as any;
      }
      return this.inventoryItemRepo.create({
        ...item,
        organisation_id: orgId
      });
    });
    const saved = await this.inventoryItemRepo.save(entities);
    return { data: saved, count: saved.length };
  }

  async getMasterInventory(requestUser: any, category?: string, unit?: string) {
    const orgId = requestUser.organisationId || requestUser.org_id;
    
    // Filter by own organisation OR global items (null orgId)
    const items = await this.inventoryItemRepo.createQueryBuilder('item')
      .where('(item.organisation_id = :orgId OR item.organisation_id IS NULL)', { orgId })
      .andWhere(category ? 'item.category = :category' : '1=1', { category })
      .andWhere(unit ? 'item.unit_of_measure = :unit' : '1=1', { unit })
      .orderBy('item.category', 'ASC')
      .addOrderBy('item.name', 'ASC')
      .getMany();
      
    return { data: items };
  }

  async getVehicleInventory(vehicleId: string, requestUser: any) {
    // 1. Validate Vehicle
    const vehicle = await this.vehicleRepo.findOneBy({ id: vehicleId });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    
    // In a real env, check orgId here for multi-tenant isolation
    
    const inventory = await this.vehicleInventoryRepo.find({
      where: { vehicle_id: vehicleId },
      relations: ['item_master'],
      order: { item_master: { category: 'ASC', name: 'ASC' } }
    });
    return { data: inventory };
  }

  async updateVehicleInventory(vehicleId: string, dto: UpdateVehicleInventoryDto, requestUser: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const vehicle = await queryRunner.manager.findOne(Vehicle, { where: { id: vehicleId } });
      if (!vehicle) throw new NotFoundException('Vehicle not found');

      const item = await queryRunner.manager.findOne(InventoryItemMaster, { where: { id: dto.itemId } });
      if (!item) throw new NotFoundException('Inventory item not found');

      let inventory = await queryRunner.manager.findOne(VehicleInventory, { 
        where: { vehicle_id: vehicleId, inventory_item_id: dto.itemId } 
      });

      const previousQty = inventory ? inventory.quantity : 0;
      let newQty: number;

      // Handle relative "consumption" or absolute "quantity"
      if (dto.consumed !== undefined) {
        newQty = previousQty - dto.consumed;
      } else if (dto.quantity !== undefined) {
        newQty = dto.quantity;
      } else {
        throw new BadRequestException('Either "quantity" or "consumed" must be provided');
      }

      if (inventory) {
        inventory.quantity = newQty;
        if (dto.minRequired !== undefined) inventory.min_required_quantity = dto.minRequired;
        inventory.last_replenished_at = new Date();
      } else {
        inventory = queryRunner.manager.create(VehicleInventory, {
          vehicle_id: vehicleId,
          inventory_item_id: dto.itemId,
          quantity: newQty,
          min_required_quantity: dto.minRequired || 0,
          last_replenished_at: new Date()
        });
      }

      const savedInventory = await queryRunner.manager.save(inventory);

      // Create Audit Log
      const log = queryRunner.manager.create(InventoryLog, {
        vehicle_id: vehicleId,
        inventory_item_id: dto.itemId,
        previous_quantity: previousQty,
        new_quantity: newQty,
        change_amount: newQty - previousQty,
        log_type: dto.consumed ? InventoryLogType.USAGE : InventoryLogType.CORRECTION,
        performed_by_id: requestUser.id || requestUser.userId,
        reason: dto.reason || (dto.consumed ? 'Item Usage' : 'Manual Update')
      });
      await queryRunner.manager.save(log);

      await queryRunner.commitTransaction();
      return { data: savedInventory };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error('[INVENTORY_UPDATE_ERROR]', err);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async bulkUpdateInventory(dto: BulkUpdateInventoryDto, requestUser: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results: VehicleInventory[] = [];
      for (const itemDto of dto.items) {
        let inventory = await queryRunner.manager.findOne(VehicleInventory, {
          where: { vehicle_id: dto.vehicleId, inventory_item_id: itemDto.itemId }
        });

        const previousQty = inventory ? inventory.quantity : 0;
        let newQty = itemDto.quantity;

        // Handle relative consumption or addition in bulk
        if (itemDto.consumed !== undefined) {
          newQty = previousQty - itemDto.consumed;
        } else if (itemDto.added !== undefined) {
          newQty = previousQty + itemDto.added;
        } else if (newQty === undefined) {
          // Skip if neither quantity, consumed nor added is provided
          continue;
        }

        if (inventory) {
          inventory.quantity = newQty;
          if (itemDto.minRequired !== undefined) inventory.min_required_quantity = itemDto.minRequired;
          inventory.last_replenished_at = new Date();
        } else {
          inventory = queryRunner.manager.create(VehicleInventory, {
            vehicle_id: dto.vehicleId,
            inventory_item_id: itemDto.itemId,
            quantity: newQty,
            min_required_quantity: itemDto.minRequired || 0,
            last_replenished_at: new Date()
          });
        }

        const saved = await queryRunner.manager.save(inventory);
        results.push(saved);

        const changeAmount = newQty - previousQty;
        const orgId = requestUser.organisationId || requestUser.org_id || (dto as any).organisationId;

        // --- Warehouse Deduction Logic ---
        // If we are ADDING stock to a vehicle (Restock), we subtract it from the warehouse
        // We only skip this if it's explicitly a direct purchase (has a supplier name that isn't 'Warehouse' or similar)
        if (changeAmount > 0 && !itemDto.consumed) {
          const warehouseStock = await queryRunner.manager.findOne(WarehouseInventory, {
            where: { organisation_id: orgId, inventory_item_id: itemDto.itemId },
            lock: { mode: 'pessimistic_write' } // Prevent race conditions
          });

          if (warehouseStock) {
            if (warehouseStock.quantity < changeAmount) {
              throw new BadRequestException(`Insufficient warehouse stock for item ${itemDto.itemId}. Available: ${warehouseStock.quantity}, Required: ${changeAmount}`);
            }
            warehouseStock.quantity -= changeAmount;
            await queryRunner.manager.save(warehouseStock);
          } else {
            // If it's a restock but no warehouse record exists, we throw error 
            // unless it's a global admin seeding data
            if (orgId) {
              throw new BadRequestException(`Warehouse inventory not found for item ${itemDto.itemId} in this organization.`);
            }
          }
        }

        // Audit Log for each item
        const log = queryRunner.manager.create(InventoryLog, {
          vehicle_id: dto.vehicleId,
          inventory_item_id: itemDto.itemId,
          previous_quantity: previousQty,
          new_quantity: newQty,
          change_amount: changeAmount,
          log_type: itemDto.consumed ? InventoryLogType.USAGE : InventoryLogType.RESTOCK,
          performed_by_id: requestUser.id || requestUser.userId,
          reason: dto.reason || (itemDto.consumed ? 'Bulk Usage' : 'Bulk Sync'),
          supplier_name: dto.supplier_name,
          invoice_number: dto.invoice_number,
          batch_number: itemDto.batch_number,
          expiry_date: itemDto.expiry_date ? new Date(itemDto.expiry_date) : undefined
        });
        await queryRunner.manager.save(log);
      }

      await queryRunner.commitTransaction();
      return { data: results };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error('[BULK_INVENTORY_ERROR]', err);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getInventoryLogs(vehicleId: string) {
    const logs = await this.inventoryLogRepo.find({
      where: { vehicle_id: vehicleId },
      relations: ['item_master'],
      order: { createdAt: 'DESC' },
      take: 50
    });
    return { data: logs };
  }

  async getLowStockReport(requestUser: any) {
    const orgId = requestUser.organisationId || requestUser.org_id;

    const items = await this.vehicleInventoryRepo.createQueryBuilder('vi')
      .leftJoinAndSelect('vi.vehicle', 'vehicle')
      .leftJoinAndSelect('vi.item_master', 'item')
      .where('vi.quantity < vi.min_required_quantity')
      .andWhere('vehicle.organisationId = :orgId', { orgId })
      .orderBy('vehicle.registration_number', 'ASC')
      .getMany();

    return { data: items };
  }

  /**
   * Helper to seed basic inventory if empty
   */
  async seedDefaultInventory() {
    // Find or create missing items from the defaults list

    const defaults = [
      // Oxygen & Airway
      { name: 'Oxygen Cylinder (10L)', category: InventoryItemCategory.MEDICAL_DEVICE, unit_of_measure: 'Liters' },
      { name: 'Oxygen Cylinder (2L)', category: InventoryItemCategory.MEDICAL_DEVICE, unit_of_measure: 'Liters' },
      { name: 'Bag Valve Mask (BVM) - Adult', category: InventoryItemCategory.MEDICAL_DEVICE, unit_of_measure: 'Sets' },
      { name: 'Suction Machine (Portable)', category: InventoryItemCategory.MEDICAL_DEVICE, unit_of_measure: 'Pieces' },
      
      // Monitoring & Diagnostics
      { name: 'Multiparameter Monitor', category: InventoryItemCategory.MEDICAL_DEVICE, unit_of_measure: 'Pieces' },
      { name: 'Pulse Oximeter (Handheld)', category: InventoryItemCategory.MEDICAL_DEVICE, unit_of_measure: 'Pieces' },
      { name: 'Digital Thermometer', category: InventoryItemCategory.MEDICAL_DEVICE, unit_of_measure: 'Pieces' },
      { name: 'BP Apparatus (Manual)', category: InventoryItemCategory.MEDICAL_DEVICE, unit_of_measure: 'Sets' },
      
      // Trauma & Support
      { name: 'Stretcher - Main', category: InventoryItemCategory.REUSABLE, unit_of_measure: 'Pieces' },
      { name: 'Stretcher - Scoop', category: InventoryItemCategory.REUSABLE, unit_of_measure: 'Pieces' },
      { name: 'Cervical Collar (Adjustable)', category: InventoryItemCategory.REUSABLE, unit_of_measure: 'Pieces' },
      { name: 'Spine Board with Straps', category: InventoryItemCategory.REUSABLE, unit_of_measure: 'Sets' },
      { name: 'Splint Set (Air/Vac)', category: InventoryItemCategory.REUSABLE, unit_of_measure: 'Sets' },
      
      // Consumables & Disposables
      { name: 'First Aid Kit - Level 1', category: InventoryItemCategory.DISPOSABLE, unit_of_measure: 'Packets' },
      { name: 'N95 Masks', category: InventoryItemCategory.DISPOSABLE, unit_of_measure: 'Pieces' },
      { name: 'Disposable Gloves', category: InventoryItemCategory.DISPOSABLE, unit_of_measure: 'Boxes' },
      { name: 'Defibrillator Pad (Adult)', category: InventoryItemCategory.DISPOSABLE, unit_of_measure: 'Sets' },
      { name: 'IV Starter Kit', category: InventoryItemCategory.DISPOSABLE, unit_of_measure: 'Sets' },
      { name: 'Normal Saline (500ml)', category: InventoryItemCategory.DISPOSABLE, unit_of_measure: 'Bottles' },
      { name: 'Adhesive Bandages (Assorted)', category: InventoryItemCategory.DISPOSABLE, unit_of_measure: 'Boxes' }
    ];

    let count = 0;
    for (const item of defaults) {
      const exists = await this.inventoryItemRepo.findOneBy({ name: item.name });
      if (!exists) {
        const entity = this.inventoryItemRepo.create(item);
        await this.inventoryItemRepo.save(entity);
        count++;
      }
    }

    return { message: 'Default inventory expansion complete', added: count, total: defaults.length };
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

  // --- Restock Request Management ---

  async createRestockRequest(dto: CreateRestockRequestDto, requestUser: any) {
    const orgId = requestUser.organisationId || requestUser.org_id;
    
    const request = this.restockRepo.create({
      vehicle_id: dto.vehicleId,
      items: dto.items,
      notes: dto.notes,
      requested_by_id: requestUser.id || requestUser.userId,
      organisation_id: orgId,
      status: RestockRequestStatus.PENDING
    });

    const saved = await this.restockRepo.save(request);

    await this.auditLogService.log({
      userId: requestUser.id || requestUser.userId,
      action: 'INVENTORY_RESTOCK_REQUEST_CREATED',
      metadata: { requestId: saved.id, vehicleId: dto.vehicleId },
      ipAddress: '0.0.0.0'
    });

    return { data: saved };
  }

  async listRestockRequests(requestUser: any, vehicleId?: string, status?: string) {
    const orgId = requestUser.organisationId || requestUser.org_id;
    const where: any = { organisation_id: orgId };
    
    // Determine user roles
    const roles = requestUser.roles || [];
    const isEMT = roles.includes('EMT / Paramedic') || roles.includes('EMT');
    const isOperator = roles.includes('Fleet Operator') || roles.includes('CureSelect Admin') || roles.includes('CURESELECT_ADMIN');

    // SECURITY: If EMT, they can ONLY see their own vehicle's requests
    if (isEMT && !isOperator) {
      // 1. Get Staff Profile
      const profile = await this.dataSource.getRepository(StaffProfile).findOneBy({ 
        userId: requestUser.id || requestUser.userId 
      });
      
      if (profile) {
        // 2. Check for an active DutyShift (Already ON_DUTY)
        const activeShift = await this.dataSource.getRepository(DutyShift).findOne({
          where: [
            { driverId: profile.id, status: DutyShiftStatus.ON_DUTY },
            { staffId: profile.id, status: DutyShiftStatus.ON_DUTY }
          ],
          relations: ['vehicle']
        });

        if (activeShift && activeShift.vehicle) {
          where.vehicle_id = activeShift.vehicle.id;
        } else {
          // 3. Fallback to today's DutyRoster
          const today = new Date().toISOString().split('T')[0];
          const roster = await this.dataSource.getRepository(DutyRoster).createQueryBuilder('roster')
            .leftJoinAndSelect('roster.vehicle', 'vehicle')
            .where('(roster.driverId = :pId OR roster.staffId = :pId)', { pId: profile.id })
            .andWhere('roster.startDate <= :today', { today })
            .andWhere('roster.endDate >= :today', { today })
            .andWhere('roster.isActive = :active', { active: true })
            .getOne();

          if (roster && roster.vehicle) {
            where.vehicle_id = roster.vehicle.id;
          }
        }
      }
      
      // If we still didn't find a vehicle, and they provided one, use it as last resort
      if (!where.vehicle_id && vehicleId) {
        where.vehicle_id = vehicleId;
      }
    } else if (vehicleId) {
      // For operators, apply the filter if provided
      where.vehicle_id = vehicleId;
    }

    if (status) {
      where.status = status;
    }

    const requests = await this.restockRepo.find({
      where,
      relations: ['vehicle', 'requested_by'],
      order: { createdAt: 'DESC' }
    });

    return { data: requests };
  }

  async updateRestockRequestStatus(id: string, dto: UpdateRestockRequestStatusDto, requestUser: any) {
    const request = await this.restockRepo.findOneBy({ id });
    if (!request) throw new NotFoundException('Restock request not found');

    const oldStatus = request.status;
    request.status = dto.status as RestockRequestStatus;
    const saved = await this.restockRepo.save(request);

    // --- AUTOMATION: If status becomes COMPLETED, auto-update the vehicle inventory ---
    if (dto.status === RestockRequestStatus.COMPLETED && oldStatus !== RestockRequestStatus.COMPLETED) {
      const bulkDto: any = {
        vehicleId: request.vehicle_id,
        organisationId: request.organisation_id, // Pass this as a fallback for warehouse lookup
        reason: `Automated restock from Request #${id}`,
        items: request.items.map(item => ({
          itemId: item.itemId,
          added: item.quantityRequested // Use 'added' to INCREMENT instead of overwrite
        }))
      };

      await this.bulkUpdateInventory(bulkDto, requestUser);
    }

    await this.auditLogService.log({
      userId: requestUser.id || requestUser.userId,
      action: 'INVENTORY_RESTOCK_REQUEST_STATUS_UPDATED',
      metadata: { requestId: id, status: dto.status },
      ipAddress: '0.0.0.0'
    });

    return { data: saved };
  }

  async getExpiringSoonReport(requestUser: any) {
    const orgId = requestUser.organisationId || requestUser.org_id;
    
    // Find logs with expiry date in next 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const logs = await this.inventoryLogRepo.createQueryBuilder('log')
      .leftJoinAndSelect('log.item_master', 'item')
      .leftJoinAndSelect('log.vehicle', 'vehicle')
      .where('log.expiry_date IS NOT NULL')
      .andWhere('log.expiry_date <= :thirtyDaysFromNow', { thirtyDaysFromNow })
      .andWhere('log.expiry_date >= :now', { now: new Date() })
      .andWhere('vehicle.organisationId = :orgId', { orgId })
      .orderBy('log.expiry_date', 'ASC')
      .getMany();

    return { data: logs };
  }

  async getInventoryMetadata() {
    return {
      data: {
        categories: Object.values(InventoryItemCategory),
        units: ['Tablet', 'Vial', 'Ampoule', 'Bottle', 'Pack', 'Piece', 'Strip', 'Milliliter', 'Gram', 'Cylinder', 'Kit'],
        common_names: {
          MEDICATION: ['Aspirin', 'Paracetamol', 'Ibuprofen', 'Adrenaline', 'Atropine', 'Nitroglycerin', 'Salbutamol', 'Hydrocortisone', 'Ondansetron', 'Morphine', 'Fentanyl'],
          DISPOSABLE: ['Bandage', 'Surgical Gloves', 'Syringe 5ml', 'Syringe 10ml', 'IV Cannula', 'Gauze Pad', 'Face Mask'],
          MEDICAL_DEVICE: ['Stethoscope', 'BP Monitor', 'Pulse Oximeter', 'Thermometer', 'Glucometer', 'Defibrillator Pads'],
          REUSABLE: ['Oxygen Cylinder', 'Stretchers', 'Cervical Collar', 'Splint'],
          DRUG: ['Midazolam', 'Ketamine', 'Propofol']
        }
      }
    };
  }

  async updateWarehouseStock(dto: UpdateWarehouseStockDto, requestUser: any) {
    const orgId = requestUser.organisationId || requestUser.org_id;
    
    let stock = await this.warehouseRepo.findOne({
      where: { organisation_id: orgId, inventory_item_id: dto.itemId }
    });

    if (stock) {
      stock.quantity += dto.quantity;
    } else {
      stock = this.warehouseRepo.create({
        organisation_id: orgId,
        inventory_item_id: dto.itemId,
        quantity: dto.quantity
      });
    }

    const saved = await this.warehouseRepo.save(stock);

    await this.auditLogService.log({
      userId: requestUser.id || requestUser.userId,
      action: 'WAREHOUSE_STOCK_UPDATED',
      metadata: { itemId: dto.itemId, added: dto.quantity, newTotal: saved.quantity, reason: dto.reason },
      ipAddress: '0.0.0.0'
    });

    return { data: saved };
  }

  async bulkUpdateWarehouseStock(items: UpdateWarehouseStockDto[], requestUser: any) {
    const results: WarehouseInventory[] = [];
    for (const item of items) {
      const res = await this.updateWarehouseStock(item, requestUser);
      results.push(res.data);
    }
    return { data: results, count: results.length };
  }

  async getWarehouseStock(requestUser: any) {
    const orgId = requestUser.organisationId || requestUser.org_id;
    const stocks = await this.warehouseRepo.find({
      where: { organisation_id: orgId },
      relations: ['item_master']
    });
    return { data: stocks };
  }
}
