'use client'

import { useMemo, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, Send, Copy, AlertCircle } from 'lucide-react'
import { StickySaveBar } from '@/components/admin/shared/sticky-save-bar'
import {
  courseWelcomeEmailSchema,
  type CourseWelcomeEmailFormData,
} from '@/lib/validations/course-welcome-email'
import type { CourseWelcomeEmailSettings } from '@/lib/actions/course-welcome-email'
import {
  updateCourseWelcomeEmailSettings,
  sendCourseWelcomeEmailTest,
} from '@/lib/actions/course-welcome-email'
import {
  getUnknownWelcomeEmailTokens,
  renderWelcomeEmailHtmlFromMarkdown,
  renderWelcomeEmailTemplate,
} from '@/lib/welcome-email-preview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Badge } from '@/components/ui/badge'
import { MilkdownSimpleEditor } from '@/components/admin/comments/milkdown-simple-editor'

interface CourseWelcomeEmailFormProps {
  courseId: string
  courseTitle: string
  courseSlug: string
  initialSettings: CourseWelcomeEmailSettings
}

export function CourseWelcomeEmailForm({
  courseId,
  courseTitle,
  courseSlug,
  initialSettings,
}: CourseWelcomeEmailFormProps) {
  const [isPending, startTransition] = useTransition()
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [testEmail, setTestEmail] = useState('')

  const form = useForm<CourseWelcomeEmailFormData>({
    resolver: zodResolver(courseWelcomeEmailSchema),
    defaultValues: {
      enabled: initialSettings.enabled,
      subjectTemplate: initialSettings.subjectTemplate,
      markdownTemplate: initialSettings.markdownTemplate,
    },
  })

  const subjectTemplate = form.watch('subjectTemplate')
  const markdownTemplate = form.watch('markdownTemplate')
  const enabled = form.watch('enabled')

  const unknownTokens = useMemo(() => {
    return Array.from(
      new Set([
        ...getUnknownWelcomeEmailTokens(subjectTemplate || ''),
        ...getUnknownWelcomeEmailTokens(markdownTemplate || ''),
      ])
    )
  }, [subjectTemplate, markdownTemplate])

  const previewContext = useMemo(
    () => ({
      userName: '測試學員',
      courseTitle,
      courseUrl: `https://your-domain.com/courses/${courseSlug}`,
      supportEmail: 'support@example.com',
      purchaseDate: new Date().toLocaleDateString('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    }),
    [courseTitle, courseSlug]
  )

  const previewSubject = renderWelcomeEmailTemplate(subjectTemplate || '', previewContext)
  const previewMarkdown = renderWelcomeEmailTemplate(markdownTemplate || '', previewContext)
  const previewHtml = renderWelcomeEmailHtmlFromMarkdown(previewMarkdown)

  async function onSubmit(data: CourseWelcomeEmailFormData) {
    startTransition(async () => {
      const result = await updateCourseWelcomeEmailSettings(courseId, data)

      if (result.success) {
        toast.success('課程歡迎信設定已儲存')
        form.reset(data)
      } else {
        toast.error(result.error || '儲存失敗')
      }
    })
  }

  async function handleSendTest() {
    if (!testEmail.trim()) {
      toast.error('請輸入測試 Email')
      return
    }

    setIsSendingTest(true)
    try {
      const result = await sendCourseWelcomeEmailTest(courseId, {
        toEmail: testEmail.trim(),
        subjectTemplate: subjectTemplate || '',
        markdownTemplate: markdownTemplate || '',
      })

      if (result.success) {
        toast.success('測試信已送出')
        setTestEmail('')
      } else {
        toast.error(result.error || '寄送失敗')
      }
    } finally {
      setIsSendingTest(false)
    }
  }

  async function copyToken(token: string) {
    try {
      await navigator.clipboard.writeText(token)
      toast.success(`已複製 ${token}`)
    } catch {
      toast.error('複製失敗，請手動複製')
    }
  }

  return (
    <div className="h-full space-y-6 overflow-y-auto p-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="rounded-xl border-divider bg-white">
            <CardHeader>
              <CardTitle className="text-heading">課程歡迎信</CardTitle>
              <CardDescription className="text-body">
                學員完成購買後，可自動寄送課程歡迎信，提供上課入口與後續提醒。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="rounded-xl border border-divider p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <FormLabel className="text-base text-heading">啟用自動寄送</FormLabel>
                        <FormDescription className="text-caption">
                          {enabled
                            ? '購買完成後會自動寄出歡迎信。'
                            : '目前不會自動寄送歡迎信。'}
                        </FormDescription>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-divider bg-surface px-3 py-2 sm:justify-end sm:gap-3">
                        <Badge
                          variant={enabled ? 'default' : 'outline'}
                          className={
                            enabled
                              ? 'bg-emerald-600 text-white hover:bg-emerald-600'
                              : 'border-[#D4D4D4] text-body'
                          }
                        >
                          {enabled ? '已啟用' : '已停用'}
                        </Badge>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </div>
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="rounded-xl border-divider bg-white">
            <CardHeader>
              <CardTitle className="text-heading">內容模板</CardTitle>
              <CardDescription className="text-body">
                支援 Markdown 與變數替換，右側可以快速複製可用變數。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <FormField
                  control={form.control}
                  name="subjectTemplate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-heading">Email 標題</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="border-divider bg-white text-heading"
                          placeholder="歡迎加入 {{課程名稱}}"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="markdownTemplate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-heading">Markdown 內容</FormLabel>
                        <FormControl>
                          <MilkdownSimpleEditor
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="請輸入 Markdown 內容"
                            minHeight="360px"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {unknownTokens.length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4" />
                        <p>偵測到未定義的變數：{unknownTokens.join(', ')}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg border border-divider bg-surface p-3">
                    <p className="text-sm font-medium text-heading">可用變數</p>
                    <p className="mt-1 text-xs text-caption">
                      可插入標題與 Markdown 內容，送出時系統會自動替換。
                    </p>
                  </div>

                  {initialSettings.availableVariables.map((variable) => (
                    <div
                      key={variable.token}
                      className="flex flex-col gap-2 rounded-lg border border-divider p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <Badge
                            variant="outline"
                            className="max-w-full whitespace-normal break-all border-divider text-heading"
                          >
                            {variable.token}
                          </Badge>
                          <p className="text-xs text-body">{variable.label}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 border-divider"
                          onClick={() => copyToken(variable.token)}
                        >
                          <Copy className="mr-1 h-4 w-4" />
                          複製
                        </Button>
                      </div>
                      <p className="text-xs text-caption">{variable.description}</p>
                      <p className="text-xs text-caption">範例：{variable.example}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-divider bg-white">
            <CardHeader>
              <CardTitle className="text-heading">預覽與測試</CardTitle>
              <CardDescription className="text-body">
                可先寄送一封測試信，確認內容與版型。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-body">預覽標題</p>
                <p className="font-medium text-heading">{previewSubject}</p>
              </div>

              <iframe
                title="welcome-email-preview"
                srcDoc={previewHtml}
                className="h-[360px] w-full rounded-lg border border-divider bg-white"
              />

              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="請輸入測試 Email"
                  className="border-divider bg-white"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSendingTest}
                  className="border-divider"
                  onClick={handleSendTest}
                >
                  {isSendingTest ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      寄送中...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      寄送測試信
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <StickySaveBar
            isDirty={form.formState.isDirty}
            isPending={isPending}
            form="submit"
            label="儲存設定"
          />
        </form>
      </Form>
    </div>
  )
}
