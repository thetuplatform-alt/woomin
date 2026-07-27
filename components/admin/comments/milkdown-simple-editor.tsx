// components/admin/comments/milkdown-simple-editor.tsx
// 精簡版 Milkdown WYSIWYG 編輯器（無時間戳，適用於回覆/歡迎信）

'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core'
import {
  commonmark,
  toggleStrongCommand,
  toggleEmphasisCommand,
  wrapInHeadingCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  toggleInlineCodeCommand,
  insertHrCommand,
  toggleLinkCommand,
} from '@milkdown/kit/preset/commonmark'
import { history } from '@milkdown/kit/plugin/history'
import { Milkdown, MilkdownProvider, useEditor, useInstance } from '@milkdown/react'
import { callCommand, replaceAll } from '@milkdown/kit/utils'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Bold,
  Italic,
  Link,
  Code,
  List,
  ListOrdered,
  Quote,
  Minus,
  Eye,
  FileCode2,
  ChevronDown,
} from 'lucide-react'

// ==================== Types ====================

interface MilkdownSimpleEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  editorKey?: string
  minHeight?: string
}

type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3'
type EditorMode = 'wysiwyg' | 'markdown'

function normalizeLinkHref(href: string): string {
  const value = href.trim()
  if (
    value.startsWith('/') ||
    value.startsWith('#') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('mailto:') ||
    value.startsWith('tel:')
  ) {
    return value
  }

  return `https://${value}`
}

function LinkPopover({
  disabled,
  onApply,
}: {
  disabled?: boolean
  onApply: (href: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [href, setHref] = useState('')

  const handleApply = () => {
    const normalizedHref = normalizeLinkHref(href)
    if (!normalizedHref) return

    onApply(normalizedHref)
    setHref('')
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleApply()
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-8 w-8 p-0 text-body hover:text-heading hover:bg-white"
          title="連結"
        >
          <Link className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          <label className="text-sm font-medium text-heading" htmlFor="comment-link-url">
            連結網址
          </label>
          <input
            id="comment-link-url"
            type="url"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://drive.google.com/..."
            className="h-9 w-full rounded-md border border-divider bg-white px-3 text-sm text-heading placeholder:text-caption focus:outline-none focus:ring-1 focus:ring-cta"
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            onClick={handleApply}
            disabled={!href.trim()}
            className="w-full bg-cta text-white hover:bg-cta-hover"
          >
            套用連結
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ==================== Block Type Selector ====================

const blockTypeOptions: { value: BlockType; label: string }[] = [
  { value: 'paragraph', label: '段落' },
  { value: 'h1', label: '標題 1' },
  { value: 'h2', label: '標題 2' },
  { value: 'h3', label: '標題 3' },
]

function BlockTypeSelector({
  disabled,
  onSelect,
}: {
  disabled?: boolean
  onSelect: (type: BlockType) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-8 px-2 gap-1 text-body hover:text-heading hover:bg-white min-w-[80px] justify-between"
        >
          <span className="text-xs">段落</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-1" align="start">
        {blockTypeOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              onSelect(option.value)
              setOpen(false)
            }}
            className="w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-surface text-heading"
          >
            {option.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

// ==================== Toolbar ====================

function SimpleToolbar() {
  const [loading, getInstance] = useInstance()

  const call = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (command: any, payload?: any) => {
      if (loading) return
      const editor = getInstance()
      editor?.action(callCommand(command, payload))
    },
    [loading, getInstance]
  )

  const handleBlockType = useCallback(
    (type: BlockType) => {
      if (loading) return
      const editor = getInstance()
      if (!editor) return
      switch (type) {
        case 'h1':
          editor.action(callCommand(wrapInHeadingCommand.key, 1))
          break
        case 'h2':
          editor.action(callCommand(wrapInHeadingCommand.key, 2))
          break
        case 'h3':
          editor.action(callCommand(wrapInHeadingCommand.key, 3))
          break
        case 'paragraph':
          editor.action(callCommand(wrapInHeadingCommand.key, 0))
          break
      }
    },
    [loading, getInstance]
  )

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-2 bg-surface rounded-xl border border-divider">
      <BlockTypeSelector disabled={loading} onSelect={handleBlockType} />
      <ToolbarSeparator />
      <ToolbarButton icon={Bold} label="粗體" disabled={loading} onClick={() => call(toggleStrongCommand.key)} />
      <ToolbarButton icon={Italic} label="斜體" disabled={loading} onClick={() => call(toggleEmphasisCommand.key)} />
      <ToolbarButton icon={Code} label="行內程式碼" disabled={loading} onClick={() => call(toggleInlineCodeCommand.key)} />
      <LinkPopover disabled={loading} onApply={(href) => call(toggleLinkCommand.key, { href })} />
      <ToolbarSeparator />
      <ToolbarButton icon={List} label="無序列表" disabled={loading} onClick={() => call(wrapInBulletListCommand.key)} />
      <ToolbarButton icon={ListOrdered} label="有序列表" disabled={loading} onClick={() => call(wrapInOrderedListCommand.key)} />
      <ToolbarButton icon={Quote} label="引用" disabled={loading} onClick={() => call(wrapInBlockquoteCommand.key)} />
      <ToolbarButton icon={Minus} label="分隔線" disabled={loading} onClick={() => call(insertHrCommand.key)} />
    </div>
  )
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="h-8 w-8 p-0 text-body hover:text-heading hover:bg-white"
      title={label}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}

function ToolbarSeparator() {
  return <div className="w-px h-5 bg-heading mx-1" />
}

// ==================== Milkdown Core ====================

function MilkdownCore({
  value,
  onChange,
}: {
  value: string
  onChange: (markdown: string) => void
}) {
  const onChangeRef = useRef(onChange)

  const lastEditorMarkdownRef = useRef(value)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, value)
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) {
            lastEditorMarkdownRef.current = markdown
            onChangeRef.current(markdown)
          }
        })
      })
      .use(commonmark)
      .use(history)
      .use(listener)
  }, [])

  const [loading, getInstance] = useInstance()

  useEffect(() => {
    if (loading) return
    const editor = getInstance()
    if (!editor) return
    if (value !== lastEditorMarkdownRef.current) {
      lastEditorMarkdownRef.current = value
      editor.action(replaceAll(value))
    }
  }, [value, loading, getInstance])

  return <Milkdown />
}

// ==================== Main Component ====================

export function MilkdownSimpleEditor({
  value,
  onChange,
  placeholder = '輸入內容...',
  editorKey: externalKey,
  minHeight = '200px',
}: MilkdownSimpleEditorProps) {
  const [mode, setMode] = useState<EditorMode>('wysiwyg')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const latestValueRef = useRef(value)

  useEffect(() => {
    latestValueRef.current = value
  }, [value])

  const handleWysiwygChange = useCallback(
    (markdown: string) => {
      latestValueRef.current = markdown
      onChange(markdown)
    },
    [onChange]
  )

  const handleRawChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      latestValueRef.current = newValue
      onChange(newValue)
    },
    [onChange]
  )

  const [internalKey, setInternalKey] = useState(0)

  const handleModeSwitch = useCallback(
    (newMode: EditorMode) => {
      if (newMode === mode) return
      setMode(newMode)
      if (newMode === 'wysiwyg') {
        setInternalKey((k) => k + 1)
      }
    },
    [mode]
  )

  const combinedKey = `${externalKey ?? ''}__${internalKey}`

  return (
    <div className="space-y-2">
      {/* Mode Switch */}
      <div className="flex items-center">
        <div className="flex items-center bg-surface-hover rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => handleModeSwitch('wysiwyg')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === 'wysiwyg'
                ? 'bg-white text-heading shadow-sm'
                : 'text-body hover:text-heading'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            編輯
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('markdown')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === 'markdown'
                ? 'bg-white text-heading shadow-sm'
                : 'text-body hover:text-heading'
            }`}
          >
            <FileCode2 className="h-3.5 w-3.5" />
            Markdown
          </button>
        </div>
      </div>

      {/* WYSIWYG Mode */}
      {mode === 'wysiwyg' && (
        <MilkdownProvider key={combinedKey}>
          <SimpleToolbar />
          <div
            className="milkdown-editor-wrapper p-4 bg-white border border-divider rounded-xl overflow-auto prose prose-sm max-w-none prose-headings:text-heading prose-p:text-body prose-a:text-cta prose-strong:text-heading prose-code:text-cta prose-code:bg-surface prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-surface prose-blockquote:border-divider prose-blockquote:text-body prose-li:text-body"
            style={{ minHeight }}
          >
            <MilkdownCore value={value} onChange={handleWysiwygChange} />
          </div>
        </MilkdownProvider>
      )}

      {/* Raw Markdown Mode */}
      {mode === 'markdown' && (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleRawChange}
          placeholder={placeholder}
          className="bg-white border-divider text-heading placeholder:text-caption font-mono text-sm resize-none rounded-xl"
          style={{ minHeight }}
        />
      )}
    </div>
  )
}
