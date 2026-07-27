// lib/require-admin.ts
// 統一的管理員權限驗證函數
// 直接從資料庫查詢角色，避免 JWT 快取導致的權限延遲問題

import { cache } from 'react'
import { auth } from '@/lib/auth'
import { isAdminOrInstructorRole } from '@/lib/admin-roles'
import { prisma } from '@/lib/prisma'
export { isAdminOrInstructorRole, isInstructorRole } from '@/lib/admin-roles'

const getCurrentDbUser = cache(async () => {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error('未授權存取')
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, email: true, name: true, image: true },
  })

  if (!dbUser) {
    throw new Error('用戶不存在')
  }

  return dbUser
})

/**
 * 驗證當前用戶是否為 ADMIN 或講師（含舊版 EDITOR）
 * 直接查詢資料庫，確保角色變更即時生效
 */
export async function requireAdminAuth() {
  const dbUser = await getCurrentDbUser()

  if (!isAdminOrInstructorRole(dbUser.role)) {
    throw new Error('權限不足')
  }

  return {
    id: dbUser.id,
    role: dbUser.role,
    email: dbUser.email,
    name: dbUser.name,
    image: dbUser.image,
  }
}

/**
 * 驗證當前用戶是否為 ADMIN（不含 EDITOR）
 * 用於角色管理、系統設定等僅限最高權限的操作
 */
export async function requireOnlyAdminAuth() {
  const dbUser = await getCurrentDbUser()

  if (dbUser.role !== 'ADMIN') {
    throw new Error('僅管理員可執行此操作')
  }

  return {
    id: dbUser.id,
    role: dbUser.role,
    email: dbUser.email,
    name: dbUser.name,
    image: dbUser.image,
  }
}
