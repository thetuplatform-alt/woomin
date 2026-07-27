import { resolveMediaPickerSelection } from '@/lib/video-source'

describe('resolveMediaPickerSelection 防禦層：選片與當前 provider 是否相符', () => {
  it('provider=bunny 且媒體有 bunnyVideoId 時接受選取', () => {
    const result = resolveMediaPickerSelection(
      { bunnyVideoId: 'bunny-guid', cfStreamId: null },
      'bunny'
    )
    expect(result).toEqual({ accepted: true, sourceId: 'bunny-guid' })
  })

  it('provider=cloudflare 且媒體有 cfStreamId 時接受選取', () => {
    const result = resolveMediaPickerSelection(
      { bunnyVideoId: null, cfStreamId: 'cf-id' },
      'cloudflare'
    )
    expect(result).toEqual({ accepted: true, sourceId: 'cf-id' })
  })

  it('provider=bunny 但媒體只有 cfStreamId 時拒絕選取並回傳錯誤訊息，不得回傳 sourceId', () => {
    const result = resolveMediaPickerSelection(
      { bunnyVideoId: null, cfStreamId: 'cf-id' },
      'bunny'
    )
    expect(result.accepted).toBe(false)
    expect((result as { error: string }).error).toBeTruthy()
    expect((result as { sourceId?: string }).sourceId).toBeUndefined()
  })

  it('provider=cloudflare 但媒體只有 bunnyVideoId 時拒絕選取並回傳錯誤訊息', () => {
    const result = resolveMediaPickerSelection(
      { bunnyVideoId: 'bunny-guid', cfStreamId: null },
      'cloudflare'
    )
    expect(result.accepted).toBe(false)
    expect((result as { error: string }).error).toBeTruthy()
  })
})
