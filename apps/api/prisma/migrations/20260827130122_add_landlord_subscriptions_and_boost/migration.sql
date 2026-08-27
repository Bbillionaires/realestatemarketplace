-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO', 'UNLIMITED');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "boostCheckoutUrl" TEXT,
ADD COLUMN     "boostPaymentOrderId" TEXT,
ADD COLUMN     "boostPaymentProviderCheckoutId" TEXT,
ADD COLUMN     "boostedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LandlordSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "expiresAt" TIMESTAMP(3),
    "pendingTier" "SubscriptionTier",
    "paymentProviderCheckoutId" TEXT,
    "paymentOrderId" TEXT,
    "checkoutUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandlordSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LandlordSubscription_userId_key" ON "LandlordSubscription"("userId");

-- CreateIndex
CREATE INDEX "LandlordSubscription_paymentOrderId_idx" ON "LandlordSubscription"("paymentOrderId");

-- CreateIndex
CREATE INDEX "Property_boostPaymentOrderId_idx" ON "Property"("boostPaymentOrderId");

-- AddForeignKey
ALTER TABLE "LandlordSubscription" ADD CONSTRAINT "LandlordSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
