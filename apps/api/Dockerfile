# Multi-stage Dockerfile for apps/api
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @a11y-guard/db build
RUN pnpm --filter @a11y-guard/api build

FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

COPY --chown=appuser:nodejs --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --chown=appuser:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=appuser:nodejs --from=builder /app/apps/api /app/apps/api
COPY --chown=appuser:nodejs --from=builder /app/packages /app/packages

USER appuser

EXPOSE 3001
ENV PORT=3001
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/v1/healthz || exit 1

CMD ["node", "apps/api/dist/index.js"]
