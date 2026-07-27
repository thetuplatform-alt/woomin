// app/(main)/privacy/page.tsx
// 隱私權政策頁面
// 顯示平台隱私權政策內容

import { Metadata } from 'next'
import { LegalPageLayout, LegalMarkdownContent } from '@/components/main/legal'
import { getPublicSiteSettings } from '@/lib/site-settings-public'
import { prisma } from '@/lib/prisma'
import { SETTING_KEYS } from '@/lib/validations/settings'

export const dynamic = 'force-dynamic'

function formatDate(date: Date): string {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

export async function generateMetadata(): Promise<Metadata> {
  const { siteName } = await getPublicSiteSettings()
  const title = `隱私權政策 | ${siteName}`
  const description = `${siteName}隱私權政策。`
  return {
    title,
    description,
    openGraph: { title, description },
  }
}

export default async function PrivacyPage() {
  const [{ siteName, contactEmail }, custom] = await Promise.all([
    getPublicSiteSettings(),
    prisma.siteSetting.findUnique({ where: { key: SETTING_KEYS.LEGAL_PRIVACY_MD } }),
  ])

  const lastUpdated = custom?.updatedAt ? formatDate(custom.updatedAt) : formatDate(new Date())

  if (custom?.value?.trim()) {
    return (
      <LegalPageLayout title="隱私權政策" lastUpdated={lastUpdated}>
        <LegalMarkdownContent content={custom.value} />
      </LegalPageLayout>
    )
  }

  return (
    <LegalPageLayout title="隱私權政策" lastUpdated={lastUpdated}>
      <h3>一、簡介</h3>
      <p>
        歡迎您使用 {siteName} (以下稱「本平台」)，為了保障您的權益，並打造更佳的服務，在您開始使用本網站前，請先詳讀本隱私權政策與使用條款（以下簡稱「本政策」）。
      </p>

      <h3>二、本政策適用範圍</h3>
      <p>
        本政策適用本平台所有服務，包括提供內容註冊會員、發表留言或提問、購買商品或課程、報名活動。我們可能不定時推出新服務。若推出新服務使收集與使用個人資料的方式有變動，我們會提供變動的項目。除非推出的新服務有特別說明，否則這類服務仍須遵守本政策。
      </p>

      <h3>三、我們如何收集您的個人資料</h3>
      <p>
        我們基於消費者、客戶管理與服務、行銷、採購與供應管理及其他合於相關法令所定業務需要之特定目的，使用以下方式收集您的個人資料：
      </p>
      <ol>
        <li>
          <strong>當您瀏覽網站時</strong> — 我們會收集您瀏覽網站的使用情形，例如閱讀哪些文章、在哪些地方離開網頁、閱讀日期與時間、Cookie 資料、您的 IP 位址、瀏覽器類型、連線至網站的裝置類型。
        </li>
        <li>
          <strong>當您註冊會員時</strong> — 我們會收集您的個人資料，例如：姓名、電子信箱，以便為您提供會員服務。
        </li>
        <li>
          <strong>當您購買商品或課程時</strong> — 我們會收集您的姓名、電子信箱、手機（視需要），以便後續課程通知、金流對帳與優惠訊息。
        </li>
        <li>
          <strong>來自第三方</strong> — 我們會從與我們合作的第三方（如 Google, Apple 等社群登入工具），收集到有關您的個人資料。只有當您同意第三方或本平台進行資料分享、或註冊成為會員時，我們才會使用。
        </li>
      </ol>

      <h3>四、我們如何使用您的個人資料</h3>
      <ol>
        <li>
          <strong>提供個人化的服務，包括內容和廣告</strong> — 我們會用您所提供的個人資料，為您打造個人化的服務，包括個人化內容或建議活動。我們會根據您的興趣及過去的瀏覽紀錄，適時提供您感興趣的課程或活動資訊。
        </li>
        <li>
          <strong>評估成效</strong> — 為了了解本服務的使用情形，我們會收集並分析資料。我們會運用 PostHog、Facebook 像素 (Pixel) 等多種工具分析，而這些分析結果將用來改善服務，為您提供更佳的內容與個人化的廣告體驗。
        </li>
        <li>
          <strong>與您互動交流</strong> — 我們會使用向您收集到的電子郵件、社交媒體帳號與您互動。例如：若您參與本平台舉辦的活動，我們會使用個人資料與您聯絡後續事宜。我們也可能在推出新服務時，寄送通知給您。
        </li>
        <li>
          <strong>保護本平台使用者和一般大眾</strong> — 我們會應用相關資料來改善本平台所提供服務的穩定與安全，偵測與預防可能的濫用行為或安全性風險。
        </li>
      </ol>

      <h3>五、分享您的個人資料</h3>
      <p>我們可能會在以下情況分享您的個人資料：</p>
      <ul>
        <li>
          <strong>服務供應商</strong>：我們會與提供技術基礎架構的服務供應商合作（尤其是代管、儲存、管理及維護網站程式與內容的供應商，如 Zeabur、AWS、Cloudflare、Stripe），以便本平台所有服務順利運作。
        </li>
        <li>
          <strong>執法機關與資料保護主管機關</strong>：若為了遵守適用法律下的法律義務，或對搜查令、法院命令或傳票等有效的法律程序作出回應，我們將會分享您的個人資料。
        </li>
      </ul>

      <h3>六、資料安全保護承諾</h3>
      <p>
        您的個人資料處理均依照中華民國法律予以處理，並以台灣台北地方法院為第一審管轄法院。我們致力為您的個人資料提供妥善保護，並採取適當的技術與安全維護措施（如 HTTPS 加密傳輸）來協助保護您的個人資料安全。
      </p>

      <h3>七、您的個人資料保存、刪除和權利</h3>
      <p>
        依個人資料保護法，您可以與本平台客服部聯絡請求行使以下權利：
      </p>
      <ul>
        <li>查詢或請求閱覽。</li>
        <li>製給複製本。</li>
        <li>補充或更正。</li>
        <li>請求停止蒐集、處理或利用。</li>
        <li>請求刪除。</li>
      </ul>
      <p>
        上述權利之行使，本平台可能依法酌收必要成本費用。若因不符合申請程序、法律規定、本網站依法負有保存義務或法律另有規定之情況者，則可能無法依您的要求辦理。
      </p>

      <h3>八、隱私權政策的異動</h3>
      <p>
        本平台有權於任何時間修改或變更本政策之內容。當我們對本政策進行實質變更後，將適時透過網站公告或電子郵件通知您。
      </p>

      <p>
        <strong>聯絡信箱：</strong>
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
      </p>
    </LegalPageLayout>
  )
}
