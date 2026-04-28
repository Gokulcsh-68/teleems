import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@app/common';
import * as fs from 'fs';
import * as path from 'path';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes default
const ACTIVITY_UPDATE_DEBOUNCE_MS = 60 * 1000; // Only update lastActiveAt once per minute to reduce DB writes

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
        publicKey = fs.readFileSync(
          path.join(process.cwd(), 'secrets', 'jwtRS256.key.pub'),
          'utf8',
        );
      } catch (e) {
        // Fallback for when keys are only in ENV
        console.warn('JWT Public Key not found in secrets folder, using ENV.');
      }
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
    });

    const configuredTimeout = parseInt(
      config.get('ADMIN_SESSION_TIMEOUT_MINUTES') || '30',
      10,
    );
    this.sessionTimeoutMs = configuredTimeout * 60 * 1000;
  }

  async validate(payload: any) {
    // Skip session checks for system/machine tokens
    if (
      payload.role === 'SYSTEM' ||
      (payload.roles && payload.roles.includes('SYSTEM'))
    ) {
      return { userId: payload.sub, roles: payload.roles || [payload.role] };
    }

    // Skip session checks for special-purpose tokens (MFA, password reset)
    if (payload.purpose) {
      return {
        userId: payload.sub,
        roles: payload.roles || [payload.role],
        purpose: payload.purpose,
      };
    }

    const user = await this.userRepo.findOneBy({ id: payload.sub });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Spec 2.1 compliance: If token was issued BEFORE last revocation, reject it.
    if (user.tokensRevokedAt && payload.iat) {
      const iatTime = payload.iat * 1000;
      if (iatTime < user.tokensRevokedAt.getTime()) {
        throw new UnauthorizedException('Session has been revoked');
      }
    }

    // Spec 5.1: Session timeout after 30 minutes of inactivity
    // Only enforce for web roles (Admin, Hospital, Fleet) — not for mobile CALLER role
    const webRoles = [
      'CureSelect Admin',
      'CURESELECT_ADMIN',
      'Hospital Admin',
      'Fleet Operator',
      'Hospital Coordinator',
      'Hospital ED Doctor (ERCP)',
    ];
    const userHasWebRole = user.roles.some((role) => webRoles.includes(role));

    if (userHasWebRole && user.lastActiveAt) {
      const inactiveDuration = Date.now() - user.lastActiveAt.getTime();
      if (inactiveDuration > this.sessionTimeoutMs) {
        throw new UnauthorizedException(
          'Session expired due to inactivity. Please log in again.',
        );
      }
    }

    // Debounced activity update: only write to DB if last update was > 1 minute ago
    const now = new Date();
    if (
      !user.lastActiveAt ||
      now.getTime() - user.lastActiveAt.getTime() > ACTIVITY_UPDATE_DEBOUNCE_MS
    ) {
      // Fire-and-forget — don't block the request
      this.userRepo.update(user.id, { lastActiveAt: now }).catch(() => {});
    }

    return {
      userId: user.id,
      roles: user.roles,
      organisationId: user.organisationId,
    };
  }
}
