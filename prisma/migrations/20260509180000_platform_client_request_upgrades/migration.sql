-- Platform client request upgrades:
-- course sales visibility, course invites, bundles, bundle-backed purchases,
-- gateway payment instructions, and PDF media security settings.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CourseVisibility') THEN
    CREATE TYPE "CourseVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'INVITE_ONLY');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BundleStatus') THEN
    CREATE TYPE "BundleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
  END IF;
END $$;

ALTER TYPE "PurchaseSource" ADD VALUE IF NOT EXISTS 'BUNDLE' AFTER 'PAID';

ALTER TABLE "Course"
ADD COLUMN IF NOT EXISTS "salesVisibility" "CourseVisibility" NOT NULL DEFAULT 'PUBLIC';

-- Preserve existing unlisted-course behavior while keeping the new column safe
-- for installations that only have published/draft courses.
UPDATE "Course"
SET "salesVisibility" = 'UNLISTED'
WHERE "status" = 'UNLISTED';

CREATE INDEX IF NOT EXISTS "Course_salesVisibility_idx"
ON "Course"("salesVisibility");

CREATE INDEX IF NOT EXISTS "Course_status_salesVisibility_idx"
ON "Course"("status", "salesVisibility");

CREATE TABLE IF NOT EXISTS "CourseInvite" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "email" TEXT,
  "maxUses" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CourseInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CourseInvite_tokenHash_key"
ON "CourseInvite"("tokenHash");

CREATE INDEX IF NOT EXISTS "CourseInvite_courseId_idx"
ON "CourseInvite"("courseId");

CREATE INDEX IF NOT EXISTS "CourseInvite_email_idx"
ON "CourseInvite"("email");

CREATE INDEX IF NOT EXISTS "CourseInvite_active_expiresAt_idx"
ON "CourseInvite"("active", "expiresAt");

CREATE INDEX IF NOT EXISTS "CourseInvite_createdBy_idx"
ON "CourseInvite"("createdBy");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CourseInvite_courseId_fkey'
  ) THEN
    ALTER TABLE "CourseInvite"
    ADD CONSTRAINT "CourseInvite_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Bundle" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "coverImage" TEXT,
  "price" INTEGER NOT NULL DEFAULT 0,
  "salePrice" INTEGER,
  "status" "BundleStatus" NOT NULL DEFAULT 'DRAFT',
  "visibility" "CourseVisibility" NOT NULL DEFAULT 'PUBLIC',
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Bundle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Bundle_slug_key"
ON "Bundle"("slug");

CREATE INDEX IF NOT EXISTS "Bundle_status_visibility_idx"
ON "Bundle"("status", "visibility");

CREATE INDEX IF NOT EXISTS "Bundle_createdBy_idx"
ON "Bundle"("createdBy");

CREATE TABLE IF NOT EXISTS "BundleCourse" (
  "id" TEXT NOT NULL,
  "bundleId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BundleCourse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BundleCourse_bundleId_courseId_key"
ON "BundleCourse"("bundleId", "courseId");

CREATE INDEX IF NOT EXISTS "BundleCourse_bundleId_order_idx"
ON "BundleCourse"("bundleId", "order");

CREATE INDEX IF NOT EXISTS "BundleCourse_courseId_idx"
ON "BundleCourse"("courseId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BundleCourse_bundleId_fkey'
  ) THEN
    ALTER TABLE "BundleCourse"
    ADD CONSTRAINT "BundleCourse_bundleId_fkey"
    FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BundleCourse_courseId_fkey'
  ) THEN
    ALTER TABLE "BundleCourse"
    ADD CONSTRAINT "BundleCourse_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Order"
ALTER COLUMN "courseId" DROP NOT NULL,
ADD COLUMN IF NOT EXISTS "bundleId" TEXT,
ADD COLUMN IF NOT EXISTS "gatewayPaymentInstructions" JSONB,
ADD COLUMN IF NOT EXISTS "gatewayPaymentExpiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Order_bundleId_idx"
ON "Order"("bundleId");

CREATE INDEX IF NOT EXISTS "Order_gatewayPaymentExpiresAt_idx"
ON "Order"("gatewayPaymentExpiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Order_bundleId_fkey'
  ) THEN
    ALTER TABLE "Order"
    ADD CONSTRAINT "Order_bundleId_fkey"
    FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Order_course_or_bundle_check'
  ) THEN
    ALTER TABLE "Order"
    ADD CONSTRAINT "Order_course_or_bundle_check"
    CHECK (
      ("courseId" IS NOT NULL AND "bundleId" IS NULL)
      OR ("courseId" IS NULL AND "bundleId" IS NOT NULL)
    );
  END IF;
END $$;

ALTER TABLE "Purchase"
ADD COLUMN IF NOT EXISTS "bundleId" TEXT;

CREATE INDEX IF NOT EXISTS "Purchase_bundleId_idx"
ON "Purchase"("bundleId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Purchase_bundleId_fkey'
  ) THEN
    ALTER TABLE "Purchase"
    ADD CONSTRAINT "Purchase_bundleId_fkey"
    FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Media"
ADD COLUMN IF NOT EXISTS "allowDownload" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "dynamicWatermarkEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "watermarkConfig" JSONB;

CREATE INDEX IF NOT EXISTS "Media_dynamicWatermarkEnabled_idx"
ON "Media"("dynamicWatermarkEnabled");
