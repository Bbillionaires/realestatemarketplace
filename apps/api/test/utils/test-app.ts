import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type Redis from 'ioredis';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.constants';

export async function createTestApp(): Promise<{ app: INestApplication; moduleRef: TestingModule }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.setGlobalPrefix('api');
  await app.init();
  return { app, moduleRef };
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  // Ordered to respect foreign key constraints.
  await prisma.gigVoucher.deleteMany();
  await prisma.gigJob.deleteMany();
  await prisma.jobReferral.deleteMany();
  await prisma.moderationFlag.deleteMany();
  await prisma.violation.deleteMany();
  await prisma.userRestriction.deleteMany();
  await prisma.adminNote.deleteMany();
  await prisma.messageDelivery.deleteMany();
  await prisma.messageAttachment.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.relayAssignment.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.relayNumber.deleteMany();
  await prisma.propertyManagerAssignment.deleteMany();
  await prisma.propertyUnit.deleteMany();
  await prisma.property.deleteMany();
  await prisma.phoneVerification.deleteMany();
  await prisma.phoneNumber.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.user.deleteMany();
}

/**
 * Clears the Redis rate-limiter/menu state between tests. Without this,
 * per-phone-number OTP send limits (5/hour) or SMS routing menu state can
 * leak across test cases that reuse the same fixture phone numbers.
 */
export async function resetRedis(moduleRef: TestingModule): Promise<void> {
  const redis = moduleRef.get<Redis>(REDIS_CLIENT);
  await redis.flushdb();
}

export async function createRelayNumber(
  prisma: PrismaService,
  phoneNumber: string = '+18885551000',
): Promise<{ id: string; phoneNumber: string }> {
  return prisma.relayNumber.create({
    data: { phoneNumber, provider: 'mock', region: 'US', capacityLimit: 50 },
  });
}
