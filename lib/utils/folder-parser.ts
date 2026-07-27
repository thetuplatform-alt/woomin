// lib/utils/folder-parser.ts
// 資料夾結構解析工具
// 嚴格三層結構：root → 章節資料夾 → 單元資料夾（含影片/字幕/Markdown）

export interface ParsedFolderItem {
  id: string
  folderName: string
  chapterName: string
  lessonName: string
  videoFile: File | null
  srtFile: File | null
  mdFile: File | null
  hasVideo: boolean
  hasSrt: boolean
  hasMd: boolean
}

export interface ParsedChapter {
  chapterIndex: number
  title: string
  lessons: ParsedLesson[]
}

export interface ParsedLesson {
  id: string
  lessonIndex: number
  title: string
  folderItem: ParsedFolderItem
}

// 允許的影片副檔名（按優先順序）
const VIDEO_EXTENSIONS = ['.mp4', '.mov'] as const
// 允許的文字副檔名（按優先順序：Markdown > SRT）
const TEXT_EXTENSIONS_MD = ['.md'] as const
const TEXT_EXTENSIONS_SRT = ['.srt'] as const

/**
 * 從 FileList 解析嚴格三層資料夾結構
 *
 * 結構要求：
 * root/           ← 第一層（用戶拖入的資料夾）
 * ├── 章節A/       ← 第二層（資料夾名稱 = 章節名稱）
 * │   ├── 單元1/   ← 第三層（資料夾名稱 = 單元名稱）
 * │   │   ├── video.mp4
 * │   │   ├── subtitle.srt
 * │   │   └── notes.md
 * │   └── 單元2/
 * └── 章節B/
 *
 * @returns 解析結果，若結構不正確返回 { error: string }
 */
export function parseFileList(
  files: FileList | File[]
): ParsedChapter[] | { error: string } {
  const fileArray = Array.from(files)

  if (fileArray.length === 0) {
    return { error: '沒有找到任何檔案' }
  }

  // 分析路徑結構，收集章節和單元資料夾
  // 路徑格式：root/章節/單元/檔案
  const lessonMap = new Map<
    string,
    { chapterName: string; lessonName: string; files: File[] }
  >()

  let rootName: string | null = null

  for (const file of fileArray) {
    const relativePath =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name
    const parts = relativePath.split('/')

    // 嚴格要求至少 4 層：root/章節/單元/檔案
    if (parts.length < 4) {
      continue // 跳過非三層結構的檔案（如 root 層的檔案）
    }

    if (!rootName) {
      rootName = parts[0]
    }

    const chapterName = parts[1]
    const lessonName = parts[2]

    // 跳過隱藏資料夾和系統檔案
    if (
      chapterName.startsWith('.') ||
      chapterName === '__MACOSX' ||
      lessonName.startsWith('.') ||
      lessonName === '__MACOSX'
    ) {
      continue
    }

    // 只允許第四層的檔案（不允許更深的巢狀）
    if (parts.length > 4) {
      continue
    }

    const key = `${chapterName}/${lessonName}`
    let entry = lessonMap.get(key)
    if (!entry) {
      entry = { chapterName, lessonName, files: [] }
      lessonMap.set(key, entry)
    }
    entry.files.push(file)
  }

  if (lessonMap.size === 0) {
    return {
      error:
        '資料夾結構不正確。請確認為三層結構：\n\n' +
        '課程資料夾/\n' +
        '├── 章節名稱/\n' +
        '│   ├── 單元名稱/\n' +
        '│   │   ├── video.mp4\n' +
        '│   │   └── subtitle.srt\n' +
        '│   └── 單元名稱/\n' +
        '└── 章節名稱/',
    }
  }

  // 建立結構
  const chapterMap = new Map<string, ParsedFolderItem[]>()

  for (const [, entry] of lessonMap) {
    const { chapterName, lessonName, files: lessonFiles } = entry

    // 從單元資料夾內的檔案中挑選
    const videoFile = pickFile(lessonFiles, VIDEO_EXTENSIONS as unknown as string[])
    const mdFile = pickFile(lessonFiles, TEXT_EXTENSIONS_MD as unknown as string[])
    const srtFile = pickFile(lessonFiles, TEXT_EXTENSIONS_SRT as unknown as string[])

    const item: ParsedFolderItem = {
      id: `${chapterName}-${lessonName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      folderName: lessonName,
      chapterName,
      lessonName,
      videoFile,
      srtFile,
      mdFile,
      hasVideo: !!videoFile,
      hasSrt: !!srtFile,
      hasMd: !!mdFile,
    }

    if (!chapterMap.has(chapterName)) {
      chapterMap.set(chapterName, [])
    }
    chapterMap.get(chapterName)!.push(item)
  }

  // 轉換為章節結構，按自然排序
  const chapters: ParsedChapter[] = []
  const sortedChapterNames = Array.from(chapterMap.keys()).sort(
    naturalCompare
  )

  sortedChapterNames.forEach((chapterName, chapterIdx) => {
    const items = chapterMap.get(chapterName)!
    const sortedItems = items.sort((a, b) =>
      naturalCompare(a.lessonName, b.lessonName)
    )

    const lessons: ParsedLesson[] = sortedItems.map((item, lessonIdx) => ({
      id: item.id,
      lessonIndex: lessonIdx + 1,
      title: item.lessonName,
      folderItem: item,
    }))

    chapters.push({
      chapterIndex: chapterIdx + 1,
      title: chapterName,
      lessons,
    })
  })

  return chapters
}

/**
 * 從檔案列表中根據優先順序挑選第一個匹配的檔案
 * 多個同類型檔案時取第一個（按名稱排序），優先順序由 extensions 陣列順序決定
 */
function pickFile(files: File[], extensions: string[]): File | null {
  for (const ext of extensions) {
    const matches = files
      .filter((f) => f.name.toLowerCase().endsWith(ext))
      .sort((a, b) => a.name.localeCompare(b.name))
    if (matches.length > 0) {
      return matches[0]
    }
  }
  return null
}

/**
 * 自然排序比較函式（處理數字前綴）
 */
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * 驗證解析結果
 * @returns 缺失檔案的警告訊息列表
 */
export function validateParsedChapters(chapters: ParsedChapter[]): string[] {
  const warnings: string[] = []

  for (const chapter of chapters) {
    for (const lesson of chapter.lessons) {
      const { folderItem } = lesson

      if (!folderItem.hasVideo) {
        warnings.push(
          `「${chapter.title} / ${lesson.title}」缺少影片檔案（.mp4 或 .mov）`
        )
      }

      if (!folderItem.hasMd && !folderItem.hasSrt) {
        warnings.push(
          `「${chapter.title} / ${lesson.title}」缺少字幕或講義檔案（.srt 或 .md）`
        )
      }
    }
  }

  return warnings
}

/**
 * 計算統計資訊
 */
export function getParseStats(chapters: ParsedChapter[]) {
  const totalChapters = chapters.length
  const totalLessons = chapters.reduce(
    (acc, ch) => acc + ch.lessons.length,
    0
  )
  const lessonsWithVideo = chapters.reduce(
    (acc, ch) =>
      acc + ch.lessons.filter((l) => l.folderItem.hasVideo).length,
    0
  )
  const lessonsWithSrt = chapters.reduce(
    (acc, ch) =>
      acc + ch.lessons.filter((l) => l.folderItem.hasSrt).length,
    0
  )
  const lessonsWithMd = chapters.reduce(
    (acc, ch) =>
      acc + ch.lessons.filter((l) => l.folderItem.hasMd).length,
    0
  )

  return {
    totalChapters,
    totalLessons,
    lessonsWithVideo,
    lessonsWithSrt,
    lessonsWithMd,
    completeCount: chapters.reduce(
      (acc, ch) =>
        acc +
        ch.lessons.filter(
          (l) =>
            l.folderItem.hasVideo &&
            (l.folderItem.hasMd || l.folderItem.hasSrt)
        ).length,
      0
    ),
  }
}
