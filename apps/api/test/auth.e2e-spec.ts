import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDatabase } from './utils/test-app';

describe('Auth (e2e)', () => {
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

  const credentials = {
    email: 'newuser@example.com',
    password: 'CorrectHorseBatteryStaple1!',
    displayName: 'New User',
    role: 'PROSPECTIVE_TENANT',
  };

  it('registers a new user and returns a token pair', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/register').send(credentials);
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('rejects registration with a disallowed self-service role', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ ...credentials, role: 'SUPER_ADMINISTRATOR' });
    expect(res.status).toBe(400);
  });

  it('rejects duplicate registration for the same email', async () => {
    await request(app.getHttpServer()).post('/api/auth/register').send(credentials);
    const res = await request(app.getHttpServer()).post('/api/auth/register').send(credentials);
    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials and rejects incorrect ones', async () => {
    await request(app.getHttpServer()).post('/api/auth/register').send(credentials);

    const goodLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    expect(goodLogin.status).toBe(200);
    expect(goodLogin.body.accessToken).toBeDefined();

    const badLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: credentials.email, password: 'wrong-password' });
    expect(badLogin.status).toBe(401);
  });

  it('protects routes requiring authentication', async () => {
    const res = await request(app.getHttpServer()).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('allows access to a protected route with a valid access token', async () => {
    const register = await request(app.getHttpServer()).post('/api/auth/register').send(credentials);
    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${register.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(credentials.email);
    // Never expose the password hash.
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('rotates refresh tokens and rejects reuse of an already-rotated token', async () => {
    const register = await request(app.getHttpServer()).post('/api/auth/register').send(credentials);
    const firstRefreshToken = register.body.refreshToken;

    const rotated = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: firstRefreshToken });
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(firstRefreshToken);

    // Reusing the original (now-rotated) token must fail...
    const reuse = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: firstRefreshToken });
    expect(reuse.status).toBe(401);

    // ...and must also revoke the new token issued from that rotation
    // (whole-family revocation on reuse detection).
    const afterReuse = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken });
    expect(afterReuse.status).toBe(401);
  });

  it('suspended users cannot log in even with correct credentials', async () => {
    const register = await request(app.getHttpServer()).post('/api/auth/register').send(credentials);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: credentials.email } });
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    expect(res.status).toBe(403);

    // An already-issued access token also stops working once suspended.
    const meRes = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${register.body.accessToken}`);
    expect(meRes.status).toBe(401);
  });
});
