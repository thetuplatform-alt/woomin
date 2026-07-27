-- Create enums for video watermark settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'WatermarkEmailDisplayMode'
  ) THEN
    CREATE TYPE "WatermarkEmailDisplayMode" AS ENUM ('FULL', 'MASKED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'WatermarkTextSize'
  ) THEN
    CREATE TYPE "WatermarkTextSize" AS ENUM ('SM', 'MD', 'LG');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'WatermarkMovementMode'
  ) THEN
    CREATE TYPE "WatermarkMovementMode" AS ENUM ('STANDARD', 'AGGRESSIVE');
  END IF;
END $$;

-- Create per-course video watermark settings
CREATE TABLE IF NOT EXISTS "CourseVideoWatermarkSetting" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "showEmail" BOOLEAN NOT NULL DEFAULT true,
  "showCourseTitle" BOOLEAN NOT NULL DEFAULT true,
  "showTimestamp" BOOLEAN NOT NULL DEFAULT true,
  "emailDisplayMode" "WatermarkEmailDisplayMode" NOT NULL DEFAULT 'FULL',
  "opacityPercent" INTEGER NOT NULL DEFAULT 18,
  "textSize" "WatermarkTextSize" NOT NULL DEFAULT 'MD',
  "movementMode" "WatermarkMovementMode" NOT NULL DEFAULT 'STANDARD',
  "moveIntervalSec" INTEGER NOT NULL DEFAULT 12,
  "tamperPauseEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CourseVideoWatermarkSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CourseVideoWatermarkSetting_courseId_key" ON "CourseVideoWatermarkSetting"("courseId");
CREATE INDEX IF NOT EXISTS "CourseVideoWatermarkSetting_enabled_idx" ON "CourseVideoWatermarkSetting"("enabled");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CourseVideoWatermarkSetting_courseId_fkey'
  ) THEN
    ALTER TABLE "CourseVideoWatermarkSetting"
    ADD CONSTRAINT "CourseVideoWatermarkSetting_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
