-- CreateEnum
CREATE TYPE "SchoolLevel" AS ENUM ('PRESCHOOL', 'ELEMENTARY', 'MIDDLE', 'HIGH', 'OTHER');

-- CreateEnum
CREATE TYPE "SchoolType" AS ENUM ('PUBLIC', 'PRIVATE', 'CHARTER', 'OTHER');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "schoolsFetchedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "NearbySchool" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "schoolType" "SchoolType" NOT NULL DEFAULT 'OTHER',
    "level" "SchoolLevel" NOT NULL DEFAULT 'OTHER',
    "rating" INTEGER,
    "distanceMiles" DOUBLE PRECISION,
    "address" TEXT,
    "websiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NearbySchool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NearbySchool_propertyId_idx" ON "NearbySchool"("propertyId");

-- CreateIndex
CREATE INDEX "Property_latitude_longitude_idx" ON "Property"("latitude", "longitude");

-- AddForeignKey
ALTER TABLE "NearbySchool" ADD CONSTRAINT "NearbySchool_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
