/**
 * UI-side chat types. These wrap the wire-level SSE events into a shape
 * convenient for rendering a chat interface.
 */

import type { AgentEvent, ProgressEvent, StepStatus } from "./events";
import type { QueryResultRow } from "./api";

export type MessageRole = "user" | "assistant" | "system";

/**
 * What the assistant is currently doing for a given chat message.
 *
 *   - `idle`         — not yet started
 *   - `streaming`    — SSE connection open, receiving events
 *   - `succeeded`    — received a `result` event with rows
 *   - `failed`       — received an `error` event, or the stream errored
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
}

/**
 * A chat message. User messages have a `text` field and no progress;
 * assistant messages have the full progress timeline plus the optional
 * result rows.
 */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  createdAt: number;
  /** Only set for assistant messages that came from a streaming query. */
  query?: {
    status: QueryStatus;
    /** Most-recent status per agent step id, in arrival order. */
    steps: StepProgress[];
    /** Final SQL result rows when `status === "succeeded"`. */
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
