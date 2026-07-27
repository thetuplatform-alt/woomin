// components/admin/settings/ai-settings-form.tsx
// AI 模型設定表單元件

'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  aiSettingsSchema,
  type AISettingsFormData,
} from '@/lib/validations/settings'
import { updateAISettings } from '@/lib/actions/settings'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StickySaveBar } from '@/components/admin/shared/sticky-save-bar'

const PRESET_MODELS = [
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
  { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite Preview' },
]

const CUSTOM_MODEL_KEY = '__custom__'

interface AISettingsFormProps {
  initialData: {
    geminiApiKeyHint: string
    geminiModel: string
    isConfigured: boolean
  }
}

export function AISettingsForm({ initialData }: AISettingsFormProps) {
  const [isPending, startTransition] = useTransition()

  // 判斷初始模型是否為預設選項
  const isPresetModel = PRESET_MODELS.some(
    (m) => m.value === initialData.geminiModel
  )
  const [selectValue, setSelectValue] = useState(
    isPresetModel ? initialData.geminiModel : CUSTOM_MODEL_KEY
  )
  const [customModel, setCustomModel] = useState(
    isPresetModel ? '' : initialData.geminiModel
  )

  const form = useForm<AISettingsFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(aiSettingsSchema) as any,
    defaultValues: {
      geminiApiKey: initialData.geminiApiKeyHint || '',
      geminiModel: initialData.geminiModel || 'gemini-2.5-flash',
    },
  })

  // 更新 form 中的 geminiModel
  const handleModelSelectChange = (value: string) => {
    setSelectValue(value)
    if (value === CUSTOM_MODEL_KEY) {
      // 切換到自訂時，用已填入的自訂值或清空
      form.setValue('geminiModel', customModel || '', { shouldDirty: true })
    } else {
      form.setValue('geminiModel', value, { shouldDirty: true })
    }
  }

  const handleCustomModelChange = (value: string) => {
    setCustomModel(value)
    form.setValue('geminiModel', value, { shouldDirty: true })
  }

  async function onSubmit(data: AISettingsFormData) {
    startTransition(async () => {
      try {
        const result = await updateAISettings(data)
        if (result.success) {
          toast.success('AI 設定已儲存')
          form.reset(data)
        } else {
          toast.error(result.error ?? '儲存設定失敗')
        }
      } catch {
        toast.error('操作失敗，請稍後再試')
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card className="border border-divider rounded-xl">
          <CardHeader>
            <CardTitle className="text-heading">Gemini AI 模型</CardTitle>
            <CardDescription className="text-body">
              設定 Google Gemini AI 模型
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Gemini API Key */}
            <FormField
              control={form.control}
              name="geminiApiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-heading">
                    Gemini API Key <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="AIzaSy..."
                      className="border-divider text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-caption">
                    在{' '}
                    <a
                      href="https://aistudio.google.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cta hover:underline"
                    >
                      Google AI Studio
                    </a>{' '}
                    中免費申請 API Key
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Gemini 模型選擇 */}
            <FormField
              control={form.control}
              name="geminiModel"
              render={() => (
                <FormItem>
                  <FormLabel className="text-heading">Gemini 模型</FormLabel>
                  <Select
                    value={selectValue}
                    onValueChange={handleModelSelectChange}
                  >
                    <FormControl>
                      <SelectTrigger className="border-divider text-heading focus:border-cta focus-visible:ring-cta/20">
                        <SelectValue placeholder="選擇模型" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="border-divider">
                      {PRESET_MODELS.map((model) => (
                        <SelectItem
                          key={model.value}
                          value={model.value}
                          className="text-heading focus:bg-surface"
                        >
                          {model.label}
                        </SelectItem>
                      ))}
                      <SelectItem
                        value={CUSTOM_MODEL_KEY}
                        className="text-heading focus:bg-surface"
                      >
                        其他（手動輸入）
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* 自訂模型輸入框 */}
                  {selectValue === CUSTOM_MODEL_KEY && (
                    <Input
                      value={customModel}
                      onChange={(e) =>
                        handleCustomModelChange(e.target.value)
                      }
                      placeholder="輸入模型名稱，例如 gemini-2.5-flash-preview-05-20"
                      className="mt-2 border-divider text-heading placeholder:text-caption focus:border-cta focus-visible:ring-cta/20"
                    />
                  )}

                  <FormDescription className="text-caption">
                    選擇用於生成講義的 Gemini 模型。若 Google 推出新模型，可選擇「其他」手動輸入模型名稱
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <StickySaveBar isDirty={form.formState.isDirty} isPending={isPending} form="submit" label="儲存設定" />
          </CardContent>
        </Card>
      </form>
    </Form>
  )
}
