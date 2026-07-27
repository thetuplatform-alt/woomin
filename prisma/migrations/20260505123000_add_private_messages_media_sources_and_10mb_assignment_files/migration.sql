-- Add private teacher messages, media source tracking, and lower student file uploads to 10MB.

CREATE TYPE "MediaSourceType" AS ENUM (
  'MANUAL',
  'LESSON_CONTENT',
  'ASSIGNMENT',
  'COMMENT',
  'PRIVATE_MESSAGE',
  'CLOUDFLARE_SYNC'
);

ALTER TABLE "Media"
ADD COLUMN "sourceType" "MediaSourceType" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "sourceId" TEXT,
ADD COLUMN "sourceLabel" TEXT,
ADD COLUMN "sourceUrl" TEXT;

CREATE INDEX "Media_sourceType_idx" ON "Media"("sourceType");
CREATE INDEX "Media_sourceId_idx" ON "Media"("sourceId");

-- Some existing installations may already contain duplicated Cloudflare Stream
-- media rows from previous broken sync attempts. Keep the newest row before
-- adding the unique index so the migration can complete cleanly.
DELETE FROM "Media" older
USING "Media" newer
WHERE older."cfStreamId" IS NOT NULL
  AND older."cfStreamId" = newer."cfStreamId"
  AND older."id" <> newer."id"
  AND (
    older."createdAt" < newer."createdAt"
    OR (older."createdAt" = newer."createdAt" AND older."id" < newer."id")
  );

CREATE UNIQUE INDEX "Media_cfStreamId_key" ON "Media"("cfStreamId");

CREATE TABLE "LessonPrivateMessage" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "isFromTeacher" BOOLEAN NOT NULL DEFAULT false,
  "readByTeacher" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LessonPrivateMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LessonPrivateMessage_lessonId_userId_createdAt_idx"
ON "LessonPrivateMessage"("lessonId", "userId", "createdAt");

CREATE INDEX "LessonPrivateMessage_readByTeacher_createdAt_idx"
ON "LessonPrivateMessage"("readByTeacher", "createdAt");

ALTER TABLE "LessonPrivateMessage"
ADD CONSTRAINT "LessonPrivateMessage_lessonId_fkey"
FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LessonPrivateMessage"
ADD CONSTRAINT "LessonPrivateMessage_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Assignment" ALTER COLUMN "maxFileSize" SET DEFAULT 10485760;
