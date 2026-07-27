import type { StorageDriver } from '@/lib/storage'

export type SetupVideoProvider = 'youtube' | 'cloudflare'

type EnvMap = Record<string, string | undefined>

function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function hasAnyValue(values: Array<string | undefined>): boolean {
  return values.some(hasValue)
}

function hasAllValues(values: Array<string | undefined>): boolean {
  return values.every(hasValue)
}

function getDerivedR2Endpoint(env: EnvMap): string | undefined {
  if (hasValue(env.S3_ENDPOINT)) {
    return env.S3_ENDPOINT
  }

  if (hasValue(env.CLOUDFLARE_ACCOUNT_ID)) {
    return `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`
  }

  return undefined
}

export interface DeploymentCapabilities {
  hasS3LikeStorageEnv: boolean
  hasLegacyR2Env: boolean
  hasObjectStorageEnv: boolean
  hasCloudflareStreamUploadEnv: boolean
  hasCloudflareStreamPlaybackEnv: boolean
  hasCloudflareStreamSigningEnv: boolean
  prefersS3Storage: boolean
  prefersCloudflareStream: boolean
  inferredStorageDriver: StorageDriver
  inferredVideoProvider: SetupVideoProvider
}

export function detectDeploymentCapabilities(
  env: EnvMap = process.env
): DeploymentCapabilities {
  const hasS3Endpoint = hasValue(getDerivedR2Endpoint(env))
  const hasS3Credentials = hasAllValues([
    env.S3_ACCESS_KEY_ID || env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    env.S3_SECRET_ACCESS_KEY || env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  ])
  const hasS3Bucket = hasAnyValue([env.S3_BUCKET_NAME, env.CLOUDFLARE_R2_BUCKET_NAME])
  const hasS3LikeStorageEnv = hasS3Endpoint && hasS3Credentials && hasS3Bucket

  const hasLegacyR2Env = hasAllValues([
    env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    env.CLOUDFLARE_R2_BUCKET_NAME,
    env.CLOUDFLARE_ACCOUNT_ID,
  ])

  const hasCloudflareStreamUploadEnv = hasAllValues([
    env.CLOUDFLARE_ACCOUNT_ID,
    env.CLOUDFLARE_API_TOKEN,
  ])

  const hasCloudflareStreamPlaybackEnv = hasValue(env.CLOUDFLARE_STREAM_CUSTOMER_CODE)
  const hasCloudflareStreamSigningEnv = hasValue(env.CLOUDFLARE_STREAM_SIGNING_SECRET)

  const hasObjectStorageEnv = hasS3LikeStorageEnv || hasLegacyR2Env
  const prefersS3Storage = hasObjectStorageEnv
  const prefersCloudflareStream =
    hasCloudflareStreamUploadEnv && hasCloudflareStreamPlaybackEnv

  return {
    hasS3LikeStorageEnv,
    hasLegacyR2Env,
    hasObjectStorageEnv,
    hasCloudflareStreamUploadEnv,
    hasCloudflareStreamPlaybackEnv,
    hasCloudflareStreamSigningEnv,
    prefersS3Storage,
    prefersCloudflareStream,
    inferredStorageDriver: prefersS3Storage ? 's3' : 'local',
    inferredVideoProvider: prefersCloudflareStream ? 'cloudflare' : 'youtube',
  }
}
