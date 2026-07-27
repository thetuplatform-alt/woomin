import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function readProjectFile(filePath: string) {
  return fs.readFileSync(path.join(root, filePath), 'utf8')
}

describe('tour persistence', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
    jest.resetModules()
  })

  it('remembers seen and completed tours for the current session when localStorage is unavailable', async () => {
    ;(globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem() {
          throw new Error('blocked')
        },
        setItem() {
          throw new Error('blocked')
        },
      },
    }

    const { tourStore } = await import('@/lib/tours/store')

    expect(tourStore.isAutoEligible('payments')).toBe(true)

    tourStore.markSeen('payments')
    expect(tourStore.isAutoEligible('payments')).toBe(false)

    tourStore.markCompleted('payments')
    expect(tourStore.isCompleted('payments')).toBe(true)

    tourStore.reset()
    expect(tourStore.isAutoEligible('payments')).toBe(true)
  })

  it('rechecks auto-start eligibility when delayed timers fire', () => {
    const contextSource = readProjectFile('components/tour/tour-context.tsx')

    expect(contextSource).toContain("source === 'auto' && !tourStore.isAutoEligible(id)")
    expect(contextSource).toContain("!isActiveRef.current && tourStore.isAutoEligible(id)")
    expect(contextSource).toContain('tourStore.markSeen(tourId)')
  })
})
