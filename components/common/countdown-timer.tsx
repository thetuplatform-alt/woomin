'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clock } from 'lucide-react'

interface CountdownTimerProps {
  targetDate: Date
  /** 是否為循環模式 */
  saleCycleEnabled?: boolean
  /** 循環天數（循環模式下必填） */
  saleCycleDays?: number | null
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function calculateTimeLeft(targetDate: Date, nowMs: number = Date.now()): TimeLeft | null {
  const difference = new Date(targetDate).getTime() - nowMs

  if (difference <= 0) return null

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / (1000 * 60)) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  }
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex lg:flex-col items-center gap-1">
      <span className="min-w-[2rem] rounded-lg bg-heading px-1.5 py-1 text-center text-md font-bold tabular-nums text-white sm:text-xl">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] font-medium text-caption">
        {label}
      </span>
    </div>
  )
}

export function CountdownTimer({
  targetDate,
  saleCycleEnabled = false,
  saleCycleDays,
}: CountdownTimerProps) {
  const [currentTarget, setCurrentTarget] = useState<Date>(targetDate)
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null)
  const [mounted, setMounted] = useState(false)

  const getCycleDurationMs = useCallback(() => {
    if (!saleCycleEnabled || !saleCycleDays) return null
    return saleCycleDays * 24 * 60 * 60 * 1000
  }, [saleCycleEnabled, saleCycleDays])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // 使用 server 計算好的目標時間作為固定基準
    setCurrentTarget(targetDate)
    setTimeLeft(calculateTimeLeft(targetDate))
  }, [targetDate])

  useEffect(() => {
    const timer = setInterval(() => {
      const nowMs = Date.now()
      const newTimeLeft = calculateTimeLeft(currentTarget, nowMs)

      if (!newTimeLeft) {
        const cycleDurationMs = getCycleDurationMs()

        if (cycleDurationMs) {
          // 循環模式：以當前 target 為基準往後推進，避免各裝置基準漂移
          const overdueMs = nowMs - currentTarget.getTime()
          const cyclesToAdvance = Math.floor(overdueMs / cycleDurationMs) + 1
          const nextTarget = new Date(
            currentTarget.getTime() + cyclesToAdvance * cycleDurationMs
          )
          setCurrentTarget(nextTarget)
          setTimeLeft(calculateTimeLeft(nextTarget, nowMs))
        } else {
          // 非循環模式：倒數歸零後停止
          setTimeLeft(null)
          clearInterval(timer)
        }
      } else {
        setTimeLeft(newTimeLeft)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [currentTarget, getCycleDurationMs])

  // SSR 期間不渲染，避免 hydration mismatch
  if (!mounted) return null

  // 已過期且非循環模式，隱藏計時器
  if (!timeLeft && !saleCycleEnabled) return null

  // 正在重置中（循環模式短暫過渡）
  if (!timeLeft) return null

  return (
    <div className="flex  lg:flex-col items-center lg:items-start gap-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-cta">
        <Clock className="h-3.5 w-3.5" />
        <span>優惠倒數</span>
      </div>
      <div className="flex items-center gap-1.5">
        <TimeBlock value={timeLeft.days} label="天" />
        <span className="mb-4 text-md font-bold text-caption hidden lg:block">:</span>
        <TimeBlock value={timeLeft.hours} label="時" />
        <span className="mb-4 text-md font-bold text-caption hidden lg:block">:</span>
        <TimeBlock value={timeLeft.minutes} label="分" />
        <span className="mb-4 text-md font-bold text-caption hidden lg:block">:</span>
        <TimeBlock value={timeLeft.seconds} label="秒" />
      </div>
    </div>
  )
}
