-- Add optional attachment metadata for one-to-one lesson private messages.
ALTER TABLE "LessonPrivateMessage"
ADD COLUMN IF NOT EXISTS "attachmentMediaId" TEXT,
ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT,
ADD COLUMN IF NOT EXISTS "attachmentName" TEXT,
ADD COLUMN IF NOT EXISTS "attachmentMimeType" TEXT,
ADD COLUMN IF NOT EXISTS "attachmentSize" INTEGER;
