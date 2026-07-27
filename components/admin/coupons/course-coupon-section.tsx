// components/admin/coupons/course-coupon-section.tsx
// 定價頁面內嵌的課程優惠券管理區塊

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Plus, Pencil, Copy, Check, ExternalLink, Ticket } from 'lucide-react'
import { toggleCouponActive } from '@/lib/actions/coupons'
import type { CouponListItem } from '@/lib/actions/coupons'

interface CourseCouponSectionProps {
  courseId: string
  coupons: CouponListItem[]
}

function formatDiscount(coupon: CouponListItem): string {
  if (coupon.discountType === 'AMOUNT') {
    return `NT$${(coupon.amountOff || 0).toLocaleString()}`
  }
  const pct = `${coupon.percentOff || 0}%`
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
  return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">啟用中</Badge>
}

function formatRedemptions(coupon: CouponListItem): string {
  const max = coupon.maxRedemptions && coupon.maxRedemptions > 0
    ? coupon.maxRedemptions.toLocaleString()
    : '∞'
  return `${coupon.timesRedeemed} / ${max}`
}

export function CourseCouponSection({ courseId, coupons }: CourseCouponSectionProps) {
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
    <Card className="bg-white border-divider rounded-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-heading">課程優惠券</CardTitle>
            <CardDescription className="text-body">
              管理此課程專屬的優惠碼
            </CardDescription>
          </div>
          <Link href={`/admin/coupons/new?courseId=${courseId}`}>
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              新增
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {coupons.length === 0 ? (
          <div className="rounded-lg border border-dashed border-divider p-8 text-center">
            <Ticket className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              尚未建立任何優惠券
            </p>
            <Link href={`/admin/coupons/new?courseId=${courseId}`}>
              <Button variant="outline" size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                建立第一張優惠券
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {coupons.map((coupon) => (
              <div
                key={coupon.id}
                className="flex items-center justify-between rounded-lg border border-divider p-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        onClick={() => handleCopyCode(coupon.code)}
                        className="inline-flex items-center gap-1.5 rounded bg-muted px-2 py-0.5 text-xs font-mono hover:bg-muted/80 transition-colors"
                      >
                        {coupon.code}
                        {copiedCode === coupon.code ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                      {getStatusBadge(coupon)}
                    </div>
                    <p className="text-sm text-heading font-medium truncate">
                      {coupon.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      折扣 {formatDiscount(coupon)} · 已使用 {formatRedemptions(coupon)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Switch
                    checked={coupon.active}
                    onCheckedChange={() => handleToggle(coupon.id)}
                    disabled={togglingIds.has(coupon.id)}
                  />
                  <Link href={`/admin/coupons/${coupon.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}

            <Link
              href="/admin/coupons"
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-heading transition-colors pt-2"
            >
              <ExternalLink className="h-3 w-3" />
              在優惠券管理頁查看全部
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
