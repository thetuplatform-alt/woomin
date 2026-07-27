import { promises as fs } from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import {
  deleteFromR2,
  getR2KeyFromUrl,
  getR2ObjectMetadata,
  getR2PresignedUploadUrl,
} from '@/lib/cloudflare'
import { detectDeploymentCapabilities } from '@/lib/deployment-capabilities'
import { SETTING_KEYS } from '@/lib/validations/settings'

export type StorageDriver = 'local' | 's3'

interface StorageSettings {
  driver: StorageDriver
  localRoot: string
  s3PublicUrl: string
}

interface UploadTarget {
  success: boolean
  uploadUrl?: string
  key?: string
  driver?: StorageDriver
  error?: string
}

interface StorageObjectRef {
  driver: StorageDriver
  key: string
}

const DEFAULT_LOCAL_STORAGE_ROOT = '/data/uploads'
const DEFAULT_LOCAL_STORAGE_PUBLIC_BASE = '/uploads'

function getLocalStorageKeyFromUrl(url: string): string | null {
  if (url.startsWith(`${DEFAULT_LOCAL_STORAGE_PUBLIC_BASE}/`)) {
    return url.slice(DEFAULT_LOCAL_STORAGE_PUBLIC_BASE.length + 1)
  }

  try {
    const parsedUrl = new URL(url)
    if (parsedUrl.pathname.startsWith(`${DEFAULT_LOCAL_STORAGE_PUBLIC_BASE}/`)) {
      return parsedUrl.pathname.slice(DEFAULT_LOCAL_STORAGE_PUBLIC_BASE.length + 1)
    }
  } catch {
    return null
  }

  return null
}

function sanitizeFilename(filename: string) {
  const ext = path.extname(filename)
  const basename = path.basename(filename, ext)
  const safeBase = basename.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/-+/g, '-').slice(0, 80)
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10)
  return `${safeBase || 'file'}${safeExt}`
}

export function buildStorageKey(filename: string) {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 10)
  return `media/${timestamp}-${random}-${sanitizeFilename(filename)}`
}

/**
 * 驗證本地 storage key 是否合法（M19）。
 * 僅允許由 buildStorageKey 產生的格式：`media/<安全字元>`（單層、無路徑分隔、無 `..`）。
 * 拒絕用戶端帶入的任意 key，避免越權寫入 / 覆寫其他位置的檔案。
 */
function assertValidLocalStorageKey(key: string) {
  if (typeof key !== 'string' || key.includes('..') || !/^media\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(key)) {
    throw new Error('Invalid storage key')
  }
}

function resolveLocalAbsolutePath(root: string, key: string) {
  const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '')
  const rootPath = path.resolve(root)
  const absolutePath = path.resolve(rootPath, normalizedKey)

  // L40：以 rootPath + 路徑分隔符為邊界，避免 startsWith 被兄弟目錄（如 /data/uploads-evil）繞過
  if (absolutePath !== rootPath && !absolutePath.startsWith(rootPath + path.sep)) {
    throw new Error('Invalid storage key path')
  }

  return absolutePath
}

export async function getStorageSettings(): Promise<StorageSettings> {
  const capabilities = detectDeploymentCapabilities()
  const keys = [
    SETTING_KEYS.STORAGE_DRIVER,
    SETTING_KEYS.LOCAL_STORAGE_ROOT,
  ]

  try {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: keys } },
    })

    const map = new Map(settings.map((setting) => [setting.key, setting.value]))

    return {
      driver:
        (map.get(SETTING_KEYS.STORAGE_DRIVER) as StorageDriver) ||
        capabilities.inferredStorageDriver,
      localRoot:
        map.get(SETTING_KEYS.LOCAL_STORAGE_ROOT) ||
        process.env.LOCAL_STORAGE_ROOT ||
        DEFAULT_LOCAL_STORAGE_ROOT,
      s3PublicUrl:
        process.env.S3_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL || '',
    }
  } catch {
    return {
      driver: capabilities.inferredStorageDriver,
      localRoot: process.env.LOCAL_STORAGE_ROOT || DEFAULT_LOCAL_STORAGE_ROOT,
      s3PublicUrl:
        process.env.S3_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL || '',
    }
  }
}

export async function getMediaUploadTarget(
  filename: string,
  mimeType: string
): Promise<UploadTarget> {
  const settings = await getStorageSettings()

  if (settings.driver === 's3') {
    const result = await getR2PresignedUploadUrl(filename, mimeType)
    return {
      success: result.success,
      uploadUrl: result.url,
      key: result.key,
      driver: 's3',
      error: result.error,
    }
  }

  const key = buildStorageKey(filename)

  return {
    success: true,
    uploadUrl: `/api/admin/media/upload?key=${encodeURIComponent(key)}`,
    key,
    driver: 'local',
  }
}

export async function writeLocalUpload(
  key: string,
  body: Buffer
): Promise<{ success: boolean; error?: string }> {
  try {
    // M19：嚴格驗證 key 格式（拒絕任意 / 遍歷 key），並以邊界檢查解析絕對路徑
    assertValidLocalStorageKey(key)
    const settings = await getStorageSettings()
    const absolutePath = resolveLocalAbsolutePath(settings.localRoot, key)

    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    // M19：以 'wx' 旗標寫入 — 若檔案已存在則失敗，避免覆寫他人既有檔案
    // （key 由 timestamp+random 產生本就唯一，正常上傳不會碰撞）
    await fs.writeFile(absolutePath, body, { flag: 'wx' })

    return { success: true }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code
    if (code === 'EEXIST') {
      return { success: false, error: '檔案已存在，請重新取得上傳連結' }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to write local upload',
    }
  }
}

export async function getPublicUrlForStorageKey(key: string): Promise<string> {
  const settings = await getStorageSettings()

  if (settings.driver === 'local') {
    const base = DEFAULT_LOCAL_STORAGE_PUBLIC_BASE
    return `${base}/${key}`
  }

  return settings.s3PublicUrl ? `${settings.s3PublicUrl}/${key}` : key
}

export async function getStorageKeyFromUrl(url: string): Promise<string | null> {
  const localKey = getLocalStorageKeyFromUrl(url)
  if (localKey) {
    return localKey
  }

  return getR2KeyFromUrl(url)
}

export async function getStorageObjectRefFromUrl(
  url: string
): Promise<StorageObjectRef | null> {
  const localKey = getLocalStorageKeyFromUrl(url)
  if (localKey) {
    return {
      driver: 'local',
      key: localKey,
    }
  }

  const s3Key = getR2KeyFromUrl(url)
  if (s3Key) {
    return {
      driver: 's3',
      key: s3Key,
    }
  }

  return null
}

export async function deleteStorageObject(
  key: string,
  driver?: StorageDriver
): Promise<{ success: boolean; error?: string }> {
  const settings = await getStorageSettings()
  const effectiveDriver = driver || settings.driver

  if (effectiveDriver === 'local') {
    try {
      const absolutePath = resolveLocalAbsolutePath(settings.localRoot, key)
      await fs.rm(absolutePath, { force: true })
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete local file',
      }
    }
  }

  return deleteFromR2(key)
}

export async function getStorageObjectMetadata(
  key: string,
  driver?: StorageDriver
): Promise<{ success: boolean; size?: number; contentType?: string; error?: string }> {
  const settings = await getStorageSettings()
  const effectiveDriver = driver || settings.driver

  if (effectiveDriver === 'local') {
    try {
      const absolutePath = resolveLocalAbsolutePath(settings.localRoot, key)
      const stat = await fs.stat(absolutePath)
      return { success: true, size: stat.size }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stat local file',
      }
    }
  }

  return getR2ObjectMetadata(key)
}

export async function readLocalStorageObject(
  key: string
): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  try {
    const settings = await getStorageSettings()
    const absolutePath = resolveLocalAbsolutePath(settings.localRoot, key)
    const buffer = await fs.readFile(absolutePath)

    return { success: true, buffer }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read local file',
    }
  }
}
