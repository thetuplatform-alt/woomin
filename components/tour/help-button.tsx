// components/tour/help-button.tsx
// 後台每頁右上角常駐的「問號」教學入口。
// 首次進站會在問號旁顯示一次性引導泡泡,告訴使用者它能幹嘛。

'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HelpCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tourStore } from '@/lib/tours/store'
import { useTour } from './tour-context'

export function HelpButton() {
  const { start, pageHasTour, pageTourId, isActive } = useTour()
  const [hintVisible, setHintVisible] = useState(false)

  // 常駐引導泡泡:只在「此頁教學不會自動跳出(已看過)」且泡泡還沒顯示過時出現一次,
  // 引導使用者注意到問號可重看。首訪時教學會自動開始,本身就是介紹,故不重複顯示泡泡。
  useEffect(() => {
    if (!pageHasTour || !pageTourId) return
    if (tourStore.isHelpHintSeen()) return
    if (tourStore.isAutoEligible(pageTourId)) return // 首訪會自動開始教學 → 不顯示泡泡
    const show = window.setTimeout(() => {
      if (tourStore.isHelpHintSeen()) return
      setHintVisible(true)
      tourStore.markHelpHintSeen()
    }, 1600)
    const hide = window.setTimeout(() => setHintVisible(false), 11000)
    return () => {
      window.clearTimeout(show)
      window.clearTimeout(hide)
    }
  }, [pageHasTour, pageTourId])

  // 教學一旦開始就收起泡泡
  useEffect(() => {
    if (isActive) setHintVisible(false)
  }, [isActive])

  const handleClick = () => {
    setHintVisible(false)
    start('user')
  }

  // 此頁沒有教學就不顯示問號(避免「點了卻說沒教學」的死按鈕);
  // 未來該頁加了教學,按鈕會自動出現。
  if (!pageHasTour) return null

  return (
    <div className="fixed right-3 top-3 z-[60] flex flex-col items-end gap-2 print:hidden">
      <button
        type="button"
        onClick={handleClick}
        aria-label="開啟本頁新手教學"
        title="本頁新手教學"
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-full border border-divider bg-white text-body shadow-sm transition-all',
          'hover:border-cta hover:text-cta hover:shadow-md'
        )}
      >
        <HelpCircle className="h-[18px] w-[18px]" />
        {/* 有教學且尚未看過引導泡泡時,輕微脈動提示 */}
        {hintVisible && (
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-cta/30" />
        )}
      </button>

      <AnimatePresence>
        {hintVisible && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="relative w-[230px] rounded-xl border border-divider bg-white p-3 shadow-xl"
          >
            {/* 指向問號的小三角 */}
            <span className="absolute -top-1.5 right-3 h-3 w-3 rotate-45 border-l border-t border-divider bg-white" />
            <button
              type="button"
              onClick={() => setHintVisible(false)}
              aria-label="關閉提示"
              className="absolute right-1.5 top-1.5 rounded-md p-0.5 text-caption hover:bg-surface hover:text-heading"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <p className="pr-4 text-xs font-medium text-heading">需要幫助?</p>
            <p className="mt-0.5 text-xs leading-relaxed text-body">
              點這顆問號,每一頁都有 30 秒快速導覽,帶你認識所有功能。
            </p>
            <button
              type="button"
              onClick={handleClick}
              className="mt-2 text-xs font-medium text-cta hover:underline"
            >
              開始本頁導覽 →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
