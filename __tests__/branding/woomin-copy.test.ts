import fs from 'node:fs'
import path from 'node:path'

const sourceRoot = path.resolve(__dirname, '../..')
const userFacingRoots = ['app', 'components', 'lib']

function readUserFacingSource(): string {
  const files: string[] = []

  function collect(directory: string) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) collect(entryPath)
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(entryPath)
    }
  }

  for (const root of userFacingRoots) collect(path.join(sourceRoot, root))
  return files
    .filter((file) => !file.endsWith('/lib/site-brand.ts'))
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n')
}

describe('WooMin 對外文字', () => {
  it('不應在前台或後台程式碼留下舊品牌、Ray 或舊網址', () => {
    const source = readUserFacingSource()

    expect(source).not.toMatch(/Course Realms|\bRealms\b|ray-realms|\bRay\b/)
    expect(source).not.toContain('ray@')
    expect(source).not.toContain('noreply@ray')
  })

  it('保留 WooMin 與 Fish 的必要對外文字', () => {
    const source = readUserFacingSource()

    expect(source).toContain('WooMin')
    expect(source).toContain('Fish')
    expect(source).toContain('fish@fishot.com')
  })
})
