import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Session } from './entities/session.entity';
import { AuditLogService } from './audit-log.service';
import { SYSTEM_ROLES } from './constants/roles.constants';
import { PERMISSION_MASTER } from './constants/permissions.constants';
import { CreateUserDto, UpdateUserDto, UserQueryDto } from './dto/user-management.dto';
import { CreateRoleDto, UpdateRolePermissionsDto } from './dto/role-management.dto';
import { PaginatedResponse, encodeCursor, decodeCursor } from '@app/common';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';


const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const MFA_SESSION_EXPIRY = '5m';
const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class AuthService implements OnModuleInit {

  private otpStore = new Map<string, { otp: string; otpRef: string; expiresAt: number }>();

  constructor(
    private jwtService: JwtService,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Session) private sessionRepo: Repository<Session>,
    private auditLogService: AuditLogService,
  ) {}

  async onModuleInit() {
    await this.seedRoles();
  }

  private async seedRoles() {
    const count = await this.roleRepo.count();
    if (count === 0) {
      console.log('[SEED] No roles found in DB. Seeding initial Roles...');
      await this.roleRepo.save(SYSTEM_ROLES);
      console.log(`[SEED] Successfully seeded ${SYSTEM_ROLES.length} roles.`);
    }
  }

  // ─────────────────────────────────────────────
  // OTP Flow (existing — for CALLER / mobile)
  // ─────────────────────────────────────────────

  async sendOtp(phone: string, purpose: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpRef = Math.random().toString(36).substring(2, 10).toUpperCase();
    const expiresIn = 120; // 2 minutes as per spec 2.1
    
    this.otpStore.set(phone, { 
      otp, 
      otpRef,
      expiresAt: Date.now() + expiresIn * 1000 
    });

    console.log(`[OTP] ${phone} (${purpose}): ${otp} [Ref: ${otpRef}]`);
    
    return { 
      message: 'OTP sent successfully',
      data: {
        otp_ref: otpRef, 
        expires_in: expiresIn,
        otp: process.env.NODE_ENV !== 'production' ? otp : undefined 
      }
    };
  }

  async verifyOtpAndIssueTokens(phone: string, otp: string, otpRef: string) {
    const stored = this.otpStore.get(phone);
    if (!stored || stored.otp !== otp || stored.otpRef !== otpRef || Date.now() > stored.expiresAt) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    this.otpStore.delete(phone);

    let user = await this.userRepo.findOneBy({ phone });
    if (!user) {
      user = this.userRepo.create({ phone, roles: ['CALLER'] });
      await this.userRepo.save(user);
    }
    return this.issueTokens(user, '0.0.0.0', 'unknown');
  }

  /**
   * Helper to issue stateful Session and JWT tokens
   */
  private async issueTokens(user: User, ipAddress: string, userAgent: string) {
    const session = this.sessionRepo.create({
      userId: user.id,
      ipAddress,
      userAgent,
      isValid: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days (Refresh Token max)
    });
    await this.sessionRepo.save(session);

    const payload = { 
      sub: user.id, 
      roles: user.roles,
      org_id: user.organisationId,
      sid: session.id 
    };
    
    const accessToken = this.jwtService.sign(payload, { expiresIn: '3h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    return { accessToken, refreshToken, user };
  }

  // ─────────────────────────────────────────────
  // Username + Password Login (Spec 5.1)
  // ─────────────────────────────────────────────

  async login(loginDto: LoginDto, ipAddress: string, userAgent: string) {
    const { username, password } = loginDto;
    
    // Explicitly select password and mfaSecret since they are marked select: false
    const user = await this.userRepo.createQueryBuilder('user')
      .addSelect('user.password')
      .addSelect('user.mfaSecret')
      .where('user.username = :username', { username })
      .getOne();

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      await this.auditLogService.log({
        userId: user.id,
        action: 'LOGIN_BLOCKED_LOCKED',
        ipAddress,
        userAgent,
        metadata: { reason: 'Account locked', minutesLeft },
      });
      throw new ForbiddenException(
        `Account is locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
      );
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      // Increment failed attempts
      const newAttempts = user.failedLoginAttempts + 1;
      const updates: Partial<User> = { failedLoginAttempts: newAttempts };

      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        updates.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
      }

      await this.userRepo.update(user.id, updates);

      await this.auditLogService.log({
        userId: user.id,
        action: 'LOGIN_FAILED',
        ipAddress,
        userAgent,
        metadata: { attempt: newAttempts, locked: newAttempts >= MAX_FAILED_ATTEMPTS },
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful password validation
    await this.userRepo.update(user.id, { 
      failedLoginAttempts: 0, 
      lockedUntil: null as any,
      lastActiveAt: new Date(),
    });

    // Check if forced password reset is required
    if (user.forcePasswordReset) {
      const tempToken = this.jwtService.sign(
        { sub: user.id, roles: user.roles, purpose: 'password_reset' },
        { expiresIn: '10m' },
      );

      await this.auditLogService.log({
        userId: user.id,
        action: 'LOGIN_FORCE_PASSWORD_RESET',
        ipAddress,
        userAgent,
      });

      return {
        accessToken: tempToken,
        refreshToken: null,
        mfa_required: false,
        force_password_reset: true,
        user: { id: user.id, username: user.username, roles: user.roles },
      };
    }

    // Check if MFA is enabled
    if (user.mfaEnabled && user.mfaSecret) {
      // Issue a short-lived MFA session token — NO access/refresh tokens yet
      const mfaSessionToken = this.jwtService.sign(
        { sub: user.id, roles: user.roles, purpose: 'mfa_verification' },
        { expiresIn: MFA_SESSION_EXPIRY },
      );

      await this.auditLogService.log({
        userId: user.id,
        action: 'LOGIN_MFA_REQUIRED',
        ipAddress,
        userAgent,
      });

      return {
        accessToken: null,
        refreshToken: null,
        mfa_required: true,
        mfa_session_token: mfaSessionToken,
        force_password_reset: false,
        user: { id: user.id, username: user.username, roles: user.roles },
      };
    }

    // No MFA — issue tokens directly
    const { accessToken, refreshToken } = await this.issueTokens(user, ipAddress, userAgent);

    await this.auditLogService.log({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      ipAddress,
      userAgent,
    });

    return { 
      accessToken, 
      refreshToken, 
      mfa_required: false,
      force_password_reset: false,
      user: {
        id: user.id,
        phone: user.phone,
        username: user.username,
        roles: user.roles,
      },
    };
  }

  // ─────────────────────────────────────────────
  // MFA — TOTP (Spec 5.1)
  // ─────────────────────────────────────────────

  /**
   * Verify MFA challenge after login — supports TOTP or SMS OTP methods.
   */
  async verifyMfa(mfaSessionToken: string, method: 'TOTP' | 'SMS', code: string, ipAddress: string, userAgent: string) {
    let tokenPayload: any;
    try {
      tokenPayload = this.jwtService.verify(mfaSessionToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA session');
    }

    if (tokenPayload.purpose !== 'mfa_verification') {
      throw new UnauthorizedException('Invalid MFA session token');
    }

    const user = await this.userRepo.createQueryBuilder('user')
      .addSelect('user.mfaSecret')
      .addSelect('user.mfaBackupCodes')
      .where('user.id = :id', { id: tokenPayload.sub })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    let isValid = false;

    if (method === 'TOTP') {
      // Verify TOTP code via speakeasy
      if (!user.mfaSecret) {
        throw new UnauthorizedException('TOTP not configured for this user');
      }
      isValid = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: code,
        window: 1,
      });

      // If TOTP fails, check backup codes
      if (!isValid && user.mfaBackupCodes && user.mfaBackupCodes.length > 0) {
        for (let i = 0; i < user.mfaBackupCodes.length; i++) {
          const match = await bcrypt.compare(code, user.mfaBackupCodes[i]);
          if (match) {
            isValid = true;
            // Remove used backup code
            const updatedCodes = [...user.mfaBackupCodes];
            updatedCodes.splice(i, 1);
            await this.userRepo.update(user.id, { mfaBackupCodes: updatedCodes });
            break;
          }
        }
      }
    } else if (method === 'SMS') {
      // Verify SMS OTP from the in-memory OTP store
      const stored = this.otpStore.get(user.phone);
      if (stored && stored.otp === code && Date.now() <= stored.expiresAt) {
        isValid = true;
        this.otpStore.delete(user.phone);
      }
    }

    if (!isValid) {
      await this.auditLogService.log({
        userId: user.id,
        action: 'MFA_VERIFY_FAILED',
        ipAddress,
        userAgent,
        metadata: { method },
      });
      throw new UnauthorizedException(`Invalid ${method} code`);
    }

    // MFA passed — issue real tokens
    const { accessToken, refreshToken } = await this.issueTokens(user, ipAddress, userAgent);

    await this.userRepo.update(user.id, { lastActiveAt: new Date() });

    await this.auditLogService.log({
      userId: user.id,
      action: 'MFA_VERIFY_SUCCESS',
      ipAddress,
      userAgent,
      metadata: { method },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Get current user profile.
   */
  async getMe(userId: string) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return {
      userId: user.id,
      roles: user.roles,
      phone: user.phone,
      email: user.email,
    };
  }

  /**
   * Generate a new TOTP secret + QR code for MFA setup.
   */
  async setupMfa(userId: string, ipAddress: string, userAgent: string) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException('User not found');

    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled. Disable it first to reconfigure.');
    }

    const issuer = process.env.MFA_ISSUER || 'TeleEMS';
    const secret = speakeasy.generateSecret({
      name: `${issuer}:${user.username || user.phone}`,
      issuer,
      length: 32,
    });

    // Store the secret temporarily (not enabled until confirmed)
    await this.userRepo.update(userId, { mfaSecret: secret.base32 });

    // Generate QR code as SVG with "TeleEMS" branding in the center
    const qrSvgString = await QRCode.toString(secret.otpauth_url!, {
      type: 'svg',
      errorCorrectionLevel: 'H', // High error correction (30%) to survive center overlay
      margin: 2,
      width: 300,
      color: { dark: '#1a1a2e', light: '#ffffff' },
    });

    // Inject TeleEMS branding text into the center of the SVG
    const brandedSvg = qrSvgString.replace(
      '</svg>',
      `<rect x="110" y="135" width="80" height="30" rx="4" fill="#ffffff" stroke="#1a1a2e" stroke-width="1"/>
       <text x="150" y="155" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="bold" fill="#1a1a2e">TeleEMS</text>
      </svg>`,
    );

    const qr_code_base64 = `data:image/svg+xml;base64,${Buffer.from(brandedSvg).toString('base64')}`;

    await this.auditLogService.log({
      userId,
      action: 'MFA_SETUP_INITIATED',
      ipAddress,
      userAgent,
    });

    return {
      message: 'MFA setup initiated. Scan the QR code and verify with a TOTP code.',
      data: {
        totp_uri: secret.otpauth_url,
        secret: secret.base32,
        qr_code_base64,
      },
    };
  }

  /**
   * Confirm MFA setup by verifying a TOTP code → enables MFA and generates backup codes.
   */
  async enableMfa(userId: string, totpCode: string, ipAddress: string, userAgent: string) {
    const user = await this.userRepo.createQueryBuilder('user')
      .addSelect('user.mfaSecret')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA setup has not been initiated. Call /mfa/totp/setup first.');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: totpCode,
      window: 1,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code. MFA not enabled.');
    }

    // Generate 10 backup codes (8 chars each, alphanumeric)
    const backupCodes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = Array.from({ length: 8 }, () =>
        'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.charAt(Math.floor(Math.random() * 32))
      ).join('');
      backupCodes.push(code);
    }

    // Hash backup codes before storing
    const hashedCodes = await Promise.all(
      backupCodes.map(code => bcrypt.hash(code, 10)),
    );

    await this.userRepo.update(userId, {
      mfaEnabled: true,
      mfaBackupCodes: hashedCodes,
    });

    await this.auditLogService.log({
      userId,
      action: 'MFA_ENABLED',
      ipAddress,
      userAgent,
      metadata: { backup_codes_generated: backupCodes.length },
    });

    return {
      message: 'MFA has been successfully enabled. Save your backup codes securely.',
      data: { backup_codes: backupCodes },
    };
  }

  /**
   * Disable MFA on the account (requires password confirmation for security).
   */
  async disableMfa(userId: string, password: string, ipAddress: string, userAgent: string) {
    const user = await this.userRepo.createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user) throw new UnauthorizedException('User not found');

    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not currently enabled.');
    }

    // Require password confirmation to disable MFA
    if (!user.password || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid password. MFA disable requires password confirmation.');
    }

    await this.userRepo.update(userId, { mfaEnabled: false, mfaSecret: null as any });

    await this.auditLogService.log({
      userId,
      action: 'MFA_DISABLED',
      ipAddress,
      userAgent,
    });

    return {
      message: 'MFA has been successfully disabled.',
      data: { mfa_enabled: false },
    };
  }

  // ─────────────────────────────────────────────
  // Password Management (Spec 5.1)
  // ─────────────────────────────────────────────

  /**
   * Force password reset on a sub-account (admin-only).
   */
  async forcePasswordReset(creator: any, targetUserId: string, ipAddress: string, userAgent: string) {
    const targetUser = await this.userRepo.findOneBy({ id: targetUserId });
    if (!targetUser) {
      throw new BadRequestException('Target user not found');
    }

    const isPlatformAdmin = creator.roles.some((r: string) => ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r));
    const isHospitalAdmin = creator.roles.some((r: string) => ['Hospital Admin', 'HOSPITAL_ADMIN'].includes(r));
    const isEdDoctor = creator.roles.some((r: string) => ['Hospital ED Doctor (ERCP)', 'ED_DOCTOR'].includes(r));

    if ((isHospitalAdmin || isEdDoctor) && !isPlatformAdmin) {
      if (targetUser.organisationId !== creator.organisationId) {
        throw new ForbiddenException('Access denied: You can only reset passwords for users in your own organization');
      }
    }

    await this.userRepo.update(targetUserId, { forcePasswordReset: true });

    await this.auditLogService.log({
      userId: creator.userId,
      action: 'FORCE_PASSWORD_RESET',
      ipAddress,
      userAgent,
      metadata: { targetUserId, targetUsername: targetUser.username },
    });

    return {
      message: `Password reset has been forced for user ${targetUser.username || targetUserId}.`,
      data: { target_user_id: targetUserId },
    };
  }

  /**
   * Change own password (handles forced resets and voluntary changes).
   */
  async changePassword(userId: string, dto: ChangePasswordDto, ipAddress: string, userAgent: string) {
    const user = await this.userRepo.createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user || !user.password) {
      throw new UnauthorizedException('User not found');
    }

    const isCurrentValid = await bcrypt.compare(dto.current_password, user.password);
    if (!isCurrentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.current_password === dto.new_password) {
      throw new BadRequestException('New password must be different from current password');
    }

    const hashedPassword = await bcrypt.hash(dto.new_password, BCRYPT_SALT_ROUNDS);
    await this.userRepo.update(userId, { 
      password: hashedPassword, 
      forcePasswordReset: false,
    });

    await this.auditLogService.log({
      userId,
      action: 'PASSWORD_CHANGED',
      ipAddress,
      userAgent,
    });

    return {
      message: 'Password changed successfully.',
      data: {},
    };
  }

  /**
   * Request a password reset email for admin accounts (public endpoint).
   * Always returns the same response to prevent email enumeration attacks.
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const GENERIC_RESPONSE = { message: 'If an account with that email exists, a password reset link has been sent.' };

    const user = await this.userRepo.findOne({
      where: { email },
      select: ['id', 'username', 'email', 'roles'],
    });

    const adminRoles = ['CURESELECT_ADMIN', 'HOSPITAL_ADMIN', 'FLEET_MANAGER'];
    const isPrivileged = user && user.roles.some(role => adminRoles.includes(role));

    if (!user || !isPrivileged) {
      return GENERIC_RESPONSE;
    }

    // Generate 6-digit OTP for password reset
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpRef = Math.random().toString(36).substring(2, 10).toUpperCase();
    const expiresIn = 900; // 15 minutes for email reset

    this.otpStore.set(email, {
      otp,
      otpRef,
      expiresAt: Date.now() + expiresIn * 1000,
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?email=${user.email}&ref=${otpRef}`;

    console.log(`[PASSWORD_RESET_OTP] ${user.email}: ${otp} [Ref: ${otpRef}]`);

    await this.auditLogService.log({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      ipAddress: '0.0.0.0',
      metadata: { email: user.email, ref: otpRef },
    });

    return {
      message: 'If an account with that email exists, a password reset link has been sent.',
      ...(process.env.NODE_ENV !== 'production' ? { 
        reset_url: resetUrl,
        otp,
        otp_ref: otpRef 
      } : {}),
    };
  }

  /**
   * Complete password reset using the OTP provided in the email.
   */
  async confirmPasswordReset(email: string, otp: string, newPassword: string): Promise<void> {
    const stored = this.otpStore.get(email);

    if (!stored || stored.otp !== otp || Date.now() > stored.expiresAt) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Clean up used OTP
    this.otpStore.delete(email);

    const user = await this.userRepo.findOneBy({ email });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await this.userRepo.update(user.id, {
      password: hashedPassword,
      forcePasswordReset: false,
      failedLoginAttempts: 0,
      lockedUntil: null as any,
    });

    await this.auditLogService.log({
      userId: user.id,
      action: 'PASSWORD_RESET_SUCCESS',
      ipAddress: '0.0.0.0', // Public endpoint
      metadata: { method: 'email_otp' },
    });
  }

  // ─────────────────────────────────────────────
  // Token Management (existing)
  // ─────────────────────────────────────────────

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const newPayload = { 
        sub: payload.sub, 
        roles: payload.roles || [payload.role] 
      };
      const newAccessToken = this.jwtService.sign(newPayload, { expiresIn: '3h' });
      const newRefreshToken = this.jwtService.sign(newPayload, { expiresIn: '7d' });
      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async issueClientCredentials(clientId: string, clientSecret: string) {
    const clientsStr = process.env.OAUTH2_CLIENTS || '';
    const clients = clientsStr.split(',').map(pair => pair.split(':'));
    const isValid = clients.some(([id, secret]) => id === clientId && secret === clientSecret);

    if (!isValid) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    const payload = { sub: clientId, roles: ['SYSTEM'] };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '3h' });
    return { 
      accessToken,
      expiresIn: 900 // 15 minutes as per signing option
    };
  }

  /**
   * Validate and decode a token (RFC 7662 compliant introspection).
   */
  async introspect(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return {
        active: true,
        sub: payload.sub,
        roles: payload.roles || [payload.role],
        scope: payload.scope || 'all',
        exp: payload.exp,
      };
    } catch {
      return { active: false };
    }
  }

  /**
   * List all system permissions (Master Registry).
   */
  async getPermissionsMaster() {
    return PERMISSION_MASTER;
  }

  /**
   * List all roles with optional scope filtering.
   */
  async getRolesWithPermissions(scope?: string) {
    if (scope) {
      return this.roleRepo.find({ where: { scope } });
    }
    return this.roleRepo.find();
  }

  /**
   * Get permissions for a specific role.
   */
  async getPermissionsByRole(roleName: string) {
    const role = await this.roleRepo.findOneBy({ name: roleName });
    if (!role) {
      // Try case-insensitive fallback for developer convenience
      const allRoles = await this.roleRepo.find();
      const found = allRoles.find(r => r.name.toLowerCase() === roleName.toLowerCase());
      if (found) return found.permissions;
      
      throw new BadRequestException(`Role '${roleName}' not found in the system`);
    }
    return role.permissions;
  }

  /**
   * Create a new system role.
   */
  async createRole(dto: CreateRoleDto) {
    const existing = await this.roleRepo.findOneBy({ name: dto.name });
    if (existing) {
      throw new BadRequestException(`Role '${dto.name}' already exists`);
    }

    // Validate permissions if provided
    if (dto.permissions && dto.permissions.length > 0) {
      const validKeys = PERMISSION_MASTER.map(p => p.key);
      const invalid = dto.permissions.filter(p => !validKeys.includes(p));
      if (invalid.length > 0) {
        throw new BadRequestException(`Invalid permissions: ${invalid.join(', ')}`);
      }
    }

    const role = this.roleRepo.create({
      name: dto.name,
      scope: dto.scope || 'GLOBAL',
      permissions: dto.permissions || [],
    });

    await this.roleRepo.save(role);

    await this.auditLogService.log({
      userId: 'SYSTEM', // Or pass the admin ID
      action: 'ROLE_CREATED',
      ipAddress: '0.0.0.0',
      metadata: { role_name: role.name, permissions_count: role.permissions.length },
    });

    return role;
  }

  /**
   * Persistently update permissions for a role.
   */
  async updateRolePermissions(roleName: string, permissions: string[], adminId: string) {
    const role = await this.roleRepo.findOneBy({ name: roleName });
    if (!role) {
      throw new BadRequestException(`Role '${roleName}' not found`);
    }

    // Spec 2.5: Validate every permission against the master registry
    const validKeys = PERMISSION_MASTER.map(p => p.key);
    const invalid = permissions.filter(p => !validKeys.includes(p));
    if (invalid.length > 0) {
      throw new BadRequestException(`Invalid permissions detected: ${invalid.join(', ')}`);
    }

    role.permissions = permissions;
    await this.roleRepo.save(role);

    await this.auditLogService.log({
      userId: adminId, 
      action: 'ROLE_PERMISSIONS_UPDATED',
      ipAddress: '0.0.0.0',
      metadata: { role: roleName, permissions_count: permissions.length },
    });

    return role;
  }

  /**
   * Delete a system role.
   */
  async deleteRole(roleName: string) {
    const role = await this.roleRepo.findOneBy({ name: roleName });
    if (!role) {
      throw new BadRequestException(`Role '${roleName}' not found`);
    }
    
    // Protection for CURESELECT_ADMIN
    if (role.name === 'CURESELECT_ADMIN') {
      throw new BadRequestException('The primary administrator role cannot be deleted');
    }

    await this.roleRepo.remove(role);
  }

  /**
   * Assign an additional role to a user.
   */
  async assignRole(userId: string, roleName: string) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify role exists in our masters
    const roleExists = await this.roleRepo.findOneBy({ name: roleName });
    if (!roleExists) {
      throw new BadRequestException(`Role '${roleName}' does not exist in the system`);
    }

    if (!user.roles.includes(roleName)) {
      user.roles.push(roleName);
      await this.userRepo.save(user);

      await this.auditLogService.log({
        userId: user.id, // Target user
        action: 'ROLE_ASSIGNED',
        ipAddress: '0.0.0.0',
        metadata: { assigned_role: roleName },
      });
    }

    return user;
  }

  /**
   * Remove a role from a user.
   */
  async removeRole(userId: string, roleName: string) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.roles.includes(roleName)) {
      user.roles = user.roles.filter((r) => r !== roleName);
      await this.userRepo.save(user);

      await this.auditLogService.log({
        userId: user.id,
        action: 'ROLE_REMOVED',
        ipAddress: '0.0.0.0',
        metadata: { removed_role: roleName },
      });
    }

    return user;
  }

  // ─────────────────────────────────────────────
  // User Management (Spec 2.4)
  // ─────────────────────────────────────────────

  /**
   * List users with cursor-based pagination and filtering.
   */
  async findAllUsers(query: UserQueryDto): Promise<PaginatedResponse<User>> {
    const limit = Math.min(parseInt(query.limit || '20', 10), 100);
    const qb = this.userRepo.createQueryBuilder('user')
      .take(limit + 1) // Fetch one extra to check for next page
      .orderBy('user.createdAt', 'DESC')
      .addOrderBy('user.id', 'DESC');

    if (query.role) {
      qb.andWhere('user.roles LIKE :role', { role: `%${query.role}%` });
    }
    if (query.org_id) {
      qb.andWhere('user.organisationId = :orgId', { orgId: query.org_id });
    }
    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    }
    if (query.email) {
      qb.andWhere('user.email ILIKE :email', { email: `%${query.email}%` });
    }
    if (query.phone) {
      qb.andWhere('user.phone ILIKE :phone', { phone: `%${query.phone}%` });
    }
    if (query.username) {
      qb.andWhere('user.username ILIKE :username', { username: `%${query.username}%` });
    }
    if (query.search) {
      qb.andWhere(
        '(user.name ILIKE :search OR user.phone ILIKE :search OR user.email ILIKE :search OR user.username ILIKE :search)',
        { search: `%${query.search}%` }
      );
    }
    if (query.date_from) {
      qb.andWhere('user.createdAt >= :dateFrom', { dateFrom: query.date_from });
    }
    if (query.date_to) {
      qb.andWhere('user.createdAt <= :dateTo', { dateTo: query.date_to });
    }

    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      // Assuming cursor is "ISO_TIMESTAMP|ID"
      const [createdAtStr, id] = decoded.split('|');
      qb.andWhere('(user.createdAt < :createdAt OR (user.createdAt = :createdAt AND user.id < :id))', {
        createdAt: new Date(createdAtStr),
        id,
      });
    }

    const users = await qb.getMany();
    const hasNextPage = users.length > limit;
    const data = hasNextPage ? users.slice(0, limit) : users;

    let next_cursor: string | null = null;
    if (hasNextPage) {
      const last = data[data.length - 1];
      next_cursor = encodeCursor(`${last.createdAt.toISOString()}|${last.id}`);
    }

    const total_count = await qb.getCount();

    return new PaginatedResponse(data, next_cursor, total_count, limit, data.length);
  }

  /**
   * Create a new user account with tenant isolation and role normalization.
   */
  async createUser(dto: CreateUserDto, creator: any) {
    // Check for specific collisions
    const phoneExists = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (phoneExists) {
      throw new BadRequestException(`User with phone ${dto.phone} already exists`);
    }

    if (dto.email) {
      const emailExists = await this.userRepo.findOne({ where: { email: dto.email } });
      if (emailExists) {
        throw new BadRequestException(`User with email ${dto.email} already exists`);
      }
    }

    const username = dto.username || dto.email?.split('@')[0] || dto.phone;
    const usernameExists = await this.userRepo.findOne({ where: { username } });
    if (usernameExists) {
      throw new BadRequestException(`User with username ${username} already exists`);
    }

    // RBAC Security (Spec 2.4/5.1) - Resilient to v4.0 Renames
    const isPlatformAdmin = creator.roles.some((r: string) => 
      ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r)
    );
    const isHospitalAdmin = creator.roles.some((r: string) => 
      ['Hospital Admin', 'HOSPITAL_ADMIN'].includes(r)
    );
    const isEdDoctor = creator.roles.some((r: string) => 
      ['Hospital ED Doctor (ERCP)', 'ED_DOCTOR'].includes(r)
    );
    
    let targetOrgId = dto.org_id;
    let targetRole = dto.role;

    // Role Normalization for User Convenience (e.g. ED_DOCTOR -> Hospital ED Doctor (ERCP))
    const roleMapping: Record<string, string> = {
      'ED_DOCTOR': 'Hospital ED Doctor (ERCP)',
      'NURSE': 'Hospital Nurse',
      'COORDINATOR': 'Hospital Coordinator',
      'CO-ORDINATOR': 'Hospital Coordinator',
      'HOSPITAL-COORDINATOR': 'Hospital Coordinator',
      'HOSPITAL_COORDINATOR': 'Hospital Coordinator',
      'ADMIN': 'Hospital Admin',
      'EMT': 'EMT / Paramedic',
      'CURESELECT_ADMIN': 'CureSelect Admin',
    };

    if (roleMapping[targetRole.toUpperCase()]) {
      targetRole = roleMapping[targetRole.toUpperCase()];
    }

    if ((isHospitalAdmin || isEdDoctor) && !isPlatformAdmin) {
      // 1. Force tenant isolation
      targetOrgId = creator.organisationId;
      
      // 2. Validate role scope (Hospital Admins/Doctors restricted to hospital staff roles)
      const allowedHospitalRoles = [
        'Hospital ED Doctor (ERCP)', 
        'Hospital Nurse', 
        'Hospital Coordinator', 
        'Hospital Admin'
      ];
      if (!allowedHospitalRoles.includes(targetRole)) {
        throw new ForbiddenException(`Hospital Administrators can only create hospital staff accounts (${allowedHospitalRoles.join(', ')})`);
      }
    } else if (!isPlatformAdmin) {
      throw new ForbiddenException(`You do not have permission to create users. (Current roles: ${creator.roles.join(', ')})`);
    }

    // Persona-specific defaults
    const isSuperAdmin = targetRole === 'CureSelect Admin';

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const user = this.userRepo.create({
      phone: dto.phone,
      email: dto.email,
      name: dto.name,
      username: dto.username || dto.email?.split('@')[0] || dto.phone,
      password: hashedPassword,
      roles: [targetRole],
      organisationId: targetOrgId,
      metadata: dto.metadata,
      mfaEnabled: isSuperAdmin ? true : false,
      status: 'ACTIVE',
    });

    await this.userRepo.save(user);

    await this.auditLogService.log({
      userId: creator.userId,
      action: 'USER_CREATED',
      ipAddress: '0.0.0.0',
      metadata: { roles: user.roles, targetUserId: user.id, org_id: targetOrgId },
    });

    return user;
  }

  /**
   * Find a single user by ID.
   */
  async findOneUser(id: string, requester?: any) {
    const user = await this.userRepo.findOneBy({ id });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (requester) {
      const isPlatformAdmin = requester.roles.some((r: string) => 
        ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r)
      );
      const isOwn = requester.userId === id;

      if (!isPlatformAdmin && !isOwn) {
        const isHospitalLevelAdmin = requester.roles.some((r: string) => 
          ['Hospital Admin', 'HOSPITAL_ADMIN', 'Hospital ED Doctor (ERCP)', 'ED_DOCTOR'].includes(r)
        );

        if (isHospitalLevelAdmin) {
          if (user.organisationId !== requester.organisationId) {
            throw new ForbiddenException('Access denied: You can only view users in your own organization');
          }
        } else {
          throw new ForbiddenException('Access denied: Insufficient permissions to view this profile');
        }
      }
    }

    return user;
  }

  /**
   * Update user account.
   */
  async updateUser(id: string, dto: UpdateUserDto, creator?: any) {
    const user = await this.findOneUser(id);

    if (creator) {
      const isPlatformAdmin = creator.roles.some((r: string) => ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r));
      const isHospitalAdmin = creator.roles.some((r: string) => ['Hospital Admin', 'HOSPITAL_ADMIN'].includes(r));
      const isEdDoctor = creator.roles.some((r: string) => ['Hospital ED Doctor (ERCP)', 'ED_DOCTOR'].includes(r));

      if ((isHospitalAdmin || isEdDoctor) && !isPlatformAdmin) {
        if (user.organisationId !== creator.organisationId) {
          throw new ForbiddenException('Access denied: You can only update users in your own organization');
        }

        // Additional constraints for non-platform admins
        if (dto.org_id && dto.org_id !== user.organisationId) {
          throw new ForbiddenException('Access denied: Hospital Administrators cannot change a user\'s organization');
        }

        if (dto.role) {
          const platformRoles = ['CURESELECT_ADMIN', 'CureSelect Admin', 'Call Centre Executive (CCE)', 'CCE'];
          if (platformRoles.includes(dto.role)) {
            throw new ForbiddenException(`Access denied: Only Platform Administrators can assign the ${dto.role} role`);
          }
        }
      }
    }

    // Prevent duplicate phone/email/username if they are being updated
    if (dto.phone || dto.email) {
      const conflict = await this.userRepo.createQueryBuilder('user')
        .where('user.id != :id', { id })
        .andWhere('(user.phone = :phone OR user.email = :email)', {
          phone: dto.phone || 'NEVER_MATCH_123',
          email: dto.email || 'NEVER_MATCH_123',
        })
        .getOne();
      
      if (conflict) {
        throw new BadRequestException('Another user already has this phone number or email address');
      }
    }

    if (dto.role) {
      user.roles = [dto.role]; // Overwrite primary role as per management intent
    }
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.email !== undefined) user.email = dto.email;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.status !== undefined) user.status = dto.status;
    if (dto.org_id !== undefined) user.organisationId = dto.org_id;
    if (dto.metadata !== undefined) {
      user.metadata = { ...(user.metadata || {}), ...dto.metadata };
    }

    await this.userRepo.save(user);

    await this.auditLogService.log({
      userId: user.id,
      action: 'USER_UPDATED',
      ipAddress: '0.0.0.0',
      metadata: { updates: Object.keys(dto) },
    });

    return user;
  }

  /**
   * Soft delete a user account (deactivate).
   */
  async deleteUser(id: string, creator: any) {
    const user = await this.findOneUser(id);

    const isPlatformAdmin = creator.roles.some((r: string) => ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r));
    const isHospitalAdmin = creator.roles.some((r: string) => ['Hospital Admin', 'HOSPITAL_ADMIN'].includes(r));
    const isEdDoctor = creator.roles.some((r: string) => ['Hospital ED Doctor (ERCP)', 'ED_DOCTOR'].includes(r));

    if ((isHospitalAdmin || isEdDoctor) && !isPlatformAdmin) {
      if (user.organisationId !== creator.organisationId) {
        throw new ForbiddenException('Access denied: You can only deactivate users in your own organization');
      }
    }
    
    user.status = 'INACTIVE';
    await this.userRepo.save(user);

    await this.auditLogService.log({
      userId: creator.userId,
      action: 'USER_DEACTIVATED',
      ipAddress: '0.0.0.0',
      metadata: { target_user_id: user.id },
    });
  }

  // ─────────────────────────────────────────────
  // Session Management
  // ─────────────────────────────────────────────

  async revokeAllSessions(userId: string) {
    await this.userRepo.update(userId, {
      tokensRevokedAt: new Date(),
    });
    // Mark stateful sessions invalid
    await this.sessionRepo.update({ userId }, { isValid: false });
  }

  /**
   * Retrieves all active stateful sessions for a user.
   */
  async getUserSessions(userId: string, creator?: any) {
    if (creator) {
      const user = await this.userRepo.findOneBy({ id: userId });
      if (!user) throw new BadRequestException('User not found');

      const isPlatformAdmin = creator.roles.some((r: string) => ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r));
      const isHospitalAdmin = creator.roles.some((r: string) => ['Hospital Admin', 'HOSPITAL_ADMIN'].includes(r));
      const isEdDoctor = creator.roles.some((r: string) => ['Hospital ED Doctor (ERCP)', 'ED_DOCTOR'].includes(r));

      if ((isHospitalAdmin || isEdDoctor) && !isPlatformAdmin) {
        if (user.organisationId !== creator.organisationId) {
          throw new ForbiddenException('Access denied: You can only view sessions for users in your own organization');
        }
      }
    }

    return this.sessionRepo.find({
      where: { userId, isValid: true },
      order: { lastActiveAt: 'DESC' },
      select: ['id', 'ipAddress', 'userAgent', 'lastActiveAt', 'createdAt']
    });
  }

  /**
   * Terminate a specific target session for a user.
   */
  async revokeSession(userId: string, sessionId: string, creator?: any) {
    if (creator) {
      const targetUser = await this.userRepo.findOneBy({ id: userId });
      if (!targetUser) throw new BadRequestException('User not found');

      const isPlatformAdmin = creator.roles.some((r: string) => ['CureSelect Admin', 'CURESELECT_ADMIN'].includes(r));
      const isHospitalAdmin = creator.roles.some((r: string) => ['Hospital Admin', 'HOSPITAL_ADMIN'].includes(r));
      const isEdDoctor = creator.roles.some((r: string) => ['Hospital ED Doctor (ERCP)', 'ED_DOCTOR'].includes(r));

      if ((isHospitalAdmin || isEdDoctor) && !isPlatformAdmin) {
        if (targetUser.organisationId !== creator.organisationId) {
          throw new ForbiddenException('Access denied: You can only terminate sessions for users in your own organization');
        }
      }
    }

    const session = await this.sessionRepo.findOneBy({ id: sessionId, userId });
    
    if (!session) {
      throw new BadRequestException('Session not found or does not belong to user');
    }

    session.isValid = false;
    await this.sessionRepo.save(session);
  }
}
