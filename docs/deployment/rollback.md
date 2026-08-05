# Rollback：可逆回復

回滾只使用 Git revert 或重新部署已驗證的舊 commit。保留原 production commit、upgrade branch、deployment ID 與 rollback action；health gates 通過前不得清理舊 deployment。

```bash
git revert <bad-commit>
git push origin "${DEPLOY_BRANCH:-main}"
```

禁止因部署失敗刪除 PostgreSQL、persistent volume、上傳檔案或 domain。migration 若已執行，先查看 migration 相容性與人工 rollback 計畫，再決定是否繼續。
