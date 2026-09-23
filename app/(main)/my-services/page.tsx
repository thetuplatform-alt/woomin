import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getActiveSeriesEntitlements } from '@/lib/entitlements'

export const metadata: Metadata = {
  title: '我的服務 | BestAppStore',
  description: '查看你目前可以使用的 BestAppStore 系列服務。',
}

type MyServicesPageProps = {
  searchParams: Promise<{ access?: string; service?: string }>
}

export default async function MyServicesPage({ searchParams }: MyServicesPageProps) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login?returnTo=%2Fmy-services')
  }

  const [{ access, service }, services] = await Promise.all([
    searchParams,
    getActiveSeriesEntitlements(session.user.id),
  ])
  const accessDenied = access === 'denied' && service === 'lumi-series'

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      <header className="max-w-2xl">
        <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.16em] text-cta">
          <Sparkles size={16} aria-hidden="true" /> MY SERVICES
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-heading sm:text-4xl">我的服務</h1>
        <p className="mt-3 text-base leading-7 text-body">你目前可以使用的 BestAppStore 系列服務會顯示在這裡。</p>
      </header>

      {accessDenied ? (
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          你的帳號目前沒有 Lumi Series 使用權限。
        </div>
      ) : null}

      {services.length > 0 ? (
        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="已開通服務">
          {services.map((serviceItem) => (
            <article className="rounded-2xl border border-divider bg-white p-6" key={serviceItem.code}>
              <span className="text-xs font-semibold tracking-[0.14em] text-caption">SERIES</span>
              <h2 className="mt-3 text-xl font-bold text-heading">{serviceItem.name}</h2>
              <p className="mt-2 text-sm leading-6 text-body">此系列已開通，可以進入查看並使用目前提供的工具。</p>
              <Link className="mt-6 inline-flex items-center gap-2 font-semibold text-cta hover:text-cta-hover" href={`/${serviceItem.slug}`}>
                進入服務 <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </section>
      ) : (
        <section className="mt-10 rounded-2xl border border-divider bg-white p-8">
          <h2 className="text-xl font-bold text-heading">目前沒有已開通的服務</h2>
          <p className="mt-2 text-sm leading-6 text-body">之後取得的系列權限會自動出現在這裡。</p>
          <Link className="mt-5 inline-flex items-center gap-2 font-semibold text-cta hover:text-cta-hover" href="/">
            返回 BestAppStore <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      )}
    </main>
  )
}
