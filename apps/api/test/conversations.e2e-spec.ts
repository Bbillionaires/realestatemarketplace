import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockSmsProvider } from '../src/sms/providers/mock-sms.provider';
import { createTestApp, resetDatabase, resetRedis, createRelayNumber } from './utils/test-app';
import { registerUser, verifyPhone, createProperty } from './utils/flows';

describe('Conversations + Messages (e2e)', () => {
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
  });

  afterAll(async () => {
    await app.close();
  });

  async function setupLandlordTenantProperty() {
    const landlord = await registerUser(app, { email: 'landlord@test.com', role: 'LANDLORD', displayName: 'Acme Rentals' });
    await verifyPhone(app, mockSms, landlord.accessToken, '904-555-0100');
    const tenant = await registerUser(app, { email: 'tenant@test.com', role: 'PROSPECTIVE_TENANT', displayName: 'Jane Doe' });
    await verifyPhone(app, mockSms, tenant.accessToken, '904-555-0199');
    const propertyId = await createProperty(app, landlord.accessToken);
    return { landlord, tenant, propertyId };
  }

  it('lets a tenant start a conversation, assigns a relay number, and delivers the first message via SMS', async () => {
    const { landlord, tenant, propertyId } = await setupLandlordTenantProperty();

    const res = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId, message: 'Is this property still available?' });

    expect(res.status).toBe(201);
    expect(res.body.delivered).toBe(true);
    expect(res.body.conversation.relayPhoneNumber).toBe('+18885551000');
    expect(res.body.conversation.status).toBe('NEW_INQUIRY');
    expect(res.body.message.status).toBe('SENT');

    const sent = mockSms.getLastMessageTo('+19045550100');
    expect(sent).toBeDefined();
    expect(sent!.body).toContain('New inquiry');
    expect(sent!.body).toContain('Is this property still available?');
    void landlord;
  });

  it('forbids a landlord from starting a conversation (only tenants can initiate)', async () => {
    const { landlord, propertyId } = await setupLandlordTenantProperty();
    const res = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${landlord.accessToken}`)
      .send({ propertyId, message: 'Hello' });
    expect(res.status).toBe(403);
  });

  it('reuses the existing conversation for the same tenant + property instead of creating a duplicate', async () => {
    const { tenant, propertyId } = await setupLandlordTenantProperty();

    const first = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId, message: 'First message' });

    const second = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId, message: 'Second message' });

    expect(second.body.conversation.id).toBe(first.body.conversation.id);

    const all = await prisma.conversation.findMany({ where: { propertyId, tenantId: tenant.userId } });
    expect(all.length).toBe(1);
  });

  it('anonymizes the tenant identity for the landlord everywhere (conversation header and message bubbles)', async () => {
    const { landlord, tenant, propertyId } = await setupLandlordTenantProperty();

    const start = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId, message: 'Hello there' });
    const conversationId = start.body.conversation.id;

    const asLandlord = await request(app.getHttpServer())
      .get(`/api/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${landlord.accessToken}`);
    expect(asLandlord.body.tenantDisplayName).toMatch(/^Tenant #\d{4}$/);
    expect(asLandlord.body.tenantDisplayName).not.toContain('Jane');

    const messages = await request(app.getHttpServer())
      .get(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${landlord.accessToken}`);
    expect(JSON.stringify(messages.body)).not.toContain('Jane');
    expect(messages.body[0].senderDisplayName).toMatch(/^Tenant #\d{4}$/);
  });

  it('transitions conversation status to ACTIVE once the landlord replies, and delivers the reply via the relay number', async () => {
    const { landlord, tenant, propertyId } = await setupLandlordTenantProperty();

    const start = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId, message: 'Is this available?' });
    const conversationId = start.body.conversation.id;

    const reply = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${landlord.accessToken}`)
      .send({ content: 'Yes it is!' });
    expect(reply.status).toBe(201);
    expect(reply.body.delivered).toBe(true);

    const conv = await request(app.getHttpServer())
      .get(`/api/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${tenant.accessToken}`);
    expect(conv.body.status).toBe('ACTIVE');

    const sentToTenant = mockSms.getLastMessageTo('+19045550199');
    expect(sentToTenant!.body).toContain('Yes it is!');
  });

  it('prevents a user who is not a participant from viewing the conversation or its messages', async () => {
    const { tenant, propertyId } = await setupLandlordTenantProperty();
    const stranger = await registerUser(app, { email: 'stranger@test.com', role: 'PROSPECTIVE_TENANT' });

    const start = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId, message: 'Hi' });
    const conversationId = start.body.conversation.id;

    const viewConv = await request(app.getHttpServer())
      .get(`/api/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${stranger.accessToken}`);
    expect(viewConv.status).toBe(403);

    const viewMessages = await request(app.getHttpServer())
      .get(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${stranger.accessToken}`);
    expect(viewMessages.status).toBe(403);
  });

  it('blocks a message containing a phone number, never forwards it, and keeps it visible only to its sender', async () => {
    const { landlord, tenant, propertyId } = await setupLandlordTenantProperty();

    const start = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId, message: 'Hi, interested in this unit' });
    const conversationId = start.body.conversation.id;

    const blocked = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ content: 'call me at 904-555-4444' });
    expect(blocked.status).toBe(201);
    expect(blocked.body.delivered).toBe(false);
    expect(blocked.body.guidance).toContain('not delivered');

    const landlordMessages = await request(app.getHttpServer())
      .get(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${landlord.accessToken}`);
    expect(JSON.stringify(landlordMessages.body)).not.toContain('904-555-4444');

    const tenantMessages = await request(app.getHttpServer())
      .get(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${tenant.accessToken}`);
    expect(JSON.stringify(tenantMessages.body)).toContain('904-555-4444');

    const violations = await prisma.violation.findMany({ where: { userId: tenant.userId } });
    expect(violations.length).toBe(1);
    expect(violations[0].actionTaken).toBe('EDUCATIONAL_WARNING');
  });

  it('escalates repeated violations to a temporary messaging restriction on the third offense', async () => {
    const { tenant, propertyId } = await setupLandlordTenantProperty();

    const start = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId, message: 'Hi' });
    const conversationId = start.body.conversation.id;

    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${tenant.accessToken}`)
        .send({ content: `call me at 904-555-000${i}` });
    }

    const violations = await prisma.violation.findMany({
      where: { userId: tenant.userId },
      orderBy: { createdAt: 'asc' },
    });
    expect(violations.map((v) => v.actionTaken)).toEqual([
      'EDUCATIONAL_WARNING',
      'STRONG_WARNING',
      'TEMP_RESTRICTION',
    ]);

    const restricted = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ content: 'This is a perfectly clean message' });
    expect(restricted.status).toBe(403);
  });
});
