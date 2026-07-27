// components/admin/curriculum/milkdown-timestamp-plugin.ts
// 自訂 Milkdown timestamp inline node plugin
// 將 [00:32](#t=32) 語法渲染為可互動的時間膠囊

import { $node, $command, $inputRule, $remark } from '@milkdown/kit/utils'
import { InputRule } from '@milkdown/kit/prose/inputrules'

// ==================== Remark Plugin ====================
// 在 remark AST 層面，將 timestamp link 轉換為自訂 node type

function remarkTimestamp() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tree: any) => {
    visit(tree, 'link', (node, index, parent) => {
      if (!node.url || !parent || index === undefined) return
      const match = node.url.match(/^#t=(\d+)$/)
      if (!match) return

      const seconds = parseInt(match[1], 10)
      const display =
        node.children?.[0]?.value || formatSeconds(seconds)

      // Replace the link node with a custom timestamp node
      parent.children[index] = {
        type: 'timestamp',
        data: {
          seconds,
          display,
        },
      }
    })
  }
}

// Simple AST visitor
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function visit(tree: any, type: string, visitor: (node: any, index: number, parent: any) => void) {
  if (!tree || typeof tree !== 'object') return

  if (Array.isArray(tree.children)) {
    for (let i = 0; i < tree.children.length; i++) {
      const child = tree.children[i]
      if (child.type === type) {
        visitor(child, i, tree)
      }
      visit(child, type, visitor)
    }
  }
}

export const remarkTimestampPlugin = $remark('remarkTimestamp', () => remarkTimestamp)

// ==================== Timestamp Node Schema ====================

export const timestampNode = $node('timestamp', () => ({
  group: 'inline',
  inline: true,
  atom: true,
  attrs: {
    seconds: { default: 0 },
    display: { default: '00:00' },
  },
  parseDOM: [
    {
      tag: 'span[data-type="timestamp"]',
      getAttrs: (dom: HTMLElement) => ({
        seconds: parseInt(dom.getAttribute('data-seconds') || '0', 10),
        display: dom.getAttribute('data-display') || '00:00',
      }),
    },
  ],
  toDOM: (node) => [
    'span',
    {
      'data-type': 'timestamp',
      'data-seconds': String(node.attrs.seconds),
      'data-display': node.attrs.display,
      class: 'milkdown-timestamp-chip',
      contenteditable: 'false',
    },
    [
      'span',
      { class: 'milkdown-timestamp-icon' },
      '▶',
    ],
    ['span', {}, node.attrs.display],
  ],
  parseMarkdown: {
    match: (node: { type: string }) => node.type === 'timestamp',
    runner: (state, node, type) => {
      const data = (node as { data?: { seconds?: number; display?: string } }).data || {}
      const seconds = data.seconds ?? 0
      const display = data.display ?? formatSeconds(seconds)
      state.addNode(type, { seconds, display })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'timestamp',
    runner: (state, node) => {
      const display = node.attrs.display as string
      const seconds = node.attrs.seconds as number
      // addNode(type, children?, value?, props?)
      state.addNode('link', [
        { type: 'text', value: display },
      ], undefined, {
        url: `#t=${seconds}`,
      })
    },
  },
}))

// ==================== Input Rule ====================
// 當使用者輸入 [00:32](#t=32) 時自動轉換為 timestamp node

export const timestampInputRule = $inputRule((ctx) => {
  return new InputRule(
    /\[([^\]]+)\]\(#t=(\d+)\)\s$/,
    (state, match, start, end) => {
      const display = match[1]
      const seconds = parseInt(match[2], 10)
      const nodeType = timestampNode.type(ctx)
      const node = nodeType.create({ seconds, display })
      return state.tr.replaceWith(start, end, node)
    }
  )
})

// ==================== Insert Command ====================

export const insertTimestampCommand = $command(
  'InsertTimestamp',
  (ctx) =>
    (payload?: { seconds: number; display: string }) => {
      return (state, dispatch) => {
        const seconds = payload?.seconds ?? 0
        const display = payload?.display ?? formatSeconds(seconds)
        const nodeType = timestampNode.type(ctx)
        const node = nodeType.create({ seconds, display })
        if (dispatch) {
          const tr = state.tr.replaceSelectionWith(node)
          dispatch(tr)
        }
        return true
      }
    }
)

// ==================== Helpers ====================

export function formatSeconds(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function parseTimeDisplay(display: string): number {
  const parts = display.split(':')
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
  }
  if (parts.length === 3) {
    return (
      parseInt(parts[0], 10) * 3600 +
      parseInt(parts[1], 10) * 60 +
      parseInt(parts[2], 10)
    )
  }
  return parseInt(display, 10) || 0
}
