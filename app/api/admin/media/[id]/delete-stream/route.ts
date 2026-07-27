// app/api/admin/media/[id]/delete-stream/route.ts
// 單支 Cloudflare Stream 影片刪除 API。
// 安全原則：只接受指定 Media ID，遠端刪除前必須再次確認 cfStreamId，且不提供批次刪除。

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/require-admin'
import { isFullAdmin } from '@/lib/course-permissions'
import { deleteStreamVideo } from '@/lib/cloudflare'

type DeleteMode = 'remoteOnly' | 'dbOnly' | 'both'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

function isDeleteMode(value: unknown): value is DeleteMode {
  return value === 'remoteOnly' || value === 'dbOnly' || value === 'both'
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireAdminAuth()

    const { id } = await context.params
    const body = (await request.json().catch(() => ({}))) as {
      mode?: unknown
      confirmCfStreamId?: unknown
    }

    if (!isDeleteMode(body.mode)) {
      return NextResponse.json(
        {
          success: false,
          error: '刪除模式不合法，請選擇 remoteOnly、dbOnly 或 both',
        },
        { status: 400 }
      )
    }

    const media = await prisma.media.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        cfStreamId: true,
        originalName: true,
        uploadedBy: true,
      },
    })

    if (!media) {
      return NextResponse.json(
        { success: false, error: '找不到媒體記錄' },
        { status: 404 }
      )
    }

    // H7：媒體歸屬檢查 — 非 ADMIN 講師只能刪除自己上傳的影片，
    // 避免以任意 Media id 刪除他人課程使用中的 Cloudflare 影片（遠端不可逆）。
    if (!isFullAdmin(actor.role) && media.uploadedBy !== actor.id) {
      return NextResponse.json(
        { success: false, error: '沒有此媒體的刪除權限' },
        { status: 403 }
      )
    }

    if (media.type !== 'VIDEO') {
      return NextResponse.json(
        { success: false, error: '只有影片可以執行 Cloudflare Stream 刪除' },
        { status: 400 }
      )
    }

    if (!media.cfStreamId) {
      return NextResponse.json(
        { success: false, error: '此影片沒有 Cloudflare Stream ID，無法刪除遠端影片' },
        { status: 400 }
      )
    }

    if (body.confirmCfStreamId !== media.cfStreamId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cloudflare Stream ID 確認不一致，已取消刪除',
        },
        { status: 400 }
      )
    }

    let deletedRemote = false
    let deletedDb = false

    if (body.mode === 'remoteOnly' || body.mode === 'both') {
      const result = await deleteStreamVideo(media.cfStreamId)
      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || '刪除 Cloudflare 遠端影片失敗',
            cfStreamId: media.cfStreamId,
          },
          { status: 502 }
        )
      }
      deletedRemote = true
    }

    if (body.mode === 'dbOnly' || body.mode === 'both') {
      await prisma.media.delete({ where: { id: media.id } })
      deletedDb = true
    } else {
      await prisma.media.update({
        where: { id: media.id },
        data: {
          cfStatus: 'deleted',
          sourceLabel: 'Cloudflare 遠端影片已刪除，本地記錄保留',
        },
      })
    }

    revalidatePath('/admin/media')
    revalidatePath('/admin/media/videos')

    return NextResponse.json({
      success: true,
      mode: body.mode,
      mediaId: media.id,
      cfStreamId: media.cfStreamId,
      deletedRemote,
      deletedDb,
    })
  } catch (error) {
    console.error('[Cloudflare Stream Delete] 刪除失敗:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : '刪除 Cloudflare Stream 影片時發生錯誤',
      },
      { status: 500 }
    )
  }
}
