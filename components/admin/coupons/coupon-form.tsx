// components/admin/coupons/coupon-form.tsx
// 優惠券新增/編輯表單

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Boxes, Globe2, Shuffle } from 'lucide-react'
import { StickySaveBar } from '@/components/admin/shared/sticky-save-bar'
import { createCoupon, updateCoupon } from '@/lib/actions/coupons'
import type { CouponDetail } from '@/lib/actions/coupons'

interface CouponFormProps {
  coupon?: CouponDetail
  courses: { id: string; title: string }[]
  bundles: { id: string; title: string }[]
  defaultCourseIds?: string[]
  allowGlobalCoupons?: boolean
}

function generateRandomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function toDatetimeLocalValue(date: Date | string | null): string {
  if (!date) return ''
  const d = new Date(date)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

export function CouponForm({
  coupon,
  courses,
  bundles,
  defaultCourseIds,
  allowGlobalCoupons = true,
}: CouponFormProps) {
  const router = useRouter()
  const isEdit = !!coupon

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(!isEdit)

  // Form state
  const [name, setName] = useState(coupon?.name || '')
  const [code, setCode] = useState(coupon?.code || '')
  const [description, setDescription] = useState(coupon?.description || '')
  const [discountType, setDiscountType] = useState<'AMOUNT' | 'PERCENT'>(
    coupon?.discountType || 'AMOUNT'
  )
  const [amountOff, setAmountOff] = useState(coupon?.amountOff?.toString() || '')
  const [percentOff, setPercentOff] = useState(coupon?.percentOff?.toString() || '')
  const [maxDiscountAmount, setMaxDiscountAmount] = useState(
    coupon?.maxDiscountAmount?.toString() || ''
  )
  const [maxRedemptions, setMaxRedemptions] = useState(
    coupon?.maxRedemptions?.toString() || '0'
  )
  const [maxPerUser, setMaxPerUser] = useState(
    coupon?.maxPerUser?.toString() || '0'
  )
  const [minimumAmount, setMinimumAmount] = useState(
    coupon?.minimumAmount?.toString() || ''
  )
  const [firstTimeOnly, setFirstTimeOnly] = useState(coupon?.firstTimeOnly || false)
  const [active, setActive] = useState(coupon?.active ?? true)
  const [startsAt, setStartsAt] = useState(toDatetimeLocalValue(coupon?.startsAt || null))
  const [expiresAt, setExpiresAt] = useState(toDatetimeLocalValue(coupon?.expiresAt || null))
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>(
    coupon?.courses.map((c) => c.id) ||
      defaultCourseIds ||
      (!allowGlobalCoupons && courses[0] ? [courses[0].id] : [])
  )
  const [selectedBundleIds, setSelectedBundleIds] = useState<string[]>(
    coupon?.bundles.map((bundle) => bundle.id) || []
  )

  const scopeMode = !allowGlobalCoupons
    ? 'targeted'
    : selectedCourseIds.length === 0 && selectedBundleIds.length === 0
    ? 'global'
    : 'targeted'

  function handleToggleCourse(courseId: string) {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    )
  }

  function handleToggleBundle(bundleId: string) {
    setSelectedBundleIds((prev) =>
      prev.includes(bundleId)
        ? prev.filter((id) => id !== bundleId)
        : [...prev, bundleId]
    )
  }

  function clearProductScope() {
    if (!allowGlobalCoupons) return
    setSelectedCourseIds([])
    setSelectedBundleIds([])
    setIsDirty(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const formData = {
        name,
        code,
        description: description || null,
        discountType,
        amountOff: discountType === 'AMOUNT' ? Number(amountOff) || null : null,
        percentOff: discountType === 'PERCENT' ? Number(percentOff) || null : null,
        maxDiscountAmount: discountType === 'PERCENT' ? Number(maxDiscountAmount) || null : null,
        maxRedemptions: Number(maxRedemptions) || 0,
        maxPerUser: Number(maxPerUser) || 0,
        minimumAmount: Number(minimumAmount) || null,
        firstTimeOnly,
        active,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        courseIds: selectedCourseIds,
        bundleIds: selectedBundleIds,
      }

      const result = isEdit
        ? await updateCoupon(coupon!.id, formData)
        : await createCoupon(formData)

      if (!result.success) {
        setError(result.error || '操作失敗')
        setIsLoading(false)
        return
      }

      router.push('/admin/coupons')
      router.refresh()
    } catch {
      setError('操作失敗，請稍後再試')
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" onChangeCapture={() => setIsDirty(true)}>
      {/* 基本資訊 */}
      <Card>
        <CardHeader>
          <CardTitle>基本資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">名稱 *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：新年優惠、早鳥折扣"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">優惠碼 *</Label>
            <div className="flex gap-2">
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="例：NEWYEAR2026"
                className="font-mono uppercase"
                required
                disabled={isEdit}
              />
              {!isEdit && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCode(generateRandomCode())}
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
              )}
            </div>
            {isEdit && (
              <p className="text-xs text-muted-foreground">優惠碼建立後不可修改</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">說明</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="內部備註（選填）"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* 折扣設定 */}
      <Card>
        <CardHeader>
          <CardTitle>折扣設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>折扣類型 *</Label>
            <Select
              value={discountType}
              onValueChange={(v) => {
                setDiscountType(v as 'AMOUNT' | 'PERCENT')
                setIsDirty(true)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AMOUNT">固定金額折扣</SelectItem>
                <SelectItem value="PERCENT">百分比折扣</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {discountType === 'AMOUNT' ? (
            <div className="space-y-2">
              <Label htmlFor="amountOff">折抵金額 (NT$) *</Label>
              <Input
                id="amountOff"
                type="number"
                min="1"
                value={amountOff}
                onChange={(e) => setAmountOff(e.target.value)}
                placeholder="例：200"
                required
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="percentOff">折扣百分比 (%) *</Label>
                <Input
                  id="percentOff"
                  type="number"
                  min="1"
                  max="100"
                  value={percentOff}
                  onChange={(e) => setPercentOff(e.target.value)}
                  placeholder="例：20（代表 20% off）"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxDiscountAmount">折扣金額上限 (NT$)</Label>
                <Input
                  id="maxDiscountAmount"
                  type="number"
                  min="1"
                  value={maxDiscountAmount}
                  onChange={(e) => setMaxDiscountAmount(e.target.value)}
                  placeholder="留空 = 不限"
                />
                <p className="text-xs text-muted-foreground">
                  百分比折扣的最大折抵金額，例如「打 8 折，最多折 500 元」
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 使用限制 */}
      <Card>
        <CardHeader>
          <CardTitle>使用限制</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxRedemptions">總兌換上限</Label>
              <Input
                id="maxRedemptions"
                type="number"
                min="0"
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                placeholder="0 = 無限"
              />
              <p className="text-xs text-muted-foreground">0 = 不限次數</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxPerUser">每人使用上限</Label>
              <Input
                id="maxPerUser"
                type="number"
                min="0"
                value={maxPerUser}
                onChange={(e) => setMaxPerUser(e.target.value)}
                placeholder="0 = 無限"
              />
              <p className="text-xs text-muted-foreground">0 = 不限次數</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="minimumAmount">最低消費金額 (NT$)</Label>
            <Input
              id="minimumAmount"
              type="number"
              min="1"
              value={minimumAmount}
              onChange={(e) => setMinimumAmount(e.target.value)}
              placeholder="留空 = 不限"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="font-medium text-sm">僅限首次購買用戶</p>
              <p className="text-xs text-muted-foreground">
                只有從未購買過任何課程的用戶才能使用
              </p>
            </div>
            <Switch
              checked={firstTimeOnly}
              onCheckedChange={(v) => {
                setFirstTimeOnly(v)
                setIsDirty(true)
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* 適用範圍 */}
      <Card>
        <CardHeader>
          <CardTitle>適用範圍</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            {allowGlobalCoupons && (
              <button
                type="button"
                onClick={clearProductScope}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  scopeMode === 'global'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Globe2 className="h-4 w-4" />
                  全站適用
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  所有課程與組合包都能使用，適合節慶或全站活動。
                </p>
              </button>
            )}
            <div
              className={`rounded-lg border p-4 ${
                scopeMode === 'targeted'
                  ? 'border-primary bg-primary/5'
                  : 'border-border'
              }`}
            >
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Boxes className="h-4 w-4" />
                指定商品
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {allowGlobalCoupons
                  ? '勾選特定課程或組合包；可同時指定多個商品。'
                  : '講師需指定至少一門可管理課程。'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={scopeMode === 'global' ? 'default' : 'secondary'}>
              {scopeMode === 'global' ? '全站適用' : '指定商品'}
            </Badge>
            {selectedCourseIds.length > 0 && (
              <Badge variant="outline">{selectedCourseIds.length} 門課程</Badge>
            )}
            {selectedBundleIds.length > 0 && (
              <Badge variant="outline">{selectedBundleIds.length} 個組合包</Badge>
            )}
          </div>

          <div className={`grid gap-4 ${allowGlobalCoupons ? 'lg:grid-cols-2' : ''}`}>
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">適用課程</h3>
              </div>
              {courses.length === 0 ? (
                <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                  目前沒有可選課程
                </p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
                  {courses.map((course) => (
                    <label
                      key={course.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCourseIds.includes(course.id)}
                        onChange={() => handleToggleCourse(course.id)}
                        className="rounded border-border"
                      />
                      <span className="text-sm">{course.title}</span>
                    </label>
                  ))}
                </div>
              )}
            </section>

            {allowGlobalCoupons && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">適用組合包</h3>
                </div>
                {bundles.length === 0 ? (
                  <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                    目前沒有可選組合包
                  </p>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
                    {bundles.map((bundle) => (
                      <label
                        key={bundle.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedBundleIds.includes(bundle.id)}
                          onChange={() => handleToggleBundle(bundle.id)}
                          className="rounded border-border"
                        />
                        <span className="text-sm">{bundle.title}</span>
                      </label>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 時間與狀態 */}
      <Card>
        <CardHeader>
          <CardTitle>時間與狀態</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="font-medium text-sm">啟用狀態</p>
              <p className="text-xs text-muted-foreground">停用後學員無法再使用此優惠碼</p>
            </div>
            <Switch
              checked={active}
              onCheckedChange={(v) => {
                setActive(v)
                setIsDirty(true)
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startsAt">生效時間</Label>
              <Input
                id="startsAt"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">留空 = 立即生效</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiresAt">到期時間</Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">留空 = 永不到期</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 錯誤與提交 */}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/coupons')}
        >
          取消
        </Button>
      </div>

      <StickySaveBar
        isDirty={isDirty}
        isPending={isLoading}
        form="submit"
        label={isEdit ? '儲存變更' : '建立優惠券'}
      />
    </form>
  )
}
