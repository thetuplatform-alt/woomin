// components/main/landing/hero-animation/hero-animation.tsx
// Hero 動畫主組件 - 整合所有圖層與動畫

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CommentBubble } from './comment-bubble'
import { PhoneScreen } from './phone-screen'
import { PersonLayer } from './person-layer'
import { APP_SHOWCASES } from './app-mockups'

type AnimationPhase = 'typing' | 'showcase' | 'transition'

// 動畫時間軸配置（毫秒）
const TIMING = {
  TYPING_DURATION: 2000,      // 3.0s (打提示詞)
  SHOWCASE_DURATION: 3500,    // 3.5s (App 展示)
  TRANSITION_DURATION: 700,   // 0.7s (淡出切換)
  TOTAL_CYCLE: 6200,          // 完整週期
}

export function HeroAnimation() {
  const [currentAppIndex, setCurrentAppIndex] = useState(0)
  const [phase, setPhase] = useState<AnimationPhase>('typing')
  const [isTyping, setIsTyping] = useState(true)
  const [showCursor, setShowCursor] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  // 視差效果狀態
  const [parallaxOffset, setParallaxOffset] = useState({ x: 0, y: 0 })

  // 當前 App 的 prompt
  const currentPrompt = APP_SHOWCASES[currentAppIndex]?.prompt || ''

  // 動畫狀態機
  useEffect(() => {
    const runAnimationCycle = () => {
      // Phase 1: Typing (0 - 2000ms)
      setPhase('typing')
      setIsTyping(true)
      setShowCursor(true)

      // Phase 2: Showcase (2500 - 4000ms)
      const showcaseTimer = setTimeout(() => {
        setPhase('showcase')
      }, TIMING.TYPING_DURATION)

      // Phase 4: Transition (4000 - 4500ms)
      const transitionTimer = setTimeout(() => {
        setPhase('transition')
      }, TIMING.TYPING_DURATION  + TIMING.SHOWCASE_DURATION)

      // 進入下一個 App
      const nextAppTimer = setTimeout(() => {
        setCurrentAppIndex((prev) => (prev + 1) % APP_SHOWCASES.length)
      }, TIMING.TOTAL_CYCLE)

      return () => {
        clearTimeout(showcaseTimer)
        clearTimeout(transitionTimer)
        clearTimeout(nextAppTimer)
      }
    }

    const cleanup = runAnimationCycle()
    return cleanup
  }, [currentAppIndex])

  // 滑鼠視差效果
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    // 計算滑鼠相對於容器中心的偏移（-1 到 1）
    const offsetX = (e.clientX - centerX) / (rect.width / 2)
    const offsetY = (e.clientY - centerY) / (rect.height / 2)

    // 限制偏移範圍
    const clampedX = Math.max(-1, Math.min(1, offsetX))
    const clampedY = Math.max(-1, Math.min(1, offsetY))

    setParallaxOffset({ x: clampedX, y: clampedY })
  }, [])

  // 滑鼠離開時重置
  const handleMouseLeave = useCallback(() => {
    setParallaxOffset({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [handleMouseMove, handleMouseLeave])

  // 計算各圖層的視差偏移量
  // 文字移動最快，手機中等，人物最慢
  const commentOffset = {
    x: parallaxOffset.x * 15,
    y: parallaxOffset.y * 15,
  }
  const phoneOffset = {
    x: parallaxOffset.x * 10,
    y: parallaxOffset.y * 10,
  }
  const personOffset = {
    x: parallaxOffset.x * 5,
    y: parallaxOffset.y * 5,
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-square w-full max-w-[540px]"
    >
      {/* 圖層堆疊（從底到頂）：人物 -> 手機 -> 對話泡泡 */}

      {/* Layer 1: 人物（最底層，移動最慢）*/}
      <div
        className="absolute inset-0 transition-transform duration-200 ease-out lg:translate-x-[10%]"
        style={{
          transform: `translate(${personOffset.x}px, ${personOffset.y}px)`,
        }}
      >
        <PersonLayer />
      </div>

      {/* Layer 2: 手機（中間層，電腦版往右偏移）*/}
      <div
        className="absolute inset-0 translate-y-[60%] md:translate-y-[35%] xl:translate-y-[25%] 2xl:translate-y-[8%] md:translate-x-[-5%] translate-x-[-15%] transition-transform duration-200 ease-out lg:translate-x-[-5%] 2xl:translate-x-[10%]"
        style={{
          transform: `translate(${phoneOffset.x}px, ${phoneOffset.y}px)`,
        }}
      >
        <PhoneScreen
          currentAppIndex={currentAppIndex}
          phase={phase}
        />
      </div>

      {/* Layer 3: 對話泡泡（電腦版往左偏移）*/}
      <div
        className="absolute left-0 top-[15%] z-10 transition-transform duration-200 ease-out lg:-left-[5%]"
        style={{
          transform: `translate(${commentOffset.x}px, ${commentOffset.y}px)`,
          maxWidth: '75%',
        }}
      >
        <CommentBubble
          text={currentPrompt}
          isTyping={isTyping}
          showCursor={showCursor}
        />
      </div>
    </div>
  )
}
