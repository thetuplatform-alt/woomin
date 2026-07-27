import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function readProjectFile(filePath: string) {
  return fs.readFileSync(path.join(root, filePath), 'utf8')
}

describe('admin auth routing', () => {
  it('does not gate admin routes by cached JWT role in middleware', () => {
    const middlewareSource = readProjectFile('middleware.ts')
    const authConfigSource = readProjectFile('lib/auth.config.ts')

    expect(middlewareSource).toContain("nextUrl.pathname.startsWith('/admin')")
    expect(middlewareSource).toContain("loginUrl.searchParams.set('callbackUrl', nextUrl.pathname)")
    expect(middlewareSource).not.toContain("req.auth?.user?.role")
    expect(authConfigSource).not.toContain("auth?.user?.role")
  })

  it('verifies admin layout access through the database-backed helper', () => {
    const adminLayoutSource = readProjectFile('app/(admin)/admin/layout.tsx')

    expect(adminLayoutSource).toContain("import { requireAdminAuth } from '@/lib/require-admin'")
    expect(adminLayoutSource).toContain('return await requireAdminAuth()')
    expect(adminLayoutSource).not.toContain('session.user.role')
  })

  it('deduplicates database-backed admin user lookup during one server render', () => {
    const requireAdminSource = readProjectFile('lib/require-admin.ts')

    expect(requireAdminSource).toContain("import { cache } from 'react'")
    expect(requireAdminSource).toContain('const getCurrentDbUser = cache(async () =>')
    expect(requireAdminSource.match(/prisma\.user\.findUnique/g)).toHaveLength(1)
    expect(requireAdminSource).toContain('const dbUser = await getCurrentDbUser()')
  })
})
