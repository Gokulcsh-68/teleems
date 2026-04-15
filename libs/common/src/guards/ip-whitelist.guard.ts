import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class IpWhitelistGuard implements CanActivate {
  private allowedIps: string[];

  constructor(private configService: ConfigService) {
    const raw = this.configService.get<string>('ADMIN_WHITELISTED_IPS') || '*';
    this.allowedIps = raw.split(',').map(ip => ip.trim()).filter(Boolean);
  }

  canActivate(context: ExecutionContext): boolean {
    // Wildcard bypass for development
    if (this.allowedIps.includes('*')) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const clientIp = this.extractClientIp(request);

    if (!this.allowedIps.includes(clientIp)) {
      throw new ForbiddenException(
        `Access denied: IP ${clientIp} is not whitelisted for admin access`,
      );
    }

    return true;
  }

  private extractClientIp(request: any): string {
    // Support proxied environments (X-Forwarded-For)
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : forwarded[0];
    }
    // Normalize IPv6 loopback
    const ip = request.ip || request.connection?.remoteAddress || '';
    return ip === '::ffff:127.0.0.1' ? '127.0.0.1' : ip;
  }
}
