"use client";

// app/(main)/checkout/checkout-client.tsx
// 結帳頁面客戶端元件
// 處理付款表單提交和跳轉

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, ShieldCheck, X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import posthog from "posthog-js";
import { loginWithGoogle, loginWithApple } from "@/lib/actions/auth";
import {
  checkoutInvoiceSchema,
  type CheckoutInvoiceType,
} from "@/lib/validations/einvoice";

interface CheckoutClientProps {
  productType?: "course" | "bundle";
  inviteToken?: string;
  course: {
    id: string;
    title: string;
    subtitle: string | null;
    slug: string;
    coverImage: string | null;
    originalPrice: number;
    finalPrice: number;
    isOnSale: boolean;
    saleEndAt: string | null;
    accessPolicy: string;
  };
  user: {
    name: string;
    email: string;
    isLoggedIn: boolean;
  };
  googleLoginEnabled?: boolean;
  appleLoginEnabled?: boolean;
  einvoiceEnabled?: boolean;
  initialCouponCode?: string;
  /** 訂閱方案（帶此 prop 即進入訂閱結帳模式，AC-28） */
  subscriptionPlan?: {
    id: string;
    label: string;
    type: "UNLIMITED" | "FIXED_TERM";
    interval: "MONTH" | "YEAR";
    price: number;
    totalPeriods: number | null;
    termEndBehavior: "GRANT_LIFETIME" | "END_ACCESS";
  };
  /** 當前金流類型（決定下次扣款日文案；PAYUNi 月繳有月底規則） */
  subscriptionGateway?: "stripe" | "payuni" | "shopline";
}

/**
 * 格式化價格
 */
function formatPrice(price: number): string {
  return `NT$ ${price.toLocaleString("zh-TW")}`;
}

import { motion } from "framer-motion";

interface AppliedCoupon {
  couponId: string;
  code: string;
  name: string;
  discountAmount: number;
  finalPrice: number;
}

/** 週期文字 */
function intervalLabel(interval: "MONTH" | "YEAR"): string {
  return interval === "MONTH" ? "每月" : "每年";
}

/** 週期單位（用於「每 N 期」等） */
function intervalUnit(interval: "MONTH" | "YEAR"): string {
  return interval === "MONTH" ? "個月" : "年";
}

/**
 * 推導下次扣款日文案。
 * - Stripe：原生依訂閱錨點扣款，顯示週期即可
 * - PAYUNi 月繳：每月固定日扣款，當月無此日則月底（PRD §4.1）
 */
function describeNextBilling(
  interval: "MONTH" | "YEAR",
  gateway: "stripe" | "payuni" | "shopline" | undefined
): string {
  const now = new Date();
  if (interval === "YEAR") {
    const next = new Date(now);
    next.setFullYear(next.getFullYear() + 1);
    return `${next.toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" })}（每年此日自動扣款）`;
  }
  // MONTH
  const dayOfMonth = now.getDate();
  if (gateway === "payuni") {
    return `每月 ${dayOfMonth} 日自動扣款；當月若無此日期，則於當月最後一日扣款。`;
  }
  const next = new Date(now);
  next.setMonth(next.getMonth() + 1);
  return `${next.toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" })} 起，每月此日自動扣款。`;
}

export function CheckoutClient({
  productType = "course",
  inviteToken,
  course,
  user,
  googleLoginEnabled = true,
  appleLoginEnabled = true,
  einvoiceEnabled = false,
  initialCouponCode = "",
  subscriptionPlan,
  subscriptionGateway,
}: CheckoutClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState(user.email || "");
  const [guestName, setGuestName] = useState(user.name || "");
  const [guestOptionTracked, setGuestOptionTracked] = useState(false);

  // 訂閱模式旗標與同意狀態（AC-28）
  const isSubscription = !!subscriptionPlan;
  const [recurringConsent, setRecurringConsent] = useState(false);

  // 優惠碼狀態
  const [couponCode, setCouponCode] = useState(initialCouponCode);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const isBundle = productType === "bundle";
  const checkoutQuery = `${isBundle ? 'bundleId' : 'courseId'}=${encodeURIComponent(course.id)}${
    inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : ''
  }${
    // 訂閱模式登入回跳保留 plan 參數，OAuth 回跳後才不會退回買斷模式（AC-24）
    subscriptionPlan ? `&plan=${encodeURIComponent(subscriptionPlan.id)}` : ''
  }`;
  const productLabel = isBundle ? "組合包" : "課程";
  const productPageHref = isBundle ? `/bundles/${course.slug}` : `/courses/${course.slug}`;

  // 法律同意：消保法「通訊交易解除權合理例外情事適用準則」要求消費者於購買前明示同意
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [generalEmailConsent, setGeneralEmailConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // 電子發票資訊（僅在發票功能啟用時顯示與送出）
  const [invoiceType, setInvoiceType] = useState<CheckoutInvoiceType>("PERSONAL");
  const [carrierType, setCarrierType] = useState<"member" | "mobile">("member");
  const [carrierId, setCarrierId] = useState("");
  const [invoiceTaxId, setInvoiceTaxId] = useState("");
  const [invoiceTitle, setInvoiceTitle] = useState("");
  const [invoiceAddress, setInvoiceAddress] = useState("");
  const [loveCode, setLoveCode] = useState("");

  // PostHog: 結帳頁瀏覽事件（頁面載入時觸發，與 checkout_initiated 按鈕點擊區分）
  useEffect(() => {
    posthog.capture("checkout_page_viewed", {
      course_id: course.id,
      course_slug: course.slug,
      course_title: course.title,
      item_type: productType,
      original_price: course.originalPrice,
      final_price: course.finalPrice,
      is_on_sale: course.isOnSale,
      currency: "TWD",
    });
  }, [course.id, course.slug, course.title, course.originalPrice, course.finalPrice, course.isOnSale, productType]);

  // PostHog: 結帳放棄追蹤（用戶離開結帳頁時觸發）
  useEffect(() => {
    const handleBeforeUnload = () => {
      posthog.capture("checkout_abandoned", {
        course_id: course.id,
        course_slug: course.slug,
        course_title: course.title,
        item_type: productType,
        final_price: course.finalPrice,
        abandon_method: "page_leave",
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [course.id, course.slug, course.title, course.finalPrice, productType]);

  // 計算顯示用的總計金額
  const displayTotal = appliedCoupon ? appliedCoupon.finalPrice : course.finalPrice;

  /**
   * 套用優惠碼
   */
  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;

    setCouponLoading(true);
    setCouponError(null);

    try {
      const response = await fetch("/api/coupon/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode.trim(),
          ...(isBundle ? { bundleId: course.id } : { courseId: course.id }),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setCouponError(result.error || "驗證失敗");
        setCouponLoading(false);
        return;
      }

      setAppliedCoupon({
        couponId: result.couponId,
        code: result.code,
        name: result.name,
        discountAmount: result.discountAmount,
        finalPrice: result.finalPrice,
      });
      setCouponCode("");
      setCouponError(null);

      posthog.capture("coupon_applied", {
        course_id: isBundle ? null : course.id,
        bundle_id: isBundle ? course.id : null,
        item_type: productType,
        coupon_code: result.code,
        discount_amount: result.discountAmount,
      });
    } catch {
      setCouponError("驗證優惠碼失敗，請稍後再試");
    }
    setCouponLoading(false);
  }

  useEffect(() => {
    if (initialCouponCode) {
      handleApplyCoupon();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 移除已套用的優惠碼
   */
  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponError(null);
  }

  /**
   * 處理付款
   */
  async function handlePayment() {
    try {
      setIsLoading(true);
      setError(null);

      // 訂閱僅限已登入正式會員（AC-24）：未登入不送單，導向登入
      if (isSubscription && !user.isLoggedIn) {
        setError("訂閱僅限已登入的正式會員，請先登入");
        setIsLoading(false);
        return;
      }

      // 訂閱模式：必勾自動扣款同意
      if (isSubscription && !recurringConsent) {
        setError("請勾選同意定期自動扣款");
        setIsLoading(false);
        return;
      }

      if (!isSubscription && !user.isLoggedIn) {
        if (!guestEmail.trim()) {
          setError("請填寫 Email");
          setIsLoading(false);
          return;
        }
      }

      // 驗證電子發票資訊（僅在發票功能啟用時）
      let invoicePayload:
        | {
            invoiceType: CheckoutInvoiceType;
            carrierType?: "member" | "mobile";
            carrierId?: string;
            taxId?: string;
            title?: string;
            address?: string;
            loveCode?: string;
          }
        | undefined;
      if (einvoiceEnabled) {
        const parsed = checkoutInvoiceSchema.safeParse({
          invoiceType,
          carrierType: invoiceType === "PERSONAL" ? carrierType : undefined,
          carrierId:
            invoiceType === "PERSONAL" && carrierType === "mobile"
              ? carrierId.trim().toUpperCase()
              : "",
          taxId: invoiceType === "COMPANY" ? invoiceTaxId.trim() : "",
          title: invoiceType === "COMPANY" ? invoiceTitle.trim() : "",
          address: invoiceType === "COMPANY" ? invoiceAddress.trim() : "",
          loveCode: invoiceType === "DONATION" ? loveCode.trim() : "",
        });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message || "發票資訊有誤");
          setIsLoading(false);
          return;
        }
        invoicePayload = parsed.data;
      }

      // PostHog: Track checkout initiated（plan_type 屬性 AC-75）
      posthog.capture("checkout_initiated", {
        course_id: course.id,
        item_type: isBundle ? "bundle" : "course",
        course_slug: course.slug,
        course_title: course.title,
        original_price: course.originalPrice,
        final_price: isSubscription ? subscriptionPlan!.price : course.finalPrice,
        is_on_sale: course.isOnSale,
        currency: "TWD",
        identity_type: user.isLoggedIn ? "auth" : "guest_form",
        plan_type: isSubscription
          ? subscriptionPlan!.type === "FIXED_TERM"
            ? "fixed_term"
            : "unlimited"
          : "buyout",
      });

      // 呼叫建立訂單 API
      const response = await fetch("/api/payment/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(isBundle ? { bundleId: course.id } : { courseId: course.id }),
          ...(!isBundle && inviteToken ? { invite: inviteToken } : {}),
          // 訂閱模式不帶優惠券（v1 訂閱不支援券，AC-29）
          ...(!isSubscription && appliedCoupon
            ? { couponCode: appliedCoupon.code }
            : {}),
          ...(invoicePayload ? { invoice: invoicePayload } : {}),
          generalEmailConsent,
          marketingConsent,
          // 訂閱方案與自動扣款同意（AC-22）
          ...(isSubscription
            ? { planId: subscriptionPlan!.id, recurringConsent }
            : {}),
          ...(user.isLoggedIn
            ? {}
            : {
                email: guestEmail.trim().toLowerCase(),
                ...(guestName.trim() ? { name: guestName.trim() } : {}),
              }),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result?.code === "OAUTH_ACCOUNT_EXISTS") {
          throw new Error("此 Email 已綁定社群登入，請改用上方 Google / Apple 快速登入");
        }
        if (result?.code === "PASSWORD_ACCOUNT_EXISTS") {
          throw new Error("此 Email 已註冊會員，請先登入後再購買");
        }
        if (result?.code === "SUBSCRIPTION_LOGIN_REQUIRED") {
          throw new Error("訂閱僅限已登入的正式會員，請先登入");
        }
        if (result?.code === "ALREADY_ACTIVE_PURCHASE") {
          throw new Error(
            result.error || "你目前仍可觀看此課程，屆時可重新訂閱"
          );
        }
        throw new Error(result.error || "建立訂單失敗");
      }

      // 訪客用戶：將 PostHog 匿名 ID 與新建的 userId 關聯
      // 確保前台的 $pageview、cta_clicked、checkout_initiated 等事件
      // 可以與 server-side 的 payment_succeeded 事件在漏斗中正確串接
      if (!user.isLoggedIn && result.userId) {
        posthog.identify(result.userId, {
          email: guestEmail.trim().toLowerCase(),
          ...(guestName.trim() ? { name: guestName.trim() } : {}),
        });
      }

      // 依據金流類型跳轉
      if (result.paymentType === 'free') {
        // 零元訂單：直接導向成功頁
        router.push(`/checkout/success?orderNo=${result.orderNo}`);
        return;
      }

      if (result.paymentType === 'form_post' && result.formData) {
        // PAYUNi：跳轉到靜態頁面 POST 表單
        const redirectUrl = new URL('/payuni-redirect.html', window.location.origin);
        redirectUrl.searchParams.set('apiUrl', result.formData.apiUrl);
        redirectUrl.searchParams.set('MerID', result.formData.MerID);
        redirectUrl.searchParams.set('Version', result.formData.Version);
        redirectUrl.searchParams.set('EncryptInfo', encodeURIComponent(result.formData.EncryptInfo));
        redirectUrl.searchParams.set('HashInfo', encodeURIComponent(result.formData.HashInfo));
        window.location.href = redirectUrl.toString();
      } else {
        // Stripe / SHOPLINE Payments：直接跳轉到金流方的 hosted checkout 頁面
        window.location.href = result.checkoutUrl;
      }
    } catch (err) {
      console.error("Payment error:", err);
      setError(err instanceof Error ? err.message : "付款失敗，請稍後再試");
      setIsLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* 返回連結 */}
      <Link
        href={productPageHref}
        className="inline-flex items-center gap-2 text-body hover:text-heading transition-colors text-sm font-medium"
        onClick={() => {
          posthog.capture("checkout_abandoned", {
            course_id: course.id,
            course_slug: course.slug,
            course_title: course.title,
            final_price: course.finalPrice,
            abandon_method: "back_button",
          });
        }}
      >
        <ArrowLeft className="h-4 w-4" />
        返回{productLabel}頁面
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:gap-8">
        {/* 左欄：會員資訊填寫 */}
        <div className="rounded-2xl border border-divider bg-white p-6 sm:p-8">
          <h2 className="text-xl font-bold text-heading">會員資訊填寫</h2>

          {!user.isLoggedIn && (
            <div className="mt-6">
              {(googleLoginEnabled || appleLoginEnabled) && (
                <>
                  <p className="mb-3 text-sm font-medium text-body">會員購買</p>
                  <div className={`grid gap-3 ${googleLoginEnabled && appleLoginEnabled ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
                    {googleLoginEnabled && (
                      <form action={loginWithGoogle}>
                        <input type="hidden" name="callbackUrl" value={`/checkout?${checkoutQuery}`} />
                        <Button
                          type="submit"
                          variant="outline"
                          className="w-full rounded-xl border-divider py-6"
                          onClick={() => {
                            posthog.capture("checkout_identity_option_clicked", {
                              method: "google",
                              course_id: course.id,
                            });
                          }}
                        >
                          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                          </svg>
                          Google 快速登入
                        </Button>
                      </form>
                    )}

                    {appleLoginEnabled && (
                      <form action={loginWithApple}>
                        <input type="hidden" name="callbackUrl" value={`/checkout?${checkoutQuery}`} />
                        <Button
                          type="submit"
                          variant="outline"
                          className="w-full rounded-xl border-divider py-6"
                          onClick={() => {
                            posthog.capture("checkout_identity_option_clicked", {
                              method: "apple",
                              course_id: course.id,
                            });
                          }}
                        >
                          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                          </svg>
                          Apple 快速登入
                        </Button>
                      </form>
                    )}
                  </div>
                  <div className="my-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-divider" />
                    <span className="text-xs text-caption">或使用非會員直接購買</span>
                    <div className="h-px flex-1 bg-divider" />
                  </div>
                </>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-heading">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                value={guestEmail}
                onChange={(event) => setGuestEmail(event.target.value)}
                onFocus={() => {
                  if (guestOptionTracked || user.isLoggedIn) return;
                  posthog.capture("checkout_identity_option_clicked", {
                    method: "guest_form",
                    course_id: course.id,
                  });
                  setGuestOptionTracked(true);
                }}
                placeholder="your-email@example.com"
                disabled={user.isLoggedIn}
                className="h-12 rounded-xl border-divider"
              />
              {!user.isLoggedIn && (
                <p className="text-xs text-caption">此信箱將作為課程啟用帳號</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-heading">
                姓名
              </label>
              <Input
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder="請填入姓名（選填）"
                disabled={user.isLoggedIn}
                className="h-12 rounded-xl border-divider"
              />
            </div>
          </div>

          {einvoiceEnabled && (
            <div className="mt-6 space-y-3 rounded-xl border border-divider bg-surface/40 p-4">
              <p className="text-sm font-semibold text-heading">發票資訊</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["PERSONAL", "個人"],
                    ["COMPANY", "公司"],
                    ["DONATION", "捐贈"],
                  ] as [CheckoutInvoiceType, string][]
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setInvoiceType(val)}
                    className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors ${
                      invoiceType === val
                        ? "border-cta bg-cta/5 text-cta"
                        : "border-divider text-body hover:border-[#A3A3A3]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {invoiceType === "PERSONAL" && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["member", "雲端發票（存會員載具）"],
                        ["mobile", "手機條碼載具"],
                      ] as ["member" | "mobile", string][]
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCarrierType(val)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          carrierType === val
                            ? "border-cta bg-cta/5 text-cta"
                            : "border-divider text-body hover:border-[#A3A3A3]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {carrierType === "mobile" && (
                    <Input
                      value={carrierId}
                      onChange={(e) => setCarrierId(e.target.value)}
                      placeholder="/ABC1234（手機條碼）"
                      className="h-11 rounded-xl border-divider font-mono uppercase"
                      maxLength={8}
                    />
                  )}
                </div>
              )}

              {invoiceType === "COMPANY" && (
                <div className="space-y-2">
                  <Input
                    value={invoiceTaxId}
                    onChange={(e) => setInvoiceTaxId(e.target.value)}
                    placeholder="統一編號（8 碼）"
                    className="h-11 rounded-xl border-divider font-mono"
                    maxLength={8}
                  />
                  <Input
                    value={invoiceTitle}
                    onChange={(e) => setInvoiceTitle(e.target.value)}
                    placeholder="公司抬頭"
                    className="h-11 rounded-xl border-divider"
                  />
                  <Input
                    value={invoiceAddress}
                    onChange={(e) => setInvoiceAddress(e.target.value)}
                    placeholder="公司地址（開立三聯式發票需要）"
                    className="h-11 rounded-xl border-divider"
                  />
                </div>
              )}

              {invoiceType === "DONATION" && (
                <Input
                  value={loveCode}
                  onChange={(e) => setLoveCode(e.target.value)}
                  placeholder="捐贈碼 / 愛心碼（3-7 碼數字）"
                  className="h-11 rounded-xl border-divider font-mono"
                  maxLength={7}
                />
              )}
            </div>
          )}

          {user.isLoggedIn && (
            <p className="mt-4 text-sm text-body">
              已登入會員：{user.email}
            </p>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-500">{error}</p>
          )}

          {/* 訂閱模式：取消政策全文（AC-28） */}
          {isSubscription && (
            <div className="mt-6 space-y-2 rounded-xl border border-divider bg-surface/40 p-4 text-sm leading-relaxed text-body">
              <p className="font-semibold text-heading">取消政策</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>你可以隨時取消訂閱，取消後不再產生後續扣款。</li>
                <li>
                  取消後，你仍可觀看至目前已付期間結束為止（含寬限期），期滿後自動停止存取。
                </li>
                {subscriptionPlan!.type === "FIXED_TERM" && (
                  <li>
                    期限訂閱若於繳滿前中途取消，
                    <span className="font-semibold text-heading">不會轉為永久擁有</span>
                    ；僅在完整繳滿全部期數後才依方案設定轉為永久或結束存取。
                  </li>
                )}
                <li>
                  已完成扣款的期款
                  <span className="font-semibold text-heading">恕不退費</span>
                  ；如遇扣款失敗，於寬限期內補繳成功即可恢復存取。
                </li>
              </ul>
            </div>
          )}

          {/* 主要同意條款：訂閱模式使用擴充版數位內容例外文字（AC-28） */}
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-divider bg-surface/50 p-4">
            <input
              type="checkbox"
              checked={agreedTerms}
              onChange={(e) => setAgreedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-cta"
              aria-label="同意相關條款"
            />
            <span className="text-sm leading-relaxed text-body">
              我已閱讀並同意{' '}
              <Link href="/terms" target="_blank" className="text-cta underline hover:text-cta-hover">
                服務條款
              </Link>
              {' 與 '}
              <Link href="/privacy" target="_blank" className="text-cta underline hover:text-cta-hover">
                隱私權保護政策
              </Link>
              {isSubscription
                ? '，並同意本數位內容服務於訂閱後立即開通、自今日起定期自動扣款，放棄 7 日猶豫期。'
                : '，並確認本數位內容服務於購買後即時開通，不適用 7 天鑑賞期。'}
            </span>
          </label>

          {/* 訂閱模式：自動扣款同意（必勾，AC-28） */}
          {isSubscription && (
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-cta/40 bg-cta/5 p-4">
              <input
                type="checkbox"
                checked={recurringConsent}
                onChange={(e) => setRecurringConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-cta"
                aria-label="同意定期自動扣款"
              />
              <span className="text-sm leading-relaxed text-body">
                我了解並同意依上方方案內容
                <span className="font-semibold text-heading">
                  {' '}
                  {intervalLabel(subscriptionPlan!.interval)}自動扣款 NT$
                  {subscriptionPlan!.price.toLocaleString("zh-TW")}
                </span>
                {subscriptionPlan!.type === "FIXED_TERM"
                  ? `，共 ${subscriptionPlan!.totalPeriods} 期`
                  : "，直到我主動取消為止"}
                。
              </span>
            </label>
          )}

          <div className="mt-3 space-y-3 rounded-xl border border-divider bg-white p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={generalEmailConsent}
                onChange={(e) => setGeneralEmailConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-cta"
              />
              <span className="text-sm leading-relaxed text-body">
                接收學習資源電子報、課程更新與開課公告。
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-cta"
              />
              <span className="text-sm leading-relaxed text-body">
                我明確同意接收課程促銷、優惠碼與限時活動電子報（可隨時退訂）。
              </span>
            </label>
          </div>

          {/* 訂閱模式未登入：顯示登入引導（OAuth callbackUrl 保留 plan 參數，AC-24） */}
          {isSubscription && !user.isLoggedIn ? (
            <div className="mt-4 space-y-3 rounded-xl border border-cta/40 bg-cta/5 p-5">
              <p className="text-sm font-semibold text-heading">
                訂閱僅限已登入的正式會員
              </p>
              <p className="text-sm leading-relaxed text-body">
                為了讓你日後可自助管理與取消訂閱，請先登入或註冊會員後再訂閱。
              </p>
              <div
                className={`grid gap-3 ${
                  googleLoginEnabled && appleLoginEnabled
                    ? "sm:grid-cols-2"
                    : "sm:grid-cols-1"
                }`}
              >
                {googleLoginEnabled && (
                  <form action={loginWithGoogle}>
                    <input
                      type="hidden"
                      name="callbackUrl"
                      value={`/checkout?${checkoutQuery}`}
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      className="w-full rounded-xl border-divider py-6"
                    >
                      Google 快速登入
                    </Button>
                  </form>
                )}
                {appleLoginEnabled && (
                  <form action={loginWithApple}>
                    <input
                      type="hidden"
                      name="callbackUrl"
                      value={`/checkout?${checkoutQuery}`}
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      className="w-full rounded-xl border-divider py-6"
                    >
                      Apple 快速登入
                    </Button>
                  </form>
                )}
              </div>
              <Button
                asChild
                className="w-full rounded-xl bg-cta py-6 text-base font-bold text-white hover:bg-cta-hover"
              >
                <Link href={`/login?callbackUrl=${encodeURIComponent(`/checkout?${checkoutQuery}`)}`}>
                  以 Email 登入 / 註冊
                </Link>
              </Button>
            </div>
          ) : (
            <Button
              onClick={handlePayment}
              disabled={
                isLoading ||
                !agreedTerms ||
                (isSubscription && !recurringConsent)
              }
              className="mt-4 w-full rounded-xl bg-cta py-7 text-base font-bold text-white hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  金流引導中...
                </>
              ) : isSubscription ? (
                "確認訂閱並前往付款"
              ) : (
                "確認送出"
              )}
            </Button>
          )}

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-caption">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>下一步將連至第三方金流平台，您所有的交易資訊皆獲得安全保護。</span>
          </div>
        </div>

        {/* 右欄：訂單摘要 */}
        <div className="rounded-2xl border border-divider bg-white p-6 sm:p-8 lg:sticky lg:top-24 lg:h-fit">
          <h2 className="text-xl font-bold text-heading">訂單摘要</h2>

          <div className="mt-5 space-y-3">
            <p className="text-base font-medium text-heading">{course.title}</p>
            {course.subtitle && (
              <p className="text-sm text-body">{course.subtitle}</p>
            )}
          </div>

          <div className="my-5 h-px bg-divider" />

          {isSubscription ? (
            /* ---- 訂閱模式：方案摘要卡（AC-28）---- */
            <div className="space-y-3">
              <div className="rounded-lg bg-cta/5 border border-cta/30 px-3 py-2 text-sm font-semibold text-cta">
                {subscriptionPlan!.label}
              </div>

              <div className="flex justify-between text-sm text-body">
                <span>每期金額</span>
                <span className="font-medium text-heading">
                  {formatPrice(subscriptionPlan!.price)}
                  {' / '}
                  {intervalUnit(subscriptionPlan!.interval)}
                </span>
              </div>

              <div className="flex justify-between text-sm text-body">
                <span>扣款週期</span>
                <span>{intervalLabel(subscriptionPlan!.interval)}扣款</span>
              </div>

              <div className="flex justify-between text-sm text-body">
                <span>期數</span>
                <span>
                  {subscriptionPlan!.type === "FIXED_TERM"
                    ? `共 ${subscriptionPlan!.totalPeriods} 期`
                    : "不限期數（訂閱至取消為止）"}
                </span>
              </div>

              {subscriptionPlan!.type === "FIXED_TERM" && (
                <div className="flex items-center justify-between border-t border-divider pt-3">
                  <span className="font-semibold text-heading">總繳金額</span>
                  <span className="text-right text-sm font-medium text-heading">
                    {formatPrice(subscriptionPlan!.price)} ×{" "}
                    {subscriptionPlan!.totalPeriods} 期 ={" "}
                    <span className="text-lg font-bold">
                      {formatPrice(
                        subscriptionPlan!.price *
                          (subscriptionPlan!.totalPeriods ?? 0)
                      )}
                    </span>
                  </span>
                </div>
              )}

              {subscriptionPlan!.type === "FIXED_TERM" && (
                <div className="rounded-lg bg-surface border border-divider p-3 text-sm text-body">
                  <span className="font-medium text-heading">期滿後</span>
                  <span className="ml-2">
                    {subscriptionPlan!.termEndBehavior === "GRANT_LIFETIME"
                      ? "繳滿全部期數後轉為永久擁有"
                      : "繳滿全部期數後結束存取"}
                  </span>
                </div>
              )}

              <div className="rounded-lg bg-surface border border-divider p-3 text-sm text-body">
                <span className="font-medium text-heading">下次扣款</span>
                <span className="ml-2">
                  {describeNextBilling(
                    subscriptionPlan!.interval,
                    subscriptionGateway
                  )}
                </span>
              </div>

              {/* PAYUNi UNLIMITED 技術上限揭露（PRD §12(c)） */}
              {subscriptionGateway === "payuni" &&
                subscriptionPlan!.type === "UNLIMITED" && (
                  <p className="text-xs leading-relaxed text-caption">
                    授權頁顯示之期數為系統技術上限，實際扣款將持續至您主動取消為止。
                  </p>
                )}

              <div className="flex items-center justify-between border-t border-divider pt-3">
                <span className="font-semibold text-heading">本次扣款</span>
                <span className="text-2xl font-bold text-heading">
                  {formatPrice(subscriptionPlan!.price)}
                </span>
              </div>
            </div>
          ) : (
            /* ---- 買斷模式（原有邏輯，零改動）---- */
            <div className="space-y-3">
              {course.isOnSale && (
                <div className="flex justify-between text-sm text-body">
                  <span>原價</span>
                  <span className="line-through">{formatPrice(course.originalPrice)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-body">
                <span>小計</span>
                <span>{formatPrice(course.finalPrice)}</span>
              </div>

              {/* 優惠碼輸入 */}
              {(
                !appliedCoupon ? (
                  <div className="pt-2">
                    <div className="flex gap-2">
                      <Input
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value);
                          setCouponError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleApplyCoupon();
                          }
                        }}
                        placeholder="輸入優惠碼"
                        className="h-10 rounded-lg border-divider font-mono uppercase text-sm"
                        disabled={couponLoading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleApplyCoupon}
                        disabled={couponLoading || !couponCode.trim()}
                        className="h-10 px-4 rounded-lg shrink-0"
                      >
                        {couponLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "套用"
                        )}
                      </Button>
                    </div>
                    {couponError && (
                      <p className="mt-1.5 text-xs text-red-500">{couponError}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700">
                        {appliedCoupon.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-green-700">
                        -{formatPrice(appliedCoupon.discountAmount)}
                      </span>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="rounded-full p-0.5 text-green-600 hover:bg-green-100 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              )}

              <div className="flex items-center justify-between border-t border-divider pt-3">
                <span className="font-semibold text-heading">總計</span>
                <span className="text-2xl font-bold text-heading">{formatPrice(displayTotal)}</span>
              </div>

              <div className="mt-3 rounded-lg bg-surface border border-divider p-3 text-sm text-body">
                <span className="font-medium text-heading">觀看期限</span>
                <span className="ml-2">{course.accessPolicy}</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </motion.div>
  );
}
