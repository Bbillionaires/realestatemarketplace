import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockEmailProvider } from '../src/email/providers/mock-email.provider';
import { createTestApp, resetDatabase, createRelayNumber } from './utils/test-app';
import { registerUser, createProperty } from './utils/flows';

describe('Tenant Fast-Track packet (e2e)', () => {
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
    await createRelayNumber(prisma, '+18885551000');
  });

  afterAll(async () => {
    await app.close();
  });

  function extractOrderId(checkoutUrl: string): string {
    const url = new URL(checkoutUrl);
    return url.searchParams.get('orderId')!;
  }

  async function payAndSubmit(tenantToken: string) {
    const checkout = await request(app.getHttpServer()).post('/api/tenant-packet/checkout').set('Authorization', `Bearer ${tenantToken}`);
    await request(app.getHttpServer())
      .post('/api/payments/webhooks')
      .send({ providerOrderId: extractOrderId(checkout.body.checkoutUrl), paid: true });
    const submitted = await request(app.getHttpServer())
      .post('/api/tenant-packet/submit')
      .set('Authorization', `Bearer ${tenantToken}`)
      .field('backgroundExplanation', 'Evicted 4 years ago, stable since.')
      .field('references', 'Prior landlord: Jane Smith, 555-0100')
      .attach('file', Buffer.from('fake income proof'), 'income-proof.pdf');
    return submitted;
  }

  it('starts a tenant with NOT_STARTED, and forbids a landlord from having a packet', async () => {
    const tenant = await registerUser(app, { email: 'packet-tenant-default@example.com', role: 'PROSPECTIVE_TENANT' });
    const res = await request(app.getHttpServer()).get('/api/tenant-packet/me').set('Authorization', `Bearer ${tenant.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: null, status: 'NOT_STARTED', feeCents: 2900 });

    const landlord = await registerUser(app, { email: 'packet-landlord-forbidden@example.com', role: 'LANDLORD' });
    const forbidden = await request(app.getHttpServer()).get('/api/tenant-packet/me').set('Authorization', `Bearer ${landlord.accessToken}`);
    expect(forbidden.status).toBe(403);
  });

  it('rejects submitting before the fee is paid', async () => {
    const tenant = await registerUser(app, { email: 'packet-tenant-early@example.com', role: 'PROSPECTIVE_TENANT' });
    const res = await request(app.getHttpServer())
      .post('/api/tenant-packet/submit')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .field('backgroundExplanation', 'test');
    expect(res.status).toBe(400);
  });

  it('rejects paying again once already paid', async () => {
    const tenant = await registerUser(app, { email: 'packet-tenant-double-pay@example.com', role: 'PROSPECTIVE_TENANT' });
    const checkout = await request(app.getHttpServer()).post('/api/tenant-packet/checkout').set('Authorization', `Bearer ${tenant.accessToken}`);
    await request(app.getHttpServer())
      .post('/api/payments/webhooks')
      .send({ providerOrderId: extractOrderId(checkout.body.checkoutUrl), paid: true });

    const again = await request(app.getHttpServer()).post('/api/tenant-packet/checkout').set('Authorization', `Bearer ${tenant.accessToken}`);
    expect(again.status).toBe(400);
  });

  it('lets the tenant submit their packet once paid, persisting the file so it can be reused', async () => {
    const tenant = await registerUser(app, { email: 'packet-tenant-submit@example.com', role: 'PROSPECTIVE_TENANT' });
    const submitted = await payAndSubmit(tenant.accessToken);
    expect(submitted.status).toBe(201);
    expect(submitted.body.status).toBe('SUBMITTED');
    expect(submitted.body.incomeProofFileName).toBe('income-proof.pdf');

    const mine = await request(app.getHttpServer()).get('/api/tenant-packet/me').set('Authorization', `Bearer ${tenant.accessToken}`);
    expect(mine.body.status).toBe('SUBMITTED');
    expect(mine.body.backgroundExplanation).toContain('Evicted 4 years ago');
  });

  it('shares the submitted packet — with the income-proof attachment — into a conversation, and can be reused across a second conversation', async () => {
    const tenant = await registerUser(app, { email: 'packet-tenant-share@example.com', role: 'PROSPECTIVE_TENANT' });
    await payAndSubmit(tenant.accessToken);

    const landlordA = await registerUser(app, { email: 'packet-landlord-a@example.com', role: 'LANDLORD' });
    const propertyA = await createProperty(app, landlordA.accessToken, { title: 'Packet Share House A' });
    const convoA = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId: propertyA, message: 'Hi!' });

    const shareA = await request(app.getHttpServer())
      .post(`/api/conversations/${convoA.body.conversation.id}/tenant-packet/share`)
      .set('Authorization', `Bearer ${tenant.accessToken}`);
    expect(shareA.status).toBe(201);
    expect(shareA.body.emailed).toBe(true);

    const emailedA = mockEmail.getLastEmailTo('packet-landlord-a@example.com');
    expect(emailedA?.subject).toContain('Packet Share House A');
    expect(emailedA?.attachmentFilenames).toContain('income-proof.pdf');

    // Reused into a second, unrelated conversation without re-paying or re-submitting.
    const landlordB = await registerUser(app, { email: 'packet-landlord-b@example.com', role: 'LANDLORD' });
    const propertyB = await createProperty(app, landlordB.accessToken, { title: 'Packet Share House B' });
    const convoB = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId: propertyB, message: 'Hi!' });

    const shareB = await request(app.getHttpServer())
      .post(`/api/conversations/${convoB.body.conversation.id}/tenant-packet/share`)
      .set('Authorization', `Bearer ${tenant.accessToken}`);
    expect(shareB.status).toBe(201);
    const emailedB = mockEmail.getLastEmailTo('packet-landlord-b@example.com');
    expect(emailedB?.subject).toContain('Packet Share House B');
    expect(emailedB?.attachmentFilenames).toContain('income-proof.pdf');
  });

  it('rejects sharing before the packet is submitted, and forbids a non-participant from sharing on someone else\'s conversation', async () => {
    const tenant = await registerUser(app, { email: 'packet-tenant-unsubmitted@example.com', role: 'PROSPECTIVE_TENANT' });
    const landlord = await registerUser(app, { email: 'packet-landlord-unsubmitted@example.com', role: 'LANDLORD' });
    const propertyId = await createProperty(app, landlord.accessToken, { title: 'Packet Unsubmitted Test' });
    const convo = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId, message: 'Hi!' });

    const tooEarly = await request(app.getHttpServer())
      .post(`/api/conversations/${convo.body.conversation.id}/tenant-packet/share`)
      .set('Authorization', `Bearer ${tenant.accessToken}`);
    expect(tooEarly.status).toBe(400);

    const otherTenant = await registerUser(app, { email: 'packet-tenant-other@example.com', role: 'PROSPECTIVE_TENANT' });
    await payAndSubmit(otherTenant.accessToken);
    const forbidden = await request(app.getHttpServer())
      .post(`/api/conversations/${convo.body.conversation.id}/tenant-packet/share`)
      .set('Authorization', `Bearer ${otherTenant.accessToken}`);
    expect(forbidden.status).toBe(403);
  });
});
