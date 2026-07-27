import {
  getEffectiveLessonVideo,
  getVimeoEmbedUrl,
  parseVimeoVideoId,
} from '../lib/video-source'

describe('Vimeo lesson links', () => {
  const vimeoCases = [
    'https://vimeo.com/1206702503',
    'https://player.vimeo.com/video/1206702503',
    'https://vimeo.com/channels/staffpicks/1206702503',
    'https://vimeo.com/groups/name/videos/1206702503',
    'https://vimeo.com/showcase/1234567/video/1206702503',
  ]

  it.each(vimeoCases)('normalizes supported Vimeo URL %s', (input) => {
    expect(parseVimeoVideoId(input)).toBe('1206702503')
    expect(getVimeoEmbedUrl('1206702503')).toContain(
      'https://player.vimeo.com/video/1206702503?'
    )

    expect(
      getEffectiveLessonVideo({
        videoProvider: 'vimeo',
        videoUrl: input,
      })
    ).toEqual({
      videoProvider: 'vimeo',
      videoSourceId: '1206702503',
      videoUrl: getVimeoEmbedUrl('1206702503'),
      videoThumbnail: null,
      videoDuration: null,
      legacyVideoId: null,
    })
  })

  it.each([
    'https://example.com/1206702503',
    'https://vimeo.com/not-a-video',
    '',
  ])('rejects invalid Vimeo URL %s', (input) => {
    expect(parseVimeoVideoId(input)).toBeNull()

    expect(
      getEffectiveLessonVideo({
        videoProvider: 'vimeo',
        videoUrl: input,
      })
    ).toEqual({
      videoProvider: null,
      videoSourceId: null,
      videoUrl: null,
      videoThumbnail: null,
      videoDuration: null,
      legacyVideoId: null,
    })
  })

  it('keeps existing YouTube and Cloudflare normalization unchanged', () => {
    expect(
      getEffectiveLessonVideo({
        videoProvider: 'youtube',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }).videoProvider
    ).toBe('youtube')

    expect(
      getEffectiveLessonVideo({
        videoProvider: 'cloudflare',
        videoSourceId: 'cf-stream-123',
      })
    ).toMatchObject({
      videoProvider: 'cloudflare',
      videoSourceId: 'cf-stream-123',
      legacyVideoId: 'cf-stream-123',
    })
  })
})
