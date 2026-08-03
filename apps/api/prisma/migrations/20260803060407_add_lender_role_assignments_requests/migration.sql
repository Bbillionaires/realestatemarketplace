-- CreateEnum
CREATE TYPE "LenderAccessTier" AS ENUM ('BASIC', 'PREMIUM');

-- CreateEnum
CREATE TYPE "LenderRequestStatus" AS ENUM ('PENDING', 'FULFILLED', 'DECLINED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'LENDER';

-- CreateTable
CREATE TABLE "LenderAssignment" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "lenderId" TEXT NOT NULL,
    "tenantId" TEXT,
    "assignedById" TEXT NOT NULL,
    "accessTier" "LenderAccessTier" NOT NULL DEFAULT 'BASIC',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "LenderAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LenderPaymentRequest" (
    "id" TEXT NOT NULL,
    "lenderAssignmentId" TEXT NOT NULL,
    "message" TEXT,
    "status" "LenderRequestStatus" NOT NULL DEFAULT 'PENDING',
    "responseNote" TEXT,
    "responseFileName" TEXT,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "LenderPaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LenderAssignment_lenderId_idx" ON "LenderAssignment"("lenderId");

-- CreateIndex
CREATE INDEX "LenderAssignment_tenantId_idx" ON "LenderAssignment"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LenderAssignment_propertyId_lenderId_key" ON "LenderAssignment"("propertyId", "lenderId");

-- CreateIndex
CREATE INDEX "LenderPaymentRequest_lenderAssignmentId_idx" ON "LenderPaymentRequest"("lenderAssignmentId");

-- AddForeignKey
ALTER TABLE "LenderAssignment" ADD CONSTRAINT "LenderAssignment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderAssignment" ADD CONSTRAINT "LenderAssignment_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderAssignment" ADD CONSTRAINT "LenderAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderAssignment" ADD CONSTRAINT "LenderAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderPaymentRequest" ADD CONSTRAINT "LenderPaymentRequest_lenderAssignmentId_fkey" FOREIGN KEY ("lenderAssignmentId") REFERENCES "LenderAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
