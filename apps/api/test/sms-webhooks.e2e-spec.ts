import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockSmsProvider } from '../src/sms/providers/mock-sms.provider';
import { createTestApp, resetDatabase, resetRedis, createRelayNumber } from './utils/test-app';
import { registerUser, verifyPhone, createProperty } from './utils/flows';

describe('SMS webhooks (e2e)', () => {
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
  });

  afterAll(async () => {
    await app.close();
  });

  async function setup() {
    await createRelayNumber(prisma, '+18885552000');
    const landlord = await registerUser(app, { email: 'landlord@webhook.test', role: 'LANDLORD' });
    await verifyPhone(app, mockSms, landlord.accessToken, '904-555-0200');
    const tenant = await registerUser(app, { email: 'tenant@webhook.test', role: 'PROSPECTIVE_TENANT' });
    await verifyPhone(app, mockSms, tenant.accessToken, '904-555-0299');
    return { landlord, tenant };
  }

  it('routes an inbound SMS reply to the correct conversation and delivers it in-app', async () => {
    const { landlord, tenant } = await setup();
    const propertyId = await createProperty(app, landlord.accessToken);

    const start = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId, message: 'Is this available?' });
    const conversationId = start.body.conversation.id;
    const relayNumber = start.body.conversation.relayPhoneNumber;

    const inbound = await request(app.getHttpServer()).post('/api/sms/webhooks/inbound').send({
      From: '+19045550200',
      To: relayNumber,
      Body: 'Yes, still available!',
      MessageSid: 'SM_TEST_001',
    });
    expect(inbound.status).toBe(200);
    expect(inbound.body.status).toBe('processed');

    const messages = await request(app.getHttpServer())
      .get(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${tenant.accessToken}`);
    expect(messages.body.some((m: { content: string }) => m.content === 'Yes, still available!')).toBe(true);
  });

  it('is idempotent: replaying the same webhook (same MessageSid) never creates a duplicate message', async () => {
    const { landlord, tenant } = await setup();
    const propertyId = await createProperty(app, landlord.accessToken);

    const start = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId, message: 'Is this available?' });
    const relayNumber = start.body.conversation.relayPhoneNumber;

    const payload = { From: '+19045550200', To: relayNumber, Body: 'Duplicate test', MessageSid: 'SM_DUPLICATE' };
    await request(app.getHttpServer()).post('/api/sms/webhooks/inbound').send(payload);
    await request(app.getHttpServer()).post('/api/sms/webhooks/inbound').send(payload);
    await request(app.getHttpServer()).post('/api/sms/webhooks/inbound').send(payload);

    const matching = await prisma.message.findMany({ where: { providerMessageId: 'SM_DUPLICATE' } });
    expect(matching.length).toBe(1);
  });

  it('sends a numbered disambiguation menu when the same phone/relay pair matches multiple conversations, then routes on reply', async () => {
    const { landlord, tenant } = await setup();
    const propertyA = await createProperty(app, landlord.accessToken, { title: 'Property A', addressLine1: '1 A St' });
    const propertyB = await createProperty(app, landlord.accessToken, { title: 'Property B', addressLine1: '2 B St' });

    const startA = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId: propertyA, message: 'About property A' });
    const startB = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId: propertyB, message: 'About property B' });

    // With only one relay number provisioned, both conversations share it —
    // this is the exact ambiguous-routing scenario from the spec.
    expect(startA.body.conversation.relayPhoneNumber).toBe(startB.body.conversation.relayPhoneNumber);
    const relayNumber = startA.body.conversation.relayPhoneNumber;

    mockSms.clear();
    const ambiguous = await request(app.getHttpServer()).post('/api/sms/webhooks/inbound').send({
      From: '+19045550299',
      To: relayNumber,
      Body: 'Any update?',
      MessageSid: 'SM_AMBIGUOUS_1',
    });
    expect(ambiguous.body.status).toBe('menu_sent');

    const menuText = mockSms.getLastMessageTo('+19045550299');
    expect(menuText!.body).toContain('Property A');
    expect(menuText!.body).toContain('Property B');

    const reply = await request(app.getHttpServer()).post('/api/sms/webhooks/inbound').send({
      From: '+19045550299',
      To: relayNumber,
      Body: '1',
      MessageSid: 'SM_MENU_REPLY',
    });
    expect(reply.body.status).toBe('processed');

    // The menu is ordered most-recently-active-first, so "1" isn't
    // necessarily property A — what matters is that the original message
    // ("Any update?", not the "1" routing reply) landed in exactly one of
    // the two candidate conversations, never both and never neither.
    const messagesA = await request(app.getHttpServer())
      .get(`/api/conversations/${startA.body.conversation.id}/messages`)
      .set('Authorization', `Bearer ${tenant.accessToken}`);
    const messagesB = await request(app.getHttpServer())
      .get(`/api/conversations/${startB.body.conversation.id}/messages`)
      .set('Authorization', `Bearer ${tenant.accessToken}`);

    const hasIn = (list: { content: string }[]) => list.some((m) => m.content === 'Any update?');
    expect(hasIn(messagesA.body)).not.toBe(hasIn(messagesB.body));
    expect([...messagesA.body, ...messagesB.body].some((m: { content: string }) => m.content === '1')).toBe(false);
  });

  it('updates message status from a delivery-status webhook', async () => {
    const { landlord, tenant } = await setup();
    const propertyId = await createProperty(app, landlord.accessToken);

    const start = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId, message: 'Is this available?' });

    const sentMessage = await prisma.message.findFirstOrThrow({
      where: { conversationId: start.body.conversation.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(sentMessage.providerMessageId).toBeTruthy();

    const statusRes = await request(app.getHttpServer()).post('/api/sms/webhooks/delivery-status').send({
      MessageSid: sentMessage.providerMessageId,
      MessageStatus: 'delivered',
    });
    expect(statusRes.status).toBe(200);

    const updated = await prisma.message.findUniqueOrThrow({ where: { id: sentMessage.id } });
    expect(updated.status).toBe('DELIVERED');
    expect(updated.deliveredAt).not.toBeNull();
  });
});
