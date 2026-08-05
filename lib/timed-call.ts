// 後台伺服器端查詢計時共用工具。
// finally 確保成功與失敗都會記錄，catch 只標記狀態後重新拋出原例外。
export async function timedAdminCall<T>(
  label: string,
  operation: () => Promise<T>,
  scope: 'page' | 'dashboard' = 'page'
): Promise<T> {
  const startedAt = performance.now()
  const requestedAt = new Date().toISOString()
  let status: 'success' | 'error' = 'success'

  try {
    return await operation()
  } catch (error) {
    status = 'error'
    throw error
  } finally {
    console.info(`[admin][${scope}-timing]`, JSON.stringify({
      label,
      requestedAt,
      status,
      elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
    }))
  }
}
