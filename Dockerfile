FROM node:22-slim AS deps
WORKDIR /src
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --ignore-scripts
RUN pnpm rebuild @prisma/engines prisma sharp protobufjs

FROM node:22-slim AS builder
WORKDIR /src
ENV NEXT_TELEMETRY_DISABLED=1
# node:22-slim 沒有內建 git;要在這個階段跑 git rev-parse 取得 commit SHA
# (見下方 GIT_COMMIT_SHA 那段)必須明確安裝。
RUN apt-get update -y && apt-get install -y openssl git && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm
COPY --from=deps /src/node_modules ./node_modules
COPY . .
# 建置期把 git commit SHA 寫入檔案,供 /api/version 端點回報正式站實際
# 執行的版本(見 openspec/changes/fix-zeabur-deploy-target-mismatch/design.md)。
# .git 不會進到最終 runner 映像檔,只在這個中繼 builder 階段短暫存在。
# 之前兩次嘗試都得到 fallback 的 "unknown"(已用實際 shell 進運作中容器
# cat 這個檔案確認過,不是憑空猜測):node:22-slim 沒裝 git(上面已補),
# 且容器內 UID 跟 COPY 進來的檔案擁有者不同時 git 會拒絕操作(dubious
# ownership),用 safe.directory 例外排除。`2>&1 || true`是為了這一版
# 如果還有問題,把實際錯誤訊息存進檔案而不是吞掉,方便下一輪直接看原因。
RUN git config --global --add safe.directory /src; \
  git rev-parse HEAD > /src/GIT_COMMIT_SHA 2>&1 || true
RUN npx prisma generate
RUN pnpm exec next build
# Assemble a self-contained Prisma CLI for the standalone runner. pnpm nests
# @prisma/engines under .pnpm (not at top-level node_modules), so a plain copy
# misses it — install a clean, flat npm tree pinned to the project's prisma version.
# dotenv is required because prisma.config.ts loads it (the datasource URL is
# supplied via that config, not the schema), so it must resolve at migrate time.
# pg is required by scripts/prisma-migrate-deploy.cjs (the safe deploy wrapper) to
# introspect the database before deciding whether to baseline a legacy db-push DB.
RUN PV="$(node -p "require('/src/node_modules/prisma/package.json').version")" \
  && mkdir -p /prisma-cli && cd /prisma-cli \
  && npm init -y >/dev/null \
  && npm install "prisma@${PV}" dotenv pg --omit=dev --no-audit --no-fund

FROM node:22-slim AS runner
LABEL "language"="nodejs"
LABEL "framework"="next.js"
WORKDIR /src
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /src/.next/standalone ./
COPY --from=builder /src/.next/static ./.next/static
COPY --from=builder /src/public ./public
COPY --from=builder /src/GIT_COMMIT_SHA ./GIT_COMMIT_SHA
# Prisma migration assets (standalone output does not bundle the CLI/migrations).
# Kept in an isolated dir to avoid colliding with standalone's own @prisma symlinks.
COPY --from=builder /src/prisma ./prisma
COPY --from=builder /src/prisma.config.ts ./prisma.config.ts
# 安全部署封裝：啟動時自動 baseline「以 db push 建立、無 migration 歷史」的既有資料庫，
# 再 migrate deploy，避免升級到含 migrations 的版本時撞 P3005 而 crash-loop。
COPY --from=builder /src/scripts/prisma-migrate-deploy.cjs ./scripts/prisma-migrate-deploy.cjs
COPY --from=builder /prisma-cli ./prisma-cli
# dotenv also at /src/node_modules so prisma.config.ts resolves it relative to CWD
COPY --from=builder /prisma-cli/node_modules/dotenv ./node_modules/dotenv
EXPOSE 8080
# 以 NODE_PATH 提供隔離的 prisma CLI 與 pg 給封裝腳本；封裝內部會自行呼叫 prisma migrate deploy。
CMD ["sh", "-c", "NODE_PATH=/src/prisma-cli/node_modules node scripts/prisma-migrate-deploy.cjs && export PORT=\"${PORT:-8080}\" HOSTNAME=\"0.0.0.0\" && node server.js"]
