// app/(main)/terms/page.tsx
// 用戶服務條款頁面
// 顯示平台服務條款內容

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
  const title = `用戶服務條款 | ${siteName}`
  const description = `${siteName}服務條款。`
  return {
    title,
    description,
    openGraph: { title, description },
  }
}

export default async function TermsPage() {
  const [{ siteName, contactEmail, brandDisplayName }, custom] = await Promise.all([
    getPublicSiteSettings(),
    prisma.siteSetting.findUnique({ where: { key: SETTING_KEYS.LEGAL_TERMS_MD } }),
  ])

  const lastUpdated = custom?.updatedAt ? formatDate(custom.updatedAt) : formatDate(new Date())

  if (custom?.value?.trim()) {
    return (
      <LegalPageLayout title="用戶服務條款" lastUpdated={lastUpdated}>
        <LegalMarkdownContent content={custom.value} />
      </LegalPageLayout>
    )
  }

  return (
    <LegalPageLayout title="用戶服務條款" lastUpdated={lastUpdated}>
      <p>
        本使用者條款（以下稱「本條款」）適用於「{siteName}」網站（以下稱「本平台」）。當您於本平台完成註冊及／或使用本平台服務，即表示您已閱讀、瞭解、同意接受並遵守本條款。
      </p>

      <h3>一、同意條款</h3>
      <p>
        本平台為提供錄製影片教學、Markdown 文章筆記及程式碼範例之教學服務提供者。本條款適用於所有連結至本平台之會員或訪客。我們有權視需要隨時修改、調整本條款，建議您定期造訪本頁面以了解最新條款。若您不同意本條款之全部或部分內容，您應立即停止使用本服務。
      </p>

      <h3>二、註冊義務聲明</h3>
      <ol>
        <li>
          使用者應為完全行為能力人。如您為限制行為能力人或無行為能力人，您的法定代理人、監護人或輔助人應閱讀並同意本條款後，方得註冊會員。
        </li>
        <li>
          使用者應保證提供之個人資料為真實、正確且最新。不應使用不實資料或侵害他人權利之文字作為帳號名稱。
        </li>
        <li>
          使用者有義務妥善保管帳戶及密碼，並對帳號下進行之一切活動負責。本服務僅供本人使用，不得轉讓或出借。
        </li>
      </ol>

      <h3>三、使用者守法承諾</h3>
      <p>
        您承諾不會以任何非法目的使用本服務，並遵守相關法令。禁止行為包括但不限於：
      </p>
      <ul>
        <li>上載誹謗、侮辱、不雅、具威脅性或違反公共秩序之內容。</li>
        <li>侵害他人名譽、隱私、營業秘密或智慧財產權。</li>
        <li>上載含有病毒或破壞性程式碼之檔案。</li>
        <li>濫發廣告郵件或干擾本服務運作。</li>
        <li>以任何方式傷害未成年人。</li>
      </ul>

      <h3>四、購買與服務內容</h3>
      <ol>
        <li>
          本服務包含影片教學、相關文章及程式碼範例。完成付款後，系統將解鎖您的會員權限，您可於本平台存續期間內不限次數觀看。
        </li>
      </ol>

      <h3>五、退費說明</h3>
      <ol>
        <li>
          <strong>退款資格</strong>：使用者若在購買後 7
          日內，經確認未曾觀看正式課程影片、下載內容檔案（不包含試閱單元），皆可申請辦理退費。
        </li>
        <li>
          <strong>退款流程</strong>：請提供您購買時，填寫的姓名及電子信箱，並註明欲退費原因，來信至{' '}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          ，會有專人審核後受理退費。
        </li>
        <li>
          <strong>退款方式</strong>
          <ul>
            <li>
              信用卡刷退：如果當初購買時，採用信用卡付費，則採信用卡退刷方式。
            </li>
            <li>
              匯款退款：如果當初購買時採用 ATM
              轉帳或超商付款，則採匯款退款方式。
            </li>
          </ul>
        </li>
      </ol>

      <h3>六、內容所有權與智慧財產權</h3>
      <p>
        本平台上所有內容（文字、聲音、圖片、影片、軟體設計等）均受智慧財產權法律保護，版權歸 {brandDisplayName || siteName} 或相關權利人所有。
      </p>
      <p>
        <strong>嚴禁行為</strong>：未經書面同意，不得擅自下載、修改、重製、錄音、錄影、傳播、轉售或共享帳號。如有違反，本平台有權終止權限並不予退費，並追究法律責任。
      </p>

      <h3>七、免責聲明</h3>
      <ol>
        <li>
          本平台將盡力維護系統穩定，但如遇第三方服務（如 Cloudflare, Stripe, AWS）故障導致暫時中斷，本平台不負賠償責任。
        </li>
        <li>
          使用者應對自行提供之言論負責。本服務可能含有連結至第三方網站，由於我們無法控制第三方網站內容及資源，其內容由該第三方負責，使用者應自行判斷其正確性。
        </li>
        <li>
          使用者在使用本服務時，若因為使用者自身疏失、違法行為或其他原因所造成的損失，本平台概不負責。
        </li>
        <li>
          本免責聲明如有任何未盡事宜，均以相關法律法規及本平台相關規定為準。
        </li>
      </ol>

      <h3>八、聯絡我們</h3>
      <p>
        倘若發現任何違反本條款之情事，或有任何疑問，請聯繫電子郵件：
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>。
      </p>
    </LegalPageLayout>
  )
}
