import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDatabase } from './utils/test-app';
import { registerUser } from './utils/flows';

describe('Landlord subscriptions (e2e)', () => {
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

  function extractOrderId(checkoutUrl: string): string {
    const url = new URL(checkoutUrl);
    return url.searchParams.get('orderId')!;
  }

  it('starts every landlord on the FREE tier, auto-creating the record on first read', async () => {
    const landlord = await registerUser(app, { email: 'landlord-sub-default@example.com', role: 'LANDLORD' });
    const res = await request(app.getHttpServer()).get('/api/subscriptions/me').set('Authorization', `Bearer ${landlord.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ tier: 'FREE', expiresAt: null, isActive: false, pendingTier: null, checkoutUrl: null });
  });

  it('forbids a prospective tenant from reading or purchasing a subscription', async () => {
    const tenant = await registerUser(app, { email: 'tenant-sub-forbidden@example.com', role: 'PROSPECTIVE_TENANT' });
    const getRes = await request(app.getHttpServer()).get('/api/subscriptions/me').set('Authorization', `Bearer ${tenant.accessToken}`);
    expect(getRes.status).toBe(403);

    const checkoutRes = await request(app.getHttpServer())
      .post('/api/subscriptions/checkout')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ tier: 'PRO' });
    expect(checkoutRes.status).toBe(403);
  });

  it('rejects an invalid tier', async () => {
    const landlord = await registerUser(app, { email: 'landlord-sub-invalid@example.com', role: 'LANDLORD' });
    const res = await request(app.getHttpServer())
      .post('/api/subscriptions/checkout')
      .set('Authorization', `Bearer ${landlord.accessToken}`)
      .send({ tier: 'GOLD' });
    expect(res.status).toBe(400);
  });

  it('creates a $49 checkout for PRO and a $99 checkout for UNLIMITED', async () => {
    const landlord = await registerUser(app, { email: 'landlord-sub-fees@example.com', role: 'LANDLORD' });

    const pro = await request(app.getHttpServer())
      .post('/api/subscriptions/checkout')
      .set('Authorization', `Bearer ${landlord.accessToken}`)
      .send({ tier: 'PRO' });
    expect(pro.status).toBe(201);
    expect(pro.body.pendingTier).toBe('PRO');
    expect(pro.body.checkoutUrl).toContain('amountCents=4900');

    const unlimited = await request(app.getHttpServer())
      .post('/api/subscriptions/checkout')
      .set('Authorization', `Bearer ${landlord.accessToken}`)
      .send({ tier: 'UNLIMITED' });
    expect(unlimited.status).toBe(201);
    expect(unlimited.body.pendingTier).toBe('UNLIMITED');
    expect(unlimited.body.checkoutUrl).toContain('amountCents=9900');
  });

  it('upgrades the tier and sets a ~30-day expiresAt once the payment webhook fires', async () => {
    const landlord = await registerUser(app, { email: 'landlord-sub-webhook@example.com', role: 'LANDLORD' });

    const checkout = await request(app.getHttpServer())
      .post('/api/subscriptions/checkout')
      .set('Authorization', `Bearer ${landlord.accessToken}`)
      .send({ tier: 'PRO' });
    const orderId = extractOrderId(checkout.body.checkoutUrl);

    const webhook = await request(app.getHttpServer()).post('/api/payments/webhooks').send({ providerOrderId: orderId, paid: true });
    expect(webhook.status).toBe(200);

    const after = await request(app.getHttpServer()).get('/api/subscriptions/me').set('Authorization', `Bearer ${landlord.accessToken}`);
    expect(after.body.tier).toBe('PRO');
    expect(after.body.pendingTier).toBeNull();
    expect(after.body.isActive).toBe(true);
    const daysUntilExpiry = (new Date(after.body.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysUntilExpiry).toBeGreaterThan(29);
    expect(daysUntilExpiry).toBeLessThan(31);
  });

  it('redelivering the same webhook event is a no-op (pendingTier already cleared)', async () => {
    const landlord = await registerUser(app, { email: 'landlord-sub-redelivery@example.com', role: 'LANDLORD' });
    const checkout = await request(app.getHttpServer())
      .post('/api/subscriptions/checkout')
      .set('Authorization', `Bearer ${landlord.accessToken}`)
      .send({ tier: 'PRO' });
    const orderId = extractOrderId(checkout.body.checkoutUrl);

    await request(app.getHttpServer()).post('/api/payments/webhooks').send({ providerOrderId: orderId, paid: true });
    const first = await request(app.getHttpServer()).get('/api/subscriptions/me').set('Authorization', `Bearer ${landlord.accessToken}`);

    await request(app.getHttpServer()).post('/api/payments/webhooks').send({ providerOrderId: orderId, paid: true });
    const second = await request(app.getHttpServer()).get('/api/subscriptions/me').set('Authorization', `Bearer ${landlord.accessToken}`);

    expect(second.body.expiresAt).toBe(first.body.expiresAt);
  });

  it('ignores a payment webhook with an unrecognized order id', async () => {
    const res = await request(app.getHttpServer()).post('/api/payments/webhooks').send({ providerOrderId: 'mock_order_unknown', paid: true });
    expect(res.status).toBe(200);
  });
});
