// lib/auth-error-log-throttle.ts
// 為 Auth.js 診斷 log 加上簡單的固定窗口節流，in-memory、單一 process，不需要 Redis
// 或跨 instance 同步（這台是 2 核心單機部署）。
//
// 背景：Auth.js 的 logger.error 是全域 catch-all，credentials provider 的
// authorize() 在帳號不存在、密碼錯誤、甚至已經被 checkLoginSecurity rate-limit
// 擋下時都會流進這個 hook。/api/auth/callback/credentials 是未登入即可打的公開
// 端點，攻擊者可以直接控制觸發頻率，沒有節流的話可能被暴力破解 / 掃描器拿來當
// log 放大器（造成 log 量暴增或 log 成本被攻擊者行為牽著走）。

const WINDOW_MS = 10_000 // 每 10 秒一個固定窗口
const MAX_LOGS_PER_WINDOW = 20 // 每個窗口最多真正輸出 20 筆診斷 log

let windowStart = 0
let countInWindow = 0
let skippedInWindow = 0

/**
 * 節流版的診斷 log 呼叫器。
 * 窗口內門檻以內的呼叫會照常執行 emit()；超過門檻的呼叫不會真正輸出，只累加
 * 跳過計數；下一個窗口開始時，會先補印一筆「上一個窗口共跳過幾筆」的摘要 log。
 *
 * @param emit 真正要輸出 log 的 callback（副作用隔離，方便測試用 jest.fn() 注入）
 * @param now 目前時間戳（毫秒），預設 Date.now()；測試可注入固定時間避免時間相關的 flaky test
 */
export function throttledAuthErrorLog(emit: () => void, now: number = Date.now()): void {
  if (now - windowStart >= WINDOW_MS) {
    if (skippedInWindow > 0) {
      console.error(`[auth][diagnostic] 節流摘要：上一個窗口共跳過 ${skippedInWindow} 筆診斷 log`)
    }
    windowStart = now
    countInWindow = 0
    skippedInWindow = 0
  }

  countInWindow += 1

  if (countInWindow > MAX_LOGS_PER_WINDOW) {
    skippedInWindow += 1
    return
  }

  emit()
}

/** 測試專用：重置模組內部的節流狀態，避免測試之間互相汙染。正式程式碼不應呼叫。 */
export function __resetThrottleStateForTests(): void {
  windowStart = 0
  countInWindow = 0
  skippedInWindow = 0
}
