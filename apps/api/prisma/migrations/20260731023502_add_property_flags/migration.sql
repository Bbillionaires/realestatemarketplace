-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "leaseToOwnAvailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rentToOwnAvailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sellerFinancingAvailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sellingSoon" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sellingSoonNote" TEXT,
ADD COLUMN     "tenantSwapAllowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "workForRentAvailable" BOOLEAN NOT NULL DEFAULT false;
