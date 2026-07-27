// lib/actions/ai-course.ts
// AI 快速建立課程 Server Actions
// 提供批量建立章節和單元的功能

'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireCourseManageAccess } from '@/lib/course-permissions'
import { z } from 'zod'
import { normalizeLessonVideoFields } from '@/lib/video-source'

/**
 * 批量建立課程大綱的資料結構
 */
export interface BulkLessonData {
  title: string
  content: string
  videoProvider: 'youtube' | 'cloudflare' | 'vimeo' | null
  videoSourceId: string | null
  videoUrl?: string | null
  videoThumbnail?: string | null
  videoId: string | null
  videoDuration: number | null
}

export interface BulkChapterData {
  title: string
  lessons: BulkLessonData[]
}

export interface CreateBulkCurriculumData {
  courseId: string
  chapters: BulkChapterData[]
}

/**
 * 批量建立的驗證 Schema
 */
const bulkLessonSchema = z.object({
  title: z.string().min(1, '標題不能為空').max(200, '標題最多 200 字'),
  content: z.string().max(100000, '內容最多 100000 字'),
  videoProvider: z.enum(['youtube', 'cloudflare', 'vimeo']).nullable(),
  videoSourceId: z.string().max(255).nullable(),
  videoUrl: z.string().max(1000).nullable().optional(),
  videoThumbnail: z.string().max(1000).nullable().optional(),
  videoId: z.string().max(100).nullable(),
  videoDuration: z.number().nullable(),
})

const bulkChapterSchema = z.object({
  title: z.string().min(1, '標題不能為空').max(200, '標題最多 200 字'),
  lessons: z.array(bulkLessonSchema),
})

const createBulkCurriculumSchema = z.object({
  courseId: z.string().min(1, '課程 ID 不能為空'),
  chapters: z.array(bulkChapterSchema).min(1, '至少需要一個章節'),
})

// requireAdminAuth 從 @/lib/require-admin 引入（直接查 DB 確保角色即時生效）

/**
 * 記錄管理員操作日誌
 */
async function logAdminAction(
  adminId: string,
  action: 'CREATE_COURSE' | 'UPDATE_COURSE' | 'DELETE_COURSE' | 'CREATE_LESSON' | 'UPDATE_LESSON' | 'DELETE_LESSON',
  targetId: string,
  details?: Record<string, unknown>
) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId,
        action,
        targetType: 'Course',
        targetId,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined,
      },
    })
  } catch (error) {
    console.error('記錄操作日誌失敗:', error)
  }
}

/**
 * 批量建立課程章節和單元
 *
 * 此功能專為 AI 快速建立課程設計：
 * - 一次性建立多個章節及其單元
 * - 使用資料庫事務確保資料一致性
 * - 自動計算 order 排序
 * - 所有單元預設為已發佈狀態
 */
export async function createBulkCurriculum(
  data: CreateBulkCurriculumData
): Promise<{
  success: boolean
  createdChapters?: number
  createdLessons?: number
  error?: string
}> {
  try {
    // 驗證資料
    const validatedData = createBulkCurriculumSchema.parse(data)
    const user = await requireCourseManageAccess(validatedData.courseId)

    // 檢查課程是否存在
    const course = await prisma.course.findUnique({
      where: { id: validatedData.courseId },
    })

    if (!course) {
      return { success: false, error: '課程不存在' }
    }

    // 取得目前最大的 chapter order
    const maxChapterOrder = await prisma.chapter.aggregate({
      where: { courseId: validatedData.courseId },
      _max: { order: true },
    })

    const startChapterOrder = (maxChapterOrder._max.order ?? -1) + 1

    // 統計建立數量
    let createdChapters = 0
    let createdLessons = 0

    // 使用事務批量建立
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < validatedData.chapters.length; i++) {
        const chapterData = validatedData.chapters[i]

        // 建立章節
        const chapter = await tx.chapter.create({
          data: {
            courseId: validatedData.courseId,
            title: chapterData.title,
            order: startChapterOrder + i,
          },
        })

        createdChapters++

        // 建立該章節下的所有單元
        for (let j = 0; j < chapterData.lessons.length; j++) {
          const lessonData = chapterData.lessons[j]
          const normalizedVideo = normalizeLessonVideoFields(lessonData)

          await tx.lesson.create({
            data: {
              chapterId: chapter.id,
              title: lessonData.title,
              content: lessonData.content || null,
              videoId: normalizedVideo.legacyVideoId,
              videoProvider: normalizedVideo.videoProvider?.toUpperCase() as
                | 'YOUTUBE'
                | 'CLOUDFLARE'
                | 'VIMEO'
                | undefined,
              videoSourceId: normalizedVideo.videoSourceId,
              videoUrl: normalizedVideo.videoUrl,
              videoThumbnail: normalizedVideo.videoThumbnail,
              videoDuration: normalizedVideo.videoDuration,
              order: j,
              status: 'PUBLISHED',
              isFree: false,
            },
          })

          createdLessons++
        }
      }
    })

    // 記錄操作日誌
    await logAdminAction(
      user.id as string,
      'CREATE_LESSON',
      validatedData.courseId,
      {
        type: 'BULK_CREATE_CURRICULUM',
        chaptersCreated: createdChapters,
        lessonsCreated: createdLessons,
        chapterTitles: validatedData.chapters.map(ch => ch.title),
      }
    )

    // 重新驗證頁面快取
    revalidatePath(`/admin/courses/${validatedData.courseId}`)
    revalidatePath(`/admin/courses/${validatedData.courseId}/curriculum`)
    revalidatePath(`/admin/courses/${validatedData.courseId}/content`)

    return {
      success: true,
      createdChapters,
      createdLessons,
    }
  } catch (error) {
    console.error('批量建立課程大綱失敗:', error)

    if (error instanceof z.ZodError) {
      const firstError = error.issues[0]
      return {
        success: false,
        error: `驗證錯誤: ${firstError.path.join('.')} - ${firstError.message}`,
      }
    }

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '批量建立課程大綱時發生錯誤' }
  }
}
