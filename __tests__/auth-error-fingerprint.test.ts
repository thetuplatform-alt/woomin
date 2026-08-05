// __tests__/auth-error-fingerprint.test.ts
// 驗證 authErrorFingerprint()：
// 1. 要有實際鑑別力（不同底層原因要算出不同 fingerprint）
// 2. 絕對不能 throw（循環參照、非 Error 物件、undefined 等奇怪輸入都要安全處理）

import { authErrorFingerprint } from '@/lib/auth-error-fingerprint'

describe('authErrorFingerprint', () => {
  it('相同錯誤內容會產生相同 fingerprint（穩定性 / 可重現）', () => {
    const err1 = new Error('JWT session error')
    const err2 = new Error('JWT session error')

    expect(authErrorFingerprint(err1)).toBe(authErrorFingerprint(err2))
  })

  it('不同底層原因（cause.err.message 不同）要產生不同 fingerprint', () => {
    // 模擬 Auth.js JWTSessionError：外層 message 對所有實例都是同一句固定文案，
    // 真正的差異藏在 cause.err 裡。
    const fixedAuthJsMessage = 'Read more at https://errors.authjs.dev#jwtsessionerror'

    const err1 = new Error(fixedAuthJsMessage) as Error & { cause?: unknown }
    err1.cause = { err: new Error('invalid signature') }

    const err2 = new Error(fixedAuthJsMessage) as Error & { cause?: unknown }
    err2.cause = { err: new Error('jwt expired') }

    const fp1 = authErrorFingerprint(err1)
    const fp2 = authErrorFingerprint(err2)

    expect(fp1).not.toBe(fp2)
  })

  it('cause 帶循環參照時不會 throw，且回傳一個非空字串', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular

    const err = new Error('circular cause test') as Error & { cause?: unknown }
    err.cause = circular

    expect(() => authErrorFingerprint(err)).not.toThrow()

    const fp = authErrorFingerprint(err)
    expect(typeof fp).toBe('string')
    expect(fp.length).toBeGreaterThan(0)
  })

  it('error.cause 直接指回自己（自我循環）也不會 throw', () => {
    const err = new Error('self-referencing cause') as Error & { cause?: unknown }
    err.cause = err

    expect(() => authErrorFingerprint(err)).not.toThrow()
  })

  it('cause 內含深層巢狀循環參照也不會 throw', () => {
    const inner: Record<string, unknown> = { level: 'inner' }
    const outer: Record<string, unknown> = { level: 'outer', inner }
    inner.backToOuter = outer // 深層循環

    const err = new Error('deep circular') as Error & { cause?: unknown }
    err.cause = outer

    expect(() => authErrorFingerprint(err)).not.toThrow()
  })

  it('非 Error 物件、undefined、null、字串、數字等奇怪輸入都不會 throw', () => {
    expect(() => authErrorFingerprint(undefined)).not.toThrow()
    expect(() => authErrorFingerprint(null)).not.toThrow()
    expect(() => authErrorFingerprint('just a string')).not.toThrow()
    expect(() => authErrorFingerprint({ weird: 'object', notAnError: true })).not.toThrow()
    expect(() => authErrorFingerprint(42)).not.toThrow()
    expect(() => authErrorFingerprint([1, 2, 3])).not.toThrow()

    // 每種奇怪輸入都要能正常回傳字串
    expect(typeof authErrorFingerprint(undefined)).toBe('string')
    expect(typeof authErrorFingerprint({ weird: 'object' })).toBe('string')
  })

  it('沒有 cause 的一般 Error 也能正常運作（不影響既有行為）', () => {
    const err = new Error('plain error, no cause')
    const fp = authErrorFingerprint(err)
    expect(typeof fp).toBe('string')
    expect(fp.length).toBeGreaterThan(0)
  })
})
