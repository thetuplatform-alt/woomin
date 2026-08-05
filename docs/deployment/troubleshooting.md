# Troubleshooting

| 症狀 | 分類 | 下一步 |
| --- | --- | --- |
| `HasK3s=false` 或預期服務數為 0 | 主機 | 更新 ZeaburOS，確認 k3s active 後重跑 preflight |
| `DATABASE_URL` missing／migration 失敗 | database | 檢查 reference variable 與 database pod；不要把密碼貼到 log |
| runtime module、Prisma 或 script missing | build/runtime | 檢查 Dockerfile runtime dependency closure 與 startup log |
| 502、port mismatch | HTTP/runtime | 確認 `0.0.0.0:8080`、pod readiness 與 external HTTPS |
| `/api/version` 為空、`unknown` 或 `fatal:` | commit propagation | 重跑帶完整 `GIT_COMMIT_SHA` 的 build |
| `.git` 不存在 | build context | 不在 container 內執行 `git rev-parse`，使用 build/runtime SHA |
| domain 非 2xx | domain/HTTP | 確認 domain 指向 customer app service 與 TLS 狀態 |
| cron 401/403 | cron | 比對 worker 與 app 的 `CRON_SECRET`，只顯示 status code |
| optional provider 未設定 | optional | 標為 non-blocking；核心 health gates 仍須全部通過 |

診斷只收集 `git status`、deployment status、safe logs、HTTP status 與變數名稱；禁止輸出 secret 值。無法判定時保留 state file 的 `failedStep`、`reason`、resource IDs 與 `resumeAction`。
