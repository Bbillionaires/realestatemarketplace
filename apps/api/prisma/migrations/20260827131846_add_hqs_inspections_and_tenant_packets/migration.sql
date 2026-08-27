-- CreateEnum
CREATE TYPE "HqsInspectionStatus" AS ENUM ('AWAITING_PAYMENT', 'PAID', 'REQUESTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TenantPacketStatus" AS ENUM ('NOT_STARTED', 'AWAITING_PAYMENT', 'PAID', 'SUBMITTED');

-- CreateTable
CREATE TABLE "HqsInspectionRequest" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "feeCents" INTEGER NOT NULL DEFAULT 19900,
    "status" "HqsInspectionStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "paymentProviderCheckoutId" TEXT,
    "paymentOrderId" TEXT,
    "checkoutUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "preferredDateNote" TEXT,
    "requestedAt" TIMESTAMP(3),
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HqsInspectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "feeCents" INTEGER NOT NULL DEFAULT 2900,
    "status" "TenantPacketStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "paymentProviderCheckoutId" TEXT,
    "paymentOrderId" TEXT,
    "checkoutUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "incomeProofFileName" TEXT,
    "incomeProofMimeType" TEXT,
    "incomeProofFile" BYTEA,
    "backgroundExplanation" TEXT,
    "references" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantPacket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HqsInspectionRequest_propertyId_idx" ON "HqsInspectionRequest"("propertyId");

-- CreateIndex
CREATE INDEX "HqsInspectionRequest_paymentOrderId_idx" ON "HqsInspectionRequest"("paymentOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantPacket_tenantId_key" ON "TenantPacket"("tenantId");

-- CreateIndex
CREATE INDEX "TenantPacket_paymentOrderId_idx" ON "TenantPacket"("paymentOrderId");

-- AddForeignKey
ALTER TABLE "HqsInspectionRequest" ADD CONSTRAINT "HqsInspectionRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HqsInspectionRequest" ADD CONSTRAINT "HqsInspectionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPacket" ADD CONSTRAINT "TenantPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
