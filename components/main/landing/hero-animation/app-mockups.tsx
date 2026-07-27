// components/main/landing/hero-animation/app-mockups.tsx
// 6 種 App 的 UI Mockup 組件
// 這些是高質量的視覺呈現，包含依序淡入的動畫效果

'use client'

// 從獨立檔案匯入各個 App 元件
export { StockTrackerApp } from './app-mockups/stock-tracker-app'
export { InventoryApp } from './app-mockups/inventory-app'
export { ProjectBoardApp } from './app-mockups/project-board-app'
export { KnowledgeHubApp } from './app-mockups/knowledge-hub-app'
export { CafeMapApp } from './app-mockups/cafe-map-app'
export { HealthTrackerApp } from './app-mockups/health-tracker-app'

// 重新匯入以供 APP_SHOWCASES 使用
import { StockTrackerApp } from './app-mockups/stock-tracker-app'
import { InventoryApp } from './app-mockups/inventory-app'
import { ProjectBoardApp } from './app-mockups/project-board-app'
import { KnowledgeHubApp } from './app-mockups/knowledge-hub-app'
import { CafeMapApp } from './app-mockups/cafe-map-app'
import { HealthTrackerApp } from './app-mockups/health-tracker-app'

// App 配置資料
export const APP_SHOWCASES = [
  {
    id: 'inventory',
    name: '家庭庫存',
    category: '居家管理',
    prompt: '幫我做一個居家囤貨管理工具，當日用品快過期或庫存過低時會自動提醒我，並可以用清單分類。',
    component: InventoryApp,
  },
  {
    id: 'project-board',
    name: '專案看板',
    category: '職場效率',
    prompt: '幫我做一個專案進度看板，左邊是進行中，右邊是已結案，每個案子都要顯示目前的進度。',
    component: ProjectBoardApp,
  },
  {
    id: 'knowledge-hub',
    name: '知識庫',
    category: '知識管理',
    prompt: '做一個資源分享工具，讓我能一鍵儲存網頁或檔案，並透過 AI 自動幫我生成摘要標籤與分類。',
    component: KnowledgeHubApp,
  },
  {
    id: 'cafe-map',
    name: '咖啡廳地圖',
    category: '生活風格',
    prompt: '做一個地圖 App，快速搜尋附近營業中且可能有插座的咖啡廳，並顯示目前的評分。',
    component: CafeMapApp,
  },
  {
    id: 'stock-tracker',
    name: '持股追蹤',
    category: '投資理財',
    prompt: '幫我做一個深色模式的持股追蹤 App，要能顯示目前的總損益，並用圓餅圖呈現不同產業的配置佔比。',
    component: StockTrackerApp,
  },
  {
    id: 'health-tracker',
    name: '健康追蹤',
    category: '健康效率',
    prompt: '幫我做一個極簡的飲食打卡 App，只要拍照或輸入食物名稱，就自動計算今日熱量。',
    component: HealthTrackerApp,
  },
] as const
