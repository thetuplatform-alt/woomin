-- 效能索引：消除後台營收/訂單/學員/DAU 等熱查詢的全表掃描（Seq Scan）
-- 使用 IF NOT EXISTS：相容已手動加過索引的客戶 DB（買斷產品多部署）
--
-- 註：此處用一般 CREATE INDEX（非 CONCURRENTLY），因 Prisma migrate 於交易內執行，
--     CONCURRENTLY 無法在交易中運行。多數站資料量小、建索引的短暫鎖可忽略；
--     若為高銷量大站（Order/WatchTimeLog 數十萬列以上），建議改為手動於離峰時段執行：
--       CREATE INDEX CONCURRENTLY ...（不可包在交易內）。

-- Order：全站營收/本月/趨勢/Top 課程聚合皆以 status='PAID' + paidAt 範圍過濾
CREATE INDEX IF NOT EXISTS "Order_status_paidAt_idx" ON "Order"("status", "paidAt");

-- Order：訂單列表 orderBy createdAt desc 分頁
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt");

-- Order：單一課程銷售分析（同時可覆蓋僅依 courseId 的查詢）
CREATE INDEX IF NOT EXISTS "Order_courseId_status_paidAt_idx" ON "Order"("courseId", "status", "paidAt");

-- User：學員列表 / 用戶成長趨勢以 role 過濾 + createdAt 範圍/排序
CREATE INDEX IF NOT EXISTS "User_role_createdAt_idx" ON "User"("role", "createdAt");

-- WatchTimeLog：DAU / 每日學習人數以 createdAt 範圍過濾 + COUNT(DISTINCT userId)
-- createdAt 為前導欄（Postgres 無 skip-scan，既有 userId 開頭索引無法服務此查詢）
CREATE INDEX IF NOT EXISTS "WatchTimeLog_createdAt_userId_idx" ON "WatchTimeLog"("createdAt", "userId");
