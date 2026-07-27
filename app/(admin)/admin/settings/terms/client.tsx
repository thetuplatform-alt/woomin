'use client'

import { LegalMarkdownForm } from '@/components/admin/settings/legal-markdown-form'
import { updateLegalTerms } from '@/lib/actions/settings'

interface TermsEditorClientProps {
  initialContent: string
  defaultSiteName: string
  defaultContactEmail: string
}

export function TermsEditorClient({
  initialContent,
  defaultSiteName,
  defaultContactEmail,
}: TermsEditorClientProps) {
  return (
    <LegalMarkdownForm
      initialContent={initialContent}
      onSave={updateLegalTerms}
      templateType="terms"
      defaultSiteName={defaultSiteName}
      defaultContactEmail={defaultContactEmail}
    />
  )
}
