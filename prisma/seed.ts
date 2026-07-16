import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEMO_PASSWORD = "Password123";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const landlord = await prisma.user.upsert({
    where: { email: "landlord@example.com" },
    update: {},
    create: {
      email: "landlord@example.com",
      name: "Lena Landlord",
      passwordHash,
      role: "LANDLORD",
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@example.com" },
    update: {},
    create: {
      email: "manager@example.com",
      name: "Mo Manager",
      passwordHash,
      role: "PROPERTY_MANAGER",
    },
  });

  await prisma.user.upsert({
    where: { email: "tenant@example.com" },
    update: {},
    create: {
      email: "tenant@example.com",
      name: "Tia Tenant",
      passwordHash,
      role: "TENANT",
    },
  });

  const existing = await prisma.property.findFirst({
    where: { title: "Sunny 2BR near downtown" },
  });

  const property =
    existing ??
    (await prisma.property.create({
      data: {
        ownerId: landlord.id,
        managerId: manager.id,
        status: "PUBLISHED",
        title: "Sunny 2BR near downtown",
        description:
          "Bright, freshly-painted 2 bedroom / 1 bath unit five minutes from downtown. Off-street parking, in-unit laundry hookups.",
        addressLine1: "412 Maple St",
        city: "Springfield",
        state: "IL",
        zip: "62701",
        bedrooms: 2,
        bathrooms: 1,
        squareFeet: 950,
        rentAmount: "1350.00",
        securityDeposit: "1350.00",
        leaseLengthMonths: 12,
        rentDueDay: 1,
        acceptsHud: true,
        minCreditScore: 600,
        minMonthlyIncomeMultiple: 2.5,
        requiresBackgroundCheck: true,
        allowsEvictionHistory: false,
        criteriaNotes: "No smoking. Pets under 30lbs considered with deposit.",
        lawnCareResponsibleParty: "LANDLORD",
        lawnCarePaidBy: "LANDLORD",
        lateFeeAmount: "75.00",
        lateFeeType: "FLAT",
        lateFeeGraceDays: 5,
        workForRentAvailable: true,
        workForRentDescription:
          "Landlord owns a small landscaping business and can offer part-time weekend work; hours worked offset rent dollar-for-dollar.",
        utilities: {
          create: [
            { type: "WATER", paidBy: "LANDLORD" },
            { type: "TRASH", paidBy: "LANDLORD" },
            { type: "ELECTRIC", paidBy: "TENANT" },
            { type: "GAS", paidBy: "TENANT" },
            { type: "INTERNET", paidBy: "TENANT" },
          ],
        },
      },
    }));

  const slotCount = await prisma.availabilitySlot.count({ where: { propertyId: property.id } });
  if (slotCount === 0) {
    const now = new Date();
    const days = [1, 2, 3];
    await prisma.availabilitySlot.createMany({
      data: days.map((d) => {
        const start = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
        start.setHours(15, 0, 0, 0);
        const end = new Date(start.getTime() + 30 * 60 * 1000);
        return {
          propertyId: property.id,
          createdById: landlord.id,
          startTime: start,
          endTime: end,
        };
      }),
    });
  }

  console.log("Seeded demo accounts (password for all: %s):", DEMO_PASSWORD);
  console.log("  Landlord:         landlord@example.com");
  console.log("  Property manager: manager@example.com");
  console.log("  Tenant:           tenant@example.com");
  console.log("Seeded property: %s (%s)", property.title, property.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
