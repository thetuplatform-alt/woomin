import { timedAdminCall } from '@/lib/timed-call'

describe('timedAdminCall', () => {
  beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('保留原本的回傳值', async () => {
    const result = await timedAdminCall('測試查詢', async () => '完成')

    expect(result).toBe('完成')
    expect(console.info).toHaveBeenCalledWith(
      '[admin][page-timing]',
      expect.stringContaining('"status":"success"')
    )
  })

  it('不吞掉原本的例外', async () => {
    const error = new Error('查詢失敗')

    await expect(
      timedAdminCall('失敗查詢', async () => {
        throw error
      })
    ).rejects.toBe(error)

    expect(console.info).toHaveBeenCalledWith(
      '[admin][page-timing]',
      expect.stringContaining('"status":"error"')
    )
  })
})
