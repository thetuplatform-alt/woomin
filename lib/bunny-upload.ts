import { createHash } from 'node:crypto'

export function createBunnyTusSignature(
  libraryId: string,
  apiKey: string,
  authorizationExpire: number,
  videoId: string
): string {
  return createHash('sha256')
    .update(`${libraryId}${apiKey}${authorizationExpire}${videoId}`)
    .digest('hex')
}
