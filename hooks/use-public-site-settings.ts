'use client'

import { useEffect, useState } from 'react'
import {
  PUBLIC_SITE_DEFAULTS,
  type PublicSiteSettings,
} from '@/lib/site-settings-public-types'

export function usePublicSiteSettings() {
  const [settings, setSettings] = useState<PublicSiteSettings>(PUBLIC_SITE_DEFAULTS)

  useEffect(() => {
    let active = true

    fetch('/api/public/site-settings')
      .then((res) => res.json())
      .then((data) => {
        if (!active || !data?.success) return
        setSettings(data.settings)
      })
      .catch(() => {
        // 使用預設值即可
      })

    return () => {
      active = false
    }
  }, [])

  return settings
}
