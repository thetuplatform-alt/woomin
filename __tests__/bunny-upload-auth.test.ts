import { createHash } from 'node:crypto'

import { createBunnyTusSignature } from '@/lib/bunny-upload'

describe('Bunny TUS upload authorization', () => {
  it('uses the documented SHA-256 signature formula', () => {
    const libraryId = '416184'
    const apiKey = 'library-api-key'
    const expire = 1_900_000_000
    const videoId = 'video-guid'
    const expected = createHash('sha256')
      .update(`${libraryId}${apiKey}${expire}${videoId}`)
      .digest('hex')

    expect(createBunnyTusSignature(libraryId, apiKey, expire, videoId)).toBe(expected)
  })
})
