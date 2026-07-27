# Course Realms

這是一個以 `Next.js 15 + Prisma 7` 建構的課程販售平台，現在採用 `Simple-first` 架構：

- 預設部署以 `Zeabur` 為主
- 圖片與附件預設使用本地 volume
- 影片預設支援 `YouTube`
- `Cloudflare Stream / S3 / SMTP / Google / Apple` 都改為上線後再啟用的進階功能

## Quick Start

1. 安裝依賴

```bash
pnpm install
```

2. 建立環境變數檔

```bash
cp .env.example .env
```

只需要先填這一項：

```env
DATABASE_URL="postgresql://user:password@localhost:5432/course_platform"
```

登入功能也不需要額外補 `AUTH_TRUST_HOST`、`NEXTAUTH_URL` 或 `AUTH_URL`。

3. 初始化 Prisma

```bash
pnpm prisma generate
pnpm prisma db push
```

4. 啟動開發環境

```bash
pnpm dev
```

5. 完成首次 setup

登入後進入 setup flow，依序選擇：

1. 影片方案：`YouTube` 或 `Cloudflare Stream`
2. 圖片儲存：本地儲存或 S3 相容儲存
3. Email：可先跳過
4. Google 登入：可先跳過
5. Apple 登入：可先跳過

## Zeabur 部署建議

- App Service 掛上 PostgreSQL，提供 `DATABASE_URL`
- 額外掛一個 volume 到 `/data/uploads`
- 不需要先準備 S3、Cloudflare Stream、SMTP 或 OAuth 憑證

若之後要啟用進階功能，可在以下位置補設定：

- `/admin/setup`
- `/admin/settings`

## 常用指令

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm prisma generate
pnpm prisma db push
pnpm prisma studio
pnpm admin:init <email>
```

## 進階整合

以下功能都不是啟動必填項目：

- Cloudflare Stream
- S3-compatible storage
- SMTP / Resend
- Google OAuth
- Apple OAuth

需要時再到後台設定，或補上對應環境變數即可。

## 部署限制與說明

- 本地 volume 適合 Zeabur 單實例部署，主要用於圖片與附件。
- 若未來要走多實例、跨區或更高可用性，仍建議改用 S3 相容物件儲存。
- YouTube 適合低門檻上線，不適合高度保護型付費影片場景。
- 若要使用 Cloudflare Stream、社群登入或 Email 發信，請在後台設定完成後再啟用。
