// components/admin/mobile-nav.tsx
// 後台行動版導覽元件
// 使用 Sheet 元件實現側邊滑出選單

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Menu } from 'lucide-react'
import { sidebarGroups } from './sidebar'
import { usePublicSiteSettings } from '@/hooks/use-public-site-settings'

interface MobileNavProps {
  userRole?: string
}

export function MobileNav({ userRole }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const { siteName } = usePublicSiteSettings()

  useEffect(() => {
    setMounted(true)
  }, [])

  const triggerButton = (
    <Button
      variant="ghost"
      size="icon"
      className="lg:hidden text-muted-foreground hover:text-foreground hover:bg-secondary"
      type="button"
    >
      <Menu className="h-6 w-6" />
      <span className="sr-only">開啟選單</span>
    </Button>
  )

  if (!mounted) return triggerButton

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {triggerButton}
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-64 p-0 bg-card border-border"
      >
        <SheetHeader className="px-6 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cta flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <span className="font-semibold text-foreground">{siteName}</span>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {sidebarGroups.map((group, groupIndex) => {
            const visibleItems = group.items.filter(
              (item) => !item.adminOnly || userRole === 'ADMIN'
            )

            // 整組項目都被權限濾掉時，連分組標題一起隱藏
            if (visibleItems.length === 0) return null

            return (
              <div key={group.label ?? `group-${groupIndex}`} className="space-y-1">
                {group.label && (
                  <p className="px-3 pb-1 pt-3 text-[11px] font-medium tracking-wide text-muted-foreground/70">
                    {group.label}
                  </p>
                )}

                {visibleItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/admin' && pathname.startsWith(item.href))

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'admin-nav-active font-semibold'
                          : 'text-muted-foreground/80 hover:bg-secondary/60 hover:text-foreground'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.title}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
