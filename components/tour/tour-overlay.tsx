// components/tour/tour-overlay.tsx
// 教學進行中的全頁覆蓋層:聚光燈特寫目標元素 + 浮動提示卡。
// 採「非阻擋」設計:暗色遮罩 pointer-events 為 none,使用者仍可邊看邊操作。

'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useTour } from './tour-context'
import type { TourPlacement } from '@/lib/tours/types'

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const CARD_WIDTH = 340
const MARGIN = 12
const GAP = 14

function fits(top: number, left: number, w: number, h: number, vw: number, vh: number) {
  return top >= MARGIN && left >= MARGIN && top + h <= vh - MARGIN && left + w <= vw - MARGIN
}

function placeCard(
  rect: Rect,
  placement: TourPlacement,
  cw: number,
  ch: number,
  vw: number,
  vh: number
): { top: number; left: number } {
  const centerX = rect.left + rect.width / 2 - cw / 2
  const centerY = rect.top + rect.height / 2 - ch / 2

  const candidate = (p: TourPlacement) => {
    switch (p) {
      case 'top':
        return { top: rect.top - ch - GAP, left: centerX }
      case 'left':
        return { top: centerY, left: rect.left - cw - GAP }
      case 'right':
        return { top: centerY, left: rect.left + rect.width + GAP }
      case 'bottom':
      default:
        return { top: rect.top + rect.height + GAP, left: centerX }
    }
  }

  // 依序嘗試:指定方位 → 反向 → 上 → 下,挑第一個放得下的
  const opposite: Record<TourPlacement, TourPlacement> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
    center: 'bottom',
  }
  const order: TourPlacement[] = [placement, opposite[placement], 'bottom', 'top']
  for (const p of order) {
    const c = candidate(p)
    if (fits(c.top, c.left, cw, ch, vw, vh)) return c
  }
  // 都放不下 → 用指定方位再夾進視窗
  const c = candidate(placement)
  return {
    top: Math.min(Math.max(c.top, MARGIN), vh - ch - MARGIN),
    left: Math.min(Math.max(c.left, MARGIN), vw - cw - MARGIN),
  }
}

export function TourOverlay() {
  const { isActive, currentStep, stepIndex, totalSteps, next, prev, stop } = useTour()

  const [mounted, setMounted] = useState(false)
  const [rect, setRect] = useState<Rect | null>(null)
  const [coords, setCoords] = useState({ top: MARGIN, left: MARGIN })
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  const selector = currentStep?.selector

  // 量測目標元素位置,並跟隨捲動 / 縮放即時更新
  useEffect(() => {
    if (!isActive) return
    if (!selector) {
      setRect(null)
      return
    }

    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${selector}"]`)
      if (!el) {
        setRect(null)
        return
      }
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }

    // 先把目標捲進畫面中央,再持續量測一小段時間蓋過捲動動畫
    const el = document.querySelector<HTMLElement>(`[data-tour="${selector}"]`)
    el?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
    measure()

    let raf = 0
    const onChange = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    window.addEventListener('resize', onChange)
    document.addEventListener('scroll', onChange, true)

    let ticks = 0
    const interval = window.setInterval(() => {
      measure()
      if (++ticks > 12) window.clearInterval(interval)
    }, 60)

    return () => {
      window.removeEventListener('resize', onChange)
      document.removeEventListener('scroll', onChange, true)
      window.clearInterval(interval)
      cancelAnimationFrame(raf)
    }
  }, [isActive, selector, stepIndex])

  // 依目標與卡片實際尺寸計算提示卡位置
  useLayoutEffect(() => {
    if (!isActive) return
    const card = cardRef.current
    if (!card) return
    const cw = card.offsetWidth || CARD_WIDTH
    const ch = card.offsetHeight || 160
    const vw = window.innerWidth
    const vh = window.innerHeight

    if (!rect || !selector) {
      setCoords({
        top: Math.max(MARGIN, (vh - ch) / 2),
        left: Math.max(MARGIN, (vw - cw) / 2),
      })
      return
    }
    setCoords(placeCard(rect, currentStep?.placement ?? 'bottom', cw, ch, vw, vh))
  }, [rect, isActive, selector, currentStep, stepIndex])

  // 鍵盤操作
  useEffect(() => {
    if (!isActive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        stop('dismissed')
      } else if (e.key === 'ArrowRight') {
        next()
      } else if (e.key === 'ArrowLeft') {
        prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isActive, next, prev, stop])

  const handleDismiss = useCallback(() => stop('dismissed'), [stop])

  if (!mounted) return null

  const isLast = stepIndex >= totalSteps - 1
  const isIntro = stepIndex === 0 && !selector
  const nextLabel = isLast ? '完成' : isIntro ? '開始' : '下一步'
  const pad = currentStep?.padding ?? 8

  return createPortal(
    <AnimatePresence>
      {isActive && currentStep && (
        <div className="fixed inset-0 z-[90] overflow-hidden">
          {/* 遮罩 / 聚光燈(不攔截點擊,使用者可邊看邊操作) */}
          {rect && selector ? (
            <motion.div
              key="spotlight"
              className="pointer-events-none fixed rounded-xl"
              initial={false}
              animate={{
                top: rect.top - pad,
                left: rect.left - pad,
                width: rect.width + pad * 2,
                height: rect.height + pad * 2,
              }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              style={{
                boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)',
                outline: '2px solid rgba(255,255,255,0.92)',
                outlineOffset: 2,
              }}
            />
          ) : (
            <motion.div
              key="dim"
              className="pointer-events-none fixed inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ background: 'rgba(15, 23, 42, 0.55)' }}
            />
          )}

          {/* 提示卡 */}
          <motion.div
            ref={cardRef}
            key={`card-${stepIndex}`}
            className="pointer-events-auto fixed w-[340px] max-w-[calc(100vw-24px)] rounded-2xl border border-divider bg-white p-4 shadow-2xl"
            style={{ top: coords.top, left: coords.left }}
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {/* 頂列:進度 + 關閉 */}
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-caption">
                步驟 {stepIndex + 1} / {totalSteps}
              </span>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="關閉教學"
                className="-mr-1 -mt-1 rounded-md p-1 text-caption transition-colors hover:bg-surface hover:text-heading"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 進度小點 */}
            <div className="mb-3 flex items-center gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors',
                    i <= stepIndex ? 'bg-cta' : 'bg-divider'
                  )}
                />
              ))}
            </div>

            {currentStep.title && (
              <h3 className="mb-1 text-sm font-semibold text-heading">
                {currentStep.title}
              </h3>
            )}
            <p className="text-sm leading-relaxed text-body">{currentStep.body}</p>

            {/* 動作列 */}
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleDismiss}
                className="text-xs text-caption transition-colors hover:text-body"
              >
                略過教學
              </button>
              <div className="flex items-center gap-2">
                {stepIndex > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={prev}
                    className="h-8 gap-1 rounded-lg border-divider px-2.5 text-body hover:bg-surface hover:text-heading"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    上一步
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={next}
                  className="h-8 rounded-lg bg-cta px-4 text-white hover:bg-cta-hover"
                >
                  {nextLabel}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
