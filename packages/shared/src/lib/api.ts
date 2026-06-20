/**
 * Resolve the base URL for backend API calls.
 *
 * Configuration is read from `process.env.AIR_API_BASE_URL`. If unset, the
 * helper falls back to `http://localhost:8000` so local dev works without
 * any env file.
 *
 * Apps should call this once at startup and reuse the result, rather than
 * re-resolving per request — it lets tests swap the base URL by setting
 * the env var before module evaluation.
 */

const DEFAULT_API_BASE_URL = "http://localhost:8000";

let cached: string | null = null;

export function apiBaseUrl(): string {
  if (cached !== null) return cached;
  const fromEnv =
    typeof process !== "undefined"
      ? process.env.AIR_API_BASE_URL
      : undefined;
  const base = (fromEnv ?? DEFAULT_API_BASE_URL).replace(/\/+$/, "");
  cached = base;
  return base;
}

/** For tests / hot-reload: clear the cached resolution. */
export function resetApiBaseUrlCache(): void {
  cached = null;
}

/** Build a full URL from the resolved base URL + a path. */
export function apiUrl(path: string): string {
  const base = apiBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
