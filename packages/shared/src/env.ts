/**
 * Public type-only re-exports for `@a-data-agent/shared`.
 *
 * Use this sub-path when you only need the type surface and want the
 * bundler to drop the runtime utilities:
 *
 *     import type { AgentEvent, ChatMessage } from "@a-data-agent/shared/types"
 *
 * At runtime this file resolves to `./types/index.ts`; the runtime side
 * is small enough that this rarely matters, but the separation is here
 * for future-proofing.
 */
export * from "./types";
