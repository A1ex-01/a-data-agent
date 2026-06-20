/**
 * Wire-level request / response types for the a-data-agent backend.
 *
 * The backend exposes `POST /api/query`, accepts a JSON body and streams an
 * SSE response. These types describe exactly that surface area — nothing
 * more. App-specific wrappers live in `types/chat.ts`.
 */

/** Body of `POST /api/query`. */
export interface QueryRequest {
  /** Natural-language question, e.g. "华北地区 AOV 是多少". */
  query: string;
}

/** A single row returned by the SQL execution step. */
export type QueryResultRow = Record<string, unknown>;

/** A successful query produces one `result` event carrying the row set. */
export interface QueryResultPayload {
  data: QueryResultRow[];
}
