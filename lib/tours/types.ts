// lib/tours/types.ts
// 後台新手教學(Guided Tour)的型別定義
// 每個後台頁面對應一份獨立的 Tour;一個 Tour 由數個 Step 組成。

/** 提示卡相對於目標元素的擺放方位 */
export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center'

export interface TourStep {
  /** 此步驟的唯一識別(同一 Tour 內不重複) */
  id: string
  /**
   * 目標元素的 data-tour 屬性值;以 `[data-tour="<selector>"]` 查找。
   * 留空 = 置中卡片(用於開場白 / 結尾,不做聚光燈)。
   */
  selector?: string
  /** 步驟標題(粗體小標) */
  title?: string
  /** 步驟說明文案(口語、簡短) */
  body: string
  /** 提示卡方位,預設 'bottom';無 selector 時固定置中 */
  placement?: TourPlacement
  /** 聚光燈在目標四周的留白(px),預設 8 */
  padding?: number
}

export interface Tour {
  /** Tour 唯一識別,對應 registry 的 key 與頁面 */
  id: string
  /** 給人看的名稱(目前僅內部 / 除錯用) */
  name: string
  /** 開場白:點問號或自動開始時的第一句總覽(會成為置中的第一張卡) */
  intro?: string
  /** 逐步引導步驟 */
  steps: TourStep[]
  /**
   * 是否允許「首次進入該頁時自動開始」,預設 true。
   * 設為 false 則只能由使用者點問號手動啟動。
   */
  autoStart?: boolean
}
