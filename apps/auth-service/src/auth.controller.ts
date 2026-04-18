import { Controller, Post, Body, Req, Res, UnauthorizedException, UseGuards, HttpCode, Get, Query, Put, Delete, HttpStatus, Patch, ForbiddenException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuditLogService } from './audit-log.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { ForcePasswordResetDto } from './dto/force-password-reset.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto, UpdateUserDto, UserQueryDto, UpdateMeDto } from './dto/user-management.dto';
import { CreateRoleDto, UpdateRolePermissionsDto } from './dto/role-management.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { IntrospectTokenDto } from './dto/introspect-token.dto';

import { JwtAuthGuard, RolesGuard, Roles, IpWhitelistGuard } from '@app/common';

/**
 * Helper to extract client IP from a request (supports X-Forwarded-For proxies).
 */
function extractIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0];
  }
  const ip = req.ip || '';
  return ip === '::ffff:127.0.0.1' ? '127.0.0.1' : ip;
}

@Controller('v1/auth')
export class AuthController {

  constructor(
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
  ) { }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: any) {
    const profile = await this.authService.getMe(req.user.userId);
    return {
      message: 'User profile retrieved successfully',
      data: profile,
    };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Body() dto: UpdateMeDto, @Req() req: any) {
    const user = await this.authService.updateMe(
      req.user.userId, 
      dto, 
      extractIp(req), 
      req.headers['user-agent'] || 'unknown'
    );
    return {
      message: 'Profile updated successfully',
      data: user,
    };
  }

  // ─────────────────────────────────────────────
  // OTP Flow (existing — mobile/caller)
  // ─────────────────────────────────────────────

  @Post('otp/request')
  requestOtp(@Body() body: RequestOtpDto) {
    return this.authService.sendOtp(body.phone, body.purpose);
  }

  @Post('otp/verify')
  async verifyOtp(@Body() body: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.verifyOtpAndIssueTokens(body.phone, body.otp, body.otp_ref);
    // Setting HTTP-only refresh token mapped to 1.2 specs
    res.cookie('refresh_token', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
    return {
      message: 'Authentication successful',
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        user
      }
    };
  }

  // ─────────────────────────────────────────────
  // Username + Password Login (Spec 5.1)
  // ─────────────────────────────────────────────

  @Post('login')
  async login(@Body() body: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = extractIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await this.authService.login(body, ip, userAgent);

    // Only set cookie if real tokens were issued (not MFA-pending or force-reset)
    if (result.refreshToken) {
      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }

    const responseData: Record<string, any> = {
      mfa_required: result.mfa_required,
      user: result.user,
    };

    if (result.mfa_required) {
      responseData.mfa_session_token = (result as any).mfa_session_token;
    } else if (result.force_password_reset) {
      responseData.force_password_reset = true;
      responseData.access_token = result.accessToken;
    } else {
      responseData.access_token = result.accessToken;
      responseData.refresh_token = result.refreshToken;
    }

    return {
      message: result.mfa_required
        ? 'MFA verification required'
        : result.force_password_reset
          ? 'Password reset required before proceeding'
          : 'Login successful',
      data: responseData,
    };
  }

  // ─────────────────────────────────────────────
  // MFA Endpoints (Spec 5.1)
  // ─────────────────────────────────────────────

  @Post('mfa/verify')
  async verifyMfa(@Body() body: VerifyMfaDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = extractIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    // 1. Extract session token (Header has priority, then Body)
    const authHeader = req.headers['authorization'] || '';
    let mfaSessionToken = authHeader.replace('Bearer ', '').trim();

    if (!mfaSessionToken && body.mfa_session_token) {
      mfaSessionToken = body.mfa_session_token;
    }

    if (!mfaSessionToken) {
      throw new UnauthorizedException('MFA session token required (Header or Body)');
    }

    // 2. Extract verification code (code has priority, then totp_code)
    const verificationCode = body.code || body.totp_code;
    if (!verificationCode) {
      throw new UnauthorizedException('Verification code required (code or totp_code)');
    }

    const result = await this.authService.verifyMfa(
      mfaSessionToken,
      body.method || 'TOTP',
      verificationCode,
      ip,
      userAgent
    );

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // Matching session persistence if required
    });

    return {
      message: 'MFA verification successful',
      data: {
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      },
    };
  }

  @Post('mfa/totp/setup')
  @UseGuards(JwtAuthGuard)
  async setupMfa(@Req() req: any) {
    const ip = extractIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    return this.authService.setupMfa(req.user.userId, ip, userAgent);
  }

  @Post('mfa/totp/verify')
  @UseGuards(JwtAuthGuard)
  async enableMfa(@Body() body: { totp_code: string }, @Req() req: any) {
    const ip = extractIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    return this.authService.enableMfa(req.user.userId, body.totp_code, ip, userAgent);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  async disableMfa(@Body() body: { password: string }, @Req() req: any) {
    const ip = extractIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    return this.authService.disableMfa(req.user.userId, body.password, ip, userAgent);
  }

  // ─────────────────────────────────────────────
  // Password Management (Spec 5.1)
  // ─────────────────────────────────────────────

  @Post('password/reset/request')
  @HttpCode(200)
  async requestPasswordReset(@Body() body: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Post('password/reset/confirm')
  @HttpCode(204)
  async confirmPasswordReset(@Body() body: ConfirmPasswordResetDto) {
    await this.authService.confirmPasswordReset(body.email, body.otp, body.new_password);
  }

  @Post('users/:user_id/force-password-reset')
  @UseGuards(JwtAuthGuard, RolesGuard, IpWhitelistGuard)
  @Roles('CURESELECT_ADMIN', 'Hospital Admin', 'Hospital ED Doctor (ERCP)')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forcePasswordReset(@Req() req: any) {
    const ip = extractIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    await this.authService.forcePasswordReset(req.user, req.params.user_id, ip, userAgent);
  }

  @Post('password/change')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Body() body: ChangePasswordDto, @Req() req: any) {
    const ip = extractIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    return this.authService.changePassword(req.user.userId, body, ip, userAgent);
  }

  // ─────────────────────────────────────────────
  // Token Management (existing)
  // ─────────────────────────────────────────────

  @Post('token/refresh')
  async refreshToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies['refresh_token'];
    if (!token) throw new UnauthorizedException('No refresh token provided');

    const { accessToken, refreshToken } = await this.authService.refreshTokens(token);
    // Rotating the cookie as a best practice, while keeping it out of the JSON body per spec
    res.cookie('refresh_token', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
    return {
      message: 'Token refreshed successfully',
      data: {
        access_token: accessToken,
        expires_in: 900
      }
    };
  }

  @Post('token/revoke')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async revoke(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refresh_token');
  }

  @Post('token/revoke-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async revokeAll(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.revokeAllSessions(req.user.userId);
    res.clearCookie('refresh_token');
  }

  @Post('oauth/token')
  async oauthToken(@Req() req: Request, @Body() body: { grant_type: string, scope?: string }) {
    // 1. Check Authentication Header First
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      throw new UnauthorizedException('Client credentials required in Authorization header (Basic Auth). Note: header must start with "Basic "');
    }

    // 2. Check Grant Type
    if (!body || body.grant_type !== 'client_credentials') {
      throw new UnauthorizedException('Unsupported grant_type. Flow requires {"grant_type": "client_credentials"} in the request body.');
    }

    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('ascii');
    const [clientId, clientSecret] = credentials.split(':');

    if (!clientId || !clientSecret) {
      throw new UnauthorizedException('Invalid Basic Authentication format. Expected "client_id:client_secret" encoded in base64.');
    }

    const result = await this.authService.issueClientCredentials(clientId, clientSecret);

    return {
      access_token: result.accessToken,
      token_type: 'Bearer',
      expires_in: result.expiresIn,
      scope: body.scope || 'all'
    };
  }

  @Post('oauth/introspect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SYSTEM')
  async introspect(@Body() body: IntrospectTokenDto) {
    return this.authService.introspect(body.token);
  }


  // ─────────────────────────────────────────────
  // Audit Log (Spec 5.1 — admin only)
  // ─────────────────────────────────────────────

  @Get('permissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CURESELECT_ADMIN')
  async getPermissionsMaster() {
    const permissions = await this.authService.getPermissionsMaster();
    return {
      data: permissions,
    };
  }

  @Post('users/:user_id/roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CURESELECT_ADMIN')
  async assignRole(@Req() req: any, @Body() body: { role_id: string }) {
    const targetUserId = req.params.user_id;
    const user = await this.authService.assignRole(targetUserId, body.role_id);
    return {
      message: `Role '${body.role_id}' assigned to user successfully`,
      data: user,
    };
  }

  @Delete('users/:user_id/roles/:role_id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CURESELECT_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeRole(@Req() req: any) {
    const userId = req.params.user_id;
    const roleId = req.params.role_id;
    await this.authService.removeRole(userId, roleId);
  }

  // ─────────────────────────────────────────────
  // User Management (Spec 2.4)
  // ─────────────────────────────────────────────

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async listUsers(@Query() query: UserQueryDto, @Req() req: any) {
    const result = await this.authService.findAllUsers(query, req.user);
    return {
      message: 'Users retrieved successfully',
      data: result,
    };
  }

  @Post('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CURESELECT_ADMIN', 'Hospital Admin', 'Hospital ED Doctor (ERCP)')
  async createUser(@Req() req: any, @Body() dto: CreateUserDto) {
    const user = await this.authService.createUser(dto, req.user);
    return {
      data: user,
    };
  }

  @Get('users/:user_id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getUser(@Req() req: any) {
    const user = await this.authService.findOneUser(req.params.user_id, req.user);
    return {
      data: user,
    };
  }

  @Put('users/:user_id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CURESELECT_ADMIN', 'Hospital Admin', 'Hospital ED Doctor (ERCP)')
  async updateUserFull(@Req() req: any, @Body() dto: UpdateUserDto) {
    const user = await this.authService.updateUser(req.params.user_id, dto, req.user);
    return {
      data: user,
    };
  }

  @Patch('users/:user_id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateUserPartial(@Req() req: any, @Body() dto: UpdateUserDto) {
    const targetId = req.params.user_id;
    const isPlatformAdmin = req.user.roles.some((r: string) => ['CURESELECT_ADMIN', 'CureSelect Admin'].includes(r));
    const isHospitalAdmin = req.user.roles.some((r: string) => ['HOSPITAL_ADMIN', 'Hospital Admin'].includes(r));
    const isOwn = req.user.userId === targetId;

    if (!isPlatformAdmin && !isHospitalAdmin && !isOwn) {
      throw new ForbiddenException('Access denied: You can only update your own profile or sub-accounts');
    }

    // Security: Non-platform-admins cannot update their own 'status' or 'role' or 'org_id'
    // Hospital Admins can update these for OTHER users in their org, but NOT for themselves via Patch
    if (!isPlatformAdmin) {
      if (isOwn) {
        delete dto.status;
        delete dto.role;
        delete dto.org_id;
      }
    }

    const user = await this.authService.updateUser(targetId, dto, req.user);
    return {
      data: user,
    };
  }

  @Patch('users/:user_id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CURESELECT_ADMIN', 'Hospital Admin', 'Hospital ED Doctor (ERCP)')
  async updateUserStatus(@Req() req: any, @Body() body: { status: 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'PENDING' }) {
    const targetId = req.params.user_id;
    const user = await this.authService.updateUser(targetId, { status: body.status }, req.user);
    return {
      message: `User status updated to ${body.status}`,
      data: user,
    };
  }

  @Delete('users/:user_id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CURESELECT_ADMIN', 'Hospital Admin', 'Hospital ED Doctor (ERCP)')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivateUser(@Req() req: any) {
    await this.authService.deleteUser(req.params.user_id, req.user);
  }

  @Get('users/:user_id/sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getUserSessions(@Req() req: any) {
    const targetId = req.params.user_id;
    const isPlatformAdmin = req.user.roles.some((r: string) => ['CURESELECT_ADMIN', 'CureSelect Admin'].includes(r));
    const isHospitalAdmin = req.user.roles.some((r: string) => ['HOSPITAL_ADMIN', 'Hospital Admin'].includes(r));
    const isOwn = req.user.userId === targetId;

    if (!isPlatformAdmin && !isHospitalAdmin && !isOwn) {
      throw new ForbiddenException('Access denied: You can only view your own sessions or sub-accounts');
    }

    const sessions = await this.authService.getUserSessions(targetId, req.user);
    return {
      data: sessions,
    };
  }

  @Delete('users/:user_id/sessions/:session_id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(@Req() req: any) {
    const targetId = req.params.user_id;
    const sessionId = req.params.session_id;
    const isPlatformAdmin = req.user.roles.some((r: string) => ['CURESELECT_ADMIN', 'CureSelect Admin'].includes(r));
    const isHospitalAdmin = req.user.roles.some((r: string) => ['HOSPITAL_ADMIN', 'Hospital Admin'].includes(r));
    const isOwn = req.user.userId === targetId;

    if (!isPlatformAdmin && !isHospitalAdmin && !isOwn) {
      throw new ForbiddenException('Access denied: You can only terminate your own sessions or sub-accounts');
    }

    await this.authService.revokeSession(targetId, sessionId, req.user);
  }

  @Get('users/:user_id/audit-log')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CURESELECT_ADMIN', 'Hospital Admin', 'Hospital ED Doctor (ERCP)')
  async getUserAuditLog(@Req() req: any, @Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    const targetUserId = req.params.user_id;
    const isPlatformAdmin = req.user.roles.some((r: string) => ['CURESELECT_ADMIN', 'CureSelect Admin'].includes(r));
    const isHospitalLevelAdmin = req.user.roles.some((r: string) => 
      ['Hospital Admin', 'HOSPITAL_ADMIN', 'Hospital ED Doctor (ERCP)', 'ED_DOCTOR'].includes(r)
    );

    // Enforce tenant isolation for Audit Logs
    if (isHospitalLevelAdmin && !isPlatformAdmin) {
      await this.authService.findOneUser(targetUserId, req.user);
    }

    const parsedLimit = Math.min(parseInt(limit || '50', 10), 100);
    return this.auditLogService.getLogsForUser(targetUserId, parsedLimit, cursor);
  }

  @Get('roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CURESELECT_ADMIN', 'Hospital Admin', 'Hospital ED Doctor (ERCP)')
  async getRoles(@Req() req: any) {
    const isPlatformAdmin = req.user.roles.some((r: string) => ['CURESELECT_ADMIN', 'CureSelect Admin'].includes(r));
    
    // For Hospital Admins and ED Doctors, filter by 'Hospital' scope
    const scope = isPlatformAdmin ? undefined : 'Hospital';
    const roles = await this.authService.getRolesWithPermissions(scope);
    
    return {
      data: roles,
    };
  }

  @Post('roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CURESELECT_ADMIN')
  async createRole(@Body() dto: CreateRoleDto) {
    const role = await this.authService.createRole(dto);
    return {
      data: role,
    };
  }

  @Get('roles/:role_id/permissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CURESELECT_ADMIN')
  async getRolePermissions(@Req() req: any) {
    const roleId = req.params.role_id;
    const permissions = await this.authService.getPermissionsByRole(roleId);
    return {
      data: permissions,
    };
  }

  @Put('roles/:role_id/permissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CURESELECT_ADMIN')
  async updateRolePermissions(@Body() dto: UpdateRolePermissionsDto, @Req() req: any) {
    const roleId = req.params.role_id;
    const role = await this.authService.updateRolePermissions(roleId, dto.permissions, req.user.userId);
    return {
      data: role,
    };
  }

  @Delete('roles/:role_id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CURESELECT_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRole(@Req() req: any) {
    await this.authService.deleteRole(req.params.role_id);
  }

  @Get('audit-logs')
  @UseGuards(JwtAuthGuard, RolesGuard, IpWhitelistGuard)
  @Roles('CURESELECT_ADMIN')
  async getAuditLogs(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    const parsedLimit = Math.min(parseInt(limit || '50', 10), 100);
    const parsedOffset = parseInt(offset || '0', 10);
    const { logs, total } = await this.auditLogService.getAllLogs(parsedLimit, parsedOffset);
    return {
      message: 'Audit logs retrieved',
      data: { logs, total, limit: parsedLimit, offset: parsedOffset },
    };
  }
}
