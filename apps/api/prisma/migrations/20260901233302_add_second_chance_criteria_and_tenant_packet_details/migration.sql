-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "brokenLeaseOk" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cosignerAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "evictionAgeToleranceYears" INTEGER,
ADD COLUMN     "noCreditCheckIncomeOnly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TenantPacket" ADD COLUMN     "employerName" TEXT,
ADD COLUMN     "monthlyIncomeCents" INTEGER;

-- CreateTable
CREATE TABLE "TenantPacketReference" (
    "id" TEXT NOT NULL,
    "tenantPacketId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "relationship" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantPacketReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantPacketReference_tenantPacketId_idx" ON "TenantPacketReference"("tenantPacketId");

-- AddForeignKey
ALTER TABLE "TenantPacketReference" ADD CONSTRAINT "TenantPacketReference_tenantPacketId_fkey" FOREIGN KEY ("tenantPacketId") REFERENCES "TenantPacket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
