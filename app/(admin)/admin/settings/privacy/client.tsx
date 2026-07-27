'use client'

import { LegalMarkdownForm } from '@/components/admin/settings/legal-markdown-form'
import { updateLegalPrivacy } from '@/lib/actions/settings'

interface PrivacyEditorClientProps {
  initialContent: string
  defaultSiteName: string
  defaultContactEmail: string
}

export function PrivacyEditorClient({
  initialContent,
  defaultSiteName,
  defaultContactEmail,
}: PrivacyEditorClientProps) {
  return (
    <LegalMarkdownForm
      initialContent={initialContent}
      onSave={updateLegalPrivacy}
      templateType="privacy"
      defaultSiteName={defaultSiteName}
      defaultContactEmail={defaultContactEmail}
    />
  )
}
