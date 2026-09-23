import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('Tool Management integration contract', () => {
  it('guards every Tool admin page with the DB-backed ADMIN-only helper', () => {
    for (const file of [
      'app/(admin)/admin/tools/page.tsx',
      'app/(admin)/admin/tools/new/page.tsx',
      'app/(admin)/admin/tools/[id]/page.tsx',
    ]) {
      expect(read(file)).toContain('requireOnlyAdminAuth()')
    }
  })

  it('keeps Tool Management hidden from non-admin sidebar roles', () => {
    const sidebar = read('components/admin/sidebar.tsx')
    expect(sidebar).toContain('{ title: "工具管理", href: "/admin/tools", icon: Wrench, adminOnly: true }')
  })

  it('preserves legacy artwork tokens and supports uploaded image URLs', () => {
    const artwork = read('app/lumi-series/product-artwork.tsx')
    expect(artwork).toContain('const visualSystemV2')
    expect(artwork).toContain('const isUploadedImage')
    expect(artwork).toContain('src={thumbnail}')
  })

  it('uses featuredOrder for Featured without changing Explore displayOrder data order', () => {
    const page = read('app/lumi-series/page.tsx')
    const tools = read('lib/lumi-tools.ts')
    expect(page).toContain('a.featuredOrder ?? Number.MAX_SAFE_INTEGER')
    expect(tools).toContain("orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }]")
  })

  it('does not add pricing display behavior to Lumi pricing formatter', () => {
    const data = read('app/lumi-series/data.ts')
    expect(data).not.toContain("if (product.pricingType === 'paid' && product.price && !product.currency)")
  })

  it('uses only the approved fixed Tool audit action values', () => {
    const actions = read('lib/actions/admin-tools.ts')
    for (const action of [
      'CREATE_TOOL',
      'UPDATE_TOOL',
      'PUBLISH_TOOL',
      'DISABLE_TOOL',
      'ARCHIVE_TOOL',
      'FEATURE_TOOL',
    ]) {
      expect(actions).toContain(`'${action}'`)
    }
    expect(actions).toContain("action: 'UPDATE_SETTINGS'")
  })
})
