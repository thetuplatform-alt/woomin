import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function readProjectFile(filePath: string) {
  return fs.readFileSync(path.join(root, filePath), 'utf8')
}

describe('admin navigation performance boundaries', () => {
  it('keeps course filter options in a browser-light module', () => {
    const optionsPath = path.join(root, 'lib/course-options.ts')

    expect(fs.existsSync(optionsPath)).toBe(true)

    const optionsSource = fs.readFileSync(optionsPath, 'utf8')
    expect(optionsSource).toContain('courseStatusOptions')
    expect(optionsSource).toContain('courseVisibilityOptions')
    expect(optionsSource).not.toContain("from 'zod'")
    expect(optionsSource).not.toContain('z.object')

    const filtersSource = readProjectFile('components/admin/courses/course-filters.tsx')
    expect(filtersSource).toContain("from '@/lib/course-options'")
    expect(filtersSource).not.toContain("from '@/lib/validations/course'")

    const validationSource = readProjectFile('lib/validations/course.ts')
    expect(validationSource).toContain("from '@/lib/course-options'")
  })

  it('keeps decorative admin shell dependencies out of the eager sidebar path', () => {
    const sidebarSource = readProjectFile('components/admin/sidebar.tsx')
    expect(sidebarSource).not.toContain('@lordicon/react')
    expect(sidebarSource).not.toContain('@/components/admin/lord-icon')
    expect(sidebarSource).not.toContain('@/public/lordicon/')

    const layoutSource = readProjectFile('components/admin/admin-layout-client.tsx')
    expect(layoutSource).toContain("dynamic(() => import('@/components/tour/tour-overlay')")
    expect(layoutSource).toContain('const { isActive } = useTour()')
    expect(layoutSource).toContain('if (!isActive) return null')
    expect(layoutSource).not.toContain("import { TourProvider, HelpButton, TourOverlay } from '@/components/tour'")
  })

  it('starts independent admin data reads before awaiting their results', () => {
    const coursesActionSource = readProjectFile('lib/actions/courses.ts')
    expect(coursesActionSource).toContain('const [total, courses] = await Promise.all')
    expect(coursesActionSource).toMatch(/prisma\.course\.count\(\{[\s\S]*where[\s\S]*\}/)
    expect(coursesActionSource).toMatch(/prisma\.course\.findMany\(\{[\s\S]*where,/)

    const contentPageSource = readProjectFile('app/(admin)/admin/courses/[id]/content/page.tsx')
    expect(contentPageSource).toContain(
      'const [cloudflareStatus, cloudflareStream, geminiSetting] = await Promise.all'
    )
    expect(contentPageSource).toContain('getCloudflareStreamConfigStatus()')
    expect(contentPageSource).toContain('prisma.siteSetting.findUnique')
  })

  it('does not run the setup-count check before successful admin auth', () => {
    const adminLayoutSource = readProjectFile('app/(admin)/admin/layout.tsx')
    const authIndex = adminLayoutSource.indexOf('return await requireAdminAuth()')
    const setupIndex = adminLayoutSource.indexOf('const needsSetup = await checkNeedsSetup()')

    expect(authIndex).toBeGreaterThan(-1)
    expect(setupIndex).toBeGreaterThan(authIndex)
  })
})
