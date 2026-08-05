-- CreateEnum
CREATE TYPE "JobReferralStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "JobReferral" (
    "id" TEXT NOT NULL,
    "posterId" TEXT NOT NULL,
    "posterRole" "Role" NOT NULL,
    "title" TEXT NOT NULL,
    "employerName" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "applyUrl" TEXT,
    "contactInfo" TEXT,
    "description" TEXT,
    "status" "JobReferralStatus" NOT NULL DEFAULT 'ACTIVE',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobReferral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobReferral_posterId_idx" ON "JobReferral"("posterId");

-- CreateIndex
CREATE INDEX "JobReferral_status_idx" ON "JobReferral"("status");

-- AddForeignKey
ALTER TABLE "JobReferral" ADD CONSTRAINT "JobReferral_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
