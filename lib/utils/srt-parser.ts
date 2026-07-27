// lib/utils/srt-parser.ts
// SRT 字幕解析工具

export interface SrtEntry {
  index: number
  startTime: string
  endTime: string
  text: string
}

/**
 * 解析 SRT 字幕檔案內容
 *
 * @param srtContent SRT 檔案的原始文字內容
 * @returns 解析後的字幕條目陣列
 */
export function parseSrt(srtContent: string): SrtEntry[] {
  const entries: SrtEntry[] = []

  // 正規化換行符號
  const normalized = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // 以空行分隔字幕區塊
  const blocks = normalized.split(/\n\n+/)

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 3) continue

    // 第一行：序號
    const indexLine = lines[0].trim()
    const index = parseInt(indexLine, 10)
    if (isNaN(index)) continue

    // 第二行：時間軸 (00:00:00,000 --> 00:00:00,000)
    const timeLine = lines[1].trim()
    const timeMatch = timeLine.match(/^(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/)
    if (!timeMatch) continue

    const startTime = timeMatch[1]
    const endTime = timeMatch[2]

    // 剩餘行：字幕文字
    const text = lines.slice(2).join('\n').trim()
    if (!text) continue

    entries.push({
      index,
      startTime,
      endTime,
      text,
    })
  }

  return entries
}

/**
 * 將 SRT 字幕轉換為純文字
 * 移除時間軸和序號，只保留字幕文字
 *
 * @param srtContent SRT 檔案的原始文字內容
 * @returns 純文字內容
 */
export function srtToText(srtContent: string): string {
  const entries = parseSrt(srtContent)

  // 合併所有字幕文字
  const texts = entries.map(entry => entry.text)

  // 移除重複的連續文字 (有些 SRT 會有重疊)
  const deduped: string[] = []
  for (const text of texts) {
    // 如果跟上一條不同，才加入
    if (deduped.length === 0 || deduped[deduped.length - 1] !== text) {
      deduped.push(text)
    }
  }

  return deduped.join('\n')
}

/**
 * 將時間字串轉換為秒數
 *
 * @param timeString 格式: "00:00:00,000"
 * @returns 秒數 (小數)
 */
export function timeToSeconds(timeString: string): number {
  const match = timeString.match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/)
  if (!match) return 0

  const hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const seconds = parseInt(match[3], 10)
  const milliseconds = parseInt(match[4], 10)

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
}

/**
 * 計算 SRT 字幕的總時長
 *
 * @param srtContent SRT 檔案的原始文字內容
 * @returns 總時長 (秒)
 */
export function getSrtDuration(srtContent: string): number {
  const entries = parseSrt(srtContent)
  if (entries.length === 0) return 0

  const lastEntry = entries[entries.length - 1]
  return timeToSeconds(lastEntry.endTime)
}

/**
 * 讀取檔案內容為文字
 *
 * @param file File 物件
 * @returns 檔案文字內容
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('讀取檔案失敗'))
    reader.readAsText(file, 'UTF-8')
  })
}
