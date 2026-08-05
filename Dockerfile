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
# `serverActions.allowedOrigins` 會在 next build 時寫入建置產物；Zeabur 必須把這兩項設為 build-time 變數。
ARG APP_URL
ARG NEXT_PUBLIC_APP_URL
ENV APP_URL=$APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN if [ -z "$APP_URL" ] && [ -z "$NEXT_PUBLIC_APP_URL" ]; then \
      echo '警告：APP_URL 未設定，Server Actions 的 origin 白名單可能為空。' >&2; \
      echo '警告：NEXT_PUBLIC_APP_URL 未設定，請在 Zeabur 設為 build-time 變數。' >&2; \
    fi
# The build context uploaded by Zeabur does not include .git. The deploy
# command supplies the local HEAD through the GIT_COMMIT_SHA build variable.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm
COPY --from=deps /src/node_modules ./node_modules
COPY . .
# Persist the verified source revision for /api/version; never write git
# diagnostics or a fallback error string into the public version endpoint.
ARG GIT_COMMIT_SHA=unknown
RUN printf '%s\n' "$GIT_COMMIT_SHA" > /src/GIT_COMMIT_SHA
RUN npx prisma generate
RUN pnpm exec next build
# Assemble a self-contained Prisma CLI for the standalone runner. pnpm nests
# @prisma/engines under .pnpm (not at top-level node_modules), so a plain copy
# misses it — install a clean, flat npm tree pinned to the project's prisma version.
# dotenv is required only so prisma.config.ts can resolve its import at migrate time;
# it does not make `.env` values available to the running application automatically.
# pg is required by scripts/prisma-migrate-deploy.cjs (the safe deploy wrapper) to
# introspect the database before deciding whether to baseline a legacy db-push DB.
RUN PV="$(node -p "require('/src/node_modules/prisma/package.json').version")" \
  && mkdir -p /prisma-cli && cd /prisma-cli \
  && npm init -y >/dev/null \
  && npm install "prisma@${PV}" dotenv pg --omit=dev --no-audit --no-fund
# 啟動期仍需執行原本 build script 內的資料庫同步腳本；用獨立 runtime CLI 避免把完整開發依賴帶進 runner。
# Runtime migration/upgrade scripts import the Prisma PostgreSQL adapter through
# /src/lib/prisma.ts. Keep it in the isolated runtime tree alongside tsx so the
# standalone image does not depend on pnpm's builder-only symlinks.
RUN npm install --prefix /runtime-cli tsx dotenv zod @prisma/adapter-pg --omit=dev --no-audit --no-fund

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
COPY --from=builder /runtime-cli ./runtime-cli
# 啟動期同步腳本以 tsx 執行，需保留其 TypeScript 原始碼與 tsconfig path 設定。
COPY --from=builder /src/scripts ./runtime-scripts
COPY --from=builder /src/lib ./lib
COPY --from=builder /src/tsconfig.json ./tsconfig.json
COPY --from=builder /src/next-env.d.ts ./next-env.d.ts
# dotenv also at /src/node_modules so prisma.config.ts resolves it relative to CWD
COPY --from=builder /prisma-cli/node_modules/dotenv ./node_modules/dotenv
# Some runtime TypeScript modules resolve validation imports from the runner's
# /src/node_modules path rather than NODE_PATH; copy this production dependency
# explicitly from the pnpm builder tree.
COPY --from=builder /src/node_modules/zod ./node_modules/zod
EXPOSE 8080
# 以 NODE_PATH 提供隔離的 prisma CLI 與 pg 給封裝腳本；其餘 SiteSetting 同步在啟動期執行，不再污染 build。
# Zeabur service variables are guaranteed at runtime, while Docker ARG
# propagation depends on the build method. Prefer the runtime value so the
# public version endpoint never falls back to `unknown`.
CMD ["sh", "-c", "if [ -n \"${GIT_COMMIT_SHA:-}\" ]; then printf '%s\\n' \"$GIT_COMMIT_SHA\" > /src/GIT_COMMIT_SHA; fi && NODE_PATH=/src/prisma-cli/node_modules node scripts/prisma-migrate-deploy.cjs && NODE_PATH=/src/runtime-cli/node_modules:/src/prisma-cli/node_modules /src/runtime-cli/node_modules/.bin/tsx /src/runtime-scripts/post-migrate-seamless-upgrade.ts && NODE_PATH=/src/runtime-cli/node_modules:/src/prisma-cli/node_modules /src/runtime-cli/node_modules/.bin/tsx /src/runtime-scripts/sync-cloudflare-stream-env-to-db.ts && NODE_PATH=/src/runtime-cli/node_modules:/src/prisma-cli/node_modules /src/runtime-cli/node_modules/.bin/tsx /src/runtime-scripts/sync-email-env-to-db.ts && export PORT=\"${PORT:-8080}\" HOSTNAME=\"0.0.0.0\" && node server.js"]
