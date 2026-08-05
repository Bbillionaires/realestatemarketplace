-- CreateEnum
CREATE TYPE "GigJobStatus" AS ENUM ('OPEN', 'CLAIMED', 'COMPLETED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GigVoucherStatus" AS ENUM ('ISSUED', 'APPLIED');

-- CreateTable
CREATE TABLE "GigJob" (
    "id" TEXT NOT NULL,
    "posterId" TEXT NOT NULL,
    "posterRole" "Role" NOT NULL,
    "propertyId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "payoutCents" INTEGER NOT NULL,
    "status" "GigJobStatus" NOT NULL DEFAULT 'OPEN',
    "claimedById" TEXT,
    "claimedConversationId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "paymentProviderCheckoutId" TEXT,
    "paymentOrderId" TEXT,
    "checkoutUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GigJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GigVoucher" (
    "id" TEXT NOT NULL,
    "gigJobId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "landlordId" TEXT NOT NULL,
    "payoutCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "voucherCents" INTEGER NOT NULL,
    "status" "GigVoucherStatus" NOT NULL DEFAULT 'ISSUED',
    "appliedAt" TIMESTAMP(3),
    "appliedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GigVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GigJob_posterId_idx" ON "GigJob"("posterId");

-- CreateIndex
CREATE INDEX "GigJob_status_idx" ON "GigJob"("status");

-- CreateIndex
CREATE INDEX "GigJob_paymentOrderId_idx" ON "GigJob"("paymentOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "GigVoucher_gigJobId_key" ON "GigVoucher"("gigJobId");

-- CreateIndex
CREATE INDEX "GigVoucher_tenantId_idx" ON "GigVoucher"("tenantId");

-- CreateIndex
CREATE INDEX "GigVoucher_landlordId_idx" ON "GigVoucher"("landlordId");

-- AddForeignKey
ALTER TABLE "GigJob" ADD CONSTRAINT "GigJob_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GigJob" ADD CONSTRAINT "GigJob_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GigJob" ADD CONSTRAINT "GigJob_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GigJob" ADD CONSTRAINT "GigJob_claimedConversationId_fkey" FOREIGN KEY ("claimedConversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GigVoucher" ADD CONSTRAINT "GigVoucher_gigJobId_fkey" FOREIGN KEY ("gigJobId") REFERENCES "GigJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GigVoucher" ADD CONSTRAINT "GigVoucher_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GigVoucher" ADD CONSTRAINT "GigVoucher_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
