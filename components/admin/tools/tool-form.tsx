'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  createTool,
  updateTool,
  type AdminToolDetail,
  type ToolFormOptions,
} from '@/lib/actions/admin-tools'
import {
  lumiToolCategoryOptions,
  toolLifecycleOptions,
  toolPricingTypeOptions,
  toolRuntimeTypeOptions,
  toolTypeOptions,
  type ToolFormData,
} from '@/lib/validations/tool'
import { ImageUpload } from '@/components/admin/media/image-upload'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

function optionalNumber(value: string) {
  return value.trim() === '' ? null : Number(value)
}

function StringListEditor({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><Label>{label}</Label><Button type="button" size="sm" variant="outline" onClick={() => onChange([...values, ''])}><Plus className="mr-1 h-3.5 w-3.5" />新增</Button></div>
      {values.length === 0 ? <p className="text-xs text-muted-foreground">尚未設定</p> : values.map((value, index) => (
        <div className="flex gap-2" key={`${label}-${index}`}>
          <Input value={value} onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />
          <Button aria-label={`移除${label}`} type="button" size="icon" variant="ghost" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
    </div>
  )
}

function FeatureEditor({ values, onChange }: { values: Array<{ title: string; description: string }>; onChange: (values: Array<{ title: string; description: string }>) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><Label>Features</Label><Button type="button" size="sm" variant="outline" onClick={() => onChange([...values, { title: '', description: '' }])}><Plus className="mr-1 h-3.5 w-3.5" />新增</Button></div>
      {values.length === 0 ? <p className="text-xs text-muted-foreground">尚未設定</p> : values.map((feature, index) => (
        <div className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_2fr_auto]" key={`feature-${index}`}>
          <Input placeholder="功能標題" value={feature.title} onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} />
          <Input placeholder="功能說明" value={feature.description} onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} />
          <Button aria-label="移除 feature" type="button" size="icon" variant="ghost" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
    </div>
  )
}

function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const isImageUrl = /^https:\/\//.test(value) || /^\/(?!\/)/.test(value)
  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      {isImageUrl && (
        <div className="relative aspect-video max-w-md overflow-hidden rounded-lg border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={`${label} 預覽`} className="h-full w-full object-cover" src={value} />
        </div>
      )}
      {value && !isImageUrl && <p className="rounded-md bg-muted px-3 py-2 text-sm">既有 artwork token：{value}</p>}
      <ImageUpload multiple={false} maxSize={10} onUploadComplete={(media) => onChange(media.url)} onError={(error) => toast.error(error)} />
      <div className="flex gap-2"><Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="artwork token、/uploads/... 或 https://..." /><Button type="button" variant="outline" onClick={() => onChange('')}>清除</Button></div>
    </div>
  )
}

export function ToolForm({ tool, options }: { tool?: AdminToolDetail; options: ToolFormOptions }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const initialSeriesId = tool?.series.id ?? options.series[0]?.id ?? ''
  const initialEntitlementId = tool?.requiredEntitlementId
    ?? options.entitlements.find((item) => item.seriesId === initialSeriesId && item.kind === 'SERIES')?.id
    ?? 'none'
  const [seriesId, setSeriesId] = useState(initialSeriesId)
  const [name, setName] = useState(tool?.name ?? '')
  const [slug, setSlug] = useState(tool?.slug ?? '')
  const [category, setCategory] = useState(tool?.category ?? 'life')
  const [subCategory, setSubCategory] = useState(tool?.subCategory ?? '')
  const [eyebrow, setEyebrow] = useState(tool?.eyebrow ?? '')
  const [type, setType] = useState<ToolFormData['type']>(tool?.type ?? 'WEB_APP')
  const [shortDescription, setShortDescription] = useState(tool?.shortDescription ?? '')
  const [longDescription, setLongDescription] = useState(tool?.longDescription ?? '')
  const [thumbnail, setThumbnail] = useState(tool?.thumbnail ?? '')
  const [heroImage, setHeroImage] = useState(tool?.heroImage ?? '')
  const [runtimeType, setRuntimeType] = useState<ToolFormData['runtimeType']>(tool?.runtimeType ?? 'EXTERNAL_WEB_APP')
  const [launchUrl, setLaunchUrl] = useState(tool?.launchUrl ?? '')
  const [detailUrl, setDetailUrl] = useState(tool?.detailUrl ?? '')
  const [lifecycle, setLifecycle] = useState<ToolFormData['lifecycle']>(tool?.lifecycle ?? 'DRAFT')
  const [isFeatured, setIsFeatured] = useState(tool?.isFeatured ?? false)
  const [featuredOrder, setFeaturedOrder] = useState(tool?.featuredOrder == null ? '' : String(tool.featuredOrder))
  const [displayOrder, setDisplayOrder] = useState(String(tool?.displayOrder ?? options.nextDisplayOrderBySeries[initialSeriesId] ?? 10))
  const [requiresLogin, setRequiresLogin] = useState(tool?.requiresLogin ?? true)
  const [requiredEntitlementId, setRequiredEntitlementId] = useState(initialEntitlementId)
  const [pricingType, setPricingType] = useState<ToolFormData['pricingType']>(tool?.pricingType ?? 'INCLUDED')
  const [price, setPrice] = useState(tool?.price == null ? '' : String(tool.price))
  const [ctaLabel, setCtaLabel] = useState(tool?.ctaLabel ?? '')
  const [tags, setTags] = useState(tool?.tags ?? [])
  const [audience, setAudience] = useState(tool?.audience ?? [])
  const [benefits, setBenefits] = useState(tool?.benefits ?? [])
  const [features, setFeatures] = useState(tool?.features ?? [])
  const [usageSteps, setUsageSteps] = useState(tool?.usageSteps ?? [])

  const selectedSeries = options.series.find((series) => series.id === seriesId)
  const entitlementOptions = useMemo(
    () => options.entitlements.filter((item) => !item.seriesId || item.seriesId === seriesId),
    [options.entitlements, seriesId]
  )

  function handleSeriesChange(nextSeriesId: string) {
    setSeriesId(nextSeriesId)
    if (!tool) setDisplayOrder(String(options.nextDisplayOrderBySeries[nextSeriesId] ?? 10))
    const matchingSeriesEntitlement = options.entitlements.find((item) => item.seriesId === nextSeriesId && item.kind === 'SERIES')
    setRequiredEntitlementId(matchingSeriesEntitlement?.id ?? 'none')
    const nextSeries = options.series.find((item) => item.id === nextSeriesId)
    if (nextSeries?.code === 'LUMI_SERIES' && !lumiToolCategoryOptions.some((item) => item.value === category)) setCategory('life')
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload: ToolFormData = {
      seriesId, name, slug, category, subCategory, eyebrow, type,
      shortDescription, longDescription, thumbnail, heroImage,
      launchUrl, detailUrl, runtimeType, lifecycle, isFeatured,
      featuredOrder: optionalNumber(featuredOrder),
      displayOrder: Number(displayOrder || 0),
      requiresLogin,
      requiredEntitlementId: requiredEntitlementId === 'none' ? null : requiredEntitlementId,
      pricingType,
      price: optionalNumber(price),
      ctaLabel, tags, audience, benefits, features, usageSteps,
    }

    startTransition(async () => {
      const result = tool ? await updateTool(tool.id, payload) : await createTool(payload)
      if (!result.success) {
        toast.error(result.error || '儲存 Tool 失敗')
        return
      }
      toast.success(tool ? 'Tool 已更新' : 'Tool 已建立')
      router.push('/admin/tools')
      router.refresh()
    })
  }

  if (options.series.length === 0) return <div className="rounded-lg border p-6">目前沒有可用的 Active Series，無法新增 Tool。</div>

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <Card><CardHeader><CardTitle>基本資料</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>系列 *</Label><Select value={seriesId} onValueChange={handleSeriesChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.series.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} ({item.code})</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="category">Category *</Label>{selectedSeries?.code === 'LUMI_SERIES' ? <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{lumiToolCategoryOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select> : <Input id="category" value={category} onChange={(event) => setCategory(event.target.value)} required />}</div>
          <div className="space-y-2"><Label htmlFor="name">名稱 *</Label><Input id="name" value={name} onChange={(event) => setName(event.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="slug">Slug *</Label><Input id="slug" value={slug} onChange={(event) => setSlug(event.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="subCategory">子分類</Label><Input id="subCategory" value={subCategory} onChange={(event) => setSubCategory(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="eyebrow">Eyebrow</Label><Input id="eyebrow" value={eyebrow} onChange={(event) => setEyebrow(event.target.value)} /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="shortDescription">短描述</Label><Textarea id="shortDescription" value={shortDescription} onChange={(event) => setShortDescription(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="longDescription">完整描述</Label><Textarea className="min-h-32" id="longDescription" value={longDescription} onChange={(event) => setLongDescription(event.target.value)} /></div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>圖片</CardTitle></CardHeader><CardContent className="grid gap-6 lg:grid-cols-2"><ImageField label="Thumbnail" value={thumbnail} onChange={setThumbnail} /><ImageField label="Hero Image" value={heroImage} onChange={setHeroImage} /></CardContent></Card>

      <Card><CardHeader><CardTitle>類型與 Launch</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>Tool Type</Label><Select value={type} onValueChange={(value) => setType(value as ToolFormData['type'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{toolTypeOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Runtime Type</Label><Select value={runtimeType} onValueChange={(value) => setRuntimeType(value as ToolFormData['runtimeType'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{toolRuntimeTypeOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="launchUrl">Launch URL</Label><Input disabled={runtimeType !== 'EXTERNAL_WEB_APP'} id="launchUrl" value={launchUrl} onChange={(event) => setLaunchUrl(event.target.value)} placeholder="https://..." /></div>
        <div className="space-y-2"><Label htmlFor="detailUrl">Detail URL</Label><Input id="detailUrl" value={detailUrl} onChange={(event) => setDetailUrl(event.target.value)} placeholder="/lumi-series/tool-slug" /></div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>發布、權限與排序</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>發布狀態</Label><Select value={lifecycle} onValueChange={(value) => setLifecycle(value as ToolFormData['lifecycle'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{toolLifecycleOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Required Entitlement</Label><Select value={requiredEntitlementId} onValueChange={setRequiredEntitlementId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">無</SelectItem>{entitlementOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.code} — {item.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex items-center gap-2"><Checkbox checked={requiresLogin} id="requiresLogin" onCheckedChange={(value) => setRequiresLogin(value === true)} /><Label htmlFor="requiresLogin">需要登入</Label></div>
        <div className="flex items-center gap-2"><Checkbox checked={isFeatured} id="isFeatured" onCheckedChange={(value) => setIsFeatured(value === true)} /><Label htmlFor="isFeatured">Featured</Label></div>
        <div className="space-y-2"><Label htmlFor="displayOrder">工具排序</Label><Input id="displayOrder" min={0} type="number" value={displayOrder} onChange={(event) => setDisplayOrder(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="featuredOrder">Featured 排序</Label><Input disabled={!isFeatured} id="featuredOrder" min={0} type="number" value={featuredOrder} onChange={(event) => setFeaturedOrder(event.target.value)} /></div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>價格</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>Pricing Type</Label><Select value={pricingType} onValueChange={(value) => { const next = value as ToolFormData['pricingType']; setPricingType(next); if (next !== 'PAID') setPrice('') }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{toolPricingTypeOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="price">Price</Label><Input disabled={pricingType !== 'PAID'} id="price" min="0" step="0.01" type="number" value={price} onChange={(event) => setPrice(event.target.value)} /></div>
        <div className="space-y-2 md:col-span-2"><Label htmlFor="ctaLabel">CTA 文字</Label><Input id="ctaLabel" value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} /></div>
        <p className="text-xs text-muted-foreground md:col-span-2">本批只管理 pricingType／price 資料，不變更 Lumi Series 前台價格呈現。</p>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>結構化內容</CardTitle></CardHeader><CardContent className="grid gap-6 lg:grid-cols-2"><StringListEditor label="Tags" values={tags} onChange={setTags} /><StringListEditor label="Audience" values={audience} onChange={setAudience} /><StringListEditor label="Benefits" values={benefits} onChange={setBenefits} /><StringListEditor label="Usage Steps" values={usageSteps} onChange={setUsageSteps} /><div className="lg:col-span-2"><FeatureEditor values={features} onChange={setFeatures} /></div></CardContent></Card>

      <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => router.push('/admin/tools')}>取消</Button><Button disabled={isPending} type="submit">{isPending ? '儲存中…' : tool ? '儲存變更' : '建立 Tool'}</Button></div>
    </form>
  )
}
