-- AlterEnum: 讓忘記密碼/OAuth帳號加開密碼/Guest啟用信也能寫入 EmailDeliveryLog
-- 原因：這三種信件先前只靠 console.error，寄送失敗完全無法追蹤，
--      導致 OAuth 帳號按下忘記密碼時被靜默跳過寄信也無從察覺
ALTER TYPE "EmailDeliveryType" ADD VALUE 'PASSWORD_RESET';
ALTER TYPE "EmailDeliveryType" ADD VALUE 'OAUTH_PASSWORD_SETUP';
ALTER TYPE "EmailDeliveryType" ADD VALUE 'GUEST_ACTIVATION';
