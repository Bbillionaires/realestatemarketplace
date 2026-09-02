-- CreateEnum
CREATE TYPE "TenantScreeningKind" AS ENUM ('PORTABLE', 'APPLICATION');

-- CreateEnum
CREATE TYPE "TenantScreeningStatus" AS ENUM ('AWAITING_TENANT_AUTHORIZATION', 'PAID', 'SUBMITTED_EXTERNALLY', 'COMPLETE', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "TenantScreening" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "TenantScreeningKind" NOT NULL,
    "status" "TenantScreeningStatus" NOT NULL DEFAULT 'AWAITING_TENANT_AUTHORIZATION',
    "initiatedById" TEXT,
    "initiatorAcknowledgedAt" TIMESTAMP(3),
    "conversationId" TEXT,
    "feeCents" INTEGER NOT NULL DEFAULT 5000,
    "paymentProviderCheckoutId" TEXT,
    "paymentOrderId" TEXT,
    "checkoutUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "resultFileName" TEXT,
    "resultMimeType" TEXT,
    "resultFile" BYTEA,
    "resultUploadedByStaffId" TEXT,
    "resultUploadedAt" TIMESTAMP(3),
    "staffNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantScreening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantScreeningShare" (
    "id" TEXT NOT NULL,
    "tenantScreeningId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantScreeningShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantScreening_tenantId_idx" ON "TenantScreening"("tenantId");

-- CreateIndex
CREATE INDEX "TenantScreening_conversationId_idx" ON "TenantScreening"("conversationId");

-- CreateIndex
CREATE INDEX "TenantScreening_paymentOrderId_idx" ON "TenantScreening"("paymentOrderId");

-- CreateIndex
CREATE INDEX "TenantScreeningShare_conversationId_idx" ON "TenantScreeningShare"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantScreeningShare_tenantScreeningId_conversationId_key" ON "TenantScreeningShare"("tenantScreeningId", "conversationId");

-- AddForeignKey
ALTER TABLE "TenantScreening" ADD CONSTRAINT "TenantScreening_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantScreening" ADD CONSTRAINT "TenantScreening_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantScreening" ADD CONSTRAINT "TenantScreening_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantScreeningShare" ADD CONSTRAINT "TenantScreeningShare_tenantScreeningId_fkey" FOREIGN KEY ("tenantScreeningId") REFERENCES "TenantScreening"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantScreeningShare" ADD CONSTRAINT "TenantScreeningShare_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
