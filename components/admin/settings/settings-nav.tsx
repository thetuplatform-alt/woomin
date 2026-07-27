'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Settings, CreditCard, Mail, Shield, FileText, Layout } from 'lucide-react'

const navItems = [
  { href: '/admin/settings', label: '基本設定', icon: Settings, exact: true },
  { href: '/admin/settings/layout', label: '版面設定', icon: Layout },
  { href: '/admin/settings/payment', label: '金流設定', icon: CreditCard },
  { href: '/admin/settings/email', label: 'Email 設定', icon: Mail },
  { href: '/admin/settings/privacy', label: '隱私權政策', icon: Shield },
  { href: '/admin/settings/terms', label: '服務條款', icon: FileText },
]

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <div className="flex flex-wrap gap-2">
      {navItems.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors',
              isActive
                ? 'bg-cta text-white'
                : 'bg-white border border-divider text-body hover:bg-surface'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
