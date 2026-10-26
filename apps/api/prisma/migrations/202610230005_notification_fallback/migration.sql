ALTER TABLE "Notification" ADD COLUMN "exhaustedAt" TIMESTAMP(3);
ALTER TYPE "NotificationStatus" ADD VALUE 'SKIPPED';
