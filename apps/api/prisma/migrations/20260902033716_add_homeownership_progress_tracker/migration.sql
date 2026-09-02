-- CreateTable
CREATE TABLE "HomeownershipMilestone" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeownershipMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeownershipProgress" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "savingsGoalCents" INTEGER,
    "currentSavingsCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeownershipProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeownershipMilestoneCompletion" (
    "id" TEXT NOT NULL,
    "progressId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeownershipMilestoneCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomeownershipProgress_tenantId_key" ON "HomeownershipProgress"("tenantId");

-- CreateIndex
CREATE INDEX "HomeownershipMilestoneCompletion_progressId_idx" ON "HomeownershipMilestoneCompletion"("progressId");

-- CreateIndex
CREATE INDEX "HomeownershipMilestoneCompletion_milestoneId_idx" ON "HomeownershipMilestoneCompletion"("milestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeownershipMilestoneCompletion_progressId_milestoneId_key" ON "HomeownershipMilestoneCompletion"("progressId", "milestoneId");

-- AddForeignKey
ALTER TABLE "HomeownershipProgress" ADD CONSTRAINT "HomeownershipProgress_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeownershipMilestoneCompletion" ADD CONSTRAINT "HomeownershipMilestoneCompletion_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "HomeownershipProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeownershipMilestoneCompletion" ADD CONSTRAINT "HomeownershipMilestoneCompletion_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "HomeownershipMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
