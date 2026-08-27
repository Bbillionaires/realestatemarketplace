import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDatabase } from './utils/test-app';
import { registerUser, createProperty } from './utils/flows';

describe('Featured Listing Boost (e2e)', () => {
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

  it('creates a $29 checkout for the owning landlord and forbids everyone else', async () => {
    const owner = await registerUser(app, { email: 'boost-owner@example.com', role: 'LANDLORD' });
    const otherLandlord = await registerUser(app, { email: 'boost-other-landlord@example.com', role: 'LANDLORD' });
    const tenant = await registerUser(app, { email: 'boost-tenant@example.com', role: 'PROSPECTIVE_TENANT' });
    const propertyId = await createProperty(app, owner.accessToken, { title: 'Boost Fee Test' });

    const forbiddenLandlord = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/boost`)
      .set('Authorization', `Bearer ${otherLandlord.accessToken}`);
    expect(forbiddenLandlord.status).toBe(403);

    const forbiddenTenant = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/boost`)
      .set('Authorization', `Bearer ${tenant.accessToken}`);
    expect(forbiddenTenant.status).toBe(403);

    const res = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/boost`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(res.status).toBe(201);
    expect(res.body.boostCheckoutUrl).toContain('amountCents=2900');
    expect(res.body.boostedUntil).toBeNull();
  });

  it('sets boostedUntil ~30 days out once the payment webhook fires', async () => {
    const owner = await registerUser(app, { email: 'boost-webhook-owner@example.com', role: 'LANDLORD' });
    const propertyId = await createProperty(app, owner.accessToken, { title: 'Boost Webhook Test' });

    const checkout = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/boost`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    const orderId = extractOrderId(checkout.body.boostCheckoutUrl);

    const webhook = await request(app.getHttpServer()).post('/api/payments/webhooks').send({ providerOrderId: orderId, paid: true });
    expect(webhook.status).toBe(200);

    const after = await request(app.getHttpServer())
      .get(`/api/properties/${propertyId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(after.body.boostedUntil).not.toBeNull();
    const daysUntilExpiry = (new Date(after.body.boostedUntil).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysUntilExpiry).toBeGreaterThan(29);
    expect(daysUntilExpiry).toBeLessThan(31);
  });

  it('surfaces a boosted property first in search results, ahead of newer unboosted ones', async () => {
    const owner = await registerUser(app, { email: 'boost-order-owner@example.com', role: 'LANDLORD' });
    const tenant = await registerUser(app, { email: 'boost-order-tenant@example.com', role: 'PROSPECTIVE_TENANT' });

    const olderBoostedId = await createProperty(app, owner.accessToken, { title: 'Older Boosted' });
    const checkout = await request(app.getHttpServer())
      .post(`/api/properties/${olderBoostedId}/boost`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    await request(app.getHttpServer())
      .post('/api/payments/webhooks')
      .send({ providerOrderId: extractOrderId(checkout.body.boostCheckoutUrl), paid: true });

    await createProperty(app, owner.accessToken, { title: 'Newer Unboosted' });

    const list = await request(app.getHttpServer()).get('/api/properties').set('Authorization', `Bearer ${tenant.accessToken}`);
    expect(list.status).toBe(200);
    const titles = list.body.map((p: { title: string }) => p.title);
    expect(titles.indexOf('Older Boosted')).toBeLessThan(titles.indexOf('Newer Unboosted'));
  });
});
