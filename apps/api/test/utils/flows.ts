import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MockSmsProvider } from '../../src/sms/providers/mock-sms.provider';

export async function registerUser(
  app: INestApplication,
  params: { email: string; role: string; displayName?: string },
): Promise<{ accessToken: string; userId: string }> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({
      email: params.email,
      password: 'CorrectHorseBatteryStaple1!',
      displayName: params.displayName ?? params.email,
      role: params.role,
    });
  const accessToken = res.body.accessToken as string;
  const me = await request(app.getHttpServer()).get('/api/users/me').set('Authorization', `Bearer ${accessToken}`);
  return { accessToken, userId: me.body.id as string };
}

/** Runs a user through phone start/confirm verification using the mock SMS provider to read the OTP. */
export async function verifyPhone(
  app: INestApplication,
  mockSms: MockSmsProvider,
  accessToken: string,
  phoneNumber: string,
): Promise<void> {
  await request(app.getHttpServer())
    .post('/api/phone/start-verification')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ phoneNumber });

  const e164 = phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber.replace(/\D/g, '')}`;
  const sent = mockSms.getLastMessageTo(e164);
  const code = sent!.body.match(/\d{6}/)![0];

  await request(app.getHttpServer())
    .post('/api/phone/confirm-verification')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ phoneNumber, code });
}

export async function createProperty(
  app: INestApplication,
  landlordToken: string,
  overrides: Partial<{
    title: string;
    addressLine1: string;
    city: string;
    state: string;
    zip: string;
    monthlyRentCents: number;
  }> = {},
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/properties')
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({
      title: overrides.title ?? '123 Main Street',
      addressLine1: overrides.addressLine1 ?? '123 Main Street',
      city: overrides.city ?? 'Jacksonville',
      state: overrides.state ?? 'FL',
      zip: overrides.zip ?? '32202',
      monthlyRentCents: overrides.monthlyRentCents ?? 185000,
    });
  return res.body.id as string;
}
