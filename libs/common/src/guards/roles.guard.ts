import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No roles specified = public or JWT-only
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.roles || !Array.isArray(user.roles)) {
      throw new ForbiddenException('Access denied: No roles assigned');
    }

    // Resilience Mapping for v4.0 Migration
    const roleAliases: Record<string, string[]> = {
      'CureSelect Admin': ['CURESELECT_ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN'],
      'Hospital Admin': ['HOSPITAL_ADMIN', 'HOSPITAL_MANAGER'],
      'Hospital Coordinator': [
        'COORDINATOR',
        'HOSPITAL_COORDINATOR',
        'CO-ORDINATOR',
      ],
      'Hospital ED Doctor (ERCP)': [
        'ED_DOCTOR',
        'ERCP_DOCTOR',
        'HOSPITAL_DOCTOR',
      ],
      'Hospital Nurse': ['NURSE', 'HOSPITAL_NURSE'],
      'Call Centre Executive (CCE)': ['CCE', 'DISPATCHER'],
      'EMT / Paramedic': ['EMT', 'PARAMEDIC'],
      'Caller (Public)': ['CALLER', 'USER'],
      'Fleet Operator': ['FLEET_MANAGER', 'FLEET_OPERATOR'],
    };

    const hasAuthorizedRole = requiredRoles.some((requiredRole) => {
      // 1. Direct Match
      if (user.roles.includes(requiredRole)) return true;

      // 2. Alias Match (Legacy support)
      const aliases = roleAliases[requiredRole];
      if (aliases && aliases.some((alias) => user.roles.includes(alias)))
        return true;

      // 3. Reverse Alias / Combined Role Match
      // If user has "EMT / Paramedic" and required is "EMT", authorize.
      return user.roles.some(userRole => {
        // If the user role contains the required role as a distinct word
        const words = userRole.split(/[\s/]+/);
        return words.includes(requiredRole);
      });
    });

    if (!hasAuthorizedRole) {
      throw new ForbiddenException(
        `Access denied: Your roles [${user.roles.join(', ')}] are not authorized for this resource. (Required: ${requiredRoles.join(', ')})`,
      );
    }

    return true;
  }
}
