# Verification：健康門檻

「服務顯示 Running」不是完成條件。依序記錄 stage 與結果：

1. ZeaburOS/k3s ready、database Running、pod `1/1`。
2. migration 完成且 runtime dependencies 可載入。
3. container 內 `8080` 與外部 HTTPS 回應成功。
4. 首頁 HTTP 200；`/api/version` HTTP 200 且 SHA 等於部署 commit，不能是空值、`unknown` 或 `fatal:`。
5. `/data` marker 寫入後重啟仍存在。
6. 五個核心 cron routes 皆 2xx；optional provider-not-configured 不得掩蓋核心失敗。

自動化執行：

```bash
GIT_COMMIT_SHA=<sha> ZEABUR_DOMAIN=https://<domain> \
GATE_MIGRATION=passed GATE_POD_READINESS=passed GATE_IN_CONTAINER_8080=passed \
GATE_EXTERNAL_HTTPS=passed GATE_VERSION_SHA=passed GATE_DATA_MOUNT=passed \
GATE_RESTART_MARKER=passed GATE_CRON_ROUTES=passed ./deploy/zeabur/health-gates.sh
```

`check-runtime-closure.sh` 必須在 image promotion 前通過，確認 Prisma adapter、`zod`、`dotenv`、`pg`、migration script 與 Dockerfile runtime closure 存在。

失敗輸出需包含 customer target、stage、expected SHA、deployment ID（若有）與安全下一步，不得包含 token、密碼、connection string 或 secret 值。
