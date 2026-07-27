// components/tour/tour-context.tsx
// 新手教學的狀態中樞:管理「目前頁面的 Tour、第幾步、自動開始、上一步/下一步/中斷」。
// 掛在後台外殼(admin-layout-client)內,只影響後台。

'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'
import type { TourStep } from '@/lib/tours/types'
import { getTour, resolveTourId } from '@/lib/tours/registry'
import { tourStore } from '@/lib/tours/store'

/** 自動開始前的等待(讓頁面元素先渲染好) */
const AUTO_START_DELAY = 900

type StartSource = 'auto' | 'user'

interface TourContextValue {
  isActive: boolean
  tourId: string | null
  steps: TourStep[]
  stepIndex: number
  totalSteps: number
  currentStep: TourStep | null
  /** 目前頁面對應的 Tour id(無則 null) */
  pageTourId: string | null
  /** 目前頁面是否有可教學內容(供問號鈕判斷 enable / 提示) */
  pageHasTour: boolean
  /** 啟動目前頁面的教學 */
  start: (source?: StartSource) => void
  next: () => void
  prev: () => void
  goTo: (index: number) => void
  stop: (reason: 'completed' | 'dismissed') => void
}

const TourContext = createContext<TourContextValue | null>(null)

/** 把 intro 開場白變成第一張置中卡,再接上各步;濾掉畫面上找不到目標的步驟 */
function buildSteps(tourId: string): TourStep[] {
  const tour = getTour(tourId)
  if (!tour) return []
  const base: TourStep[] = []
  if (tour.intro) {
    base.push({ id: '__intro__', body: tour.intro, placement: 'center' })
  }
  base.push(...tour.steps)
  if (typeof document === 'undefined') return base
  return base.filter(
    (s) => !s.selector || document.querySelector(`[data-tour="${s.selector}"]`)
  )
}

export function TourProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  const [isActive, setIsActive] = useState(false)
  const [tourId, setTourId] = useState<string | null>(null)
  const [steps, setSteps] = useState<TourStep[]>([])
  const [stepIndex, setStepIndex] = useState(0)

  // 用 ref 保存目前 active 狀態,供 setTimeout 內判斷
  const isActiveRef = useRef(false)
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  const startTour = useCallback((id: string | null, source: StartSource) => {
    if (!id) {
      if (source === 'user') toast('這個頁面還沒有教學')
      return
    }
    if (source === 'auto' && !tourStore.isAutoEligible(id)) return
    const built = buildSteps(id)
    if (built.length === 0) {
      if (source === 'user') toast('本頁教學整理中,敬請期待')
      return
    }
    tourStore.markSeen(id)
    setTourId(id)
    setSteps(built)
    setStepIndex(0)
    setIsActive(true)
  }, [])

  const stop = useCallback(
    (reason: 'completed' | 'dismissed') => {
      setIsActive(false)
      setStepIndex(0)
      if (!tourId) return
      if (reason === 'completed') {
        tourStore.markCompleted(tourId)
      } else {
        tourStore.markSeen(tourId)
      }
    },
    [tourId]
  )

  const next = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      // 已是最後一步 → 完成
      setIsActive(false)
      setStepIndex(0)
      if (tourId) tourStore.markCompleted(tourId)
    } else {
      setStepIndex(stepIndex + 1)
    }
  }, [stepIndex, steps.length, tourId])

  const prev = useCallback(() => {
    setStepIndex((p) => (p > 0 ? p - 1 : 0))
  }, [])

  const goTo = useCallback(
    (index: number) => {
      if (index >= 0 && index < steps.length) setStepIndex(index)
    },
    [steps.length]
  )

  const start = useCallback(
    (source: StartSource = 'user') => {
      startTour(resolveTourId(pathname), source)
    },
    [pathname, startTour]
  )

  // 換頁:收掉上一頁的教學,並視情況自動開始新頁教學
  useEffect(() => {
    setIsActive(false)
    setStepIndex(0)

    const id = resolveTourId(pathname)
    if (!id) return
    const tour = getTour(id)
    if (!tour || tour.steps.length === 0 || tour.autoStart === false) return
    if (!tourStore.isAutoEligible(id)) return

    const timer = setTimeout(() => {
      if (!isActiveRef.current && tourStore.isAutoEligible(id)) startTour(id, 'auto')
    }, AUTO_START_DELAY)
    return () => clearTimeout(timer)
  }, [pathname, startTour])

  const resolvedId = resolveTourId(pathname)
  const resolvedTour = getTour(resolvedId)
  const pageHasTour = Boolean(resolvedTour && resolvedTour.steps.length > 0)

  const value: TourContextValue = {
    isActive,
    tourId,
    steps,
    stepIndex,
    totalSteps: steps.length,
    currentStep: steps[stepIndex] ?? null,
    pageTourId: resolvedId,
    pageHasTour,
    start,
    next,
    prev,
    goTo,
    stop,
  }

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour 必須在 <TourProvider> 內使用')
  return ctx
}
