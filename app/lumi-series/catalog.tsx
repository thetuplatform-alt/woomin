'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import {
  formatLumiPricing,
  lumiCategories,
  lumiCategoryIds,
  lumiProducts,
  type LumiCategoryId,
  type LumiProduct,
} from './data'
import { ProductArtwork } from './product-artwork'
import styles from './lumi-series.module.css'

const categoryLabels: Record<LumiCategoryId, string> = {
  all: '全部',
  life: 'Lumi Life',
  kids: 'Lumi Kids',
  creator: 'Lumi Creator',
  business: 'Lumi Business',
  skills: 'Lumi Skills',
}

export function ProductCard({ product, compact = false }: { product: LumiProduct; compact?: boolean }) {
  return (
    <article className={`${styles.productCard} ${compact ? styles.productCardCompact : ''}`}>
      <Link className={styles.artworkLink} href={`/lumi-series/${product.slug}`} tabIndex={-1} aria-hidden="true">
        <ProductArtwork name={product.name} thumbnail={product.thumbnail} />
      </Link>
      <div className={styles.productBody}>
        <div className={styles.productMeta}>
          <span>{product.type}</span>
          <span>{lumiCategories[product.category].name}</span>
        </div>
        <h3><Link href={`/lumi-series/${product.slug}`}>{product.name}</Link></h3>
        {product.eyebrow && <span className={styles.productEyebrow}>{product.eyebrow}</span>}
        <p>{product.shortDescription}</p>
        <div className={styles.productTags} aria-label="產品標籤">
          {product.tags.slice(0, compact ? 3 : 4).map((tag) => <span key={tag}>{tag}</span>)}
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

export function LumiCatalog() {
  const [activeCategory, setActiveCategory] = useState<LumiCategoryId>('all')
  const products = useMemo(() => {
    if (activeCategory === 'all') return lumiProducts
    if (activeCategory === 'skills') return lumiProducts.filter((product) => product.type === 'AI Skill')
    return lumiProducts.filter((product) => product.category === activeCategory)
  }, [activeCategory])

  return (
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
        <div className={styles.filterBar} role="toolbar" aria-label="產品分類篩選">
          {lumiCategoryIds.map((category) => (
            <button
              aria-pressed={activeCategory === category}
              className={activeCategory === category ? styles.filterActive : undefined}
              key={category}
              onClick={() => setActiveCategory(category)}
              type="button"
            >
              {categoryLabels[category]}
            </button>
          ))}
        </div>
        <div className={styles.productGrid} aria-live="polite">
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </div>
    </section>
  )
}
