# Multi-stage Dockerfile for apps/scan-worker
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @a11y-guard/db build
RUN pnpm --filter @a11y-guard/scan-worker build

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

COPY --chown=appuser:nodejs --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --chown=appuser:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=appuser:nodejs --from=builder /app/apps/scan-worker /app/apps/scan-worker
COPY --chown=appuser:nodejs --from=builder /app/packages /app/packages

USER appuser

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

CMD ["node", "apps/scan-worker/dist/index.js"]
