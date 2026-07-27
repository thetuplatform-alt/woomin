// components/admin/course-editor/ai-notes-dialog.tsx
// AI 生成講義 Modal
// 支援字幕檔（SRT）和影片兩種來源
// 使用 streaming 接收 AI 回應

'use client'

import { useState, useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { updateAISettings } from '@/lib/actions/settings'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sparkles,
  FileText,
  Video,
  Upload,
  Loader2,
  AlertCircle,
  KeyRound,
  ExternalLink,
  Check,
} from 'lucide-react'

type Step = 'setup-api-key' | 'select-source' | 'generating'

interface AINotesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  videoId: string | null
  isApiKeyConfigured: boolean
  onGenerated: (content: string) => void
}

/**
 * 從 streaming response 讀取完整文字
 */
async function readStreamToText(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('無法讀取回應')

  const decoder = new TextDecoder()
  let result = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    result += decoder.decode(value, { stream: true })
  }

  return result
}

export function AINotesDialog({
  open,
  onOpenChange,
  videoId,
  isApiKeyConfigured,
  onGenerated,
}: AINotesDialogProps) {
  const [step, setStep] = useState<Step>(
    isApiKeyConfigured ? 'select-source' : 'setup-api-key'
  )
  const [apiKey, setApiKey] = useState('')
  const [isSavingKey, startSavingKey] = useTransition()
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [streamingPreview, setStreamingPreview] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 重置狀態
  const resetState = () => {
    setStep(isApiKeyConfigured ? 'select-source' : 'setup-api-key')
    setApiKey('')
    setError(null)
    setSelectedFile(null)
    setIsGenerating(false)
    setStreamingPreview('')
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState()
    }
    onOpenChange(newOpen)
  }

  // 儲存 API Key
  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      setError('請輸入 Gemini API Key')
      return
    }

    setError(null)
    startSavingKey(async () => {
      const result = await updateAISettings({
        geminiApiKey: apiKey.trim(),
        geminiModel: 'gemini-2.5-flash',
      })

      if (result.success) {
        toast.success('API Key 已儲存')
        setStep('select-source')
      } else {
        setError(result.error ?? '儲存失敗')
      }
    })
  }

  // 選擇字幕檔
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.srt')) {
        setError('請選擇 SRT 格式的字幕檔')
        return
      }
      setError(null)
      setSelectedFile(file)
    }
  }

  // 通用 streaming 生成邏輯
  const handleGenerate = async (formData: FormData) => {
    setIsGenerating(true)
    setStep('generating')
    setError(null)
    setStreamingPreview('')

    try {
      const response = await fetch('/api/admin/ai-generate-notes', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        // 嘗試解析 JSON 錯誤
        const text = await response.text()
        try {
          const data = JSON.parse(text)
          setError(data.error || '生成失敗')
        } catch {
          setError(text || '生成失敗')
        }
        setStep('select-source')
        setIsGenerating(false)
        return
      }

      // 讀取 streaming 回應
      const content = await readStreamToText(response)

      if (content) {
        onGenerated(content)
        toast.success('講義已生成')
        handleOpenChange(false)
      } else {
        setError('AI 未回傳內容')
        setStep('select-source')
      }
    } catch {
      setError('網路錯誤，請稍後再試')
      setStep('select-source')
    } finally {
      setIsGenerating(false)
    }
  }

  // 生成講義（字幕來源）
  const handleGenerateFromSubtitle = async () => {
    if (!selectedFile) {
      setError('請先選擇字幕檔')
      return
    }
    const formData = new FormData()
    formData.append('source', 'subtitle')
    formData.append('file', selectedFile)
    await handleGenerate(formData)
  }

  // 生成講義（影片來源）
  const handleGenerateFromVideo = async () => {
    if (!videoId) return
    const formData = new FormData()
    formData.append('source', 'video')
    formData.append('videoId', videoId)
    await handleGenerate(formData)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-white border-divider rounded-xl sm:max-w-md">
        {/* Step 1: 設定 API Key */}
        {step === 'setup-api-key' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-heading flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-cta" />
                設定 Gemini API Key
              </DialogTitle>
              <DialogDescription className="text-body">
                使用 AI 生成講義功能需要先設定 Google Gemini API Key
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label className="text-heading">API Key</Label>
                <Input
                  type="password"
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="bg-white border-divider text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                />
                <p className="text-xs text-caption">
                  你可以在{' '}
                  <a
                    href="https://aistudio.google.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cta hover:underline inline-flex items-center gap-0.5"
                  >
                    Google AI Studio
                    <ExternalLink className="h-3 w-3" />
                  </a>{' '}
                  中免費申請 API Key
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  className="border-divider text-body"
                >
                  取消
                </Button>
                <Button
                  onClick={handleSaveApiKey}
                  disabled={isSavingKey || !apiKey.trim()}
                  className="bg-cta hover:bg-cta-hover text-white"
                >
                  {isSavingKey ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  儲存並繼續
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Step 2: 選擇來源 */}
        {step === 'select-source' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-heading flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cta" />
                AI 生成講義
              </DialogTitle>
              <DialogDescription className="text-body">
                選擇生成來源，AI 會自動將內容轉化為結構化的文字講義
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-2">
              {/* 字幕檔選項 */}
              <div className="border border-divider rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-cta/10 shrink-0">
                    <FileText className="h-5 w-5 text-cta" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-heading">
                      上傳字幕檔（SRT）
                    </h4>
                    <p className="text-xs text-caption mt-0.5">
                      上傳 SRT 字幕檔，AI 會根據字幕內容與時間碼生成講義
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".srt"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="border-divider text-body hover:bg-surface text-xs"
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    {selectedFile ? selectedFile.name : '選擇檔案'}
                  </Button>
                  {selectedFile && (
                    <Button
                      size="sm"
                      onClick={handleGenerateFromSubtitle}
                      className="bg-cta hover:bg-cta-hover text-white text-xs"
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      開始生成
                    </Button>
                  )}
                </div>
              </div>

              {/* 影片選項 */}
              <div
                className={`border rounded-lg p-4 ${
                  videoId
                    ? 'border-divider'
                    : 'border-divider/50 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-cta/10 shrink-0">
                    <Video className="h-5 w-5 text-cta" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-heading">
                      使用影片內容
                    </h4>
                    <p className="text-xs text-caption mt-0.5">
                      {videoId
                        ? 'AI 會分析當前單元的影片內容並生成講義'
                        : '請先為此單元設定影片'}
                    </p>
                  </div>
                  {videoId && (
                    <Button
                      size="sm"
                      onClick={handleGenerateFromVideo}
                      className="bg-cta hover:bg-cta-hover text-white text-xs shrink-0"
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      開始生成
                    </Button>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          </>
        )}

        {/* Step 3: 生成中 */}
        {step === 'generating' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-heading flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cta" />
                AI 生成講義
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-10 w-10 text-cta animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium text-heading">
                  正在生成講義...
                </p>
                <p className="text-xs text-caption mt-1">
                  AI 正在分析內容並組織結構，這可能需要一些時間
                </p>
              </div>
              {streamingPreview && (
                <div className="w-full max-h-32 overflow-y-auto rounded-lg bg-surface p-3 text-xs text-body font-mono whitespace-pre-wrap">
                  {streamingPreview.slice(0, 500)}
                  {streamingPreview.length > 500 && '...'}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
