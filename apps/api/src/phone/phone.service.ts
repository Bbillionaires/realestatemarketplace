import { randomInt } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/utils/crypto.util';
import { RateLimiterService } from '../redis/rate-limiter.service';
import { normalizePhoneNumber, lastFourDigits } from '../common/utils/phone.util';
import { SMS_PROVIDER, SMS_VERIFICATION_SENDER_ID } from '../sms/sms.constants';
import { SmsProvider } from '../sms/interfaces/sms-provider.interface';
import { AppConfig } from '../config/configuration';
import { AuditService } from '../audit/audit.service';
import { PhoneNumberResponseDto } from './dto/phone-number-response.dto';

class TooManyRequestsException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

@Injectable()
export class PhoneService {
  private readonly otpMaxAttempts: number;
  private readonly otpTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly rateLimiter: RateLimiterService,
    private readonly auditService: AuditService,
    configService: ConfigService<AppConfig>,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {
    const limits = configService.get('rateLimits', { infer: true }) as AppConfig['rateLimits'];
    this.otpMaxAttempts = limits.otpMaxAttempts;
    this.otpTtlSeconds = limits.otpTtlSeconds;
  }

  async startVerification(
    userId: string,
    rawPhoneNumber: string,
    ctx: { ipAddress?: string; userAgent?: string },
  ): Promise<{ phoneNumberId: string; expiresInSeconds: number }> {
    const e164 = normalizePhoneNumber(rawPhoneNumber);
    const numberHash = this.crypto.hash(e164);

    const userSendLimit = await this.rateLimiter.consume(`otp:send:user:${userId}`, 5, 3600);
    const phoneSendLimit = await this.rateLimiter.consume(`otp:send:phone:${numberHash}`, 5, 3600);
    if (!userSendLimit.allowed || !phoneSendLimit.allowed) {
      throw new TooManyRequestsException('Too many verification requests. Please try again later.');
    }

    const existingForOtherUser = await this.prisma.phoneNumber.findFirst({
      where: { numberHash, isVerified: true, userId: { not: userId } },
    });
    if (existingForOtherUser) {
      // Don't reveal that the number belongs to someone else; behave as if
      // the code was sent, but do not actually create a routable record.
      return { phoneNumberId: existingForOtherUser.id, expiresInSeconds: this.otpTtlSeconds };
    }

    let phoneNumber = await this.prisma.phoneNumber.findFirst({
      where: { userId, numberHash, supersededAt: null },
    });

    if (!phoneNumber) {
      phoneNumber = await this.prisma.phoneNumber.create({
        data: {
          userId,
          encryptedNumber: this.crypto.encrypt(e164),
          numberHash,
          last4: lastFourDigits(e164),
          countryCode: 'US',
        },
      });
    }

    const code = randomInt(100000, 999999).toString();
    const codeHash = await argon2.hash(code, { type: argon2.argon2id });
    const expiresAt = new Date(Date.now() + this.otpTtlSeconds * 1000);

    await this.prisma.phoneVerification.create({
      data: { phoneNumberId: phoneNumber.id, codeHash, expiresAt },
    });

    await this.smsProvider.sendMessage({
      to: e164,
      from: SMS_VERIFICATION_SENDER_ID,
      body: `Your verification code is ${code}. It expires in ${Math.round(this.otpTtlSeconds / 60)} minutes. Never share this code.`,
    });

    await this.auditService.log({
      actorId: userId,
      action: 'phone.verification_started',
      entityType: 'PhoneNumber',
      entityId: phoneNumber.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return { phoneNumberId: phoneNumber.id, expiresInSeconds: this.otpTtlSeconds };
  }

  async confirmVerification(
    userId: string,
    rawPhoneNumber: string,
    code: string,
    ctx: { ipAddress?: string; userAgent?: string },
  ): Promise<PhoneNumberResponseDto> {
    const e164 = normalizePhoneNumber(rawPhoneNumber);
    const numberHash = this.crypto.hash(e164);

    const confirmLimit = await this.rateLimiter.consume(`otp:confirm:user:${userId}`, 10, 3600);
    if (!confirmLimit.allowed) {
      throw new TooManyRequestsException('Too many attempts. Please request a new code.');
    }

    const phoneNumber = await this.prisma.phoneNumber.findFirst({
      where: { userId, numberHash, supersededAt: null },
      include: { verifications: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    const verification = phoneNumber?.verifications[0];
    if (!phoneNumber || !verification || verification.verifiedAt) {
      throw new BadRequestException('No pending verification for this phone number');
    }

    if (verification.expiresAt < new Date()) {
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    if (verification.attempts >= this.otpMaxAttempts) {
      throw new ForbiddenException('Too many incorrect attempts. Please request a new code.');
    }

    const isValid = await argon2.verify(verification.codeHash, code);
    if (!isValid) {
      await this.prisma.phoneVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Incorrect verification code');
    }

    const now = new Date();
    const hasPrimary = await this.prisma.phoneNumber.findFirst({
      where: { userId, isPrimary: true },
    });

    const [updatedPhone] = await this.prisma.$transaction([
      this.prisma.phoneNumber.update({
        where: { id: phoneNumber.id },
        data: { isVerified: true, verifiedAt: now, isPrimary: !hasPrimary },
      }),
      this.prisma.phoneVerification.update({
        where: { id: verification.id },
        data: { verifiedAt: now },
      }),
    ]);

    await this.auditService.log({
      actorId: userId,
      action: 'phone.verified',
      entityType: 'PhoneNumber',
      entityId: phoneNumber.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return PhoneNumberResponseDto.from(updatedPhone);
  }

  async listForUser(userId: string): Promise<PhoneNumberResponseDto[]> {
    const rows = await this.prisma.phoneNumber.findMany({
      where: { userId, supersededAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => PhoneNumberResponseDto.from(r));
  }
}
