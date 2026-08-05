// lib/auth-error-fingerprint.ts
// 為 Auth.js 診斷 log 產生穩定、有鑑別力、且絕對不會拋出例外的錯誤指紋。
//
// 背景：這個函式是在 Auth.js 內部沒有外層 try/catch 保護的 catch 區塊裡被呼叫
// （@auth/core 的 session() action 用 catch(e) { logger.error(new JWTSessionError(e)) }
// 這種模式），一旦這裡 throw，會讓原本「JWT 錯誤時靜默清 cookie、優雅降級」變成
// 未攔截例外，比原本要修的 bug 更嚴重——所以任何輸入都不能讓它 throw。
//
// 同時它要有實際鑑別力：Auth.js 的 JWTSessionError / SessionTokenError 這類
// AuthError 子類別，error.message 對所有實例都是同一句固定文案，真正的差異藏在
// error.cause（通常是 { err: <原始 Error 實例> }）裡。對整個 cause 物件用
// JSON.stringify 會因為 Error 的 message/name/stack 是不可列舉屬性而序列化成 "{}"，
// 完全沒有鑑別力，所以改成手動、安全地萃取關鍵欄位。

import { createHash } from 'node:crypto'

// 限制遞迴深度，避免非循環但極深的物件圖（例如 1000 層巢狀）造成 stack overflow
const MAX_DEPTH = 4
// 物件屬性 / 陣列元素數量上限，避免超大物件拖慢序列化或撐爆雜湊輸入
const MAX_ENTRIES = 20

/**
 * 安全地把任意值轉成一段可雜湊、有鑑別力的文字。
 * - 用 WeakSet 追蹤「目前這條路徑上」已經走過的物件，偵測循環參照時回傳 '[circular]'
 *   而不是無限遞迴或讓 JSON.stringify 丟 TypeError
 * - Error 物件特別處理，手動取 name / message（而不是對它整個做 JSON.stringify）
 * - 任何一步驟出錯（例如某個 getter 存取就拋例外）都要有 fallback，不能讓例外冒出去
 */
function safeSerialize(value: unknown, seen: WeakSet<object>, depth: number): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'

  const valueType = typeof value
  if (valueType === 'string') return JSON.stringify(value)
  if (valueType === 'number' || valueType === 'boolean' || valueType === 'bigint') {
    return String(value)
  }
  if (valueType === 'function') {
    return `[function ${(value as { name?: string }).name || 'anonymous'}]`
  }
  if (valueType !== 'object') return String(value)

  const obj = value as object

  if (seen.has(obj)) return '[circular]'
  if (depth >= MAX_DEPTH) return '[max-depth]'

  seen.add(obj)

  try {
    if (value instanceof Error) {
      const hasCause = 'cause' in value
      const causeText = hasCause
        ? safeSerialize((value as Error & { cause?: unknown }).cause, seen, depth + 1)
        : 'undefined'
      return `Error(${value.name}:${value.message}:cause=${causeText})`
    }

    if (Array.isArray(value)) {
      const items = value
        .slice(0, MAX_ENTRIES)
        .map((item) => safeSerialize(item, seen, depth + 1))
      return `[${items.join(',')}]`
    }

    // 一般物件：只取自身可列舉屬性，排序 key 確保輸出穩定（同內容一定同 fingerprint）
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, MAX_ENTRIES)
      .map(([key, val]) => `${key}=${safeSerialize(val, seen, depth + 1)}`)
    return `{${entries.join(',')}}`
  } catch {
    // 例如某個屬性是會 throw 的 getter，序列化失敗就退回一個標記字串，不讓例外冒出去
    return '[unserializable]'
  } finally {
    // 離開這條路徑後移除，避免非循環但重複出現在不同分支的物件被誤判成循環
    seen.delete(obj)
  }
}

/**
 * 為 Auth.js 診斷 log 產生一個不含 secret、但能區分不同底層原因的錯誤指紋。
 * 任何輸入（循環參照、超大物件、undefined、非 Error 物件）都保證不會 throw。
 */
export function authErrorFingerprint(error: unknown): string {
  try {
    const err = error instanceof Error ? error : new Error(String(error))
    const hasCause = 'cause' in err
    const causeText = hasCause
      ? safeSerialize((err as Error & { cause?: unknown }).cause, new WeakSet(), 0)
      : 'undefined'
    const input = `${err.name}:${err.message}:${causeText}`

    return createHash('sha256').update(input).digest('hex').slice(0, 16)
  } catch {
    // 最終防線：序列化或雜湊過程本身出錯時，退回一個固定 fallback fingerprint，
    // 絕不能讓這個函式把例外丟給呼叫端（見檔案開頭的說明）。
    try {
      return createHash('sha256').update('auth-error-fingerprint-fallback').digest('hex').slice(0, 16)
    } catch {
      return '0000000000000000'
    }
  }
}
