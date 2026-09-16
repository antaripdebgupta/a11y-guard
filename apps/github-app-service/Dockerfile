# Multi-stage Dockerfile for apps/github-app-service
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @a11y-guard/db build
RUN pnpm --filter @a11y-guard/github-app-service build

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/github-app-service /app/apps/github-app-service
COPY --from=builder /app/packages /app/packages

USER appuser

EXPOSE 3001
ENV PORT=3001
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/v1/healthz || exit 1

CMD ["node", "apps/github-app-service/dist/index.js"]
