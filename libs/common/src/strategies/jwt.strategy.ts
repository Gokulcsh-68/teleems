import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import * as fs from 'fs';
import * as path from 'path';

const ACTIVITY_UPDATE_DEBOUNCE_MS = 60 * 1000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private sessionTimeoutMs: number;

  constructor(
    config: ConfigService,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {
    let publicKey = config.get('JWT_PUBLIC_KEY');

    if (!publicKey) {
      try {
        const keyPath = path.join(process.cwd(), 'secrets', 'jwtRS256.key.pub');
        publicKey = fs.readFileSync(keyPath, 'utf8');
        console.log(`[JwtStrategy] Loaded Public Key from: ${keyPath}`);
      } catch (e) {
        console.warn('JWT Public Key not found in secrets folder, using ENV.');
      }
    } else {
      console.log('[JwtStrategy] Using Public Key from ENV');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
    });

    if (!publicKey) {
      console.error('[JwtStrategy] CRITICAL: No Public Key available for verification!');
    } else {
      const keySnippet = publicKey.toString().substring(0, 30).replace(/\n/g, '');
      console.log(`[JwtStrategy] Initialized with Public Key: ${keySnippet}...`);
    }

    const configuredTimeout = parseInt(
      config.get('ADMIN_SESSION_TIMEOUT_MINUTES') || '30',
      10,
    );
    this.sessionTimeoutMs = configuredTimeout * 60 * 1000;
  }

  async validate(payload: any) {
    // 1. Check for system/machine tokens
    if (payload.role === 'SYSTEM' || (payload.roles && payload.roles.includes('SYSTEM'))) {
      return { userId: payload.sub, roles: payload.roles || [payload.role] };
    }

    // 2. Fetch full user to verify status and lastActiveAt
    const user = await this.userRepo.findOneBy({ id: payload.sub });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is not active');
    }

    // 3. Update activity (debounced)
    const now = new Date();
    if (!user.lastActiveAt || now.getTime() - user.lastActiveAt.getTime() > ACTIVITY_UPDATE_DEBOUNCE_MS) {
      this.userRepo.update(user.id, { lastActiveAt: now }).catch(() => {});
    }

    // 4. Return unified context
    return {
      userId: user.id,
      phone: user.phone,
      roles: user.roles,
      organisationId: user.organisationId || payload.org_id,
      hospitalId: user.hospitalId || payload.hospital_id,
    };
  }
}
