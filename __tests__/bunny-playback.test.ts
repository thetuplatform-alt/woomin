import { createHash } from 'node:crypto'
import {
  bunnyPlaybackExpiry,
  bunnyStatusFromCode,
  createBunnyPlaybackToken,
} from '@/lib/bunny-playback'

describe('Bunny playback signing', () => {
  it('uses the documented token formula and duration floor', () => {
    const expires = bunnyPlaybackExpiry(1_700_000_000, 120)
    expect(expires).toBe(1_700_007_200)
    expect(createBunnyPlaybackToken('key', 'guid', expires)).toBe(
      createHash('sha256').update(`keyguid${expires}`).digest('hex')
    )
  })

  it('uses video duration when it exceeds the two-hour floor', () => {
    expect(bunnyPlaybackExpiry(100, 10_000)).toBe(13_700)
    expect(bunnyPlaybackExpiry(100, null)).toBe(7_300)
  })

  it('treats Bunny resolution-finished status as playable', () => {
    expect(bunnyStatusFromCode(4)).toBe('ready')
  })
})
