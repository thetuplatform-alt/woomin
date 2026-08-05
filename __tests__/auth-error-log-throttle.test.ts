// __tests__/auth-error-log-throttle.test.ts
// 驗證 throttledAuthErrorLog()：/api/auth/callback/credentials 是未登入即可打的公開端點，
// Auth.js 的 logger.error 全域 catch-all 沒有節流會被拿來當 log 放大器。
// 這裡驗證固定窗口節流：門檻內每筆都真正輸出，超過門檻的筆數不會真正輸出。

import { throttledAuthErrorLog, __resetThrottleStateForTests } from '@/lib/auth-error-log-throttle'

describe('throttledAuthErrorLog', () => {
  beforeEach(() => {
    __resetThrottleStateForTests()
  })

  it('視窗內在門檻（20 筆）以內的呼叫都會真正輸出', () => {
    const emit = jest.fn()

    for (let i = 0; i < 20; i++) {
      throttledAuthErrorLog(emit, 1_000 + i)
    }

    expect(emit).toHaveBeenCalledTimes(20)
  })

  it('超過門檻後，多出來的呼叫不會每筆都真正輸出', () => {
    const emit = jest.fn()

    // 同一個窗口內連續呼叫 25 次（時間差遠小於窗口長度）
    for (let i = 0; i < 25; i++) {
      throttledAuthErrorLog(emit, 1_000 + i)
    }

    expect(emit).toHaveBeenCalledTimes(20)
  })

  it('新窗口開始後重新計數，且會補印上一個窗口的跳過摘要', () => {
    const emit = jest.fn()
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    // 窗口一：25 次呼叫 → 20 筆真正輸出，5 筆被跳過
    for (let i = 0; i < 25; i++) {
      throttledAuthErrorLog(emit, 1_000 + i)
    }

    // 時間推進超過 10 秒（WINDOW_MS），進入新窗口
    throttledAuthErrorLog(emit, 1_000 + 10_001)

    // 新窗口的第一筆本身也要真正輸出
    expect(emit).toHaveBeenCalledTimes(21)

    // 摘要 log 要提到跳過的筆數
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('5'))

    errorSpy.mockRestore()
  })

  it('極端情境：短時間內大量呼叫（模擬暴力破解掃描）不會讓每筆都真正輸出', () => {
    const emit = jest.fn()

    for (let i = 0; i < 500; i++) {
      throttledAuthErrorLog(emit, 1_000 + i)
    }

    // 500 次呼叫，但同一窗口內只有 20 筆會真正輸出
    expect(emit).toHaveBeenCalledTimes(20)
  })
})
