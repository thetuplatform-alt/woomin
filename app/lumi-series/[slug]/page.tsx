import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react'
import { ProductCard } from '../catalog'
import { formatLumiPricing, getLumiProduct, lumiCategories, lumiProducts } from '../data'
import { ProductArtwork } from '../product-artwork'
import styles from '../lumi-series.module.css'

type ProductPageProps = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return lumiProducts.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = getLumiProduct((await params).slug)
  if (!product) return {}
  return { title: { absolute: `${product.name}｜Lumi Series` }, description: product.shortDescription }
}

export default async function LumiProductPage({ params }: ProductPageProps) {
  const product = getLumiProduct((await params).slug)
  if (!product) notFound()
  const category = lumiCategories[product.category]
  const related = lumiProducts
    .filter((item) => item.id !== product.id && (item.category === product.category || item.type === product.type))
    .slice(0, 3)

  return (
    <div className={`${styles.page} ${styles.detailPage}`}>
      <header className={styles.detailHeader}>
        <div className={`${styles.shell} ${styles.detailNavbar}`}>
          <Link href="/lumi-series"><ArrowLeft size={17} />回到 Lumi Series</Link>
          <Link href="/">BestAppStore</Link>
        </div>
      </header>
      <main>
        <section className={styles.detailHero}>
          <div className={`${styles.shell} ${styles.detailHeroGrid}`}>
            <div className={styles.detailCopy}>
              <span className={styles.detailBadge}><Sparkles size={14} /> {product.type} · {category.name}</span>
              <h1>{product.name}</h1>
              {product.eyebrow && <h2>{product.eyebrow}</h2>}
              <p>{product.longDescription}</p>
              <div className={styles.detailPrice}>{formatLumiPricing(product)}</div>
              <Link className={styles.primaryButton} href={product.ctaUrl}>{product.ctaLabel}<ArrowRight size={17} /></Link>
            </div>
            <ProductArtwork name={product.name} thumbnail={product.thumbnail} />
          </div>
        </section>

        <section className={styles.detailOverview}>
          <div className={`${styles.shell} ${styles.detailColumns}`}>
            <div>
              <span className={styles.eyebrow}>WHO IT IS FOR</span>
              <h2>適合誰</h2>
              <ul>{product.audience.map((item) => <li key={item}><Check size={16} />{item}</li>)}</ul>
            </div>
            <div>
              <span className={styles.eyebrow}>WHAT IT HELPS</span>
              <h2>可以幫你做什麼</h2>
              <ul>{product.benefits.map((item) => <li key={item}><Check size={16} />{item}</li>)}</ul>
            </div>
          </div>
        </section>

        <section className={styles.detailFeatures}>
          <div className={styles.shell}>
            <div className={styles.sectionHeading}>
              <span className={styles.eyebrow}>FEATURES</span>
              <h2>三個主要特色</h2>
            </div>
            <div className={styles.featureGrid}>
              {product.features.map((feature, index) => (
                <article key={feature.title}><span>0{index + 1}</span><h3>{feature.title}</h3><p>{feature.description}</p></article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.detailUsage}>
          <div className={`${styles.shell} ${styles.detailUsageGrid}`}>
            <div><span className={styles.eyebrow}>HOW TO USE</span><h2>使用方式</h2><p>從你的真實情況開始，跟著三個步驟完成。</p></div>
            <ol>{product.usageSteps.map((step, index) => <li key={step}><span>0{index + 1}</span><p>{step}</p></li>)}</ol>
          </div>
        </section>

        <section className={styles.relatedSection}>
          <div className={styles.shell}>
            <div className={styles.sectionHeading}><span className={styles.eyebrow}>KEEP EXPLORING</span><h2>也許你也會喜歡</h2></div>
            <div className={styles.featuredGrid}>{related.map((item) => <ProductCard compact key={item.id} product={item} />)}</div>
          </div>
        </section>
      </main>
    </div>
  )
}
