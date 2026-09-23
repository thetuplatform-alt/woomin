'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

interface MainLayoutFrameProps {
  header: ReactNode
  footer: ReactNode
  children: ReactNode
}

const LEGAL_PATHS = new Set(['/terms', '/privacy'])

export function MainLayoutFrame({ header, footer, children }: MainLayoutFrameProps) {
  const pathname = usePathname()
  const usesDedicatedLegalChrome = LEGAL_PATHS.has(pathname)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!usesDedicatedLegalChrome && header}
      <main className="flex-1">{children}</main>
      {!usesDedicatedLegalChrome && footer}
    </div>
  )
}
