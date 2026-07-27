-- Add course purchase plans, VIP access tracking, Ghost grant logs,
-- and per-plan course welcome emails.

CREATE TYPE "PurchaseAccessLevel" AS ENUM ('BASIC', 'VIP');
CREATE TYPE "GhostGrantStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED');

CREATE TABLE "CoursePlan" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "originalPrice" INTEGER NOT NULL,
    "description" TEXT,
    "lineItems" JSONB,
    "stripeProductId" TEXT,
    "stripePriceId" TEXT,
    "accessLevel" "PurchaseAccessLevel" NOT NULL DEFAULT 'BASIC',
    "ghostGrantMonths" INTEGER,
    "ghostTierId" TEXT,
    "maxSlots" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoursePlan_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order"
    ADD COLUMN "planId" TEXT,
    ADD COLUMN "planSlug" TEXT NOT NULL DEFAULT 'basic',
    ADD COLUMN "planName" TEXT,
    ADD COLUMN "planLineItems" JSONB;

ALTER TABLE "Purchase"
    ADD COLUMN "accessLevel" "PurchaseAccessLevel" NOT NULL DEFAULT 'BASIC',
    ADD COLUMN "vipGrantedAt" TIMESTAMP(3),
    ADD COLUMN "vipExpiresAt" TIMESTAMP(3);

ALTER TABLE "CourseWelcomeEmail"
    ADD COLUMN "planSlug" TEXT NOT NULL DEFAULT 'basic';

ALTER TABLE "EmailDeliveryLog"
    ADD COLUMN "planSlug" TEXT;

CREATE TABLE "GhostGrantLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "planSlug" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "GhostGrantStatus" NOT NULL DEFAULT 'PENDING',
    "ghostMemberId" TEXT,
    "ghostTierId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "grantedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GhostGrantLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoursePlan_courseId_slug_key" ON "CoursePlan"("courseId", "slug");
CREATE INDEX "CoursePlan_courseId_active_idx" ON "CoursePlan"("courseId", "active");
CREATE INDEX "CoursePlan_slug_idx" ON "CoursePlan"("slug");

DROP INDEX IF EXISTS "CourseWelcomeEmail_courseId_key";
CREATE UNIQUE INDEX "CourseWelcomeEmail_courseId_planSlug_key" ON "CourseWelcomeEmail"("courseId", "planSlug");
CREATE INDEX "CourseWelcomeEmail_planSlug_idx" ON "CourseWelcomeEmail"("planSlug");

CREATE INDEX "Purchase_accessLevel_idx" ON "Purchase"("accessLevel");
CREATE INDEX "EmailDeliveryLog_planSlug_createdAt_idx" ON "EmailDeliveryLog"("planSlug", "createdAt");

CREATE UNIQUE INDEX "GhostGrantLog_orderId_key" ON "GhostGrantLog"("orderId");
CREATE INDEX "GhostGrantLog_status_createdAt_idx" ON "GhostGrantLog"("status", "createdAt");
CREATE INDEX "GhostGrantLog_email_idx" ON "GhostGrantLog"("email");
CREATE INDEX "GhostGrantLog_courseId_planSlug_idx" ON "GhostGrantLog"("courseId", "planSlug");

ALTER TABLE "CoursePlan" ADD CONSTRAINT "CoursePlan_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
