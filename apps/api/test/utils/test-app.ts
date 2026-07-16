import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

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
  // Ordered to respect foreign key constraints. Phase 1 tables only; later
  // phases should extend this list as new models come online.
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
