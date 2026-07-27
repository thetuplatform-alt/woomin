// components/admin/curriculum/markdown-editor.tsx
// Markdown 編輯器元件
// 左側編輯、右側預覽

'use client'

import { useCallback } from 'react'
import { Streamdown } from 'streamdown'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Bold,
  Italic,
  Link,
  Code,
  Image,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Quote,
} from 'lucide-react'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = '輸入內容...',
}: MarkdownEditorProps) {
  // 插入 Markdown 語法
  const insertMarkdown = useCallback(
    (prefix: string, suffix: string = '', placeholder: string = '') => {
      const textarea = document.querySelector(
        'textarea[data-markdown-editor]'
      ) as HTMLTextAreaElement

      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selectedText = value.substring(start, end)
      const textToInsert = selectedText || placeholder

      const newValue =
        value.substring(0, start) +
        prefix +
        textToInsert +
        suffix +
        value.substring(end)

      onChange(newValue)

      // 設定新的游標位置
      setTimeout(() => {
        textarea.focus()
        const newCursorPos = start + prefix.length + textToInsert.length
        textarea.setSelectionRange(newCursorPos, newCursorPos)
      }, 0)
    },
    [value, onChange]
  )

  // 工具列按鈕
  const toolbarButtons = [
    {
      icon: Heading1,
      label: '標題 1',
      action: () => insertMarkdown('# ', '', '標題'),
    },
    {
      icon: Heading2,
      label: '標題 2',
      action: () => insertMarkdown('## ', '', '標題'),
    },
    {
      icon: Bold,
      label: '粗體',
      action: () => insertMarkdown('**', '**', '粗體文字'),
    },
    {
      icon: Italic,
      label: '斜體',
      action: () => insertMarkdown('*', '*', '斜體文字'),
    },
    {
      icon: Link,
      label: '連結',
      action: () => insertMarkdown('[', '](https://)', '連結文字'),
    },
    {
      icon: Image,
      label: '圖片',
      action: () => insertMarkdown('![', '](https://)', '圖片描述'),
    },
    {
      icon: Code,
      label: '程式碼區塊',
      action: () => insertMarkdown('```\n', '\n```', '程式碼'),
    },
    {
      icon: List,
      label: '無序列表',
      action: () => insertMarkdown('- ', '', '項目'),
    },
    {
      icon: ListOrdered,
      label: '有序列表',
      action: () => insertMarkdown('1. ', '', '項目'),
    },
    {
      icon: Quote,
      label: '引用',
      action: () => insertMarkdown('> ', '', '引用文字'),
    },
  ]

  return (
    <div className="space-y-4">
      {/* 工具列 */}
      <div className="flex flex-wrap gap-1 p-2 bg-surface rounded-xl border border-divider">
        {toolbarButtons.map((button, index) => (
          <Button
            key={index}
            type="button"
            variant="ghost"
            size="sm"
            onClick={button.action}
            className="h-8 w-8 p-0 text-body hover:text-heading hover:bg-white"
            title={button.label}
          >
            <button.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      {/* 編輯器和預覽 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 編輯區 */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-body">編輯</div>
          <Textarea
            data-markdown-editor
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-[400px] bg-white border-divider text-heading placeholder:text-caption font-mono text-sm resize-none"
          />
        </div>

        {/* 預覽區 */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-body">預覽</div>
          <div className="min-h-[400px] p-4 bg-white border border-divider rounded-xl overflow-auto">
            {value ? (
              <div className="prose prose-sm max-w-none prose-headings:text-heading prose-p:text-body prose-a:text-cta prose-strong:text-heading prose-code:text-cta prose-code:bg-surface prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-surface prose-blockquote:border-divider prose-blockquote:text-body prose-li:text-body">
                <Streamdown>{value}</Streamdown>
              </div>
            ) : (
              <div className="text-caption text-sm">尚無內容</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
