-- 修正既有 migration 與 Prisma 7 schema 之間的漂移（drift）。
-- 此為純結構對齊、非功能性變更：使「全新套用全部 migration」後的資料庫
-- 與目前的 prisma/schema.prisma 完全一致。對既有資料無破壞性影響。
--
-- ⚠️ 冪等性（買斷產品多客戶部署必備）：
--    本檔所有語句皆為條件式（DROP ... IF EXISTS / 先判斷再 ADD），因此無論資料庫是由
--    「逐一套用 migration」建立（會殘留 init 的舊索引、舊版 join table 格式），或是由
--    `prisma db push` 直接建立（schema 即終態、本來就沒有那些殘留物），單次或重複執行
--    都安全、結果一致。多數既有客戶的資料庫是以 db push 建立、且沒有 migration 歷史，
--    若此處用無條件 DROP INDEX，會在升級時報「index does not exist」而導致整個部署失敗。

-- 1) 移除 init migration 殘留的多餘非唯一索引。
--    cfStreamId 已於 20260505123000 改為 @unique（建立了 Media_cfStreamId_key），
--    此 Media_cfStreamId_idx 為遺留的重複索引，schema 並未宣告。
--    （db push 建立的資料庫從未有此殘留索引，故以 IF EXISTS 確保不報錯。）
DROP INDEX IF EXISTS "Media_cfStreamId_idx";

-- 2) 隱式多對多 join table _CouponBundles 改用複合主鍵，對齊 Prisma 7 格式
--    （與 _CouponCourses 一致；20260510100000 當時以舊版 _AB_unique 格式建立）。
--    既有資料的唯一性原本即由 _AB_unique 保證，轉為主鍵不會遺失資料。
--    （db push 建立的資料庫已經是 _AB_pkey 格式，故先判斷是否已存在，避免重複建立而報錯。）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = '_CouponBundles_AB_pkey'
  ) THEN
    ALTER TABLE "_CouponBundles" ADD CONSTRAINT "_CouponBundles_AB_pkey" PRIMARY KEY ("A", "B");
  END IF;
END $$;

DROP INDEX IF EXISTS "_CouponBundles_AB_unique";
