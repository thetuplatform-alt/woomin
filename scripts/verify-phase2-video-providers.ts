import assert from 'node:assert/strict'
import {
  getEffectiveLessonVideo,
  getVimeoEmbedUrl,
  getYouTubeEmbedUrl,
  parseVimeoVideoSource,
  parseYouTubeVideoId,
} from '../lib/video-source'

function main() {
  assert.equal(
    parseYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    'dQw4w9WgXcQ'
  )
  assert.equal(
    parseYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ'),
    'dQw4w9WgXcQ'
  )
  assert.equal(parseYouTubeVideoId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
  assert.equal(parseYouTubeVideoId('invalid-youtube-url'), null)
  assert.deepEqual(parseVimeoVideoSource('https://vimeo.com/123456789'), {
    id: '123456789',
    hash: null,
    url: getVimeoEmbedUrl('123456789'),
  })
  assert.deepEqual(parseVimeoVideoSource('https://player.vimeo.com/video/123456789'), {
    id: '123456789',
    hash: null,
    url: getVimeoEmbedUrl('123456789'),
  })
  assert.deepEqual(parseVimeoVideoSource('https://vimeo.com/123456789?h=abc123def'), {
    id: '123456789',
    hash: 'abc123def',
    url: getVimeoEmbedUrl('123456789', 'abc123def'),
  })
  assert.deepEqual(parseVimeoVideoSource('https://vimeo.com/123456789/abc123def'), {
    id: '123456789',
    hash: 'abc123def',
    url: getVimeoEmbedUrl('123456789', 'abc123def'),
  })
  assert.equal(parseVimeoVideoSource('https://example.com/123456789'), null)

  const youtubeVideo = getEffectiveLessonVideo({
    videoProvider: 'youtube',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    videoDuration: null,
  })

  assert.deepEqual(youtubeVideo, {
    videoProvider: 'youtube',
    videoSourceId: 'dQw4w9WgXcQ',
    videoUrl: getYouTubeEmbedUrl('dQw4w9WgXcQ'),
    videoThumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    videoDuration: null,
    legacyVideoId: null,
  })

  const vimeoVideo = getEffectiveLessonVideo({
    videoProvider: 'vimeo',
    videoUrl: 'https://vimeo.com/123456789?h=abc123def',
    videoDuration: 88,
  })

  assert.deepEqual(vimeoVideo, {
    videoProvider: 'vimeo',
    videoSourceId: '123456789',
    videoUrl: getVimeoEmbedUrl('123456789', 'abc123def'),
    videoThumbnail: null,
    videoDuration: 88,
    legacyVideoId: null,
  })

  const cloudflareVideo = getEffectiveLessonVideo({
    videoProvider: 'cloudflare',
    videoSourceId: 'cf-stream-123',
    videoDuration: 97,
  })

  assert.deepEqual(cloudflareVideo, {
    videoProvider: 'cloudflare',
    videoSourceId: 'cf-stream-123',
    videoUrl: null,
    videoThumbnail: null,
    videoDuration: 97,
    legacyVideoId: 'cf-stream-123',
  })

  const legacyFallback = getEffectiveLessonVideo({
    videoId: 'legacy-cf-id',
    videoDuration: 120,
  })

  assert.deepEqual(legacyFallback, {
    videoProvider: 'cloudflare',
    videoSourceId: 'legacy-cf-id',
    videoUrl: null,
    videoThumbnail: null,
    videoDuration: 120,
    legacyVideoId: 'legacy-cf-id',
  })

  console.log('Phase 2 video provider verification passed')
}

main()
