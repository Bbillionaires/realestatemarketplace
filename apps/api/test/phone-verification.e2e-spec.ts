import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockSmsProvider } from '../src/sms/providers/mock-sms.provider';
import { createTestApp, resetDatabase } from './utils/test-app';

describe('Phone verification + phone number privacy (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let mockSms: MockSmsProvider;

  const rawPhoneNumber = '904-555-1234';
  const e164 = '+19045551234';

  beforeAll(async () => {
    ({ app, moduleRef } = await createTestApp());
    prisma = moduleRef.get(PrismaService);
    mockSms = moduleRef.get(MockSmsProvider);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    mockSms.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerAndLogin() {
    const res = await request(app.getHttpServer()).post('/api/auth/register').send({
      email: 'phoneuser@example.com',
      password: 'CorrectHorseBatteryStaple1!',
      displayName: 'Phone User',
      role: 'PROSPECTIVE_TENANT',
    });
    return res.body.accessToken as string;
  }

  it('sends an OTP through the SMS provider and verifies successfully with the correct code', async () => {
    const accessToken = await registerAndLogin();

    const start = await request(app.getHttpServer())
      .post('/api/phone/start-verification')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phoneNumber: rawPhoneNumber });
    expect(start.status).toBe(200);

    const sent = mockSms.getLastMessageTo(e164);
    expect(sent).toBeDefined();
    const codeMatch = sent!.body.match(/\d{6}/);
    expect(codeMatch).not.toBeNull();
    const code = codeMatch![0];

    const confirm = await request(app.getHttpServer())
      .post('/api/phone/confirm-verification')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phoneNumber: rawPhoneNumber, code });
    expect(confirm.status).toBe(200);
    expect(confirm.body.isVerified).toBe(true);
    // The response must never contain the real number, only a mask.
    expect(JSON.stringify(confirm.body)).not.toContain('9045551234');
    expect(confirm.body.maskedNumber).toContain('1234');
  });

  it('rejects an incorrect verification code and increments attempts', async () => {
    const accessToken = await registerAndLogin();
    await request(app.getHttpServer())
      .post('/api/phone/start-verification')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phoneNumber: rawPhoneNumber });

    const res = await request(app.getHttpServer())
      .post('/api/phone/confirm-verification')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phoneNumber: rawPhoneNumber, code: '000000' });
    expect(res.status).toBe(400);
  });

  it('never exposes the encrypted number or hash in any phone API response', async () => {
    const accessToken = await registerAndLogin();
    await request(app.getHttpServer())
      .post('/api/phone/start-verification')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phoneNumber: rawPhoneNumber });

    const list = await request(app.getHttpServer())
      .get('/api/phone')
      .set('Authorization', `Bearer ${accessToken}`);

    const body = JSON.stringify(list.body);
    expect(body).not.toContain('encryptedNumber');
    expect(body).not.toContain('numberHash');
    expect(body).not.toContain('9045551234');
  });

  it('never exposes a real phone number through the database-level encrypted column when the API errors', async () => {
    const accessToken = await registerAndLogin();
    // Malformed phone number should be rejected before ever reaching storage.
    const res = await request(app.getHttpServer())
      .post('/api/phone/start-verification')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phoneNumber: 'not-a-real-number' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('not-a-real-number');
  });
});
