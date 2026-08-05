-- CreateEnum
CREATE TYPE "JobReferralPendingOperation" AS ENUM ('ACTIVATE', 'TOPUP', 'RENEW');

-- AlterEnum
ALTER TYPE "JobReferralStatus" ADD VALUE 'PENDING_PAYMENT';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'EMPLOYER';

-- AlterTable
ALTER TABLE "JobReferral" ADD COLUMN     "budgetRemainingCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "checkoutUrl" TEXT,
ADD COLUMN     "clickCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "costPerClickCents" INTEGER,
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "monthlyFeeCents" INTEGER,
ADD COLUMN     "paymentOrderId" TEXT,
ADD COLUMN     "paymentProviderCheckoutId" TEXT,
ADD COLUMN     "pendingBudgetCents" INTEGER,
ADD COLUMN     "pendingOperation" "JobReferralPendingOperation",
ADD COLUMN     "sponsored" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "JobReferralClick" (
    "id" TEXT NOT NULL,
    "jobReferralId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clickDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobReferralClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobReferralClick_jobReferralId_idx" ON "JobReferralClick"("jobReferralId");

-- CreateIndex
CREATE UNIQUE INDEX "JobReferralClick_jobReferralId_tenantId_clickDate_key" ON "JobReferralClick"("jobReferralId", "tenantId", "clickDate");

-- CreateIndex
CREATE INDEX "JobReferral_paymentOrderId_idx" ON "JobReferral"("paymentOrderId");

-- AddForeignKey
ALTER TABLE "JobReferralClick" ADD CONSTRAINT "JobReferralClick_jobReferralId_fkey" FOREIGN KEY ("jobReferralId") REFERENCES "JobReferral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobReferralClick" ADD CONSTRAINT "JobReferralClick_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
