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
 * Intent classification produced by the `classify_intent` graph node.
 * Surfaced on the `progress` event so the UI can show what the agent
 * decided. Routes the user into either the full data pipeline or the
 * chitchat short-circuit.
 */
export type Intent = "data_query" | "chitchat";

/**
 * Emitted at the start and end of every LangGraph node.
 *
 * Note: the backend uses the *Chinese* step name as the stable identifier
 * (it's the only string passed to `stream_writer`). Frontends should compare
 * against `AGENT_STEPS` (see `./agent.ts`) rather than hard-coding strings.
 *
 * The optional `intent` field is set only by the `classify_intent` node
 * (it doesn't appear in `AGENT_STEPS`).
 */
export interface ProgressEvent {
  type: "progress";
  /** Step identifier — matches one of the `id` values in `AGENT_STEPS`. */
  step: string;
  status: StepStatus;
  /** Optional message attached to the error case by some nodes. */
  error?: string;
  /** Set only by the `classify_intent` node on success. */
  intent?: Intent;
}

/**
 * Emitted while the `chitchat_stream` node streams an LLM reply to the
 * user. Each delta is a *fragment* of the running reply; the UI is
 * expected to concatenate them into the assistant message's `text`
 * field. One event per token (or small group of tokens, depending on
 * the upstream model).
 */
export interface ChitchatDeltaEvent {
  type: "chitchat";
  /** Incremental text fragment. */
  delta: string;
}

/**
 * Emitted once per chitchat turn, when the streaming reply has finished.
 * The `text` field contains the complete reply — useful as a stable
 * snapshot for the UI (e.g. to display after the conversation scrolls).
 */
export interface AnswerEvent {
  type: "answer";
  text: string;
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

/**
 * Union of every event the agent stream may emit.
 *
 *   - `progress`     — node lifecycle (intent, recall, generate SQL, …)
 *   - `chitchat`     — token delta for a free-form LLM reply
 *   - `answer`       — final text of a chitchat turn
 *   - `result`       — SQL execution rows from a data query
 *   - `error`        — fatal stream-level failure
 */
export type AgentEvent =
  | ProgressEvent
  | ChitchatDeltaEvent
  | AnswerEvent
  | ResultEvent
  | ErrorEvent;
