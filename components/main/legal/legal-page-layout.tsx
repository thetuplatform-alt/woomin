import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { BestAppStoreBrand } from '@/components/shared/bestappstore-brand'
import styles from './legal-page-layout.module.css'

interface LegalPageLayoutProps {
  title: string
  lastUpdated?: string
  eyebrow?: string
  description?: string
  children: ReactNode
}

export function LegalPageLayout({
  title,
  lastUpdated,
  eyebrow = 'BESTAPPSTORE · LEGAL',
  description = '我們重視每一次使用體驗，也用清楚透明的方式說明服務與資料處理原則。',
  children,
}: LegalPageLayoutProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={`${styles.shell} ${styles.navbar}`}>
          <Link href="/" className={styles.brandLink}><BestAppStoreBrand /></Link>
          <nav className={styles.navigation} aria-label="網站導覽">
            <Link href="/">回到首頁</Link>
            <Link href="/lumi-series">Lumi Series</Link>
            <Link className={styles.loginLink} href="/login">會員登入</Link>
          </nav>
        </div>
      </header>
      <main>
        <section className={styles.hero}>
          <div className={`${styles.shell} ${styles.heroInner}`}>
            <div>
              <span className={styles.eyebrow}>{eyebrow}</span>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            {lastUpdated && <span className={styles.updated}>最後更新：{lastUpdated}</span>}
          </div>
        </section>
        <section className={styles.contentSection}>
          <div className={styles.contentShell}><article className={styles.content}>{children}</article></div>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={`${styles.shell} ${styles.footerMain}`}>
          <div><BestAppStoreBrand compact /><p>好的選擇，值得更好的體驗。</p></div>
          <nav aria-label="頁尾導覽">
            <Link href="/help">使用說明</Link>
            <Link href="/support">支援中心</Link>
            <Link href="/terms">服務條款</Link>
            <Link href="/privacy">隱私權政策</Link>
            <Link href="/lumi-series">探索 Lumi Series <ArrowUpRight size={14} /></Link>
          </nav>
        </div>
        <div className={`${styles.shell} ${styles.copyright}`}>© {new Date().getFullYear()} BestAppStore. All rights reserved.</div>
      </footer>
    </div>
  )
}
