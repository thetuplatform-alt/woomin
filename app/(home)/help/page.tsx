import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CircleHelp, LogIn, PanelsTopLeft } from 'lucide-react'
import { LegalPageLayout } from '@/components/main/legal'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export const metadata: Metadata = {
  title: { absolute: '使用說明 | BestAppStore' },
  description: 'BestAppStore 使用說明，介紹會員登入、我的服務、Lumi Series、Web App 與工具開啟方式，以及取得支援的方法。',
  alternates: { canonical: 'https://bestappstore.co.uk/help' },
}

const helpSteps = [
  {
    title: '如何登入 BestAppStore',
    content: '從網站右上角選擇「進入服務」，使用註冊時的帳號與登入方式進入。若忘記密碼，可從登入頁選擇重設密碼。',
  },
  {
    title: '登入後前往「我的服務」',
    content: '登入完成後，可從會員選單進入「我的服務」，查看目前帳號可以使用的服務。',
  },
  {
    title: '「我的服務」會顯示什麼',
    content: '這裡只顯示目前帳號的已開通服務。不同帳號看到的內容可能不同。',
  },
  {
    title: '如何進入 Lumi Series',
    content: '在「我的服務」選擇 Lumi Series，即可進入工具首頁；也可以從 BestAppStore 首頁前往 Lumi Series。',
  },
  {
    title: '已開通 Lumi 時會看到什麼',
    content: '你會看到目前已開放的 Lumi 工具、精選推薦與各工具的使用介紹。',
  },
  {
    title: '尚未開通時怎麼辦',
    content: '頁面會提示目前尚未開通，並帶你回到「我的服務」。如果你認為帳號應該已開通，請聯絡支援中心。',
  },
  {
    title: '如何開啟 Web App',
    content: '先進入工具介紹頁，再選擇開始使用。系統會依目前狀態帶你前往可使用的 Web App。',
  },
  {
    title: 'Web App 與 Skill 的差異',
    content: 'Web App 是可直接在瀏覽器操作的工具；Skill 則依照整理好的步驟協助你完成特定工作，實際開放方式以工具頁說明為準。',
  },
  {
    title: '尚未開放的工具不會顯示',
    content: '仍在準備或暫停提供的工具，不會出現在 Lumi Series 的公開工具清單中。',
  },
  {
    title: '工具目前尚未提供',
    content: '若開啟時看到工具目前尚未提供，代表該工具仍在準備中。請稍後再試，或請聯絡支援中心。',
  },
  {
    title: '如何返回 Lumi Series',
    content: '使用頁面中的返回連結，或直接前往 Lumi Series，即可重新選擇其他工具。',
  },
  {
    title: '如何前往支援中心',
    content: '如果登入、已開通服務、工具或付款遇到問題，請前往支援中心查看常見問題或聯絡方式。',
  },
] as const

export default function HelpPage() {
  return (
    <LegalPageLayout
      title="使用說明"
      eyebrow="BESTAPPSTORE · HELP"
      description="從登入、查看已開通服務，到進入 Lumi Series 與開啟工具，依照以下步驟即可開始使用。"
    >
      <section className="grid gap-4 sm:grid-cols-2" aria-label="快速入口">
        <Card className="border-[#747d58]/25 bg-white/75 shadow-none">
          <CardHeader><LogIn className="text-[#596144]" aria-hidden="true" /><h2 className="text-xl font-semibold text-[#2c2924]">登入會員</h2></CardHeader>
          <CardContent><Button asChild className="rounded-full bg-[#596144] text-white hover:bg-[#474d37]"><Link href="/login">前往登入<ArrowRight aria-hidden="true" /></Link></Button></CardContent>
        </Card>
        <Card className="border-[#747d58]/25 bg-white/75 shadow-none">
          <CardHeader><PanelsTopLeft className="text-[#596144]" aria-hidden="true" /><h2 className="text-xl font-semibold text-[#2c2924]">我的服務</h2></CardHeader>
          <CardContent><Button asChild variant="outline" className="rounded-full border-[#747d58] text-[#596144]"><Link href="/my-services">查看已開通服務<ArrowRight aria-hidden="true" /></Link></Button></CardContent>
        </Card>
      </section>

      <section aria-labelledby="help-guide">
        <h2 id="help-guide">開始使用 BestAppStore</h2>
        <ol className="grid list-none gap-4 p-0 md:grid-cols-2">
          {helpSteps.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-[#574c3a]/15 bg-white/75 p-6">
              <span className="text-xs font-bold tracking-[0.16em] text-[#93713b]">STEP {String(index + 1).padStart(2, '0')}</span>
              <h3 className="mt-3 text-lg font-semibold text-[#2c2924]">{step.title}</h3>
              <p className="mb-0 mt-3 text-[15px] leading-7 text-[#6d685f]">{step.content}</p>
            </li>
          ))}
        </ol>
      </section>

      <Card className="border-[#747d58]/25 bg-[#eef0e7] shadow-none">
        <CardHeader>
          <span className="flex items-center gap-2 text-[#596144]"><CircleHelp aria-hidden="true" size={20} />還需要協助？</span>
          <h2 className="text-xl font-semibold text-[#2c2924]">請聯絡支援中心</h2>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild className="rounded-full bg-[#596144] text-white hover:bg-[#474d37]"><Link href="/support">前往支援中心<ArrowRight aria-hidden="true" /></Link></Button>
          <Button asChild variant="outline" className="rounded-full border-[#747d58] text-[#596144]"><Link href="/lumi-series">返回 Lumi Series</Link></Button>
        </CardContent>
      </Card>
    </LegalPageLayout>
  )
}
