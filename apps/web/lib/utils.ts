// Re-export `cn` from @a-data-agent/shared so existing imports of
// `@/lib/utils` keep working. The canonical implementation now lives in
// the shared package and is shared with future apps (e.g. apps/admin).
export { cn } from "@a-data-agent/shared";
