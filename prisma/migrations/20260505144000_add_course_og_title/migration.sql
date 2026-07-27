-- Allow course pages to override their Open Graph share title.
ALTER TABLE "Course"
ADD COLUMN IF NOT EXISTS "ogTitle" TEXT;
