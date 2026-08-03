-- CreateEnum
CREATE TYPE "UtilityType" AS ENUM ('ELECTRIC', 'WATER', 'GAS', 'TRASH', 'LAWN_SERVICE', 'INTERNET', 'CABLE', 'PARKING');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "amenities" TEXT,
ADD COLUMN     "currentLeaseEndDate" TIMESTAMP(3),
ADD COLUMN     "subleaseAllowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "utilitiesIncluded" "UtilityType"[] DEFAULT ARRAY[]::"UtilityType"[];
