// components/admin/courses/course-details-form.tsx
// 課程詳細設定表單（課程資訊 tab）
// 包含基本資訊、封面圖片、講師資訊、課程狀態、SEO、OG/Social、銷售頁設定、通知設定

'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  courseDetailsSchema,
  type CourseDetailsFormData,
  courseStatusOptions,
  courseVisibilityOptions,
  watermarkEmailDisplayModeOptions,
  watermarkMovementModeOptions,
  watermarkTextSizeOptions,
} from '@/lib/validations/course'
import {
  updateCourseDetails,
  updateCourseInstructors,
  type CourseWithVideoWatermarkSetting,
} from '@/lib/actions/courses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Trash2,
  FileText,
  ImageIcon,
  User,
  Settings,
  Search,
  Globe,
  FileCode,
  Bell,
  ArrowRight,
  Shield,
} from 'lucide-react'
import { ImageUpload } from '@/components/admin/media/image-upload'
import { SectionNav, type SectionNavItem } from '@/components/admin/course-editor/section-nav'
import { StickySaveBar } from '@/components/admin/shared/sticky-save-bar'

const sectionItems: SectionNavItem[] = [
  { id: 'basic-info', label: '基本資訊', icon: FileText },
  { id: 'cover-image', label: '封面圖片', icon: ImageIcon },
  { id: 'instructor-access', label: '管理權限', icon: Shield },
  { id: 'instructor', label: '講師資訊', icon: User },
  { id: 'status', label: '課程狀態', icon: Settings },
  { id: 'seo', label: 'SEO 設定', icon: Search },
  { id: 'og', label: 'OG / Social', icon: Globe },
  { id: 'landing-page', label: '銷售頁設定', icon: FileCode },
  { id: 'video-watermark', label: '影片浮水印', icon: Shield },
  { id: 'notifications', label: '通知設定', icon: Bell },
]

interface CourseDetailsFormProps {
  course: CourseWithVideoWatermarkSetting
  instructors: { id: string; name: string | null; email: string }[]
  currentUserId: string
  currentUserRole: string
}

export function CourseDetailsForm({
  course,
  instructors,
  currentUserId,
  currentUserRole,
}: CourseDetailsFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [imagePreview, setImagePreview] = useState<string | null>(
    course.coverImage ?? null
  )
  const [selectedInstructorIds, setSelectedInstructorIds] = useState<string[]>(
    course.instructors.map((item) => item.userId)
  )

  // 只有管理員或課程建立者可以調整講師指派
  const canEditInstructors =
    currentUserRole === 'ADMIN' || course.createdById === currentUserId
  // 講師指派的初始名單（用於判斷是否真的有變動）
  const initialInstructorIds = course.instructors.map((item) => item.userId)
  // 講師名單相對初始值是否有變動（用於觸發儲存列顯示）
  const instructorsDirty =
    canEditInstructors &&
    (selectedInstructorIds.length !== initialInstructorIds.length ||
      !selectedInstructorIds.every((id) => initialInstructorIds.includes(id)))
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const form = useForm<CourseDetailsFormData>({
    resolver: zodResolver(courseDetailsSchema),
    defaultValues: {
      title: course.title ?? '',
      subtitle: course.subtitle ?? '',
      slug: course.slug ?? '',
      description: course.description ?? '',
      coverImage: course.coverImage ?? '',
      instructorName: course.instructorName ?? '',
      instructorTitle: course.instructorTitle ?? '',
      instructorDesc: course.instructorDesc ?? '',
      status: course.status ?? 'DRAFT',
      salesVisibility: course.salesVisibility ?? 'PUBLIC',
      seoTitle: course.seoTitle ?? '',
      seoDesc: course.seoDesc ?? '',
      seoKeywords: course.seoKeywords ?? '',
      ogTitle: course.ogTitle ?? '',
      ogDescription: course.ogDescription ?? '',
      ogImage: course.ogImage ?? '',
      landingPageMode: (course.landingPageMode as 'react' | 'html' | undefined) ?? undefined,
      landingPageSlug: course.landingPageSlug ?? '',
      landingPageHtml: course.landingPageHtml ?? '',
      notifyAdminOnPurchase: course.notifyAdminOnPurchase ?? false,
      watermarkEnabled: course.videoWatermarkSetting?.enabled ?? false,
      watermarkShowEmail: course.videoWatermarkSetting?.showEmail ?? true,
      watermarkShowCourseTitle:
        course.videoWatermarkSetting?.showCourseTitle ?? true,
      watermarkShowTimestamp:
        course.videoWatermarkSetting?.showTimestamp ?? true,
      watermarkEmailDisplayMode:
        course.videoWatermarkSetting?.emailDisplayMode ?? 'FULL',
      watermarkOpacityPercent:
        course.videoWatermarkSetting?.opacityPercent ?? 18,
      watermarkTextSize: course.videoWatermarkSetting?.textSize ?? 'MD',
      watermarkMovementMode:
        course.videoWatermarkSetting?.movementMode ?? 'STANDARD',
      watermarkMoveIntervalSec:
        course.videoWatermarkSetting?.moveIntervalSec ?? 12,
      watermarkTamperPauseEnabled:
        course.videoWatermarkSetting?.tamperPauseEnabled ?? true,
    },
  })

  const watermarkEnabled = form.watch('watermarkEnabled')
  const watermarkShowEmail = form.watch('watermarkShowEmail')
  const watermarkShowCourseTitle = form.watch('watermarkShowCourseTitle')
  const watermarkShowTimestamp = form.watch('watermarkShowTimestamp')
  const watermarkEmailDisplayMode = form.watch('watermarkEmailDisplayMode')
  const watermarkOpacityPercent = form.watch('watermarkOpacityPercent')
  const watermarkTextSize = form.watch('watermarkTextSize')
  const watermarkMovementMode = form.watch('watermarkMovementMode')
  const watermarkMoveIntervalSec = form.watch('watermarkMoveIntervalSec')

  const previewEmail =
    watermarkEmailDisplayMode === 'MASKED'
      ? 'ra***@example.com'
      : 'fish@fishot.com'
  const previewTextSizeClass =
    watermarkTextSize === 'SM'
      ? 'text-xs'
      : watermarkTextSize === 'LG'
        ? 'text-base'
        : 'text-sm'

  // 監聽封面圖片變化
  const watchCoverImage = form.watch('coverImage')
  useEffect(() => {
    if (watchCoverImage) {
      setImagePreview(watchCoverImage)
    } else {
      setImagePreview(null)
    }
  }, [watchCoverImage])

  async function onSubmit(data: CourseDetailsFormData) {
    // 是否需要更新講師指派：有權限且名單相對初始值有變動
    const sameIds =
      selectedInstructorIds.length === initialInstructorIds.length &&
      selectedInstructorIds.every((id) => initialInstructorIds.includes(id))
    const shouldUpdateInstructors = canEditInstructors && !sameIds

    // 清空名單＝開放給全部講師，按下儲存前再次確認
    if (
      shouldUpdateInstructors &&
      selectedInstructorIds.length === 0 &&
      initialInstructorIds.length > 0
    ) {
      const confirmed = window.confirm(
        '清空講師後，平台上所有講師都將能管理此課程。確定要這麼做嗎？'
      )
      if (!confirmed) return
    }

    startTransition(async () => {
      try {
        const detailsResult = await updateCourseDetails(course.id, data)

        let instructorsResult: { success: boolean; error?: string } = {
          success: true,
        }
        if (shouldUpdateInstructors) {
          instructorsResult = await updateCourseInstructors(
            course.id,
            selectedInstructorIds
          )
        }

        if (detailsResult.success && instructorsResult.success) {
          toast.success('課程資訊已更新')
          form.reset(data)
          router.refresh()
        } else if (detailsResult.success) {
          // 課程資訊已寫入，但講師指派失敗：分開明確提示，避免誤以為整體失敗
          toast.success('課程資訊已更新')
          toast.error(instructorsResult.error ?? '講師指派更新失敗')
          form.reset(data)
          router.refresh()
        } else {
          toast.error(detailsResult.error ?? '更新失敗')
        }
      } catch {
        toast.error('操作失敗，請稍後再試')
      }
    })
  }

  return (
    <div className="flex gap-8 h-full">
      <SectionNav items={sectionItems} scrollContainerRef={scrollContainerRef} />

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-3xl mx-auto">
            {/* ========== 基本資訊 ========== */}
            <Card data-section="basic-info" className="bg-white border-divider rounded-xl">
              <CardHeader>
                <CardTitle className="text-heading">基本資訊</CardTitle>
                <CardDescription className="text-body">
                  設定課程的基本資訊
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-heading">
                        課程標題 <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="輸入課程標題"
                          className="bg-white border-divider text-heading placeholder:text-caption rounded-lg"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subtitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-heading">副標題</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="輸入課程副標題（選填）"
                          className="bg-white border-divider text-heading placeholder:text-caption rounded-lg"
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
                  name="slug"
                  render={({ field }) => (
                    <FormItem data-tour="basic-info-slug">
                      <FormLabel className="text-heading">
                        Slug <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="course-slug"
                          className="bg-white border-divider text-heading placeholder:text-caption rounded-lg"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-caption">
                        課程網址的識別碼，只能包含小寫字母、數字和連字號
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-heading">課程描述</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="輸入課程描述..."
                          className="min-h-32 bg-white border-divider text-heading placeholder:text-caption rounded-lg"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* ========== 封面圖片 ========== */}
            <Card data-section="cover-image" data-tour="cover-image" className="bg-white border-divider rounded-xl">
              <CardHeader>
                <CardTitle className="text-heading">封面圖片</CardTitle>
                <CardDescription className="text-body">
                  設定課程的封面圖片
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {imagePreview ? (
                  <div className="space-y-4">
                    <p className="text-sm text-body">目前封面圖片</p>
                    <div className="relative w-full max-w-md aspect-video rounded-xl border border-divider bg-surface overflow-hidden group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="封面預覽"
                        className="w-full h-full object-cover"
                        onError={() => setImagePreview(null)}
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => {
                            form.setValue('coverImage', '', { shouldDirty: true })
                            setImagePreview(null)
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          移除圖片
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-caption">
                      將滑鼠移到圖片上可移除，或上傳新圖片以取代
                    </p>
                    <ImageUpload
                      onUploadComplete={(media) => {
                        form.setValue('coverImage', media.url, { shouldDirty: true })
                        setImagePreview(media.url)
                      }}
                      onError={(error) => toast.error(error)}
                      multiple={false}
                      maxSize={10}
                    />
                  </div>
                ) : (
                  <ImageUpload
                    onUploadComplete={(media) => {
                      form.setValue('coverImage', media.url, { shouldDirty: true })
                      setImagePreview(media.url)
                    }}
                    onError={(error) => toast.error(error)}
                    multiple={false}
                    maxSize={10}
                  />
                )}
              </CardContent>
            </Card>

            <Card data-section="instructor-access" className="bg-white border-divider rounded-xl">
              <CardHeader>
                <CardTitle className="text-heading">講師管理權限</CardTitle>
                <CardDescription className="text-body">
                  未指定講師時，全部講師都可以管理此課程。指定任一講師後，只有被選取的講師與管理員可管理。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-divider bg-surface px-4 py-3">
                  <div>
                    <p className="font-medium text-heading">目前權限範圍</p>
                    <p className="text-sm text-body">
                      {selectedInstructorIds.length === 0
                        ? '全部講師皆可管理此課程'
                        : `已指定 ${selectedInstructorIds.length} 位講師`}
                    </p>
                  </div>
                  <Badge data-tour="instructor-access-badge" className={selectedInstructorIds.length === 0 ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : 'bg-cta text-white hover:bg-cta'}>
                    {selectedInstructorIds.length === 0 ? '全部講師' : '指定講師'}
                  </Badge>
                </div>

                {!canEditInstructors && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    僅課程建立者或管理員可以調整講師管理權限。你仍可編輯此課程的其他內容。
                  </p>
                )}

                {instructors.length === 0 ? (
                  <p className="rounded-lg border border-divider bg-surface px-4 py-6 text-sm text-body">
                    尚未有講師帳號。請先到用戶管理新增講師。
                  </p>
                ) : (
                  <div className="space-y-2">
                    {instructors.map((instructor) => {
                      const checked = selectedInstructorIds.includes(instructor.id)
                      return (
                        <label
                          key={instructor.id}
                          className={
                            canEditInstructors
                              ? 'flex cursor-pointer items-center gap-3 rounded-lg border border-divider px-4 py-3 hover:bg-surface'
                              : 'flex items-center gap-3 rounded-lg border border-divider px-4 py-3 opacity-60'
                          }
                        >
                          <Checkbox
                            checked={checked}
                            disabled={!canEditInstructors}
                            onCheckedChange={(value) => {
                              setSelectedInstructorIds((prev) =>
                                value
                                  ? Array.from(new Set([...prev, instructor.id]))
                                  : prev.filter((id) => id !== instructor.id)
                              )
                            }}
                          />
                          <span className="min-w-0">
                            <span className="block font-medium text-heading">
                              {instructor.name || '未設定姓名'}
                            </span>
                            <span className="block text-sm text-body">{instructor.email}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ========== 講師資訊 ========== */}
            <Card data-section="instructor" className="bg-white border-divider rounded-xl">
              <CardHeader>
                <CardTitle className="text-heading">講師資訊</CardTitle>
                <CardDescription className="text-body">
                  設定講師的公開顯示資訊，同時也會用於搜尋引擎結構化資料
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="instructorName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-heading">講師名稱</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="例如：講師姓名"
                            className="bg-white border-divider text-heading placeholder:text-caption rounded-lg"
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
                    name="instructorTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-heading">講師職稱</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="例如：課程講師"
                            className="bg-white border-divider text-heading placeholder:text-caption rounded-lg"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="instructorDesc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-heading">講師簡介</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="講師的簡短介紹"
                          className="min-h-20 bg-white border-divider text-heading placeholder:text-caption rounded-lg"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* ========== 課程狀態 ========== */}
            <Card data-section="status" data-tour="status-selects" className="bg-white border-divider rounded-xl">
              <CardHeader>
                <CardTitle className="text-heading">課程狀態</CardTitle>
                <CardDescription className="text-body">
                  控制課程是否上架，以及上架後的販售可見性
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-heading">
                        狀態 <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-white border-divider text-heading rounded-lg">
                            <SelectValue placeholder="選擇狀態" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-white border-divider rounded-lg">
                          {courseStatusOptions.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              className="text-heading focus:bg-surface focus:text-heading"
                            >
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
                      <FormLabel className="text-heading">
                        販售可見性 <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value ?? 'PUBLIC'}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-white border-divider text-heading rounded-lg">
                            <SelectValue placeholder="選擇販售方式" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-white border-divider rounded-lg">
                          {courseVisibilityOptions.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              className="text-heading focus:bg-surface focus:text-heading"
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-caption">
                        公開販售會出現在前台列表；連結販售只給知道網址的人；
                        私密邀請需有效 invite token 才會顯示購買入口。
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* ========== SEO 設定 ========== */}
            <Card data-section="seo" className="bg-white border-divider rounded-xl">
              <CardHeader>
                <CardTitle className="text-heading">SEO 設定</CardTitle>
                <CardDescription className="text-body">
                  優化搜尋引擎的顯示效果
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="seoTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-heading">SEO 標題</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="搜尋結果顯示的標題"
                          className="bg-white border-divider text-heading placeholder:text-caption rounded-lg"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription className="text-caption">
                        建議 60 字元以內
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="seoDesc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-heading">SEO 描述</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="搜尋結果顯示的描述文字"
                          className="min-h-20 bg-white border-divider text-heading placeholder:text-caption rounded-lg"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription className="text-caption">
                        建議 160 字元以內
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="seoKeywords"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-heading">SEO 關鍵字</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="關鍵字1, 關鍵字2, 關鍵字3"
                          className="bg-white border-divider text-heading placeholder:text-caption rounded-lg"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription className="text-caption">
                        以逗號分隔多個關鍵字
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* ========== OG / Social ========== */}
            <Card data-section="og" className="bg-white border-divider rounded-xl">
              <CardHeader>
                <CardTitle className="text-heading flex items-center gap-2">
                  <Globe className="h-5 w-5 text-cta" />
                  OG / Social 設定
                </CardTitle>
                <CardDescription className="text-body">
                  社群分享時的顯示內容（與 SEO 分開管理）
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="ogTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-heading">OG 標題</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="社群分享時顯示的標題（未填寫則使用課程名稱）"
                          className="bg-white border-divider text-heading placeholder:text-caption rounded-lg"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription className="text-caption">
                        可覆蓋全站分享標題與課程名稱，建議 120 字元以內
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ogDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-heading">OG 描述</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="社群分享時顯示的描述（未填寫則使用 SEO 描述）"
                          className="min-h-20 bg-white border-divider text-heading placeholder:text-caption rounded-lg"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription className="text-caption">
                        建議 300 字元以內，未填寫時自動使用 SEO 描述
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ogImage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-heading">OG 圖片</FormLabel>
                      {field.value ? (
                        <div className="space-y-3">
                          <div className="relative w-full max-w-md aspect-1200/630 rounded-xl border border-divider bg-surface overflow-hidden group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={field.value}
                              alt="OG 圖片預覽"
                              className="w-full h-full object-cover"
                              onError={() => field.onChange('')}
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="rounded-lg"
                                onClick={() => field.onChange('')}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                移除圖片
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-caption">
                            將滑鼠移到圖片上可移除，或上傳新圖片以取代
                          </p>
                          <ImageUpload
                            onUploadComplete={(media) => field.onChange(media.url)}
                            onError={(error) => toast.error(error)}
                            multiple={false}
                            maxSize={10}
                          />
                        </div>
                      ) : (
                        <ImageUpload
                          onUploadComplete={(media) => field.onChange(media.url)}
                          onError={(error) => toast.error(error)}
                          multiple={false}
                          maxSize={10}
                        />
                      )}
                      <FormDescription className="text-caption">
                        建議尺寸 1200x630，未上傳時自動使用封面圖片
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* ========== 銷售頁設定 ========== */}
            <Card data-section="landing-page" className="bg-white border-divider rounded-xl">
              <CardHeader>
                <CardTitle className="text-heading flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-cta" />
                  銷售頁設定
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-body text-sm">
                  請跟 AI 說：
                </p>
                <p className="text-body text-sm bg-neutral-100 p-2 m-2 whitespace-pre-wrap rounded-lg">
                  請參考 <span className="font-mono font-medium text-heading">create-landing-page</span> 這個 skill，幫我替 <span className="font-mono font-medium text-heading">{form.watch('slug') || '{slug}'}</span> 課程建立一個專屬銷售頁
                </p>
              </CardContent>
            </Card>

            {/* ========== 通知設定 ========== */}
            <Card data-section="video-watermark" className="bg-white border-divider rounded-xl">
              <CardHeader>
                <CardTitle className="text-heading flex items-center gap-2">
                  <Shield className="h-5 w-5 text-cta" />
                  影片防翻拍浮水印
                </CardTitle>
                <CardDescription className="text-body">
                  在課程播放頁顯示會移動的學員專屬浮水印，降低翻拍與外流風險。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="watermarkEnabled"
                  render={({ field }) => (
                    <FormItem data-tour="watermark-toggle" className="flex flex-row items-center justify-between rounded-xl bg-surface/70 px-4 py-4">
                      <div className="space-y-1">
                        <FormLabel className="text-heading">
                          啟用播放浮水印
                        </FormLabel>
                        <FormDescription className="text-caption">
                          播放時顯示學員識別資訊，並在畫面中緩慢移動。
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {watermarkEnabled && (
                  <div className="space-y-5 rounded-2xl bg-surface/55 p-4 md:p-5">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-heading">顯示內容</p>
                        <p className="text-xs text-caption">建議至少保留 Email 或課程名稱</p>
                      </div>

                      <div className="grid gap-2 md:grid-cols-3">
                        <FormField
                          control={form.control}
                          name="watermarkShowEmail"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                              <div className="pr-3">
                                <FormLabel className="text-sm text-heading">學員 Email</FormLabel>
                                <FormDescription className="mt-1 text-xs text-caption">
                                  最容易追溯來源
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={!watermarkEnabled}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="watermarkShowCourseTitle"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                              <div className="pr-3">
                                <FormLabel className="text-sm text-heading">課程名稱</FormLabel>
                                <FormDescription className="mt-1 text-xs text-caption">
                                  保留影片歸屬感
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={!watermarkEnabled}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="watermarkShowTimestamp"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                              <div className="pr-3">
                                <FormLabel className="text-sm text-heading">播放時間</FormLabel>
                                <FormDescription className="mt-1 text-xs text-caption">
                                  方便追查片段
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={!watermarkEnabled}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
                      <div className="space-y-4 rounded-xl bg-white px-4 py-4">
                        <p className="text-sm font-medium text-heading">顯示樣式</p>

                        <div className="grid gap-4 sm:grid-cols-3">
                          <FormField
                            control={form.control}
                            name="watermarkEmailDisplayMode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-caption">Email</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  disabled={!watermarkEnabled}
                                >
                                  <FormControl>
                                    <SelectTrigger className="bg-white border-divider text-heading rounded-lg">
                                      <SelectValue placeholder="選擇顯示方式" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="bg-white border-divider rounded-lg">
                                    {watermarkEmailDisplayModeOptions.map((option) => (
                                      <SelectItem
                                        key={option.value}
                                        value={option.value}
                                        className="text-heading focus:bg-surface focus:text-heading"
                                      >
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
                            name="watermarkTextSize"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-caption">字體</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  disabled={!watermarkEnabled}
                                >
                                  <FormControl>
                                    <SelectTrigger className="bg-white border-divider text-heading rounded-lg">
                                      <SelectValue placeholder="選擇字體大小" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="bg-white border-divider rounded-lg">
                                    {watermarkTextSizeOptions.map((option) => (
                                      <SelectItem
                                        key={option.value}
                                        value={option.value}
                                        className="text-heading focus:bg-surface focus:text-heading"
                                      >
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
                            name="watermarkMovementMode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-caption">移動</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  disabled={!watermarkEnabled}
                                >
                                  <FormControl>
                                    <SelectTrigger className="bg-white border-divider text-heading rounded-lg">
                                      <SelectValue placeholder="選擇移動模式" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="bg-white border-divider rounded-lg">
                                    {watermarkMovementModeOptions.map((option) => (
                                      <SelectItem
                                        key={option.value}
                                        value={option.value}
                                        className="text-heading focus:bg-surface focus:text-heading"
                                      >
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="watermarkOpacityPercent"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm text-heading">
                                  透明度 <span className="text-body">{field.value ?? 18}%</span>
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="range"
                                    min={12}
                                    max={28}
                                    step={1}
                                    disabled={!watermarkEnabled}
                                    className="h-10 cursor-pointer rounded-lg border-divider px-0"
                                    {...field}
                                    value={field.value ?? 18}
                                    onChange={(event) =>
                                      field.onChange(Number(event.target.value))
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="watermarkMoveIntervalSec"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm text-heading">
                                  間隔 <span className="text-body">{field.value ?? 12} 秒</span>
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="range"
                                    min={8}
                                    max={20}
                                    step={1}
                                    disabled={!watermarkEnabled}
                                    className="h-10 cursor-pointer rounded-lg border-divider px-0"
                                    {...field}
                                    value={field.value ?? 12}
                                    onChange={(event) =>
                                      field.onChange(Number(event.target.value))
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <p className="text-xs leading-6 text-caption">
                          建議維持完整 Email、18% 透明度與 10-15 秒間隔，通常最平衡。
                        </p>
                      </div>

                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="watermarkTamperPauseEnabled"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-xl bg-white px-4 py-4">
                              <div className="pr-3">
                                <FormLabel className="text-sm text-heading">異常隱藏時暫停</FormLabel>
                                <FormDescription className="mt-1 text-xs text-caption">
                                  被移除或隱藏時，自動暫停播放。
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={!watermarkEnabled}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <div className="rounded-xl bg-white p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-heading">顯示預覽</p>
                              <p className="text-xs text-caption">實際會在影片上緩慢移動</p>
                            </div>
                            <div className="rounded-full bg-surface px-3 py-1 text-[11px] text-body">
                              {watermarkMovementMode === 'AGGRESSIVE' ? '加強模式' : '標準模式'}
                            </div>
                          </div>

                          <div className="relative aspect-video overflow-hidden rounded-xl bg-neutral-950">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#334155,transparent_45%),linear-gradient(135deg,#020617,#111827_55%,#1f2937)]" />
                            <div
                              className="absolute left-[12%] top-[18%] max-w-[68%] rounded-full border border-white/8 bg-black/20 px-4 py-2 text-white backdrop-blur-sm"
                              style={{
                                opacity: (watermarkOpacityPercent ?? 18) / 100,
                              }}
                            >
                              <div className={`font-medium tracking-[0.08em] uppercase text-white/90 ${previewTextSizeClass}`}>
                                {[
                                  watermarkShowEmail ? previewEmail : null,
                                  watermarkShowCourseTitle ? form.watch('title') || '課程名稱' : null,
                                  watermarkShowTimestamp ? '2026/04/10 14:32' : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ') || '請至少開啟一項顯示內容'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-section="notifications" className="bg-white border-divider rounded-xl">
              <CardHeader>
                <CardTitle className="text-heading flex items-center gap-2">
                  <Bell className="h-5 w-5 text-cta" />
                  通知設定
                </CardTitle>
                <CardDescription className="text-body">
                  設定購買相關的通知行為
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="notifyAdminOnPurchase"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-divider p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-heading">
                          購買成功 Email 通知
                        </FormLabel>
                        <FormDescription className="text-caption">
                          啟用後，每當有用戶成功購買此課程，系統會發送 Email 通知所有管理員
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Link
                  href={`/admin/courses/${course.id}/welcome-email`}
                  data-tour="welcome-email-link"
                  className="flex items-center justify-between rounded-lg border border-divider p-4 hover:bg-surface transition-colors group"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-heading">歡迎信設定</p>
                    <p className="text-sm text-caption">
                      設定購買成功後自動發送的歡迎信模板
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-body group-hover:text-heading transition-colors" />
                </Link>
              </CardContent>
            </Card>

            <div data-tour="sticky-save-bar">
              <StickySaveBar
                isDirty={form.formState.isDirty || instructorsDirty}
                isPending={isPending}
                form="submit"
              />
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
