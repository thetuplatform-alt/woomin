import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

describe('online-courses-logic 銷售頁', () => {
  const pagePath = path.join(
    process.cwd(),
    'components/main/landing/pages/online-courses-logic.tsx'
  )
  const loaderPath = path.join(
    process.cwd(),
    'components/main/landing/pages/loader.ts'
  )
  const instructorImagePath = path.join(
    process.cwd(),
    'public/images/landing/online-courses-logic-fish.png'
  )
  const stageImagePath = path.join(
    process.cwd(),
    'public/images/landing/online-courses-logic-stage.png'
  )
  const instructorFullImagePath = path.join(
    process.cwd(),
    'public/images/landing/online-courses-logic-instructor.jpg'
  )
  const coverImagePath = path.join(
    process.cwd(),
    'public/images/landing/online-courses-logic-cover.jpg'
  )
  const mainRouteLoadingPath = path.join(process.cwd(), 'app/(main)/loading.tsx')

  function readPageSource() {
    expect(existsSync(pagePath)).toBe(true)
    return readFileSync(pagePath, 'utf8')
  }

  it('建立專屬頁面並註冊到 loader', () => {
    expect(existsSync(pagePath)).toBe(true)

    const loaderSource = readFileSync(loaderPath, 'utf8')
    expect(loaderSource).toContain(
      "'online-courses-logic': () => import('./online-courses-logic')"
    )
  })

  it('保留購買、免費加入、評價與手機浮動按鈕行為', () => {
    const pageSource = readPageSource()

    expect(pageSource).toContain('AutoEnrollHandler')
    expect(pageSource).toContain('FreeCourseCTA')
    expect(pageSource).toContain('StickyCTA')
    expect(pageSource).toContain('ReviewSection')
    expect(pageSource).toContain('ReviewModal')
    expect(pageSource).toContain('PurchasedCurriculumList')
    expect(pageSource).toContain('/checkout?courseId=${course.id}')
    expect(pageSource).toContain('formatPrice(finalPrice)')
  })

  it('使用講師照片、舞台背景與封面圖素材', () => {
    const pageSource = readPageSource()

    expect(existsSync(instructorImagePath)).toBe(true)
    expect(existsSync(stageImagePath)).toBe(true)
    expect(existsSync(instructorFullImagePath)).toBe(true)
    expect(existsSync(coverImagePath)).toBe(true)
    expect(pageSource).toContain('/images/landing/online-courses-logic-fish.png')
    expect(pageSource).toContain('/images/landing/online-courses-logic-stage.png')
    expect(pageSource).toContain('/images/landing/online-courses-logic-instructor.jpg')
  })

  it('不使用前台全域 route loading，避免銷售頁卡在轉圈畫面', () => {
    expect(existsSync(mainRouteLoadingPath)).toBe(false)
  })
})
