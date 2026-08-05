# WooMin 更新指南（給客戶）

## 一句話說明

我們更新平台功能後，你不需要自己寫程式碼。跟你的 Codex（或其他 AI 開發助手）說一句話，它會自動把新版本拉進來、檢查有沒有跟你自己改過的地方衝突、確認沒問題才上線。

## 情境 A：你有裝 Codex（推薦）

在你的 repository 資料夾裡，跟 Codex 說：

```
更新到最新版本
```

Codex 會自動照著 repo 裡的 `skills/woomin-platform-ops/SKILL.md` 執行以下流程，你不用懂細節：

1. 檢查目前狀態（有沒有未提交的修改）
2. 從我們的官方版本（vendor upstream）拉最新更新，建一個獨立的「升級分支」
3. **檢查有沒有衝突**（你自己改過的地方 跟 我們的更新 是否剛好動到同一段）
4. **檢查資料庫是否需要跟著更新**（migration）
5. 全部沒問題才會正式套用並上線；有問題會停下來，不會硬套

## 情境 B：你沒有 Codex，想自己手動做

```bash
# 只需要做一次：把我們的官方 repo 設成 upstream
git remote add upstream https://github.com/woomini-flow/woomin.git

# 之後每次更新，做這幾步
git fetch upstream main
git checkout -b upgrade-$(date +%Y%m%d)
git merge upstream/main
```

- 如果 `git merge` 沒有跳出任何錯誤 → 代表沒有衝突，可以直接：
  ```bash
  git checkout main
  git merge upgrade-YYYYMMDD
  git push origin main
  ```
- 如果跳出 `CONFLICT` → 見下面「如果真的遇到衝突」。

## 如果真的遇到衝突，會發生什麼事？

**不會自動洗掉你的東西。** 這是刻意設計的安全機制：

- 更新過程會先在一個獨立的「升級分支」上進行，不會直接動到正式站在跑的版本
- 如果你自己改過的檔案，剛好跟我們更新的地方重疊，流程會**停在這裡**，列出哪些檔案有衝突
- 你（或你的 Codex）看過衝突內容、決定要保留哪一邊之後，才會繼續合併、上線
- 沒解決衝突之前，正式站繼續跑原本的舊版本，不會中斷

## 更新完成後，怎麼確認真的生效？

1. 打開你的網站首頁，確認可以正常瀏覽
2. 打開 `你的網域/api/version`，會看到類似：
   ```json
   {"commit":"e2c33f3cb82604680aaa9c2e06b66ca4e71f4b22"}
   ```
   這串代碼要跟我們通知你的最新版本代碼一致，就代表更新成功上線了

## 什麼時候要更新？

我們發布新功能或修 bug 時會通知你。你（或你的 Codex）收到通知後，用上面情境 A 或 B 的方式更新即可，不用等我們主動幫你操作——因為你的 repository 是你自己的，我們不會直接動它。
