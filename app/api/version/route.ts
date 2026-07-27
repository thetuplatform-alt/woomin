import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 公開端點:回報目前執行中程式碼的 git commit SHA。
 *
 * 背景:這個平台曾發生「部署到錯的 Zeabur 服務,正式站其實沒更新」的事故
 * (詳見 openspec/changes/fix-zeabur-deploy-target-mismatch/design.md)。
 * 根因是 Zeabur 對「手動/直接部署」的服務完全不記錄 branch/commit,
 * 無法只從平台介面確認正在跑的程式碼版本。這個端點讓任何人都能直接
 * `curl https://aiver.me/api/version` 取得建置期的 commit SHA,跟本機
 * `git log` 比對,不必依賴 Zeabur 部署紀錄。
 *
 * commit SHA 由 Dockerfile builder 階段執行 `git rev-parse HEAD` 寫入
 * `GIT_COMMIT_SHA` 檔案,再複製進最終 runner 階段(見 Dockerfile)。
 * 讀不到這個檔案時(例如本機 `pnpm dev`,或 .git 不在建置環境內),
 * 回傳明確的預設值 "unknown",不得拋出例外或回 500。
 */
export async function GET() {
  let commit = "unknown";
  try {
    commit = readFileSync(join(process.cwd(), "GIT_COMMIT_SHA"), "utf-8").trim() || "unknown";
  } catch {
    // 檔案不存在(本機開發環境):維持預設值 "unknown"。
  }

  return NextResponse.json({ commit });
}
