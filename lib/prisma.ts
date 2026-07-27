// lib/prisma.ts
// Prisma Client singleton 實例
// 防止開發模式下產生過多資料庫連線
// Prisma 7 需要使用 adapter 連接資料庫

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// 宣告全域變數型別
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 建立 Prisma Client 實例
// Prisma 7 使用 adapter 模式連接資料庫
function createPrismaClient() {
  // 使用 PostgreSQL adapter
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

  return new PrismaClient({ adapter })
}

// 如果已存在 Prisma 實例則重用，否則建立新實例
export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// 開發環境下將 Prisma 實例存入全域變數
// 這樣熱重載時不會建立新連線
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
