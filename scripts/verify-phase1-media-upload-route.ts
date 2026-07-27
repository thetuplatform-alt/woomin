import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import type { Media } from '@prisma/client'
import { createUploadRouteHandlers } from '../lib/admin-media-upload-route'

function buildRequest(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

async function main() {
  const writes: Array<{ key: string; body: string }> = []
  const createdMediaPayloads: Array<Record<string, unknown>> = []

  const handlers = createUploadRouteHandlers({
    auth: async () => ({ user: { role: 'ADMIN' } }),
    createMedia: async (data) => {
      createdMediaPayloads.push(data as unknown as Record<string, unknown>)
      return {
        success: true,
        media: {
          id: 'media_test_id',
          ...data,
          cfStreamId: null,
          cfStatus: null,
          bunnyVideoId: null,
          bunnyStatus: null,
          duration: null,
          thumbnail: null,
          uploadedBy: 'admin_test_id',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Media,
      }
    },
    getMediaUploadTarget: async (filename) => ({
      success: true,
      uploadUrl: `/api/admin/media/upload?key=media/mock-${filename}`,
      key: `media/mock-${filename}`,
      driver: 'local',
    }),
    getStorageSettings: async () => ({
      driver: 'local',
      localRoot: '.local-uploads',
      s3PublicUrl: '',
    }),
    writeLocalUpload: async (key, body) => {
      writes.push({ key, body: body.toString() })
      return { success: true }
    },
    getPublicUrlForStorageKey: async (key) => `/uploads/${key}`,
  })

  const getRes = await handlers.GET(
    buildRequest('http://localhost:3000/api/admin/media/upload?filename=logo.png&mimeType=image/png')
  )
  const getJson = await getRes.json()
  assert.equal(getRes.status, 200, 'GET should return 200 for valid admin request')
  assert.equal(getJson.success, true, 'GET should return success')
  assert.equal(getJson.driver, 'local', 'GET should expose local driver')
  assert.equal(
    getJson.uploadUrl,
    '/api/admin/media/upload?key=media/mock-logo.png',
    'GET should return upload target URL'
  )

  const putRes = await handlers.PUT(
    buildRequest('http://localhost:3000/api/admin/media/upload?key=media/mock-logo.png', {
      method: 'PUT',
      body: Buffer.from('phase1-route-upload'),
    })
  )
  assert.equal(putRes.status, 200, 'PUT should accept local upload body')
  assert.deepEqual(
    writes,
    [{ key: 'media/mock-logo.png', body: 'phase1-route-upload' }],
    'PUT should forward body to local storage writer'
  )

  const postRes = await handlers.POST(
    buildRequest('http://localhost:3000/api/admin/media/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'media/mock-logo.png',
        originalName: 'logo.png',
        mimeType: 'image/png',
        size: 1024,
        type: 'IMAGE',
      }),
    })
  )
  const postJson = await postRes.json()
  assert.equal(postRes.status, 200, 'POST should create media metadata')
  assert.equal(postJson.success, true, 'POST should return success')
  assert.equal(postJson.url, '/uploads/media/mock-logo.png', 'POST should use /uploads public URL')
  assert.equal(createdMediaPayloads.length, 1, 'POST should call createMedia exactly once')
  assert.equal(createdMediaPayloads[0]?.filename, 'media/mock-logo.png', 'POST should persist key as filename')
  assert.equal(createdMediaPayloads[0]?.url, '/uploads/media/mock-logo.png', 'POST should persist local URL')

  const unauthorizedHandlers = createUploadRouteHandlers({
    auth: async () => null,
    createMedia: async () => ({ success: false, error: 'should not reach' }),
    getMediaUploadTarget: async () => ({ success: false, error: 'should not reach' }),
    getStorageSettings: async () => ({
      driver: 'local',
      localRoot: '.local-uploads',
      s3PublicUrl: '',
    }),
    writeLocalUpload: async () => ({ success: false, error: 'should not reach' }),
    getPublicUrlForStorageKey: async () => '',
  })

  const unauthorizedRes = await unauthorizedHandlers.GET(
    buildRequest('http://localhost:3000/api/admin/media/upload?filename=logo.png&mimeType=image/png')
  )
  assert.equal(unauthorizedRes.status, 401, 'route should reject unauthenticated upload requests')

  console.log('Phase 1 media upload route verification passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
