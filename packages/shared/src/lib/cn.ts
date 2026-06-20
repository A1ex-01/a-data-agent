/**
 * `cn` — merge Tailwind class names, deduplicating conflicts.
 *
 * Re-exported from `clsx` + `tailwind-merge` so every app uses the same
 * implementation. Lives in `@a-data-agent/shared` so future apps don't
 * duplicate it.
 *
 * If you call this from a context where `clsx` or `tailwind-merge` aren't
 * installed (e.g. SSR edge runtime without deps), pass them in via
 * `setCnImpl()` first.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

type Impl = (...inputs: ClassValue[]) => string;

let impl: Impl = (...inputs) => twMerge(clsx(inputs));

/** Replace the underlying implementation (used by tests / non-Tailwind envs). */
export function setCnImpl(next: Impl): void {
  impl = next;
}

export function cn(...inputs: ClassValue[]): string {
  return impl(inputs);
}
