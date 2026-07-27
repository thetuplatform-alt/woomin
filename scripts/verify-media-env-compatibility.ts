import assert from 'node:assert/strict'
import { detectDeploymentCapabilities } from '../lib/deployment-capabilities'

function main() {
  const localOnly = detectDeploymentCapabilities({
    DATABASE_URL: 'postgresql://demo:demo@localhost:5432/app',
  })

  assert.equal(localOnly.inferredStorageDriver, 'local')
  assert.equal(localOnly.inferredVideoProvider, 'youtube')
  assert.equal(localOnly.hasObjectStorageEnv, false)
  assert.equal(localOnly.prefersCloudflareStream, false)

  const s3Env = detectDeploymentCapabilities({
    S3_ENDPOINT: 'https://s3.example.com',
    S3_ACCESS_KEY_ID: 'key',
    S3_SECRET_ACCESS_KEY: 'secret',
    S3_BUCKET_NAME: 'bucket',
  })

  assert.equal(s3Env.hasObjectStorageEnv, true)
  assert.equal(s3Env.inferredStorageDriver, 's3')

  const legacyR2Env = detectDeploymentCapabilities({
    CLOUDFLARE_ACCOUNT_ID: 'account',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'key',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'secret',
    CLOUDFLARE_R2_BUCKET_NAME: 'bucket',
  })

  assert.equal(legacyR2Env.hasLegacyR2Env, true)
  assert.equal(legacyR2Env.inferredStorageDriver, 's3')

  const streamEnv = detectDeploymentCapabilities({
    CLOUDFLARE_ACCOUNT_ID: 'account',
    CLOUDFLARE_API_TOKEN: 'token',
    CLOUDFLARE_STREAM_CUSTOMER_CODE: 'customer',
  })

  assert.equal(streamEnv.hasCloudflareStreamUploadEnv, true)
  assert.equal(streamEnv.hasCloudflareStreamPlaybackEnv, true)
  assert.equal(streamEnv.inferredVideoProvider, 'cloudflare')

  console.log('Media env compatibility verification passed')
}

main()
