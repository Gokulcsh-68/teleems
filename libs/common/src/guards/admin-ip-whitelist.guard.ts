import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminIpWhitelistGuard implements CanActivate {
  private readonly logger = new Logger(AdminIpWhitelistGuard.name);
  private readonly whitelistedIps: string[];

  constructor(private configService: ConfigService) {
    const ips = this.configService.get<string>('ADMIN_IP_WHITELIST') || '';
    this.whitelistedIps = ips
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Only apply whitelisting to CureSelect Admin and other platform admins
    const isPlatformAdmin = user?.roles?.some((role: string) =>
      ['CureSelect Admin', 'CURESELECT_ADMIN', 'CCE'].includes(role),
    );

    if (!isPlatformAdmin) {
      return true; // Not a platform admin, allow through to other guards (RolesGuard will handle permissions)
    }

    // If no whitelist is configured, allow all for dev convenience (but log it)
    if (this.whitelistedIps.length === 0) {
      this.logger.warn(
        'ADMIN_IP_WHITELIST is empty. IP whitelisting is DISABLED for Admin roles.',
      );
      return true;
    }

    const clientIp =
      request.headers['x-forwarded-for'] ||
      request.connection.remoteAddress ||
      request.ip;

    const isWhitelisted = this.whitelistedIps.includes(clientIp);

    if (!isWhitelisted) {
      this.logger.warn(
        `Admin login attempted from unauthorized IP: ${clientIp} for user ${user.userId}`,
      );
      throw new ForbiddenException(
        `Access denied: IP ${clientIp} is not whitelisted for administrative access.`,
      );
    }

    return true;
  }
}
