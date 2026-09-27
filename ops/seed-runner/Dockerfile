# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:22.23.3-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c

FROM ${NODE_IMAGE} AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /runner

COPY ops/seed-runner/package.json ops/seed-runner/pnpm-lock.yaml ops/seed-runner/pnpm-workspace.yaml ./
RUN corepack enable \
    && corepack prepare pnpm@11.19.0 --activate \
    && pnpm install --frozen-lockfile

COPY ops/seed-runner/tsconfig.json ./tsconfig.json
COPY ops/seed-runner/prisma.config.ts ./prisma.config.ts
COPY ops/seed-runner/metadata.json ./metadata.json
COPY ops/seed-runner/verify-source.mjs ./verify-source.mjs
COPY ops/seed-runner/seed-entry.mjs ./seed-entry.mjs
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY scripts/seed-bestappstore.ts ./scripts/seed-bestappstore.ts
COPY lib/lumi-seed-data.ts ./lib/lumi-seed-data.ts
COPY lib/prisma.ts ./lib/prisma.ts

RUN node ./verify-source.mjs
RUN pnpm exec prisma generate --config ./prisma.config.ts
RUN pnpm exec tsc --project ./tsconfig.json
RUN test -f ./dist/scripts/seed-bestappstore.js \
    && pnpm prune --prod \
    && test ! -e ./node_modules/.bin/prisma \
    && test ! -e ./node_modules/prisma

FROM ${NODE_IMAGE} AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /runner

ENV NODE_ENV=production

LABEL org.opencontainers.image.title="BestAppStore Phase 2 seed-only runner" \
      org.opencontainers.image.revision="0e3187bc8fd8507e827919ea39d30b7d3d7e0c89" \
      bestappstore.seed.script-blob="297aff74940c4780cc117fcf339d47a9e08c3045" \
      bestappstore.seed.data-blob="14d024e2864361cdaededc8fca2b11afec2e1520" \
      bestappstore.seed.tool-slug-manifest-sha256="d670aed89e4e4a7fcdf75a59de29fc9d5586b3156afb87815b9484bb61493521"

COPY --from=build --chown=node:node /runner/node_modules ./node_modules
COPY --from=build --chown=node:node /runner/dist ./dist
COPY --from=build --chown=node:node /runner/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=build --chown=node:node /runner/metadata.json ./metadata.json
COPY --from=build --chown=node:node /runner/seed-entry.mjs ./seed-entry.mjs

USER node

# Keep the temporary service idle. The seed is run only through a separately
# approved manual command: node ./dist/scripts/seed-bestappstore.js
CMD ["node", "./seed-entry.mjs"]
