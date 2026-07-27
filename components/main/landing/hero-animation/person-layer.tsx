// components/main/landing/hero-animation/person-layer.tsx
// 人物圖層組件

'use client'

import Image from 'next/image'

interface PersonLayerProps {
  className?: string
}

export function PersonLayer({ className = '' }: PersonLayerProps) {
  return (
    <div className={`relative ${className}`}>
      <Image
        src="/hero-main.png"
        alt="Person working"
        width={1024}
        height={1024}
        className="h-full w-full object-contain"
        priority
      />
    </div>
  )
}
