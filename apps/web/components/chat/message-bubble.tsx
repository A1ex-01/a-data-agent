"use client"

/**
 * MessageBubble — single chat message rendered in Vercel Chatbot style.
 *
 *   - `user`       → right-aligned, primary-blue rounded bubble.
 *   - `assistant`  → left-aligned, transparent text — no bubble chrome.
 *
 * Assistant messages additionally render the live agent pipeline as a
 * collapsible "Reasoning"-style disclosure, and the final SQL result as
 * an inline data table. The user-visible state machine is unchanged:
 *
 *   idle → streaming → succeeded | failed | aborted
 *
 * See `@a-data-agent/shared` for the wire-level types.
 */

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Database,
  Loader2,
  XCircle,
} from "lucide-react"

import { cn, type ChatMessage } from "@a-data-agent/shared"

import { ProgressTimeline } from "@/components/chat/progress-timeline"
import { ResultTable } from "@/components/chat/result-table"

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div
        data-role="user"
        className="flex w-full justify-end"
      >
        <div
          className={cn(
            "max-w-[85%] rounded-3xl px-5 py-2.5 text-base leading-relaxed",
            "bg-primary text-primary-foreground whitespace-pre-wrap wrap-break-word shadow-sm"
          )}
        >
          {message.text}
        </div>
      </div>
    )
  }

  return (
    <div data-role="assistant" className="flex w-full flex-col gap-3">
      <AssistantBody message={message} />
    </div>
  )
}

function AssistantBody({ message }: { message: ChatMessage }) {
  const { query } = message

  if (!query) {
    return (
      <p className="text-foreground text-base leading-relaxed">
        {message.text}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {message.text ? (
        <p className="text-foreground text-base leading-relaxed whitespace-pre-wrap">
          {message.text}
        </p>
      ) : null}

      <ReasoningDisclosure status={query.status} steps={query.steps}>
        <ProgressTimeline steps={query.steps} />
      </ReasoningDisclosure>

      {query.status === "succeeded" && query.rows ? (
        <ResultCard rows={query.rows} />
      ) : null}

      {query.status === "failed" && query.error ? (
        <ErrorCard message={query.error} />
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Reasoning disclosure (Vercel Chatbot style)                                */
/* -------------------------------------------------------------------------- */

interface ReasoningDisclosureProps {
  status: NonNullable<ChatMessage["query"]>["status"]
  steps: NonNullable<ChatMessage["query"]>["steps"]
  children: React.ReactNode
}

function ReasoningDisclosure({
  status,
  steps,
  children,
}: ReasoningDisclosureProps) {
  // Vercel-style disclosure: collapsed by default for completed queries,
  // expanded for the currently-streaming one. We derive `open` from props
  // (no local state, no effect) and let the parent remount via `key` if
  // it needs to reset the disclosure.

  if (steps.length === 0) {
    // Nothing to show yet — keep the assistant row compact.
    return status === "streaming" ? (
      <StatusLine status={status} />
    ) : null
  }

  return (
    <Disclosure defaultOpen={status === "streaming"}>
      <DisclosureTrigger status={status} steps={steps} />
      <DisclosureContent>{children}</DisclosureContent>
    </Disclosure>
  )
}

/* -------------------------------------------------------------------------- */
/*  Uncontrolled disclosure — `defaultOpen` lets the parent decide per query  */
/* -------------------------------------------------------------------------- */

interface DisclosureProps {
  defaultOpen: boolean
  children: React.ReactNode
}

function Disclosure({ defaultOpen, children }: DisclosureProps) {
  // Use a native <details> so we don't need any JS to track open state.
  // The browser handles all the toggling for us.
  return (
    <details
      data-slot="reasoning"
      data-open={defaultOpen}
      open={defaultOpen}
      className="border-border bg-muted/30 text-foreground rounded-xl border text-sm"
    >
      {children}
    </details>
  )
}

function DisclosureTrigger({
  status,
  steps,
}: {
  status: NonNullable<ChatMessage["query"]>["status"]
  steps: NonNullable<ChatMessage["query"]>["steps"]
}) {
  return (
    <summary className="hover:bg-muted/50 flex cursor-pointer list-none items-center gap-2 rounded-xl px-3.5 py-2 transition-colors [&::-webkit-details-marker]:hidden">
      <StatusGlyph status={status} />
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Pipeline
      </span>
      <span className="text-foreground/80 flex-1 text-sm">
        {summarizeSteps(steps, status)}
      </span>
      <ChevronDown className="text-muted-foreground size-4 transition-transform duration-200 group-open:rotate-180 [[open]>summary_&]:rotate-180" />
    </summary>
  )
}

function DisclosureContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border border-t px-3.5 py-3">{children}</div>
  )
}

function summarizeSteps(
  steps: NonNullable<ChatMessage["query"]>["steps"],
  status: NonNullable<ChatMessage["query"]>["status"],
): string {
  const lastSuccess = [...steps].reverse().find((s) => s.status === "success")
  if (status === "failed") {
    const lastError = [...steps].reverse().find((s) => s.status === "error")
    return lastError ? `Failed at ${lastError.id}` : "Failed"
  }
  if (status === "aborted") return "Cancelled"
  if (status === "succeeded" && lastSuccess) return `Done · last step ${lastSuccess.id}`
  if (status === "streaming") {
    const running = steps.find((s) => s.status === "running")
    return running ? `Working on ${running.id}…` : "Thinking…"
  }
  return ""
}

function StatusLine({
  status,
}: {
  status: NonNullable<ChatMessage["query"]>["status"]
}) {
  return (
    <div className="text-muted-foreground flex items-center gap-2 text-sm">
      <StatusGlyph status={status} />
      <span>Thinking…</span>
    </div>
  )
}

function StatusGlyph({
  status,
}: {
  status: NonNullable<ChatMessage["query"]>["status"]
}) {
  switch (status) {
    case "streaming":
      return <Loader2 className="text-muted-foreground size-4 animate-spin" />
    case "succeeded":
      return <CheckCircle2 className="size-4 text-emerald-500" />
    case "failed":
      return <XCircle className="text-destructive size-4" />
    case "aborted":
      return <AlertCircle className="text-muted-foreground size-4" />
    case "idle":
      return null
  }
}

/* -------------------------------------------------------------------------- */
/*  Result / Error cards (assistant-only)                                      */
/* -------------------------------------------------------------------------- */

function ResultCard({
  rows,
}: {
  rows: NonNullable<NonNullable<ChatMessage["query"]>["rows"]>
}) {
  return (
    <div
      data-slot="result-card"
      className="border-border bg-card text-card-foreground overflow-hidden rounded-xl border text-sm"
    >
      <div className="border-border bg-muted/30 text-muted-foreground flex items-center gap-2 border-b px-3.5 py-2 text-xs font-medium tracking-wide uppercase">
        <Database className="size-3.5" />
        Result · {rows.length} row{rows.length === 1 ? "" : "s"}
      </div>
      <div className="p-2">
        <ResultTable rows={rows} />
      </div>
    </div>
  )
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div
      data-slot="error-card"
      className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <p className="leading-relaxed">{message}</p>
    </div>
  )
}
