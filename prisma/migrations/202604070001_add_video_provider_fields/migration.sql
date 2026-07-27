-- Add flexible lesson video provider fields while keeping legacy videoId.
CREATE TYPE "VideoProvider" AS ENUM ('YOUTUBE', 'CLOUDFLARE');

ALTER TABLE "Lesson"
ADD COLUMN "videoProvider" "VideoProvider",
ADD COLUMN "videoSourceId" TEXT,
ADD COLUMN "videoUrl" TEXT,
ADD COLUMN "videoThumbnail" TEXT;

UPDATE "Lesson"
SET
  "videoProvider" = CASE
    WHEN "videoId" IS NOT NULL THEN 'CLOUDFLARE'::"VideoProvider"
    ELSE NULL
  END,
  "videoSourceId" = COALESCE("videoSourceId", "videoId")
WHERE "videoId" IS NOT NULL;

CREATE INDEX "Lesson_videoProvider_idx" ON "Lesson"("videoProvider");
CREATE INDEX "Lesson_videoSourceId_idx" ON "Lesson"("videoSourceId");
