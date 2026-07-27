/** Calendar-safe month/year arithmetic used for billing boundaries. */
export function addBillingInterval(
  input: Date,
  interval: 'MONTH' | 'YEAR'
): Date {
  return addBillingIntervals(input, interval, 1)
}

/** Add N intervals while preserving the original billing-day anchor (Jan 31 → Mar 31). */
export function addBillingIntervals(
  input: Date,
  interval: 'MONTH' | 'YEAR',
  count: number
): Date {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('扣款週期數必須是非負整數')
  }
  const result = new Date(input)
  const originalDay = result.getUTCDate()

  if (interval === 'YEAR') {
    const targetYear = result.getUTCFullYear() + count
    const month = result.getUTCMonth()
    result.setUTCDate(1)
    result.setUTCFullYear(targetYear)
    result.setUTCMonth(month)
    result.setUTCDate(
      Math.min(originalDay, daysInUtcMonth(targetYear, month))
    )
    return result
  }

  const currentMonth = result.getUTCMonth()
  const targetMonthIndex = currentMonth + count
  const targetYear =
    result.getUTCFullYear() + Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12
  result.setUTCDate(1)
  result.setUTCFullYear(targetYear)
  result.setUTCMonth(targetMonth)
  result.setUTCDate(
    Math.min(originalDay, daysInUtcMonth(targetYear, targetMonth))
  )
  return result
}

export function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/** Parse provider YYYY-MM-DD as Taiwan local midnight (the next billing boundary). */
export function parseTaiwanBillingDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (
    !Number.isInteger(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInUtcMonth(year, month - 1)
  ) {
    return null
  }

  // PAYUNi dates are Asia/Taipei calendar dates. Taiwan is UTC+8 and has no DST.
  return new Date(Date.UTC(year, month - 1, day, -8, 0, 0, 0))
}

export function formatTaiwanDate(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}
