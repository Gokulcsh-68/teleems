import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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

    const hasAuthorizedRole = requiredRoles.some((role) =>
      user.roles.includes(role),
    );

    if (!hasAuthorizedRole) {
      throw new ForbiddenException(
        `Access denied: Your roles [${user.roles.join(', ')}] are not authorized for this resource`,
      );
    }

    return true;
  }
}
