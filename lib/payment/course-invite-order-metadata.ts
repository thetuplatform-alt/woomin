import type { Prisma } from '@prisma/client'

export const COURSE_INVITE_ORDER_METADATA_KEY = '__courseInvite'

export interface CourseInviteOrderMetadata {
  inviteId: string
  courseId: string
  maxUses?: number | null
  consumedAt: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toInputJsonObject(value: unknown): Prisma.InputJsonObject {
  return isRecord(value) ? { ...value } as Prisma.InputJsonObject : {}
}

export function getCourseInviteOrderMetadata(
  value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined
): CourseInviteOrderMetadata | null {
  if (!isRecord(value)) return null

  const record = value as Record<string, unknown>
  const metadata = record[COURSE_INVITE_ORDER_METADATA_KEY]
  if (!isRecord(metadata)) return null

  const inviteId = metadata.inviteId
  const courseId = metadata.courseId
  const maxUses = metadata.maxUses
  const consumedAt = metadata.consumedAt

  if (typeof inviteId !== 'string' || typeof courseId !== 'string') {
    return null
  }

  return {
    inviteId,
    courseId,
    maxUses:
      typeof maxUses === 'number' && Number.isInteger(maxUses) && maxUses > 0
        ? maxUses
        : null,
    consumedAt: typeof consumedAt === 'string' ? consumedAt : null,
  }
}

export function withCourseInviteOrderMetadata(
  value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined,
  metadata: CourseInviteOrderMetadata
): Prisma.InputJsonObject {
  return {
    ...toInputJsonObject(value),
    [COURSE_INVITE_ORDER_METADATA_KEY]: {
      inviteId: metadata.inviteId,
      courseId: metadata.courseId,
      maxUses: metadata.maxUses ?? null,
      consumedAt: metadata.consumedAt,
    },
  }
}

export function markCourseInviteOrderMetadataConsumed(
  value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined,
  consumedAt: Date
): Prisma.InputJsonObject | null {
  const metadata = getCourseInviteOrderMetadata(value)
  if (!metadata) return null

  return withCourseInviteOrderMetadata(value, {
    ...metadata,
    consumedAt: consumedAt.toISOString(),
  })
}
