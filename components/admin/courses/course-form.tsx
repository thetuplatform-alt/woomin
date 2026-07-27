'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  courseSchema,
  courseStatusOptions,
  courseVisibilityOptions,
  generateSlug,
  type CourseFormData,
} from '@/lib/validations/course'
import { createCourse } from '@/lib/actions/courses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function RequiredMark() {
  return <span className="text-destructive">*</span>
}

export function CourseForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: '',
      subtitle: '',
      slug: '',
      description: '',
      coverImage: '',
      price: 0,
      salePrice: null,
      saleEndAt: null,
      saleLabel: '',
      saleCycleEnabled: false,
      saleCycleDays: null,
      showCountdown: true,
      seoTitle: '',
      seoDesc: '',
      seoKeywords: '',
      ogTitle: '',
      ogDescription: '',
      ogImage: '',
      landingPageMode: null,
      landingPageSlug: '',
      landingPageHtml: '',
      instructorName: '',
      instructorTitle: '',
      instructorDesc: '',
      courseWorkload: '',
      ratingValue: '',
      ratingCount: '',
      notifyAdminOnPurchase: false,
      status: 'DRAFT',
      salesVisibility: 'PUBLIC',
    },
  })

  const titleValue = useWatch({ control: form.control, name: 'title' })

  useEffect(() => {
    if (!titleValue) return

    // 使用者一旦手動編輯過 slug，就不再自動覆蓋
    if (form.getFieldState('slug').isDirty) return

    const generatedSlug = generateSlug(titleValue)
    // 純中文 / 注音等無法產生有效 slug 時保持空白，交由使用者手動輸入
    if (!generatedSlug) return
    // 值沒有變化就不要再 setValue，避免不必要的 re-render
    if (form.getValues('slug') === generatedSlug) return

    form.setValue('slug', generatedSlug, {
      shouldDirty: false,
      shouldValidate: true,
    })
  }, [form, titleValue])

  async function onSubmit(data: CourseFormData) {
    startTransition(async () => {
      const result = await createCourse(data)

      if (!result.success || !result.course) {
        toast.error(result.error || '建立課程失敗')
        return
      }

      toast.success('課程已建立')
      router.push(`/admin/courses/${result.course.id}/info`)
      router.refresh()
    })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="max-w-2xl space-y-5"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem data-tour="course-title">
              <FormLabel>
                課程標題 <RequiredMark />
              </FormLabel>
              <FormControl>
                <Input placeholder="例如：Claude AI 工作流實戰班" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem data-tour="course-slug">
              <FormLabel>
                Slug <RequiredMark />
              </FormLabel>
              <FormControl>
                <Input placeholder="claude-ai-workflow-101" {...field} />
              </FormControl>
              <p className="text-sm text-muted-foreground">
                會根據課程標題自動產生，必要時可手動調整。
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="subtitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>副標題</FormLabel>
              <FormControl>
                <Input
                  placeholder="一句話補充這門課的重點價值"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>課程描述</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="先簡單描述這門課會幫助學生解決什麼問題。"
                  className="min-h-28"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem data-tour="course-price">
              <FormLabel>
                價格 <RequiredMark />
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={field.value ?? 0}
                  onChange={(event) => field.onChange(Number(event.target.value || 0))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem data-tour="course-status">
              <FormLabel>
                課程狀態 <RequiredMark />
              </FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇課程狀態" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {courseStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="salesVisibility"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                販售可見性 <RequiredMark />
              </FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value ?? 'PUBLIC'}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇販售方式" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {courseVisibilityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                這會控制課程是否出現在公開列表，或是否需要邀請連結。
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end" data-tour="course-submit">
          <Button type="submit" disabled={isPending}>
            {isPending ? '建立中...' : '建立課程'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
