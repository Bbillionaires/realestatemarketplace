import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDatabase } from './utils/test-app';

describe('Nearby schools (e2e)', () => {
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

  const propertyPayload = {
    title: 'Schools Test Property',
    addressLine1: '1 School St',
    city: 'Jacksonville',
    state: 'FL',
    zip: '32202',
    monthlyRentCents: 150000,
  };

  it('populates nearby schools automatically when a property is created', async () => {
    const landlordToken = await registerUser('LANDLORD', 'landlord-schools@example.com');
    const created = await request(app.getHttpServer())
      .post('/api/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send(propertyPayload);
    expect(created.status).toBe(201);

    const schools = await request(app.getHttpServer())
      .get(`/api/properties/${created.body.id}/schools`)
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(schools.status).toBe(200);
    expect(schools.body.length).toBe(3);
    expect(schools.body.map((s: { level: string }) => s.level).sort()).toEqual(['ELEMENTARY', 'HIGH', 'MIDDLE']);
    // Ordered nearest-first.
    expect(schools.body[0].distanceMiles).toBeLessThanOrEqual(schools.body[1].distanceMiles);
  });

  it('is readable by anyone authenticated, not just the owner', async () => {
    const landlordToken = await registerUser('LANDLORD', 'landlord-schools-2@example.com');
    const created = await request(app.getHttpServer())
      .post('/api/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send(propertyPayload);

    const tenantToken = await registerUser('PROSPECTIVE_TENANT', 'tenant-schools@example.com');
    const res = await request(app.getHttpServer())
      .get(`/api/properties/${created.body.id}/schools`)
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
  });

  it('lets the owner force a refresh, but forbids an unrelated landlord', async () => {
    const landlordToken = await registerUser('LANDLORD', 'landlord-schools-3@example.com');
    const created = await request(app.getHttpServer())
      .post('/api/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send(propertyPayload);

    const refreshed = await request(app.getHttpServer())
      .post(`/api/properties/${created.body.id}/schools/refresh`)
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(refreshed.status).toBe(201);
    expect(refreshed.body.length).toBe(3);

    const otherLandlordToken = await registerUser('LANDLORD', 'other-landlord-schools@example.com');
    const forbidden = await request(app.getHttpServer())
      .post(`/api/properties/${created.body.id}/schools/refresh`)
      .set('Authorization', `Bearer ${otherLandlordToken}`);
    expect(forbidden.status).toBe(403);
  });

  it('re-refreshes nearby schools when the address changes via PATCH', async () => {
    const landlordToken = await registerUser('LANDLORD', 'landlord-schools-4@example.com');
    const created = await request(app.getHttpServer())
      .post('/api/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send(propertyPayload);

    const before = await prisma.property.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(before.latitude).not.toBeNull();
    expect(before.schoolsFetchedAt).not.toBeNull();

    const updated = await request(app.getHttpServer())
      .patch(`/api/properties/${created.body.id}`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ addressLine1: '2 New Address Ave' });
    expect(updated.status).toBe(200);

    const after = await prisma.property.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(after.schoolsFetchedAt!.getTime()).toBeGreaterThanOrEqual(before.schoolsFetchedAt!.getTime());

    const schools = await request(app.getHttpServer())
      .get(`/api/properties/${created.body.id}/schools`)
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(schools.body.length).toBe(3);
  });

  it('does not refresh schools on an update that leaves the address untouched', async () => {
    const landlordToken = await registerUser('LANDLORD', 'landlord-schools-5@example.com');
    const created = await request(app.getHttpServer())
      .post('/api/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send(propertyPayload);
    const before = await prisma.property.findUniqueOrThrow({ where: { id: created.body.id } });

    await request(app.getHttpServer())
      .patch(`/api/properties/${created.body.id}`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ monthlyRentCents: 160000 });

    const after = await prisma.property.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(after.schoolsFetchedAt!.getTime()).toBe(before.schoolsFetchedAt!.getTime());
  });
});
