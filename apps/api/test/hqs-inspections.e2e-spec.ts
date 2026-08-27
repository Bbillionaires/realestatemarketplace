import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockEmailProvider } from '../src/email/providers/mock-email.provider';
import { createTestApp, resetDatabase } from './utils/test-app';
import { registerUser, createProperty } from './utils/flows';

describe('HQS pre-inspection packages (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let mockEmail: MockEmailProvider;

  beforeAll(async () => {
    ({ app, moduleRef } = await createTestApp());
    prisma = moduleRef.get(PrismaService);
    mockEmail = moduleRef.get(MockEmailProvider);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    mockEmail.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  function extractOrderId(checkoutUrl: string): string {
    const url = new URL(checkoutUrl);
    return url.searchParams.get('orderId')!;
  }

  async function payFor(propertyId: string, landlordToken: string) {
    const created = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/hqs-inspections`)
      .set('Authorization', `Bearer ${landlordToken}`);
    const webhook = await request(app.getHttpServer())
      .post('/api/payments/webhooks')
      .send({ providerOrderId: extractOrderId(created.body.checkoutUrl), paid: true });
    expect(webhook.status).toBe(200);
    return created.body.id as string;
  }

  it('starts a $199 checkout for the owning landlord, and forbids everyone else', async () => {
    const owner = await registerUser(app, { email: 'hqs-owner@example.com', role: 'LANDLORD' });
    const otherLandlord = await registerUser(app, { email: 'hqs-other@example.com', role: 'LANDLORD' });
    const tenant = await registerUser(app, { email: 'hqs-tenant@example.com', role: 'PROSPECTIVE_TENANT' });
    const propertyId = await createProperty(app, owner.accessToken, { title: 'HQS Fee Test' });

    const forbidden = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/hqs-inspections`)
      .set('Authorization', `Bearer ${otherLandlord.accessToken}`);
    expect(forbidden.status).toBe(403);

    const tenantForbidden = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/hqs-inspections`)
      .set('Authorization', `Bearer ${tenant.accessToken}`);
    expect(tenantForbidden.status).toBe(403);

    const res = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/hqs-inspections`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('AWAITING_PAYMENT');
    expect(res.body.feeCents).toBe(19900);
  });

  it('reuses the existing open request instead of creating a duplicate', async () => {
    const owner = await registerUser(app, { email: 'hqs-dup@example.com', role: 'LANDLORD' });
    const propertyId = await createProperty(app, owner.accessToken, { title: 'HQS Dup Test' });

    const first = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/hqs-inspections`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    const second = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/hqs-inspections`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(second.body.id).toBe(first.body.id);
  });

  it('rejects requesting a walkthrough before the fee is paid, then emails the inspections team once paid', async () => {
    const owner = await registerUser(app, { email: 'hqs-flow@example.com', role: 'LANDLORD' });
    const propertyId = await createProperty(app, owner.accessToken, { title: 'HQS Flow Test' });

    const created = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/hqs-inspections`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    const requestId = created.body.id as string;

    const tooEarly = await request(app.getHttpServer())
      .post(`/api/hqs-inspections/${requestId}/request`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ preferredDateNote: 'Mornings' });
    expect(tooEarly.status).toBe(400);

    await request(app.getHttpServer())
      .post('/api/payments/webhooks')
      .send({ providerOrderId: extractOrderId(created.body.checkoutUrl), paid: true });

    const requested = await request(app.getHttpServer())
      .post(`/api/hqs-inspections/${requestId}/request`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ preferredDateNote: 'Weekday mornings' });
    expect(requested.status).toBe(201);
    expect(requested.body.status).toBe('REQUESTED');
    expect(requested.body.emailSent).toBe(true);

    const emailed = mockEmail.getLastEmailTo('inspections@affordablehomematch.com');
    expect(emailed).toBeDefined();
    expect(emailed?.subject).toContain('HQS Flow Test');
    expect(emailed?.text).toContain('Weekday mornings');
  });

  it('lets the owning landlord cancel an unpaid request', async () => {
    const owner = await registerUser(app, { email: 'hqs-cancel@example.com', role: 'LANDLORD' });
    const propertyId = await createProperty(app, owner.accessToken, { title: 'HQS Cancel Test' });
    const created = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/hqs-inspections`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    const cancelled = await request(app.getHttpServer())
      .patch(`/api/hqs-inspections/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('CANCELLED');
  });

  it('lets an assigned property manager (not just the owner) manage inspection requests', async () => {
    const owner = await registerUser(app, { email: 'hqs-mgr-owner@example.com', role: 'LANDLORD' });
    const manager = await registerUser(app, { email: 'hqs-mgr@example.com', role: 'PROPERTY_MANAGER' });
    const propertyId = await createProperty(app, owner.accessToken, { title: 'HQS Manager Test' });

    await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/managers`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ userId: manager.userId });

    const res = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/hqs-inspections`)
      .set('Authorization', `Bearer ${manager.accessToken}`);
    expect(res.status).toBe(201);
  });
});
