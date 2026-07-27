'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { requireCourseManageAccess } from '@/lib/course-permissions'
import {
  createQuizSchema,
  updateQuizSchema,
  reorderQuestionsSchema,
  submitQuizAttemptSchema,
  type CreateQuizData,
  type UpdateQuizData,
  type ReorderQuestionsData,
  type SubmitQuizAttemptData,
} from '@/lib/validations/quiz'
import { Prisma } from '@prisma/client'
import type { ShowAnswersStrategy, QuizQuestionType } from '@prisma/client'

// ==================== Helper ====================

async function logAdminAction(
  adminId: string,
  action: 'CREATE_QUIZ' | 'UPDATE_QUIZ' | 'DELETE_QUIZ',
  targetId: string,
  details?: Record<string, unknown>
) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId,
        action,
        targetType: 'Quiz',
        targetId,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined,
      },
    })
  } catch (error) {
    console.error('記錄操作日誌失敗:', error)
  }
}

// ==================== 後台 CRUD ====================

/**
 * 建立測驗（含題目）
 */
export async function createQuiz(data: CreateQuizData) {
  const parsed = createQuizSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      success: false,
      error: first?.message
        ? `測驗內容有誤：${first.message}`
        : '測驗內容格式有誤，請檢查題目與選項',
    }
  }
  const validated = parsed.data

  // 確認單元存在且尚未有測驗
  const lesson = await prisma.lesson.findUnique({
    where: { id: validated.lessonId },
    include: { quiz: true, chapter: { select: { courseId: true } } },
  })

  if (!lesson) {
    return { success: false, error: '找不到指定的單元' }
  }
  const admin = await requireCourseManageAccess(lesson.chapter.courseId)

  if (lesson.quiz) {
    return { success: false, error: '此單元已有測驗，請編輯現有測驗' }
  }

  const quiz = await prisma.quiz.create({
    data: {
      lessonId: validated.lessonId,
      passingScore: validated.settings.passingScore,
      timeLimitMinutes: validated.settings.timeLimitMinutes ?? null,
      shuffleQuestions: validated.settings.shuffleQuestions,
      shuffleOptions: validated.settings.shuffleOptions,
      showAnswers: validated.settings.showAnswers as ShowAnswersStrategy,
      blockNextLesson: validated.settings.blockNextLesson,
      questions: {
        create: validated.questions.map((q, index) => ({
          type: q.type as QuizQuestionType,
          content: q.content,
          options: q.options ?? Prisma.JsonNull,
          correctAnswer: q.correctAnswer as Prisma.InputJsonValue,
          explanation: q.explanation ?? null,
          points: q.points,
          order: index,
        })),
      },
    },
    include: { questions: { orderBy: { order: 'asc' } } },
  })

  await logAdminAction(admin.id, 'CREATE_QUIZ', quiz.id, {
    lessonId: validated.lessonId,
    questionCount: validated.questions.length,
  })

  revalidatePath(`/admin/courses/${lesson.chapter.courseId}`)

  return { success: true, data: quiz }
}

/**
 * 更新測驗設定與題目
 */
export async function updateQuiz(data: UpdateQuizData) {
  const parsed = updateQuizSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      success: false,
      error: first?.message
        ? `測驗內容有誤：${first.message}`
        : '測驗內容格式有誤，請檢查題目與選項',
    }
  }
  const validated = parsed.data

  const quiz = await prisma.quiz.findUnique({
    where: { id: validated.quizId },
    include: {
      lesson: { include: { chapter: { select: { courseId: true } } } },
      questions: true,
    },
  })

  if (!quiz) {
    return { success: false, error: '找不到指定的測驗' }
  }
  const admin = await requireCourseManageAccess(quiz.lesson.chapter.courseId)

  // 更新測驗設定
  if (validated.settings) {
    await prisma.quiz.update({
      where: { id: validated.quizId },
      data: {
        passingScore: validated.settings.passingScore,
        timeLimitMinutes: validated.settings.timeLimitMinutes ?? null,
        shuffleQuestions: validated.settings.shuffleQuestions,
        shuffleOptions: validated.settings.shuffleOptions,
        showAnswers: validated.settings.showAnswers as ShowAnswersStrategy,
        blockNextLesson: validated.settings.blockNextLesson,
      },
    })
  }

  // 更新題目（刪除舊的，重建新的）
  if (validated.questions) {
    await prisma.quizQuestion.deleteMany({
      where: { quizId: validated.quizId },
    })

    await prisma.quizQuestion.createMany({
      data: validated.questions.map((q, index) => ({
        quizId: validated.quizId,
        type: q.type as QuizQuestionType,
        content: q.content,
        options: q.options ?? Prisma.JsonNull,
        correctAnswer: q.correctAnswer as Prisma.InputJsonValue,
        explanation: q.explanation ?? null,
        points: q.points,
        order: index,
      })),
    })
  }

  await logAdminAction(admin.id, 'UPDATE_QUIZ', validated.quizId, {
    updatedSettings: !!validated.settings,
    updatedQuestions: !!validated.questions,
  })

  revalidatePath(`/admin/courses/${quiz.lesson.chapter.courseId}`)

  return { success: true }
}

/**
 * 刪除測驗
 */
export async function deleteQuiz(quizId: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      lesson: { include: { chapter: { select: { courseId: true } } } },
    },
  })

  if (!quiz) {
    return { success: false, error: '找不到指定的測驗' }
  }
  const admin = await requireCourseManageAccess(quiz.lesson.chapter.courseId)

  // QuizAttempt 使用 onDelete: SetNull，刪除 Quiz 後作答紀錄仍保留（quizId 設為 null）
  await prisma.quiz.delete({ where: { id: quizId } })

  await logAdminAction(admin.id, 'DELETE_QUIZ', quizId, {
    lessonId: quiz.lessonId,
  })

  revalidatePath(`/admin/courses/${quiz.lesson.chapter.courseId}`)

  return { success: true }
}

/**
 * 新增單一題目
 */
export async function createQuizQuestion(
  quizId: string,
  data: { type: string; content: string; options?: unknown; correctAnswer: unknown; explanation?: string | null; points?: number }
) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: { orderBy: { order: 'desc' }, take: 1 },
      lesson: { include: { chapter: { select: { courseId: true } } } },
    },
  })
  if (!quiz) return { success: false, error: '找不到指定的測驗' }
  await requireCourseManageAccess(quiz.lesson.chapter.courseId)

  const nextOrder = (quiz.questions[0]?.order ?? -1) + 1

  const question = await prisma.quizQuestion.create({
    data: {
      quizId,
      type: data.type as QuizQuestionType,
      content: data.content,
      options: data.options ? (data.options as Prisma.InputJsonValue) : Prisma.JsonNull,
      correctAnswer: data.correctAnswer as Prisma.InputJsonValue,
      explanation: data.explanation ?? null,
      points: data.points ?? 1,
      order: nextOrder,
    },
  })

  return { success: true, data: question }
}

/**
 * 更新單一題目
 */
export async function updateQuizQuestion(
  questionId: string,
  data: { content?: string; options?: unknown; correctAnswer?: unknown; explanation?: string | null; points?: number }
) {
  const question = await prisma.quizQuestion.findUnique({
    where: { id: questionId },
    select: {
      quiz: { select: { lesson: { select: { chapter: { select: { courseId: true } } } } } },
    },
  })
  if (!question) return { success: false, error: '找不到指定的題目' }
  await requireCourseManageAccess(question.quiz.lesson.chapter.courseId)

  const updateData: Record<string, unknown> = {}
  if (data.content !== undefined) updateData.content = data.content
  if (data.options !== undefined) updateData.options = data.options ? (data.options as Prisma.InputJsonValue) : Prisma.JsonNull
  if (data.correctAnswer !== undefined) updateData.correctAnswer = data.correctAnswer as Prisma.InputJsonValue
  if (data.explanation !== undefined) updateData.explanation = data.explanation
  if (data.points !== undefined) updateData.points = data.points

  await prisma.quizQuestion.update({ where: { id: questionId }, data: updateData })

  return { success: true }
}

/**
 * 刪除單一題目
 */
export async function deleteQuizQuestion(questionId: string) {
  const question = await prisma.quizQuestion.findUnique({
    where: { id: questionId },
    select: {
      quiz: { select: { lesson: { select: { chapter: { select: { courseId: true } } } } } },
    },
  })
  if (!question) return { success: false, error: '找不到指定的題目' }
  await requireCourseManageAccess(question.quiz.lesson.chapter.courseId)

  await prisma.quizQuestion.delete({ where: { id: questionId } })

  return { success: true }
}

/**
 * 重新排序題目
 */
export async function reorderQuizQuestions(
  quizId: string,
  questionOrders: Array<{ id: string; order: number }>
) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { lesson: { select: { chapter: { select: { courseId: true } } } } },
  })
  if (!quiz) return { success: false, error: '找不到指定的測驗' }
  await requireCourseManageAccess(quiz.lesson.chapter.courseId)

  const questionCount = await prisma.quizQuestion.count({
    where: { quizId, id: { in: questionOrders.map((q) => q.id) } },
  })
  if (questionCount !== questionOrders.length) {
    return { success: false, error: '排序資料包含非本測驗題目' }
  }

  await prisma.$transaction(
    questionOrders.map((q) =>
      prisma.quizQuestion.update({
        where: { id: q.id },
        data: { order: q.order },
      })
    )
  )

  return { success: true }
}

/**
 * 取得測驗詳細（後台，含正確答案）
 */
export async function getQuizForAdmin(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { chapter: { select: { courseId: true } } },
  })
  if (!lesson) return { success: true, data: null }
  await requireCourseManageAccess(lesson.chapter.courseId)

  const quiz = await prisma.quiz.findUnique({
    where: { lessonId },
    include: {
      questions: { orderBy: { order: 'asc' } },
      _count: { select: { attempts: true } },
    },
  })

  return { success: true, data: quiz }
}

/**
 * 取得測驗統計
 */
export async function getQuizStatistics(quizId: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { lesson: { select: { chapter: { select: { courseId: true } } } } },
  })
  if (!quiz) return { success: false, error: '找不到指定的測驗' }
  await requireCourseManageAccess(quiz.lesson.chapter.courseId)

  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId },
    select: { score: true, passed: true },
  })

  if (attempts.length === 0) {
    return {
      success: true,
      data: {
        totalAttempts: 0,
        passRate: 0,
        averageScore: 0,
      },
    }
  }

  const totalAttempts = attempts.length
  const passedCount = attempts.filter((a) => a.passed).length
  const averageScore = Math.round(
    attempts.reduce((sum, a) => sum + a.score, 0) / totalAttempts
  )

  return {
    success: true,
    data: {
      totalAttempts,
      passRate: Math.round((passedCount / totalAttempts) * 100),
      averageScore,
    },
  }
}

/**
 * 取得測驗的所有學員作答結果（後台 / 老師端）
 *
 * 回傳每位學員的逐筆作答（含 answers）、題目與正解、以及統計總覽。
 * 老師端一律可看到正解與逐題對照（不受 quiz.showAnswers 學員顯示策略影響）。
 */
export async function getQuizResultsForAdmin(quizId: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: { orderBy: { order: 'asc' } },
      lesson: {
        select: {
          title: true,
          chapter: { select: { courseId: true } },
        },
      },
    },
  })
  if (!quiz) return { success: false as const, error: '找不到指定的測驗' }
  await requireCourseManageAccess(quiz.lesson.chapter.courseId)

  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId },
    orderBy: { submittedAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  })

  const totalAttempts = attempts.length
  const passedCount = attempts.filter((a) => a.passed).length
  const uniqueStudents = new Set(attempts.map((a) => a.userId)).size
  const averageScore =
    totalAttempts > 0
      ? Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / totalAttempts)
      : 0

  // 分數分布（5 個區間）
  const buckets = [
    { label: '0–59', min: 0, max: 59, count: 0 },
    { label: '60–69', min: 60, max: 69, count: 0 },
    { label: '70–79', min: 70, max: 79, count: 0 },
    { label: '80–89', min: 80, max: 89, count: 0 },
    { label: '90–100', min: 90, max: 100, count: 0 },
  ]
  for (const a of attempts) {
    const bucket = buckets.find((b) => a.score >= b.min && a.score <= b.max)
    if (bucket) bucket.count += 1
  }

  return {
    success: true as const,
    data: {
      quiz: {
        id: quiz.id,
        passingScore: quiz.passingScore,
        showAnswers: quiz.showAnswers,
        lessonTitle: quiz.lesson.title,
        questions: quiz.questions.map((q) => ({
          id: q.id,
          type: q.type,
          content: q.content,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          points: q.points,
          order: q.order,
        })),
      },
      attempts: attempts.map((a) => ({
        id: a.id,
        score: a.score,
        passed: a.passed,
        timeTakenSeconds: a.timeTakenSeconds,
        submittedAt: a.submittedAt.toISOString(),
        answers: a.answers,
        user: a.user,
      })),
      stats: {
        totalAttempts,
        uniqueStudents,
        passedCount,
        passRate:
          totalAttempts > 0
            ? Math.round((passedCount / totalAttempts) * 100)
            : 0,
        averageScore,
        distribution: buckets.map((b) => ({ label: b.label, count: b.count })),
      },
    },
  }
}

// ==================== 前台（學員端） ====================

/**
 * 取得測驗（不含正確答案）
 */
export async function getQuizForStudent(lessonId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: '請先登入' }
  }

  const quiz = await prisma.quiz.findUnique({
    where: { lessonId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          type: true,
          content: true,
          options: true,
          points: true,
          order: true,
          // 不回傳 correctAnswer 和 explanation
        },
      },
      lesson: {
        include: { chapter: { select: { courseId: true } } },
      },
    },
  })

  if (!quiz) {
    return { success: true, data: null }
  }

  // 驗證購買權限
  const purchase = await prisma.purchase.findUnique({
    where: {
      userId_courseId: {
        userId: session.user.id,
        courseId: quiz.lesson.chapter.courseId,
      },
    },
    select: { revokedAt: true, expiresAt: true },
  })

  const hasAccess =
    !!purchase &&
    !purchase.revokedAt &&
    (!purchase.expiresAt || purchase.expiresAt > new Date())

  if (!hasAccess) {
    return { success: false, error: '您尚未購買此課程' }
  }

  // 取得學員的歷史作答
  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId: quiz.id, userId: session.user.id },
    orderBy: { submittedAt: 'desc' },
    select: {
      id: true,
      score: true,
      passed: true,
      submittedAt: true,
      timeTakenSeconds: true,
    },
  })

  const bestScore =
    attempts.length > 0 ? Math.max(...attempts.map((a) => a.score)) : null
  const hasPassed = attempts.some((a) => a.passed)

  return {
    success: true,
    data: {
      quiz: {
        id: quiz.id,
        passingScore: quiz.passingScore,
        timeLimitMinutes: quiz.timeLimitMinutes,
        shuffleQuestions: quiz.shuffleQuestions,
        shuffleOptions: quiz.shuffleOptions,
        showAnswers: quiz.showAnswers,
        blockNextLesson: quiz.blockNextLesson,
        questions: quiz.questions,
      },
      attempts,
      bestScore,
      hasPassed,
      attemptCount: attempts.length,
    },
  }
}

/**
 * 送出測驗答案（自動計分）
 */
export async function submitQuizAttempt(data: SubmitQuizAttemptData) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: '請先登入' }
  }

  const validated = submitQuizAttemptSchema.parse(data)

  const quiz = await prisma.quiz.findUnique({
    where: { id: validated.quizId },
    include: {
      questions: true,
      lesson: { include: { chapter: { select: { courseId: true } } } },
    },
  })

  if (!quiz) {
    return { success: false, error: '找不到指定的測驗' }
  }

  // 驗證購買權限
  const purchase = await prisma.purchase.findUnique({
    where: {
      userId_courseId: {
        userId: session.user.id,
        courseId: quiz.lesson.chapter.courseId,
      },
    },
    select: { revokedAt: true, expiresAt: true },
  })

  const hasAccess =
    !!purchase &&
    !purchase.revokedAt &&
    (!purchase.expiresAt || purchase.expiresAt > new Date())

  if (!hasAccess) {
    return { success: false, error: '您尚未購買此課程' }
  }

  // 限時測驗的時間驗證（L36）
  // 注意：startedAt 由前端提供，無法完全防止竄改（完整防護需「伺服器端記錄開始作答時間」的端點）。
  // 此處做務實硬化：(1) startedAt 不可為未來、不可早於合理上限；(2) 真正強制時限。
  const now = new Date()
  let startedAt = new Date(validated.startedAt)
  if (Number.isNaN(startedAt.getTime()) || startedAt.getTime() > now.getTime()) {
    // 無效或未來的開始時間 → 視為此刻開始
    startedAt = now
  }
  if (quiz.timeLimitMinutes) {
    const allowedMs = (quiz.timeLimitMinutes + 1) * 60 * 1000 // +1 分鐘容許網路延遲
    // 開始時間不可早於「時限 + 容許」之前（過舊一律截斷為時限起點）
    const earliestAllowed = now.getTime() - allowedMs
    if (startedAt.getTime() < earliestAllowed) {
      startedAt = new Date(earliestAllowed)
    }
  }

  // 計分
  const totalPoints = quiz.questions.reduce((sum, q) => sum + q.points, 0)
  let earnedPoints = 0

  for (const question of quiz.questions) {
    const answer = validated.answers[question.id]
    if (answer === undefined) continue

    const correct = question.correctAnswer as unknown

    switch (question.type) {
      case 'SINGLE_CHOICE': {
        if (answer === correct) {
          earnedPoints += question.points
        }
        break
      }
      case 'MULTIPLE_CHOICE': {
        const correctArr = correct as string[]
        const answerArr = Array.isArray(answer) ? answer : [answer]
        if (
          correctArr.length === answerArr.length &&
          correctArr.every((c) => answerArr.includes(c))
        ) {
          earnedPoints += question.points
        }
        break
      }
      case 'TRUE_FALSE': {
        if (answer === correct) {
          earnedPoints += question.points
        }
        break
      }
      case 'FILL_IN_BLANK': {
        const acceptedAnswers = correct as string[]
        const studentAnswer =
          typeof answer === 'string' ? answer.trim().toLowerCase() : ''
        if (
          acceptedAnswers.some(
            (a) => a.trim().toLowerCase() === studentAnswer
          )
        ) {
          earnedPoints += question.points
        }
        break
      }
    }
  }

  const score =
    totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
  const passed = score >= quiz.passingScore

  const timeTakenSeconds = Math.round(
    (now.getTime() - startedAt.getTime()) / 1000
  )

  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId: validated.quizId,
      userId: session.user.id,
      answers: validated.answers,
      score,
      passed,
      timeTakenSeconds,
      startedAt,
      submittedAt: now,
    },
  })

  // 根據答案顯示策略決定是否回傳正確答案
  let correctAnswers: Record<
    string,
    { correct: unknown; explanation: string | null }
  > | null = null

  if (
    quiz.showAnswers === 'IMMEDIATELY' ||
    (quiz.showAnswers === 'AFTER_PASS' && passed)
  ) {
    correctAnswers = {}
    for (const q of quiz.questions) {
      correctAnswers[q.id] = {
        correct: q.correctAnswer,
        explanation: q.explanation,
      }
    }
  }

  return {
    success: true,
    data: {
      attemptId: attempt.id,
      score,
      passed,
      timeTakenSeconds,
      correctAnswers,
    },
  }
}

/**
 * 取得學員的測驗作答紀錄
 */
export async function getQuizAttempts(quizId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: '請先登入' }
  }

  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId, userId: session.user.id },
    orderBy: { submittedAt: 'desc' },
  })

  return { success: true, data: attempts }
}

/**
 * 檢查單元是否被測驗阻擋
 * 用於前台判斷學員是否可以進入下一個單元
 */
export async function checkQuizBlockStatus(
  lessonId: string,
  userId: string
): Promise<{ blocked: boolean; quizId?: string }> {
  const quiz = await prisma.quiz.findUnique({
    where: { lessonId },
    select: { id: true, blockNextLesson: true },
  })

  if (!quiz || !quiz.blockNextLesson) {
    return { blocked: false }
  }

  // 檢查是否有通過紀錄
  const passedAttempt = await prisma.quizAttempt.findFirst({
    where: { quizId: quiz.id, userId, passed: true },
  })

  return {
    blocked: !passedAttempt,
    quizId: quiz.id,
  }
}
