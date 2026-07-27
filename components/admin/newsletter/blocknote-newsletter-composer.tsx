'use client'

import { useState } from 'react'
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  type PartialBlock,
} from '@blocknote/core'
import {
  createReactBlockSpec,
  SuggestionMenuController,
  useCreateBlockNote,
} from '@blocknote/react'
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions'
import { zhTW } from '@blocknote/core/locales'
import { BlockNoteView } from '@blocknote/mantine'
import { MantineProvider } from '@mantine/core'
import {
  BookOpen,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListOrdered,
  Minus,
  MousePointer2,
  Pilcrow,
  Percent,
  Quote,
  Sparkles,
} from 'lucide-react'
import type { NewsletterBlock, NewsletterContent } from '@/lib/newsletter/types'

type CourseOption = {
  id: string
  title: string
  slug: string
  coverImage?: string | null
  price: number
  salePrice?: number | null
}

type CouponOption = {
  id: string
  code: string
  name: string
  description?: string | null
  expiresAt?: string | null
}

type ComposerProps = {
  content: NewsletterContent
  courses: CourseOption[]
  coupons: CouponOption[]
  onChange: (content: NewsletterContent) => void
}

type CustomBlockProps = Record<string, string | number | boolean | undefined>
type LooseBlockEditor = {
  updateBlock: (block: unknown, update: unknown) => unknown
}

function updateCustomBlock(editor: unknown, block: unknown, props: CustomBlockProps) {
  ;(editor as LooseBlockEditor).updateBlock(block, { props })
}

function insertCustomBlock(editor: unknown, block: unknown) {
  insertOrUpdateBlockForSlashMenu(editor as never, block as never)
}

const newsletterButtonBlock = createReactBlockSpec(
  {
    type: 'newsletterButton',
    propSchema: {
      text: { default: '點擊前往' },
      url: { default: '/' },
      align: { default: 'center', values: ['left', 'center', 'right'] as const },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => (
      <div className="rounded-lg border bg-white p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">按鈕</div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
          <input
            className="h-9 rounded-md border px-3 text-sm"
            value={block.props.text}
            onChange={(event) => updateCustomBlock(editor, block, { ...block.props, text: event.target.value })}
            placeholder="按鈕文字"
          />
          <input
            className="h-9 rounded-md border px-3 text-sm"
            value={block.props.url}
            onChange={(event) => updateCustomBlock(editor, block, { ...block.props, url: event.target.value })}
            placeholder="https:// 或 /courses/..."
          />
        </div>
      </div>
    ),
  }
)

const newsletterCtaBlock = createReactBlockSpec(
  {
    type: 'newsletterCta',
    propSchema: {
      title: { default: '準備好開始了嗎？' },
      text: { default: '加入課程，繼續下一步。' },
      buttonText: { default: '立即前往' },
      url: { default: '/' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => (
      <div className="rounded-xl border bg-muted/40 p-4">
        <div className="mb-2 text-xs font-medium text-muted-foreground">CTA</div>
        <div className="grid gap-2">
          <input
            className="h-9 rounded-md border px-3 text-sm font-semibold"
            value={block.props.title}
            onChange={(event) => updateCustomBlock(editor, block, { ...block.props, title: event.target.value })}
            placeholder="CTA 標題"
          />
          <textarea
            className="min-h-16 rounded-md border px-3 py-2 text-sm"
            value={block.props.text}
            onChange={(event) => updateCustomBlock(editor, block, { ...block.props, text: event.target.value })}
            placeholder="CTA 說明"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="h-9 rounded-md border px-3 text-sm"
              value={block.props.buttonText}
              onChange={(event) => updateCustomBlock(editor, block, { ...block.props, buttonText: event.target.value })}
              placeholder="按鈕文字"
            />
            <input
              className="h-9 rounded-md border px-3 text-sm"
              value={block.props.url}
              onChange={(event) => updateCustomBlock(editor, block, { ...block.props, url: event.target.value })}
              placeholder="連結"
            />
          </div>
        </div>
      </div>
    ),
  }
)

const newsletterCourseBlock = createReactBlockSpec(
  {
    type: 'newsletterCourse',
    propSchema: {
      courseId: { default: '' },
      title: { default: '選擇課程' },
      imageUrl: { default: '' },
      priceLabel: { default: '' },
      url: { default: '/' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => (
      <div className="rounded-xl border bg-white p-4">
        <div className="mb-2 text-xs font-medium text-muted-foreground">課程卡</div>
        <div className="grid gap-2">
          <input
            className="h-9 rounded-md border px-3 text-sm font-semibold"
            value={block.props.title}
            onChange={(event) => updateCustomBlock(editor, block, { ...block.props, title: event.target.value })}
            placeholder="課程名稱"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="h-9 rounded-md border px-3 text-sm"
              value={block.props.priceLabel}
              onChange={(event) => updateCustomBlock(editor, block, { ...block.props, priceLabel: event.target.value })}
              placeholder="價格文字"
            />
            <input
              className="h-9 rounded-md border px-3 text-sm"
              value={block.props.url}
              onChange={(event) => updateCustomBlock(editor, block, { ...block.props, url: event.target.value })}
              placeholder="課程連結"
            />
          </div>
        </div>
      </div>
    ),
  }
)

const newsletterCouponBlock = createReactBlockSpec(
  {
    type: 'newsletterCoupon',
    propSchema: {
      couponId: { default: '' },
      code: { default: 'COUPON' },
      description: { default: '' },
      expiresAt: { default: '' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="mb-2 text-xs font-medium text-amber-800">優惠券</div>
        <div className="grid gap-2">
          <input
            className="h-9 rounded-md border bg-white px-3 font-mono text-sm"
            value={block.props.code}
            onChange={(event) => updateCustomBlock(editor, block, { ...block.props, code: event.target.value })}
            placeholder="優惠碼"
          />
          <input
            className="h-9 rounded-md border bg-white px-3 text-sm"
            value={block.props.description}
            onChange={(event) => updateCustomBlock(editor, block, { ...block.props, description: event.target.value })}
            placeholder="優惠說明"
          />
        </div>
      </div>
    ),
  }
)

const newsletterSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    newsletterButton: newsletterButtonBlock(),
    newsletterCta: newsletterCtaBlock(),
    newsletterCourse: newsletterCourseBlock(),
    newsletterCoupon: newsletterCouponBlock(),
  },
})

function textFromInlineContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const node = item as { type?: string; text?: string; content?: unknown }
      if (node.type === 'text') return node.text || ''
      if (node.type === 'link') return textFromInlineContent(node.content)
      return ''
    })
    .join('')
}

function courseDefaults(course?: CourseOption) {
  return {
    courseId: course?.id || '',
    title: course?.title || '選擇課程',
    imageUrl: course?.coverImage || '',
    priceLabel: course ? `NT$ ${(course.salePrice || course.price).toLocaleString()}` : '',
    url: course ? `/courses/${course.slug}` : '/',
  }
}

function couponDefaults(coupon?: CouponOption) {
  return {
    couponId: coupon?.id || '',
    code: coupon?.code || 'COUPON',
    description: coupon?.description || coupon?.name || '',
    expiresAt: coupon?.expiresAt || '',
  }
}

function asPartialBlock(block: unknown): PartialBlock {
  return block as PartialBlock
}

function newsletterBlockToBlockNoteBlock(block: NewsletterBlock): PartialBlock {
  if (block.type === 'heading') return asPartialBlock({ id: block.id, type: 'heading', props: { level: 1 }, content: block.text })
  if (block.type === 'paragraph') return asPartialBlock({ id: block.id, type: 'paragraph', content: block.text })
  if (block.type === 'quote') return asPartialBlock({ id: block.id, type: 'quote', content: block.text })
  if (block.type === 'divider') return asPartialBlock({ id: block.id, type: 'divider' })
  if (block.type === 'image') return asPartialBlock({ id: block.id, type: 'image', props: { url: block.url, name: block.alt || '', caption: block.alt || '' } })
  if (block.type === 'video') return asPartialBlock({ id: block.id, type: 'video', props: { url: block.url, name: block.title, caption: block.title } })
  if (block.type === 'button') return asPartialBlock({ id: block.id, type: 'newsletterButton', props: { text: block.text, url: block.url, align: block.align || 'center' } })
  if (block.type === 'cta') return asPartialBlock({ id: block.id, type: 'newsletterCta', props: { title: block.title, text: block.text || '', buttonText: block.buttonText, url: block.url } })
  if (block.type === 'course') return asPartialBlock({ id: block.id, type: 'newsletterCourse', props: { courseId: block.courseId, title: block.title, imageUrl: block.imageUrl || '', priceLabel: block.priceLabel || '', url: block.url } })
  if (block.type === 'coupon') return asPartialBlock({ id: block.id, type: 'newsletterCoupon', props: { couponId: block.couponId, code: block.code, description: block.description || '', expiresAt: block.expiresAt || '' } })
  return asPartialBlock({ id: block.id, type: 'paragraph', content: block.text })
}

function initialBlockNoteDocument(content: NewsletterContent): PartialBlock[] {
  if (Array.isArray(content.meta?.blocknoteDocument)) {
    return content.meta.blocknoteDocument as PartialBlock[]
  }

  const blocks = content.blocks.map(newsletterBlockToBlockNoteBlock)
  return blocks.length ? blocks : [asPartialBlock({ type: 'paragraph', content: '' })]
}

function blockNoteDocumentToNewsletterBlocks(document: unknown[]): NewsletterBlock[] {
  const blocks: NewsletterBlock[] = []

  for (const rawBlock of document) {
    if (!rawBlock || typeof rawBlock !== 'object') continue
    const block = rawBlock as { id?: string; type?: string; content?: unknown; props?: Record<string, string | number | boolean | undefined>; children?: unknown[] }
    const id = block.id || crypto.randomUUID()
    const props = block.props || {}
    const text = textFromInlineContent(block.content)

    if (block.type === 'heading') {
      blocks.push({ id, type: 'heading', text })
    } else if (block.type === 'paragraph' || block.type === 'bulletListItem' || block.type === 'numberedListItem' || block.type === 'checkListItem') {
      if (text.trim()) blocks.push({ id, type: 'paragraph', text })
    } else if (block.type === 'quote') {
      blocks.push({ id, type: 'quote', text })
    } else if (block.type === 'divider') {
      blocks.push({ id, type: 'divider' })
    } else if (block.type === 'image' && typeof props.url === 'string') {
      blocks.push({ id, type: 'image', url: props.url, alt: String(props.caption || props.name || '') })
    } else if (block.type === 'video' && typeof props.url === 'string') {
      blocks.push({ id, type: 'video', url: props.url, title: String(props.caption || props.name || '觀看影片') })
    } else if (block.type === 'newsletterButton') {
      blocks.push({ id, type: 'button', text: String(props.text || '點擊前往'), url: String(props.url || '/'), align: props.align === 'left' || props.align === 'right' ? props.align : 'center' })
    } else if (block.type === 'newsletterCta') {
      blocks.push({ id, type: 'cta', title: String(props.title || '準備好開始了嗎？'), text: String(props.text || ''), buttonText: String(props.buttonText || '立即前往'), url: String(props.url || '/') })
    } else if (block.type === 'newsletterCourse') {
      blocks.push({ id, type: 'course', courseId: String(props.courseId || ''), title: String(props.title || '選擇課程'), imageUrl: String(props.imageUrl || '') || undefined, priceLabel: String(props.priceLabel || '') || undefined, url: String(props.url || '/') })
    } else if (block.type === 'newsletterCoupon') {
      blocks.push({ id, type: 'coupon', couponId: String(props.couponId || ''), code: String(props.code || 'COUPON'), description: String(props.description || '') || undefined, expiresAt: String(props.expiresAt || '') || undefined })
    }

    if (Array.isArray(block.children) && block.children.length) {
      blocks.push(...blockNoteDocumentToNewsletterBlocks(block.children))
    }
  }

  return blocks
}

export function BlockNoteNewsletterComposer({ content, courses, coupons, onChange }: ComposerProps) {
  const [initialContent] = useState(() => initialBlockNoteDocument(content))
  const firstCourse = courses[0]
  const firstCoupon = coupons[0]

  const editor = useCreateBlockNote(
    {
      schema: newsletterSchema,
      initialContent,
      dictionary: zhTW,
    },
    []
  )

  return (
    <MantineProvider>
      <div className="newsletter-blocknote bg-white">
        <BlockNoteView
          editor={editor}
          theme="light"
          slashMenu={false}
          onChange={(instance) => {
            const document = instance.document as unknown[]
            const blocknoteHtml = instance.blocksToHTMLLossy(instance.document as PartialBlock[])
            onChange({
              blocks: blockNoteDocumentToNewsletterBlocks(document),
              meta: {
                ...(content.meta || {}),
                blocknoteDocument: document,
                blocknoteHtml,
              },
            })
          }}
        >
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query) =>
              filterSuggestionItems(
                [
                  {
                    title: '一級標題',
                    subtext: '用於電子報主標題',
                    aliases: ['h1', '標題', 'headline'],
                    group: '文字',
                    icon: <Heading1 size={18} />,
                    onItemClick: () => insertCustomBlock(editor, { type: 'heading', props: { level: 1 }, content: '' }),
                  },
                  {
                    title: '二級標題',
                    subtext: '用於段落標題',
                    aliases: ['h2', '小標', 'section'],
                    group: '文字',
                    icon: <Heading2 size={18} />,
                    onItemClick: () => insertCustomBlock(editor, { type: 'heading', props: { level: 2 }, content: '' }),
                  },
                  {
                    title: '三級標題',
                    subtext: '用於短標或補充標題',
                    aliases: ['h3', '小節'],
                    group: '文字',
                    icon: <Heading3 size={18} />,
                    onItemClick: () => insertCustomBlock(editor, { type: 'heading', props: { level: 3 }, content: '' }),
                  },
                  {
                    title: '段落',
                    subtext: '一般電子報正文',
                    aliases: ['p', '文字', 'paragraph'],
                    group: '文字',
                    icon: <Pilcrow size={18} />,
                    onItemClick: () => insertCustomBlock(editor, { type: 'paragraph', content: '' }),
                  },
                  {
                    title: '引言',
                    subtext: '醒目引用或學員回饋',
                    aliases: ['quote', '引用'],
                    group: '文字',
                    icon: <Quote size={18} />,
                    onItemClick: () => insertCustomBlock(editor, { type: 'quote', content: '' }),
                  },
                  {
                    title: '無序列表',
                    subtext: '用於重點清單',
                    aliases: ['ul', 'list', '列表'],
                    group: '文字',
                    icon: <List size={18} />,
                    onItemClick: () => insertCustomBlock(editor, { type: 'bulletListItem', content: '' }),
                  },
                  {
                    title: '有序列表',
                    subtext: '用於步驟或排序內容',
                    aliases: ['ol', 'number', '編號'],
                    group: '文字',
                    icon: <ListOrdered size={18} />,
                    onItemClick: () => insertCustomBlock(editor, { type: 'numberedListItem', content: '' }),
                  },
                  {
                    title: '分隔線',
                    subtext: '區隔信件段落',
                    aliases: ['divider', 'hr', '分隔'],
                    group: '版面',
                    icon: <Minus size={18} />,
                    onItemClick: () => insertCustomBlock(editor, { type: 'divider' }),
                  },
                  {
                    title: '圖片',
                    subtext: '插入遠端圖片連結',
                    aliases: ['image', '圖片'],
                    group: '媒體',
                    icon: <ImageIcon size={18} />,
                    onItemClick: () => insertCustomBlock(editor, { type: 'image', props: { url: '', name: '', caption: '' } }),
                  },
                  {
                    title: '按鈕',
                    subtext: '插入電子報按鈕',
                    aliases: ['button', '按鈕'],
                    group: '電子報',
                    icon: <MousePointer2 size={18} />,
                    onItemClick: () => insertCustomBlock(editor, { type: 'newsletterButton', props: { text: '點擊前往', url: '/', align: 'center' } }),
                  },
                  {
                    title: '課程卡',
                    subtext: '插入課程推薦卡',
                    aliases: ['course', '課程'],
                    group: '電子報',
                    icon: <BookOpen size={18} />,
                    onItemClick: () => insertCustomBlock(editor, { type: 'newsletterCourse', props: courseDefaults(firstCourse) }),
                  },
                  {
                    title: '優惠券',
                    subtext: '插入優惠碼區塊',
                    aliases: ['coupon', '優惠'],
                    group: '電子報',
                    icon: <Percent size={18} />,
                    onItemClick: () => insertCustomBlock(editor, { type: 'newsletterCoupon', props: couponDefaults(firstCoupon) }),
                  },
                  {
                    title: 'CTA',
                    subtext: '插入完整行動呼籲',
                    aliases: ['cta', '行動呼籲'],
                    group: '電子報',
                    icon: <Sparkles size={18} />,
                    onItemClick: () => insertCustomBlock(editor, { type: 'newsletterCta', props: { title: '準備好開始了嗎？', text: '加入課程，繼續下一步。', buttonText: '立即前往', url: '/' } }),
                  },
                ],
                query
              )
            }
          />
        </BlockNoteView>
      </div>
    </MantineProvider>
  )
}
