// app/api/lesson-comments/route.ts
// 單元留言/評論 API
// GET: 取得單元留言列表（章節/單元獨立）
// POST: 建立留言（支援匿名與 15 秒頻率限制）

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  createLessonCommentSchema,
  listLessonCommentsSchema,
} from '@/lib/validations/lesson-comments'

async function requireLessonAccess(params: {
  lessonId: string
  userId: string
}) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    include: {
      chapter: {
        include: {
          course: {
            select: { id: true, status: true },
          },
        },
      },
    },
  })

  if (!lesson || lesson.chapter.course.status === 'DRAFT') {
    return { ok: false as const, status: 404, error: '單元不存在' }
  }

  // 免費試閱單元直接允許
  if (lesson.isFree) {
    return { ok: true as const, lesson, access: 'free' as const }
  }

  const purchase = await prisma.purchase.findUnique({
    where: {
      userId_courseId: {
        userId: params.userId,
        courseId: lesson.chapter.course.id,
      },
    },
  })

  if (
    purchase &&
    !purchase.revokedAt &&
    (!purchase.expiresAt || purchase.expiresAt > new Date())
  ) {
    return { ok: true as const, lesson, access: 'granted' as const }
  }

  return { ok: false as const, status: 403, error: '您尚未購買此課程' }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const raw = {
      lessonId: url.searchParams.get('lessonId') ?? '',
      cursor: url.searchParams.get('cursor') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    }

    const parsed = listLessonCommentsSchema.safeParse(raw)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || '輸入資料格式錯誤' },
        { status: 400 }
      )
    }

    const { lessonId, cursor, limit } = parsed.data

    const access = await requireLessonAccess({
      lessonId,
      userId: session.user.id,
    })
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      )
    }

    const comments = await prisma.lessonComment.findMany({
      where: {
        lessonId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    })

    // 前台：匿名留言一律隱去真實名稱/頭像
    const serialized = comments.map((c) => ({
      id: c.id,
      lessonId: c.lessonId,
      content: c.content,
      isAnonymous: c.isAnonymous,
      createdAt: c.createdAt.toISOString(),
      user: c.isAnonymous
        ? { id: c.userId, name: '學員', image: null as string | null }
        : { id: c.userId, name: c.user.name, image: c.user.image },
    }))

    const nextCursor =
      comments.length === limit
        ? comments[comments.length - 1].id
        : null

    return NextResponse.json({
      success: true,
      comments: serialized,
      nextCursor,
    })
  } catch (error) {
    console.error('取得留言失敗:', error)
    return NextResponse.json(
      { success: false, error: '取得留言失敗' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const parsed = createLessonCommentSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || '輸入資料格式錯誤' },
        { status: 400 }
      )
    }

    const { lessonId, content, isAnonymous } = parsed.data

    const access = await requireLessonAccess({
      lessonId,
      userId: session.user.id,
    })
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      )
    }

    // 15 秒頻率限制（以 DB 最後一筆留言時間為準）
    const last = await prisma.lessonComment.findFirst({
      // 全站限流：避免跨單元洗版
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })

    if (last) {
      const elapsedMs = Date.now() - last.createdAt.getTime()
      if (elapsedMs < 15_000) {
        const retryAfterSec = Math.ceil((15_000 - elapsedMs) / 1000)
        return NextResponse.json(
          {
            success: false,
            error: '每 15 秒只能發言一次',
            retryAfterSec,
          },
          { status: 429 }
        )
      }
    }

    const created = await prisma.lessonComment.create({
      data: {
        lessonId,
        userId: session.user.id,
        content,
        isAnonymous,
      },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    })

    return NextResponse.json({
      success: true,
      comment: {
        id: created.id,
        lessonId: created.lessonId,
        content: created.content,
        isAnonymous: created.isAnonymous,
        createdAt: created.createdAt.toISOString(),
        user: created.isAnonymous
          ? { id: created.userId, name: '學員', image: null as string | null }
          : {
              id: created.userId,
              name: created.user.name,
              image: created.user.image,
            },
      },
    })
  } catch (error) {
    console.error('建立留言失敗:', error)
    return NextResponse.json(
      { success: false, error: '建立留言失敗' },
      { status: 500 }
    )
  }
}
