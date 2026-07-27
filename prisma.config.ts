// prisma.config.ts
// Prisma 7 配置檔案
// 設定資料庫連線和 Migrate 設定

import dotenv from 'dotenv'
import path from 'node:path'
import { defineConfig } from 'prisma/config'

// 載入 .env.local（Next.js 慣例）
dotenv.config({ path: path.join(__dirname, '.env.local') })
// 也嘗試載入 .env 作為 fallback
dotenv.config({ path: path.join(__dirname, '.env') })

export default defineConfig({
  // Prisma schema 路徑
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),

  // 資料庫連線設定（用於 Migrate 和 Studio）
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
