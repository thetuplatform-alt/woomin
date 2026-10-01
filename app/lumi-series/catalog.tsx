'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import {
  formatLumiPricing,
  lumiCategories,
  type LumiCategoryId,
  type LumiProduct,
} from './data'
import { ProductArtwork } from './product-artwork'
import { ProductTypeBadge } from './product-presentation'
import { groupLumiCatalogProducts, lumiKidsGroup } from './catalog-grouping'
import styles from './lumi-series.module.css'

const experienceCategories = ['life', 'kids', 'creator', 'business'] as const

export function ProductCard({
  product,
  compact = false,
  warm = false,
}: {
  product: LumiProduct
  compact?: boolean
  warm?: boolean
}) {
  const purposeTags = product.tags
    .filter((tag) => tag !== product.type && tag !== lumiCategories[product.category].name)
    .slice(0, 2)

  return (
    <article
      className={`${styles.productCard} ${compact ? styles.productCardCompact : ''} ${warm ? styles.productCardWarm : ''}`}
    >
      <Link className={styles.artworkLink} href={`/lumi-series/${product.slug}`} tabIndex={-1} aria-hidden="true">
        <ProductArtwork name={product.name} thumbnail={product.thumbnail} />
      </Link>
      <div className={styles.productBody}>
        <div className={styles.productMeta}>
          <ProductTypeBadge type={product.type} />
          <span className={styles.seriesLabel}>{lumiCategories[product.category].name}</span>
        </div>
        <h3><Link href={`/lumi-series/${product.slug}`}>{product.name}</Link></h3>
        {product.eyebrow && <span className={styles.productEyebrow}>{product.eyebrow}</span>}
        <p>{product.shortDescription}</p>
        <div className={styles.productTags} aria-label="產品標籤">
          {purposeTags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        <div className={styles.productFooter}>
          <span className={styles.price}>{formatLumiPricing(product)}</span>
          <Link className={styles.cardCta} href={`/lumi-series/${product.slug}`}>
            {product.ctaLabel}<ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  )
}

export function LumiCatalog({ products: allProducts }: { products: LumiProduct[] }) {
  const [activeCategory, setActiveCategory] = useState<LumiCategoryId>('all')
  const products = useMemo(() => {
    if (activeCategory === 'all') return allProducts
    if (activeCategory === 'skills') return allProducts.filter((product) => product.type === 'AI Skill')
    return allProducts.filter((product) => product.category === activeCategory)
  }, [activeCategory, allProducts])
  const { kidsProducts, otherProducts } = useMemo(
    () => groupLumiCatalogProducts(products),
    [products]
  )

  return (
    <>
      <section className={styles.seriesGuide} aria-labelledby="series-guide-title">
        <div className={`${styles.shell} ${styles.seriesGuideInner}`}>
          <div className={styles.seriesGuideHeading}>
            <span className={styles.eyebrow}>CHOOSE YOUR LUMI</span>
            <h2 id="series-guide-title">依使用情境找到適合的 Lumi</h2>
          </div>
          <div className={styles.seriesGuideOptions}>
            {experienceCategories.map((category) => (
              <button
                aria-pressed={activeCategory === category}
                className={activeCategory === category ? styles.seriesGuideActive : undefined}
                key={category}
                onClick={() => setActiveCategory(category)}
                type="button"
              >
                <span>{lumiCategories[category].label}</span>
                <strong>{lumiCategories[category].name}</strong>
              </button>
            ))}
          </div>
          <div className={styles.seriesGuideFormats} aria-label="工具形式">
            <span>工具形式</span>
            <button
              aria-pressed={activeCategory === 'skills'}
              className={activeCategory === 'skills' ? styles.seriesGuideActive : undefined}
              onClick={() => setActiveCategory('skills')}
              type="button"
            >
              AI Skills
            </button>
            <button
              aria-pressed={activeCategory === 'all'}
              className={activeCategory === 'all' ? styles.seriesGuideActive : undefined}
              onClick={() => setActiveCategory('all')}
              type="button"
            >
              查看全部
            </button>
          </div>
        </div>
      </section>

      <section className={styles.catalogSection} id="explore">
        <div className={styles.shell}>
        <div className={styles.sectionHeadingRow}>
          <div className={styles.sectionHeading}>
            <span className={styles.eyebrow}>EXPLORE LUMI</span>
            <h2>找到今天剛好需要的工具</h2>
            <p>從生活、幼教到創作與營運，選一個分類，再從眼前的事情開始。</p>
          </div>
          <span className={styles.resultCount}><Sparkles size={15} /> {products.length} 個工具</span>
        </div>
        <div className={styles.catalogGroups} aria-live="polite">
          {kidsProducts.length > 0 && (
            <section className={styles.kidsGroup} aria-labelledby="lumi-kids-title">
              <div className={styles.kidsGroupHeading}>
                <div>
                  <span className={styles.kidsGroupBadge}>{lumiKidsGroup.label}</span>
                  <h3 id="lumi-kids-title">{lumiKidsGroup.name}</h3>
                  <p>{lumiKidsGroup.description}</p>
                </div>
                <span className={styles.kidsGroupCount}>{kidsProducts.length} 個工具</span>
              </div>
              <div className={`${styles.productGrid} ${styles.kidsProductGrid}`}>
                {kidsProducts.map((product) => (
                  <ProductCard key={product.id} product={product} warm />
                ))}
              </div>
            </section>
          )}
          {otherProducts.length > 0 && (
            <div className={styles.productGrid}>
              {otherProducts.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          )}
        </div>
        </div>
      </section>
    </>
  )
}
