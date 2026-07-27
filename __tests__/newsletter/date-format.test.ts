import { formatTaipeiDateTime } from '@/components/admin/newsletter/date-format'

describe('formatTaipeiDateTime', () => {
  it('uses stable ascii spacing for server and browser hydration', () => {
    const formatted = formatTaipeiDateTime('2026-07-23T14:28:00.000Z')

    expect(formatted).toBe('2026/07/23 下午10:28')
    expect(formatted).not.toContain('\u00a0')
    expect(formatted).not.toContain('\u2009')
  })
})
