import type { Metadata } from 'next'
import Link from 'next/link'
import { CircleHelp, Mail, ShieldCheck } from 'lucide-react'
import { LegalPageLayout } from '@/components/main/legal'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

const supportEmail = 'service@bestappstore.co.uk'

export const metadata: Metadata = {
  title: { absolute: '支援中心 | BestAppStore' },
  description: 'BestAppStore 支援中心，協助處理會員登入、已開通服務、Lumi Series、工具使用、付款訂閱與技術問題。',
  alternates: { canonical: 'https://bestappstore.co.uk/support' },
}

const supportTopics = [
  {
    title: '登入與帳號',
    content: '請先確認使用註冊時的 Email 與登入方式。若忘記密碼，可從登入頁選擇重設密碼；仍無法登入時，請將發生時間與畫面訊息寄給支援中心。',
  },
  {
    title: '我的服務 / 已開通服務',
    content: '登入後可前往「我的服務」查看目前已開通服務。若內容與預期不同，請確認登入帳號是否與購買或開通時使用的 Email 相同。',
  },
  {
    title: 'Lumi Series',
    content: '已開通 Lumi Series 的會員，可以從「我的服務」或 Lumi Series 頁面查看目前可使用的工具。若顯示尚未開通，請聯絡支援中心協助確認。',
  },
  {
    title: 'Web App 開啟問題',
    content: '請從 Lumi Series 的工具頁點選開啟，並確認瀏覽器沒有封鎖新頁面。若仍無法使用，請提供工具名稱、發生時間、瀏覽器與錯誤訊息。',
  },
  {
    title: '工具目前尚未提供',
    content: '部分工具仍在準備中，尚未開放的工具不會出現在工具清單；若頁面提示工具目前尚未提供，請稍後再試或聯絡支援中心。',
  },
  {
    title: '付款 / 訂閱',
    content: '如需確認付款或訂閱狀態，請提供訂單時間、付款方式與購買使用的 Email。請勿提供完整付款卡號或任何驗證碼。',
  },
  {
    title: 'Email 收不到',
    content: '請先查看垃圾郵件、促銷內容與其他收件匣分類，並確認信箱地址正確。仍未收到時，請告訴我們預期收到的信件類型與時間。',
  },
  {
    title: '技術問題回報',
    content: '請提供使用頁面、發生時間、畫面上的錯誤訊息、裝置與瀏覽器，以及不含敏感資訊的截圖，幫助我們更快確認問題。',
  },
] as const

export default function SupportPage() {
  return (
    <LegalPageLayout
      title="支援中心"
      eyebrow="BESTAPPSTORE · SUPPORT"
      description="如果你在登入、已開通服務、工具使用或付款過程中遇到問題，可以從這裡找到協助方式。"
    >
      <section aria-labelledby="contact-support">
        <Card className="border-[#747d58]/25 bg-white/75 shadow-none">
          <CardHeader>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eef0e7] text-[#596144]">
              <Mail aria-hidden="true" size={21} />
            </span>
            <h2 id="contact-support" className="text-2xl font-semibold text-[#2c2924]">聯絡支援中心</h2>
          </CardHeader>
          <CardContent className="space-y-5">
            <p>請來信說明你遇到的情況，我們會依問題內容協助確認。</p>
            <Button asChild className="rounded-full bg-[#596144] px-6 text-white hover:bg-[#474d37]">
              <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="support-topics">
        <h2 id="support-topics">常見問題</h2>
        <Accordion type="single" collapsible className="space-y-3">
          {supportTopics.map((topic, index) => (
            <AccordionItem
              key={topic.title}
              value={`support-${index}`}
              className="rounded-2xl border border-[#574c3a]/15 bg-white/75 px-5"
            >
              <AccordionTrigger className="text-base font-semibold text-[#2c2924] hover:text-[#596144] hover:no-underline">
                <span className="flex items-center gap-3"><CircleHelp aria-hidden="true" size={18} />{topic.title}</span>
              </AccordionTrigger>
              <AccordionContent className="text-[15px] leading-7 text-[#6d685f]">{topic.content}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="grid gap-5 md:grid-cols-2" aria-label="問題回報與資訊安全">
        <Card className="border-[#574c3a]/15 bg-white/75 shadow-none">
          <CardHeader><h2 className="text-xl font-semibold text-[#2c2924]">問題回報時，建議提供</h2></CardHeader>
          <CardContent>
            <ul className="mb-0">
              <li>正在使用的頁面或工具名稱</li>
              <li>問題發生時間</li>
              <li>畫面上的錯誤訊息</li>
              <li>裝置與瀏覽器</li>
              <li>不含敏感資訊的截圖</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="border-[#a36b42]/25 bg-[#fff8ef] shadow-none">
          <CardHeader>
            <span className="flex items-center gap-2 text-[#7b4d2e]"><ShieldCheck aria-hidden="true" size={20} />資訊安全提醒</span>
            <h2 className="text-xl font-semibold text-[#2c2924]">請保護你的帳號與付款資訊</h2>
          </CardHeader>
          <CardContent>
            <p>請不要提供密碼、一次性驗證碼或完整付款卡號。BestAppStore 客服不會要求你提供上述資訊。</p>
          </CardContent>
        </Card>
      </section>

      <nav className="flex flex-wrap gap-x-6 gap-y-3 border-t border-[#574c3a]/15 pt-7" aria-label="相關資訊">
        <Link href="/help">查看使用說明</Link>
        <Link href="/terms">服務條款</Link>
        <Link href="/privacy">隱私權政策</Link>
      </nav>
    </LegalPageLayout>
  )
}
