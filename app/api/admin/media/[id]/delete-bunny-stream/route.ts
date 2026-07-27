import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth } from '@/lib/require-admin'
import { isFullAdmin } from '@/lib/course-permissions'
import { getBunnyStreamConfig } from '@/lib/bunny-stream-config'
import { deleteVideo } from '@/lib/bunny'

interface RouteContext { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireAdminAuth()
    const { id } = await context.params
    const body = (await request.json().catch(() => ({}))) as { confirmBunnyVideoId?: string }
    const media = await prisma.media.findUnique({ where: { id } })
    if (!media) return NextResponse.json({ success: false, error: '找不到媒體記錄' }, { status: 404 })
    if (!isFullAdmin(actor.role) && media.uploadedBy !== actor.id) return NextResponse.json({ success: false, error: '沒有此媒體的刪除權限' }, { status: 403 })
    if (!media.bunnyVideoId || body.confirmBunnyVideoId !== media.bunnyVideoId) return NextResponse.json({ success: false, error: 'Bunny 影片 ID 確認不一致' }, { status: 400 })

    const config = await getBunnyStreamConfig()
    const remote = await deleteVideo(config.libraryId, config.apiKey, media.bunnyVideoId)
    if (!remote.success && remote.status !== 404) return NextResponse.json({ success: false, error: remote.error || '刪除 Bunny 遠端影片失敗' }, { status: 502 })
    await prisma.media.delete({ where: { id } })
    revalidatePath('/admin/media')
    revalidatePath('/admin/media/videos')
    return NextResponse.json({ success: true, mediaId: id, deletedRemote: remote.success || remote.status === 404, deletedDb: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '刪除 Bunny 影片失敗' }, { status: 500 })
  }
}

export { POST as DELETE }
