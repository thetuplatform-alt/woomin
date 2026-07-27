import type {
  WatermarkEmailDisplayMode,
  WatermarkMovementMode,
  WatermarkTextSize,
} from '@prisma/client'

export interface VideoWatermarkPayload {
  enabled: boolean
  viewerEmail: string | null
  courseTitle: string
  showEmail: boolean
  showCourseTitle: boolean
  showTimestamp: boolean
  emailDisplayMode: WatermarkEmailDisplayMode
  opacityPercent: number
  textSize: WatermarkTextSize
  movementMode: WatermarkMovementMode
  moveIntervalSec: number
  tamperPauseEnabled: boolean
}

export function maskEmail(email: string): string {
  const [localPart, domain = ''] = email.split('@')
  const safeLocalPart = localPart || ''
  const maskedLocalPart =
    safeLocalPart.length <= 2
      ? `${safeLocalPart.slice(0, 1)}*`
      : `${safeLocalPart.slice(0, 2)}***`

  return domain ? `${maskedLocalPart}@${domain}` : maskedLocalPart
}

export function buildVideoWatermarkLines(
  payload: VideoWatermarkPayload,
  timestamp: Date
): string[] {
  if (!payload.enabled) return []

  const segments: string[] = []
  if (payload.showEmail && payload.viewerEmail) {
    segments.push(
      payload.emailDisplayMode === 'MASKED'
        ? maskEmail(payload.viewerEmail)
        : payload.viewerEmail
    )
  }

  if (payload.showCourseTitle) {
    segments.push(payload.courseTitle)
  }

  if (payload.showTimestamp) {
    const formatter = new Intl.DateTimeFormat('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    segments.push(formatter.format(timestamp))
  }

  if (segments.length === 0) {
    return ['Protected video']
  }

  if (segments.length <= 2) {
    return [segments.join(' · ')]
  }

  return [segments.slice(0, 2).join(' · '), segments.slice(2).join(' · ')]
}
