-- Reconcile schema objects that historically existed in production through db push
-- but were never represented by a committed migration. Keep every operation
-- idempotent so existing installations can record the migration without data loss,
-- while fresh installations receive the complete Prisma schema.

DO $$
BEGIN
  CREATE TYPE "InquiryStatus" AS ENUM ('PENDING', 'REPLIED', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "InquiryStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "InquiryStatus" ADD VALUE IF NOT EXISTS 'REPLIED';
ALTER TYPE "InquiryStatus" ADD VALUE IF NOT EXISTS 'CLOSED';

ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "aiChatExtra" TEXT,
  ADD COLUMN IF NOT EXISTS "aiChatFaq" JSONB;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'TWD',
  ADD COLUMN IF NOT EXISTS "fbc" TEXT,
  ADD COLUMN IF NOT EXISTS "fbp" TEXT;

CREATE TABLE IF NOT EXISTS "SalesChat" (
  "id" TEXT NOT NULL,
  "courseId" TEXT,
  "courseSlug" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "messages" JSONB NOT NULL,
  "userEmail" TEXT,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesChat_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SalesInquiry" (
  "id" TEXT NOT NULL,
  "courseId" TEXT,
  "courseSlug" TEXT NOT NULL,
  "name" TEXT,
  "email" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "adminReply" TEXT,
  "repliedAt" TIMESTAMP(3),
  "repliedBy" TEXT,
  "status" "InquiryStatus" NOT NULL DEFAULT 'PENDING',
  "notifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesInquiry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SalesChat_courseSlug_createdAt_idx"
  ON "SalesChat"("courseSlug", "createdAt");
CREATE INDEX IF NOT EXISTS "SalesChat_sessionId_idx"
  ON "SalesChat"("sessionId");
CREATE INDEX IF NOT EXISTS "SalesChat_createdAt_idx"
  ON "SalesChat"("createdAt");

CREATE INDEX IF NOT EXISTS "SalesInquiry_courseSlug_createdAt_idx"
  ON "SalesInquiry"("courseSlug", "createdAt");
CREATE INDEX IF NOT EXISTS "SalesInquiry_status_createdAt_idx"
  ON "SalesInquiry"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "SalesInquiry_email_createdAt_idx"
  ON "SalesInquiry"("email", "createdAt");
CREATE INDEX IF NOT EXISTS "SalesInquiry_createdAt_idx"
  ON "SalesInquiry"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SalesChat_courseId_fkey'
      AND conrelid = '"SalesChat"'::regclass
  ) THEN
    ALTER TABLE "SalesChat"
      ADD CONSTRAINT "SalesChat_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "Course"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SalesInquiry_courseId_fkey'
      AND conrelid = '"SalesInquiry"'::regclass
  ) THEN
    ALTER TABLE "SalesInquiry"
      ADD CONSTRAINT "SalesInquiry_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "Course"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
