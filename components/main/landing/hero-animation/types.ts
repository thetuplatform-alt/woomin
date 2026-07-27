// components/main/landing/hero-animation/types.ts
// 型別定義

export interface AppShowcase {
  id: string
  name: string
  category: string
  prompt: string
  component: React.ComponentType
}

export interface AnimationPhase {
  phase: 'typing' | 'transform' | 'showcase' | 'transition'
  startTime: number
  duration: number
}

export interface ParallaxOffset {
  x: number
  y: number
}
