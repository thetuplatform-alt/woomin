-- Add per-course Meta Pixel / CAPI fields
-- 純加欄位，不影響任何現有資料
ALTER TABLE "Course"
  ADD COLUMN "metaPixelId" TEXT,
  ADD COLUMN "metaCapiAccessToken" TEXT;
