import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockSmsProvider } from '../src/sms/providers/mock-sms.provider';
import { MockEmailProvider } from '../src/email/providers/mock-email.provider';
import { createTestApp, resetDatabase, resetRedis, createRelayNumber } from './utils/test-app';
import { registerUser, verifyPhone, createProperty } from './utils/flows';

describe('Showings (e2e)', () => {
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
    const landlord = await registerUser(app, { email: 'landlord@showing.test', role: 'LANDLORD', displayName: 'Acme Rentals' });
    await verifyPhone(app, mockSms, landlord.accessToken, '904-555-0100');
    const tenant = await registerUser(app, { email: 'tenant@showing.test', role: 'PROSPECTIVE_TENANT', displayName: 'Jane Doe' });
    await verifyPhone(app, mockSms, tenant.accessToken, '904-555-0199');
    const outsider = await registerUser(app, { email: 'outsider@showing.test', role: 'PROSPECTIVE_TENANT', displayName: 'Nosy' });
    const propertyId = await createProperty(app, landlord.accessToken);

    const convoRes = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId, message: 'Is this available?' });
    const conversationId = convoRes.body.conversation.id as string;

    return { landlord, tenant, outsider, propertyId, conversationId };
  }

  const futureTime = () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  it('lets the tenant propose a showing time', async () => {
    const { tenant, conversationId } = await setup();

    const res = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/showings`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ startTime: futureTime() });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('REQUESTED');
    expect(res.body.timeSlots.length).toBe(1);
  });

  it('rejects a showing time in the past', async () => {
    const { tenant, conversationId } = await setup();
    const res = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/showings`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ startTime: new Date(Date.now() - 60_000).toISOString() });
    expect(res.status).toBe(400);
  });

  it('forbids someone outside the conversation from proposing or viewing showings', async () => {
    const { outsider, conversationId } = await setup();
    const proposeRes = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/showings`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .send({ startTime: futureTime() });
    expect(proposeRes.status).toBe(403);

    const listRes = await request(app.getHttpServer())
      .get(`/api/conversations/${conversationId}/showings`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);
    expect(listRes.status).toBe(403);
  });

  it('lets the landlord accept a proposed slot, scheduling the showing and emailing both sides a calendar invite', async () => {
    const { landlord, tenant, conversationId } = await setup();

    const proposed = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/showings`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ startTime: futureTime(), durationMinutes: 45 });
    const showingId = proposed.body.id as string;
    const slotId = proposed.body.timeSlots[0].id as string;

    const accepted = await request(app.getHttpServer())
      .patch(`/api/conversations/${conversationId}/showings/${showingId}/slots/${slotId}/accept`)
      .set('Authorization', `Bearer ${landlord.accessToken}`);
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('SCHEDULED');
    expect(accepted.body.timeSlots[0].isSelected).toBe(true);

    const tenantEmail = mockEmail.getLastEmailTo('tenant@showing.test');
    const landlordEmail = mockEmail.getLastEmailTo('landlord@showing.test');
    expect(tenantEmail).toBeDefined();
    expect(landlordEmail).toBeDefined();
    expect(tenantEmail!.subject).toContain('Showing scheduled');
    expect(tenantEmail!.attachmentFilenames).toContain('showing.ics');
    expect(landlordEmail!.attachmentFilenames).toContain('showing.ics');
  });

  it('lets either party cancel an open showing', async () => {
    const { tenant, conversationId } = await setup();
    const proposed = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/showings`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ startTime: futureTime() });

    const cancelled = await request(app.getHttpServer())
      .patch(`/api/conversations/${conversationId}/showings/${proposed.body.id}/cancel`)
      .set('Authorization', `Bearer ${tenant.accessToken}`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('CANCELLED');
  });
});
