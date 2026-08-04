import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockSmsProvider } from '../src/sms/providers/mock-sms.provider';
import { MockEmailProvider } from '../src/email/providers/mock-email.provider';
import { createTestApp, resetDatabase, resetRedis, createRelayNumber } from './utils/test-app';
import { registerUser, verifyPhone, createProperty } from './utils/flows';

describe('ID submissions (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let mockSms: MockSmsProvider;
  let mockEmail: MockEmailProvider;

  beforeAll(async () => {
    ({ app, moduleRef } = await createTestApp());
    prisma = moduleRef.get(PrismaService);
    mockSms = moduleRef.get(MockSmsProvider);
    mockEmail = moduleRef.get(MockEmailProvider);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await resetRedis(moduleRef);
    mockSms.clear();
    mockEmail.clear();
    await createRelayNumber(prisma, '+18885551000');
  });

  afterAll(async () => {
    await app.close();
  });

  async function setup() {
    const landlord = await registerUser(app, { email: 'landlord@idsub.test', role: 'LANDLORD', displayName: 'Acme Rentals' });
    await verifyPhone(app, mockSms, landlord.accessToken, '904-555-0100');
    const tenant = await registerUser(app, { email: 'tenant@idsub.test', role: 'PROSPECTIVE_TENANT', displayName: 'Jane Doe' });
    await verifyPhone(app, mockSms, tenant.accessToken, '904-555-0199');
    const otherTenant = await registerUser(app, { email: 'other-tenant@idsub.test', role: 'PROSPECTIVE_TENANT', displayName: 'Other' });
    const propertyId = await createProperty(app, landlord.accessToken);

    const convoRes = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId, message: 'Hi, is this available?' });
    const conversationId = convoRes.body.conversation.id as string;

    return { landlord, tenant, otherTenant, propertyId, conversationId };
  }

  async function payFor(conversationId: string, tenantToken: string) {
    const created = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/id-submissions`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({});
    const webhook = await request(app.getHttpServer())
      .post('/api/payments/webhooks')
      .send({ providerOrderId: extractOrderId(created.body.checkoutUrl), paid: true });
    expect(webhook.status).toBe(200);
    return created.body.id as string;
  }

  function extractOrderId(checkoutUrl: string): string {
    const url = new URL(checkoutUrl);
    return url.searchParams.get('orderId')!;
  }

  it('lets the tenant start an ID submission, awaiting payment with a $5 fee', async () => {
    const { tenant, conversationId } = await setup();

    const res = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/id-submissions`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('AWAITING_PAYMENT');
    expect(res.body.feeCents).toBe(500);
    expect(res.body.checkoutUrl).toContain('/mock-checkout');
  });

  it('forbids the landlord (or anyone but the tenant) from starting an ID submission', async () => {
    const { landlord, otherTenant, conversationId } = await setup();

    const asLandlord = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/id-submissions`)
      .set('Authorization', `Bearer ${landlord.accessToken}`)
      .send({});
    expect(asLandlord.status).toBe(403);

    const asOtherTenant = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/id-submissions`)
      .set('Authorization', `Bearer ${otherTenant.accessToken}`)
      .send({});
    expect(asOtherTenant.status).toBe(403);
  });

  it('reuses the existing open submission instead of creating a duplicate', async () => {
    const { tenant, conversationId } = await setup();

    const first = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/id-submissions`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({});
    const second = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/id-submissions`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({});
    expect(second.body.id).toBe(first.body.id);

    const list = await request(app.getHttpServer())
      .get(`/api/conversations/${conversationId}/id-submissions`)
      .set('Authorization', `Bearer ${tenant.accessToken}`);
    expect(list.body.length).toBe(1);
  });

  it('rejects submitting the ID before the fee is paid', async () => {
    const { tenant, conversationId } = await setup();

    const created = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/id-submissions`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({});

    const res = await request(app.getHttpServer())
      .post(`/api/id-submissions/${created.body.id}/submit`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .attach('file', Buffer.from('fake-id-bytes'), 'license.jpg');
    expect(res.status).toBe(400);
  });

  it('marks the submission paid once the payment webhook fires, then lets the tenant submit the ID which emails the landlord', async () => {
    const { landlord, tenant, conversationId } = await setup();

    const submissionId = await payFor(conversationId, tenant.accessToken);

    const status = await request(app.getHttpServer())
      .get(`/api/conversations/${conversationId}/id-submissions`)
      .set('Authorization', `Bearer ${tenant.accessToken}`);
    expect(status.body[0].status).toBe('PAID');

    const res = await request(app.getHttpServer())
      .post(`/api/id-submissions/${submissionId}/submit`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .field('note', 'Here is my ID')
      .attach('file', Buffer.from('fake-id-bytes'), 'license.jpg');
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SUBMITTED');
    expect(res.body.emailSent).toBe(true);
    expect(res.body.submittedFileName).toBe('license.jpg');

    const email = mockEmail.getLastEmailTo('landlord@idsub.test');
    expect(email).toBeDefined();
    expect(email!.subject).toContain('ID submitted');
    expect(email!.attachmentFilenames).toContain('license.jpg');
    void landlord;
  });

  it('rejects submitting again once already submitted', async () => {
    const { tenant, conversationId } = await setup();
    const submissionId = await payFor(conversationId, tenant.accessToken);

    await request(app.getHttpServer())
      .post(`/api/id-submissions/${submissionId}/submit`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .attach('file', Buffer.from('fake-id-bytes'), 'license.jpg');

    const second = await request(app.getHttpServer())
      .post(`/api/id-submissions/${submissionId}/submit`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .attach('file', Buffer.from('fake-id-bytes-2'), 'license2.jpg');
    expect(second.status).toBe(400);
  });

  it('lets the tenant cancel an unpaid submission', async () => {
    const { tenant, conversationId } = await setup();
    const created = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/id-submissions`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({});

    const cancelled = await request(app.getHttpServer())
      .patch(`/api/id-submissions/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${tenant.accessToken}`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    // Cancelling frees up a new submission to be created instead of reusing the cancelled one.
    const again = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/id-submissions`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({});
    expect(again.body.id).not.toBe(created.body.id);
  });

  it('rejects a payment webhook with an unrecognized order id (no matching submission)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/payments/webhooks')
      .send({ providerOrderId: 'mock_order_does_not_exist', paid: true });
    expect(res.status).toBe(200); // acknowledged, but no submission is affected
  });
});
