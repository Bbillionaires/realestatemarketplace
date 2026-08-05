import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockSmsProvider } from '../src/sms/providers/mock-sms.provider';
import { createTestApp, resetDatabase, resetRedis, createRelayNumber } from './utils/test-app';
import { registerUser, verifyPhone, createProperty } from './utils/flows';

describe('Gig jobs (e2e)', () => {
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

  async function startConversation(tenantToken: string, propertyId: string, message = 'Hi, is this available?') {
    const res = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ propertyId, message });
    return res.body.conversation.id as string;
  }

  async function setupTwoLandlordsTwoTenants() {
    const landlordA = await registerUser(app, { email: 'landlordA@gigs.test', role: 'LANDLORD', displayName: 'Landlord A' });
    await verifyPhone(app, mockSms, landlordA.accessToken, '904-555-0100');
    const landlordB = await registerUser(app, { email: 'landlordB@gigs.test', role: 'LANDLORD', displayName: 'Landlord B' });
    await verifyPhone(app, mockSms, landlordB.accessToken, '904-555-0101');

    const propertyA = await createProperty(app, landlordA.accessToken, { title: 'Property A', addressLine1: '1 A St' });
    const propertyB = await createProperty(app, landlordB.accessToken, { title: 'Property B', addressLine1: '2 B St' });

    const tenant1 = await registerUser(app, { email: 'tenant1@gigs.test', role: 'PROSPECTIVE_TENANT', displayName: 'Tenant One' });
    const tenant2 = await registerUser(app, { email: 'tenant2@gigs.test', role: 'PROSPECTIVE_TENANT', displayName: 'Tenant Two' });

    const conversation1WithA = await startConversation(tenant1.accessToken, propertyA);
    const conversation2WithB = await startConversation(tenant2.accessToken, propertyB);

    const adminReg = await request(app.getHttpServer()).post('/api/auth/register').send({
      email: 'admin@gigs.test',
      password: 'CorrectHorseBatteryStaple1!',
      displayName: 'Admin',
      role: 'PROSPECTIVE_TENANT',
    });
    await prisma.user.update({ where: { email: 'admin@gigs.test' }, data: { role: 'ADMINISTRATOR' } });
    const adminToken = adminReg.body.accessToken as string;

    return { landlordA, landlordB, tenant1, tenant2, adminToken, conversation1WithA, conversation2WithB, propertyA, propertyB };
  }

  const gigPayload = { title: 'Mow the lawn', description: 'Front and back yard', payoutCents: 10000 };

  it('scopes a landlord-posted gig to only the tenants who have a conversation with that landlord', async () => {
    const { landlordA, tenant1, tenant2 } = await setupTwoLandlordsTwoTenants();

    const created = await request(app.getHttpServer())
      .post('/api/gig-jobs')
      .set('Authorization', `Bearer ${landlordA.accessToken}`)
      .send(gigPayload);
    expect(created.status).toBe(201);

    const asTenant1 = await request(app.getHttpServer()).get('/api/gig-jobs').set('Authorization', `Bearer ${tenant1.accessToken}`);
    expect(asTenant1.body.map((j: { id: string }) => j.id)).toContain(created.body.id);

    const asTenant2 = await request(app.getHttpServer()).get('/api/gig-jobs').set('Authorization', `Bearer ${tenant2.accessToken}`);
    expect(asTenant2.body.map((j: { id: string }) => j.id)).not.toContain(created.body.id);
  });

  it('makes an admin-posted gig visible to every tenant on the platform', async () => {
    const { adminToken, tenant1, tenant2 } = await setupTwoLandlordsTwoTenants();

    const created = await request(app.getHttpServer())
      .post('/api/gig-jobs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...gigPayload, title: 'Platform-wide gig' });
    expect(created.status).toBe(201);

    const asTenant1 = await request(app.getHttpServer()).get('/api/gig-jobs').set('Authorization', `Bearer ${tenant1.accessToken}`);
    const asTenant2 = await request(app.getHttpServer()).get('/api/gig-jobs').set('Authorization', `Bearer ${tenant2.accessToken}`);
    expect(asTenant1.body.map((j: { id: string }) => j.id)).toContain(created.body.id);
    expect(asTenant2.body.map((j: { id: string }) => j.id)).toContain(created.body.id);
  });

  it('forbids a staff moderator (not admin) from posting a platform-wide gig', async () => {
    const { landlordA } = await setupTwoLandlordsTwoTenants();
    void landlordA;
    const staffReg = await request(app.getHttpServer()).post('/api/auth/register').send({
      email: 'staff@gigs.test',
      password: 'CorrectHorseBatteryStaple1!',
      displayName: 'Staff',
      role: 'PROSPECTIVE_TENANT',
    });
    await prisma.user.update({ where: { email: 'staff@gigs.test' }, data: { role: 'STAFF_MODERATOR' } });

    const res = await request(app.getHttpServer())
      .post('/api/gig-jobs')
      .set('Authorization', `Bearer ${staffReg.body.accessToken}`)
      .send(gigPayload);
    expect(res.status).toBe(403);
  });

  it('rejects a claim from a tenant who has no relationship with that landlord even with their own conversation id', async () => {
    const { landlordA, tenant2, conversation2WithB } = await setupTwoLandlordsTwoTenants();
    const created = await request(app.getHttpServer())
      .post('/api/gig-jobs')
      .set('Authorization', `Bearer ${landlordA.accessToken}`)
      .send(gigPayload);

    const res = await request(app.getHttpServer())
      .patch(`/api/gig-jobs/${created.body.id}/claim`)
      .set('Authorization', `Bearer ${tenant2.accessToken}`)
      .send({ conversationId: conversation2WithB });
    expect(res.status).toBe(403);
  });

  it('rejects a claim using a conversation that does not belong to the claiming tenant', async () => {
    const { landlordA, tenant1, tenant2, conversation2WithB } = await setupTwoLandlordsTwoTenants();
    const created = await request(app.getHttpServer())
      .post('/api/gig-jobs')
      .set('Authorization', `Bearer ${landlordA.accessToken}`)
      .send(gigPayload);
    void tenant1;

    const res = await request(app.getHttpServer())
      .patch(`/api/gig-jobs/${created.body.id}/claim`)
      .set('Authorization', `Bearer ${tenant2.accessToken}`)
      .send({ conversationId: conversation2WithB });
    expect(res.status).toBe(403);
  });

  it('forbids a landlord from claiming a gig job', async () => {
    const { landlordA } = await setupTwoLandlordsTwoTenants();
    const created = await request(app.getHttpServer())
      .post('/api/gig-jobs')
      .set('Authorization', `Bearer ${landlordA.accessToken}`)
      .send(gigPayload);

    const res = await request(app.getHttpServer())
      .patch(`/api/gig-jobs/${created.body.id}/claim`)
      .set('Authorization', `Bearer ${landlordA.accessToken}`)
      .send({ conversationId: 'whatever' });
    expect(res.status).toBe(403);
  });

  it('runs the full claim -> complete -> reject -> re-complete -> pay -> voucher lifecycle with the fee skimmed from the payout', async () => {
    const { landlordA, tenant1, conversation1WithA } = await setupTwoLandlordsTwoTenants();

    const created = await request(app.getHttpServer())
      .post('/api/gig-jobs')
      .set('Authorization', `Bearer ${landlordA.accessToken}`)
      .send(gigPayload);
    const gigJobId = created.body.id as string;

    const claimed = await request(app.getHttpServer())
      .patch(`/api/gig-jobs/${gigJobId}/claim`)
      .set('Authorization', `Bearer ${tenant1.accessToken}`)
      .send({ conversationId: conversation1WithA });
    expect(claimed.status).toBe(200);
    expect(claimed.body.status).toBe('CLAIMED');

    // Someone else can't claim it now.
    const doubleClaim = await request(app.getHttpServer())
      .patch(`/api/gig-jobs/${gigJobId}/claim`)
      .set('Authorization', `Bearer ${tenant1.accessToken}`)
      .send({ conversationId: conversation1WithA });
    expect(doubleClaim.status).toBe(400);

    const completed = await request(app.getHttpServer())
      .patch(`/api/gig-jobs/${gigJobId}/complete`)
      .set('Authorization', `Bearer ${tenant1.accessToken}`);
    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe('COMPLETED');

    // Landlord isn't satisfied yet — sends it back.
    const rejected = await request(app.getHttpServer())
      .patch(`/api/gig-jobs/${gigJobId}/reject-completion`)
      .set('Authorization', `Bearer ${landlordA.accessToken}`);
    expect(rejected.status).toBe(200);
    expect(rejected.body.status).toBe('CLAIMED');

    await request(app.getHttpServer())
      .patch(`/api/gig-jobs/${gigJobId}/complete`)
      .set('Authorization', `Bearer ${tenant1.accessToken}`);

    // Can no longer be cancelled once completed.
    const cancelAttempt = await request(app.getHttpServer())
      .patch(`/api/gig-jobs/${gigJobId}/cancel`)
      .set('Authorization', `Bearer ${landlordA.accessToken}`);
    expect(cancelAttempt.status).toBe(400);

    const payRes = await request(app.getHttpServer())
      .post(`/api/gig-jobs/${gigJobId}/pay`)
      .set('Authorization', `Bearer ${landlordA.accessToken}`);
    expect(payRes.status).toBe(201);
    expect(payRes.body.checkoutUrl).toContain('/mock-checkout');
    const orderId = new URL(payRes.body.checkoutUrl).searchParams.get('orderId');

    const webhook = await request(app.getHttpServer())
      .post('/api/payments/webhooks')
      .send({ providerOrderId: orderId, paid: true });
    expect(webhook.status).toBe(200);

    const myVouchers = await request(app.getHttpServer())
      .get('/api/gig-vouchers/me')
      .set('Authorization', `Bearer ${tenant1.accessToken}`);
    expect(myVouchers.status).toBe(200);
    expect(myVouchers.body.length).toBe(1);
    const voucher = myVouchers.body[0];
    expect(voucher.status).toBe('ISSUED');
    expect(voucher.payoutCents).toBe(10000);
    expect(voucher.feeCents).toBe(1000); // 10% default
    expect(voucher.voucherCents).toBe(9000);
    expect(voucher.landlordId).toBe(landlordA.userId);

    const issued = await request(app.getHttpServer())
      .get('/api/gig-vouchers/issued')
      .set('Authorization', `Bearer ${landlordA.accessToken}`);
    expect(issued.body.length).toBe(1);
    expect(issued.body[0].id).toBe(voucher.id);

    // Another landlord can't apply this voucher.
    const otherLandlord = await registerUser(app, { email: 'other-landlord@gigs.test', role: 'LANDLORD', displayName: 'Other Landlord' });
    const forbiddenApply = await request(app.getHttpServer())
      .patch(`/api/gig-vouchers/${voucher.id}/apply`)
      .set('Authorization', `Bearer ${otherLandlord.accessToken}`)
      .send({ note: 'nope' });
    expect(forbiddenApply.status).toBe(403);

    const applied = await request(app.getHttpServer())
      .patch(`/api/gig-vouchers/${voucher.id}/apply`)
      .set('Authorization', `Bearer ${landlordA.accessToken}`)
      .send({ note: 'Applied to July rent' });
    expect(applied.status).toBe(200);
    expect(applied.body.status).toBe('APPLIED');
    expect(applied.body.appliedNote).toBe('Applied to July rent');

    const reapply = await request(app.getHttpServer())
      .patch(`/api/gig-vouchers/${voucher.id}/apply`)
      .set('Authorization', `Bearer ${landlordA.accessToken}`)
      .send({});
    expect(reapply.status).toBe(400);

    const finalJob = await request(app.getHttpServer())
      .get('/api/gig-jobs/posted')
      .set('Authorization', `Bearer ${landlordA.accessToken}`);
    expect(finalJob.body.find((j: { id: string }) => j.id === gigJobId).status).toBe('CONFIRMED');
  });

  it('lets a property manager post a gig scoped to the tenants of the property they manage', async () => {
    const { landlordA, tenant1, propertyA, conversation1WithA } = await setupTwoLandlordsTwoTenants();
    const manager = await registerUser(app, { email: 'pm@gigs.test', role: 'PROPERTY_MANAGER', displayName: 'PM' });
    await request(app.getHttpServer())
      .post(`/api/properties/${propertyA}/managers`)
      .set('Authorization', `Bearer ${landlordA.accessToken}`)
      .send({ userId: manager.userId });

    // A new conversation started now routes to the manager, not the owner.
    const tenant3 = await registerUser(app, { email: 'tenant3@gigs.test', role: 'PROSPECTIVE_TENANT', displayName: 'Tenant Three' });
    const conversationWithPm = await startConversation(tenant3.accessToken, propertyA);

    const created = await request(app.getHttpServer())
      .post('/api/gig-jobs')
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .send({ ...gigPayload, propertyId: propertyA });
    expect(created.status).toBe(201);

    const asTenant3 = await request(app.getHttpServer()).get('/api/gig-jobs').set('Authorization', `Bearer ${tenant3.accessToken}`);
    expect(asTenant3.body.map((j: { id: string }) => j.id)).toContain(created.body.id);

    // Tenant1's conversation is with the owner (predates the manager assignment), not the manager, so ineligible.
    const claimAttempt = await request(app.getHttpServer())
      .patch(`/api/gig-jobs/${created.body.id}/claim`)
      .set('Authorization', `Bearer ${tenant1.accessToken}`)
      .send({ conversationId: conversation1WithA });
    expect(claimAttempt.status).toBe(403);
    void conversationWithPm;
  });

  it('forbids a landlord from posting a gig tied to a property they do not own or manage', async () => {
    const { landlordB, propertyA } = await setupTwoLandlordsTwoTenants();
    const res = await request(app.getHttpServer())
      .post('/api/gig-jobs')
      .set('Authorization', `Bearer ${landlordB.accessToken}`)
      .send({ ...gigPayload, propertyId: propertyA });
    expect(res.status).toBe(403);
  });
});
