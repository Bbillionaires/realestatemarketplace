import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockSmsProvider } from '../src/sms/providers/mock-sms.provider';
import { createTestApp, resetDatabase, resetRedis, createRelayNumber } from './utils/test-app';
import { registerUser, verifyPhone, createProperty } from './utils/flows';

describe('Rooms and beds (e2e)', () => {
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
    await createRelayNumber(prisma, '+18885551001');
  });

  afterAll(async () => {
    await app.close();
  });

  async function createUnit(token: string, propertyId: string, payload: Record<string, unknown>) {
    const res = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/units`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    return res;
  }

  it("defaults a unit's listingType to ENTIRE_PLACE when omitted, and honors PRIVATE_ROOM/SHARED_ROOM", async () => {
    const landlord = await registerUser(app, { email: 'landlord@rooms.test', role: 'LANDLORD', displayName: 'Landlord' });
    await verifyPhone(app, mockSms, landlord.accessToken, '904-555-0300');
    const propertyId = await createProperty(app, landlord.accessToken);

    const wholeHouse = await createUnit(landlord.accessToken, propertyId, { unitLabel: 'Whole house' });
    expect(wholeHouse.status).toBe(201);
    expect(wholeHouse.body.listingType).toBe('ENTIRE_PLACE');

    const privateRoom = await createUnit(landlord.accessToken, propertyId, {
      unitLabel: 'Bedroom 1',
      listingType: 'PRIVATE_ROOM',
      rentCents: 60000,
    });
    expect(privateRoom.status).toBe(201);
    expect(privateRoom.body.listingType).toBe('PRIVATE_ROOM');

    const sharedRoom = await createUnit(landlord.accessToken, propertyId, {
      unitLabel: 'Bedroom 2',
      listingType: 'SHARED_ROOM',
    });
    expect(sharedRoom.status).toBe(201);
    expect(sharedRoom.body.listingType).toBe('SHARED_ROOM');
    expect(sharedRoom.body.beds).toEqual([]);
  });

  it('forbids a different landlord from creating a unit or a bed on someone else\'s property', async () => {
    const landlordA = await registerUser(app, { email: 'landlordA@rooms.test', role: 'LANDLORD', displayName: 'Landlord A' });
    await verifyPhone(app, mockSms, landlordA.accessToken, '904-555-0301');
    const landlordB = await registerUser(app, { email: 'landlordB@rooms.test', role: 'LANDLORD', displayName: 'Landlord B' });
    const propertyId = await createProperty(app, landlordA.accessToken);

    const unitForbidden = await createUnit(landlordB.accessToken, propertyId, { unitLabel: 'Room 1', listingType: 'SHARED_ROOM' });
    expect(unitForbidden.status).toBe(403);

    const unit = await createUnit(landlordA.accessToken, propertyId, { unitLabel: 'Room 1', listingType: 'SHARED_ROOM' });

    const bedForbidden = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/units/${unit.body.id}/beds`)
      .set('Authorization', `Bearer ${landlordB.accessToken}`)
      .send({ bedLabel: 'Bed A', rentCents: 30000 });
    expect(bedForbidden.status).toBe(403);
  });

  it('creates individually-rentable beds under a shared-room unit, and rejects a bed on a unit belonging to a different property', async () => {
    const landlord = await registerUser(app, { email: 'landlord2@rooms.test', role: 'LANDLORD', displayName: 'Landlord' });
    await verifyPhone(app, mockSms, landlord.accessToken, '904-555-0302');
    const propertyId = await createProperty(app, landlord.accessToken, { addressLine1: '1 Shared St' });
    const otherPropertyId = await createProperty(app, landlord.accessToken, { addressLine1: '2 Other St' });

    const unit = await createUnit(landlord.accessToken, propertyId, { unitLabel: 'Bedroom 2', listingType: 'SHARED_ROOM' });

    const bedA = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/units/${unit.body.id}/beds`)
      .set('Authorization', `Bearer ${landlord.accessToken}`)
      .send({ bedLabel: 'Bed A', rentCents: 30000 });
    expect(bedA.status).toBe(201);
    expect(bedA.body.rentCents).toBe(30000);
    expect(bedA.body.isAvailable).toBe(true);

    const bedB = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/units/${unit.body.id}/beds`)
      .set('Authorization', `Bearer ${landlord.accessToken}`)
      .send({ bedLabel: 'Bed B', rentCents: 32500 });
    expect(bedB.status).toBe(201);

    const beds = await request(app.getHttpServer())
      .get(`/api/properties/${propertyId}/units/${unit.body.id}/beds`)
      .set('Authorization', `Bearer ${landlord.accessToken}`);
    expect(beds.status).toBe(200);
    expect(beds.body.map((b: { bedLabel: string }) => b.bedLabel)).toEqual(['Bed A', 'Bed B']);

    // The unit really does belong to `propertyId`, not `otherPropertyId` — creating a bed
    // through the wrong property in the URL must be rejected, not silently accepted.
    const wrongProperty = await request(app.getHttpServer())
      .post(`/api/properties/${otherPropertyId}/units/${unit.body.id}/beds`)
      .set('Authorization', `Bearer ${landlord.accessToken}`)
      .send({ bedLabel: 'Bed C' });
    expect(wrongProperty.status).toBe(404);

    const updated = await request(app.getHttpServer())
      .patch(`/api/properties/${propertyId}/units/${unit.body.id}/beds/${bedA.body.id}`)
      .set('Authorization', `Bearer ${landlord.accessToken}`)
      .send({ isAvailable: false });
    expect(updated.status).toBe(200);
    expect(updated.body.isAvailable).toBe(false);
  });

  it('returns beds nested under their unit in the property response', async () => {
    const landlord = await registerUser(app, { email: 'landlord3@rooms.test', role: 'LANDLORD', displayName: 'Landlord' });
    await verifyPhone(app, mockSms, landlord.accessToken, '904-555-0303');
    const propertyId = await createProperty(app, landlord.accessToken);
    const unit = await createUnit(landlord.accessToken, propertyId, { unitLabel: 'Bedroom 2', listingType: 'SHARED_ROOM' });
    await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/units/${unit.body.id}/beds`)
      .set('Authorization', `Bearer ${landlord.accessToken}`)
      .send({ bedLabel: 'Bed A', rentCents: 30000 });

    const property = await request(app.getHttpServer())
      .get(`/api/properties/${propertyId}`)
      .set('Authorization', `Bearer ${landlord.accessToken}`);
    expect(property.status).toBe(200);
    const fetchedUnit = property.body.units.find((u: { id: string }) => u.id === unit.body.id);
    expect(fetchedUnit.listingType).toBe('SHARED_ROOM');
    expect(fetchedUnit.beds).toHaveLength(1);
    expect(fetchedUnit.beds[0].bedLabel).toBe('Bed A');
  });

  it('lets a tenant start a conversation scoped to a specific bed, auto-filling the parent unit', async () => {
    const landlord = await registerUser(app, { email: 'landlord4@rooms.test', role: 'LANDLORD', displayName: 'Landlord' });
    await verifyPhone(app, mockSms, landlord.accessToken, '904-555-0304');
    const tenant = await registerUser(app, { email: 'tenant4@rooms.test', role: 'PROSPECTIVE_TENANT', displayName: 'Tenant' });
    const propertyId = await createProperty(app, landlord.accessToken);
    const unit = await createUnit(landlord.accessToken, propertyId, { unitLabel: 'Bedroom 2', listingType: 'SHARED_ROOM' });
    const bed = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/units/${unit.body.id}/beds`)
      .set('Authorization', `Bearer ${landlord.accessToken}`)
      .send({ bedLabel: 'Bed A', rentCents: 30000 });

    const started = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId, bedId: bed.body.id, message: 'Is Bed A still available?' });
    expect(started.status).toBe(201);
    expect(started.body.conversation.unitId).toBe(unit.body.id);
    expect(started.body.conversation.unitLabel).toBe('Bedroom 2');
    expect(started.body.conversation.bedId).toBe(bed.body.id);
    expect(started.body.conversation.bedLabel).toBe('Bed A');
  });

  it("rejects a bedId that doesn't belong to the given unitId, and a bedId belonging to a different property", async () => {
    const landlord = await registerUser(app, { email: 'landlord5@rooms.test', role: 'LANDLORD', displayName: 'Landlord' });
    await verifyPhone(app, mockSms, landlord.accessToken, '904-555-0305');
    const tenant = await registerUser(app, { email: 'tenant5@rooms.test', role: 'PROSPECTIVE_TENANT', displayName: 'Tenant' });
    const propertyId = await createProperty(app, landlord.accessToken, { addressLine1: '1 Rooms St' });
    const otherPropertyId = await createProperty(app, landlord.accessToken, { addressLine1: '2 Rooms St' });

    const unitA = await createUnit(landlord.accessToken, propertyId, { unitLabel: 'Bedroom 2', listingType: 'SHARED_ROOM' });
    const unitB = await createUnit(landlord.accessToken, propertyId, { unitLabel: 'Bedroom 3', listingType: 'SHARED_ROOM' });
    const otherUnit = await createUnit(landlord.accessToken, otherPropertyId, { unitLabel: 'Bedroom 1', listingType: 'SHARED_ROOM' });

    const bedInUnitA = await request(app.getHttpServer())
      .post(`/api/properties/${propertyId}/units/${unitA.body.id}/beds`)
      .set('Authorization', `Bearer ${landlord.accessToken}`)
      .send({ bedLabel: 'Bed A' });
    const bedInOtherProperty = await request(app.getHttpServer())
      .post(`/api/properties/${otherPropertyId}/units/${otherUnit.body.id}/beds`)
      .set('Authorization', `Bearer ${landlord.accessToken}`)
      .send({ bedLabel: 'Bed X' });

    const mismatchedUnit = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId, unitId: unitB.body.id, bedId: bedInUnitA.body.id, message: 'Hi' });
    expect(mismatchedUnit.status).toBe(400);

    const wrongProperty = await request(app.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ propertyId, bedId: bedInOtherProperty.body.id, message: 'Hi' });
    expect(wrongProperty.status).toBe(400);
  });
});
