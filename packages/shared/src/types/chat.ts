/**
 * UI-side chat types. These wrap the wire-level SSE events into a shape
 * convenient for rendering a chat interface.
 */

import type { AgentEvent, ProgressEvent, StepStatus } from "./events";
import type { Intent } from "./events";
import type { QueryResultRow } from "./api";

export type MessageRole = "user" | "assistant" | "system";

/**
 * Lifecycle of a single chat turn from the client perspective.
 *
 *   - `idle`         — not yet started (no events received yet)
 *   - `streaming`    — stream open, events arriving
 *   - `succeeded`    — saw `result` (data query) or `answer` (chitchat)
 *   - `failed`       — saw `error`, or the stream threw
 *   - `aborted`      — user cancelled the request
 */
export type QueryStatus =
  | "idle"
  | "streaming"
  | "succeeded"
  | "failed"
  | "aborted";

/** Per-step progress tracked for an in-flight or completed query. */
export interface StepProgress {
  id: string;
  status: StepStatus;
  /** When `status === "error"`, the error message from the backend. */
  error?: string;
  /**
   * Set only by the `classify_intent` step on success. Frontends can
   * surface it to make the routing decision visible to the user
   * ("asked a data question" vs "asked a chitchat question").
   */
  intent?: Intent;
}

/**
 * A chat message. User messages have a `text` field and no progress;
 * assistant messages have the full progress timeline plus — depending
 * on whether the agent routed to a data query or a chitchat — either
 * SQL result rows or a plain free-form text answer.
 */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  createdAt: number;
  /**
   * Set on assistant messages that came from a streaming query. Always
   * populated (even for chitchat), so the UI can show the pipeline
   * timeline (intent + reply steps) for any agent turn.
   */
  query?: {
    status: QueryStatus;
    /** Most-recent status per agent step id, in arrival order. */
    steps: StepProgress[];
    /** Final SQL result rows when `status === "succeeded"` (data query). */
    rows?: QueryResultRow[];
    /** Error message when `status === "failed"`. */
    error?: string;
  };
}

/** Apply a single agent event to an in-progress step list. */
export function applyAgentEvent(
  steps: StepProgress[],
  event: AgentEvent,
): StepProgress[] {
  if (event.type !== "progress") return steps;
  const next = [...steps];
  const idx = next.findIndex((s) => s.id === event.step);
  const entry: StepProgress = {
    id: event.step,
    status: event.status,
    error: event.error,
  };
  if (idx === -1) next.push(entry);
  else next[idx] = entry;
  return next;
}

/** Whether the given event is a progress event (narrowing helper). */
export function isProgressEvent(
  event: AgentEvent,
): event is ProgressEvent {
  return event.type === "progress";
}
