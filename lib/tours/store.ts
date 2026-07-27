// lib/tours/store.ts
// 新手教學的「看過 / 完成」狀態儲存層。
//
// 設計:對外暴露一個 TourStore 介面,預設用 localStorage 實作(零後端成本、
// 跨客戶部署最簡單)。未來若要跨裝置同步,只需新增一個 DB-backed 的 adapter
// 替換 `tourStore` 單例,元件層完全不用改。
//
// 語義(對應設計文件):
// - seen:該頁教學「自動跳出過」或「使用者手動開過」即記為 seen → 之後不再【主動】跳。
// - completed:走完或按「完成」。completed 一定也是 seen。
// - 略過 / ESC / 關閉:仍記為 seen(本次已主動顯示過),但不算 completed。
// - 問號永遠可手動重看,不受 seen / completed 影響。

const STORAGE_KEY = 'realms.onboarding.tour.v1'

interface TourSeenRecord {
  firstSeenAt: number
  completedAt?: number
  /** 被開啟過幾次(自動 + 手動) */
  count: number
}

interface TourStateData {
  version: 1
  seen: Record<string, TourSeenRecord>
  /** 問號旁的常駐引導 tooltip 是否已顯示過 */
  helpHintSeen: boolean
}

export interface TourStore {
  /** 是否「尚未主動顯示過」→ 可以自動跳出 */
  isAutoEligible(tourId: string): boolean
  isCompleted(tourId: string): boolean
  /** 記為已主動顯示過(自動或手動開啟時呼叫) */
  markSeen(tourId: string): void
  /** 記為已完成 */
  markCompleted(tourId: string): void
  isHelpHintSeen(): boolean
  markHelpHintSeen(): void
  /** 還原(除錯 / 設定頁「重看所有教學」用) */
  reset(): void
}

function now(): number {
  return Date.now()
}

function emptyState(): TourStateData {
  return { version: 1, seen: {}, helpHintSeen: false }
}

let memoryState: TourStateData = emptyState()

function read(): TourStateData {
  if (typeof window === 'undefined') return memoryState
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return memoryState
    const parsed = JSON.parse(raw) as Partial<TourStateData>
    if (!parsed || parsed.version !== 1) return memoryState
    memoryState = {
      version: 1,
      seen: parsed.seen ?? {},
      helpHintSeen: parsed.helpHintSeen ?? false,
    }
    return memoryState
  } catch {
    // localStorage 不可用(隱私模式 / 容量滿 / JSON 壞)→ 降級為本次 session 記憶,避免同頁重複自動跳出
    return memoryState
  }
}

function write(state: TourStateData): void {
  memoryState = state
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 寫入失敗就放棄持久化,不影響教學本身運作
  }
}

/** 預設的 localStorage 實作 */
const localTourStore: TourStore = {
  isAutoEligible(tourId) {
    const s = read()
    return !s.seen[tourId]
  },
  isCompleted(tourId) {
    const s = read()
    return Boolean(s.seen[tourId]?.completedAt)
  },
  markSeen(tourId) {
    const s = read()
    const existing = s.seen[tourId]
    s.seen[tourId] = existing
      ? { ...existing, count: existing.count + 1 }
      : { firstSeenAt: now(), count: 1 }
    write(s)
  },
  markCompleted(tourId) {
    const s = read()
    const existing = s.seen[tourId]
    s.seen[tourId] = existing
      ? { ...existing, completedAt: now() }
      : { firstSeenAt: now(), completedAt: now(), count: 1 }
    write(s)
  },
  isHelpHintSeen() {
    return read().helpHintSeen
  },
  markHelpHintSeen() {
    const s = read()
    s.helpHintSeen = true
    write(s)
  },
  reset() {
    write(emptyState())
  },
}

/** 對外單例;未來要換 DB 同步只需替換這一行的指派來源 */
export const tourStore: TourStore = localTourStore
