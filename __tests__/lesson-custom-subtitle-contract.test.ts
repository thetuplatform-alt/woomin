import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const playerSource = readFileSync(join(process.cwd(), 'components/main/player/unified-video-player.tsx'), 'utf8')
const editorSource = readFileSync(join(process.cwd(), 'components/admin/course-editor/lesson-editor-panel.tsx'), 'utf8')
const routeSource = readFileSync(join(process.cwd(), 'app/api/admin/lessons/[id]/subtitle/route.ts'), 'utf8')
const schemaSource = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')

describe('課程自訂字幕契約', () => {
  it('Lesson 有三個可空字幕欄位', () => {
    expect(schemaSource).toMatch(/subtitleUrl\s+String\?/)
    expect(schemaSource).toMatch(/subtitleLang\s+String\?/)
    expect(schemaSource).toMatch(/subtitleLabel\s+String\?/)
  })

  it('播放器以 Track 疊加字幕，且不改 Bunny iframe 路徑', () => {
    expect(playerSource).toContain("Track")
    expect(playerSource).toContain('subtitleUrl')
    expect(playerSource).toContain('kind="subtitles"')
    expect(playerSource).toContain("videoProvider === 'bunny'")
    expect(playerSource).toContain('onError={onError}')
  })

  it('上傳端點保留格式與大小驗證，編輯器對 Bunny 顯示不支援', () => {
    expect(routeSource).toContain('validateSubtitleFile')
    expect(routeSource).toContain('subtitleUrl')
    expect(editorSource).toContain('Bunny 目前不支援自訂字幕')
    expect(editorSource).toContain('/api/admin/lessons/')
  })
})
