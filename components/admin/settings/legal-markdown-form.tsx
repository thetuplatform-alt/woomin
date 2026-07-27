'use client'

import { useTransition, useState } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { StickySaveBar } from '@/components/admin/shared/sticky-save-bar'
import { LegalTemplateDialog } from './legal-template-dialog'

// 動態載入 Milkdown 編輯器（1MB+ ProseMirror 生態），設定頁外殼可即時呈現
const MilkdownMarkdownEditor = dynamic(
  () => import('@/components/admin/curriculum/milkdown-editor').then((m) => m.MilkdownMarkdownEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-caption">
        編輯器載入中…
      </div>
    ),
  }
)

interface LegalMarkdownFormProps {
  initialContent: string
  onSave: (markdown: string) => Promise<{ success: boolean; error?: string }>
  templateType?: 'privacy' | 'terms'
  defaultSiteName?: string
  defaultContactEmail?: string
}

export function LegalMarkdownForm({
  initialContent,
  onSave,
  templateType,
  defaultSiteName,
  defaultContactEmail,
}: LegalMarkdownFormProps) {
  const [isPending, startTransition] = useTransition()
  const [content, setContent] = useState(initialContent)
  const [editorKey, setEditorKey] = useState(0)
  const isDirty = content !== initialContent

  function handleSubmit() {
    startTransition(async () => {
      const result = await onSave(content)
      if (result.success) {
        toast.success('已儲存')
      } else {
        toast.error(result.error || '儲存失敗')
      }
    })
  }

  function handleApplyTemplate(markdown: string) {
    setContent(markdown)
    setEditorKey((k) => k + 1)
    toast.success('已套用模板，請檢查內容後再儲存')
  }

  return (
    <>
      {templateType && (
        <div className="flex justify-end">
          <LegalTemplateDialog
            type={templateType}
            defaultSiteName={defaultSiteName ?? ''}
            defaultContactEmail={defaultContactEmail ?? ''}
            hasExistingContent={content.trim().length > 0}
            onApply={handleApplyTemplate}
          />
        </div>
      )}

      <div data-tour="legal-editor">
        <MilkdownMarkdownEditor
          key={editorKey}
          value={content}
          onChange={setContent}
          placeholder="使用 Markdown 語法編輯內容..."
          showLessonTools={false}
        />
      </div>

      <StickySaveBar
        isDirty={isDirty}
        isPending={isPending}
        onSubmit={handleSubmit}
      />
    </>
  )
}
