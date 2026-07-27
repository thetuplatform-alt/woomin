// components/admin/courses/course-pricing-form.tsx
// 定價與促銷表單（定價與促銷 tab）
// 包含定價設定和課程優惠券區塊，使用 SectionNav 側邊導覽

'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { format } from 'date-fns'
import type { Course } from '@prisma/client'
import {
  coursePricingSchema,
  courseAccessTypeOptions,
  type CoursePricingFormData,
} from '@/lib/validations/course'
import { updateCoursePricing } from '@/lib/actions/courses'
import {
  saveSubscriptionPlans,
  type AdminSubscriptionPlanItem,
} from '@/lib/actions/subscription-plans'
import { describeAccessPolicy } from '@/lib/purchase/compute-expires-at'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { RefreshCw, Clock, DollarSign, Ticket, CalendarClock, BellRing, Repeat } from 'lucide-react'
import { StickySaveBar } from '@/components/admin/shared/sticky-save-bar'
import { SectionNav, type SectionNavItem } from '@/components/admin/course-editor/section-nav'
import { CourseCouponSection } from '@/components/admin/coupons/course-coupon-section'
import {
  SubscriptionPlansSection,
  type SubscriptionPlanDraft,
} from '@/components/admin/courses/subscription-plans-section'
import type { CouponListItem } from '@/lib/actions/coupons'

const sectionItems: SectionNavItem[] = [
  { id: 'pricing', label: '定價設定', icon: DollarSign },
  { id: 'access', label: '授權期限', icon: CalendarClock },
  { id: 'subscription', label: '訂閱方案', icon: Repeat },
  { id: 'reminder', label: '到期提醒', icon: BellRing },
  { id: 'coupons', label: '課程優惠券', icon: Ticket },
]

interface CoursePricingFormProps {
  course: Course
  coupons?: CouponListItem[]
  /** 該課程既有的訂閱方案（後台管理形狀） */
  subscriptionPlans?: AdminSubscriptionPlanItem[]
  /** 當前金流是否支援訂閱（gateway 不支援時顯示告警） */
  subscriptionSupported?: boolean
  /** 課程是否使用客製銷售頁（顯示「需手動更新」提示） */
  usesCustomLandingPage?: boolean
}

/** 將後台方案項轉為表單草稿（帶穩定 tempKey） */
function toDraft(item: AdminSubscriptionPlanItem): SubscriptionPlanDraft {
  return {
    id: item.id,
    tempKey: item.id,
    label: item.label,
    type: item.type,
    interval: item.interval,
    price: item.price,
    totalPeriods: item.totalPeriods,
    termEndBehavior: item.termEndBehavior,
    renewalReminderDays: item.renewalReminderDays,
    enabled: item.enabled,
    hasActiveSubscriptions: item.hasActiveSubscriptions,
  }
}

/** 方案草稿正規化為可比對的字串（判斷 dirty 用；tempKey 不納入比對） */
function serializePlans(plans: SubscriptionPlanDraft[]): string {
  return JSON.stringify(
    plans.map((p) => ({
      id: p.id ?? null,
      label: p.label,
      type: p.type,
      interval: p.interval,
      price: p.price,
      totalPeriods: p.type === 'FIXED_TERM' ? p.totalPeriods ?? null : null,
      termEndBehavior: p.termEndBehavior,
      renewalReminderDays: p.renewalReminderDays ?? null,
      enabled: p.enabled,
    }))
  )
}

export function CoursePricingForm({
  course,
  coupons = [],
  subscriptionPlans = [],
  subscriptionSupported = false,
  usesCustomLandingPage = false,
}: CoursePricingFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 訂閱方案是 RHF 之外的動態列表狀態，dirty 需手動比對後 OR 進 StickySaveBar（AC-15）
  const initialPlans = useMemo(
    () => subscriptionPlans.map(toDraft),
    [subscriptionPlans]
  )
  const [plans, setPlans] = useState<SubscriptionPlanDraft[]>(initialPlans)
  // dirty 基準：可在儲存成功後重置（不依賴 prop，才能在 router.refresh 前就歸零）
  const [plansBaseline, setPlansBaseline] = useState<string>(() =>
    serializePlans(initialPlans)
  )
  const plansDirty = serializePlans(plans) !== plansBaseline

  const form = useForm<CoursePricingFormData>({
    resolver: zodResolver(coursePricingSchema),
    defaultValues: {
      price: course.price ?? 0,
      salePrice: course.salePrice ?? undefined,
      saleEndAt: course.saleEndAt ? new Date(course.saleEndAt) : undefined,
      saleLabel: course.saleLabel ?? '',
      saleCycleEnabled: course.saleCycleEnabled ?? false,
      saleCycleDays: course.saleCycleDays ?? undefined,
      showCountdown: course.showCountdown ?? true,
      accessType: course.accessType ?? 'LIFETIME',
      accessDurationDays: course.accessDurationDays ?? undefined,
      accessExpiresAt: course.accessExpiresAt
        ? new Date(course.accessExpiresAt)
        : undefined,
      expirationReminderEnabled: course.expirationReminderEnabled ?? true,
      expirationReminderDays: course.expirationReminderDays ?? [30, 7, 1],
    },
  })

  const accessType = form.watch('accessType')
  const accessDurationDays = form.watch('accessDurationDays')
  const accessExpiresAt = form.watch('accessExpiresAt')
  const reminderEnabled = form.watch('expirationReminderEnabled')
  const reminderDays = form.watch('expirationReminderDays') ?? []

  const previewPolicy = describeAccessPolicy({
    accessType: (accessType ?? 'LIFETIME') as 'LIFETIME' | 'DURATION' | 'FIXED_DATE',
    accessDurationDays: accessDurationDays ?? null,
    accessExpiresAt: accessExpiresAt ?? null,
  })

  const durationQuickDays = [30, 90, 180, 365, 730]

  function toggleReminderDay(day: number) {
    const current = form.getValues('expirationReminderDays') ?? []
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => b - a)
    form.setValue('expirationReminderDays', next, { shouldDirty: true })
  }

  async function onSubmit(data: CoursePricingFormData) {
    startTransition(async () => {
      try {
        // 1) 儲存定價（僅在有變動時；避免無意義寫入）
        if (form.formState.isDirty) {
          const result = await updateCoursePricing(course.id, data)
          if (!result.success) {
            toast.error(result.error ?? '定價更新失敗')
            return
          }
        }

        // 2) 儲存訂閱方案（僅在有變動時）
        if (plansDirty) {
          const planResult = await saveSubscriptionPlans(course.id, {
            plans: plans.map((p) => ({
              id: p.id,
              label: p.label,
              type: p.type,
              interval: p.interval,
              price: p.price,
              totalPeriods:
                p.type === 'FIXED_TERM' ? p.totalPeriods ?? null : null,
              termEndBehavior: p.termEndBehavior,
              renewalReminderDays: p.renewalReminderDays ?? null,
              enabled: p.enabled,
              sortOrder: 0,
            })),
          })
          if (!planResult.success) {
            toast.error(planResult.error ?? '訂閱方案儲存失敗')
            return
          }
          // 以回傳的最新方案（含新產生的 id）重置基準，讓 dirty 歸零
          if (planResult.data) {
            const refreshed = planResult.data.map(toDraft)
            setPlans(refreshed)
            setPlansBaseline(serializePlans(refreshed))
          }
        }

        toast.success('定價設定已更新')
        form.reset(data)
        router.refresh()
      } catch {
        toast.error('操作失敗，請稍後再試')
      }
    })
  }

  return (
    <div className="flex gap-8 h-full">
      <SectionNav items={sectionItems} scrollContainerRef={scrollContainerRef} />

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6 max-w-3xl mx-auto">
          {/* ========== 定價設定 ========== */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card data-section="pricing" className="bg-white border-divider rounded-xl">
                <CardHeader>
                  <CardTitle className="text-heading">定價設定</CardTitle>
                  <CardDescription className="text-body">
                    設定課程的價格和促銷活動
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 原價 */}
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem data-tour="pricing-original-price">
                          <FormLabel className="text-heading">
                            原價 (NT$) <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              className="bg-white border-divider text-heading placeholder:text-caption rounded-lg"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value) || 0)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* 促銷價 */}
                    <FormField
                      control={form.control}
                      name="salePrice"
                      render={({ field }) => (
                        <FormItem data-tour="pricing-sale-block">
                          <FormLabel className="text-heading">促銷價 (NT$)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              placeholder="選填"
                              className="bg-white border-divider text-heading placeholder:text-caption rounded-lg"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? parseInt(e.target.value) : null
                                )
                              }
                            />
                          </FormControl>
                          <FormDescription className="text-caption">
                            促銷價必須小於原價
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* 促銷說明文字 */}
                  <FormField
                    control={form.control}
                    name="saleLabel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-heading">促銷說明文字</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="例如：開工優惠、限時早鳥"
                            className="bg-white border-divider text-heading placeholder:text-caption rounded-lg"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormDescription className="text-caption">
                          顯示在價格旁的促銷理由，未填寫時預設為「限時優惠」
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 永久優惠 */}
                  <FormField
                    control={form.control}
                    name="saleCycleEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-divider p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-heading flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 text-cta" />
                            永久優惠
                          </FormLabel>
                          <FormDescription className="text-caption">
                            啟用後，促銷價將永久生效，不受截止日期限制
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked)
                              if (checked) {
                                form.setValue('showCountdown', false, { shouldDirty: true })
                              }
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* 永久優惠開啟時 */}
                  {form.watch('saleCycleEnabled') && (
                    <>
                      <FormField
                        control={form.control}
                        name="showCountdown"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-divider p-4 ml-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-heading flex items-center gap-2">
                                <Clock className="h-4 w-4 text-cta" />
                                顯示倒數時鐘
                              </FormLabel>
                              <FormDescription className="text-caption">
                                開啟後，前台銷售頁將顯示優惠倒數計時器
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {form.watch('showCountdown') && (
                        <FormField
                          control={form.control}
                          name="saleCycleDays"
                          render={({ field }) => (
                            <FormItem className="ml-4">
                              <FormLabel className="text-heading">循環天數</FormLabel>
                              <FormControl>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min="1"
                                    max="30"
                                    placeholder="3"
                                    className="w-32 bg-white border-divider text-heading placeholder:text-caption rounded-lg"
                                    {...field}
                                    value={field.value ?? ''}
                                    onChange={(e) =>
                                      field.onChange(
                                        e.target.value ? parseInt(e.target.value) : null
                                      )
                                    }
                                  />
                                  <span className="text-sm text-body">天</span>
                                </div>
                              </FormControl>
                              <FormDescription className="text-caption">
                                倒數歸零後自動重新開始計時
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </>
                  )}

                  {/* 永久優惠關閉時 */}
                  {!form.watch('saleCycleEnabled') && (
                    <>
                      <FormField
                        control={form.control}
                        name="showCountdown"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-divider p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-heading flex items-center gap-2">
                                <Clock className="h-4 w-4 text-cta" />
                                顯示倒數時鐘
                              </FormLabel>
                              <FormDescription className="text-caption">
                                關閉後，前台銷售頁將不會顯示優惠倒數計時器，但促銷價格仍然有效
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="saleEndAt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-heading">促銷截止日期</FormLabel>
                            <FormControl>
                              <Input
                                type="datetime-local"
                                className="bg-white border-divider text-heading rounded-lg"
                                value={
                                  field.value
                                    ? format(new Date(field.value), "yyyy-MM-dd'T'HH:mm")
                                    : ''
                                }
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value ? new Date(e.target.value) : null
                                  )
                                }
                              />
                            </FormControl>
                            <FormDescription className="text-caption">
                              促銷活動的結束時間
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </CardContent>
              </Card>

              {/* ========== 授權期限 ========== */}
              <Card data-section="access" className="bg-white border-divider rounded-xl">
                <CardHeader>
                  <CardTitle className="text-heading">授權期限</CardTitle>
                  <CardDescription className="text-body">
                    決定學員購買後可觀看多久。修改後只影響未來新的授權，已發出的授權不會變動。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="accessType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-heading">授權類型</FormLabel>
                        <Select
                          value={field.value ?? 'LIFETIME'}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger data-tour="access-type-select" className="bg-white border-divider text-heading rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white border-divider">
                            {courseAccessTypeOptions.map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={opt.value}
                                className="text-body focus:bg-surface focus:text-heading"
                              >
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {accessType === 'DURATION' && (
                    <FormField
                      control={form.control}
                      name="accessDurationDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-heading">有效天數</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="1"
                                max="36500"
                                placeholder="例：365"
                                className="w-40 bg-white border-divider text-heading rounded-lg"
                                {...field}
                                value={field.value ?? ''}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value ? parseInt(e.target.value) : null
                                  )
                                }
                              />
                              <span className="text-sm text-body">天</span>
                            </div>
                          </FormControl>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {durationQuickDays.map((d) => (
                              <Button
                                key={d}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-divider text-body hover:bg-surface"
                                onClick={() =>
                                  form.setValue('accessDurationDays', d, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                  })
                                }
                              >
                                {d === 365 ? '1 年' : d === 730 ? '2 年' : `${d} 天`}
                              </Button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {accessType === 'FIXED_DATE' && (
                    <FormField
                      control={form.control}
                      name="accessExpiresAt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-heading">統一到期日</FormLabel>
                          <FormControl>
                            <Input
                              type="datetime-local"
                              className="bg-white border-divider text-heading rounded-lg"
                              value={
                                field.value
                                  ? format(new Date(field.value), "yyyy-MM-dd'T'HH:mm")
                                  : ''
                              }
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value ? new Date(e.target.value) : null
                                )
                              }
                            />
                          </FormControl>
                          <FormDescription className="text-caption">
                            所有購買者同一天失去觀看權限，適合期數制、報名制課程
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="rounded-lg border border-divider bg-surface p-3 text-sm">
                    <span className="text-caption">前台顯示預覽：</span>
                    <span className="ml-2 text-heading font-medium">{previewPolicy}</span>
                  </div>
                </CardContent>
              </Card>

              {/* ========== 訂閱方案 ========== */}
              <SubscriptionPlansSection
                plans={plans}
                onChange={setPlans}
                subscriptionSupported={subscriptionSupported}
                usesCustomLandingPage={usesCustomLandingPage}
              />

              {/* ========== 到期提醒 ========== */}
              <Card data-section="reminder" className="bg-white border-divider rounded-xl">
                <CardHeader>
                  <CardTitle className="text-heading">到期提醒</CardTitle>
                  <CardDescription className="text-body">
                    當學員授權即將到期或已過期時，自動寄送 Email 提醒
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="expirationReminderEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-divider p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-heading flex items-center gap-2">
                            <BellRing className="h-4 w-4 text-cta" />
                            啟用到期提醒
                          </FormLabel>
                          <FormDescription className="text-caption">
                            永久授權的課程不會寄送提醒
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value ?? true}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {reminderEnabled && accessType !== 'LIFETIME' && (
                    <div className="ml-4">
                      <FormLabel className="text-heading">提醒時間點</FormLabel>
                      <FormDescription className="text-caption mb-2">
                        到期前 N 天會寄 Email 提醒，可複選
                      </FormDescription>
                      <div className="flex flex-wrap gap-2">
                        {[60, 30, 14, 7, 3, 1].map((d) => {
                          const active = reminderDays.includes(d)
                          return (
                            <Button
                              key={d}
                              type="button"
                              variant={active ? 'default' : 'outline'}
                              size="sm"
                              className={
                                active
                                  ? 'bg-cta hover:bg-cta-hover text-white'
                                  : 'border-divider text-body hover:bg-surface'
                              }
                              onClick={() => toggleReminderDay(d)}
                            >
                              到期前 {d} 天
                            </Button>
                          )
                        })}
                      </div>
                      <p className="text-xs text-caption mt-2">
                        ※ 到期當天與過期 1 天後會自動寄送過期通知，不需額外設定
                      </p>
                    </div>
                  )}

                  {reminderEnabled && accessType === 'LIFETIME' && (
                    <div className="ml-4 text-sm text-caption">
                      目前為永久授權，不會寄送到期提醒
                    </div>
                  )}
                </CardContent>
              </Card>

              <div data-tour="sticky-save-bar">
                <StickySaveBar
                  isDirty={form.formState.isDirty || plansDirty}
                  isPending={isPending}
                  form="submit"
                  label="儲存變更"
                />
              </div>
            </form>
          </Form>

          {/* ========== 課程優惠券 ========== */}
          <div data-section="coupons">
            <CourseCouponSection courseId={course.id} coupons={coupons} />
          </div>
        </div>
      </div>
    </div>
  )
}
