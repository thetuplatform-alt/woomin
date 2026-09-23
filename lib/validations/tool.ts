import { z } from 'zod'

export const toolLifecycleEnum = z.enum(['DRAFT', 'PUBLISHED', 'DISABLED', 'ARCHIVED'])
export const toolTypeEnum = z.enum(['WEB_APP', 'SKILL', 'AI_TOOL', 'SAAS'])
export const toolRuntimeTypeEnum = z.enum([
  'EXTERNAL_WEB_APP',
  'SKILL_RUNTIME',
  'BESTAPPSTORE_NATIVE',
])
export const toolPricingTypeEnum = z.enum(['FREE', 'PAID', 'INCLUDED', 'COMING_SOON'])

export const toolLifecycleOptions = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'PUBLISHED', label: '已發布' },
  { value: 'DISABLED', label: '已停用' },
  { value: 'ARCHIVED', label: '已封存' },
] as const

export const toolTypeOptions = [
  { value: 'WEB_APP', label: 'Web App' },
  { value: 'SKILL', label: 'Skill' },
  { value: 'AI_TOOL', label: 'AI Tool' },
  { value: 'SAAS', label: 'SaaS' },
] as const

export const toolRuntimeTypeOptions = [
  { value: 'EXTERNAL_WEB_APP', label: 'External Web App' },
  { value: 'SKILL_RUNTIME', label: 'Skill Runtime' },
  { value: 'BESTAPPSTORE_NATIVE', label: 'BestAppStore Native' },
] as const

export const toolPricingTypeOptions = [
  { value: 'FREE', label: '免費' },
  { value: 'PAID', label: '付費' },
  { value: 'INCLUDED', label: '會員方案內含' },
  { value: 'COMING_SOON', label: '即將推出' },
] as const

export const lumiToolCategoryOptions = [
  { value: 'life', label: 'Lumi Life' },
  { value: 'kids', label: 'Lumi Kids' },
  { value: 'creator', label: 'Lumi Creator' },
  { value: 'business', label: 'Lumi Business' },
] as const

const optionalText = (max: number, message: string) =>
  z.string().max(max, { message }).optional().nullable()

const optionalAsset = z
  .string()
  .max(2048, { message: '圖片值不可超過 2048 個字元' })
  .refine(
    (value) =>
      value === '' ||
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ||
      (/^\/(?!\/)/.test(value) && !value.includes('..')) ||
      (() => {
        try {
          const url = new URL(value)
          return url.protocol === 'https:' && !url.username && !url.password
        } catch {
          return false
        }
      })(),
    { message: '請使用既有 artwork token、安全站內路徑或 HTTPS 圖片 URL' }
  )
  .optional()
  .nullable()

const featureSchema = z.object({
  title: z.string().trim().min(1, '功能標題不可空白').max(120, '功能標題不可超過 120 個字元'),
  description: z
    .string()
    .trim()
    .min(1, '功能說明不可空白')
    .max(1000, '功能說明不可超過 1000 個字元'),
})

const stringList = z.array(z.string().trim().min(1).max(500)).max(50)

export const toolSchema = z
  .object({
    seriesId: z.string().min(1, '請選擇系列'),
    name: z.string().trim().min(2, '工具名稱至少需要 2 個字元').max(120),
    slug: z
      .string()
      .trim()
      .min(2, 'Slug 至少需要 2 個字元')
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug 只能包含小寫英文字母、數字與連字號'),
    category: z
      .string()
      .trim()
      .min(1, '請填寫分類')
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, '分類請使用小寫英文字母、數字與連字號'),
    subCategory: optionalText(120, '子分類不可超過 120 個字元'),
    eyebrow: optionalText(160, 'Eyebrow 不可超過 160 個字元'),
    type: toolTypeEnum,
    shortDescription: optionalText(1000, '短描述不可超過 1000 個字元'),
    longDescription: optionalText(10000, '完整描述不可超過 10000 個字元'),
    thumbnail: optionalAsset,
    heroImage: optionalAsset,
    launchUrl: optionalText(2048, 'Launch URL 不可超過 2048 個字元'),
    detailUrl: optionalText(500, 'Detail URL 不可超過 500 個字元'),
    runtimeType: toolRuntimeTypeEnum,
    lifecycle: toolLifecycleEnum.default('DRAFT'),
    isFeatured: z.boolean().default(false),
    featuredOrder: z.number().int().min(0).max(999999).optional().nullable(),
    displayOrder: z.number().int().min(0).max(999999).default(0),
    requiresLogin: z.boolean().default(true),
    requiredEntitlementId: z.string().optional().nullable(),
    pricingType: toolPricingTypeEnum.default('INCLUDED'),
    price: z.number().min(0).max(9999999999.99).optional().nullable(),
    ctaLabel: optionalText(80, 'CTA 文字不可超過 80 個字元'),
    tags: stringList,
    audience: stringList,
    benefits: stringList,
    features: z.array(featureSchema).max(30),
    usageSteps: stringList,
  })
  .superRefine((data, context) => {
    if (data.runtimeType === 'EXTERNAL_WEB_APP') {
      try {
        const url = new URL(data.launchUrl || '')
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error('unsafe')
      } catch {
        context.addIssue({
          code: 'custom',
          path: ['launchUrl'],
          message: 'External Web App 必須設定不含帳密的 HTTPS Launch URL',
        })
      }
    }

    const detailUrl = data.detailUrl || ''
    if (detailUrl && (!/^\/(?!\/)/.test(detailUrl) || detailUrl.includes('..'))) {
      context.addIssue({
        code: 'custom',
        path: ['detailUrl'],
        message: 'Detail URL 必須是安全的站內路徑',
      })
    }

    if (data.runtimeType === 'BESTAPPSTORE_NATIVE' && !detailUrl) {
        context.addIssue({
          code: 'custom',
          path: ['detailUrl'],
          message: 'Native 工具必須設定安全的站內 Detail URL',
        })
    }

    if (data.requiredEntitlementId && !data.requiresLogin) {
      context.addIssue({
        code: 'custom',
        path: ['requiresLogin'],
        message: '需要 entitlement 的工具必須要求登入',
      })
    }

    if (data.pricingType === 'PAID') {
      if (data.price == null || data.price <= 0) {
        context.addIssue({ code: 'custom', path: ['price'], message: '付費工具必須設定大於 0 的價格' })
      }
    } else if (data.price != null) {
      context.addIssue({
        code: 'custom',
        path: ['price'],
        message: '只有付費工具可以設定價格',
      })
    }

    if (data.isFeatured && data.featuredOrder == null) {
      context.addIssue({
        code: 'custom',
        path: ['featuredOrder'],
        message: 'Featured 工具必須設定 Featured 排序',
      })
    }
  })

export type ToolFormData = z.infer<typeof toolSchema>
export type ToolLifecycle = z.infer<typeof toolLifecycleEnum>
