import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, FindOptionsWhere } from 'typeorm';
import { 
  SystemConfig, 
  FeatureFlag, 
  IotDeviceProfile, 
  AuditLogService 
} from '@app/common';
import { 
  UpdateSystemConfigDto, 
  ToggleFeatureFlagDto, 
  CreateIotProfileDto 
} from './dto/platform-config.dto';

@Injectable()
export class PlatformConfigService {
  constructor(
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
    @InjectRepository(FeatureFlag)
    private readonly flagRepo: Repository<FeatureFlag>,
    @InjectRepository(IotDeviceProfile)
    private readonly iotRepo: Repository<IotDeviceProfile>,
    private readonly auditLogService: AuditLogService,
  ) {}

  // --- Global System Config ---

  async setConfig(dto: UpdateSystemConfigDto, adminId: string, ip: string) {
    let config = await this.configRepo.findOneBy({ key: dto.key });
    if (!config) {
      config = this.configRepo.create(dto);
    } else {
      Object.assign(config, dto);
    }
    await this.configRepo.save(config);

    await this.auditLogService.log({
      userId: adminId,
      action: 'PLATFORM_CONFIG_UPDATED',
      ipAddress: ip,
      metadata: { key: dto.key, category: dto.category },
    });

    return config;
  }

  async getAllConfigs() {
    return this.configRepo.find();
  }

  // --- Feature Flags (Hierarchical Logic) ---

  async toggleFlag(dto: ToggleFeatureFlagDto, adminId: string, ip: string) {
    const where: FindOptionsWhere<FeatureFlag> = { 
      name: dto.name, 
      scope: dto.scope,
      scopeId: dto.scopeId || IsNull()
    };

    let flag = await this.flagRepo.findOne({ where });

    if (!flag) {
      flag = this.flagRepo.create({
        ...dto,
        scopeId: dto.scopeId || null
      });
    } else {
      flag.isEnabled = dto.isEnabled;
    }
    await this.flagRepo.save(flag);

    await this.auditLogService.log({
      userId: adminId,
      action: 'FEATURE_FLAG_TOGGLED',
      ipAddress: ip,
      metadata: { flag: dto.name, scope: dto.scope, enabled: dto.isEnabled },
    });

    return flag;
  }

  async getFlags() {
    return this.flagRepo.find();
  }

  // --- IoT Device Profiles ---

  async createIotProfile(dto: CreateIotProfileDto, adminId: string, ip: string) {
    const profile = this.iotRepo.create(dto);
    await this.iotRepo.save(profile);

    await this.auditLogService.log({
      userId: adminId,
      action: 'IOT_PROFILE_CREATED',
      ipAddress: ip,
      metadata: { model: dto.model_name, firmware: dto.firmware_version },
    });

    return profile;
  }

  async getIotProfiles() {
    return this.iotRepo.find({ where: { isActive: true } });
  }
}
