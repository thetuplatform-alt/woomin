// app/api/cron/assignment-cleanup/route.ts
// 自動清理已通過作業的附件（保留文字內容與批改紀錄）

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteStorageObject } from '@/lib/storage'

function verifyCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'

  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 找出所有設定了 autoCleanupDays 且已通過的提交
    const assignments = await prisma.assignment.findMany({
      where: {
        autoCleanupDays: { not: null },
      },
      select: {
        id: true,
        autoCleanupDays: true,
        submissions: {
          where: {
            status: 'APPROVED',
          },
          select: {
            id: true,
            updatedAt: true,
            attachments: {
              select: {
                id: true,
                storageKey: true,
                storageDriver: true,
              },
            },
          },
        },
      },
    })

    let deletedCount = 0

    for (const assignment of assignments) {
      if (!assignment.autoCleanupDays) continue

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - assignment.autoCleanupDays)

      for (const submission of assignment.submissions) {
        // 只清理超過 autoCleanupDays 的已通過作業附件
        if (submission.updatedAt > cutoffDate) continue
        if (submission.attachments.length === 0) continue

        // 刪除儲存物件
        for (const attachment of submission.attachments) {
          try {
            await deleteStorageObject(
              attachment.storageKey,
              attachment.storageDriver as 'local' | 's3'
            )
          } catch (error) {
            console.error(`刪除附件失敗 (${attachment.id}):`, error)
          }
        }

        // 刪除附件記錄（保留提交紀錄和文字內容）
        await prisma.media.deleteMany({
          where: {
            sourceType: 'ASSIGNMENT',
            sourceId: { in: submission.attachments.map((attachment) => attachment.id) },
          },
        })

        await prisma.assignmentAttachment.deleteMany({
          where: { submissionId: submission.id },
        })

        deletedCount += submission.attachments.length
      }
    }

    return NextResponse.json({
      success: true,
      deletedAttachments: deletedCount,
    })
  } catch (error) {
    console.error('作業附件清理失敗:', error)
    return NextResponse.json(
      { success: false, error: '清理失敗' },
      { status: 500 }
    )
  }
}
