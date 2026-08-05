import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockSmsProvider } from '../src/sms/providers/mock-sms.provider';
import { createTestApp, resetDatabase, resetRedis, createRelayNumber } from './utils/test-app';
import { registerUser, verifyPhone, createProperty } from './utils/flows';

describe('Job referrals (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let mockSms: MockSmsProvider;

  beforeAll(async () => {
    ({ app, moduleRef } = await createTestApp());
    prisma = moduleRef.get(PrismaService);
    mockSms = moduleRef.get(MockSmsProvider);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await resetRedis(moduleRef);
    mockSms.clear();
    await createRelayNumber(prisma, '+18885551000');
    await createRelayNumber(prisma, '+18885551001');
  });

  afterAll(async () => {
    await app.close();
  });

  async function startConversation(tenantToken: string, propertyId: string) {
    const res = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ propertyId, message: 'Hi, is this available?' });
    return res.body.conversation.id as string;
  }

  async function setupTwoLandlordsTwoTenants() {
    const landlordA = await registerUser(app, { email: 'landlordA@referrals.test', role: 'LANDLORD', displayName: 'Landlord A' });
    await verifyPhone(app, mockSms, landlordA.accessToken, '904-555-0100');
    const landlordB = await registerUser(app, { email: 'landlordB@referrals.test', role: 'LANDLORD', displayName: 'Landlord B' });
    await verifyPhone(app, mockSms, landlordB.accessToken, '904-555-0101');

    const propertyA = await createProperty(app, landlordA.accessToken, { title: 'Property A', addressLine1: '1 A St' });
    const propertyB = await createProperty(app, landlordB.accessToken, { title: 'Property B', addressLine1: '2 B St' });

    const tenant1 = await registerUser(app, { email: 'tenant1@referrals.test', role: 'PROSPECTIVE_TENANT', displayName: 'Tenant One' });
    const tenant2 = await registerUser(app, { email: 'tenant2@referrals.test', role: 'PROSPECTIVE_TENANT', displayName: 'Tenant Two' });

    await startConversation(tenant1.accessToken, propertyA);
    await startConversation(tenant2.accessToken, propertyB);

    const adminReg = await request(app.getHttpServer()).post('/api/auth/register').send({
      email: 'admin@referrals.test',
      password: 'CorrectHorseBatteryStaple1!',
      displayName: 'Admin',
      role: 'PROSPECTIVE_TENANT',
    });
    await prisma.user.update({ where: { email: 'admin@referrals.test' }, data: { role: 'ADMINISTRATOR' } });
    const adminToken = adminReg.body.accessToken as string;

    return { landlordA, landlordB, tenant1, tenant2, adminToken };
  }

  const referralPayload = { title: 'Cashier', employerName: "McDonald's", location: '500 Main St, Jacksonville, FL' };

  it('scopes a landlord-posted referral to only tenants who have a conversation with that landlord', async () => {
    const { landlordA, tenant1, tenant2 } = await setupTwoLandlordsTwoTenants();

    const created = await request(app.getHttpServer())
      .post('/api/job-referrals')
      .set('Authorization', `Bearer ${landlordA.accessToken}`)
      .send(referralPayload);
    expect(created.status).toBe(201);
    expect(created.body.applyUrl).toBeNull();

    const asTenant1 = await request(app.getHttpServer()).get('/api/job-referrals').set('Authorization', `Bearer ${tenant1.accessToken}`);
    expect(asTenant1.body.map((r: { id: string }) => r.id)).toContain(created.body.id);

    const asTenant2 = await request(app.getHttpServer()).get('/api/job-referrals').set('Authorization', `Bearer ${tenant2.accessToken}`);
    expect(asTenant2.body.map((r: { id: string }) => r.id)).not.toContain(created.body.id);
  });

  it('makes an admin-posted referral visible to every tenant on the platform', async () => {
    const { adminToken, tenant1, tenant2 } = await setupTwoLandlordsTwoTenants();

    const created = await request(app.getHttpServer())
      .post('/api/job-referrals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...referralPayload, title: 'Platform-wide opening' });
    expect(created.status).toBe(201);

    const asTenant1 = await request(app.getHttpServer()).get('/api/job-referrals').set('Authorization', `Bearer ${tenant1.accessToken}`);
    const asTenant2 = await request(app.getHttpServer()).get('/api/job-referrals').set('Authorization', `Bearer ${tenant2.accessToken}`);
    expect(asTenant1.body.map((r: { id: string }) => r.id)).toContain(created.body.id);
    expect(asTenant2.body.map((r: { id: string }) => r.id)).toContain(created.body.id);
  });

  it('forbids a tenant from posting a job referral', async () => {
    const { tenant1 } = await setupTwoLandlordsTwoTenants();
    const res = await request(app.getHttpServer())
      .post('/api/job-referrals')
      .set('Authorization', `Bearer ${tenant1.accessToken}`)
      .send(referralPayload);
    expect(res.status).toBe(403);
  });

  it('accepts an optional applyUrl and contactInfo, and persists description', async () => {
    const { landlordA } = await setupTwoLandlordsTwoTenants();
    const created = await request(app.getHttpServer())
      .post('/api/job-referrals')
      .set('Authorization', `Bearer ${landlordA.accessToken}`)
      .send({
        ...referralPayload,
        applyUrl: 'https://careers.example.com/apply',
        contactInfo: 'Ask for the manager, mention Landlord A sent you',
        description: 'Flexible hours, part-time available.',
      });
    expect(created.status).toBe(201);
    expect(created.body.applyUrl).toBe('https://careers.example.com/apply');
    expect(created.body.contactInfo).toBe('Ask for the manager, mention Landlord A sent you');
    expect(created.body.description).toBe('Flexible hours, part-time available.');
  });

  it('rejects an invalid applyUrl', async () => {
    const { landlordA } = await setupTwoLandlordsTwoTenants();
    const res = await request(app.getHttpServer())
      .post('/api/job-referrals')
      .set('Authorization', `Bearer ${landlordA.accessToken}`)
      .send({ ...referralPayload, applyUrl: 'not-a-url' });
    expect(res.status).toBe(400);
  });

  it('lets only the poster close their referral, and a closed referral stops showing to tenants', async () => {
    const { landlordA, landlordB, tenant1 } = await setupTwoLandlordsTwoTenants();
    const created = await request(app.getHttpServer())
      .post('/api/job-referrals')
      .set('Authorization', `Bearer ${landlordA.accessToken}`)
      .send(referralPayload);

    const forbiddenClose = await request(app.getHttpServer())
      .patch(`/api/job-referrals/${created.body.id}/close`)
      .set('Authorization', `Bearer ${landlordB.accessToken}`);
    expect(forbiddenClose.status).toBe(403);

    const closed = await request(app.getHttpServer())
      .patch(`/api/job-referrals/${created.body.id}/close`)
      .set('Authorization', `Bearer ${landlordA.accessToken}`);
    expect(closed.status).toBe(200);
    expect(closed.body.status).toBe('CLOSED');

    const reClose = await request(app.getHttpServer())
      .patch(`/api/job-referrals/${created.body.id}/close`)
      .set('Authorization', `Bearer ${landlordA.accessToken}`);
    expect(reClose.status).toBe(400);

    const asTenant1 = await request(app.getHttpServer()).get('/api/job-referrals').set('Authorization', `Bearer ${tenant1.accessToken}`);
    expect(asTenant1.body.map((r: { id: string }) => r.id)).not.toContain(created.body.id);

    const posted = await request(app.getHttpServer())
      .get('/api/job-referrals/posted')
      .set('Authorization', `Bearer ${landlordA.accessToken}`);
    expect(posted.body.find((r: { id: string }) => r.id === created.body.id).status).toBe('CLOSED');
  });
});
