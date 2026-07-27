jest.mock('@/lib/actions/media', () => ({
  syncMediaInfo: jest.fn(),
  renameMedia: jest.fn(),
  deleteMedia: jest.fn(),
  checkMediaUsage: jest.fn(),
}))

import { normalizeVideoStatus, needsVideoSync } from '@/lib/video-source'

describe('normalizeVideoStatus：Bunny 編碼失敗狀態顯示', () => {
  it('bunnyStatus 為 failed 時回傳 error（而非 unknown）', () => {
    expect(normalizeVideoStatus('failed', null)).toBe('error')
  })

  it('bunnyStatus 為 ready 時回傳 ready', () => {
    expect(normalizeVideoStatus('ready', null)).toBe('ready')
  })

  it('bunnyStatus 為 processing 時回傳 processing', () => {
    expect(normalizeVideoStatus('processing', null)).toBe('processing')
  })

  it('cfStatus 為 error 時維持既有行為回傳 error', () => {
    expect(normalizeVideoStatus(null, 'error')).toBe('error')
  })

  it('沒有任何狀態時回傳 unknown', () => {
    expect(normalizeVideoStatus(null, null)).toBe('unknown')
  })
})

describe('needsVideoSync：Bunny 影片同步按鈕顯示條件', () => {
  it('Bunny 影片 bunnyStatus=ready 時不需要同步（不顯示同步按鈕）', () => {
    expect(
      needsVideoSync({ bunnyVideoId: 'guid', bunnyStatus: 'ready', cfStatus: null })
    ).toBe(false)
  })

  it('Bunny 影片 bunnyStatus=failed 時不需要同步（不顯示同步按鈕）', () => {
    expect(
      needsVideoSync({ bunnyVideoId: 'guid', bunnyStatus: 'failed', cfStatus: null })
    ).toBe(false)
  })

  it('Bunny 影片 bunnyStatus=processing 時需要同步（顯示同步按鈕）', () => {
    expect(
      needsVideoSync({ bunnyVideoId: 'guid', bunnyStatus: 'processing', cfStatus: null })
    ).toBe(true)
  })

  it('Cloudflare 影片維持原本以 cfStatus 判斷', () => {
    expect(
      needsVideoSync({ bunnyVideoId: null, bunnyStatus: null, cfStatus: 'ready' })
    ).toBe(false)
    expect(
      needsVideoSync({ bunnyVideoId: null, bunnyStatus: null, cfStatus: 'pending' })
    ).toBe(true)
  })
})
