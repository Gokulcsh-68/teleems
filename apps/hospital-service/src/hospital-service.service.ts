import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hospital, AuditLogService, MapsService } from '@app/common';
import { CreateHospitalDto, UpdateHospitalDto, NearestHospitalDto } from './dto/hospital.dto';

@Injectable()
export class HospitalServiceService {
  constructor(
    @InjectRepository(Hospital)
    private readonly hospitalRepo: Repository<Hospital>,
    private readonly auditLogService: AuditLogService,
    private readonly mapsService: MapsService,
  ) {}

  async createHospital(dto: CreateHospitalDto, adminId: string, ip: string) {
    const hospitalData = { ...dto };

    // Automatic Geocoding if coordinates are missing but address is present
    if ((!hospitalData.gps_lat || !hospitalData.gps_lon) && hospitalData.address) {
      const coords = await this.mapsService.geocode(hospitalData.address);
      hospitalData.gps_lat = coords.lat;
      hospitalData.gps_lon = coords.lng;
    }

    const hospital = await this.hospitalRepo.save(
      this.hospitalRepo.create(hospitalData),
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

  async findNearest(dto: NearestHospitalDto) {
    const hospitals = await this.hospitalRepo.find({
      where: { status: 'ACTIVE' },
    });

    const radius = dto.radius_km || 50; // Default 50km radius

    const result = hospitals
      .map((h) => {
        const distance = this.mapsService['haversine'](
          dto.lat,
          dto.lng,
          h.gps_lat,
          h.gps_lon,
        );
        return { ...h, distance };
      })
      .filter((h) => h.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

    return result;
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
    
    // Automatic Geocoding if address is updated and coordinates are not provided
    if (dto.address && (!dto.gps_lat || !dto.gps_lon)) {
      const coords = await this.mapsService.geocode(dto.address);
      dto.gps_lat = coords.lat;
      dto.gps_lon = coords.lng;
    }

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
