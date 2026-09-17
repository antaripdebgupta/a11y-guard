# a11y-guard — Setup Guide

> **Audience**: New engineers going from `git clone` to a running local stack.
> **Time commitment**: Under 10 minutes.

---

## Prerequisites

| Tool           | Minimum Version | Install                                                |
| -------------- | --------------- | ------------------------------------------------------ |
| Node.js        | 20.x            | [nodejs.org](https://nodejs.org/)                      |
| pnpm           | 9.x+            | `corepack enable` (ships with Node 20)                 |
| Docker         | 24+             | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Docker Compose | v2+             | Bundled with Docker Desktop                            |

---

## Quick Start (5 steps)

```bash
# 1. Clone the repository
git clone <REPO_URL> && cd a11y-guard

# 2. Copy environment template
cp .env.example .env

# 3. Install dependencies (also sets up Husky git hooks via `prepare` script)
pnpm install

# 4. Start everything — infra + all app services (API, Web, GitHub App, Scan Worker)
docker compose -f infra/docker-compose.yml up -d --build

# 5. Run database migrations and seed data
pnpm db:migrate
pnpm db:seed
```

You're done. All services are running via Docker Compose — no need to run `pnpm dev` separately.

Verify everything works:

```bash
curl http://localhost:3000          # Web dashboard
curl http://localhost:3001/api/v1/healthz  # API
curl http://localhost:3002/api/v1/healthz  # GitHub App Service
```

> **💡 Prefer hot-reloading during development?** You can still use `pnpm dev` (Turborepo)
> instead of Docker for the app services while keeping the infra containers running.

Other useful commands:

```bash
pnpm lint        # ESLint across workspace
pnpm typecheck   # tsc --noEmit across workspace
pnpm test        # Vitest unit + integration tests
pnpm build       # Full production build
```

---

## Service Ports

| Service            | URL                     | Purpose                                             |
| ------------------ | ----------------------- | --------------------------------------------------- |
| API                | `http://localhost:3001` | Core REST API (`/api/v1/healthz`, `/api/v1/readyz`) |
| GitHub App Service | `http://localhost:3002` | GitHub webhook receiver                             |
| Web Dashboard      | `http://localhost:3000` | Next.js dashboard                                   |
| PostgreSQL         | `localhost:5432`        | Primary database                                    |
| Redis              | `localhost:6379`        | Cache & BullMQ queue                                |
| MinIO Console      | `http://localhost:9001` | S3-compatible object storage UI                     |
| Mailhog UI         | `http://localhost:8025` | Email catch-all web UI                              |

---

## Database Commands

```bash
pnpm db:migrate      # Apply migrations (prisma migrate deploy)
pnpm db:migrate:dev  # Create new migration (prisma migrate dev)
pnpm db:seed         # Seed fixture data
pnpm db:studio       # Open Prisma Studio GUI
pnpm db:generate     # Regenerate Prisma Client
```

---

## GitHub App Setup (Local Development)

1. Go to **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**.
2. Set the following:
   - **App Name**: `a11y-guard-dev-<your-username>`
   - **Homepage URL**: `http://localhost:3000`
   - **Webhook URL**: `http://localhost:3002/api/v1/webhooks/github` (use [smee.io](https://smee.io) or ngrok for local forwarding)
3. Set **Permissions**:
   - Pull requests: Read & Write
   - Checks: Read & Write
   - Contents: Read
   - Metadata: Read
   - Deployments: Read (optional)
4. Subscribe to **Webhook Events**:
   - `pull_request`
   - `push`
   - `deployment_status`
   - `installation`
5. After creation, generate a **Private Key** (`.pem` file).
6. Place the downloaded `.pem` file at the repo root as `github-app-private-key.pem`.
7. Update `.env` with your App ID:
   ```
   GITHUB_APP_ID="<your-app-id>"
   GITHUB_APP_PRIVATE_KEY_PATH="./github-app-private-key.pem"
   ```
8. Verify config: `pnpm tsx scripts/verify-github-app-config.ts`

> **⚠️ NEVER commit `.env`, `github-app-private-key.pem`, or any `*.pem`/`*.key` file.**
> These are already in `.gitignore`. Confirm with:
>
> ```bash
> git log --all --full-history -- '*.pem'  # Must return nothing
> ```

---

## Docker Compose Customization

If you need to override ports or add services without modifying the committed file, create `infra/docker-compose.override.yml`:

```yaml
services:
  postgres:
    ports:
      - '5433:5432' # Use a different host port
```

Docker Compose automatically merges `docker-compose.yml` and `docker-compose.override.yml`.

---

## Git Hooks (Husky)

Hooks are installed automatically via the `prepare` script on `pnpm install`:

| Hook         | What it does                                                                 |
| ------------ | ---------------------------------------------------------------------------- |
| `pre-commit` | Runs `lint-staged` (ESLint fix + Prettier on staged files)                   |
| `commit-msg` | Enforces [Conventional Commits](https://www.conventionalcommits.org/) format |
| `pre-push`   | Runs `pnpm typecheck` to prevent type errors from being pushed               |

**Emergency bypass** (use sparingly): `git commit --no-verify`

---

## Testing

```bash
pnpm test              # All tests
pnpm test:unit         # Unit tests only (co-located *.test.ts files)
pnpm test:integration  # Integration tests only (test/integration/ folders)
pnpm test:coverage     # Tests with v8 coverage report
```

- **Unit tests**: Co-located next to source files (`*.test.ts`), no network/DB access.
- **Integration tests**: In `test/integration/` folders, use real Postgres/Redis.

---

## VS Code

Required extensions are auto-recommended on first open. Accept the prompt to install:

- ESLint, Prettier, Prisma, Docker, Vitest Explorer, GitLens, Path Intellisense, Error Lens

Formatting, linting, and import ordering run automatically on file save.

---

## Security Policy

- `pnpm audit` runs in CI. Fix critical/high findings before merging. Track moderate/low in backlog.
- CORS is explicitly configured (allow-list, not `*`).
- Helmet security headers are applied to all HTTP services.
- Rate limiting is active on public-facing routes.
- No `eval()` or dynamic `require()`/`import()` of user-controlled strings.
