# a-data-agent

Monorepo for the **a-data-agent** project. The JS/TS workspace is managed
with pnpm; the Python backend lives next to it but is **not** part of the
monorepo.

## Layout

```
a-data-agent-monorepo/
├── apps/
│   └── web/                  # Next.js 16 web app (workspace package)
├── packages/
│   └── contracts/            # @a-data-agent/contracts — shared data structures
├── services/
│   └── a-data-agent/         # Python backend (NOT in the pnpm monorepo)
├── package.json              # Root workspace manifest
├── pnpm-workspace.yaml       # pnpm workspace globs
├── tsconfig.base.json        # Shared TS config extended by every JS/TS package
└── Makefile                  # Convenience commands for the Python service
```

### What is in the monorepo

- **`apps/web`** — the Next.js chat application. Calls
  `apps/web/app/api/query/route.ts` which proxies to the backend.
- **`packages/shared`** — `@a-data-agent/shared`. Shared TypeScript types
  (API contract, SSE events, chat types), constants (`AGENT_STEPS`),
  and utilities (`cn`, `parseSseStream`, `apiBaseUrl`). Used by every
  frontend app in the monorepo.

### What is outside the monorepo

- **`services/a-data-agent`** — the Python FastAPI service. It is a
  standalone project, developed and run independently of the JS workspace.
  Use the `Makefile` at the repo root (e.g. `make air-api`) to interact
  with it.

## Requirements

- Node.js `>= 20`
- pnpm `>= 10` (the repo pins `pnpm@10.33.0` via `packageManager`)

## Getting started

```bash
# Install all workspace dependencies
pnpm install

# Run every app in parallel
pnpm dev

# Run only the web app
pnpm --filter web dev
```

## Common commands

| Command                            | What it does                              |
| ---------------------------------- | ----------------------------------------- |
| `pnpm install`                     | Install all workspace dependencies        |
| `pnpm dev`                         | Run all apps in parallel                  |
| `pnpm build`                       | Build all workspace packages              |
| `pnpm lint`                        | Lint all workspace packages               |
| `pnpm typecheck`                   | Type-check all workspace packages         |
| `pnpm format`                      | Run Prettier across all packages          |
| `make air-api`                     | Run the Python backend (out of monorepo)  |

## Web app configuration

`apps/web` reads its backend URL from `AIR_API_BASE_URL` (see
`apps/web/.env.example`). Default is `http://localhost:8000`, which
matches `make air-api`.

## Adding a new workspace package

1. Create the directory under `apps/` or `packages/`.
2. Add a `package.json` with a unique name and `"private": true`.
3. The package is picked up automatically by `pnpm-workspace.yaml`.
4. To depend on it from another workspace package, use the
   `workspace:*` protocol and add the package to `transpilePackages`
   in `apps/web/next.config.ts` if it's consumed by the web app.
