import { validateSubtitleFile } from '@/lib/subtitle-upload'

describe('課程字幕檔驗證', () => {
  it('接受 vtt 與 srt，大小上限為 5MB', () => {
    expect(validateSubtitleFile('lesson.vtt', 200 * 1024)).toEqual({ valid: true })
    expect(validateSubtitleFile('lesson.SRT', 5 * 1024 * 1024)).toEqual({ valid: true })
  })

  it('拒絕其他副檔名與超過 5MB 的檔案', () => {
    expect(validateSubtitleFile('lesson.txt', 100)).toEqual({
      valid: false,
      error: '字幕檔只接受 .vtt 或 .srt 格式',
    })
    expect(validateSubtitleFile('lesson.vtt', 5 * 1024 * 1024 + 1)).toEqual({
      valid: false,
      error: '字幕檔不能超過 5MB',
    })
  })
})
