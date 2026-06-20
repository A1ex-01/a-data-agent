"use client"

/**
 * ChatShell — top-level chat layout, Vercel Chatbot style.
 *
 *   ┌─────────────────────────────────────────────┐
 *   │   (empty state, centered)                   │
 *   │                                             │
 *   │   user  ░░░░░░░░░░░░░░  ← right bubble      │
 *   │   assistant paragraph  ← left, no chrome    │
 *   │   ┌──── Reasoning ▾ ────┐                   │
 *   │   │ step · step · step  │                   │
 *   │   └─────────────────────┘                   │
 *   │   ┌──── Result · 5 rows ───┐                │
 *   │   │ data table             │                │
 *   │   └────────────────────────┘                │
 *   │                                             │
 *   │   ┌──────────────────────────────┐ [↑]      │
 *   │   │ Send a message…              │          │
 *   │   └──────────────────────────────┘          │
 *   └─────────────────────────────────────────────┘
 *
 * No sidebar, no top header. `max-w-3xl mx-auto` content column with
 * generous side padding; conversation scroll area handles auto-pin and
 * shows a "jump to latest" pill (see `conversation-scroll-button.tsx`).
 */

import * as React from "react"
import { MessageSquare } from "lucide-react"

import {
  applyAgentEvent,
  cn,
  type AgentEvent,
  type ChatMessage,
  type StepProgress,
} from "@a-data-agent/shared"

import { Composer } from "@/components/chat/composer"
import { ConversationScrollButton } from "@/components/chat/conversation-scroll-button"
import { MessageBubble } from "@/components/chat/message-bubble"

function makeId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function newAssistantPlaceholder(): ChatMessage {
  return {
    id: makeId(),
    role: "assistant",
    text: "",
    createdAt: Date.now(),
    query: { status: "streaming", steps: [] },
  }
}

interface StreamingHandle {
  events: AsyncIterable<AgentEvent>
  abort: () => void
}

const SUGGESTIONS = [
  "华北地区 AOV 是多少？",
  "Top 10 商品按销量排序",
  "本月新增用户数对比上月变化",
  "Explain the fact_order table schema",
]

export function ChatShell() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [streaming, setStreaming] = React.useState<StreamingHandle | null>(null)
  /** Brief window between submit and first event — drives the submit button's spinner. */
  const [submitting, setSubmitting] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)

  // Auto-pin to bottom whenever content grows while user is at (or near) the bottom.
  React.useEffect(() => {
    const viewport = scrollRef.current
    if (!viewport) return
    const distance =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    if (distance < 200) {
      viewport.scrollTop = viewport.scrollHeight
    }
  }, [messages])

  const updateAssistant = React.useCallback(
    (assistantId: string, updater: (m: ChatMessage) => ChatMessage) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? updater(m) : m))
      )
    },
    []
  )

  const handleSubmit = React.useCallback(
    async (text: string) => {
      const userMessage: ChatMessage = {
        id: makeId(),
        role: "user",
        text,
        createdAt: Date.now(),
      }
      const assistant = newAssistantPlaceholder()

      setMessages((prev) => [...prev, userMessage, assistant])
      setSubmitting(true)

      try {
        const { submitQuery } = await import("@/lib/agent-client")
        const handle = submitQuery(text)
        setStreaming(handle)

        const steps: StepProgress[] = []
        let firstEvent = true
        for await (const event of handle.events) {
          if (firstEvent) {
            firstEvent = false
            setSubmitting(false)
          }
          switch (event.type) {
            case "progress": {
              const next = applyAgentEvent(steps, event)
              steps.length = 0
              steps.push(...next)
              const snapshotSteps: StepProgress[] = [...steps]
              updateAssistant(assistant.id, (m) => {
                if (!m.query) return m
                return {
                  ...m,
                  query: { ...m.query, steps: snapshotSteps },
                }
              })
              break
            }
            case "result": {
              const snapshotSteps: StepProgress[] = [...steps]
              const rows = event.data
              updateAssistant(assistant.id, (m) => {
                if (!m.query) return m
                return {
                  ...m,
                  query: {
                    ...m.query,
                    status: "succeeded",
                    steps: snapshotSteps,
                    rows,
                  },
                }
              })
              break
            }
            case "error": {
              const snapshotSteps: StepProgress[] = [...steps]
              const message = event.message
              updateAssistant(assistant.id, (m) => {
                if (!m.query) return m
                return {
                  ...m,
                  query: {
                    ...m.query,
                    status: "failed",
                    steps: snapshotSteps,
                    error: message,
                  },
                }
              })
              break
            }
          }
        }
      } finally {
        setStreaming(null)
        setSubmitting(false)
      }
    },
    [updateAssistant]
  )

  const handleCancel = React.useCallback(() => {
    streaming?.abort()
    setStreaming(null)
    setSubmitting(false)
  }, [streaming])

  return (
    <div className="bg-background flex h-dvh w-full justify-center overflow-hidden">
      <div className="relative flex w-full max-w-3xl flex-col px-4 pt-6 sm:px-6">
        {/* Conversation */}
        <div
          ref={scrollRef}
          data-slot="conversation-viewport"
          className="relative flex-1 overflow-y-auto"
        >
          <div
            className={cn(
              "mx-auto flex w-full flex-col gap-6 pb-32",
              messages.length === 0 && "h-full"
            )}
          >
            {messages.length === 0 ? (
              <EmptyState />
            ) : (
              messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}
          </div>
          <ConversationScrollButton />
        </div>

        {/* Composer pinned to bottom */}
        <div className="bg-background absolute right-4 bottom-4 left-4 z-10 sm:right-6 sm:left-6">
          <div className="mx-auto w-full max-w-3xl">
            <Composer
              streaming={streaming !== null}
              submitting={submitting}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
            <p className="text-muted-foreground mt-2 text-center text-xs">
              Press <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">Enter</kbd>{" "}
              to send · <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">Shift</kbd>+
              <kbd className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">Enter</kbd> for a new line
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="bg-muted text-foreground flex size-12 items-center justify-center rounded-full">
        <MessageSquare className="size-6" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Ask anything about your data
        </h1>
        <p className="text-muted-foreground max-w-md text-sm">
          The agent extracts keywords, recalls relevant tables and metrics,
          writes SQL, and returns the executed result — streamed live.
        </p>
      </div>
      <ul className="text-foreground/80 grid w-full max-w-xl gap-1.5 pt-2 text-left text-sm">
        {SUGGESTIONS.map((s) => (
          <li
            key={s}
            className="border-border bg-card text-card-foreground rounded-xl border px-4 py-2.5 text-sm"
          >
            {s}
          </li>
        ))}
      </ul>
    </div>
  )
}
