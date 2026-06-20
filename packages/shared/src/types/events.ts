/**
 * SSE event types emitted by the agent graph while answering a query.
 *
 * The backend's `query_service` yields `data: <json>\n\n` lines where the
 * payload is one of three shapes (see `services/a-data-agent/app/services/query_service.py`):
 *
 *   - `{"type": "progress", "step": "...", "status": "running|success|error", ...}`
 *       Emitted at the start/end of every LangGraph node. `step` is the
 *       Chinese label written by the node (see `AGENT_STEPS`).
 *   - `{"type": "result", "data": [...rows...]}`
 *       Emitted exactly once at the end of a successful run, carrying the
 *       SQL execution result.
 *   - `{"type": "error", "message": "..."}`
 *       Emitted when the streaming generator itself fails (caught at the
 *       service level, not per-node).
 *
 * The union is `discriminated` on `type`, so consumers can `switch` on it
 * exhaustively.
 */

import type { QueryResultPayload } from "./api";

/** Mirrors the backend's per-node lifecycle. */
export type StepStatus = "running" | "success" | "error";

/**
 * Emitted at the start and end of every LangGraph node.
 *
 * Note: the backend uses the *Chinese* step name as the stable identifier
 * (it's the only string passed to `stream_writer`). Frontends should compare
 * against `AGENT_STEPS` (see `./agent.ts`) rather than hard-coding strings.
 */
export interface ProgressEvent {
  type: "progress";
  /** Step identifier — matches one of the `id` values in `AGENT_STEPS`. */
  step: string;
  status: StepStatus;
  /** Optional message attached to the error case by some nodes. */
  error?: string;
}

/** Emitted once per successful query, carrying SQL execution rows. */
export interface ResultEvent {
  type: "result";
  data: QueryResultPayload["data"];
}

/** Emitted when the streaming generator itself fails. */
export interface ErrorEvent {
  type: "error";
  message: string;
}

/** Union of every event the agent stream may emit. */
export type AgentEvent = ProgressEvent | ResultEvent | ErrorEvent;
