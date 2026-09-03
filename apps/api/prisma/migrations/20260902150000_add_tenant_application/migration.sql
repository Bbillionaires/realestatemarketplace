-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "checkoutUrl" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "currentAddressLine1" TEXT,
ADD COLUMN     "currentAddressLine2" TEXT,
ADD COLUMN     "currentCity" TEXT,
ADD COLUMN     "currentState" TEXT,
ADD COLUMN     "currentZip" TEXT,
ADD COLUMN     "dateOfBirth" TEXT,
ADD COLUMN     "employerName" TEXT,
ADD COLUMN     "employerPhone" TEXT,
ADD COLUMN     "employmentStartDate" TEXT,
ADD COLUMN     "feeCents" INTEGER,
ADD COLUMN     "fullLegalName" TEXT,
ADD COLUMN     "guarantorEmail" TEXT,
ADD COLUMN     "guarantorFullName" TEXT,
ADD COLUMN     "guarantorMonthlyIncomeCents" INTEGER,
ADD COLUMN     "guarantorPhone" TEXT,
ADD COLUMN     "hasGuarantor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasPets" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasVehicles" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "incomeProofFile" BYTEA,
ADD COLUMN     "incomeProofFileName" TEXT,
ADD COLUMN     "incomeProofMimeType" TEXT,
ADD COLUMN     "monthlyIncomeCents" INTEGER,
ADD COLUMN     "otherIncomeCents" INTEGER,
ADD COLUMN     "otherIncomeNote" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentOrderId" TEXT,
ADD COLUMN     "paymentProviderCheckoutId" TEXT,
ADD COLUMN     "petDetails" TEXT,
ADD COLUMN     "position" TEXT,
ADD COLUMN     "reasonForMoving" TEXT,
ADD COLUMN     "vehicleDetails" TEXT;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "applicationFeeCents" INTEGER;

-- CreateTable
CREATE TABLE "ApplicationOccupant" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT,

    CONSTRAINT "ApplicationOccupant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationRentalHistoryEntry" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "landlordName" TEXT,
    "landlordPhone" TEXT,
    "landlordEmail" TEXT,
    "monthlyRentCents" INTEGER,
    "moveInDate" TEXT,
    "moveOutDate" TEXT,
    "reasonForLeaving" TEXT,

    CONSTRAINT "ApplicationRentalHistoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationReference" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT,
    "phone" TEXT,
    "email" TEXT,

    CONSTRAINT "ApplicationReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationOccupant_applicationId_idx" ON "ApplicationOccupant"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationRentalHistoryEntry_applicationId_idx" ON "ApplicationRentalHistoryEntry"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationReference_applicationId_idx" ON "ApplicationReference"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_conversationId_key" ON "Application"("conversationId");

-- CreateIndex
CREATE INDEX "Application_paymentOrderId_idx" ON "Application"("paymentOrderId");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationOccupant" ADD CONSTRAINT "ApplicationOccupant_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationRentalHistoryEntry" ADD CONSTRAINT "ApplicationRentalHistoryEntry_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationReference" ADD CONSTRAINT "ApplicationReference_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

