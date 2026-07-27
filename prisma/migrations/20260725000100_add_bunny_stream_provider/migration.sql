-- Add Bunny Stream as a video provider and store its remote video metadata.
ALTER TYPE "VideoProvider" ADD VALUE 'BUNNY';

ALTER TABLE "Media"
ADD COLUMN "bunnyVideoId" TEXT,
ADD COLUMN "bunnyStatus" TEXT;

CREATE UNIQUE INDEX "Media_bunnyVideoId_key" ON "Media"("bunnyVideoId");
