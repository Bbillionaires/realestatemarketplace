import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDatabase } from './utils/test-app';

describe('Voucher Value Matcher (e2e)', () => {
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

  async function registerUser(role: string, email: string) {
    const res = await request(app.getHttpServer()).post('/api/auth/register').send({
      email,
      password: 'CorrectHorseBatteryStaple1!',
      displayName: `${role} user`,
      role,
    });
    return res.body.accessToken as string;
  }

  it('requires no authentication (matches the home feed\'s public-search rule)', async () => {
    const res = await request(app.getHttpServer()).get('/api/properties/voucher-matcher?zip=32209&bedrooms=3');
    expect(res.status).toBe(200);
  });

  it('returns the seeded HUD payment standard for a covered zip and bedroom count', async () => {
    const res = await request(app.getHttpServer()).get('/api/properties/voucher-matcher?zip=32209&bedrooms=3');
    expect(res.status).toBe(200);
    expect(res.body.covered).toBe(true);
    expect(res.body.paymentStandardCents).toBe(148000);
    expect(res.body.metroArea).toBe('Jacksonville, FL HUD Metro FMR Area');
    expect(res.body.matches).toEqual([]);
  });

  it('reports covered:false and a null standard for a zip with no published data, rather than guessing', async () => {
    const res = await request(app.getHttpServer()).get('/api/properties/voucher-matcher?zip=32099&bedrooms=3');
    expect(res.status).toBe(200);
    expect(res.body.covered).toBe(false);
    expect(res.body.paymentStandardCents).toBeNull();
    expect(res.body.matches).toEqual([]);
  });

  it('rejects a bedroom count outside 0-4 and a missing zip', async () => {
    const tooHigh = await request(app.getHttpServer()).get('/api/properties/voucher-matcher?zip=32209&bedrooms=5');
    expect(tooHigh.status).toBe(400);

    const missingZip = await request(app.getHttpServer()).get('/api/properties/voucher-matcher?bedrooms=3');
    expect(missingZip.status).toBe(400);
  });

  it('matches only active, Section-8-accepting properties in that exact zip priced at or below the standard', async () => {
    const landlordToken = await registerUser('LANDLORD', 'landlord-voucher-match@example.com');
    const base = { addressLine1: '1 Voucher Way', city: 'Jacksonville', state: 'FL', zip: '32209' };

    // Section8 + at the standard exactly ($1,480 for 3-bed/32209) -> matches.
    await request(app.getHttpServer())
      .post('/api/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ ...base, title: 'At Standard', monthlyRentCents: 148000, acceptsSection8Vouchers: true });

    // Section8 + under the standard -> matches.
    await request(app.getHttpServer())
      .post('/api/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ ...base, title: 'Under Standard', monthlyRentCents: 100000, acceptsSection8Vouchers: true });

    // Section8 + over the standard -> excluded.
    await request(app.getHttpServer())
      .post('/api/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ ...base, title: 'Over Standard', monthlyRentCents: 200000, acceptsSection8Vouchers: true });

    // Under the standard but does NOT accept vouchers -> excluded, a voucher
    // holder can't actually use their voucher there.
    await request(app.getHttpServer())
      .post('/api/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ ...base, title: 'No Voucher', monthlyRentCents: 90000, acceptsSection8Vouchers: false });

    // Section8 + under the standard, but a different zip -> excluded.
    await request(app.getHttpServer())
      .post('/api/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ ...base, zip: '32210', title: 'Wrong Zip', monthlyRentCents: 90000, acceptsSection8Vouchers: true });

    const res = await request(app.getHttpServer()).get('/api/properties/voucher-matcher?zip=32209&bedrooms=3');
    expect(res.status).toBe(200);
    const titles = res.body.matches.map((p: { title: string }) => p.title).sort();
    expect(titles).toEqual(['At Standard', 'Under Standard']);
  });

  it('matches by rent alone, not by the unit\'s own bedroom count (a voucher holder may rent under their allowance)', async () => {
    const landlordToken = await registerUser('LANDLORD', 'landlord-voucher-bedrooms@example.com');
    const created = await request(app.getHttpServer())
      .post('/api/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({
        title: 'Studio Under 3-Bed Standard',
        addressLine1: '2 Voucher Way',
        city: 'Jacksonville',
        state: 'FL',
        zip: '32209',
        acceptsSection8Vouchers: true,
      });
    await request(app.getHttpServer())
      .post(`/api/properties/${created.body.id}/units`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ unitLabel: 'Studio', bedrooms: 0, rentCents: 90000 });

    const res = await request(app.getHttpServer()).get('/api/properties/voucher-matcher?zip=32209&bedrooms=3');
    expect(res.status).toBe(200);
    expect(res.body.matches.some((p: { title: string }) => p.title === 'Studio Under 3-Bed Standard')).toBe(true);
  });
});
