import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockSmsProvider } from '../src/sms/providers/mock-sms.provider';
import { createTestApp, resetDatabase, resetRedis, createRelayNumber } from './utils/test-app';
import { registerUser, verifyPhone, createProperty } from './utils/flows';

describe('Moderator dashboard (e2e)', () => {
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

  async function setup() {
    const landlord = await registerUser(app, { email: 'landlord@test.com', role: 'LANDLORD', displayName: 'Acme Rentals' });
    await verifyPhone(app, mockSms, landlord.accessToken, '904-555-0100');
    const tenant = await registerUser(app, { email: 'tenant@test.com', role: 'PROSPECTIVE_TENANT', displayName: 'Jane Doe' });
    await verifyPhone(app, mockSms, tenant.accessToken, '904-555-0199');
    const moderator = await registerUser(app, { email: 'mod@test.com', role: 'PROSPECTIVE_TENANT', displayName: 'Mod' });
    await prisma.user.update({ where: { id: moderator.userId }, data: { role: 'STAFF_MODERATOR' } });
    const propertyId = await createProperty(app, landlord.accessToken);
    return { landlord, tenant, moderator, propertyId };
  }

  it('forbids a non-staff user from viewing flags', async () => {
    const { tenant } = await setup();
    const res = await request(app.getHttpServer())
      .get('/api/moderation/flags')
      .set('Authorization', `Bearer ${tenant.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('lists a flagged message, lets a moderator review it, and lift/impose restrictions', async () => {
    const { tenant, moderator, propertyId } = await setup();

    const start = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId, message: 'Hi, interested in this unit' });
    const conversationId = start.body.conversation.id;

    // The first three violations escalate through warnings to a 24h temp
    // restriction (see ModerationService.recordViolationAndEscalate), which
    // then blocks the tenant from sending anything further — including a
    // 4th offense — until staff lift it.
    for (let i = 0; i < 3; i++) {
      const res = await request(app.getHttpServer())
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${tenant.accessToken}`)
        .send({ content: `call me at 904-555-444${i}` });
      expect(res.body.delivered).toBe(false);
    }

    const whileRestricted = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ content: 'This is a perfectly clean message' });
    expect(whileRestricted.status).toBe(403);

    const restrictions = await request(app.getHttpServer())
      .get(`/api/moderation/users/${tenant.userId}/restrictions`)
      .set('Authorization', `Bearer ${moderator.accessToken}`);
    expect(restrictions.body.length).toBe(1);
    expect(restrictions.body[0].isActive).toBe(true);
    const autoRestrictionId = restrictions.body[0].id;

    const liftAuto = await request(app.getHttpServer())
      .post(`/api/moderation/restrictions/${autoRestrictionId}/lift`)
      .set('Authorization', `Bearer ${moderator.accessToken}`);
    expect(liftAuto.status).toBe(201);
    expect(liftAuto.body.isActive).toBe(false);

    // A 4th offense (violation count already at 3) now escalates straight to
    // MODERATOR_REVIEW, which is what creates a ModerationFlag for staff.
    await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ content: 'call me at 904-555-4444' });

    const flags = await request(app.getHttpServer())
      .get('/api/moderation/flags')
      .set('Authorization', `Bearer ${moderator.accessToken}`);
    expect(flags.status).toBe(200);
    expect(flags.body.length).toBe(1);
    expect(flags.body[0].flaggedUser.id).toBe(tenant.userId);
    expect(flags.body[0].message.originalContent).toContain('904-555-4444');
    const flagId = flags.body[0].id;

    const reviewed = await request(app.getHttpServer())
      .patch(`/api/moderation/flags/${flagId}/review`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ status: 'CLEARED', note: 'False positive, this was a unit number' });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.status).toBe('CLEARED');
    expect(reviewed.body.reviewedByName).toBeTruthy();

    const violations = await request(app.getHttpServer())
      .get(`/api/moderation/users/${tenant.userId}/violations`)
      .set('Authorization', `Bearer ${moderator.accessToken}`);
    expect(violations.body.length).toBe(4);

    const restrict = await request(app.getHttpServer())
      .post(`/api/moderation/users/${tenant.userId}/restrictions`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ type: 'MESSAGING_RESTRICTED', reason: 'Repeated attempts to share contact info', durationHours: 24 });
    expect(restrict.status).toBe(201);
    expect(restrict.body.isActive).toBe(true);
    const restrictionId = restrict.body.id;

    const blockedMessage = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ content: 'This is a perfectly clean message' });
    expect(blockedMessage.status).toBe(403);

    const lift = await request(app.getHttpServer())
      .post(`/api/moderation/restrictions/${restrictionId}/lift`)
      .set('Authorization', `Bearer ${moderator.accessToken}`);
    expect(lift.status).toBe(201);
    expect(lift.body.isActive).toBe(false);

    const allowedAfterLift = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ content: 'This is a perfectly clean message' });
    expect(allowedAfterLift.status).toBe(201);
    expect(allowedAfterLift.body.delivered).toBe(true);

    const addNote = await request(app.getHttpServer())
      .post(`/api/moderation/conversations/${conversationId}/notes`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ note: 'Tenant coached about the contact-info policy over the phone.' });
    expect(addNote.status).toBe(201);

    const notes = await request(app.getHttpServer())
      .get(`/api/moderation/conversations/${conversationId}/notes`)
      .set('Authorization', `Bearer ${moderator.accessToken}`);
    expect(notes.body.length).toBe(1);
    expect(notes.body[0].authorName).toBeTruthy();
  });
});
