# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:22.23.3-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c

FROM ${NODE_IMAGE} AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /runner

COPY ops/migration-runner/package.json ops/migration-runner/pnpm-lock.yaml ops/migration-runner/pnpm-workspace.yaml ./
RUN corepack enable \
    && corepack prepare pnpm@11.19.0 --activate \
    && pnpm install --prod --frozen-lockfile

RUN test -x /runner/node_modules/.pnpm/@prisma+engines@7.2.0/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x \
    && /runner/node_modules/.pnpm/@prisma+engines@7.2.0/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x --version

COPY ops/migration-runner/prisma.config.ts ./prisma.config.ts
COPY ops/migration-runner/metadata.json ./metadata.json
COPY ops/migration-runner/verify-source.mjs ./verify-source.mjs
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations

RUN node ./verify-source.mjs

FROM ${NODE_IMAGE} AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /runner

ENV NODE_ENV=production
ENV PATH=/runner/node_modules/.bin:${PATH}

LABEL org.opencontainers.image.title="BestAppStore Phase 2 migration-only runner" \
      org.opencontainers.image.revision="0e3187bc8fd8507e827919ea39d30b7d3d7e0c89" \
      bestappstore.migration.target="20260918090000_add_bestappstore_services_tools_entitlements" \
      bestappstore.migration.target-sha256="fa9a81460a15b6a2eeb62f5efc910805ef2c92f294f0989e00e910fe629f124a" \
      bestappstore.migration.manifest-sha256="8a0cceea1fab378f00633e094471b5a2af00740a4827e9978b6b137407b4fe14"

COPY --from=build --chown=node:node /runner/node_modules ./node_modules
COPY --from=build --chown=node:node /runner/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=node:node /runner/metadata.json ./metadata.json
COPY --from=build --chown=node:node /runner/prisma ./prisma

USER node

# Keep the temporary service available for explicitly approved Execute Commands.
# Container startup never reads DATABASE_URL and never runs Prisma.
CMD ["node", "-e", "process.title='bestappstore-migration-runner-idle'; setInterval(() => {}, 2147483647)"]
