-- CreateEnum
CREATE TYPE "IdSubmissionStatus" AS ENUM ('AWAITING_PAYMENT', 'PAID', 'SUBMITTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "IdSubmission" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "feeCents" INTEGER NOT NULL DEFAULT 500,
    "status" "IdSubmissionStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "paymentProviderCheckoutId" TEXT,
    "paymentOrderId" TEXT,
    "checkoutUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "submittedFileName" TEXT,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdSubmission_conversationId_idx" ON "IdSubmission"("conversationId");

-- CreateIndex
CREATE INDEX "IdSubmission_paymentOrderId_idx" ON "IdSubmission"("paymentOrderId");

-- AddForeignKey
ALTER TABLE "IdSubmission" ADD CONSTRAINT "IdSubmission_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
