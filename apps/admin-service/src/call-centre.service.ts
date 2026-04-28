import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CCEProfile, AuditLogService, RedisService } from '@app/common';
import { CreateCCEDto, UpdateCCEProfileDto } from './dto/call-centre.dto';
import { AuthService } from '../../auth-service/src/auth.service';

@Injectable()
export class CallCentreService {
  constructor(
    @InjectRepository(CCEProfile)
    private readonly profileRepo: Repository<CCEProfile>,
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
    private readonly redisService: RedisService,
  ) {}

  async createCCE(dto: CreateCCEDto, adminId: string, ip: string) {
    // 1. Create User via AuthService
    const user = await this.authService.createUser(
      {
        username: dto.username,
        phone: dto.phone,
        email: dto.email,
        name: dto.name,
        password: 'TemporaryPassword123!',
        role: 'Call Centre Executive (CCE)',
      },
      { userId: adminId, roles: ['CURESELECT_ADMIN'] } as any,
    );

    // 2. Initialize CCE Profile
    const profile = this.profileRepo.create({
      userId: user.id,
      assigned_zones: [],
      sla_config: { max_hold_seconds: 60, max_dispatch_seconds: 180 },
    });
    await this.profileRepo.save(profile);

    await this.auditLogService.log({
      userId: adminId,
      action: 'CCE_ACCOUNT_CREATED',
      ipAddress: ip,
      metadata: { cceId: user.id, username: dto.username },
    });

    return { user, profile };
  }

  async updateProfile(
    userId: string,
    dto: UpdateCCEProfileDto,
    adminId: string,
    ip: string,
  ) {
    const profile = await this.profileRepo.findOneBy({ userId });
    if (!profile)
      throw new NotFoundException(`CCE Profile for user ${userId} not found`);

    Object.assign(profile, dto);
    await this.profileRepo.save(profile);

    await this.auditLogService.log({
      userId: adminId,
      action: 'CCE_PROFILE_UPDATED',
      ipAddress: ip,
      metadata: { cceId: userId, updates: dto },
    });

    return profile;
  }

  async getDashboard() {
    // 1. Fetch all profiles
    const profiles = await this.profileRepo.find();

    // 2. Decorate with real-time status from Redis
    const dashboard = await Promise.all(
      profiles.map(async (p) => {
        const statusJson = await this.redisService.get(
          `cce:status:${p.userId}`,
        );
        return {
          userId: p.userId,
          zones: p.assigned_zones,
          routing: p.routing_strategy,
          sla: p.sla_config,
          status: statusJson ? JSON.parse(statusJson) : { state: 'OFFLINE' },
        };
      }),
    );

    return dashboard;
  }
}
