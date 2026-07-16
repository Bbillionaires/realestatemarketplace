import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDatabase } from './utils/test-app';

describe('RBAC / privilege escalation protection (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, moduleRef } = await createTestApp());
    prisma = moduleRef.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerAs(role: string, email: string) {
    const res = await request(app.getHttpServer()).post('/api/auth/register').send({
      email,
      password: 'CorrectHorseBatteryStaple1!',
      displayName: email,
      role: role === 'ADMINISTRATOR' || role === 'SUPER_ADMINISTRATOR' || role === 'STAFF_MODERATOR'
        ? 'PROSPECTIVE_TENANT'
        : role,
    });
    if (role === 'ADMINISTRATOR' || role === 'SUPER_ADMINISTRATOR' || role === 'STAFF_MODERATOR') {
      await prisma.user.update({ where: { email }, data: { role } });
    }
    return res.body.accessToken as string;
  }

  it('forbids a non-admin from viewing the user list', async () => {
    const tenantToken = await registerAs('PROSPECTIVE_TENANT', 'plain-tenant@example.com');
    const res = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(res.status).toBe(403);
  });

  it('prevents an ADMINISTRATOR from granting ADMINISTRATOR or SUPER_ADMINISTRATOR roles', async () => {
    const adminToken = await registerAs('ADMINISTRATOR', 'admin@example.com');
    const targetToken = await registerAs('PROSPECTIVE_TENANT', 'target1@example.com');
    const target = await prisma.user.findUniqueOrThrow({ where: { email: 'target1@example.com' } });
    void targetToken;

    const res = await request(app.getHttpServer())
      .patch(`/api/users/${target.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ADMINISTRATOR' });
    expect(res.status).toBe(403);
  });

  it('allows a SUPER_ADMINISTRATOR to grant the ADMINISTRATOR role', async () => {
    const superAdminToken = await registerAs('SUPER_ADMINISTRATOR', 'super@example.com');
    await registerAs('PROSPECTIVE_TENANT', 'target2@example.com');
    const target = await prisma.user.findUniqueOrThrow({ where: { email: 'target2@example.com' } });

    const res = await request(app.getHttpServer())
      .patch(`/api/users/${target.id}/role`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ role: 'ADMINISTRATOR' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('ADMINISTRATOR');
  });

  it('an administrator can suspend and restore a user, and suspension is enforced immediately', async () => {
    const adminToken = await registerAs('ADMINISTRATOR', 'admin2@example.com');
    const userToken = await registerAs('PROSPECTIVE_TENANT', 'target3@example.com');
    const target = await prisma.user.findUniqueOrThrow({ where: { email: 'target3@example.com' } });

    const suspend = await request(app.getHttpServer())
      .patch(`/api/users/${target.id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(suspend.status).toBe(200);

    const blockedAccess = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${userToken}`);
    expect(blockedAccess.status).toBe(401);

    const restore = await request(app.getHttpServer())
      .patch(`/api/users/${target.id}/restore`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(restore.status).toBe(200);
    expect(restore.body.isActive).toBe(true);
  });

  it('every mutating action is captured in the audit log', async () => {
    const adminToken = await registerAs('ADMINISTRATOR', 'admin3@example.com');
    await registerAs('PROSPECTIVE_TENANT', 'target4@example.com');
    const target = await prisma.user.findUniqueOrThrow({ where: { email: 'target4@example.com' } });

    await request(app.getHttpServer())
      .patch(`/api/users/${target.id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`);

    const logs = await prisma.auditLog.findMany({ where: { entityId: target.id, action: 'user.suspend' } });
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });
});
