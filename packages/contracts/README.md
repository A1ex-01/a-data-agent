# @a-data-agent/contracts

Shared base data structures and types for the a-data-agent ecosystem.

## Status

**Empty placeholder.** Contents will be filled in incrementally — start by
adding the foundational data structures (entities, enums, request/response
shapes) that both `apps/web` and any future apps need to share.

## Layout

```
packages/contracts/
├── src/
│   └── index.ts        # public barrel export
├── package.json
├── tsconfig.json
└── README.md
```

The package is consumed directly as TypeScript source by sibling workspace
packages. `apps/web`'s `next.config.ts` adds `@a-data-agent/contracts` to
`transpilePackages` so Next.js can compile it on the fly.

## Usage

From any workspace package:

```ts
import { /* ... */ } from "@a-data-agent/contracts"
```

## Scripts

- `pnpm --filter @a-data-agent/contracts typecheck`
- `pnpm --filter @a-data-agent/contracts build`
