// __tests__/invoice/reconciliation-admin-guard.test.ts
//
// 對應 openspec/changes/upgrade-v1-8-0-preserve-payment-and-crm-fixes
// tasks.md 任務 7.7 / 分支 4「舊訂單發票資料修復」。
//
// 驗證非 admin（一般學員 / 講師）存取拒絕行為：
// 1. getInvoiceReconciliationList() 依 requireOnlyAdminAuth() 被拒絕時，
//    不回傳任何訂單資料（直接拋出例外，不會走到 prisma 查詢）。
// 2. batchReissueInvoicesAction() 依 requireOnlyAdminAuth() 被拒絕時，
//    不會呼叫 issueInvoiceAction（不會觸發任何發票操作）。
// 3. 頁面（app/(admin)/admin/payments/invoice-reconciliation/page.tsx）
//    直接呼叫 requireOnlyAdminAuth()，與既有 admin 頁面慣例一致
//    （見 __tests__/admin-auth-routing.test.ts 對 layout.tsx 的驗證方式）。

import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function readProjectFile(filePath: string) {
  return fs.readFileSync(path.join(root, filePath), 'utf8')
}

describe('getInvoiceReconciliationList：非 admin 存取被拒絕', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('requireOnlyAdminAuth 拒絕（非 ADMIN 角色）時，直接拋出例外，不回傳任何訂單資料', async () => {
    jest.doMock('@/lib/require-admin', () => ({
      requireOnlyAdminAuth: jest.fn().mockRejectedValue(new Error('僅管理員可執行此操作')),
    }))
    const findMany = jest.fn()
    jest.doMock('@/lib/prisma', () => ({
      prisma: { order: { findMany } },
    }))

    const { getInvoiceReconciliationList } = await import('@/lib/invoice/reconciliation')

    await expect(getInvoiceReconciliationList()).rejects.toThrow('僅管理員可執行此操作')
    // 核心斷言：權限檢查失敗時，完全不會查詢訂單資料。
    expect(findMany).not.toHaveBeenCalled()
  })
})

describe('batchReissueInvoicesAction：非 admin 直接呼叫被拒絕', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('requireOnlyAdminAuth 拒絕（非 ADMIN 角色）時，直接拋出例外，不會呼叫 issueInvoiceAction', async () => {
    jest.doMock('@/lib/require-admin', () => ({
      requireOnlyAdminAuth: jest.fn().mockRejectedValue(new Error('僅管理員可執行此操作')),
    }))
    const issueInvoiceAction = jest.fn()
    jest.doMock('@/lib/actions/einvoice', () => ({ issueInvoiceAction }))
    jest.doMock('next/cache', () => ({ revalidatePath: jest.fn() }))

    const { batchReissueInvoicesAction } = await import('@/lib/actions/invoice-reconciliation')

    await expect(batchReissueInvoicesAction(['order_1', 'order_2'])).rejects.toThrow(
      '僅管理員可執行此操作'
    )
    // 核心斷言：權限檢查失敗時，完全不會觸發任何一筆發票開立。
    expect(issueInvoiceAction).not.toHaveBeenCalled()
  })
})

describe('admin 頁面存取拒絕行為（靜態檢查，比照 __tests__/admin-auth-routing.test.ts 的方式）', () => {
  it('invoice-reconciliation 頁面直接呼叫 requireOnlyAdminAuth（僅限 ADMIN，不含 EDITOR/講師）', () => {
    const pageSource = readProjectFile(
      'app/(admin)/admin/payments/invoice-reconciliation/page.tsx'
    )

    expect(pageSource).toContain("import { requireOnlyAdminAuth } from '@/lib/require-admin'")
    expect(pageSource).toContain('await requireOnlyAdminAuth()')
    // 不應該退回用 session.user.role 直接判斷（會有 JWT 快取延遲問題，見 lib/require-admin.ts）
    expect(pageSource).not.toContain('session.user.role')
  })
})
