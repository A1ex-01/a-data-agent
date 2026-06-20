"use client"

/**
 * ChatShell — top-level chat layout. Owns the message list and routes
 * composer submissions to the agent client. Designed to be the only
 * piece of stateful chat UI; future admin tools can reuse the same
 * pieces (`MessageBubble`, `Composer`, `ProgressTimeline`) without
 * pulling in the state container.
 */

import * as React from "react"
import { Database, Trash2 } from "lucide-react"

import {
  applyAgentEvent,
  cn,
  type AgentEvent,
  type ChatMessage,
  type StepProgress,
} from "@a-data-agent/shared"

import { Composer } from "@/components/chat/composer"
import { MessageBubble } from "@/components/chat/message-bubble"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

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
  /** Async iterator that yields AgentEvents for this submission. */
  events: AsyncIterable<AgentEvent>
  abort: () => void
}

export function ChatShell() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [streaming, setStreaming] = React.useState<StreamingHandle | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)

  // Auto-scroll to the bottom whenever the message list grows.
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const viewport = el.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']"
    )
    if (viewport) viewport.scrollTop = viewport.scrollHeight
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

      try {
        const { submitQuery } = await import("@/lib/agent-client")
        const handle = submitQuery(text)
        setStreaming(handle)

        const steps: StepProgress[] = []
        for await (const event of handle.events) {
          switch (event.type) {
            case "progress": {
              const next = applyAgentEvent(steps, event)
              steps.length = 0
              steps.push(...next)
              const snapshotSteps: StepProgress[] = [...steps]
              updateAssistant(assistant.id, (m) => {
                if (!m.query) return m
                return { ...m, query: { ...m.query, steps: snapshotSteps } }
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
      }
    },
    [updateAssistant]
  )

  const handleCancel = React.useCallback(() => {
    streaming?.abort()
    setStreaming(null)
  }, [streaming])

  const handleClear = React.useCallback(() => {
    streaming?.abort()
    setMessages([])
    setStreaming(null)
  }, [streaming])

  const isStreaming = streaming !== null
  const lastAssistantIsStreaming = isStreaming

  return (
    <div className="bg-background flex h-dvh w-full flex-col">
      <header className="border-border bg-card/40 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary ring-primary/20 flex size-8 items-center justify-center rounded-lg ring-1">
            <Database className="size-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">a-data-agent</span>
            <span className="text-muted-foreground text-[11px]">
              Ask questions in natural language · results stream live
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={messages.length === 0 && !isStreaming}
          className="text-muted-foreground"
        >
          <Trash2 className="size-3.5" />
          Clear
        </Button>
      </header>

      <ScrollArea ref={scrollRef} className="flex-1">
        <div
          className={cn(
            "mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6"
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
      </ScrollArea>

      <footer className="border-border bg-background/80 shrink-0 border-t px-4 py-3 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl">
          <Composer
            streaming={lastAssistantIsStreaming}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
          <p className="text-muted-foreground mt-2 text-center text-[11px]">
            ⌘/Ctrl + Enter to send · Press Stop to cancel a running query
          </p>
        </div>
      </footer>
    </div>
  )
}

function EmptyState() {
  const suggestions = [
    "华北地区 AOV 是多少？",
    "Top 10 商品按销量排序",
    "本月新增用户数对比上月变化",
    "Explain the `fact_order` table",
  ]
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-3 pt-16 text-center text-sm">
      <div className="bg-primary/10 text-primary ring-primary/20 flex size-10 items-center justify-center rounded-xl ring-1">
        <Database className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-foreground text-base font-medium">
          Ask anything about your data warehouse
        </p>
        <p className="max-w-md text-xs">
          The agent extracts keywords, recalls relevant tables/columns/metrics,
          writes SQL, and returns the executed result — all streamed live.
        </p>
      </div>
      <ul className="text-foreground/80 grid w-full max-w-xl gap-1.5 pt-4 text-left text-xs">
        {suggestions.map((s) => (
          <li
            key={s}
            className="border-border bg-card text-card-foreground rounded-md border px-3 py-1.5"
          >
            {s}
          </li>
        ))}
      </ul>
    </div>
  )
}
