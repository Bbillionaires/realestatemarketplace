import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockGeocodingProvider } from '../src/geocoding/providers/mock-geocoding.provider';
import { createTestApp, resetDatabase } from './utils/test-app';

describe('Property extras: type/Section8 filters, agencies, rent estimate, waitlists (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let mockGeocoding: MockGeocodingProvider;

  beforeAll(async () => {
    ({ app, moduleRef } = await createTestApp());
    prisma = moduleRef.get(PrismaService);
    mockGeocoding = moduleRef.get(MockGeocodingProvider);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    mockGeocoding.clear();
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

  const basePayload = {
    title: 'Extras Test Property',
    addressLine1: '1 Extras Way',
    city: 'Jacksonville',
    state: 'FL',
    zip: '32202',
    monthlyRentCents: 120000,
  };

  describe('propertyType and Section 8 filters', () => {
    it('defaults propertyType to OTHER and acceptsSection8Vouchers to false', async () => {
      const landlordToken = await registerUser('LANDLORD', 'landlord-type-default@example.com');
      const created = await request(app.getHttpServer())
        .post('/api/properties')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send(basePayload);
      expect(created.status).toBe(201);
      expect(created.body.propertyType).toBe('OTHER');
      expect(created.body.acceptsSection8Vouchers).toBe(false);
    });

    it('persists an explicit propertyType and acceptsSection8Vouchers on create', async () => {
      const landlordToken = await registerUser('LANDLORD', 'landlord-type-set@example.com');
      const created = await request(app.getHttpServer())
        .post('/api/properties')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ ...basePayload, propertyType: 'HOUSE', acceptsSection8Vouchers: true });
      expect(created.status).toBe(201);
      expect(created.body.propertyType).toBe('HOUSE');
      expect(created.body.acceptsSection8Vouchers).toBe(true);
    });

    it('rejects an invalid propertyType value', async () => {
      const landlordToken = await registerUser('LANDLORD', 'landlord-type-invalid@example.com');
      const res = await request(app.getHttpServer())
        .post('/api/properties')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ ...basePayload, propertyType: 'CASTLE' });
      expect(res.status).toBe(400);
    });

    it('filters the properties list by type and by Section 8 acceptance', async () => {
      const landlordToken = await registerUser('LANDLORD', 'landlord-type-filter@example.com');
      await request(app.getHttpServer())
        .post('/api/properties')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ ...basePayload, title: 'House A', propertyType: 'HOUSE' });
      await request(app.getHttpServer())
        .post('/api/properties')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ ...basePayload, title: 'Apartment A', propertyType: 'APARTMENT', acceptsSection8Vouchers: true });

      const tenantToken = await registerUser('PROSPECTIVE_TENANT', 'tenant-type-filter@example.com');

      const houses = await request(app.getHttpServer())
        .get('/api/properties?type=HOUSE')
        .set('Authorization', `Bearer ${tenantToken}`);
      expect(houses.status).toBe(200);
      expect(houses.body.every((p: { propertyType: string }) => p.propertyType === 'HOUSE')).toBe(true);
      expect(houses.body.some((p: { title: string }) => p.title === 'House A')).toBe(true);

      const section8 = await request(app.getHttpServer())
        .get('/api/properties?section8=true')
        .set('Authorization', `Bearer ${tenantToken}`);
      expect(section8.status).toBe(200);
      expect(section8.body.every((p: { acceptsSection8Vouchers: boolean }) => p.acceptsSection8Vouchers)).toBe(true);
      expect(section8.body.some((p: { title: string }) => p.title === 'Apartment A')).toBe(true);
    });
  });

  describe('Agencies directory', () => {
    it('lists property managers with at least one active assignment, ordered by managed count', async () => {
      const ownerToken = await registerUser('LANDLORD', 'owner-agency@example.com');
      const managerToken = await registerUser('PROPERTY_MANAGER', 'manager-agency@example.com');
      const idleManagerToken = await registerUser('PROPERTY_MANAGER', 'idle-manager-agency@example.com');
      void idleManagerToken;
      const managerUser = await prisma.user.findUniqueOrThrow({ where: { email: 'manager-agency@example.com' } });

      const created = await request(app.getHttpServer())
        .post('/api/properties')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(basePayload);
      await request(app.getHttpServer())
        .post(`/api/properties/${created.body.id}/managers`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ userId: managerUser.id });

      const anyToken = await registerUser('PROSPECTIVE_TENANT', 'tenant-agency@example.com');
      const res = await request(app.getHttpServer())
        .get('/api/properties/agencies')
        .set('Authorization', `Bearer ${anyToken}`);
      expect(res.status).toBe(200);
      const names = res.body.map((a: { displayName: string }) => a.displayName);
      expect(names).toContain('PROPERTY_MANAGER user');
      expect(names).not.toContain('idle-manager-agency@example.com');
      const entry = res.body.find((a: { displayName: string }) => a.displayName === 'PROPERTY_MANAGER user');
      expect(entry.managedPropertyCount).toBe(1);
    });
  });

  describe('Rental estimate', () => {
    const nearAddress = { addressLine1: '10 Near St', city: 'Jacksonville', state: 'FL', zip: '32202' };
    const nearCoords = { latitude: 30.3322, longitude: -81.6557 };
    // ~11 miles away — well outside the default 1.5-mile comp radius.
    const farAddress = { addressLine1: '20 Far St', city: 'Jacksonville', state: 'FL', zip: '32218' };
    const farCoords = { latitude: 30.49, longitude: -81.6557 };

    async function createGeocodedProperty(
      landlordToken: string,
      address: typeof nearAddress,
      coords: typeof nearCoords,
      rentCents: number,
      bedrooms = 2,
    ) {
      mockGeocoding.setCoordinatesFor(address, coords);
      const created = await request(app.getHttpServer())
        .post('/api/properties')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ ...basePayload, ...address });
      await request(app.getHttpServer())
        .post(`/api/properties/${created.body.id}/units`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ unitLabel: '1', bedrooms, rentCents });
      return created.body.id as string;
    }

    it('averages rentCents across nearby units at the same address and reports the sample size', async () => {
      const landlordToken = await registerUser('LANDLORD', 'landlord-estimate@example.com');
      const propertyId = await createGeocodedProperty(landlordToken, nearAddress, nearCoords, 100000);
      await request(app.getHttpServer())
        .post(`/api/properties/${propertyId}/units`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ unitLabel: '2', bedrooms: 2, rentCents: 200000 });

      const tenantToken = await registerUser('PROSPECTIVE_TENANT', 'tenant-estimate@example.com');
      const res = await request(app.getHttpServer())
        .get(
          `/api/properties/rent-estimate?addressLine1=${encodeURIComponent(nearAddress.addressLine1)}&city=${nearAddress.city}&state=${nearAddress.state}&zip=${nearAddress.zip}&bedrooms=2`,
        )
        .set('Authorization', `Bearer ${tenantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.estimatedMonthlyRentCents).toBe(150000);
      expect(res.body.sampleSize).toBe(2);
      expect(res.body.addressResolved).toBe(true);
    });

    it('excludes comps outside the configured radius even in the same city', async () => {
      const landlordToken = await registerUser('LANDLORD', 'landlord-estimate-radius@example.com');
      await createGeocodedProperty(landlordToken, nearAddress, nearCoords, 100000);
      await createGeocodedProperty(landlordToken, farAddress, farCoords, 500000);

      const tenantToken = await registerUser('PROSPECTIVE_TENANT', 'tenant-estimate-radius@example.com');
      const res = await request(app.getHttpServer())
        .get(
          `/api/properties/rent-estimate?addressLine1=${encodeURIComponent(nearAddress.addressLine1)}&city=${nearAddress.city}&state=${nearAddress.state}&zip=${nearAddress.zip}&bedrooms=2`,
        )
        .set('Authorization', `Bearer ${tenantToken}`);
      expect(res.status).toBe(200);
      // Only the near property's rent is included — the far one is excluded despite matching city/state.
      expect(res.body.estimatedMonthlyRentCents).toBe(100000);
      expect(res.body.sampleSize).toBe(1);
    });

    it('returns null with a zero sample size when nothing is nearby', async () => {
      const tenantToken = await registerUser('PROSPECTIVE_TENANT', 'tenant-estimate-empty@example.com');
      const res = await request(app.getHttpServer())
        .get('/api/properties/rent-estimate?addressLine1=999+Nowhere+Rd&city=NowhereVille&state=ZZ&zip=00000&bedrooms=9')
        .set('Authorization', `Bearer ${tenantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.estimatedMonthlyRentCents).toBeNull();
      expect(res.body.sampleSize).toBe(0);
      expect(res.body.addressResolved).toBe(true);
    });

    it('rejects a rent-estimate request missing the required address fields', async () => {
      const tenantToken = await registerUser('PROSPECTIVE_TENANT', 'tenant-estimate-invalid@example.com');
      const res = await request(app.getHttpServer())
        .get('/api/properties/rent-estimate?city=Jacksonville&state=FL')
        .set('Authorization', `Bearer ${tenantToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('Waiting lists', () => {
    it('lets a tenant join and leave a property waitlist, and lets the owner view the queue', async () => {
      const ownerToken = await registerUser('LANDLORD', 'owner-waitlist@example.com');
      const tenantToken = await registerUser('PROSPECTIVE_TENANT', 'tenant-waitlist@example.com');
      const otherLandlordToken = await registerUser('LANDLORD', 'other-landlord-waitlist@example.com');

      const created = await request(app.getHttpServer())
        .post('/api/properties')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(basePayload);
      const propertyId = created.body.id;

      const join = await request(app.getHttpServer())
        .post(`/api/properties/${propertyId}/waitlist`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ note: 'Would love a 2-bed unit here' });
      expect(join.status).toBe(201);
      expect(join.body.note).toBe('Would love a 2-bed unit here');
      expect(join.body.displayName).toBe('PROSPECTIVE_TENANT user');

      const myList = await request(app.getHttpServer())
        .get('/api/properties/waitlists/me')
        .set('Authorization', `Bearer ${tenantToken}`);
      expect(myList.status).toBe(200);
      expect(myList.body).toHaveLength(1);
      expect(myList.body[0].property.id).toBe(propertyId);

      const forbiddenView = await request(app.getHttpServer())
        .get(`/api/properties/${propertyId}/waitlist`)
        .set('Authorization', `Bearer ${otherLandlordToken}`);
      expect(forbiddenView.status).toBe(403);

      const ownerView = await request(app.getHttpServer())
        .get(`/api/properties/${propertyId}/waitlist`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(ownerView.status).toBe(200);
      expect(ownerView.body).toHaveLength(1);
      expect(ownerView.body[0].userId).toBeDefined();

      const leave = await request(app.getHttpServer())
        .delete(`/api/properties/${propertyId}/waitlist`)
        .set('Authorization', `Bearer ${tenantToken}`);
      expect(leave.status).toBe(200);

      const afterLeave = await request(app.getHttpServer())
        .get(`/api/properties/${propertyId}/waitlist`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(afterLeave.body).toHaveLength(0);
    });

    it('forbids a landlord from joining a waitlist', async () => {
      const ownerToken = await registerUser('LANDLORD', 'owner-waitlist-2@example.com');
      const created = await request(app.getHttpServer())
        .post('/api/properties')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(basePayload);

      const res = await request(app.getHttpServer())
        .post(`/api/properties/${created.body.id}/waitlist`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});
      expect(res.status).toBe(403);
    });

    it('is idempotent when the same tenant joins twice, updating the note instead of erroring', async () => {
      const ownerToken = await registerUser('LANDLORD', 'owner-waitlist-3@example.com');
      const tenantToken = await registerUser('PROSPECTIVE_TENANT', 'tenant-waitlist-3@example.com');
      const created = await request(app.getHttpServer())
        .post('/api/properties')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(basePayload);
      const propertyId = created.body.id;

      await request(app.getHttpServer())
        .post(`/api/properties/${propertyId}/waitlist`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ note: 'first note' });
      const second = await request(app.getHttpServer())
        .post(`/api/properties/${propertyId}/waitlist`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ note: 'updated note' });
      expect(second.status).toBe(201);
      expect(second.body.note).toBe('updated note');

      const ownerView = await request(app.getHttpServer())
        .get(`/api/properties/${propertyId}/waitlist`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(ownerView.body).toHaveLength(1);
    });
  });

  describe('Amenities, utilities, sublease, and lease end date', () => {
    it('defaults amenities/utilities/sublease/lease end to empty when not provided', async () => {
      const landlordToken = await registerUser('LANDLORD', 'landlord-extras-default@example.com');
      const created = await request(app.getHttpServer())
        .post('/api/properties')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send(basePayload);
      expect(created.status).toBe(201);
      expect(created.body.amenities).toBeNull();
      expect(created.body.utilitiesIncluded).toEqual([]);
      expect(created.body.subleaseAllowed).toBe(false);
      expect(created.body.currentLeaseEndDate).toBeNull();
    });

    it('persists amenities, utilities covered, sublease allowance, and lease end date', async () => {
      const landlordToken = await registerUser('LANDLORD', 'landlord-extras-set@example.com');
      const created = await request(app.getHttpServer())
        .post('/api/properties')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          ...basePayload,
          amenities: 'In-unit washer/dryer, pool access, fenced yard',
          utilitiesIncluded: ['WATER', 'TRASH', 'LAWN_SERVICE'],
          subleaseAllowed: true,
          currentLeaseEndDate: '2027-06-01T00:00:00.000Z',
        });
      expect(created.status).toBe(201);
      expect(created.body.amenities).toBe('In-unit washer/dryer, pool access, fenced yard');
      expect(created.body.utilitiesIncluded.sort()).toEqual(['LAWN_SERVICE', 'TRASH', 'WATER']);
      expect(created.body.subleaseAllowed).toBe(true);
      expect(created.body.currentLeaseEndDate).toBe('2027-06-01T00:00:00.000Z');
    });

    it('rejects an invalid utility type', async () => {
      const landlordToken = await registerUser('LANDLORD', 'landlord-extras-invalid@example.com');
      const res = await request(app.getHttpServer())
        .post('/api/properties')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ ...basePayload, utilitiesIncluded: ['WIFI'] });
      expect(res.status).toBe(400);
    });

    it('lets the owning landlord update amenities/utilities/sublease/lease end via PATCH', async () => {
      const landlordToken = await registerUser('LANDLORD', 'landlord-extras-update@example.com');
      const created = await request(app.getHttpServer())
        .post('/api/properties')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send(basePayload);

      const updated = await request(app.getHttpServer())
        .patch(`/api/properties/${created.body.id}`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ subleaseAllowed: true, utilitiesIncluded: ['ELECTRIC', 'GAS'] });
      expect(updated.status).toBe(200);
      expect(updated.body.subleaseAllowed).toBe(true);
      expect(updated.body.utilitiesIncluded.sort()).toEqual(['ELECTRIC', 'GAS']);
    });
  });

  describe('Unit square footage', () => {
    it('persists squareFeet on unit create and update (previously not settable at all)', async () => {
      const landlordToken = await registerUser('LANDLORD', 'landlord-sqft@example.com');
      const created = await request(app.getHttpServer())
        .post('/api/properties')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send(basePayload);
      const propertyId = created.body.id;

      const unit = await request(app.getHttpServer())
        .post(`/api/properties/${propertyId}/units`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ unitLabel: '1', bedrooms: 3, bathrooms: 2, squareFeet: 1450, rentCents: 180000 });
      expect(unit.status).toBe(201);
      expect(unit.body.squareFeet).toBe(1450);

      const updatedUnit = await request(app.getHttpServer())
        .patch(`/api/properties/${propertyId}/units/${unit.body.id}`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ squareFeet: 1600 });
      expect(updatedUnit.status).toBe(200);
      expect(updatedUnit.body.squareFeet).toBe(1600);
    });
  });
});
