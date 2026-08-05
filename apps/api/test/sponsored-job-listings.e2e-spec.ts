import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockSmsProvider } from '../src/sms/providers/mock-sms.provider';
import { createTestApp, resetDatabase, resetRedis, createRelayNumber } from './utils/test-app';
import { registerUser, verifyPhone, createProperty } from './utils/flows';

describe('Sponsored job listings (e2e)', () => {
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

  async function setup() {
    const landlordA = await registerUser(app, { email: 'landlordA@sponsored.test', role: 'LANDLORD', displayName: 'Landlord A' });
    await verifyPhone(app, mockSms, landlordA.accessToken, '904-555-0200');
    const landlordB = await registerUser(app, { email: 'landlordB@sponsored.test', role: 'LANDLORD', displayName: 'Landlord B' });
    await verifyPhone(app, mockSms, landlordB.accessToken, '904-555-0201');

    const propertyA = await createProperty(app, landlordA.accessToken, { title: 'Property A', addressLine1: '1 A St' });
    const propertyB = await createProperty(app, landlordB.accessToken, { title: 'Property B', addressLine1: '2 B St' });

    const tenant1 = await registerUser(app, { email: 'tenant1@sponsored.test', role: 'PROSPECTIVE_TENANT', displayName: 'Tenant One' });
    const tenant2 = await registerUser(app, { email: 'tenant2@sponsored.test', role: 'PROSPECTIVE_TENANT', displayName: 'Tenant Two' });
    await startConversation(tenant1.accessToken, propertyA);
    await startConversation(tenant2.accessToken, propertyB);

    const employer = await registerUser(app, { email: 'employer@sponsored.test', role: 'EMPLOYER', displayName: "McDonald's Corp" });

    return { landlordA, landlordB, tenant1, tenant2, employer };
  }

  const sponsoredPayload = {
    title: 'Cashier',
    employerName: "McDonald's",
    location: '500 Main St, Jacksonville, FL',
    applyUrl: 'https://careers.example.com/apply',
    costPerClickCents: 100,
    monthlyFeeCents: 500,
    initialBudgetCents: 300,
  };

  async function payPendingCheckout(checkoutUrl: string) {
    const orderId = new URL(checkoutUrl).searchParams.get('orderId');
    const webhook = await request(app.getHttpServer())
      .post('/api/payments/webhooks')
      .send({ providerOrderId: orderId, paid: true });
    expect(webhook.status).toBe(200);
  }

  it('forbids a non-employer (landlord, tenant) from creating a sponsored listing', async () => {
    const { landlordA, tenant1 } = await setup();
    const asLandlord = await request(app.getHttpServer())
      .post('/api/job-referrals/sponsored')
      .set('Authorization', `Bearer ${landlordA.accessToken}`)
      .send(sponsoredPayload);
    expect(asLandlord.status).toBe(403);

    const asTenant = await request(app.getHttpServer())
      .post('/api/job-referrals/sponsored')
      .set('Authorization', `Bearer ${tenant1.accessToken}`)
      .send(sponsoredPayload);
    expect(asTenant.status).toBe(403);
  });

  it('rejects an initial budget that cannot cover even one click', async () => {
    const { employer } = await setup();
    const res = await request(app.getHttpServer())
      .post('/api/job-referrals/sponsored')
      .set('Authorization', `Bearer ${employer.accessToken}`)
      .send({ ...sponsoredPayload, initialBudgetCents: 50 });
    expect(res.status).toBe(400);
  });

  it('creates a PENDING_PAYMENT listing invisible to tenants until the checkout webhook confirms', async () => {
    const { employer, tenant1 } = await setup();
    const created = await request(app.getHttpServer())
      .post('/api/job-referrals/sponsored')
      .set('Authorization', `Bearer ${employer.accessToken}`)
      .send(sponsoredPayload);
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('PENDING_PAYMENT');
    expect(created.body.checkoutUrl).toContain('/mock-checkout');

    const beforePay = await request(app.getHttpServer()).get('/api/job-referrals').set('Authorization', `Bearer ${tenant1.accessToken}`);
    expect(beforePay.body.map((r: { id: string }) => r.id)).not.toContain(created.body.id);

    await payPendingCheckout(created.body.checkoutUrl);

    const afterPay = await request(app.getHttpServer()).get('/api/job-referrals').set('Authorization', `Bearer ${tenant1.accessToken}`);
    const listing = afterPay.body.find((r: { id: string }) => r.id === created.body.id);
    expect(listing).toBeDefined();
    expect(listing.status).toBe('ACTIVE');
    expect(listing.budgetRemainingCents).toBe(300);
  });

  it('shows a paid sponsored listing to every tenant, regardless of which landlord they rent from', async () => {
    const { employer, tenant1, tenant2 } = await setup();
    const created = await request(app.getHttpServer())
      .post('/api/job-referrals/sponsored')
      .set('Authorization', `Bearer ${employer.accessToken}`)
      .send(sponsoredPayload);
    await payPendingCheckout(created.body.checkoutUrl);

    const asTenant1 = await request(app.getHttpServer()).get('/api/job-referrals').set('Authorization', `Bearer ${tenant1.accessToken}`);
    const asTenant2 = await request(app.getHttpServer()).get('/api/job-referrals').set('Authorization', `Bearer ${tenant2.accessToken}`);
    expect(asTenant1.body.map((r: { id: string }) => r.id)).toContain(created.body.id);
    expect(asTenant2.body.map((r: { id: string }) => r.id)).toContain(created.body.id);
  });

  it('bills a click against the prepaid budget, is idempotent per tenant per day, and never blocks the click-through', async () => {
    const { employer, tenant1 } = await setup();
    const created = await request(app.getHttpServer())
      .post('/api/job-referrals/sponsored')
      .set('Authorization', `Bearer ${employer.accessToken}`)
      .send(sponsoredPayload);
    await payPendingCheckout(created.body.checkoutUrl);

    const firstClick = await request(app.getHttpServer())
      .post(`/api/job-referrals/${created.body.id}/click`)
      .set('Authorization', `Bearer ${tenant1.accessToken}`);
    expect(firstClick.status).toBe(201);
    expect(firstClick.body.applyUrl).toBe(sponsoredPayload.applyUrl);

    const secondClick = await request(app.getHttpServer())
      .post(`/api/job-referrals/${created.body.id}/click`)
      .set('Authorization', `Bearer ${tenant1.accessToken}`);
    expect(secondClick.status).toBe(201);

    const posted = await request(app.getHttpServer())
      .get('/api/job-referrals/posted')
      .set('Authorization', `Bearer ${employer.accessToken}`);
    const listing = posted.body.find((r: { id: string }) => r.id === created.body.id);
    // Only one billed click — the same-day repeat wasn't charged again.
    expect(listing.clickCount).toBe(1);
    expect(listing.budgetRemainingCents).toBe(300 - 100);
  });

  it('stops charging and stops showing once the budget is exhausted, but still lets tenants through', async () => {
    const { employer, tenant1, tenant2 } = await setup();
    const created = await request(app.getHttpServer())
      .post('/api/job-referrals/sponsored')
      .set('Authorization', `Bearer ${employer.accessToken}`)
      .send(sponsoredPayload); // costPerClickCents 100, initialBudgetCents 300
    await payPendingCheckout(created.body.checkoutUrl);

    // Three distinct tenants each click once — budget goes 300 -> 200 -> 100 -> 0.
    const landlordC = await registerUser(app, { email: 'landlordC@sponsored.test', role: 'LANDLORD', displayName: 'Landlord C' });
    await verifyPhone(app, mockSms, landlordC.accessToken, '904-555-0202');
    const propertyC = await createProperty(app, landlordC.accessToken, { title: 'Property C', addressLine1: '3 C St' });
    const tenant3 = await registerUser(app, { email: 'tenant3@sponsored.test', role: 'PROSPECTIVE_TENANT', displayName: 'Tenant Three' });
    await startConversation(tenant3.accessToken, propertyC);

    for (const tenant of [tenant1, tenant2, tenant3]) {
      const click = await request(app.getHttpServer())
        .post(`/api/job-referrals/${created.body.id}/click`)
        .set('Authorization', `Bearer ${tenant.accessToken}`);
      expect(click.status).toBe(201);
      expect(click.body.applyUrl).toBe(sponsoredPayload.applyUrl);
    }

    const posted = await request(app.getHttpServer())
      .get('/api/job-referrals/posted')
      .set('Authorization', `Bearer ${employer.accessToken}`);
    const listing = posted.body.find((r: { id: string }) => r.id === created.body.id);
    expect(listing.budgetRemainingCents).toBe(0);
    expect(listing.clickCount).toBe(3);

    // Now exhausted — a 4th distinct tenant's click still isn't blocked...
    const landlordD = await registerUser(app, { email: 'landlordD@sponsored.test', role: 'LANDLORD', displayName: 'Landlord D' });
    await verifyPhone(app, mockSms, landlordD.accessToken, '904-555-0203');
    const propertyD = await createProperty(app, landlordD.accessToken, { title: 'Property D', addressLine1: '4 D St' });
    const tenant4 = await registerUser(app, { email: 'tenant4@sponsored.test', role: 'PROSPECTIVE_TENANT', displayName: 'Tenant Four' });
    await startConversation(tenant4.accessToken, propertyD);

    const unbilledClick = await request(app.getHttpServer())
      .post(`/api/job-referrals/${created.body.id}/click`)
      .set('Authorization', `Bearer ${tenant4.accessToken}`);
    expect(unbilledClick.status).toBe(201);
    expect(unbilledClick.body.applyUrl).toBe(sponsoredPayload.applyUrl);

    // ...but it wasn't billed (budget can't go negative), and the listing no
    // longer appears in anyone's tenant view.
    const stillZero = await request(app.getHttpServer())
      .get('/api/job-referrals/posted')
      .set('Authorization', `Bearer ${employer.accessToken}`);
    expect(stillZero.body.find((r: { id: string }) => r.id === created.body.id).budgetRemainingCents).toBe(0);

    const asTenant1 = await request(app.getHttpServer()).get('/api/job-referrals').set('Authorization', `Bearer ${tenant1.accessToken}`);
    expect(asTenant1.body.map((r: { id: string }) => r.id)).not.toContain(created.body.id);
  });

  it('reactivates visibility once a top-up payment is confirmed', async () => {
    const { employer, tenant1 } = await setup();
    const created = await request(app.getHttpServer())
      .post('/api/job-referrals/sponsored')
      .set('Authorization', `Bearer ${employer.accessToken}`)
      .send({ ...sponsoredPayload, initialBudgetCents: 100 });
    await payPendingCheckout(created.body.checkoutUrl);

    // Exhaust the budget with a single click.
    await request(app.getHttpServer())
      .post(`/api/job-referrals/${created.body.id}/click`)
      .set('Authorization', `Bearer ${tenant1.accessToken}`);

    const hidden = await request(app.getHttpServer()).get('/api/job-referrals').set('Authorization', `Bearer ${tenant1.accessToken}`);
    expect(hidden.body.map((r: { id: string }) => r.id)).not.toContain(created.body.id);

    const topUp = await request(app.getHttpServer())
      .post(`/api/job-referrals/${created.body.id}/topup`)
      .set('Authorization', `Bearer ${employer.accessToken}`)
      .send({ additionalBudgetCents: 200 });
    expect(topUp.status).toBe(201);
    expect(topUp.body.checkoutUrl).toContain('/mock-checkout');

    await payPendingCheckout(topUp.body.checkoutUrl);

    const visibleAgain = await request(app.getHttpServer()).get('/api/job-referrals').set('Authorization', `Bearer ${tenant1.accessToken}`);
    expect(visibleAgain.body.map((r: { id: string }) => r.id)).toContain(created.body.id);
    const listing = visibleAgain.body.find((r: { id: string }) => r.id === created.body.id);
    expect(listing.budgetRemainingCents).toBe(200);
  });

  it('extends the billing period on renew, and a listing past its period stops showing and stops accepting clicks', async () => {
    const { employer, tenant1 } = await setup();
    const created = await request(app.getHttpServer())
      .post('/api/job-referrals/sponsored')
      .set('Authorization', `Bearer ${employer.accessToken}`)
      .send(sponsoredPayload);
    await payPendingCheckout(created.body.checkoutUrl);

    // Force the period into the past to simulate a month having elapsed.
    await prisma.jobReferral.update({
      where: { id: created.body.id },
      data: { currentPeriodEnd: new Date(Date.now() - 1000) },
    });

    const expired = await request(app.getHttpServer()).get('/api/job-referrals').set('Authorization', `Bearer ${tenant1.accessToken}`);
    expect(expired.body.map((r: { id: string }) => r.id)).not.toContain(created.body.id);

    const clickAttempt = await request(app.getHttpServer())
      .post(`/api/job-referrals/${created.body.id}/click`)
      .set('Authorization', `Bearer ${tenant1.accessToken}`);
    expect(clickAttempt.status).toBe(400);

    const renew = await request(app.getHttpServer())
      .post(`/api/job-referrals/${created.body.id}/renew`)
      .set('Authorization', `Bearer ${employer.accessToken}`);
    expect(renew.status).toBe(201);
    await payPendingCheckout(renew.body.checkoutUrl);

    const restored = await request(app.getHttpServer()).get('/api/job-referrals').set('Authorization', `Bearer ${tenant1.accessToken}`);
    expect(restored.body.map((r: { id: string }) => r.id)).toContain(created.body.id);
    const listing = restored.body.find((r: { id: string }) => r.id === created.body.id);
    expect(new Date(listing.currentPeriodEnd).getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects a second top-up/renew while one is already awaiting payment', async () => {
    const { employer } = await setup();
    const created = await request(app.getHttpServer())
      .post('/api/job-referrals/sponsored')
      .set('Authorization', `Bearer ${employer.accessToken}`)
      .send(sponsoredPayload);
    await payPendingCheckout(created.body.checkoutUrl);

    const firstTopUp = await request(app.getHttpServer())
      .post(`/api/job-referrals/${created.body.id}/topup`)
      .set('Authorization', `Bearer ${employer.accessToken}`)
      .send({ additionalBudgetCents: 200 });
    expect(firstTopUp.status).toBe(201);

    const secondTopUp = await request(app.getHttpServer())
      .post(`/api/job-referrals/${created.body.id}/topup`)
      .set('Authorization', `Bearer ${employer.accessToken}`)
      .send({ additionalBudgetCents: 200 });
    expect(secondTopUp.status).toBe(400);

    const renewAttempt = await request(app.getHttpServer())
      .post(`/api/job-referrals/${created.body.id}/renew`)
      .set('Authorization', `Bearer ${employer.accessToken}`);
    expect(renewAttempt.status).toBe(400);
  });

  it('lets only the poster close their sponsored listing, and blocks further top-ups once closed', async () => {
    const { employer, landlordA } = await setup();
    const created = await request(app.getHttpServer())
      .post('/api/job-referrals/sponsored')
      .set('Authorization', `Bearer ${employer.accessToken}`)
      .send(sponsoredPayload);
    await payPendingCheckout(created.body.checkoutUrl);

    const forbidden = await request(app.getHttpServer())
      .patch(`/api/job-referrals/${created.body.id}/close`)
      .set('Authorization', `Bearer ${landlordA.accessToken}`);
    expect(forbidden.status).toBe(403);

    const closed = await request(app.getHttpServer())
      .patch(`/api/job-referrals/${created.body.id}/close`)
      .set('Authorization', `Bearer ${employer.accessToken}`);
    expect(closed.status).toBe(200);
    expect(closed.body.status).toBe('CLOSED');

    const topUpAfterClose = await request(app.getHttpServer())
      .post(`/api/job-referrals/${created.body.id}/topup`)
      .set('Authorization', `Bearer ${employer.accessToken}`)
      .send({ additionalBudgetCents: 200 });
    expect(topUpAfterClose.status).toBe(400);
  });
});
