-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "hasHandymanProvider" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasLawnCareProvider" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasPestControlProvider" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasPlumbingProvider" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasRoofingProvider" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requestsPropertyManagementHelp" BOOLEAN NOT NULL DEFAULT false;
