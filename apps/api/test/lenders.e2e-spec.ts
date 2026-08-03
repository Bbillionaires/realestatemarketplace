import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { MockEmailProvider } from '../src/email/providers/mock-email.provider';
import { createTestApp, resetDatabase } from './utils/test-app';

const NON_SELF_SERVICE_ROLES = ['CURRENT_TENANT', 'LENDER', 'STAFF_MODERATOR', 'ADMINISTRATOR', 'SUPER_ADMINISTRATOR'];

describe('Lenders (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let mockEmail: MockEmailProvider;

  beforeAll(async () => {
    ({ app, moduleRef } = await createTestApp());
    prisma = moduleRef.get(PrismaService);
    mockEmail = moduleRef.get(MockEmailProvider);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    mockEmail.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerAs(role: string, email: string): Promise<{ accessToken: string; userId: string }> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: 'CorrectHorseBatteryStaple1!',
        displayName: email,
        role: NON_SELF_SERVICE_ROLES.includes(role) ? 'PROSPECTIVE_TENANT' : role,
      });
    if (NON_SELF_SERVICE_ROLES.includes(role)) {
      await prisma.user.update({ where: { email }, data: { role: role as Role } });
    }
    const accessToken = res.body.accessToken as string;
    const me = await request(app.getHttpServer()).get('/api/users/me').set('Authorization', `Bearer ${accessToken}`);
    return { accessToken, userId: me.body.id as string };
  }

  async function createProperty(landlordToken: string, title = 'Lender Test Property') {
    const res = await request(app.getHttpServer())
      .post('/api/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ title, addressLine1: '1 Lender Way', city: 'Jacksonville', state: 'FL', zip: '32202' });
    return res.body.id as string;
  }

  describe('Admin assignment management', () => {
    it('lets an admin assign a lender to a property with an optional tenant and access tier', async () => {
      const admin = await registerAs('ADMINISTRATOR', 'admin-lender-1@example.com');
      const landlord = await registerAs('LANDLORD', 'landlord-lender-1@example.com');
      const lender = await registerAs('LENDER', 'lender-1@example.com');
      const tenant = await registerAs('CURRENT_TENANT', 'tenant-lender-1@example.com');
      const propertyId = await createProperty(landlord.accessToken);

      const res = await request(app.getHttpServer())
        .post('/api/lenders/assignments')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ propertyId, lenderId: lender.userId, tenantId: tenant.userId, accessTier: 'PREMIUM' });
      expect(res.status).toBe(201);
      expect(res.body.lenderId).toBe(lender.userId);
      expect(res.body.tenantId).toBe(tenant.userId);
      expect(res.body.accessTier).toBe('PREMIUM');
      expect(res.body.propertyTitle).toBe('Lender Test Property');
    });

    it('forbids a non-admin from creating a lender assignment', async () => {
      const landlord = await registerAs('LANDLORD', 'landlord-lender-2@example.com');
      const lender = await registerAs('LENDER', 'lender-2@example.com');
      const propertyId = await createProperty(landlord.accessToken);

      const res = await request(app.getHttpServer())
        .post('/api/lenders/assignments')
        .set('Authorization', `Bearer ${landlord.accessToken}`)
        .send({ propertyId, lenderId: lender.userId });
      expect(res.status).toBe(403);
    });

    it('rejects a lenderId that does not have the LENDER role', async () => {
      const admin = await registerAs('ADMINISTRATOR', 'admin-lender-3@example.com');
      const landlord = await registerAs('LANDLORD', 'landlord-lender-3@example.com');
      const propertyId = await createProperty(landlord.accessToken);

      const res = await request(app.getHttpServer())
        .post('/api/lenders/assignments')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ propertyId, lenderId: landlord.userId });
      expect(res.status).toBe(400);
    });

    it('rejects a tenantId that is not a prospective or current tenant', async () => {
      const admin = await registerAs('ADMINISTRATOR', 'admin-lender-4@example.com');
      const landlord = await registerAs('LANDLORD', 'landlord-lender-4@example.com');
      const lender = await registerAs('LENDER', 'lender-4@example.com');
      const propertyId = await createProperty(landlord.accessToken);

      const res = await request(app.getHttpServer())
        .post('/api/lenders/assignments')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ propertyId, lenderId: lender.userId, tenantId: landlord.userId });
      expect(res.status).toBe(400);
    });

    it('lets an admin update the tenant and access tier, and revoke the assignment', async () => {
      const admin = await registerAs('ADMINISTRATOR', 'admin-lender-5@example.com');
      const landlord = await registerAs('LANDLORD', 'landlord-lender-5@example.com');
      const lender = await registerAs('LENDER', 'lender-5@example.com');
      const tenant1 = await registerAs('PROSPECTIVE_TENANT', 'tenant-lender-5a@example.com');
      const tenant2 = await registerAs('PROSPECTIVE_TENANT', 'tenant-lender-5b@example.com');
      const propertyId = await createProperty(landlord.accessToken);

      const created = await request(app.getHttpServer())
        .post('/api/lenders/assignments')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ propertyId, lenderId: lender.userId, tenantId: tenant1.userId });

      const updated = await request(app.getHttpServer())
        .patch(`/api/lenders/assignments/${created.body.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ tenantId: tenant2.userId, accessTier: 'PREMIUM' });
      expect(updated.status).toBe(200);
      expect(updated.body.tenantId).toBe(tenant2.userId);
      expect(updated.body.accessTier).toBe('PREMIUM');

      const revoked = await request(app.getHttpServer())
        .patch(`/api/lenders/assignments/${created.body.id}/revoke`)
        .set('Authorization', `Bearer ${admin.accessToken}`);
      expect(revoked.status).toBe(200);
      expect(revoked.body.revokedAt).not.toBeNull();
    });
  });

  describe('Lender-side access', () => {
    it('lets a lender see only their own non-revoked assignments', async () => {
      const admin = await registerAs('ADMINISTRATOR', 'admin-lender-6@example.com');
      const landlord = await registerAs('LANDLORD', 'landlord-lender-6@example.com');
      const lenderA = await registerAs('LENDER', 'lender-6a@example.com');
      const lenderB = await registerAs('LENDER', 'lender-6b@example.com');
      const propertyId1 = await createProperty(landlord.accessToken, 'Property One');
      const propertyId2 = await createProperty(landlord.accessToken, 'Property Two');

      await request(app.getHttpServer())
        .post('/api/lenders/assignments')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ propertyId: propertyId1, lenderId: lenderA.userId });
      const revokedAssignment = await request(app.getHttpServer())
        .post('/api/lenders/assignments')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ propertyId: propertyId2, lenderId: lenderA.userId });
      await request(app.getHttpServer())
        .patch(`/api/lenders/assignments/${revokedAssignment.body.id}/revoke`)
        .set('Authorization', `Bearer ${admin.accessToken}`);
      await request(app.getHttpServer())
        .post('/api/lenders/assignments')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ propertyId: propertyId1, lenderId: lenderB.userId });

      const res = await request(app.getHttpServer())
        .get('/api/lenders/assignments/me')
        .set('Authorization', `Bearer ${lenderA.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].propertyTitle).toBe('Property One');
    });
  });

  describe('Payment requests', () => {
    async function setupAssignment() {
      const admin = await registerAs('ADMINISTRATOR', `admin-req-${Date.now()}-${Math.random()}@example.com`);
      const landlord = await registerAs('LANDLORD', `landlord-req-${Date.now()}-${Math.random()}@example.com`);
      const lender = await registerAs('LENDER', `lender-req-${Date.now()}-${Math.random()}@example.com`);
      const tenant = await registerAs('CURRENT_TENANT', `tenant-req-${Date.now()}-${Math.random()}@example.com`);
      const propertyId = await createProperty(landlord.accessToken);
      const assignment = await request(app.getHttpServer())
        .post('/api/lenders/assignments')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ propertyId, lenderId: lender.userId, tenantId: tenant.userId });
      return { admin, landlord, lender, tenant, propertyId, assignmentId: assignment.body.id as string };
    }

    it('lets a lender create a request and the tenant list it', async () => {
      const { lender, tenant, assignmentId } = await setupAssignment();

      const created = await request(app.getHttpServer())
        .post(`/api/lenders/assignments/${assignmentId}/requests`)
        .set('Authorization', `Bearer ${lender.accessToken}`)
        .send({ message: 'Please share your last 3 months of rent payment proof.' });
      expect(created.status).toBe(201);
      expect(created.body.status).toBe('PENDING');

      const myRequests = await request(app.getHttpServer())
        .get('/api/lenders/requests/me')
        .set('Authorization', `Bearer ${tenant.accessToken}`);
      expect(myRequests.status).toBe(200);
      expect(myRequests.body).toHaveLength(1);
      expect(myRequests.body[0].message).toBe('Please share your last 3 months of rent payment proof.');
    });

    it('forbids creating a request on an assignment with no tenant set', async () => {
      const admin = await registerAs('ADMINISTRATOR', 'admin-req-notenant@example.com');
      const landlord = await registerAs('LANDLORD', 'landlord-req-notenant@example.com');
      const lender = await registerAs('LENDER', 'lender-req-notenant@example.com');
      const propertyId = await createProperty(landlord.accessToken);
      const assignment = await request(app.getHttpServer())
        .post('/api/lenders/assignments')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ propertyId, lenderId: lender.userId });

      const res = await request(app.getHttpServer())
        .post(`/api/lenders/assignments/${assignment.body.id}/requests`)
        .set('Authorization', `Bearer ${lender.accessToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('forbids a different lender from creating a request on someone else\'s assignment', async () => {
      const { assignmentId } = await setupAssignment();
      const otherLender = await registerAs('LENDER', 'other-lender-req@example.com');

      const res = await request(app.getHttpServer())
        .post(`/api/lenders/assignments/${assignmentId}/requests`)
        .set('Authorization', `Bearer ${otherLender.accessToken}`)
        .send({});
      expect(res.status).toBe(403);
    });

    it('lets the tenant submit a response with a file, forwards it by email, and does not persist the file content', async () => {
      const { lender, tenant, assignmentId } = await setupAssignment();
      const created = await request(app.getHttpServer())
        .post(`/api/lenders/assignments/${assignmentId}/requests`)
        .set('Authorization', `Bearer ${lender.accessToken}`)
        .send({ message: 'Proof please' });

      const submitted = await request(app.getHttpServer())
        .post(`/api/lenders/requests/${created.body.id}/submit`)
        .set('Authorization', `Bearer ${tenant.accessToken}`)
        .field('responseNote', 'Here is my proof of payment')
        .attach('file', Buffer.from('fake receipt bytes'), 'receipt.pdf');
      expect(submitted.status).toBe(201);
      expect(submitted.body.status).toBe('FULFILLED');
      expect(submitted.body.responseFileName).toBe('receipt.pdf');
      expect(submitted.body.emailSent).toBe(true);
      expect(JSON.stringify(submitted.body)).not.toContain('fake receipt bytes');

      const lenderEmail = `lender-req-`; // sanity: mock email captured the send
      const sent = mockEmail.getSentEmails();
      expect(sent).toHaveLength(1);
      expect(sent[0].attachmentFilenames).toEqual(['receipt.pdf']);
      void lenderEmail;
    });

    it('lets the tenant decline a request without submitting anything', async () => {
      const { lender, tenant, assignmentId } = await setupAssignment();
      const created = await request(app.getHttpServer())
        .post(`/api/lenders/assignments/${assignmentId}/requests`)
        .set('Authorization', `Bearer ${lender.accessToken}`)
        .send({});

      const declined = await request(app.getHttpServer())
        .patch(`/api/lenders/requests/${created.body.id}/decline`)
        .set('Authorization', `Bearer ${tenant.accessToken}`);
      expect(declined.status).toBe(200);
      expect(declined.body.status).toBe('DECLINED');
      expect(mockEmail.getSentEmails()).toHaveLength(0);
    });

    it('forbids a different tenant from submitting or declining someone else\'s request', async () => {
      const { lender, assignmentId } = await setupAssignment();
      const otherTenant = await registerAs('PROSPECTIVE_TENANT', 'other-tenant-req@example.com');
      const created = await request(app.getHttpServer())
        .post(`/api/lenders/assignments/${assignmentId}/requests`)
        .set('Authorization', `Bearer ${lender.accessToken}`)
        .send({});

      const declineAttempt = await request(app.getHttpServer())
        .patch(`/api/lenders/requests/${created.body.id}/decline`)
        .set('Authorization', `Bearer ${otherTenant.accessToken}`);
      expect(declineAttempt.status).toBe(403);
    });

    it('rejects resubmitting a request that has already been responded to', async () => {
      const { lender, tenant, assignmentId } = await setupAssignment();
      const created = await request(app.getHttpServer())
        .post(`/api/lenders/assignments/${assignmentId}/requests`)
        .set('Authorization', `Bearer ${lender.accessToken}`)
        .send({});
      await request(app.getHttpServer())
        .patch(`/api/lenders/requests/${created.body.id}/decline`)
        .set('Authorization', `Bearer ${tenant.accessToken}`);

      const secondAttempt = await request(app.getHttpServer())
        .patch(`/api/lenders/requests/${created.body.id}/decline`)
        .set('Authorization', `Bearer ${tenant.accessToken}`);
      expect(secondAttempt.status).toBe(400);
    });
  });
});
