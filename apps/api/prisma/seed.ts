import 'dotenv/config';
import { PrismaClient, Role, ConsentStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHmac, createCipheriv, randomBytes } from 'crypto';

const prisma = new PrismaClient();

const HASH_SECRET = process.env.PHONE_HASH_SECRET ?? 'dev-hash-secret';
const ENCRYPTION_KEY = Buffer.from(
  process.env.PHONE_ENCRYPTION_KEY ?? 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
  'base64',
);

function encryptPhone(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${ciphertext.toString('base64')}`;
}

function hashPhone(plaintext: string): string {
  return createHmac('sha256', HASH_SECRET).update(plaintext).digest('hex');
}

async function main() {
  const passwordHash = await argon2.hash('DevPassword123!', { type: argon2.argon2id });

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@example.com' },
    update: {},
    create: {
      email: 'superadmin@example.com',
      passwordHash,
      role: Role.SUPER_ADMINISTRATOR,
      profile: { create: { displayName: 'Platform Super Admin' } },
      notificationPreference: { create: { smsTransactionalConsent: ConsentStatus.OPTED_IN } },
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash,
      role: Role.ADMINISTRATOR,
      profile: { create: { displayName: 'Platform Admin' } },
      notificationPreference: { create: { smsTransactionalConsent: ConsentStatus.OPTED_IN } },
    },
  });

  const moderator = await prisma.user.upsert({
    where: { email: 'moderator@example.com' },
    update: {},
    create: {
      email: 'moderator@example.com',
      passwordHash,
      role: Role.STAFF_MODERATOR,
      profile: { create: { displayName: 'Staff Moderator' } },
      notificationPreference: { create: { smsTransactionalConsent: ConsentStatus.OPTED_IN } },
    },
  });

  const landlord = await prisma.user.upsert({
    where: { email: 'landlord@example.com' },
    update: {},
    create: {
      email: 'landlord@example.com',
      passwordHash,
      role: Role.LANDLORD,
      profile: { create: { displayName: 'Grace Property Holdings' } },
      notificationPreference: { create: { smsTransactionalConsent: ConsentStatus.OPTED_IN } },
      phoneNumbers: {
        create: {
          encryptedNumber: encryptPhone('+19045550100'),
          numberHash: hashPhone('+19045550100'),
          last4: '0100',
          isVerified: true,
          isPrimary: true,
          verifiedAt: new Date(),
        },
      },
    },
  });

  const propertyManager = await prisma.user.upsert({
    where: { email: 'manager@example.com' },
    update: {},
    create: {
      email: 'manager@example.com',
      passwordHash,
      role: Role.PROPERTY_MANAGER,
      profile: { create: { displayName: 'Jordan the Property Manager' } },
      notificationPreference: { create: { smsTransactionalConsent: ConsentStatus.OPTED_IN } },
    },
  });

  const tenant = await prisma.user.upsert({
    where: { email: 'tenant@example.com' },
    update: {},
    create: {
      email: 'tenant@example.com',
      passwordHash,
      role: Role.PROSPECTIVE_TENANT,
      profile: { create: { displayName: 'Prospective Tenant #4821' } },
      notificationPreference: { create: { smsTransactionalConsent: ConsentStatus.OPTED_IN } },
      phoneNumbers: {
        create: {
          encryptedNumber: encryptPhone('+19045550199'),
          numberHash: hashPhone('+19045550199'),
          last4: '0199',
          isVerified: true,
          isPrimary: true,
          verifiedAt: new Date(),
        },
      },
    },
  });

  const property = await prisma.property.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      ownerId: landlord.id,
      title: '123 Main Street',
      addressLine1: '123 Main Street',
      city: 'Jacksonville',
      state: 'FL',
      zip: '32202',
      description: 'Charming 3-bed, 2-bath single family home near downtown. Fully renovated with new floors, kitchen, and bathrooms.',
      monthlyRentCents: 185000,
      depositCents: 185000,
      petPolicy: 'Cats and small dogs welcome with pet deposit.',
      photoUrl: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80',
      units: {
        create: [{ unitLabel: 'Main', bedrooms: 3, bathrooms: 2, squareFeet: 1450, rentCents: 185000 }],
      },
      managerAssignments: {
        create: [{ userId: propertyManager.id }],
      },
    },
  });

  await prisma.property.upsert({
    where: { id: '00000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000002',
      ownerId: landlord.id,
      title: '455 Oak Avenue',
      addressLine1: '455 Oak Avenue',
      city: 'Jacksonville',
      state: 'FL',
      zip: '32204',
      description: 'Modern 2-bed apartment with in-unit laundry and updated fixtures throughout.',
      monthlyRentCents: 145000,
      depositCents: 145000,
      petPolicy: 'No pets allowed.',
      photoUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
      units: {
        create: [{ unitLabel: 'Apt 2B', bedrooms: 2, bathrooms: 1, squareFeet: 900, rentCents: 145000 }],
      },
    },
  });

  const relayNumbers = ['+18885550101', '+18885550102', '+18885550103'];
  for (const phoneNumber of relayNumbers) {
    await prisma.relayNumber.upsert({
      where: { phoneNumber },
      update: {},
      create: { phoneNumber, provider: 'mock', region: 'US', capacityLimit: 50 },
    });
  }

  console.log('Seed complete:', {
    superAdmin: superAdmin.email,
    admin: admin.email,
    moderator: moderator.email,
    landlord: landlord.email,
    propertyManager: propertyManager.email,
    tenant: tenant.email,
    property: property.title,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
