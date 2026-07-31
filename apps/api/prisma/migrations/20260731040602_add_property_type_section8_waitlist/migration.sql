-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'CONDO', 'TOWNHOME', 'OTHER');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "acceptsSection8Vouchers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "propertyType" "PropertyType" NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE "PropertyWaitlistEntry" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyWaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyWaitlistEntry_propertyId_idx" ON "PropertyWaitlistEntry"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyWaitlistEntry_propertyId_userId_key" ON "PropertyWaitlistEntry"("propertyId", "userId");

-- AddForeignKey
ALTER TABLE "PropertyWaitlistEntry" ADD CONSTRAINT "PropertyWaitlistEntry_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyWaitlistEntry" ADD CONSTRAINT "PropertyWaitlistEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
