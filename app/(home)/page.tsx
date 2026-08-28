import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  CircleHelp,
  ExternalLink,
  Fingerprint,
  LockKeyhole,
  Menu,
  MousePointer2,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { JsonLd } from '@/components/common/json-ld'
import { resolveAppUrl } from '@/lib/app-url'
import styles from './home.module.css'

const pageTitle = 'BestAppStore｜數位應用・專業服務・精選內容'
const pageDescription =
  'BestAppStore 整合數位應用、專業服務與精選內容，讓每一次使用都更簡單、清楚而安心。'

export async function generateMetadata(): Promise<Metadata> {
  const appUrl = await resolveAppUrl()

  return {
    title: { absolute: pageTitle },
    description: pageDescription,
    alternates: { canonical: appUrl },
    openGraph: {
      type: 'website',
      locale: 'zh_TW',
      url: appUrl,
      siteName: 'BestAppStore',
      title: pageTitle,
      description: pageDescription,
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDescription,
    },
  }
}

const services = [
  {
    number: '01',
    label: 'DIGITAL',
    category: '數位應用',
    title: '實用的數位工具，\n讓使用回到簡單。',
    description:
      '從 Web App、智慧工具到各類數位應用，除了功能之外，我們更重視使用是否清楚、順手、容易理解。',
    tags: ['Web App', 'AI 工具', 'Dashboard'],
    tone: 'digital',
  },
  {
    number: '02',
    label: 'SERVICE',
    category: '專業服務',
    title: '專業可以很完整，\n但不需要很複雜。',
    description:
      '不同服務保有自己的內容、流程與使用方式，讓資訊不混雜，也讓每一次接觸都更有方向。',
    tags: ['清楚流程', '專屬空間', '安心使用'],
    tone: 'service',
  },
  {
    number: '03',
    label: 'CURATED',
    category: '精選內容',
    title: '少一點干擾，\n多一點真正值得看的內容。',
    description:
      '把有價值的資訊整理好、分類好，讓需要的人更快找到真正相關的內容與服務。',
    tags: ['整理分類', '降低干擾', '更快找到'],
    tone: 'curated',
  },
] as const

const steps = [
  {
    number: '01',
    icon: ExternalLink,
    title: '從專屬入口進入',
    description:
      '依照您所使用的服務，從該服務提供的網站、邀請連結或專屬入口進入。',
    tags: ['官方網站', '邀請連結', '專屬入口'],
  },
  {
    number: '02',
    icon: UserRound,
    title: '登入會員',
    description:
      '使用會員帳號登入，系統會依目前服務與權限，呈現與您相關的內容。',
    tags: ['會員帳號', '服務辨識', '權限顯示'],
  },
  {
    number: '03',
    icon: Check,
    title: '開始使用',
    description:
      '進入已購買或獲授權的服務內容，依照該服務提供的方式開始使用。',
    tags: ['已購買', '已授權', '開始使用'],
  },
] as const

const faqs = [
  {
    question: '無法登入會員帳號？',
    answer:
      '請先確認使用註冊時的 Email 與登入方式；若忘記密碼，可由登入頁前往重設密碼。',
  },
  {
    question: '找不到已購買或已授權的內容？',
    answer:
      '請確認您是從正確的服務入口登入，且目前帳號與購買或授權時使用的帳號相同。',
  },
  {
    question: '為什麼看不到其他服務？',
    answer:
      'BestAppStore 會依服務與權限顯示相關內容；未取得授權的服務空間不會出現在您的帳號中。',
  },
] as const

function Brand() {
  return (
    <span className={styles.brand} aria-label="BestAppStore">
      <span className={styles.brandMark} aria-hidden="true">
        B
      </span>
      <span>BestAppStore</span>
    </span>
  )
}

function DesktopNavigation() {
  return (
    <nav className={styles.desktopNav} aria-label="主要導覽">
      <a href="#about">關於我們</a>
      <a href="#how">使用說明</a>
      <a href="#support">支援中心</a>
      <Link className={styles.loginLink} href="/login">
        會員登入
      </Link>
    </nav>
  )
}

function MobileNavigation() {
  return (
    <details className={styles.mobileNav}>
      <summary aria-label="開啟導覽選單">
        <Menu aria-hidden="true" size={22} />
        <span>選單</span>
      </summary>
      <nav aria-label="行動版導覽">
        <a href="#about">關於我們</a>
        <a href="#how">使用說明</a>
        <a href="#support">支援中心</a>
        <Link href="/login">會員登入</Link>
      </nav>
    </details>
  )
}

function HeroInterface() {
  return (
    <div className={styles.heroVisual} aria-label="BestAppStore 數位服務介面示意圖">
      <div className={styles.trustChipTop}>
        <ShieldCheck size={16} aria-hidden="true" />
        安全可靠
      </div>
      <div className={styles.trustChipBottom}>
        <Fingerprint size={16} aria-hidden="true" />
        隱私保護
      </div>
      <div className={styles.interfaceWindow}>
        <div className={styles.windowBar}>
          <span className={styles.windowDots} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className={styles.windowTitle}>BestAppStore Workspace</span>
          <span className={styles.avatar}>BA</span>
        </div>
        <div className={styles.interfaceBody}>
          <aside className={styles.interfaceSidebar} aria-hidden="true">
            <span className={styles.sidebarLogo}>B</span>
            <i className={styles.active} />
            <i />
            <i />
            <i />
          </aside>
          <div className={styles.interfaceContent}>
            <div className={styles.interfaceHeading}>
              <div>
                <small>WELCOME BACK</small>
                <strong>我的服務空間</strong>
              </div>
              <button type="button" tabIndex={-1}>
                查看全部
              </button>
            </div>
            <div className={styles.metricGrid}>
              <div className={styles.metricCardPrimary}>
                <Sparkles size={20} aria-hidden="true" />
                <span>數位應用</span>
                <strong>04</strong>
                <small>可使用的服務</small>
              </div>
              <div className={styles.metricCard}>
                <LockKeyhole size={18} aria-hidden="true" />
                <span>專業服務</span>
                <strong>02</strong>
                <small>已授權的空間</small>
              </div>
            </div>
            <div className={styles.activityCard}>
              <div className={styles.activityTitle}>
                <strong>最近使用</strong>
                <span>已依權限顯示</span>
              </div>
              <div className={styles.activityRow}>
                <span className={styles.activityIcon}>
                  <MousePointer2 size={15} aria-hidden="true" />
                </span>
                <span>
                  <strong>智慧工作台</strong>
                  <small>數位應用 · 可使用</small>
                </span>
                <Check size={16} aria-label="已授權" />
              </div>
              <div className={styles.activityRow}>
                <span className={styles.activityIconAlt}>
                  <ShieldCheck size={15} aria-hidden="true" />
                </span>
                <span>
                  <strong>專業服務中心</strong>
                  <small>服務空間 · 已授權</small>
                </span>
                <Check size={16} aria-label="已授權" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ServiceArt({ tone }: { tone: (typeof services)[number]['tone'] }) {
  if (tone === 'digital') {
    return (
      <div className={`${styles.serviceArt} ${styles.digitalArt}`} aria-hidden="true">
        <div className={styles.miniWindow}>
          <span className={styles.miniDots}>
            <i />
            <i />
            <i />
          </span>
          <div className={styles.miniGrid}>
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
    )
  }

  if (tone === 'service') {
    return (
      <div className={`${styles.serviceArt} ${styles.serviceArtFlow}`} aria-hidden="true">
        <span className={styles.flowCore}>服務</span>
        <span className={`${styles.flowNode} ${styles.flowNodeOne}`}>流程</span>
        <span className={`${styles.flowNode} ${styles.flowNodeTwo}`}>內容</span>
        <span className={`${styles.flowNode} ${styles.flowNodeThree}`}>安心</span>
      </div>
    )
  }

  return (
    <div className={`${styles.serviceArt} ${styles.curatedArt}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </div>
  )
}

export default async function BestAppStoreHomePage() {
  const appUrl = await resolveAppUrl()
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'BestAppStore',
    url: appUrl,
    description: pageDescription,
  }
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'BestAppStore',
    url: appUrl,
    description: pageDescription,
    inLanguage: 'zh-TW',
    publisher: {
      '@type': 'Organization',
      name: 'BestAppStore',
    },
  }

  return (
    <div className={styles.page} id="top">
      <JsonLd data={organizationJsonLd} />
      <JsonLd data={websiteJsonLd} />

      <header className={styles.header}>
        <div className={styles.shell}>
          <div className={styles.navbar}>
            <a href="#top">
              <Brand />
            </a>
            <DesktopNavigation />
            <MobileNavigation />
          </div>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={`${styles.shell} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>A BETTER DIGITAL EXPERIENCE</span>
              <h1>
                好的選擇，
                <br />
                值得更好的體驗。
              </h1>
              <p>
                從數位應用、專業服務到精選內容，BestAppStore
                希望讓每一次使用，都更簡單、清楚而安心。
              </p>
              <a className={styles.primaryButton} href="#about">
                了解 BestAppStore
                <ArrowRight size={17} aria-hidden="true" />
              </a>
              <div className={styles.heroProof} aria-label="服務特色">
                <span>
                  <ShieldCheck size={15} aria-hidden="true" /> 安全可靠
                </span>
                <span>
                  <MousePointer2 size={15} aria-hidden="true" /> 清楚易用
                </span>
                <span>
                  <LockKeyhole size={15} aria-hidden="true" /> 權限分明
                </span>
              </div>
            </div>
            <HeroInterface />
          </div>
        </section>

        <section className={styles.servicesSection} id="about">
          <div className={styles.shell}>
            <div className={styles.sectionHeading}>
              <span className={styles.eyebrow}>WHAT WE DO</span>
              <h2>BestAppStore 能為你做什麼</h2>
              <p>
                把值得使用的數位應用、專業服務與精選內容整理得更清楚，
                讓每一次選擇與使用都更自然。
              </p>
            </div>
            <div className={styles.serviceGrid}>
              {services.map((service) => (
                <article
                  className={`${styles.serviceCard} ${styles[service.tone]}`}
                  key={service.number}
                >
                  <div className={styles.serviceTopline}>
                    <span>
                      {service.number} / {service.label}
                    </span>
                    <span>{service.category}</span>
                  </div>
                  <ServiceArt tone={service.tone} />
                  <h3>
                    {service.title.split('\n').map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </h3>
                  <p>{service.description}</p>
                  <div className={styles.tagList}>
                    {service.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.howSection} id="how">
          <div className={styles.shell}>
            <div className={styles.sectionHeading}>
              <span className={styles.eyebrow}>HOW IT WORKS</span>
              <h2>從進入，到開始使用</h2>
              <p>
                不用先理解複雜的系統，只要從正確的服務入口進入，
                後面的流程就應該自然又清楚。
              </p>
            </div>
            <div className={styles.journey}>
              {steps.map((step, index) => {
                const Icon = step.icon
                return (
                  <div className={styles.journeyItem} key={step.number}>
                    <article className={styles.stepCard}>
                      <div className={styles.stepNumber}>{step.number}</div>
                      <span className={styles.stepIcon}>
                        <Icon size={21} aria-hidden="true" />
                      </span>
                      <h3>{step.title}</h3>
                      <p>{step.description}</p>
                      <div className={styles.stepTags}>
                        {step.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    </article>
                    {index < steps.length - 1 && (
                      <div className={styles.journeyLine} aria-hidden="true">
                        <ArrowRight size={18} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className={styles.supportSection} id="support">
          <div className={styles.shell}>
            <div className={styles.sectionHeading}>
              <span className={styles.eyebrow}>SUPPORT</span>
              <h2>需要協助？從這裡開始</h2>
              <p>
                帳號登入、內容與使用權限的常見狀況，先用簡單清楚的方式處理。
              </p>
            </div>
            <div className={styles.supportGrid}>
              <div className={styles.faqList}>
                {faqs.map((faq, index) => (
                  <details key={faq.question} open={index === 0}>
                    <summary>
                      <span>{faq.question}</span>
                      <CircleHelp size={18} aria-hidden="true" />
                    </summary>
                    <p>{faq.answer}</p>
                  </details>
                ))}
              </div>
              <aside className={styles.memberCard}>
                <span className={styles.memberIcon}>
                  <UserRound size={24} aria-hidden="true" />
                </span>
                <span className={styles.eyebrow}>MEMBER</span>
                <h2>已經是會員？</h2>
                <p>
                  登入後即可前往目前已取得的服務內容，並查看相關訂單或會員資訊。
                </p>
                <Link className={styles.primaryButton} href="/login">
                  登入我的帳戶
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </aside>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.shell} ${styles.footerMain}`}>
          <a href="#top">
            <Brand />
          </a>
          <nav aria-label="頁尾導覽">
            <a href="#about">關於我們</a>
            <a href="#how">使用說明</a>
            <a href="#support">支援中心</a>
            <Link href="/terms">服務條款</Link>
            <Link href="/privacy">隱私政策</Link>
          </nav>
        </div>
        <div className={`${styles.shell} ${styles.copyright}`}>
          © {new Date().getFullYear()} BestAppStore. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
