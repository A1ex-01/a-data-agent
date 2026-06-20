"use client"

/**
 * Browser-side client for the `/api/query` Next.js proxy.
 *
 * `POST /api/query` returns an SSE stream. We hit our own Next.js route
 * (which in turn talks to the Python backend) — see
 * `app/api/query/route.ts` — so the browser never has to handle CORS.
 *
 * `submitQuery()` returns an `AsyncIterable<AgentEvent>` that the caller
 * can `for await…of` to consume events as they arrive, plus an
 * `AbortSignal` so the UI can cancel an in-flight request.
 */

import {
  type AgentEvent,
  type ChatMessage,
  type QueryStatus,
  type StepProgress,
  applyAgentEvent,
  parseSseStream,
} from "@a-data-agent/shared";

export interface QuerySubmission {
  /** Call `abort()` to cancel the request. */
  abort: () => void;
  /**
   * Async iterator of agent events. The caller is responsible for
   * folding these into UI state (see `foldQueryEvents`).
   */
  events: AsyncIterable<AgentEvent>;
}

export interface FoldedQueryResult {
  status: QueryStatus;
  steps: StepProgress[];
  rows?: ChatMessage["query"] extends infer Q
    ? Q extends { rows?: infer R }
      ? R
      : never
    : never;
  error?: string;
}

export function submitQuery(query: string): QuerySubmission {
  const controller = new AbortController();

  const events = (async function* (): AsyncGenerator<AgentEvent, void, void> {
    let response: Response;
    try {
      response = await fetch("/api/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });
    } catch (err) {
      // Synthetic error event so the caller's reducer always sees one.
      yield {
        type: "error",
        message: (err as Error).message || "Network request failed",
      };
      return;
    }

    if (!response.ok || !response.body) {
      let detail = `Backend returned ${response.status}`;
      try {
        const text = await response.text();
        if (text) detail += `: ${text}`;
      } catch {
        // ignore — keep the generic message
      }
      yield { type: "error", message: detail };
      return;
    }

    try {
      for await (const event of parseSseStream(response.body)) {
        if (controller.signal.aborted) return;
        yield event;
      }
    } catch (err) {
      yield {
        type: "error",
        message: (err as Error).message || "Failed to read SSE stream",
      };
    }
  })();

  return {
    events,
    abort: () => controller.abort(),
  };
}

/** Convenience reducer: fold a stream of events into a single result. */
export async function foldQueryEvents(
  events: AsyncIterable<AgentEvent>,
  signal?: AbortSignal,
): Promise<FoldedQueryResult> {
  const steps: StepProgress[] = [];
  let status: QueryStatus = "streaming";
  let rows: FoldedQueryResult["rows"];
  let error: string | undefined;

  for await (const event of events) {
    if (signal?.aborted) {
      status = "aborted";
      break;
    }
    switch (event.type) {
      case "progress": {
        const next = applyAgentEvent(steps, event);
        steps.length = 0;
        steps.push(...next);
        break;
      }
      case "result": {
        rows = event.data;
        status = "succeeded";
        break;
      }
      case "error": {
        error = event.message;
        status = "failed";
        break;
      }
    }
  }

  // If the stream ended without a terminal event we treat it as success
  // if no error was observed (the backend sometimes closes the stream
  // right after the `result` event).
  if (status === "streaming") {
    status = error ? "failed" : rows ? "succeeded" : "aborted";
  }

  return { status, steps, rows, error };
}
