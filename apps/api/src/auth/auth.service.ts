import { randomBytes, createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuid } from 'uuid';
import * as argon2 from 'argon2';
import { ConsentStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/configuration';
import { AuditService } from '../audit/audit.service';
import { parseDurationToMs } from '../common/utils/duration.util';
import { EMAIL_PROVIDER } from '../email/email.constants';
import { EmailProvider } from '../email/interfaces/email-provider.interface';
import { RegisterDto } from './dto/register.dto';
import { TokenPair } from './interfaces/token-pair.interface';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly jwtConfig: AppConfig['jwt'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig>,
    private readonly auditService: AuditService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {
    this.jwtConfig = this.configService.get('jwt', { infer: true }) as AppConfig['jwt'];
  }

  async register(dto: RegisterDto, ctx: RequestContext): Promise<TokenPair> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const isLandlord = (dto.role as unknown as Role) === Role.LANDLORD;
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        role: dto.role as unknown as Role,
        profile: {
          create: {
            displayName: dto.displayName,
            ...(isLandlord && {
              hasLawnCareProvider: dto.hasLawnCareProvider ?? false,
              hasPlumbingProvider: dto.hasPlumbingProvider ?? false,
              hasHandymanProvider: dto.hasHandymanProvider ?? false,
              hasPestControlProvider: dto.hasPestControlProvider ?? false,
              hasRoofingProvider: dto.hasRoofingProvider ?? false,
              requestsPropertyManagementHelp: dto.requestsPropertyManagementHelp ?? false,
            }),
          },
        },
        notificationPreference: {
          create: {
            smsTransactionalConsent: ConsentStatus.PENDING,
            smsMarketingConsent: ConsentStatus.OPTED_OUT,
          },
        },
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'auth.register',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return this.issueTokenPair(user.id, ctx);
  }

  async validateCredentials(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const passwordValid = await argon2.verify(user.passwordHash, password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new ForbiddenException('This account has been suspended');
    }
    return user;
  }

  async login(userId: string, ctx: RequestContext): Promise<TokenPair> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.log({
      actorId: userId,
      action: 'auth.login',
      entityType: 'User',
      entityId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return this.issueTokenPair(userId, ctx);
  }

  /**
   * Rotates a refresh token. Refresh tokens are opaque high-entropy random
   * strings; only their SHA-256 hash is ever persisted, and each token
   * belongs to a rotation "family". If a token that has already been
   * consumed (rotated away) is presented again, that's a strong signal of
   * theft/replay, so the entire family is revoked and the caller must
   * re-authenticate.
   */
  async refresh(rawToken: string, ctx: RequestContext): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!record) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (record.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: record.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.auditService.log({
        actorId: record.userId,
        action: 'auth.refresh_token_reuse_detected',
        entityType: 'RefreshToken',
        entityId: record.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      throw new UnauthorizedException('Refresh token has already been used; please log in again');
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user || !user.isActive) {
      throw new ForbiddenException('This account is not active');
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(user.id, ctx, record.familyId);
  }

  async logout(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Always resolves the same way whether or not the email matches an
   * account — the caller (and the controller response) must not be able to
   * distinguish the two cases, or this becomes an account-enumeration
   * oracle. Any real work (token creation, email send) only happens for a
   * genuine, active account.
   */
  async requestPasswordReset(email: string, ctx: RequestContext): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive) {
      return;
    }

    // Superseded by this new request — an old email's link shouldn't stay live.
    await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

    const rawToken = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    const dashboardBaseUrl = this.configService.get('dashboardBaseUrl', { infer: true });
    await this.emailProvider.sendEmail({
      to: user.email,
      subject: 'Reset your Affordable Home Match password',
      text: `We received a request to reset your password. This link is valid for 1 hour: ${dashboardBaseUrl}/reset-password?token=${rawToken}\n\nIf you didn't request this, you can ignore this email — your password won't change.`,
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'auth.password_reset_requested',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  async resetPassword(rawToken: string, newPassword: string, ctx: RequestContext): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // A password reset is a strong signal the account may have been
      // compromised (or the tenant just forgot it on a shared device) —
      // either way, every other session should have to re-authenticate.
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditService.log({
      actorId: record.userId,
      action: 'auth.password_reset_completed',
      entityType: 'User',
      entityId: record.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  async getAuthenticatedUser(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      canSuspendUsers: user.canSuspendUsers,
    };
  }

  private async issueTokenPair(
    userId: string,
    ctx: RequestContext,
    familyId: string = uuid(),
  ): Promise<TokenPair> {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId },
      { secret: this.jwtConfig.accessSecret, expiresIn: this.jwtConfig.accessTtl },
    );

    const rawRefreshToken = randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + parseDurationToMs(this.jwtConfig.refreshTtl));

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        familyId,
        expiresAt,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.jwtConfig.accessTtl,
    };
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
