// lib/comment-reply.ts
// 留言回覆共用設定（常量與工具函式，client/server 皆可使用）

export interface CommentReplyVariable {
  token: string
  label: string
  description: string
  example: string
}

/** 回覆留言的可用關鍵字 */
export const COMMENT_REPLY_VARIABLES: CommentReplyVariable[] = [
  {
    token: '{{用戶名稱}}',
    label: '用戶名稱',
    description: '留言者的姓名',
    example: 'Allen',
  },
  {
    token: '{{課程名稱}}',
    label: '課程名稱',
    description: '留言所在的課程標題',
    example: '我的第一門課程',
  },
  {
    token: '{{單元名稱}}',
    label: '單元名稱',
    description: '留言所在的單元標題',
    example: '第 1.1 章節：開發環境與工具準備',
  },
  {
    token: '{{原始留言}}',
    label: '原始留言',
    description: '留言者的原始留言內容',
    example: '請問這裡怎麼操作？',
  },
]

export function renderReplyTemplate(
  template: string,
  context: {
    userName: string
    courseTitle: string
    lessonTitle: string
    originalComment: string
  }
): string {
  return template
    .replace(/\{\{用戶名稱\}\}/g, context.userName)
    .replace(/\{\{課程名稱\}\}/g, context.courseTitle)
    .replace(/\{\{單元名稱\}\}/g, context.lessonTitle)
    .replace(/\{\{原始留言\}\}/g, context.originalComment)
}
