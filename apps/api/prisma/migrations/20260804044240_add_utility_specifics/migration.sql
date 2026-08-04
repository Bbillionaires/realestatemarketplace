-- CreateEnum
CREATE TYPE "SewerSourceType" AS ENUM ('CITY_SEWER', 'SEPTIC');

-- CreateEnum
CREATE TYPE "WaterSourceType" AS ENUM ('CITY_WATER', 'WELL');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "landlordPaysElectricity" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "landlordPaysWater" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sewerSource" "SewerSourceType",
ADD COLUMN     "waterSource" "WaterSourceType";
