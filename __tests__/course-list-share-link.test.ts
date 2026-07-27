import { readFileSync } from 'node:fs'
import path from 'node:path'

const courseTablePath = path.join(
  process.cwd(),
  'components/admin/courses/course-table.tsx'
)

function readCourseTable() {
  return readFileSync(courseTablePath, 'utf8')
}

describe('課程列表分享連結操作', () => {
  it('三種可見性都提供開新頁預覽課程銷售頁', () => {
    const source = readCourseTable()

    expect(source).toContain('ExternalLink')
    expect(source).toContain('href={`/courses/${course.slug}`}')
    expect(source).toContain('target="_blank"')
    expect(source).toContain('開新頁預覽')
  })

  it('公開與連結販售課程可複製一般銷售頁連結', () => {
    const source = readCourseTable()

    expect(source).toContain('Copy')
    expect(source).toContain('async function handleCopy')
    expect(source).toContain('`${window.location.origin}/courses/${slug}`')
    expect(source).toContain('navigator.clipboard.writeText(url)')
    expect(source).toContain("toast.success('課程連結已複製')")
    expect(source).toContain("course.salesVisibility !== 'INVITE_ONLY'")
  })

  it('私密邀請課程不複製一般連結，改導向邀請管理頁', () => {
    const source = readCourseTable()

    expect(source).toContain("course.salesVisibility === 'INVITE_ONLY'")
    expect(source).toContain('href={`/admin/courses/${course.id}/invites`}')
    expect(source).toContain('管理邀請')
  })
})
