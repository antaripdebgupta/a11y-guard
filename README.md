# a11y-guard — Accessibility CI/CD Platform

Automated accessibility scanning, reporting, and CI/CD gating for GitHub repositories.

## Overview

a11y-guard is a monorepo platform that integrates with GitHub as a GitHub App to automatically scan pull requests for accessibility violations (WCAG compliance). It provides a dashboard for tracking accessibility scores across repositories and enforces compliance gates in CI/CD pipelines.

## Architecture

```
apps/
  api/                    # Core REST API (Express)
  github-app-service/     # GitHub webhook receiver (Express)
  scan-worker/            # Background job processor (BullMQ)
  web/                    # Dashboard (Next.js App Router)

packages/
  db/                     # Prisma schema, migrations, client
  shared-types/           # TypeScript interfaces & DTOs
  config/                 # Shared environment validation (Zod)
  logger/                 # Structured logging wrapper (Pino)
```

## Getting Started

See [SETUP.md](./SETUP.md) for complete setup instructions.

```bash
cp .env.example .env
pnpm install
docker compose -f infra/docker-compose.yml up -d
pnpm db:migrate && pnpm db:seed
pnpm dev
```

## Development

| Command          | Description                            |
| ---------------- | -------------------------------------- |
| `pnpm dev`       | Start all services in development mode |
| `pnpm build`     | Build all packages and apps            |
| `pnpm lint`      | Lint entire workspace                  |
| `pnpm typecheck` | TypeScript type checking               |
| `pnpm test`      | Run all tests                          |
| `pnpm db:studio` | Open Prisma Studio                     |

## License

Private — All rights reserved.
test
