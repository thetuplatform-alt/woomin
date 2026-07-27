// components/admin/courses/subscription-plans-section.tsx
// 課程訂閱方案設定區塊（定價 tab 內的一張 Card）。
//
// 受控元件：由父表單持有方案陣列狀態並手動比對 dirty（StickySaveBar 陷阱的正規解法，
// 見 course-details-form.tsx 的 instructorsDirty；動態列表的新增/刪除/修改都要能觸發儲存）。
//
// 職責：
// - 動態方案列表 CRUD UI（label / type / interval / price / totalPeriods /
//   termEndBehavior / renewalReminderDays / enabled）（AC-10）
// - 兩套語意說明：訂閱權限由週期驅動、課程 accessType 僅適用買斷（AC-10）
// - gateway 不支援時的告警（AC-14）
// - 客製銷售頁時的「需手動更新」提示（AC-14）
//
// 前端驗證僅做即時提示；權威驗證在 saveSubscriptionPlans 的 Zod（subscriptionPlanSchema）。

'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { Badge } from '@/components/ui/badge'
import {
  Repeat,
  Plus,
  Trash2,
  Info,
  AlertTriangle,
  Infinity as InfinityIcon,
  CalendarClock,
} from 'lucide-react'
import {
  SUBSCRIPTION_MIN_TOTAL_PERIODS,
  SUBSCRIPTION_MAX_TOTAL_PERIODS,
  SUBSCRIPTION_MIN_YEAR_REMINDER_DAYS,
} from '@/lib/validations/subscription'

/** 表單持有的單筆方案（id 為既有方案；新方案以 tempKey 於 UI 追蹤） */
export interface SubscriptionPlanDraft {
  /** 既有方案的 DB id（新方案為 undefined） */
  id?: string
  /** UI 內部穩定 key（新增列用；既有列用 id） */
  tempKey: string
  label: string
  type: 'UNLIMITED' | 'FIXED_TERM'
  interval: 'MONTH' | 'YEAR'
  price: number
  totalPeriods: number | null
  termEndBehavior: 'GRANT_LIFETIME' | 'END_ACCESS'
  renewalReminderDays: number | null
  enabled: boolean
  /** 是否有進行中的訂閱使用此方案（有的話刪除只會停用） */
  hasActiveSubscriptions?: boolean
}

interface SubscriptionPlansSectionProps {
  plans: SubscriptionPlanDraft[]
  onChange: (plans: SubscriptionPlanDraft[]) => void
  /** 當前金流是否支援訂閱（AC-14 告警） */
  subscriptionSupported: boolean
  /** 課程是否使用客製銷售頁（AC-14 提示） */
  usesCustomLandingPage: boolean
}

let tempCounter = 0
function nextTempKey(): string {
  tempCounter += 1
  return `new-${Date.now()}-${tempCounter}`
}

/** 建立一筆空白方案草稿 */
export function emptyPlanDraft(): SubscriptionPlanDraft {
  return {
    tempKey: nextTempKey(),
    label: '',
    type: 'UNLIMITED',
    interval: 'MONTH',
    price: 100,
    totalPeriods: null,
    termEndBehavior: 'GRANT_LIFETIME',
    renewalReminderDays: null,
    enabled: true,
  }
}

/** 計算 FIXED_TERM 的總繳金額顯示 */
function totalAmountLabel(plan: SubscriptionPlanDraft): string | null {
  if (plan.type !== 'FIXED_TERM' || !plan.totalPeriods || plan.totalPeriods < 1) {
    return null
  }
  const total = plan.price * plan.totalPeriods
  return `NT$${plan.price.toLocaleString()} × ${plan.totalPeriods} 期 ＝ 總計 NT$${total.toLocaleString()}`
}

export function SubscriptionPlansSection({
  plans,
  onChange,
  subscriptionSupported,
  usesCustomLandingPage,
}: SubscriptionPlansSectionProps) {
  const updatePlan = (
    index: number,
    patch: Partial<SubscriptionPlanDraft>
  ) => {
    const next = plans.map((p, i) => (i === index ? { ...p, ...patch } : p))
    onChange(next)
  }

  const addPlan = () => {
    onChange([...plans, emptyPlanDraft()])
  }

  const removePlan = (index: number) => {
    onChange(plans.filter((_, i) => i !== index))
  }

  // 切換方案類型時，維持欄位間的語意一致性
  const handleTypeChange = (
    index: number,
    type: SubscriptionPlanDraft['type']
  ) => {
    if (type === 'UNLIMITED') {
      // 無限訂閱不可有期數 / 期滿行為
      updatePlan(index, { type, totalPeriods: null })
    } else {
      // 期限訂閱預設一個合理期數
      const current = plans[index]
      updatePlan(index, {
        type,
        totalPeriods: current.totalPeriods ?? 12,
      })
    }
  }

  // 切換週期時，年繳強制帶入預設提醒天數（≥7）
  const handleIntervalChange = (
    index: number,
    interval: SubscriptionPlanDraft['interval']
  ) => {
    if (interval === 'YEAR') {
      const current = plans[index]
      updatePlan(index, {
        interval,
        renewalReminderDays:
          current.renewalReminderDays &&
          current.renewalReminderDays >= SUBSCRIPTION_MIN_YEAR_REMINDER_DAYS
            ? current.renewalReminderDays
            : SUBSCRIPTION_MIN_YEAR_REMINDER_DAYS,
      })
    } else {
      updatePlan(index, { interval })
    }
  }

  return (
    <Card
      data-section="subscription"
      data-tour="subscription-plans"
      className="bg-white border-divider rounded-xl"
    >
      <CardHeader>
        <CardTitle className="text-heading flex items-center gap-2">
          <Repeat className="h-5 w-5 text-cta" />
          訂閱方案
        </CardTitle>
        <CardDescription className="text-body">
          除了買斷之外，可讓學員以定期扣款的方式訂閱這門課。留空則此課程只賣買斷。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ---- 兩套語意說明（AC-10）---- */}
        <div className="rounded-lg border border-divider bg-surface p-4 text-sm space-y-2">
          <p className="text-heading font-medium flex items-center gap-2">
            <Info className="h-4 w-4 text-cta" />
            訂閱與買斷是兩套獨立的授權語意
          </p>
          <ul className="text-body space-y-1 list-disc pl-5">
            <li>
              <strong>訂閱</strong>
              的觀看權限完全由「扣款週期」決定：每期扣款成功即延展觀看期限，取消或扣款失敗後於期末自然斷權。
            </li>
            <li>
              上方「授權期限」的
              <strong>買斷授權類型（永久 / 期限 / 固定到期日）僅適用於買斷</strong>
              購買，不會套用到訂閱訂戶。
            </li>
            <li>
              期限訂閱（類似分期付款）繳滿後預設<strong>轉為永久擁有</strong>
              ，也可設定為期滿結束存取。
            </li>
          </ul>
        </div>

        {/* ---- gateway 不支援告警（AC-14）---- */}
        {!subscriptionSupported && (
          <div className="rounded-lg border border-[#FCD34D] bg-[#FEF3C7] p-3 text-sm text-[#92400E] flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              目前啟用的金流<strong>不支援訂閱制</strong>
              （尚未設定金流，或使用 SHOPLINE）。方案仍可先設定並儲存，但前台不會顯示訂閱選項、也無法結帳；請於
              <strong>金流收款</strong>切換為 Stripe 或 PAYUNi 後才會生效。
            </span>
          </div>
        )}

        {/* ---- 客製銷售頁提示（AC-14）---- */}
        {usesCustomLandingPage && (
          <div className="rounded-lg border border-[#93C5FD] bg-[#EFF6FF] p-3 text-sm text-[#1E40AF] flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              這門課使用<strong>客製銷售頁</strong>
              。訂閱方案不會自動出現在客製頁上，需請工程師在該銷售頁元件中手動加入訂閱選項才會顯示。預設銷售頁（default）則會自動帶入。
            </span>
          </div>
        )}

        {/* ---- 方案列表 ---- */}
        {plans.length === 0 ? (
          <div className="rounded-lg border border-dashed border-divider p-6 text-center">
            <p className="text-caption text-sm">
              尚未設定任何訂閱方案，此課程目前只以買斷方式販售。
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map((plan, index) => {
              const total = totalAmountLabel(plan)
              return (
                <div
                  key={plan.tempKey}
                  className="rounded-xl border border-divider p-4 space-y-4 bg-surface/40"
                >
                  {/* 標頭：類型徽章 + 啟用 + 刪除 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          plan.type === 'UNLIMITED'
                            ? 'bg-[#EDE9FE] text-[#5B21B6] border border-[#C4B5FD]'
                            : 'bg-[#DBEAFE] text-[#1E40AF] border border-[#93C5FD]'
                        }
                      >
                        {plan.type === 'UNLIMITED' ? (
                          <>
                            <InfinityIcon className="mr-1 h-3 w-3" />
                            無限訂閱
                          </>
                        ) : (
                          <>
                            <CalendarClock className="mr-1 h-3 w-3" />
                            期限訂閱
                          </>
                        )}
                      </Badge>
                      {plan.hasActiveSubscriptions && (
                        <Badge className="bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7]">
                          有進行中訂戶
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-caption text-xs">啟用</Label>
                        <Switch
                          checked={plan.enabled}
                          onCheckedChange={(checked) =>
                            updatePlan(index, { enabled: checked })
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-[#DC2626] hover:bg-[#FEE2E2] hover:text-[#991B1B]"
                        onClick={() => removePlan(index)}
                        title={
                          plan.hasActiveSubscriptions
                            ? '有進行中訂戶，移除後會改為停用'
                            : '移除方案'
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">移除方案</span>
                      </Button>
                    </div>
                  </div>

                  {/* 方案名稱 */}
                  <div className="space-y-1.5">
                    <Label className="text-heading">方案名稱</Label>
                    <Input
                      value={plan.label}
                      placeholder="例如：月繳無限方案、12 期分期"
                      className="bg-white border-divider text-heading placeholder:text-caption rounded-lg"
                      onChange={(e) =>
                        updatePlan(index, { label: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 類型 */}
                    <div className="space-y-1.5">
                      <Label className="text-heading">類型</Label>
                      <Select
                        value={plan.type}
                        onValueChange={(v) =>
                          handleTypeChange(
                            index,
                            v as SubscriptionPlanDraft['type']
                          )
                        }
                      >
                        <SelectTrigger className="bg-white border-divider text-heading rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-divider">
                          <SelectItem value="UNLIMITED">
                            無限訂閱（不取消就一直扣款）
                          </SelectItem>
                          <SelectItem value="FIXED_TERM">
                            期限訂閱（繳滿 N 期，類似分期）
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 週期 */}
                    <div className="space-y-1.5">
                      <Label className="text-heading">扣款週期</Label>
                      <Select
                        value={plan.interval}
                        onValueChange={(v) =>
                          handleIntervalChange(
                            index,
                            v as SubscriptionPlanDraft['interval']
                          )
                        }
                      >
                        <SelectTrigger className="bg-white border-divider text-heading rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-divider">
                          <SelectItem value="MONTH">每月</SelectItem>
                          <SelectItem value="YEAR">每年</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 每期金額 */}
                    <div className="space-y-1.5">
                      <Label className="text-heading">每期金額 (NT$)</Label>
                      <Input
                        type="number"
                        min={2}
                        value={plan.price}
                        className="bg-white border-divider text-heading rounded-lg"
                        onChange={(e) =>
                          updatePlan(index, {
                            price: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                      <p className="text-xs text-caption">每期至少 2 元</p>
                    </div>

                    {/* 期數（僅 FIXED_TERM） */}
                    {plan.type === 'FIXED_TERM' && (
                      <div className="space-y-1.5">
                        <Label className="text-heading">總期數</Label>
                        <Input
                          type="number"
                          min={SUBSCRIPTION_MIN_TOTAL_PERIODS}
                          max={SUBSCRIPTION_MAX_TOTAL_PERIODS}
                          value={plan.totalPeriods ?? ''}
                          placeholder="例如：12"
                          className="bg-white border-divider text-heading rounded-lg"
                          onChange={(e) =>
                            updatePlan(index, {
                              totalPeriods: e.target.value
                                ? parseInt(e.target.value)
                                : null,
                            })
                          }
                        />
                        <p className="text-xs text-caption">
                          {SUBSCRIPTION_MIN_TOTAL_PERIODS}–
                          {SUBSCRIPTION_MAX_TOTAL_PERIODS} 期
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 期滿行為（僅 FIXED_TERM） */}
                  {plan.type === 'FIXED_TERM' && (
                    <div className="space-y-1.5">
                      <Label className="text-heading">繳滿後</Label>
                      <Select
                        value={plan.termEndBehavior}
                        onValueChange={(v) =>
                          updatePlan(index, {
                            termEndBehavior:
                              v as SubscriptionPlanDraft['termEndBehavior'],
                          })
                        }
                      >
                        <SelectTrigger className="bg-white border-divider text-heading rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-divider">
                          <SelectItem value="GRANT_LIFETIME">
                            轉為永久擁有（分期付款語意，預設）
                          </SelectItem>
                          <SelectItem value="END_ACCESS">
                            結束存取（期滿後不再可觀看）
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* 即將扣款提醒天數 */}
                  <div className="space-y-1.5">
                    <Label className="text-heading">
                      即將扣款提醒（到期前幾天寄信）
                      {plan.interval === 'YEAR' && (
                        <span className="text-[#DC2626]"> *</span>
                      )}
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={plan.renewalReminderDays ?? ''}
                      placeholder={
                        plan.interval === 'YEAR'
                          ? `年繳必填，至少 ${SUBSCRIPTION_MIN_YEAR_REMINDER_DAYS} 天`
                          : '選填（月繳可留空）'
                      }
                      className="bg-white border-divider text-heading rounded-lg max-w-xs"
                      onChange={(e) =>
                        updatePlan(index, {
                          renewalReminderDays: e.target.value
                            ? parseInt(e.target.value)
                            : null,
                        })
                      }
                    />
                    {plan.interval === 'YEAR' && (
                      <p className="text-xs text-caption">
                        年繳方案依卡組織要求，須於扣款前至少{' '}
                        {SUBSCRIPTION_MIN_YEAR_REMINDER_DAYS} 天通知，故為必填。
                      </p>
                    )}
                  </div>

                  {/* 總繳金額摘要（FIXED_TERM） */}
                  {total && (
                    <div className="rounded-lg border border-divider bg-white p-3 text-sm text-heading font-medium">
                      {total}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 新增方案 */}
        <Button
          type="button"
          variant="outline"
          className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
          onClick={addPlan}
        >
          <Plus className="mr-2 h-4 w-4" />
          新增訂閱方案
        </Button>
      </CardContent>
    </Card>
  )
}
