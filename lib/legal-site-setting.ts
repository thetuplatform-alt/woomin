import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const DATABASE_CONNECTIVITY_ERROR_CODES = new Set(['P1001', 'P1002', 'P1017'])
const DRIVER_CONNECTIVITY_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
])

type PrismaErrorShape = {
  name?: unknown
  code?: unknown
  errorCode?: unknown
  clientVersion?: unknown
}

function hasPrismaErrorShape(error: unknown): error is PrismaErrorShape {
  if (!error || typeof error !== 'object') return false

  const candidate = error as PrismaErrorShape
  return (
    typeof candidate.clientVersion === 'string' &&
    (candidate.name === 'PrismaClientKnownRequestError' ||
      candidate.name === 'PrismaClientInitializationError')
  )
}

function getDatabaseConnectivityErrorCode(error: unknown): string | undefined {
  const isPrismaError =
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    hasPrismaErrorShape(error)

  if (!isPrismaError) return undefined

  const candidate = error as PrismaErrorShape
  const codes = [candidate.code, candidate.errorCode].filter(
    (code): code is string => typeof code === 'string'
  )

  return codes.find(
    (code) =>
      DATABASE_CONNECTIVITY_ERROR_CODES.has(code) ||
      DRIVER_CONNECTIVITY_ERROR_CODES.has(code)
  )
}

export async function findOptionalLegalSiteSetting(key: string) {
  try {
    return await prisma.siteSetting.findUnique({ where: { key } })
  } catch (error) {
    const code = getDatabaseConnectivityErrorCode(error)
    if (!code) throw error

    console.error(
      '[Legal pages] Database unavailable; using static legal content fallback.',
      { key, code }
    )
    return null
  }
}
