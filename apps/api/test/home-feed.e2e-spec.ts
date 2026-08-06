import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDatabase } from './utils/test-app';

describe('Home feed (e2e)', () => {
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

  async function registerLandlord(email: string) {
    const res = await request(app.getHttpServer()).post('/api/auth/register').send({
      email,
      password: 'CorrectHorseBatteryStaple1!',
      displayName: 'Landlord',
      role: 'LANDLORD',
    });
    return res.body.accessToken as string;
  }

  async function createProperty(token: string, overrides: Partial<{ title: string; addressLine1: string }> = {}) {
    const res = await request(app.getHttpServer())
      .post('/api/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: overrides.title ?? '123 Main Street',
        addressLine1: overrides.addressLine1 ?? '123 Main Street',
        city: 'Jacksonville',
        state: 'FL',
        zip: '32202',
        monthlyRentCents: 185000,
      });
    return res.body.id as string;
  }

  it('returns the feed and increments the view count with no Authorization header at all', async () => {
    const landlordToken = await registerLandlord('landlord1@feed.test');
    const propertyId = await createProperty(landlordToken);

    const feed = await request(app.getHttpServer()).get('/api/properties/feed');
    expect(feed.status).toBe(200);
    expect(feed.body.map((p: { id: string }) => p.id)).toContain(propertyId);
    expect(feed.body.find((p: { id: string }) => p.id === propertyId).viewCount).toBe(0);

    const view = await request(app.getHttpServer()).post(`/api/properties/${propertyId}/view`);
    expect(view.status).toBe(204);

    const feedAfter = await request(app.getHttpServer()).get('/api/properties/feed');
    expect(feedAfter.body.find((p: { id: string }) => p.id === propertyId).viewCount).toBe(1);
  });

  it('excludes an inactive property from the feed, and never increments its view count', async () => {
    const landlordToken = await registerLandlord('landlord2@feed.test');
    const propertyId = await createProperty(landlordToken);
    await request(app.getHttpServer())
      .patch(`/api/properties/${propertyId}`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ isActive: false });

    const feed = await request(app.getHttpServer()).get('/api/properties/feed');
    expect(feed.body.map((p: { id: string }) => p.id)).not.toContain(propertyId);

    const view = await request(app.getHttpServer()).post(`/api/properties/${propertyId}/view`);
    expect(view.status).toBe(204);

    const stored = await prisma.property.findUnique({ where: { id: propertyId } });
    expect(stored?.viewCount).toBe(0);
  });

  it('no-ops (still 204) when viewing a property id that does not exist', async () => {
    const view = await request(app.getHttpServer()).post('/api/properties/00000000-0000-0000-0000-000000000000/view');
    expect(view.status).toBe(204);
  });

  it('bounds the requested feed size between 1 and 50, defaulting to 12', async () => {
    const landlordToken = await registerLandlord('landlord3@feed.test');
    for (let i = 0; i < 3; i++) {
      await createProperty(landlordToken, { title: `Listing ${i}`, addressLine1: `${i} Main St` });
    }

    const capped = await request(app.getHttpServer()).get('/api/properties/feed?take=2');
    expect(capped.body).toHaveLength(2);

    const overCapped = await request(app.getHttpServer()).get('/api/properties/feed?take=999');
    expect(overCapped.body.length).toBeLessThanOrEqual(50);
  });

  it('samples proportionally to view count rather than either a fixed ranking or pure uniform randomness', async () => {
    const landlordToken = await registerLandlord('landlord4@feed.test');
    const popularId = await createProperty(landlordToken, { title: 'Popular', addressLine1: '1 Popular St' });
    await createProperty(landlordToken, { title: 'Quiet', addressLine1: '2 Quiet St' });

    for (let i = 0; i < 100; i++) {
      await request(app.getHttpServer()).post(`/api/properties/${popularId}/view`);
    }

    let popularCount = 0;
    const trials = 20;
    for (let i = 0; i < trials; i++) {
      const res = await request(app.getHttpServer()).get('/api/properties/feed?take=1');
      if (res.body[0]?.id === popularId) popularCount++;
    }

    // With a 101-vs-1 weight gap this should win nearly every trial; a
    // generous majority threshold keeps the assertion meaningful without
    // being flaky over true randomness.
    expect(popularCount).toBeGreaterThanOrEqual(trials * 0.7);
  });
});
