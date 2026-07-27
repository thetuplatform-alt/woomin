// lib/subscription/constants.ts
// 課程訂閱制共用常數（單一事實來源）。

/**
 * 訂閱權限寬限天數。
 * 每期扣款成功 → Purchase.expiresAt = currentPeriodEnd + SUBSCRIPTION_GRACE_DAYS 天。
 * 對用戶顯示的「可觀看至」一律用含寬限的實際 expiresAt。
 */
export const SUBSCRIPTION_GRACE_DAYS = 7

/**
 * 當下顯示給用戶的「定期扣款條款 / 取消政策」版本代碼。
 * 締約時連同 consentAt 存進 CourseSubscription，構成 chargeback / 消保舉證的證據鏈。
 * 條款文案有實質變動時遞增版本（如 v2-YYYY-MM）。
 */
export const SUBSCRIPTION_CONSENT_TEXT_VERSION = 'v1-2026-07'

/**
 * PENDING 訂閱復用視窗（分鐘）。
 * 同 user+course+plan 在此視窗內的 PENDING 訂閱＋第 1 期 Order 可復用（比照既有訂單復用）。
 */
export const SUBSCRIPTION_PENDING_REUSE_MINUTES = 30

/**
 * stale PENDING 訂閱由 maintenance tick 批次作廢的門檻（小時）。
 * 超過此時數仍未開通的 PENDING 一律轉 CANCELED('checkout_abandoned')。
 */
export const SUBSCRIPTION_PENDING_STALE_HOURS = 24

/**
 * PAYUNi 續期收款「無限訂閱」的期數上限近似值（技術上限 900）。
 * 月扣 = 75 年，實務上等同無限；結帳頁政策文案須揭露此為系統技術上限。
 */
export const PAYUNI_UNLIMITED_PERIOD_TIMES = 900

/**
 * 訂閱排程心跳的 SiteSetting key。
 * maintenance tick 每次執行 upsert 此時間戳，後台據此顯示「排程未運作」告警（逾 48h）。
 */
export const SUBSCRIPTION_HEARTBEAT_SETTING_KEY =
  'subscription_last_cron_heartbeat_at'

/**
 * 後台判定訂閱排程失聯的門檻（小時）。
 */
export const SUBSCRIPTION_HEARTBEAT_STALE_HOURS = 48

/**
 * gatewayTradeNo（PAYUNi MerTradeNo）前綴，總長須 ≤25 碼。
 * 格式：SUB + YYYYMMDD + 12 hex = 3 + 8 + 12 = 23 碼。
 */
export const SUBSCRIPTION_TRADE_NO_PREFIX = 'SUB'
