import { z } from 'zod'

const ABSOLUTE_HTTP_URL_PATTERN = /^https?:\/\//i

export function isValidMediaUrl(value: string): boolean {
  if (!value) {
    return false
  }

  if (value.startsWith('/')) {
    return true
  }

  return ABSOLUTE_HTTP_URL_PATTERN.test(value)
}

export function mediaUrlSchema(message: string) {
  return z.string().refine(isValidMediaUrl, { message })
}
