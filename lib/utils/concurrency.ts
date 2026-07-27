// lib/utils/concurrency.ts
// 並行任務控制器

export type TaskFunction<T> = () => Promise<T>

export interface QueuedTask<T> {
  task: TaskFunction<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

/**
 * 並行任務控制器
 * 限制同時執行的任務數量
 *
 * @example
 * const controller = new ConcurrencyController(3) // 最多 3 個並行
 *
 * // 新增任務，會自動排隊等待執行
 * const result = await controller.add(async () => {
 *   return await fetchSomething()
 * })
 */
export class ConcurrencyController<T = unknown> {
  private queue: QueuedTask<T>[] = []
  private running = 0
  private maxConcurrent: number

  constructor(maxConcurrent: number = 5) {
    this.maxConcurrent = Math.max(1, maxConcurrent)
  }

  /**
   * 新增任務到佇列
   *
   * @param task 要執行的非同步任務
   * @returns Promise，在任務完成時解析
   */
  add(task: TaskFunction<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject })
      this.processQueue()
    })
  }

  /**
   * 處理佇列中的任務
   */
  private processQueue(): void {
    // 如果已達到並行上限或佇列為空，不做任何事
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return
    }

    // 取出佇列中的第一個任務
    const queued = this.queue.shift()
    if (!queued) return

    this.running++

    // 執行任務
    queued.task()
      .then(result => {
        queued.resolve(result)
      })
      .catch(error => {
        queued.reject(error)
      })
      .finally(() => {
        this.running--
        // 繼續處理佇列
        this.processQueue()
      })
  }

  /**
   * 取得目前執行中的任務數量
   */
  get runningCount(): number {
    return this.running
  }

  /**
   * 取得目前佇列中等待的任務數量
   */
  get queuedCount(): number {
    return this.queue.length
  }

  /**
   * 取得並行上限
   */
  get limit(): number {
    return this.maxConcurrent
  }

  /**
   * 清空佇列 (不會中止正在執行的任務)
   */
  clear(): void {
    // 拒絕所有等待中的任務
    for (const queued of this.queue) {
      queued.reject(new Error('任務已取消'))
    }
    this.queue = []
  }
}

/**
 * 批量執行任務，帶有並行限制
 *
 * @param tasks 任務陣列
 * @param maxConcurrent 最大並行數量
 * @returns 所有任務的結果陣列
 *
 * @example
 * const results = await runWithConcurrency(
 *   files.map(file => () => uploadFile(file)),
 *   3
 * )
 */
export async function runWithConcurrency<T>(
  tasks: TaskFunction<T>[],
  maxConcurrent: number = 5
): Promise<PromiseSettledResult<T>[]> {
  const controller = new ConcurrencyController<T>(maxConcurrent)

  const promises = tasks.map(task =>
    controller.add(task).then(
      value => ({ status: 'fulfilled' as const, value }),
      reason => ({ status: 'rejected' as const, reason })
    )
  )

  return Promise.all(promises)
}
