# Phase 0 Build Prompt — Accessibility CI/CD Platform Scaffold

> **How to use this document:** This is a complete, self-contained engineering prompt. Paste it into Claude Code (or any coding agent) as-is to generate the Phase 0 scaffold, or hand it to a human engineer as a spec. It defines _what_ to build, _how_ it must be structured, and _what "done" looks like_ — it does not need clarification to start.

---

## 0. Role & Operating Principles

You are a senior full-stack/platform engineer building the foundational scaffold for a production system. Apply these principles to every file you generate, without exception:

- **SOLID principles** — single responsibility per module/class, dependency inversion via interfaces, no god-objects.
- **Separation of concerns** — HTTP layer, business logic, and data access must never be mixed in one file.
- **Clean, typed, explicit code** — no `any` in TypeScript, no implicit fallthrough, no magic strings/numbers (use enums/constants).
- **Fail loudly, fail safely** — validate inputs at boundaries, never swallow errors silently, always return typed error responses.
- **Security by default** — least-privilege, secrets never in code or logs, input validation on every external boundary.
- **No premature optimization, no premature abstraction** — build the simplest correct thing that fits the architecture; don't add config knobs or plugin systems nobody asked for yet.
- **Every module must be independently testable** — no hidden global state, dependencies injected not imported-and-instantiated inline.
- **Everything must run identically for every engineer** — no "works on my machine"; Docker Compose is the source of truth for local environment parity.

Do not just write code — explain your directory choices in a short comment block at the top of non-obvious config files, and produce a `SETUP.md` a new engineer can follow with zero prior context.

---

## 1. Objective

Produce a complete, runnable **Phase 0 scaffold** for the Accessibility CI/CD Platform monorepo: project structure, local infrastructure (Docker Compose), database schema + migrations, GitHub App registration scaffolding, CI pipeline, linting/formatting/type-checking, testing harness, and editor configuration (VS Code). No feature logic (scanning, webhooks, dashboard pages) is built in this phase — this is the foundation everything else attaches to.

**Definition of Done for Phase 0:**

- [ ] `pnpm install && docker compose up -d && pnpm dev` works from a clean clone with zero manual steps beyond copying `.env.example` → `.env`
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass and are wired into CI
- [ ] Prisma schema applies cleanly to a fresh Postgres instance via `pnpm db:migrate`
- [ ] A sample unit test and a sample integration test both run and pass, demonstrating the testing pattern for future contributors
- [ ] VS Code opens the repo with correct formatting, linting, and debugging working out of the box for every contributor without per-machine setup
- [ ] No secret, credential, or private key exists anywhere in git history or tracked files
- [ ] `SETUP.md` lets a new engineer go from `git clone` to a running local stack in under 10 minutes

---

## 2. Monorepo Structure

Use **pnpm workspaces + Turborepo** (build/test/lint task orchestration and caching). Generate this exact structure with real, working config files — not placeholders:

```
a11y-guard/
├── apps/
│   ├── web/                       # Next.js dashboard (App Router, TS) — scaffold only, "Hello" page
│   ├── github-app-service/        # Express/Fastify service — scaffold only, healthz route
│   ├── api/                       # Core REST API — scaffold only, healthz + readyz routes
│   └── scan-worker/                # Worker process — scaffold only, BullMQ consumer stub
├── packages/
│   ├── db/                         # Prisma schema, migrations, generated client, seed script
│   ├── shared-types/                # Shared TS interfaces (Scan, Violation, Repository, etc.)
│   ├── config/                      # Shared eslint-config, tsconfig base, prettier config
│   └── logger/                      # Shared structured logging wrapper (pino), used by all apps
├── infra/
│   ├── docker/                       # Per-service Dockerfiles
│   └── docker-compose.yml
├── .github/
│   ├── workflows/ci.yml
│   └── dependabot.yml
├── .vscode/
│   ├── settings.json
│   ├── extensions.json
│   └── launch.json
├── .env.example
├── .gitignore
├── .eslintrc.cjs (or eslint.config.js — flat config)
├── .prettierrc
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── SETUP.md
└── README.md
```

**Rules:**

- Every `apps/*` package depends on `packages/shared-types`, `packages/config`, and `packages/logger` — never duplicates types or logging setup.
- Every `package.json` in `apps/*` and `packages/*` has consistent `scripts`: `dev`, `build`, `lint`, `typecheck`, `test`.
- Root `turbo.json` defines the task graph so `pnpm build` builds `packages/*` before `apps/*` that depend on them, and caches unchanged tasks.

---

## 3. Local Infrastructure — Docker Compose

Generate `infra/docker-compose.yml` providing:

| Service                  | Image                | Purpose                                        | Notes                                                                    |
| ------------------------ | -------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| `postgres`               | `postgres:16-alpine` | Primary datastore                              | Named volume for persistence; healthcheck                                |
| `redis`                  | `redis:7-alpine`     | BullMQ queue + token cache                     | Healthcheck                                                              |
| `minio`                  | `minio/minio`        | S3-compatible local object storage             | Auto-create the artifacts bucket on startup via an init container/script |
| `mailhog` (or `maildev`) | `mailhog/mailhog`    | Catch outbound emails locally, no real sending | Web UI on a mapped port                                                  |

**Requirements:**

- All services use named volumes (not bind mounts to arbitrary host paths) for data persistence.
- All services define `healthcheck` blocks; the app services (when added later) should be able to `depends_on: condition: service_healthy`.
- No hardcoded credentials — all via `.env` referenced with `${VAR}` interpolation, with safe non-production defaults in `.env.example`.
- Expose only the ports actually needed locally; document each port's purpose in a comment.
- Include a `docker-compose.override.yml.example` pattern note in `SETUP.md` for engineers who want to customize ports without touching the committed file.

---

## 4. Environment & Secrets Handling

- `.env.example` lists every required variable with a **safe placeholder value and a comment describing what it's for** — never a real secret.
- `.env` is git-ignored; verify `.gitignore` covers `.env`, `.env.local`, `*.pem`, `*.key`, `node_modules`, `dist`, `.turbo`, coverage output.
- Add a `packages/config/src/env.ts` module that validates `process.env` at startup using a schema library (e.g., `zod`) and **throws immediately with a clear error listing every missing/invalid variable** if validation fails — never let the app start with silently-undefined config.
- Document in `SETUP.md`: where to get a GitHub App private key for local dev, and that it must never be committed (store as `github-app-private-key.pem` at repo root, already `.gitignore`d, referenced by path in `.env`).

---

## 5. Database Layer (`packages/db`)

- Initialize Prisma with the schema from the platform's PRD (organizations, users, organization_members, installations, repositories, pull_requests, scans, scan_pages, violations, custom_rules, integrations, audit_logs).
- Generate the initial migration (`pnpm db:migrate:dev`) and commit the migration SQL — migrations must be reproducible, not generated ad hoc on every machine.
- Add a `seed.ts` script producing minimal realistic fixture data (one org, one user, one repo, one scan with two violations) for local development and integration tests.
- Export a single, shared, lazily-instantiated `PrismaClient` singleton from `packages/db/src/client.ts` — every app imports this, none instantiate their own client (prevents connection pool exhaustion).
- Add a `pnpm db:studio` script (Prisma Studio) for local data inspection.

---

## 6. Shared Packages

### `packages/shared-types`

- TypeScript interfaces mirroring the DB schema plus API DTOs (e.g., `ScanResponseDto`, `ViolationDto`). No runtime code — types only, so it can be imported by frontend and backend without pulling in server dependencies.

### `packages/logger`

- A thin wrapper around `pino` exporting a `createLogger(serviceName: string)` factory.
- Structured JSON logs in production, pretty-printed in development (detect via `NODE_ENV`).
- Must support child loggers with request-scoped context (e.g., `requestId`, `orgId`) for traceability — this is what makes distributed debugging possible later; build the hook now even though tracing itself comes later.

### `packages/config`

- Shared `tsconfig.base.json` (strict mode: `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`).
- Shared ESLint flat config: TypeScript rules, import ordering, no-unused-vars as error, no-floating-promises as error (critical for a queue/async-heavy codebase).
- Shared Prettier config (single quotes, trailing commas, 100-char line width — or your team's preference, but must be consistent and documented).

---

## 7. Application Scaffolds (Phase 0 = skeleton only)

Each `apps/*` service should be a **minimal, real, runnable service** — not a stub that just prints "TODO":

- **`apps/api`**: Express or Fastify app with `/api/v1/healthz` (returns 200 immediately) and `/api/v1/readyz` (checks DB + Redis connectivity, returns 503 if either is down). Includes a global error-handling middleware that catches unhandled errors, logs them via `packages/logger`, and returns a consistent JSON error shape (`{ error: { code, message } }`) — never leaks stack traces to the client in production.
- **`apps/github-app-service`**: Same health endpoints; a `src/webhooks/router.ts` file with the route registered but returning `501 Not Implemented` for now (this is Phase 1 work) — the point of Phase 0 is that the service boots, is containerized, and is wired into CI/Docker Compose correctly.
- **`apps/scan-worker`**: A BullMQ worker process that connects to Redis, registers a listener on a `scan-jobs` queue, and logs "worker ready" — no scanning logic yet.
- **`apps/web`**: Next.js App Router project with one page confirming the app boots and a placeholder layout — no dashboard features, no CSS framework setup yet (styling is a later phase's concern).

Every service must:

- Read config via the validated `env.ts` module (Section 4) — no raw `process.env.X` scattered in business code.
- Use the shared logger — no `console.log` in application code.
- Have a `Dockerfile` using multi-stage builds (deps → build → slim runtime image), running as a **non-root user**, with a `HEALTHCHECK` instruction.

---

## 8. GitHub App Registration (Manual Step + Scaffolding)

Since App registration itself is a manual step in the GitHub UI, generate:

- `SETUP.md` section walking through: creating a GitHub App in a personal/dev GitHub account, setting permissions (Pull requests: R/W, Checks: R/W, Contents: R, Metadata: R, Deployments: R optional), subscribing to webhook events (`pull_request`, `push`, `deployment_status`, `installation`), generating a private key, and where to place it locally.
- A `scripts/verify-github-app-config.ts` utility that reads the configured App ID/private key from env and calls GitHub's API to confirm the App identity resolves correctly — gives immediate, actionable feedback instead of a cryptic failure three steps later during actual webhook development.

---

## 9. Testing Setup (Full Guide)

Use **Vitest** (faster, native ESM/TS support, Jest-compatible API) across all packages.

### Structure

```
apps/api/
  src/
    services/
      scan.service.ts
      scan.service.test.ts        # co-located unit tests
  test/
    integration/
      healthz.integration.test.ts  # spins up app + real Postgres via testcontainers
```

### Requirements

- **Unit tests**: co-located next to the code they test (`*.test.ts` beside `*.ts`), no network/DB access, all dependencies mocked/injected.
- **Integration tests**: live in a `test/integration` folder per app, use `testcontainers` (or the running Docker Compose stack) to talk to a real Postgres/Redis instance — never mock the database in integration tests, that defeats their purpose.
- Root `vitest.config.ts` (or per-package configs extending a shared base) with coverage via `v8`, threshold gates set at **80% lines/branches on `packages/db` and any `services/` folder** (business logic), lower/no threshold on scaffolding code.
- A sample unit test (e.g., testing the env validation schema rejects missing vars) and a sample integration test (e.g., `readyz` returns 503 when Postgres is unreachable) must exist and pass — these serve as the pattern template for every future contributor.
- `pnpm test`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:coverage` scripts at the root, orchestrated via Turborepo so only affected packages re-run on `pnpm test --filter=...`.
- Integration tests must clean up after themselves (transactional rollback or truncate-between-tests) — no test should depend on execution order or leave dirty state for the next run.

---

## 10. CI Pipeline (`.github/workflows/ci.yml`)

On every PR and push to `main`:

1. Checkout, setup Node (pinned version, e.g., 20.x), setup pnpm, restore cache.
2. `pnpm install --frozen-lockfile` (never allow lockfile drift in CI).
3. `pnpm lint` — fail the build on any lint error (not just warnings-as-info).
4. `pnpm typecheck` — `tsc --noEmit` across the workspace.
5. Spin up Postgres + Redis as CI service containers (or use testcontainers directly).
6. `pnpm test:unit`
7. `pnpm test:integration` against the service containers.
8. `pnpm build` — confirm every app builds successfully.
9. Upload coverage report as a build artifact; optionally fail if coverage drops below the configured threshold.

Also add `.github/dependabot.yml` for weekly npm dependency update PRs and a basic `.github/workflows/codeql.yml` (or equivalent SAST) for security scanning — set up now, even though it runs quietly in the background until it finds something.

---

## 11. Git Hooks — Husky + lint-staged

Local safety net so broken/unformatted code never reaches CI in the first place:

- Install **Husky** (`pnpm dlx husky init`) and **lint-staged**.
- `.husky/pre-commit` → runs `pnpm lint-staged` (formats + lints only staged files — fast, doesn't re-check the whole repo).
- `.husky/commit-msg` → runs `commitlint` against Conventional Commits format (`feat:`, `fix:`, `chore:`, etc.) so history stays readable and changelogs can eventually be automated.
- `.husky/pre-push` → runs `pnpm typecheck` (and optionally `pnpm test:unit`) so type errors and broken unit tests can't be pushed, without slowing down every single commit.
- Root `package.json` `lint-staged` config:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  }
}
```

- Document in `SETUP.md` that hooks install automatically via the `"prepare": "husky"` script in `package.json` on `pnpm install` — no manual setup step for new contributors.
- Add hook bypass guidance (`git commit --no-verify`) as an escape hatch only, not a documented workflow.

---

## 12. VS Code Configuration

### `.vscode/settings.json`

Must enforce, for every contributor automatically on file open/save, without any local override needed:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.eol": "\n",
  "files.insertFinalNewline": true,
  "files.trimTrailingWhitespace": true,
  "files.exclude": {
    "**/node_modules": true,
    "**/.turbo": true,
    "**/dist": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true
  },
  "eslint.workingDirectories": [{ "mode": "auto" }],
  "[typescript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[typescriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[json]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[prisma]": { "editor.defaultFormatter": "Prisma.prisma" }
}
```

### `.vscode/extensions.json`

Recommend (not force) the tools that make the settings above actually work:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "ms-azuretools.vscode-docker",
    "orta.vscode-vitest-explorer",
    "eamodio.gitlens",
    "christian-kohler.path-intellisense",
    "usernamehw.errorlens"
  ]
}
```

### `.vscode/launch.json`

Provide working debug configurations (not placeholders) for:

- Attaching the debugger to `apps/api` in watch mode (Node `--inspect`).
- Attaching to `apps/scan-worker`.
- Running the currently open Vitest file under the debugger.
- Debugging `apps/web` (Next.js) via the browser debugger.

Explain in a comment at the top of `launch.json` how each config maps to an npm script, so an engineer never has to guess what "Debug API" actually launches.

---

## 13. Security Baseline (apply now, not later)

- `npm audit` / `pnpm audit` runs in CI; document the policy for handling findings (fix critical/high before merge, track moderate/low in a backlog issue).
- No `eval`, no dynamic `require`/`import` of user-controlled strings anywhere in scaffolding code.
- CORS configured explicitly (allow-list, not `*`) even on the placeholder API, so nobody has to remember to lock it down later.
- Helmet (or equivalent) middleware applied to `apps/api` and `apps/github-app-service` from day one (sensible default security headers).
- Rate-limiting middleware stubbed in (even with generous limits) on public-facing routes, so the pattern exists before it's urgently needed.
- Document in `SETUP.md`: never commit `.env`, the GitHub App private key, or any `*.pem`/`*.key` file — and confirm `git log --all --full-history -- '*.pem'` returns nothing before first push.

---

## 14. Deliverables Checklist (what the agent must actually produce)

- [ ] Full folder structure per Section 2, every file real and functioning (no `// TODO: implement later` where actual scaffolding logic was requested)
- [ ] `docker-compose.yml` — `docker compose up -d` brings up Postgres, Redis, MinIO, Mailhog, all healthy
- [ ] Prisma schema + first migration + seed script, `pnpm db:migrate` and `pnpm db:seed` both work
- [ ] All four `apps/*` boot successfully with `pnpm dev` (via Turborepo parallel dev script) and respond to health checks
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all pass cleanly from a fresh clone
- [ ] Husky + lint-staged installed, pre-commit/commit-msg/pre-push hooks working (verify a bad commit is actually blocked)
- [ ] `.vscode/settings.json`, `extensions.json`, `launch.json` present and correct
- [ ] `.github/workflows/ci.yml` runs all of the above in CI and passes
- [ ] `SETUP.md` written for a zero-context new engineer, verified step-by-step
- [ ] No secrets anywhere in git history

---

## 15. Explicit Non-Goals for This Phase

Do **not** build in Phase 0 (these belong to Phase 1+, per the roadmap):

- Webhook handling logic, scan execution, axe-core/Playwright/Lighthouse integration
- Any dashboard UI beyond a boot-confirmation page
- Authentication/authorization logic (beyond validating that env vars for it exist)
- Notification integrations (Slack/Jira/Email) beyond having Mailhog available locally
- Kubernetes/Terraform (local Docker Compose only for now)

Keep Phase 0 strictly to: repo skeleton, infra, DB schema, CI, testing harness, editor config, and security baseline. Anything beyond this scope should be flagged back to the requester rather than silently built.
