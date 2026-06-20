/**
 * Server-side proxy for the a-data-agent `/api/query` SSE endpoint.
 *
 * Why proxy?
 * - The Python backend doesn't configure CORS, so the browser would be
 *   blocked from calling `http://localhost:8000/api/query` directly.
 * - It also gives us one place to attach logging / auth / error mapping
 *   before the response hits the client.
 *
 * The route is a thin pass-through: it forwards the JSON body, relays
 * the SSE stream, and surfaces the upstream's status code on failure.
 */

import type { NextRequest } from "next/server";

import { apiUrl } from "@a-data-agent/shared";

// Force this route to run in the Node.js runtime — the default edge
// runtime can be picky about streaming long-lived SSE connections
// from a third-party host.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const query =
    body && typeof body === "object" && "query" in body
      ? (body as { query: unknown }).query
      : undefined;

  if (typeof query !== "string" || query.trim().length === 0) {
    return Response.json(
      { error: "Field `query` is required and must be a non-empty string." },
      { status: 400 },
    );
  }

  const upstreamUrl = apiUrl("/api/query");

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
      // Don't let Next cache or auto-retry an SSE stream.
      cache: "no-store",
    });
  } catch (err) {
    return Response.json(
      {
        error: `Failed to reach a-data-agent backend at ${upstreamUrl}: ${
          (err as Error).message
        }`,
      },
      { status: 502 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    // Try to surface the upstream's error text if it's JSON; otherwise
    // pass through the status.
    const text = await upstream.text().catch(() => "");
    return new Response(text || upstream.statusText, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "text/plain" },
    });
  }

  // Pass the SSE stream straight through with the right headers.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      // Disable Nginx-style buffering if the app is ever behind one.
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}
