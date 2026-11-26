# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS pnpm
# Keep in sync with "packageManager" in package.json.
RUN npm install -g pnpm@12.18.0

FROM pnpm AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM pnpm AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Dummy URL: src/db throws on import without one; nothing connects during the build.
RUN DATABASE_URL=postgres://build:build@127.0.0.1:5432/build pnpm build && pnpm build:migrate

FROM base AS runner
LABEL org.opencontainers.image.source="https://github.com/keytra-app/keytra" \
      org.opencontainers.image.description="Minimalist, self-hosted, open-source alternative to Crowdin." \
      org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/dist/migrate.mjs ./dist/migrate.mjs
COPY --chmod=755 docker-entrypoint.sh ./
# App files stay root-owned (read-only for the app); only the Next cache is writable.
RUN mkdir -p .next/cache && chown nextjs:nodejs .next/cache
USER nextjs
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
