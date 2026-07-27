// components/main/landing/hero-section.tsx
// 課程銷售頁 Hero Section
// 極簡黑白灰設計 + #F5A524 強調色
// 手機版優先：首屏必須包含 H1 + subtitle + CTA + trust signals

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield } from "lucide-react";
import type { CourseDetail } from "@/lib/actions/public-courses";
import { HeroAnimation } from "./hero-animation";
import { FreeCourseCTA } from "./free-course-cta";
import { CountdownTimer } from "@/components/common/countdown-timer";
import { formatPrice } from "@/lib/utils/price";
import posthog from "posthog-js";
import { useEffect, useState } from "react";

interface HeroSectionProps {
  course: CourseDetail;
  primaryCtaText?: string;
  primaryCtaLink?: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  minimal?: boolean;
  isPurchased?: boolean;
  firstLessonId?: string | null;
  isFree?: boolean;
  isLoggedIn?: boolean;
  finalPrice?: number;
  originalPrice?: number;
  isOnSale?: boolean;
  saleEndAt?: Date | null;
  saleLabel?: string;
  countdownTarget?: Date | null;
  saleCycleEnabled?: boolean;
  saleCycleDays?: number | null;
  showCountdown?: boolean;
}

export function LandingHeroSection({
  course,
  primaryCtaText,
  primaryCtaLink,
  secondaryCtaText = "查看課程大綱",
  secondaryCtaLink = "#curriculum",
  minimal = false,
  isPurchased = false,
  firstLessonId,
  isFree = false,
  isLoggedIn = false,
  finalPrice,
  originalPrice,
  isOnSale = false,
  saleEndAt,
  saleLabel = '限時優惠',
  countdownTarget,
  saleCycleEnabled = false,
  saleCycleDays,
  showCountdown = true,
}: HeroSectionProps) {
  // A/B Test: Hero 標題變體
  const [heroVariant, setHeroVariant] = useState<string | undefined>(undefined);
  useEffect(() => {
    // 等待 feature flags 載入完成後取得變體
    posthog.onFeatureFlags(() => {
      const variant = posthog.getFeatureFlag("hero-title-ab-test");
      if (typeof variant === "string") {
        setHeroVariant(variant);
      }
    });
  }, []);

  const isTestVariant = heroVariant === "test";

  const defaultCtaText = isPurchased
    ? "進入課程"
    : isFree
      ? "免費加入課程"
      : "立即加入課程";
  const defaultCtaLink = isPurchased && firstLessonId
    ? `/courses/${course.slug}/lessons/${firstLessonId}`
    : `/checkout?courseId=${course.id}`;

  const finalCtaText = primaryCtaText || defaultCtaText;
  const finalPrimaryLink = primaryCtaLink || defaultCtaLink;

  const useFreeCta = !isPurchased && isFree;

  const content = (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-6">
        {/* 左側：文字內容 */}
        <div className="flex flex-col items-center lg:items-start">
          {/* 標籤 + Social Proof */}
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-full bg-heading px-3 py-1 text-[10px] font-bold tracking-[0.15em] text-white uppercase">
              Vibe Coding 實戰課
            </span>

            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-6 w-6 rounded-full border-2 border-white bg-gray-200"
                  />
                ))}
              </div>
              <span className="text-xs text-body">
                500+ 學員見證
              </span>
            </div>
          </div>

          {/* Hook Title — 對齊廣告素材（A/B Test: hero-title-ab-test） */}
          <h1 className="hidden lg:block font-bold leading-tight tracking-tight text-heading text-6xl">
            {isTestVariant ? (
              <>
                從零開始
                <br />
                帶你用 AI 做出你的 iOS App
                <span className="text-cta">{" "}上架 App Store</span>
              </>
            ) : (
              <>
                不需要程式基礎，
                <br />
                也能做出你的 iOS App
                <span className="text-cta">{" "}上架 App Store</span>
              </>
            )}
          </h1>

          <h1 className="lg:hidden text-3xl font-bold leading-tight tracking-tight text-heading sm:text-4xl text-center">
            {isTestVariant ? (
              <>
                從零開始
                <br />
                帶你用 AI 做出你的 iOS App
                <br />
                <span className="text-cta">上架 App Store</span>
              </>
            ) : (
              <>
                不需要程式基礎，
                <br />
                也能做出你的 iOS App
                <br />
                <span className="text-cta">上架 App Store</span>
              </>
            )}
          </h1>

          {/* Subtitle — 列點式價值主張 */}
          <ul className="mt-4 flex flex-col gap-1.5 text-base text-body sm:text-lg">
            <li className="flex items-center gap-2">
              <span className="text-cta">✓</span> 零程式基礎完全可上手
            </li>
            <li className="flex items-center gap-2">
              <span className="text-cta">✓</span> 用白話文與AI一起建構自己的 App
            </li>
            <li className="flex items-center gap-2">
              <span className="text-cta">✓</span> 上架 App Store 全攻略
            </li>
            <li className="flex items-center gap-2">
              <span className="text-cta">✓</span> 從企劃到內購金流，完整商業落地
            </li>
          </ul>
          <p className="mt-3 text-sm text-caption sm:text-base">
            別讓好點子停在腦中，立刻動手開始做吧！
          </p>

          {!minimal && (
            <>
              {/* CTA Buttons */}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                {useFreeCta ? (
                  <FreeCourseCTA
                    courseId={course.id}
                    courseSlug={course.slug}
                    isLoggedIn={isLoggedIn}
                  />
                ) : (
                  <Button
                    asChild
                    size="lg"
                    className="py-6 rounded-full bg-cta px-8! text-base font-semibold text-white transition-colors hover:bg-cta-hover"
                  >
                    <Link
                      href={finalPrimaryLink}
                      onClick={() => {
                        posthog.capture("cta_clicked", {
                          cta_location: "hero",
                          cta_text: finalCtaText,
                          course_id: course.id,
                          course_slug: course.slug,
                          is_purchased: isPurchased,
                        });
                      }}
                    >
                      {finalCtaText}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                )}

              </div>

              {/* 限時優惠倒數 */}
              {!isPurchased && isOnSale && (countdownTarget || saleEndAt || saleCycleEnabled) && originalPrice !== undefined && finalPrice !== undefined && (
                <div className="mt-4 flex flex-col items-start gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-caption line-through">原價 {formatPrice(originalPrice)}</span>
                    <span className="text-lg font-bold text-heading">{saleLabel} <span className="text-cta">{formatPrice(finalPrice)}</span></span>
                  </div>
                  {showCountdown && (countdownTarget || saleEndAt) && (
                    <CountdownTimer
                      targetDate={countdownTarget ? new Date(countdownTarget) : new Date(saleEndAt!)}
                      saleCycleEnabled={saleCycleEnabled}
                      saleCycleDays={saleCycleDays}
                    />
                  )}
                </div>
              )}

              {/* Trust signals — 緊湊單行 */}
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                {isPurchased ? (
                  <span className="text-caption">感謝您的支持！隨時開始您的學習旅程</span>
                ) : isFree ? (
                  <span className="font-semibold text-cta">限時免費</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cta/30 bg-cta/5 px-3 py-1 text-sm font-semibold text-cta">
                    <Shield className="h-3.5 w-3.5" />
                    7 日內未觀看 100% 退費保證
                  </span>
                )}
              </div>
            </>
          )}

          {minimal && (
            <div className="mt-6 flex items-center gap-2 text-cta font-semibold">
              了解更多課程資訊
              <ArrowRight className="h-5 w-5" />
            </div>
          )}
        </div>

        {/* 右側：動態動畫 — 手機版隱藏以確保首屏 CTA 可見 */}
        <div className="hidden items-center justify-center lg:flex lg:justify-end">
          <HeroAnimation />
        </div>
      </div>
    </div>
  );

  if (minimal) {
    return (
      <Link
        href={`/courses/${course.slug}`}
        className="relative block overflow-hidden bg-white py-8 transition-all duration-300 sm:py-12 lg:py-24 cursor-pointer hover:bg-surface-hover"
      >
        {content}
      </Link>
    );
  }

  return (
    <section className="relative block overflow-hidden bg-white py-8 sm:py-12 lg:py-24">
      {content}
    </section>
  );
}
