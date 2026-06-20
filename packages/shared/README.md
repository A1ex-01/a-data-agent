# @a-data-agent/shared

Shared TypeScript types, constants, and utilities consumed by every frontend
app in the monorepo (`apps/web`, future `apps/admin`, …).

The Python backend under `services/a-data-agent` lives outside this monorepo
and is not a consumer of this package.

## Layout

```
packages/shared/src/
├── index.ts          # barrel — re-exports everything below
├── env.ts            # typed env-var access (API base URL, etc.)
├── types/
│   ├── index.ts
│   ├── api.ts        # request / response shapes for the backend
│   ├── events.ts     # SSE event discriminated union (agent → frontend)
│   ├── agent.ts      # agent step constants + status types
│   └── chat.ts       # ChatMessage, QueryStatus, UI helpers
└── lib/
    ├── index.ts
    ├── cn.ts         # className merger (clsx + tailwind-merge)
    ├── api.ts        # apiBaseUrl() — resolve AIR_API_BASE_URL
    └── sse.ts        # parseSseStream() — SSE → AsyncIterable<AgentEvent>
```

## What's intentionally NOT here

- Python dataclasses from the backend (`ColumnInfo`, `MetricInfo`, …) — they
  are server-side only and not part of the JSON contract.
- shadcn/ui components — each app owns its own UI primitives.
- React hooks specific to a single app.

## Usage

From any workspace app:

```ts
import {
  AGENT_STEPS,
  cn,
  parseSseStream,
  type ChatMessage,
  type AgentEvent,
} from "@a-data-agent/shared"
```

Sub-path imports also work:

```ts
import { cn } from "@a-data-agent/shared/lib"
import type { AgentEvent } from "@a-data-agent/shared/types"
```

## Scripts

- `pnpm --filter @a-data-agent/shared typecheck`
- `pnpm --filter @a-data-agent/shared build`
