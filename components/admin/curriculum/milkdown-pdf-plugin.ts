// components/admin/curriculum/milkdown-pdf-plugin.ts
// 自訂 Milkdown PDF block node plugin
// 將 :::pdf directive 渲染為後台可讀的 PDF 卡片，同時序列化回原始 Markdown。

import directive from 'remark-directive'
import { $command, $inputRule, $node, $remark } from '@milkdown/kit/utils'
import { InputRule } from '@milkdown/kit/prose/inputrules'

export interface PdfDirectiveAttrs {
  url: string
  title: string
  watermark: boolean
}

export function parsePdfDirectiveMeta(meta: string): PdfDirectiveAttrs | null {
  const values: Record<string, string> = {}

  for (const line of meta.split('\n')) {
    const separator = line.indexOf(':')
    if (separator === -1) continue

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (key) values[key] = value
  }

  if (!values.url) return null

  return {
    url: values.url,
    title: values.title || 'PDF 講義',
    watermark: values.watermark !== 'false',
  }
}

export function buildPdfDirective(attrs: PdfDirectiveAttrs): string {
  return [
    '',
    ':::pdf',
    `url: ${attrs.url}`,
    `title: ${attrs.title}`,
    `watermark: ${attrs.watermark ? 'true' : 'false'}`,
    ':::',
    '',
  ].join('\n')
}

function getDirectiveText(node: {
  children?: Array<{ value?: string; children?: Array<{ value?: string }> }>
}) {
  return (
    node.children
      ?.map((child) => {
        if (typeof child.value === 'string') return child.value
        return child.children?.map((inline) => inline.value || '').join('') || ''
      })
      .join('\n') || ''
  )
}

export const remarkDirectivePlugin = $remark(
  'remarkDirective',
  () => directive
)

export const pdfNode = $node('pdf', () => ({
  group: 'block',
  atom: true,
  isolating: true,
  marks: '',
  attrs: {
    url: { default: '' },
    title: { default: 'PDF 講義' },
    watermark: { default: true },
  },
  parseDOM: [
    {
      tag: 'section[data-type="pdf"]',
      getAttrs: (dom: HTMLElement) => ({
        url: dom.getAttribute('data-url') || '',
        title: dom.getAttribute('data-title') || 'PDF 講義',
        watermark: dom.getAttribute('data-watermark') !== 'false',
      }),
    },
  ],
  toDOM: (node) => [
    'section',
    {
      'data-type': 'pdf',
      'data-url': node.attrs.url,
      'data-title': node.attrs.title,
      'data-watermark': String(node.attrs.watermark),
      class: 'milkdown-pdf-card',
      contenteditable: 'false',
    },
    [
      'div',
      { class: 'milkdown-pdf-card-icon' },
      ['span', {}, 'PDF'],
    ],
    [
      'div',
      { class: 'milkdown-pdf-card-body' },
      ['strong', {}, node.attrs.title || 'PDF 講義'],
      ['span', {}, node.attrs.watermark ? '已後製浮水印' : '未加浮水印'],
      ['code', {}, node.attrs.url || ''],
    ],
  ],
  parseMarkdown: {
    match: (node: { type: string; name?: string }) =>
      node.type === 'containerDirective' && node.name === 'pdf',
    runner: (state, node, type) => {
      const attrs = parsePdfDirectiveMeta(getDirectiveText(node as Parameters<typeof getDirectiveText>[0]))
      if (!attrs) return
      state.addNode(type, attrs)
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'pdf',
    runner: (state, node) => {
      state.addNode(
        'containerDirective',
        [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                value: [
                  `url: ${node.attrs.url}`,
                  `title: ${node.attrs.title}`,
                  `watermark: ${node.attrs.watermark ? 'true' : 'false'}`,
                ].join('\n'),
              },
            ],
          },
        ],
        undefined,
        { name: 'pdf' }
      )
    },
  },
}))

export const pdfInputRule = $inputRule((ctx) => {
  return new InputRule(
    /:::pdf\s*\n([\s\S]*?)\n:::\s$/,
    (state, match, start, end) => {
      const attrs = parsePdfDirectiveMeta(match[1] || '')
      if (!attrs) return null

      const nodeType = pdfNode.type(ctx)
      const node = nodeType.create(attrs)
      return state.tr.replaceWith(start, end, node)
    }
  )
})

export const insertPdfCommand = $command(
  'InsertPdf',
  (ctx) =>
    (payload?: PdfDirectiveAttrs) => {
      return (state, dispatch) => {
        if (!payload?.url) return false

        const nodeType = pdfNode.type(ctx)
        const node = nodeType.create(payload)
        if (dispatch) {
          const tr = state.tr.replaceSelectionWith(node).scrollIntoView()
          dispatch(tr)
        }
        return true
      }
    }
)
