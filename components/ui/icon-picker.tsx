'use client'

import * as React from 'react'
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { icons, type LucideIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'

// 預先建立 icon 名稱清單（只建立一次）
const ICON_NAMES = Object.keys(icons)

// 每頁載入數量
const PAGE_SIZE = 80

interface IconPickerProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
}

export function IconPicker({ value, onChange, placeholder = '選擇圖示' }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const gridRef = useRef<HTMLDivElement>(null)

  // 篩選 icon
  const filteredIcons = useMemo(() => {
    if (!search) return ICON_NAMES
    const lower = search.toLowerCase()
    return ICON_NAMES.filter((name) => name.toLowerCase().includes(lower))
  }, [search])

  // 只渲染可見範圍
  const visibleIcons = useMemo(
    () => filteredIcons.slice(0, visibleCount),
    [filteredIcons, visibleCount]
  )

  // 捲動載入更多
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget
      if (target.scrollTop + target.clientHeight >= target.scrollHeight - 50) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredIcons.length))
      }
    },
    [filteredIcons.length]
  )

  // 搜尋時重置捲動
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [search])

  // 選中的 icon 元件
  const SelectedIcon = value ? icons[value as keyof typeof icons] : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-1.5 h-7 rounded border px-2 text-xs transition-colors ${
            value
              ? 'border-[#E5E5E5] bg-white text-[#525252] hover:border-[#F5A524]'
              : 'border-dashed border-[#D4D4D4] bg-[#FAFAFA] text-[#A3A3A3] hover:border-[#F5A524] hover:text-[#525252]'
          }`}
        >
          {SelectedIcon ? (
            <>
              <SelectedIcon className="h-3.5 w-3.5" />
              <span className="max-w-[60px] truncate">{value}</span>
            </>
          ) : (
            <span>{placeholder}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] p-0"
        align="start"
        side="bottom"
      >
        {/* 搜尋欄 */}
        <div className="flex items-center gap-2 border-b border-[#E5E5E5] px-3 py-2">
          <Search className="h-4 w-4 text-[#A3A3A3] flex-shrink-0" />
          <Input
            placeholder="搜尋圖示名稱..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
              className="flex-shrink-0 p-0.5 text-[#A3A3A3] hover:text-red-500 transition-colors"
              title="清除圖示"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* 圖示數量提示 */}
        <div className="px-3 py-1.5 text-xs text-[#A3A3A3] border-b border-[#F5F5F5]">
          {filteredIcons.length} 個圖示{search ? `（搜尋「${search}」）` : ''}
        </div>

        {/* 圖示網格 */}
        <div
          ref={gridRef}
          className="grid grid-cols-8 gap-0.5 p-2 max-h-[240px] overflow-y-auto"
          onScroll={handleScroll}
        >
          {visibleIcons.map((name) => {
            const Icon = icons[name as keyof typeof icons] as LucideIcon
            const isSelected = value === name
            return (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => {
                  onChange(name)
                  setOpen(false)
                  setSearch('')
                }}
                className={`flex items-center justify-center rounded p-1.5 transition-colors ${
                  isSelected
                    ? 'bg-[#F5A524] text-white'
                    : 'text-[#525252] hover:bg-[#F5F5F5] hover:text-[#0A0A0A]'
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            )
          })}
          {visibleIcons.length === 0 && (
            <div className="col-span-8 py-6 text-center text-xs text-[#A3A3A3]">
              找不到符合的圖示
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
