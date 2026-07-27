// components/admin/coupons/coupon-list.tsx
// 優惠券列表元件

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Copy, Check } from 'lucide-react'
import { toggleCouponActive } from '@/lib/actions/coupons'
import { Switch } from '@/components/ui/switch'
import type { CouponListItem } from '@/lib/actions/coupons'

interface CouponListProps {
  coupons: CouponListItem[]
}

function formatDiscount(coupon: CouponListItem): string {
  if (coupon.discountType === 'AMOUNT') {
    return `折 NT$${(coupon.amountOff || 0).toLocaleString()}`
  }
  const pct = `${coupon.percentOff || 0}% off`
  if (coupon.maxDiscountAmount) {
    return `${pct}（上限 NT$${coupon.maxDiscountAmount.toLocaleString()}）`
  }
  return pct
}

function getStatusBadge(coupon: CouponListItem) {
  if (!coupon.active) {
    return <Badge variant="secondary">已停用</Badge>
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return <Badge variant="destructive">已過期</Badge>
  }
  if (coupon.startsAt && new Date(coupon.startsAt) > new Date()) {
    return <Badge variant="outline">未開始</Badge>
  }
  return <Badge className="bg-green-100 text-green-700 border border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700">啟用中</Badge>
}

function formatDate(date: Date | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatRedemptions(coupon: CouponListItem): string {
  const max = coupon.maxRedemptions && coupon.maxRedemptions > 0
    ? coupon.maxRedemptions.toLocaleString()
    : '∞'
  return `${coupon.timesRedeemed} / ${max}`
}

function formatScope(coupon: CouponListItem): string {
  const courseCount = coupon._count.courses
  const bundleCount = coupon._count.bundles

  if (courseCount === 0 && bundleCount === 0) {
    return '全站'
  }

  const parts: string[] = []
  if (courseCount > 0) parts.push(`${courseCount} 門課`)
  if (bundleCount > 0) parts.push(`${bundleCount} 個組合包`)
  return parts.join('、')
}

export function CouponList({ coupons }: CouponListProps) {
  const router = useRouter()
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  async function handleCopyCode(code: string) {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  async function handleToggle(id: string) {
    setTogglingIds((prev) => new Set(prev).add(id))
    await toggleCouponActive(id)
    setTogglingIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">優惠券管理</h1>
        <Link href="/admin/coupons/new" data-tour="coupons-new-btn">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新增優惠券
          </Button>
        </Link>
      </div>

      {coupons.length === 0 ? (
        <div className="rounded-lg border border-border p-12 text-center">
          <p className="text-muted-foreground">尚無優惠券，點擊上方按鈕建立第一張。</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden" data-tour="coupons-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名稱</TableHead>
                <TableHead data-tour="coupons-code-col">代碼</TableHead>
                <TableHead>折扣</TableHead>
                <TableHead>適用範圍</TableHead>
                <TableHead>已使用 / 上限</TableHead>
                <TableHead data-tour="coupons-status-col">狀態</TableHead>
                <TableHead>有效期間</TableHead>
                <TableHead className="text-right" data-tour="coupons-actions-col">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell className="font-medium">{coupon.name}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleCopyCode(coupon.code)}
                      className="inline-flex items-center gap-1.5 rounded bg-muted px-2 py-1 text-xs font-mono hover:bg-muted/80 transition-colors"
                    >
                      {coupon.code}
                      {copiedCode === coupon.code ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell>{formatDiscount(coupon)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatScope(coupon)}
                  </TableCell>
                  <TableCell>{formatRedemptions(coupon)}</TableCell>
                  <TableCell>{getStatusBadge(coupon)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(coupon.startsAt)} ~ {formatDate(coupon.expiresAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Switch
                        checked={coupon.active}
                        onCheckedChange={() => handleToggle(coupon.id)}
                        disabled={togglingIds.has(coupon.id)}
                      />
                      <Link href={`/admin/coupons/${coupon.id}`}>
                        <Button variant="ghost" size="icon">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
