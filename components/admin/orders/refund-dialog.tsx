// components/admin/orders/refund-dialog.tsx
// 退款對話框元件
// 用於標記訂單為已退款

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { RotateCcw, AlertTriangle } from 'lucide-react'
import { markAsRefunded } from '@/lib/actions/orders'
import { refundSchema, type RefundData } from '@/lib/validations/order'
import { toast } from 'sonner'

interface RefundDialogProps {
  orderId: string
  orderNo: string
  amount: number
  paymentGateway?: string | null
  /** 此訂單所屬的訂閱（非空表示為訂閱期款；退款會連動取消訂閱與收回權限） */
  subscriptionId?: string | null
  /** 訂閱期別（顯示用） */
  periodNumber?: number | null
  refundStatus?: string | null
  isAnomalousPeriod?: boolean
}

export function shouldShowPayuniManualRefundConfirmation(params: {
  paymentGateway?: string | null
  refundStatus?: string | null
}): boolean {
  return (
    params.paymentGateway === 'payuni' &&
    params.refundStatus === 'PENDING_MANUAL'
  )
}

export function RefundDialog({
  orderId,
  orderNo,
  amount,
  paymentGateway,
  subscriptionId,
  periodNumber,
  refundStatus,
  isAnomalousPeriod = false,
}: RefundDialogProps) {
  const isSubscriptionOrder = !!subscriptionId
  const refundIsProcessing =
    refundStatus === 'PROCESSING' || refundStatus === 'PARTIAL'
  const showPayuniManualConfirmation =
    shouldShowPayuniManualRefundConfirmation({ paymentGateway, refundStatus })
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const form = useForm<RefundData>({
    resolver: zodResolver(refundSchema),
    defaultValues: {
      orderId,
      reason: '',
      manualRefundConfirmed: false,
    },
  })

  const onSubmit = async (data: RefundData) => {
    try {
      setIsSubmitting(true)

      const result = await markAsRefunded(data)

      if (!result.success) {
        throw new Error(result.error || '退款失敗')
      }

      toast.success(
        result.requiresManualAction
          ? '已建立人工退款待辦'
          : result.refundPending
            ? '退款處理中'
            : '退款處理完成'
      )
      // PAYUNi 需人工退款 / 發票自動沖銷失敗等需提醒的情況，以警告 toast 顯示（停留較久）
      if (result.warning) {
        toast.warning(result.warning, { duration: 12000 })
      }
      setOpen(false)
      form.reset()
      router.refresh()
    } catch (error) {
      console.error('退款失敗:', error)
      toast.error(error instanceof Error ? error.message : '退款失敗，請稍後再試')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 格式化金額
  const formatAmount = (amount: number): string => {
    return `NT$ ${amount.toLocaleString()}`
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={refundIsProcessing}
          className="border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEE2E2] hover:text-[#991B1B] rounded-lg"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          {refundStatus === 'PARTIAL'
            ? '已有部分退款'
            : refundIsProcessing
              ? '退款處理中'
              : '標記退款'}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white border-divider sm:max-w-[425px] rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-heading flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-cta" />
            確認退款
          </DialogTitle>
          <DialogDescription className="text-body">
            {isAnomalousPeriod ? (
              <>
                此操作<strong>不可復原</strong>：將退回這筆異常扣款，並自動沖銷其電子發票；不影響原訂閱合法權限。
              </>
            ) : (
              <>
                此操作<strong>不可復原</strong>：將發起金流退款、撤銷學員的課程存取權限、回補使用過的優惠券名額，並自動沖銷（作廢／折讓）已開立的電子發票。
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* 訂閱期款退款警告（AC-61）：退款會連動取消整筆訂閱並收回權限 */}
        {isSubscriptionOrder && !isAnomalousPeriod && (
          <div className="bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] rounded-lg p-3 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              這是一筆<strong>訂閱期款</strong>
              {periodNumber != null ? `（第 ${periodNumber} 期）` : ''}
              。退款後系統會<strong>一併取消整筆訂閱並收回課程權限</strong>
              （不論退的是哪一期），未來將不再扣款。請確認確實要終止此訂閱。
            </span>
          </div>
        )}

        {isAnomalousPeriod && (
          <div className="bg-[#FEF3C7] border border-[#FCD34D] text-[#92400E] rounded-lg p-3 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              這是訂閱終態後誤扣的<strong>異常期款</strong>。退款只會處理這筆誤扣，
              不會撤銷原訂閱已合法取得的權限。
            </span>
          </div>
        )}

        {paymentGateway === 'payuni' && (
          <div className="bg-[#FEF3C7] border border-[#FCD34D] text-[#92400E] rounded-lg p-3 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              此訂單使用 <strong>PAYUNi</strong> 金流。
              {showPayuniManualConfirmation
                ? '請先在 PAYUNi 後台完成退款，再勾選下方確認。'
                : '確認後系統會直接向 PAYUNi 發起退款。'}
            </span>
          </div>
        )}

        <div className="bg-surface rounded-xl p-4 my-4 border border-divider">
          <div className="flex justify-between items-center mb-2">
            <span className="text-body text-sm">訂單編號</span>
            <span className="text-heading font-mono text-sm">{orderNo}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-body text-sm">退款金額</span>
            <span className="text-[#DC2626] font-bold">{formatAmount(amount)}</span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-heading">
                    退款原因 <span className="text-[#DC2626]">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="請輸入退款原因..."
                      className="bg-white border-divider text-heading placeholder:text-caption min-h-[100px] rounded-lg focus:border-cta focus:ring-cta"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[#DC2626]" />
                </FormItem>
              )}
            />

            {showPayuniManualConfirmation && (
              <FormField
                control={form.control}
                name="manualRefundConfirmed"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 rounded-lg border border-[#FCD34D] bg-[#FFFBEB] p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel className="text-[#92400E]">
                        我已在 PAYUNi 後台完成全額退款
                      </FormLabel>
                      <p className="text-xs text-[#92400E]">
                        {refundStatus === 'PENDING_MANUAL'
                          ? '系統目前正在等待這項確認。'
                          : '若尚未實際退款，請勿勾選；本次只會建立待辦。'}
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg"
              >
                {isSubmitting ? '處理中...' : '確認退款'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
