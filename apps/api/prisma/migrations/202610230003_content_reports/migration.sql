-- AlterEnum
ALTER TYPE "AdminActionType" ADD VALUE 'REPORT_RESOLVED';

-- CreateTable
CREATE TABLE "ContentReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentReport_resolvedAt_createdAt_idx" ON "ContentReport"("resolvedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentReport_reporterId_targetType_targetId_key" ON "ContentReport"("reporterId", "targetType", "targetId");

