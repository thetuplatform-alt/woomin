import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { createPublicUploadImageHandler } from '../lib/public-upload-image-route'

function buildRequest(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

async function main() {
  const handler = createPublicUploadImageHandler({
    readLocalStorageObject: async (key) => {
      if (key === 'media/image.png') {
        return { success: true, buffer: Buffer.from('image-bytes') }
      }

      if (key === 'media/attachment.pdf') {
        return { success: true, buffer: Buffer.from('attachment-bytes') }
      }

      return { success: false, error: 'missing' }
    },
    findMediaByFilename: async (key) => {
      if (key === 'media/image.png') {
        return { mimeType: 'image/png', type: 'IMAGE', originalName: 'image.png' }
      }

      if (key === 'media/attachment.pdf') {
        return {
          mimeType: 'application/pdf',
          type: 'ATTACHMENT',
          originalName: 'attachment.pdf',
        }
      }

      return null
    },
  })

  const okRes = await handler(buildRequest('http://localhost:3000/uploads/media/image.png'), {
    params: Promise.resolve({ path: ['media', 'image.png'] }),
  } as { params: Promise<{ path: string[] }> })
  assert.equal(okRes.status, 200, 'image media should be publicly readable')
  assert.equal(okRes.headers.get('Content-Type'), 'image/png', 'image content type should be preserved')

  const forbiddenRes = await handler(
    buildRequest('http://localhost:3000/uploads/media/attachment.pdf'),
    {
      params: Promise.resolve({ path: ['media', 'attachment.pdf'] }),
    } as { params: Promise<{ path: string[] }> }
  )
  assert.equal(forbiddenRes.status, 200, 'attachment media should be downloadable')
  assert.match(
    forbiddenRes.headers.get('Content-Disposition') || '',
    /attachment/i,
    'attachment response should force download'
  )

  const missingRes = await handler(buildRequest('http://localhost:3000/uploads/media/missing.png'), {
    params: Promise.resolve({ path: ['media', 'missing.png'] }),
  } as { params: Promise<{ path: string[] }> })
  assert.equal(missingRes.status, 404, 'missing local file should return 404')

  console.log('Phase 1 public upload route verification passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
