import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  getVideoCaptionNotice,
  getVideoCaptionSupport,
} from '@/lib/video-caption-support'

const playerSource = readFileSync(
  join(process.cwd(), 'components/main/player/unified-video-player.tsx'),
  'utf8',
)
const settingsPreviewSource = readFileSync(
  join(process.cwd(), 'components/admin/course-editor/settings-preview-panel.tsx'),
  'utf8',
)

describe('VidStack 播放器中文化與字幕契約', () => {
  it('DefaultVideoLayout 使用完整繁體中文翻譯表', () => {
    expect(playerSource).toContain('type DefaultLayoutTranslations')
    expect(playerSource).toContain('translations={TRADITIONAL_CHINESE_TRANSLATIONS}')
    expect(playerSource).toContain("'Settings': '設定'")
    expect(playerSource).toContain("'Captions': '字幕'")
    expect(playerSource).toContain("'Enter Fullscreen': '進入全螢幕'")
  })

  it('Cloudflare HLS 可承接來源內嵌字幕，其他目前沒有統一文字軌入口', () => {
    expect(getVideoCaptionSupport('cloudflare')).toBe('hls-embedded')
    expect(getVideoCaptionSupport('youtube')).toBe('unsupported')
    expect(getVideoCaptionSupport('vimeo')).toBe('unsupported')
    expect(getVideoCaptionSupport('bunny')).toBe('unsupported')
  })

  it('編輯器對目前不支援字幕的來源給出明確提示', () => {
    expect(getVideoCaptionNotice('youtube')).toBe('此來源目前不支援字幕選單。')
    expect(getVideoCaptionNotice('vimeo')).toBe('此來源目前不支援字幕選單。')
    expect(getVideoCaptionNotice('bunny')).toBe('Bunny 目前使用嵌入播放器，無法在 VidStack 顯示字幕選單。')
    expect(getVideoCaptionNotice('cloudflare')).toBeNull()
  })

  it('依字幕副檔名指定 Track 的解析格式', () => {
    expect(playerSource).toMatch(/subtitleUrl[^\n]*\.toLowerCase\(\)/)
    expect(playerSource).toContain("type={subtitleUrl.toLowerCase().endsWith('.srt') ? 'srt' : 'vtt'}")
  })

  it('課程編輯器切換設定與預覽時不卸載播放器', () => {
    expect(settingsPreviewSource).toMatch(/<TabsContent\s+value="settings"[^>]*forceMount/)
    expect(settingsPreviewSource).toMatch(/<TabsContent\s+value="preview"[^>]*forceMount/)
  })
})
