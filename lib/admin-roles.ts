import type { UserRole } from '@prisma/client'

export function isInstructorRole(role: UserRole | string | null | undefined) {
  return role === 'INSTRUCTOR' || role === 'EDITOR'
}

export function isAdminOrInstructorRole(role: UserRole | string | null | undefined) {
  return role === 'ADMIN' || isInstructorRole(role)
}
