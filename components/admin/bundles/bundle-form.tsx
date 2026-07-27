// components/admin/bundles/bundle-form.tsx
// 組合包新增/編輯表單

'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, GripVertical, Trash2 } from 'lucide-react'
import { createBundle, updateBundle, type BundleCourseOption, type BundleDetail } from '@/lib/actions/bundles'
import {
  bundleStatusOptions,
  bundleVisibilityOptions,
  type BundleFormData,
} from '@/lib/validations/bundle'
import { generateSlug } from '@/lib/validations/course'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ImageUpload } from '@/components/admin/media/image-upload'

interface BundleFormProps {
  bundle?: BundleDetail
  courses: BundleCourseOption[]
}

function toPriceValue(value: number | null | undefined): string {
  return value == null ? '' : String(value)
}

export function BundleForm({ bundle, courses }: BundleFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEdit = !!bundle

  const [title, setTitle] = useState(bundle?.title ?? '')
  const [slug, setSlug] = useState(bundle?.slug ?? '')
  const [description, setDescription] = useState(bundle?.description ?? '')
  const [coverImage, setCoverImage] = useState(bundle?.coverImage ?? '')
  const [price, setPrice] = useState(toPriceValue(bundle?.price ?? 0))
  const [salePrice, setSalePrice] = useState(toPriceValue(bundle?.salePrice))
  const [status, setStatus] = useState<BundleFormData['status']>(
    bundle?.status ?? 'DRAFT'
  )
  const [visibility, setVisibility] = useState<BundleFormData['visibility']>(
    bundle?.visibility === 'UNLISTED' ? 'UNLISTED' : 'PUBLIC'
  )
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>(
    bundle?.courses.map((item) => item.course.id) ?? []
  )

  const selectedCourses = useMemo(
    () => selectedCourseIds
      .map((id) => courses.find((course) => course.id === id))
      .filter((course): course is BundleCourseOption => !!course),
    [courses, selectedCourseIds]
  )

  function handleTitleChange(value: string) {
    setTitle(value)
    if (!isEdit && !slug) {
      setSlug(generateSlug(value))
    }
  }

  function toggleCourse(courseId: string) {
    setSelectedCourseIds((current) =>
      current.includes(courseId)
        ? current.filter((id) => id !== courseId)
        : [...current, courseId]
    )
  }

  function moveCourse(courseId: string, direction: -1 | 1) {
    setSelectedCourseIds((current) => {
      const index = current.indexOf(courseId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current
      }
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const payload: BundleFormData = {
      title,
      slug,
      description: description || null,
      coverImage: coverImage || null,
      price: Number(price || 0),
      salePrice: salePrice === '' ? null : Number(salePrice),
      status,
      visibility,
      courseIds: selectedCourseIds,
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateBundle(bundle.id, payload)
        : await createBundle(payload)

      if (!result.success) {
        toast.error(result.error || '儲存組合包失敗')
        return
      }

      toast.success(isEdit ? '組合包已更新' : '組合包已建立')
      router.push('/admin/bundles')
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>基本資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">組合包名稱 *</Label>
              <Input
                id="title"
                value={title}
                onChange={(event) => handleTitleChange(event.target.value)}
                placeholder="例：AI 自動化完整套裝"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="ai-automation-bundle"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-28"
              placeholder="說明這個組合包適合誰，以及購買後可以解鎖哪些課程。"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="coverImage">封面圖片</Label>
            {coverImage ? (
              <div className="space-y-3">
                <div className="group relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted md:max-w-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverImage}
                    alt="組合包封面預覽"
                    className="h-full w-full object-cover"
                    onError={() => toast.error('封面圖片無法載入，請確認圖片網址是否有效')}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setCoverImage('')}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      移除圖片
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  上傳新圖片會取代目前封面，也可以直接貼外部圖片 URL。
                </p>
              </div>
            ) : null}

            <ImageUpload
              onUploadComplete={(media) => {
                setCoverImage(media.url)
                toast.success('封面圖片已上傳')
              }}
              onError={(error) => toast.error(error)}
              multiple={false}
              maxSize={10}
            />

            <Input
              id="coverImage"
              value={coverImage}
              onChange={(event) => setCoverImage(event.target.value)}
              placeholder="或貼上 https://..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>販售設定</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="price">原價 *</Label>
            <Input
              id="price"
              type="number"
              min={0}
              step={1}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="salePrice">促銷價</Label>
            <Input
              id="salePrice"
              type="number"
              min={0}
              step={1}
              value={salePrice}
              onChange={(event) => setSalePrice(event.target.value)}
              placeholder="留空表示無促銷"
            />
          </div>
          <div className="space-y-2">
            <Label>狀態</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as BundleFormData['status'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bundleStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>可見性</Label>
            <Select
              value={visibility}
              onValueChange={(value) => setVisibility(value as BundleFormData['visibility'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bundleVisibilityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>內含課程</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-2">
            {courses.map((course) => (
              <label
                key={course.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
              >
                <Checkbox
                  checked={selectedCourseIds.includes(course.id)}
                  onCheckedChange={() => toggleCourse(course.id)}
                />
                <span className="flex-1">
                  <span className="block text-sm font-medium text-foreground">{course.title}</span>
                  <span className="text-xs text-muted-foreground">/{course.slug}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="rounded-lg border border-border p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              已選課程順序
            </h3>
            {selectedCourses.length === 0 ? (
              <p className="text-sm text-muted-foreground">尚未選擇課程</p>
            ) : (
              <div className="space-y-2">
                {selectedCourses.map((course, index) => (
                  <div key={course.id} className="flex items-center gap-2 rounded-md bg-muted p-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">{course.title}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={index === 0}
                      onClick={() => moveCourse(course.id, -1)}
                    >
                      上移
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={index === selectedCourses.length - 1}
                      onClick={() => moveCourse(course.id, 1)}
                    >
                      下移
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push('/admin/bundles')}>
          取消
        </Button>
        <Button type="submit" disabled={isPending}>
          <Check className="mr-2 h-4 w-4" />
          {isPending ? '儲存中...' : '儲存組合包'}
        </Button>
      </div>
    </form>
  )
}
