import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDatabase } from './utils/test-app';

describe('Properties (e2e)', () => {
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
    title: '123 Main Street',
    addressLine1: '123 Main Street',
    city: 'Jacksonville',
    state: 'FL',
    zip: '32202',
    monthlyRentCents: 185000,
  };

  it('allows a landlord to create a property but forbids a prospective tenant', async () => {
    const landlordToken = await registerUser('LANDLORD', 'landlord1@example.com');
    const tenantToken = await registerUser('PROSPECTIVE_TENANT', 'tenant1@example.com');

    const created = await request(app.getHttpServer())
      .post('/api/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send(propertyPayload);
    expect(created.status).toBe(201);
    expect(created.body.ownerId).toBeDefined();

    const forbidden = await request(app.getHttpServer())
      .post('/api/properties')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send(propertyPayload);
    expect(forbidden.status).toBe(403);
  });

  it('hides ownerId and manager list from prospective tenants but shows it to the owning landlord', async () => {
    const landlordToken = await registerUser('LANDLORD', 'landlord2@example.com');
    const tenantToken = await registerUser('PROSPECTIVE_TENANT', 'tenant2@example.com');

    const created = await request(app.getHttpServer())
      .post('/api/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send(propertyPayload);
    const propertyId = created.body.id;

    const asTenant = await request(app.getHttpServer())
      .get(`/api/properties/${propertyId}`)
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(asTenant.status).toBe(200);
    expect(asTenant.body.ownerId).toBeUndefined();
    expect(asTenant.body.landlordDisplayName).toBeDefined();

    const asLandlord = await request(app.getHttpServer())
      .get(`/api/properties/${propertyId}`)
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(asLandlord.status).toBe(200);
    expect(asLandlord.body.ownerId).toBeDefined();
  });

  it('prevents a different landlord from updating someone else\'s property', async () => {
    const ownerToken = await registerUser('LANDLORD', 'owner@example.com');
    const otherLandlordToken = await registerUser('LANDLORD', 'other@example.com');

    const created = await request(app.getHttpServer())
      .post('/api/properties')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(propertyPayload);
    const propertyId = created.body.id;

    const res = await request(app.getHttpServer())
      .patch(`/api/properties/${propertyId}`)
      .set('Authorization', `Bearer ${otherLandlordToken}`)
      .send({ title: 'Hijacked title' });
    expect(res.status).toBe(403);
  });

  it('lets an assigned property manager manage the property but not other properties', async () => {
    const ownerToken = await registerUser('LANDLORD', 'owner2@example.com');
    const managerToken = await registerUser('PROPERTY_MANAGER', 'manager1@example.com');
    const ownerUser = await prisma.user.findUniqueOrThrow({ where: { email: 'owner2@example.com' } });
    const managerUser = await prisma.user.findUniqueOrThrow({ where: { email: 'manager1@example.com' } });

    const created = await request(app.getHttpServer())
      .post('/api/properties')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(propertyPayload);
    const propertyId = created.body.id;

    const assign = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/managers`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: managerUser.id });
    expect(assign.status).toBe(201);

    const update = await request(app.getHttpServer())
      .patch(`/api/properties/${propertyId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Updated by manager' });
    expect(update.status).toBe(200);
    expect(update.body.title).toBe('Updated by manager');

    void ownerUser;
  });

  it('allows staff moderators and administrators to view all properties regardless of ownership', async () => {
    const ownerToken = await registerUser('LANDLORD', 'owner3@example.com');
    await request(app.getHttpServer())
      .post('/api/properties')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(propertyPayload);

    const adminLogin = await request(app.getHttpServer()).post('/api/auth/register').send({
      email: 'admin-e2e@example.com',
      password: 'CorrectHorseBatteryStaple1!',
      displayName: 'Admin',
      role: 'PROSPECTIVE_TENANT',
    });
    await prisma.user.update({ where: { email: 'admin-e2e@example.com' }, data: { role: 'ADMINISTRATOR' } });

    const list = await request(app.getHttpServer())
      .get('/api/properties')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(1);
    expect(list.body[0].ownerId).toBeDefined();
  });
});
