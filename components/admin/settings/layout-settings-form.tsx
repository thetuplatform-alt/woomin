// components/admin/settings/layout-settings-form.tsx
// Header / Footer 版面設定表單
// 以視覺化左右分區排列，模擬實際前台呈現

'use client'

import { useTransition } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  layoutSettingsSchema,
  type LayoutSettingsFormData,
} from '@/lib/validations/settings'
import { updateLayoutSettings } from '@/lib/actions/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { IconPicker } from '@/components/ui/icon-picker'
import {
  Plus,
  X,
  ExternalLink,
  PanelTop,
  PanelBottom,
} from 'lucide-react'
import { StickySaveBar } from '@/components/admin/shared/sticky-save-bar'

interface LayoutSettingsFormProps {
  initialData: {
    headerLeftLinks: string
    headerRightLinks: string
    footerDescription: string
    footerSections: string
  }
}

function safeParseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function LayoutSettingsForm({ initialData }: LayoutSettingsFormProps) {
  const [isPending, startTransition] = useTransition()

  const form = useForm<LayoutSettingsFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(layoutSettingsSchema) as any,
    defaultValues: {
      headerLeftLinks: safeParseJson(initialData.headerLeftLinks, []),
      headerRightLinks: safeParseJson(initialData.headerRightLinks, []),
      footerDescription: initialData.footerDescription || '',
      footerSections: safeParseJson(initialData.footerSections, []),
    },
  })

  const headerLeftLinks = useFieldArray({
    control: form.control,
    name: 'headerLeftLinks',
  })

  const headerRightLinks = useFieldArray({
    control: form.control,
    name: 'headerRightLinks',
  })

  const footerSections = useFieldArray({
    control: form.control,
    name: 'footerSections',
  })

  async function onSubmit(data: LayoutSettingsFormData) {
    startTransition(async () => {
      try {
        const result = await updateLayoutSettings(data)
        if (result.success) {
          toast.success('版面設定已儲存')
          form.reset(data)
        } else {
          toast.error(result.error ?? '儲存版面設定失敗')
        }
      } catch {
        toast.error('操作失敗，請稍後再試')
      }
    })
  }

  function handleSubmitWithValidation() {
    form.handleSubmit(onSubmit)()
    // 若表單驗證失敗，顯示錯誤提示
    if (Object.keys(form.formState.errors).length > 0) {
      toast.error('請檢查表單欄位，連結的名稱與網址不能為空')
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmitWithValidation()
        }}
        className="space-y-8"
      >
        <Card className="bg-white border border-divider rounded-xl">
          <CardContent className="pt-6 space-y-8">
            {/* ── Header 設定 ── */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <PanelTop className="h-5 w-5 text-cta" />
                <h2 className="text-lg font-bold text-heading">Header 設定</h2>
              </div>

              {/* Header 預覽線框 */}
              <div className="rounded-xl border border-divider bg-surface overflow-hidden">
                {/* 模擬 Header 條 */}
                <div className="flex items-center justify-between border-b border-divider bg-white px-5 py-3">
                  <div className="flex items-center gap-4">
                    <div className="h-6 w-6 rounded-full bg-[#E5E5E5]" />
                    <span className="text-xs font-semibold text-caption">Logo</span>
                    {headerLeftLinks.fields.map((f, i) => {
                      const label = form.watch(`headerLeftLinks.${i}.label`)
                      return (
                        <span key={f.id} className="text-xs text-body">
                          {label || '...'}
                        </span>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-4">
                    {headerRightLinks.fields.map((f, i) => {
                      const label = form.watch(`headerRightLinks.${i}.label`)
                      return (
                        <span key={f.id} className="text-xs text-body">
                          {label || '...'}
                        </span>
                      )
                    })}
                    <div className="h-6 w-6 rounded-full bg-[#E5E5E5]" />
                  </div>
                </div>

                {/* 左右編輯區域 */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-divider">
                  {/* 左側 */}
                  <div className="p-5 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-caption">
                      左側（Logo 旁）
                    </p>
                    {headerLeftLinks.fields.map((field, index) => (
                      <LinkRow
                        key={field.id}
                        form={form}
                        prefix={`headerLeftLinks.${index}` as const}
                        onRemove={() => headerLeftLinks.remove(index)}
                        namePlaceholder="部落格"
                        urlPlaceholder="https://blog.example.com"
                      />
                    ))}
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-xs font-medium text-caption hover:text-cta transition-colors"
                      onClick={() =>
                        headerLeftLinks.append({
                          label: '',
                          url: '',
                          openInNewTab: true,
                        })
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      新增連結
                    </button>
                  </div>

                  {/* 右側 */}
                  <div className="p-5 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-caption">
                      右側（登入按鈕旁）
                    </p>
                    {headerRightLinks.fields.map((field, index) => (
                      <LinkRow
                        key={field.id}
                        form={form}
                        prefix={`headerRightLinks.${index}` as const}
                        onRemove={() => headerRightLinks.remove(index)}
                        namePlaceholder="課程名稱"
                        urlPlaceholder="https://example.com/course"
                      />
                    ))}
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-xs font-medium text-caption hover:text-cta transition-colors"
                      onClick={() =>
                        headerRightLinks.append({
                          label: '',
                          url: '',
                          openInNewTab: false,
                        })
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      新增連結
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Footer 設定 ── */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <PanelBottom className="h-5 w-5 text-cta" />
                <h2 className="text-lg font-bold text-heading">Footer 設定</h2>
              </div>

              <div className="rounded-xl border border-divider bg-surface overflow-hidden">
                {/* Footer 預覽線框 */}
                <div className="flex flex-col md:flex-row items-start justify-between gap-4 border-b border-divider bg-white px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded-full bg-[#E5E5E5]" />
                    <span className="text-xs text-caption max-w-[200px] truncate">
                      {form.watch('footerDescription') || '品牌描述...'}
                    </span>
                  </div>
                  <div className="flex items-center gap-6">
                    {footerSections.fields.map((s, i) => {
                      const title = form.watch(`footerSections.${i}.title`)
                      return (
                        <span key={s.id} className="text-xs font-semibold text-body">
                          {title || '區塊...'}
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* 左右編輯區域 */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-divider">
                  {/* 左側 — 描述 */}
                  <div className="p-5 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-caption">
                      左側（Logo 下方描述）
                    </p>
                    <FormField
                      control={form.control}
                      name="footerDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              placeholder="在這裡輸入網站的簡短介紹文字。"
                              className="min-h-[100px] bg-white border-divider text-sm resize-none"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <p className="text-xs text-caption">最多 500 字</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* 右側 — 連結區塊 */}
                  <div className="p-5 space-y-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-caption">
                      右側（連結區塊）
                    </p>

                    {footerSections.fields.map((section, sectionIndex) => (
                      <FooterSectionEditor
                        key={section.id}
                        form={form}
                        sectionIndex={sectionIndex}
                        onRemove={() => footerSections.remove(sectionIndex)}
                      />
                    ))}

                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-xs font-medium text-caption hover:text-cta transition-colors"
                      onClick={() =>
                        footerSections.append({ title: '', links: [] })
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      新增區塊
                    </button>
                  </div>
                </div>
              </div>
            </section>

          </CardContent>
        </Card>
        <StickySaveBar isDirty={form.formState.isDirty} isPending={isPending} form="submit" label="儲存版面設定" />
      </form>
    </Form>
  )
}

/* ── 共用：單筆連結列 ── */
function LinkRow({
  form,
  prefix,
  onRemove,
  namePlaceholder,
  urlPlaceholder,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any
  prefix: string
  onRemove: () => void
  namePlaceholder: string
  urlPlaceholder: string
}) {
  // 檢查此列是否有驗證錯誤
  const parts = prefix.split('.')
  const hasError = form.formState.errors?.[parts[0]]?.[Number(parts[1])]

  return (
    <div className={`group flex items-center gap-2 rounded-lg border bg-white p-2 transition-shadow hover:shadow-sm ${
      hasError ? 'border-red-300' : 'border-divider'
    }`}>
      {/* 名稱 */}
      <FormField
        control={form.control}
        name={`${prefix}.label`}
        render={({ field }) => (
          <FormItem className="flex-1 min-w-0">
            <FormControl>
              <Input
                placeholder={namePlaceholder}
                className="h-8 border-0 bg-transparent px-2 text-sm shadow-none focus-visible:ring-0"
                {...field}
              />
            </FormControl>
          </FormItem>
        )}
      />

      <span className="text-[#E5E5E5]">|</span>

      {/* 網址 */}
      <FormField
        control={form.control}
        name={`${prefix}.url`}
        render={({ field }) => (
          <FormItem className="flex-1 min-w-0">
            <FormControl>
              <Input
                placeholder={urlPlaceholder}
                className="h-8 border-0 bg-transparent px-2 text-xs text-caption shadow-none focus-visible:ring-0"
                {...field}
              />
            </FormControl>
          </FormItem>
        )}
      />

      {/* 新分頁 toggle */}
      <FormField
        control={form.control}
        name={`${prefix}.openInNewTab`}
        render={({ field }) => (
          <FormItem className="flex-shrink-0">
            <FormControl>
              <button
                type="button"
                onClick={() => field.onChange(!field.value)}
                className={`p-1 rounded transition-colors ${
                  field.value
                    ? 'text-cta bg-cta/10'
                    : 'text-caption hover:text-body'
                }`}
                title={field.value ? '在新分頁開啟' : '在同一頁開啟'}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </FormControl>
          </FormItem>
        )}
      />

      {/* 刪除 */}
      <button
        type="button"
        className="flex-shrink-0 p-1 text-caption opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/* ── Footer Section 編輯器 ── */
function FooterSectionEditor({
  form,
  sectionIndex,
  onRemove,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any
  sectionIndex: number
  onRemove: () => void
}) {
  const links = useFieldArray({
    control: form.control,
    name: `footerSections.${sectionIndex}.links`,
  })

  return (
    <div className="rounded-lg border border-divider bg-white p-3 space-y-2">
      {/* 區塊標題列 */}
      <div className="flex items-center gap-2">
        <FormField
          control={form.control}
          name={`footerSections.${sectionIndex}.title`}
          render={({ field }) => (
            <FormItem className="flex-1 min-w-0">
              <FormControl>
                <Input
                  placeholder="區塊名稱（如：社群）"
                  className="h-8 border-0 bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:ring-0"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <button
          type="button"
          className="flex-shrink-0 p-1 text-caption hover:text-red-500 transition-colors"
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 連結列表 */}
      <div className="space-y-1.5 pl-3 border-l-2 border-[#F5F5F5]">
        {links.fields.map((link, linkIndex) => (
          <div
            key={link.id}
            className="group flex items-center gap-2"
          >
            {/* icon */}
            <FormField
              control={form.control}
              name={`footerSections.${sectionIndex}.links.${linkIndex}.icon`}
              render={({ field }) => (
                <FormItem className="flex-shrink-0">
                  <FormControl>
                    <IconPicker
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="圖示"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {/* label */}
            <FormField
              control={form.control}
              name={`footerSections.${sectionIndex}.links.${linkIndex}.label`}
              render={({ field }) => (
                <FormItem className="flex-1 min-w-0">
                  <FormControl>
                    <Input
                      placeholder="名稱"
                      className="h-7 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <span className="text-[#E5E5E5] text-xs">→</span>
            {/* url */}
            <FormField
              control={form.control}
              name={`footerSections.${sectionIndex}.links.${linkIndex}.url`}
              render={({ field }) => (
                <FormItem className="flex-1 min-w-0">
                  <FormControl>
                    <Input
                      placeholder="https://..."
                      className="h-7 border-0 bg-transparent px-1 text-xs text-caption shadow-none focus-visible:ring-0"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <button
              type="button"
              className="flex-shrink-0 p-0.5 text-caption opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
              onClick={() => links.remove(linkIndex)}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-caption hover:text-cta transition-colors pt-1"
          onClick={() => links.append({ label: '', url: '', icon: '' })}
        >
          <Plus className="h-3 w-3" />
          新增連結
        </button>
      </div>
    </div>
  )
}
