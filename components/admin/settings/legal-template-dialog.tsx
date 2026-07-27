'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  buildPrivacyTemplate,
  buildTermsTemplate,
} from './legal-templates'

interface LegalTemplateDialogProps {
  type: 'privacy' | 'terms'
  defaultSiteName: string
  defaultContactEmail: string
  hasExistingContent: boolean
  onApply: (markdown: string) => void
}

export function LegalTemplateDialog({
  type,
  defaultSiteName,
  defaultContactEmail,
  hasExistingContent,
  onApply,
}: LegalTemplateDialogProps) {
  const [open, setOpen] = useState(false)
  const [siteName, setSiteName] = useState(defaultSiteName)
  const [contactEmail, setContactEmail] = useState(defaultContactEmail)

  const label = type === 'privacy' ? '隱私權政策' : '服務條款'

  function handleOpenChange(next: boolean) {
    if (next) {
      setSiteName(defaultSiteName)
      setContactEmail(defaultContactEmail)
    }
    setOpen(next)
  }

  function handleApply() {
    const trimmedName = siteName.trim()
    const trimmedEmail = contactEmail.trim()

    if (!trimmedName) {
      return
    }
    if (!trimmedEmail) {
      return
    }

    if (hasExistingContent) {
      const confirmed = window.confirm(
        `套用模板將會覆寫目前的${label}內容，且無法復原。確定要繼續嗎？`,
      )
      if (!confirmed) return
    }

    const markdown =
      type === 'privacy'
        ? buildPrivacyTemplate({ siteName: trimmedName, contactEmail: trimmedEmail })
        : buildTermsTemplate({ siteName: trimmedName, contactEmail: trimmedEmail })

    onApply(markdown)
    setOpen(false)
  }

  const canApply = siteName.trim().length > 0 && contactEmail.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-tour="legal-template-btn">
          <Sparkles className="h-4 w-4" />
          套用模板
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>套用{label}模板</DialogTitle>
          <DialogDescription>
            系統會以通用範本建立{label}內容，並將下列資訊代入文件中。套用後仍可自行編輯調整。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="legal-template-site-name">課程平台名稱</Label>
            <Input
              id="legal-template-site-name"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="例如：Fish 的 AI Coding 課程"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legal-template-contact-email">客服聯絡信箱</Label>
            <Input
              id="legal-template-contact-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="例如：support@example.com"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleApply} disabled={!canApply}>
            套用模板
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
