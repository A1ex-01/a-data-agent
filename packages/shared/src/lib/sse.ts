/**
 * Server-Sent Events (SSE) parser.
 *
 * The a-data-agent backend's `POST /api/query` returns
 * `Content-Type: text/event-stream` and yields one event per LangGraph
 * node, encoded as `data: <json>\n\n`.
 *
 * This parser is robust to the full SSE wire format:
 *   - splits on `\n\n` event boundaries
 *   - joins multi-line `data:` fields per the spec
 *   - ignores comment lines (`:`) and unknown fields
 *   - normalizes `\r\n` line endings
 *
 * It also classifies every event by its `type` field into the
 * `AgentEvent` discriminated union (see `./types/events`).
 */

import type { AgentEvent, ErrorEvent, ProgressEvent, ResultEvent } from "../types";
import type { QueryResultRow } from "../types";

/** Thrown when the parser can't decode an event payload as JSON. */
export class SseParseError extends Error {
  constructor(
    message: string,
    readonly rawEvent: string,
  ) {
    super(message);
    this.name = "SseParseError";
  }
}

/**
 * Parse a raw SSE event block (everything between two blank lines) into
 * a single `data:` string, or `null` if the block has no data field
 * (e.g. heartbeats, comment-only events).
 */
function parseEventBlock(block: string): string | null {
  const lines = block.split(/\r?\n/);
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line) continue;
    // Comment line per the SSE spec — ignore.
    if (line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const field = line.slice(0, colon);
    let value = line.slice(colon + 1);
    // The spec says: a single leading space after the colon is stripped.
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "data") dataLines.push(value);
    // We deliberately ignore `event`, `id`, `retry` — the backend only
    // uses `data`.
  }

  if (dataLines.length === 0) return null;
  return dataLines.join("\n");
}

/**
 * Classify a JSON-decoded payload into a typed `AgentEvent`.
 *
 * Performs minimal validation — anything that doesn't match the union
 * surfaces as an `error` event so the UI can still surface a message.
 */
function toAgentEvent(payload: unknown): AgentEvent {
  if (typeof payload !== "object" || payload === null) {
    return {
      type: "error",
      message: "Event payload was not an object",
    } satisfies ErrorEvent;
  }
  const record = payload as Record<string, unknown>;

  switch (record.type) {
    case "progress": {
      const step = typeof record.step === "string" ? record.step : "";
      const status = record.status;
      if (!step || (status !== "running" && status !== "success" && status !== "error")) {
        return {
          type: "error",
          message: `Malformed progress event: ${JSON.stringify(record)}`,
        };
      }
      const event: ProgressEvent = {
        type: "progress",
        step,
        status,
        ...(typeof record.error === "string" ? { error: record.error } : {}),
      };
      return event;
    }
    case "result": {
      const data = Array.isArray(record.data)
        ? (record.data as QueryResultRow[])
        : [];
      const event: ResultEvent = { type: "result", data };
      return event;
    }
    case "error": {
      const message =
        typeof record.message === "string"
          ? record.message
          : "Unknown error";
      return { type: "error", message };
    }
    default: {
      return {
        type: "error",
        message: `Unknown event type: ${String(record.type)}`,
      };
    }
  }
}

/**
 * Parse a complete SSE stream body (the entire response text) into a list
 * of agent events. Useful for tests or for backends that return the whole
 * stream at once. Most call sites should use `parseSseStream` instead.
 */
export function parseSseText(text: string): AgentEvent[] {
  const events: AgentEvent[] = [];
  const blocks = text.split(/\r?\n\r?\n/);
  for (const block of blocks) {
    const data = parseEventBlock(block);
    if (data === null) continue;
    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch (err) {
      throw new SseParseError(
        `Failed to JSON-parse SSE data: ${(err as Error).message}`,
        block,
      );
    }
    events.push(toAgentEvent(payload));
  }
  return events;
}

/**
 * Consume a `ReadableStream<Uint8Array>` (the standard fetch SSE body)
 * and yield typed `AgentEvent`s as they arrive.
 *
 * The function streams (does not buffer the whole response), so the chat
 * UI can render progress events as soon as the backend emits them.
 */
export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<AgentEvent, void, void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are terminated by a blank line (\n\n or \r\n\r\n).
      // Split on either; keep the trailing partial in the buffer.
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() ?? "";

      for (const block of parts) {
        const data = parseEventBlock(block);
        if (data === null) continue;
        let payload: unknown;
        try {
          payload = JSON.parse(data);
        } catch (err) {
          // Per the SSE spec we could dispatch a separate error event
          // here, but the backend never emits malformed JSON — keep the
          // error visible to the caller instead.
          throw new SseParseError(
            `Failed to JSON-parse SSE data: ${(err as Error).message}`,
            block,
          );
        }
        yield toAgentEvent(payload);
      }
    }

    // Flush any trailing bytes (e.g. a final event without a trailing
    // blank line when the server closes mid-write).
    if (buffer.trim().length > 0) {
      const data = parseEventBlock(buffer);
      if (data !== null) {
        try {
          yield toAgentEvent(JSON.parse(data));
        } catch {
          // Drop — already produced the result/error above if any.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
