// lib/purchase/is-active.ts
// 課程存取權「是否有效」的單一事實來源。
//
// 過去這條判斷式（未撤銷 && (永久 || 未過期)）散落在十餘處各自手寫，
// 訂閱制上線後語意收斂到此 helper，所有呼叫點一律改用，避免漏改造成落穿。

/** 判斷購買/授權有效性所需的最小欄位 */
export interface PurchaseActivityFields {
  revokedAt: Date | null
  expiresAt: Date | null
}

/**
 * 判斷一筆 Purchase 是否有效（可存取課程）。
 * - 未撤銷（revokedAt 為 null）
 * - 且 永久（expiresAt 為 null）或 尚未過期（expiresAt > now）
 *
 * @param purchase Purchase（或含 revokedAt / expiresAt 的物件）；null / undefined 一律視為無效
 * @param now 判斷基準時間，預設當下（測試可注入）
 */
export function isPurchaseActive(
  purchase: PurchaseActivityFields | null | undefined,
  now: Date = new Date()
): boolean {
  if (!purchase) return false
  if (purchase.revokedAt !== null) return false
  if (purchase.expiresAt && purchase.expiresAt.getTime() <= now.getTime()) {
    return false
  }
  return true
}
