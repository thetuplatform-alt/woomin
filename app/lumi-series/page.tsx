import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  HeartHandshake,
  Menu,
  RefreshCw,
  Shapes,
  Sparkles,
} from 'lucide-react'
import { LumiCatalog, ProductCard } from './catalog'
import { lumiCategories, lumiProducts } from './data'
import styles from './lumi-series.module.css'

export const metadata: Metadata = {
  title: { absolute: 'Lumi Series｜陪你工作、創作，也陪你過生活' },
  description: 'Lumi 把生活、幼教、創作與營運中常做、常卡住的事情，整理成可以直接使用的 Web Apps 與 AI Skills。',
}

const categoryOrder = ['life', 'kids', 'creator', 'business'] as const

const whyLumi = [
  { Icon: Shapes, title: '多元應用', description: '生活、幼教、創作、商業一次滿足。' },
  { Icon: Sparkles, title: '簡單上手', description: '從現在的需求開始，不用先學 Prompt。' },
  { Icon: RefreshCw, title: '持續更新', description: '未來會持續加入更多實用 Apps 與 Skills。' },
  { Icon: HeartHandshake, title: '陪伴感', description: '不是冷冰冰的工具，而是陪你把事情做完的助手。' },
] as const

function BestAppStoreBrand() {
  return (
    <span className={styles.brandLockup} aria-label="BestAppStore｜Lumi Series">
      <span className={styles.brandFallback} aria-hidden="true">B</span>
      <strong>BestAppStore</strong>
      <i aria-hidden="true" />
      <span>Lumi Series</span>
    </span>
  )
}

function Header() {
  return (
    <header className={styles.header}>
      <div className={`${styles.shell} ${styles.navbar}`}>
        <Link href="/lumi-series"><BestAppStoreBrand /></Link>
        <nav className={styles.desktopNav} aria-label="Lumi Series 主要導覽">
          <a href="#featured">精選推薦</a>
          <a href="#explore">探索 Lumi</a>
          <a href="#how">如何使用</a>
          <Link href="/login">會員登入</Link>
        </nav>
        <details className={styles.mobileNav}>
          <summary aria-label="開啟導覽選單"><Menu size={20} /><span>選單</span></summary>
          <nav aria-label="Lumi Series 行動版導覽">
            <a href="#featured">精選推薦</a>
            <a href="#explore">探索 Lumi</a>
            <a href="#how">如何使用</a>
            <Link href="/login">會員登入</Link>
          </nav>
        </details>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.shell} ${styles.footerGrid}`}>
        <div>
          <BestAppStoreBrand />
          <p>陪你工作、創作，也陪你過生活。</p>
        </div>
        <nav aria-label="頁尾導覽">
          <Link href="/">BestAppStore 首頁</Link>
          <a href="#explore">所有工具</a>
          <Link href="/terms">服務條款</Link>
          <Link href="/privacy">隱私政策</Link>
        </nav>
      </div>
      <div className={`${styles.shell} ${styles.copyright}`}>© {new Date().getFullYear()} BestAppStore. Lumi Series.</div>
    </footer>
  )
}

export default function LumiSeriesPage() {
  const featuredProducts = lumiProducts.filter((product) => product.featured)

  return (
    <div className={styles.page} id="top">
      <Header />
      <main>
        <section className={styles.hero}>
          <div className={styles.heroPhoto}>
            <Image
              alt="溫暖明亮的居家創作空間中，一位女孩與兩隻狗陪伴彼此工作與生活"
              fill
              priority
              sizes="100vw"
              src="/lumi/lumi-hero-lifestyle.png"
            />
          </div>
          <div className={`${styles.shell} ${styles.heroInner}`}>
            <div className={styles.heroCopy}>
              <span className={styles.heroKicker}><Sparkles size={15} /> A GENTLER WAY TO GET THINGS DONE</span>
              <h1>Lumi Series</h1>
              <h2>陪你工作、創作，<br />也陪你過生活。</h2>
              <p>從生活選擇、幼教工作，到內容創作與團購營運，Lumi 把常做、常卡住的事情，整理成可以直接使用的 Web Apps 與 AI Skills。</p>
              <div className={styles.heroActions}>
                <a className={styles.primaryButton} href="#explore">探索 Lumi<ArrowDown size={17} /></a>
                <a className={styles.secondaryButton} href="#featured">看看精選推薦<ArrowRight size={17} /></a>
              </div>
            </div>
            <div className={styles.heroLabels} aria-label="Lumi 應用範圍">
              <span className={styles.labelOne}>工作效率</span>
              <span className={styles.labelTwo}>創作靈感</span>
              <span className={styles.labelThree}>生活便利</span>
              <span className={styles.labelFour}>孩子成長</span>
            </div>
          </div>
        </section>

        <nav className={styles.categoryNav} aria-label="Lumi 產品分類">
          <div className={styles.shell}>
            <a href="#explore">全部</a>
            {categoryOrder.map((id) => <a href={`#category-${id}`} key={id}>{lumiCategories[id].name}</a>)}
            <a href="#explore">Lumi Skills</a>
          </div>
        </nav>

        <section className={styles.featuredSection} id="featured">
          <div className={styles.shell}>
            <div className={styles.sectionHeading}>
              <span className={styles.eyebrow}>FEATURED PICKS</span>
              <h2>這次，先從這裡開始</h2>
              <p>精選三個不同場景的 Lumi 工具，讓生活、工作與創作都有一個容易開始的入口。</p>
            </div>
            <div className={styles.featuredGrid}>
              {featuredProducts.map((product) => <ProductCard compact key={product.id} product={product} />)}
            </div>
          </div>
        </section>

        <LumiCatalog />

        <section className={styles.categoryStories} aria-label="Lumi 應用系列">
          <div className={styles.shell}>
            {categoryOrder.map((id, index) => {
              const category = lumiCategories[id]
              const count = lumiProducts.filter((product) => product.category === id).length
              return (
                <article className={styles.categoryStory} id={`category-${id}`} key={id}>
                  <span className={styles.categoryIndex}>0{index + 1}</span>
                  <div>
                    <span className={styles.eyebrow}>{category.label}</span>
                    <h2>{category.name}</h2>
                  </div>
                  <p>{category.description}</p>
                  <a href="#explore">查看 {count} 個工具<ArrowRight size={16} /></a>
                </article>
              )
            })}
          </div>
        </section>

        <section className={styles.howSection} id="how">
          <div className={styles.shell}>
            <div className={styles.howIntro}>
              <span className={styles.eyebrow}>HOW IT WORKS</span>
              <h2>不用先學 Prompt。</h2>
              <p>Web Apps 可以直接操作。AI Skills 則透過整理好的工作流程協助完成任務。</p>
            </div>
            <div className={styles.steps}>
              {['選一個工具', '告訴 Lumi 你的情況', '拿到可以使用的結果'].map((step, index) => (
                <article key={step}>
                  <span>0{index + 1}</span>
                  <h3>{step}</h3>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.whySection}>
          <div className={styles.shell}>
            <div className={styles.sectionHeading}>
              <span className={styles.eyebrow}>WHY LUMI</span>
              <h2>工具可以很聰明，也可以很有溫度。</h2>
            </div>
            <div className={styles.whyGrid}>
              {whyLumi.map(({ Icon, title, description }) => (
                <article key={title}>
                  <span><Icon size={22} /></span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.ctaSection}>
          <div className={`${styles.shell} ${styles.ctaCard}`}>
            <BrainCircuit size={34} />
            <span className={styles.eyebrow}>START WITH LUMI</span>
            <h2>今天想完成什麼？</h2>
            <p>不用先準備完整答案。選一個工具，從你現在的情況開始就好。</p>
            <a className={styles.primaryButton} href="#explore">探索所有 Lumi 工具<ArrowRight size={17} /></a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
