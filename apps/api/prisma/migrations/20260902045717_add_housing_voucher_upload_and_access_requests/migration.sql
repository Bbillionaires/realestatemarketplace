-- CreateEnum
CREATE TYPE "VoucherAccessStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED');

-- CreateTable
CREATE TABLE "VoucherDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileData" BYTEA NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoucherDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherAccessRequest" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "status" "VoucherAccessStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "VoucherAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoucherDocument_tenantId_key" ON "VoucherDocument"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherAccessRequest_conversationId_key" ON "VoucherAccessRequest"("conversationId");

-- CreateIndex
CREATE INDEX "VoucherAccessRequest_conversationId_idx" ON "VoucherAccessRequest"("conversationId");

-- AddForeignKey
ALTER TABLE "VoucherDocument" ADD CONSTRAINT "VoucherDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherAccessRequest" ADD CONSTRAINT "VoucherAccessRequest_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
