-- CreateEnum
CREATE TYPE "UnitListingType" AS ENUM ('ENTIRE_PLACE', 'PRIVATE_ROOM', 'SHARED_ROOM');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "bedId" TEXT;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "bedId" TEXT;

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "bedId" TEXT;

-- AlterTable
ALTER TABLE "PropertyUnit" ADD COLUMN     "listingType" "UnitListingType" NOT NULL DEFAULT 'ENTIRE_PLACE';

-- CreateTable
CREATE TABLE "Bed" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "bedLabel" TEXT NOT NULL,
    "rentCents" INTEGER,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bed_unitId_idx" ON "Bed"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "Bed_unitId_bedLabel_key" ON "Bed"("unitId", "bedLabel");

-- AddForeignKey
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
