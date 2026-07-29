export const MAX_SUBTITLE_FILE_SIZE = 5 * 1024 * 1024

export function validateSubtitleFile(filename: string, size: number) {
  const extension = filename.toLowerCase().split('.').pop()
  if (extension !== 'vtt' && extension !== 'srt') {
    return { valid: false as const, error: '字幕檔只接受 .vtt 或 .srt 格式' }
  }

  if (size > MAX_SUBTITLE_FILE_SIZE) {
    return { valid: false as const, error: '字幕檔不能超過 5MB' }
  }

  return { valid: true as const }
}
