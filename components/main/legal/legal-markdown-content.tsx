'use client'

import { Streamdown } from 'streamdown'

interface LegalMarkdownContentProps {
  content: string
}

export function LegalMarkdownContent({ content }: LegalMarkdownContentProps) {
  return <Streamdown>{content}</Streamdown>
}
