// components/admin/course-editor/content-layout.tsx
// 課程內容頁面的三欄式佈局
// 左側: 大綱導覽 | 中間: 單元編輯器 | 右側: 設定與預覽
// 左右兩欄寬度可透過邊界把手拖曳調整，並記憶在 localStorage（雙擊把手可還原預設）

'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ContentLayoutProps {
  leftPanel: ReactNode
  centerPanel: ReactNode
  rightPanel: ReactNode
  className?: string
}

// 預設寬度與可拖曳範圍（px）
const LEFT_DEFAULT = 280
const LEFT_MIN = 200
const LEFT_MAX = 480

const RIGHT_DEFAULT = 320
const RIGHT_MIN = 240
const RIGHT_MAX = 560

const STORAGE_KEY_LEFT = 'course-editor:left-panel-width'
const STORAGE_KEY_RIGHT = 'course-editor:right-panel-width'

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export function ContentLayout({
  leftPanel,
  centerPanel,
  rightPanel,
  className,
}: ContentLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT)
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT)
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null)

  // 啟動後從 localStorage 還原使用者上次調整的寬度（避免 SSR hydration 不一致）
  useEffect(() => {
    const savedLeft = Number(window.localStorage.getItem(STORAGE_KEY_LEFT))
    if (savedLeft) setLeftWidth(clamp(savedLeft, LEFT_MIN, LEFT_MAX))

    const savedRight = Number(window.localStorage.getItem(STORAGE_KEY_RIGHT))
    if (savedRight) setRightWidth(clamp(savedRight, RIGHT_MIN, RIGHT_MAX))
  }, [])

  // 拖曳過程中暫存的起始狀態
  const dragState = useRef<{
    side: 'left' | 'right'
    startX: number
    startWidth: number
  } | null>(null)

  const handlePointerDown = useCallback(
    (side: 'left' | 'right') => (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      dragState.current = {
        side,
        startX: e.clientX,
        startWidth: side === 'left' ? leftWidth : rightWidth,
      }
      setDragging(side)
    },
    [leftWidth, rightWidth]
  )

  // 雙擊把手 → 還原該欄為預設寬度
  const handleDoubleClick = useCallback((side: 'left' | 'right') => () => {
    if (side === 'left') {
      setLeftWidth(LEFT_DEFAULT)
      window.localStorage.setItem(STORAGE_KEY_LEFT, String(LEFT_DEFAULT))
    } else {
      setRightWidth(RIGHT_DEFAULT)
      window.localStorage.setItem(STORAGE_KEY_RIGHT, String(RIGHT_DEFAULT))
    }
  }, [])

  // 拖曳期間於 window 監聽，移出把手也能持續調整
  useEffect(() => {
    if (!dragging) return

    const handleMove = (e: PointerEvent) => {
      const state = dragState.current
      if (!state) return

      if (state.side === 'left') {
        // 把手往右拖 → 左欄變寬
        const next = clamp(
          state.startWidth + (e.clientX - state.startX),
          LEFT_MIN,
          LEFT_MAX
        )
        setLeftWidth(next)
      } else {
        // 把手往左拖 → 右欄變寬
        const next = clamp(
          state.startWidth + (state.startX - e.clientX),
          RIGHT_MIN,
          RIGHT_MAX
        )
        setRightWidth(next)
      }
    }

    const handleUp = () => {
      const state = dragState.current
      if (state) {
        if (state.side === 'left') {
          window.localStorage.setItem(STORAGE_KEY_LEFT, String(leftWidth))
        } else {
          window.localStorage.setItem(STORAGE_KEY_RIGHT, String(rightWidth))
        }
      }
      dragState.current = null
      setDragging(null)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    // 拖曳時鎖定整頁游標與避免選取文字
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [dragging, leftWidth, rightWidth])

  return (
    <div className={cn('flex h-full', className)} data-tour="editor-layout">
      {/* 左側面板 - 大綱導覽 */}
      <aside
        className="flex-shrink-0 border-r border-divider bg-white overflow-y-auto"
        style={{ width: leftWidth }}
      >
        {leftPanel}
      </aside>

      {/* 左欄拖曳把手 */}
      <ResizeHandle
        active={dragging === 'left'}
        onPointerDown={handlePointerDown('left')}
        onDoubleClick={handleDoubleClick('left')}
        ariaLabel="調整左側面板寬度"
      />

      {/* 中間面板 - 單元編輯器 */}
      <main className="flex-1 min-w-0 overflow-y-auto bg-surface">
        {centerPanel}
      </main>

      {/* 右欄拖曳把手 */}
      <ResizeHandle
        active={dragging === 'right'}
        onPointerDown={handlePointerDown('right')}
        onDoubleClick={handleDoubleClick('right')}
        ariaLabel="調整右側面板寬度"
      />

      {/* 右側面板 - 設定與預覽 */}
      <aside
        className="flex-shrink-0 border-l border-divider bg-white overflow-y-auto"
        style={{ width: rightWidth }}
      >
        {rightPanel}
      </aside>
    </div>
  )
}

interface ResizeHandleProps {
  active: boolean
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onDoubleClick: () => void
  ariaLabel: string
}

function ResizeHandle({
  active,
  onPointerDown,
  onDoubleClick,
  ariaLabel,
}: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className={cn(
        'group relative z-10 flex w-1.5 flex-shrink-0 cursor-col-resize items-stretch justify-center',
        'transition-colors hover:bg-primary/20',
        active && 'bg-primary/30'
      )}
    >
      {/* 中央視覺提示線，hover 或拖曳時變色 */}
      <div
        className={cn(
          'w-px self-stretch bg-transparent transition-colors',
          'group-hover:bg-primary',
          active && 'bg-primary'
        )}
      />
    </div>
  )
}
