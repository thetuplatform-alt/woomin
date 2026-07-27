// components/main/landing/hero-animation/comment-bubble.tsx
// 對話泡泡組件 - 包含打字動畫（純 CSS 實作，無背景圖片）

'use client'

import { useState, useEffect } from 'react'

interface CommentBubbleProps {
  text: string
  isTyping: boolean
  showCursor: boolean
  className?: string
}

export function CommentBubble({
  text,
  isTyping,
  showCursor,
  className = '',
}: CommentBubbleProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [cursorVisible, setCursorVisible] = useState(true)

  // 打字動畫效果
  useEffect(() => {
    if (!isTyping) {
      setDisplayedText(text)
      return
    }

    setDisplayedText('')
    let currentIndex = 0
    const typingInterval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1))
        currentIndex++
      } else {
        clearInterval(typingInterval)
      }
    }, 50) // 每 50ms 顯示一個字（配適 3 秒的時程）

    return () => clearInterval(typingInterval)
  }, [text, isTyping])

  // 游標閃爍
  useEffect(() => {
    if (!showCursor) {
      setCursorVisible(false)
      return
    }

    const cursorInterval = setInterval(() => {
      setCursorVisible((prev) => !prev)
    }, 530)

    return () => clearInterval(cursorInterval)
  }, [showCursor])

  return (
    <div className={`${className}`}>
      {/* 對話泡泡 - 純 CSS 實作 */}
      <div className="relative inline-block max-w-md rounded-2xl border border-divider bg-white px-4 py-3 shadow-sm">
        {/* 文字內容 */}
        <p className="text-sm font-medium leading-relaxed text-heading sm:text-base">
          {displayedText}
          {showCursor && cursorVisible && (
            <span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[2px] bg-heading" />
          )}
        </p>

        {/* 對話泡泡尾巴 */}
        <div className="absolute -bottom-2 left-6 h-4 w-4 rotate-45 border-b border-r border-divider bg-white" />
      </div>
    </div>
  )
}
