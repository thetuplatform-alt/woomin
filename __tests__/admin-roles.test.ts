import { isAdminOrInstructorRole, isInstructorRole } from '@/lib/admin-roles'

describe('admin role helpers', () => {
  it('allows admin, instructor, and legacy editor roles to access the admin area', () => {
    expect(isAdminOrInstructorRole('ADMIN')).toBe(true)
    expect(isAdminOrInstructorRole('INSTRUCTOR')).toBe(true)
    expect(isAdminOrInstructorRole('EDITOR')).toBe(true)
  })

  it('does not show admin access to normal or missing roles', () => {
    expect(isAdminOrInstructorRole('USER')).toBe(false)
    expect(isAdminOrInstructorRole(null)).toBe(false)
    expect(isAdminOrInstructorRole(undefined)).toBe(false)
  })

  it('keeps instructor-only role detection aligned with admin access', () => {
    expect(isInstructorRole('INSTRUCTOR')).toBe(true)
    expect(isInstructorRole('EDITOR')).toBe(true)
    expect(isInstructorRole('ADMIN')).toBe(false)
  })
})
