// components/admin/curriculum/milkdown-editor.tsx
// Milkdown WYSIWYG Markdown 編輯器
// 支援 WYSIWYG / 原始 Markdown 雙模式切換
// 內建時間戳 (timestamp) 自訂 inline node

'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core'
import { commonmark, toggleStrongCommand, toggleEmphasisCommand, wrapInHeadingCommand, wrapInBlockquoteCommand, wrapInBulletListCommand, wrapInOrderedListCommand, toggleInlineCodeCommand, insertHrCommand, toggleLinkCommand } from '@milkdown/kit/preset/commonmark'
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
  Clock,
  Eye,
  ChevronDown,
  FileCode2,
  FileText,
} from 'lucide-react'
import {
  timestampNode,
  timestampInputRule,
  insertTimestampCommand,
  remarkTimestampPlugin,
  formatSeconds,
} from './milkdown-timestamp-plugin'
import {
  buildPdfDirective,
  insertPdfCommand,
  pdfInputRule,
  pdfNode,
  remarkDirectivePlugin,
  type PdfDirectiveAttrs,
} from './milkdown-pdf-plugin'

// ==================== Types ====================

interface MilkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** 當此 key 改變時，WYSIWYG editor 會重新掛載（例如傳 lessonId） */
  editorKey?: string
  mediaSourceId?: string
  mediaSourceUrl?: string
  /**
   * 是否顯示課程單元專用的插入工具（時間戳、PDF 講義）。
   * 預設 true（課程管理使用）；服務條款 / 隱私權政策等純文字頁面可傳 false 隱藏。
   */
  showLessonTools?: boolean
}

type EditorMode = 'wysiwyg' | 'markdown'
type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3'

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

// ==================== Timestamp Popover ====================

function TimestampPopover({
  onInsert,
  disabled,
}: {
  onInsert: (seconds: number, display: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [minutes, setMinutes] = useState('')
  const [seconds, setSeconds] = useState('')

  const handleInsert = () => {
    const mins = parseInt(minutes || '0', 10)
    const secs = parseInt(seconds || '0', 10)
    const totalSeconds = mins * 60 + secs
    const display = formatSeconds(totalSeconds)
    onInsert(totalSeconds, display)
    setMinutes('')
    setSeconds('')
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleInsert()
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
          className="h-8 px-2 gap-1 text-body hover:text-heading hover:bg-white"
          title="插入時間戳"
        >
          <Clock className="h-4 w-4" />
          <span className="text-xs">時間戳</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <div className="text-sm font-medium text-heading">插入時間戳</div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-xs text-body mb-1 block">分鐘</label>
              <input
                type="number"
                min="0"
                max="999"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="00"
                className="w-full h-8 px-2 text-sm border border-divider rounded-md bg-white text-heading focus:outline-none focus:ring-1 focus:ring-cta"
                autoFocus
              />
            </div>
            <span className="text-lg font-bold text-body mt-4">:</span>
            <div className="flex-1">
              <label className="text-xs text-body mb-1 block">秒數</label>
              <input
                type="number"
                min="0"
                max="59"
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="00"
                className="w-full h-8 px-2 text-sm border border-divider rounded-md bg-white text-heading focus:outline-none focus:ring-1 focus:ring-cta"
              />
            </div>
          </div>
          <div className="text-xs text-caption">
            預覽：▶{' '}
            {formatSeconds(
              (parseInt(minutes || '0', 10)) * 60 +
                parseInt(seconds || '0', 10)
            )}
          </div>
          <Button
            size="sm"
            onClick={handleInsert}
            className="w-full bg-cta hover:bg-cta-hover text-white"
          >
            插入
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
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
          <label className="text-sm font-medium text-heading" htmlFor="lesson-link-url">
            連結網址
          </label>
          <input
            id="lesson-link-url"
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

function PdfUploadPopover({
  disabled,
  onInsert,
  sourceId,
  sourceUrl,
}: {
  disabled?: boolean
  onInsert: (attrs: PdfDirectiveAttrs) => void
  sourceId?: string
  sourceUrl?: string
}) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [watermark, setWatermark] = useState(true)
  const [dynamicWatermark, setDynamicWatermark] = useState(true)
  const [allowDownload, setAllowDownload] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      window.alert('請上傳 PDF 檔案')
      event.target.value = ''
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      window.alert('PDF 大小不能超過 50MB')
      event.target.value = ''
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('watermark', watermark ? 'true' : 'false')
      formData.append('allowDownload', allowDownload ? 'true' : 'false')
      formData.append('dynamicWatermarkEnabled', dynamicWatermark ? 'true' : 'false')
      if (sourceId) formData.append('sourceId', sourceId)
      if (sourceUrl) formData.append('sourceUrl', sourceUrl)

      const uploadRes = await fetch('/api/admin/media/pdf-upload', {
        method: 'POST',
        body: formData,
      })
      const record = await uploadRes.json()
      if (!uploadRes.ok || !record?.success) {
        throw new Error(record?.error || 'PDF 上傳失敗')
      }

      onInsert({
        url: record.url,
        title: file.name,
        watermark,
      })
      setOpen(false)
    } catch (error) {
      console.error(error)
      window.alert(error instanceof Error ? error.message : 'PDF 上傳失敗')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || uploading}
          className="h-8 px-2 gap-1 text-body hover:text-heading hover:bg-white"
          title="上傳 PDF 講義"
        >
          <FileText className="h-4 w-4" />
          <span className="text-xs">PDF</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium text-heading">上傳 PDF 講義</div>
            <p className="mt-0.5 text-xs text-caption">
              選擇學員觀看時的保護方式，上傳後仍可在「媒體 → 附件」調整
            </p>
          </div>

          <div className="space-y-2.5 rounded-lg border border-divider bg-surface p-3">
            <label className="flex items-start gap-2.5 text-sm text-body cursor-pointer">
              <input
                type="checkbox"
                checked={watermark}
                onChange={(e) => setWatermark(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-divider"
              />
              <div className="flex-1">
                <div className="font-medium text-heading">PDF 加上站台浮水印</div>
                <div className="mt-0.5 text-xs text-caption">
                  上傳時把站台網址燒進 PDF，所有學員看到的版本都一樣
                </div>
              </div>
            </label>

            <label className="flex items-start gap-2.5 text-sm text-body cursor-pointer">
              <input
                type="checkbox"
                checked={dynamicWatermark}
                onChange={(e) => setDynamicWatermark(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-divider"
              />
              <div className="flex-1">
                <div className="font-medium text-heading">學員觀看時加上個人浮水印</div>
                <div className="mt-0.5 text-xs text-caption">
                  在預覽畫面動態疊上學員 Email / 姓名，能追溯外流來源
                </div>
              </div>
            </label>

            <label className="flex items-start gap-2.5 text-sm text-body cursor-pointer">
              <input
                type="checkbox"
                checked={allowDownload}
                onChange={(e) => setAllowDownload(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-divider"
              />
              <div className="flex-1">
                <div className="font-medium text-heading">允許學員下載原檔</div>
                <div className="mt-0.5 text-xs text-caption">
                  關閉時只能線上閱讀，且無「下載 / 開新分頁」按鈕（建議付費課程關閉）
                </div>
              </div>
            </label>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full bg-cta text-white hover:bg-cta-hover"
          >
            {uploading ? '上傳中...' : '選擇 PDF 並上傳'}
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

// ==================== WYSIWYG Toolbar ====================

function WysiwygToolbar({
  mediaSourceId,
  mediaSourceUrl,
  showLessonTools = true,
}: {
  mediaSourceId?: string
  mediaSourceUrl?: string
  showLessonTools?: boolean
}) {
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
          // downgrade heading → paragraph: set heading level 0 or use turnIntoText
          editor.action(callCommand(wrapInHeadingCommand.key, 0))
          break
      }
    },
    [loading, getInstance]
  )

  const handleInsertTimestamp = useCallback(
    (seconds: number, display: string) => {
      if (loading) return
      const editor = getInstance()
      editor?.action(
        callCommand(insertTimestampCommand.key, { seconds, display })
      )
    },
    [loading, getInstance]
  )

  const handleInsertPdf = useCallback(
    (attrs: PdfDirectiveAttrs) => {
      if (loading) return
      const editor = getInstance()
      editor?.action(callCommand(insertPdfCommand.key, attrs))
    },
    [loading, getInstance]
  )

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-2 bg-surface rounded-xl border border-divider">
      {/* Block type selector */}
      <BlockTypeSelector disabled={loading} onSelect={handleBlockType} />

      <Separator />

      {/* Inline formatting */}
      <ToolbarButton
        icon={Bold}
        label="粗體"
        disabled={loading}
        onClick={() => call(toggleStrongCommand.key)}
      />
      <ToolbarButton
        icon={Italic}
        label="斜體"
        disabled={loading}
        onClick={() => call(toggleEmphasisCommand.key)}
      />
      <ToolbarButton
        icon={Code}
        label="行內程式碼"
        disabled={loading}
        onClick={() => call(toggleInlineCodeCommand.key)}
      />
      <LinkPopover
        disabled={loading}
        onApply={(href) => call(toggleLinkCommand.key, { href })}
      />

      <Separator />

      {/* Block actions */}
      <ToolbarButton
        icon={List}
        label="無序列表"
        disabled={loading}
        onClick={() => call(wrapInBulletListCommand.key)}
      />
      <ToolbarButton
        icon={ListOrdered}
        label="有序列表"
        disabled={loading}
        onClick={() => call(wrapInOrderedListCommand.key)}
      />
      <ToolbarButton
        icon={Quote}
        label="引用"
        disabled={loading}
        onClick={() => call(wrapInBlockquoteCommand.key)}
      />
      <ToolbarButton
        icon={Minus}
        label="分隔線"
        disabled={loading}
        onClick={() => call(insertHrCommand.key)}
      />

      {showLessonTools && (
        <>
          <Separator />

          {/* Timestamp / PDF（課程單元專用） */}
          <TimestampPopover onInsert={handleInsertTimestamp} disabled={loading} />
          <PdfUploadPopover
            onInsert={handleInsertPdf}
            disabled={loading}
            sourceId={mediaSourceId}
            sourceUrl={mediaSourceUrl}
          />
        </>
      )}
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

function Separator() {
  return <div className="w-px h-5 bg-heading mx-1" />
}

// ==================== Milkdown WYSIWYG Core ====================

function MilkdownEditorCore({
  value,
  onChange,
}: {
  value: string
  onChange: (markdown: string) => void
}) {
  const onChangeRef = useRef(onChange)

  // 追蹤 editor 內部最後一次產出的 markdown，用來區分外部驅動 vs 用戶編輯
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
      .use(remarkDirectivePlugin)
      .use(commonmark)
      .use(history)
      .use(listener)
      .use(remarkTimestampPlugin)
      .use(timestampNode)
      .use(timestampInputRule)
      .use(insertTimestampCommand)
      .use(pdfNode)
      .use(pdfInputRule)
      .use(insertPdfCommand)
  }, [])

  // 當外部 value 變化（例如切換 lesson、初始載入延遲）時，同步到 editor
  const [loading, getInstance] = useInstance()

  useEffect(() => {
    if (loading) return
    const editor = getInstance()
    if (!editor) return
    // 只有當外部 value 與 editor 內部的最後產出不同時才 replaceAll
    // 這避免了用戶打字 → onChange → value 更新 → replaceAll 的死循環
    if (value !== lastEditorMarkdownRef.current) {
      lastEditorMarkdownRef.current = value
      editor.action(replaceAll(value))
    }
  }, [value, loading, getInstance])

  return <Milkdown />
}

// ==================== Raw Markdown Toolbar ====================

function RawMarkdownToolbar({
  onInsertTimestamp,
  onInsertPdf,
  mediaSourceId,
  mediaSourceUrl,
}: {
  onInsertTimestamp: (seconds: number, display: string) => void
  onInsertPdf: (attrs: PdfDirectiveAttrs) => void
  mediaSourceId?: string
  mediaSourceUrl?: string
}) {
  return (
    <div className="flex items-center gap-0.5 p-2 bg-surface rounded-xl border border-divider">
      <TimestampPopover onInsert={onInsertTimestamp} />
      <PdfUploadPopover
        onInsert={onInsertPdf}
        sourceId={mediaSourceId}
        sourceUrl={mediaSourceUrl}
      />
    </div>
  )
}

// ==================== Main Component ====================

export function MilkdownMarkdownEditor({
  value,
  onChange,
  placeholder = '輸入內容...',
  editorKey: externalKey,
  mediaSourceId,
  mediaSourceUrl,
  showLessonTools = true,
}: MilkdownEditorProps) {
  const [mode, setMode] = useState<EditorMode>('wysiwyg')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // 用 ref 追蹤最新的 value，避免 Milkdown onChange 回寫時觸發不必要的重掛載
  const latestValueRef = useRef(value)

  useEffect(() => {
    latestValueRef.current = value
  }, [value])

  // WYSIWYG mode onChange
  const handleWysiwygChange = useCallback(
    (markdown: string) => {
      latestValueRef.current = markdown
      onChange(markdown)
    },
    [onChange]
  )

  // Raw markdown mode onChange
  const handleRawChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      latestValueRef.current = newValue
      onChange(newValue)
    },
    [onChange]
  )

  // Raw mode: insert timestamp at cursor
  const handleRawInsertTimestamp = useCallback(
    (seconds: number, display: string) => {
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = `[${display}](#t=${seconds})`
      const currentValue = latestValueRef.current
      const newValue =
        currentValue.substring(0, start) + text + currentValue.substring(end)

      latestValueRef.current = newValue
      onChange(newValue)

      // Restore focus & cursor
      setTimeout(() => {
        textarea.focus()
        const newPos = start + text.length
        textarea.setSelectionRange(newPos, newPos)
      }, 0)
    },
    [onChange]
  )

  const handleRawInsertPdf = useCallback(
    (attrs: PdfDirectiveAttrs) => {
      const textarea = textareaRef.current
      const currentValue = latestValueRef.current
      const start = textarea?.selectionStart ?? currentValue.length
      const end = textarea?.selectionEnd ?? currentValue.length
      const text = buildPdfDirective(attrs)
      const newValue =
        currentValue.substring(0, start) + text + currentValue.substring(end)

      latestValueRef.current = newValue
      onChange(newValue)

      setTimeout(() => {
        textarea?.focus()
        textarea?.setSelectionRange(start + text.length, start + text.length)
      }, 0)
    },
    [onChange]
  )

  // 切換模式時或外部 key 改變時，重新掛載 Milkdown
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

  // 組合 key：外部 editorKey 變化（切換 lesson）或內部 key 變化（切換模式）
  const combinedKey = `${externalKey ?? ''}__${internalKey}`

  return (
    <div className="space-y-3">
      {/* Mode Switch */}
      <div className="flex items-center justify-between">
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
          <WysiwygToolbar
            mediaSourceId={mediaSourceId}
            mediaSourceUrl={mediaSourceUrl}
            showLessonTools={showLessonTools}
          />
          <div className="milkdown-editor-wrapper min-h-[400px] p-4 bg-white border border-divider rounded-xl overflow-auto prose prose-sm max-w-none prose-headings:text-heading prose-p:text-body prose-a:text-cta prose-strong:text-heading prose-code:text-cta prose-code:bg-surface prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-surface prose-blockquote:border-divider prose-blockquote:text-body prose-li:text-body">
            <MilkdownEditorCore
              value={value}
              onChange={handleWysiwygChange}
            />
          </div>
        </MilkdownProvider>
      )}

      {/* Raw Markdown Mode */}
      {mode === 'markdown' && (
        <>
          {showLessonTools && (
            <RawMarkdownToolbar
              onInsertTimestamp={handleRawInsertTimestamp}
              onInsertPdf={handleRawInsertPdf}
              mediaSourceId={mediaSourceId}
              mediaSourceUrl={mediaSourceUrl}
            />
          )}
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleRawChange}
            placeholder={placeholder}
            className="min-h-[400px] bg-white border-divider text-heading placeholder:text-caption font-mono text-sm resize-none rounded-xl"
          />
        </>
      )}
    </div>
  )
}
