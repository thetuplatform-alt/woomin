import Link from 'next/link'
import { ArrowRight, Bot, LogIn, MousePointerClick, Sparkles, WandSparkles } from 'lucide-react'
import type { LumiProduct } from './data'
import type { LumiUsageExample } from './examples'
import styles from './lumi-series.module.css'

export function getLumiCtaLabel(product: LumiProduct) {
  if (product.ctaUrl !== '/login') return product.ctaLabel
  return product.type === 'AI Skill' ? '登入後開始試用' : `登入後${product.ctaLabel}`
}

export function ProductTypeBadge({ type }: { type: LumiProduct['type'] }) {
  const isAi = type === 'AI Skill' || type === 'AI Tool'
  const Icon = isAi ? WandSparkles : MousePointerClick
  const label = type.replace(' ', '\u00a0')
  return <span className={`${styles.typeBadge} ${isAi ? styles.typeBadgeSkill : ''}`}><Icon size={13} />{label}</span>
}

export function ProductTypeInfo({ product }: { product: LumiProduct }) {
  const isSkill = product.type === 'AI Skill' || product.type === 'AI Tool'
  const items = isSkill
    ? [
        { Icon: Bot, label: '產品形式', value: 'AI Skill 引導式協作' },
        { Icon: LogIn, label: '取得方式', value: '登入後開始試用' },
        { Icon: Sparkles, label: '可協助產出', value: product.benefits[0] },
      ]
    : [
        { Icon: MousePointerClick, label: '操作方式', value: '登入後直接使用' },
        { Icon: LogIn, label: '你會做的事', value: '輸入實際條件' },
        { Icon: Sparkles, label: '你會得到', value: '即時整理的結果' },
      ]

  return (
    <div className={`${styles.typeInfo} ${isSkill ? styles.typeInfoSkill : ''}`} aria-label={`${product.type} 使用說明`}>
      {items.map(({ Icon, label, value }) => (
        <span className={styles.typeInfoItem} key={label}>
          <Icon aria-hidden="true" size={15} />
          <span><small>{label}</small><strong>{value}</strong></span>
        </span>
      ))}
    </div>
  )
}

export function ProductCta({ product, surface = 'hero' }: { product: LumiProduct; surface?: 'hero' | 'footer' }) {
  return (
    <Link className={styles.primaryButton} data-surface={surface} href={product.ctaUrl}>
      {getLumiCtaLabel(product)}<ArrowRight aria-hidden="true" size={17} />
    </Link>
  )
}

export function UsageExample({ example }: { example: LumiUsageExample }) {
  return (
    <div className={styles.detailExampleFlow} data-variant={example.variant ?? 'text'}>
      <article className={styles.exampleInput}>
        <span>輸入情境</span>
        <strong>{example.input}</strong>
      </article>
      <ArrowRight className={styles.exampleArrow} aria-hidden="true" size={20} />
      <article className={styles.exampleResult}>
        <span>成果預覽</span>
        <strong>{example.result}</strong>
        {example.items && (
          <div className={styles.exampleItems}>
            {example.items.map((item) => (
              <div className={styles.exampleItem} key={`${item.label ?? ''}-${item.title}`}>
                {item.label && <small>{item.label}</small>}
                <b>{item.title}</b>
                {item.description && <p>{item.description}</p>}
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  )
}
