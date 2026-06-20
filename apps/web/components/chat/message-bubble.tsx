"use client"

/**
 * MessageBubble — single chat message. User messages show only their
 * text. Assistant messages additionally show the live progress timeline
 * while streaming, and a results table once the query succeeds.
 */

import { Bot, User2 } from "lucide-react"

import { cn, type ChatMessage } from "@a-data-agent/shared"

import { ProgressTimeline } from "@/components/chat/progress-timeline"
import { ResultTable } from "@/components/chat/result-table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user"

  return (
    <div
      data-role={message.role}
      className={cn(
        "flex items-start gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <Avatar className="ring-border size-8 ring-1">
        <AvatarFallback
          className={cn(
            "text-xs",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground"
          )}
        >
          {isUser ? (
            <User2 className="size-4" />
          ) : (
            <Bot className="size-4" />
          )}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "flex max-w-[min(75ch,90%)] flex-col gap-2",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-card text-card-foreground border-border rounded-tl-sm border"
          )}
        >
          {message.text || (
            <span className="text-muted-foreground italic">…</span>
          )}
        </div>

        {!isUser && message.query ? <AssistantExtras message={message} /> : null}
      </div>
    </div>
  )
}

function AssistantExtras({ message }: { message: ChatMessage }) {
  const { query } = message
  if (!query) return null

  return (
    <div className="bg-card text-card-foreground border-border w-full max-w-2xl rounded-xl border p-3 text-xs shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-muted-foreground text-[11px] tracking-wide uppercase">
          Pipeline
        </span>
        <StatusBadge status={query.status} />
      </div>
      <ProgressTimeline steps={query.steps} />

      {query.status === "succeeded" && query.rows ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="text-muted-foreground text-[11px] tracking-wide uppercase">
            Result · {query.rows.length} row{query.rows.length === 1 ? "" : "s"}
          </div>
          <ResultTable rows={query.rows} />
        </div>
      ) : null}

      {query.status === "failed" && query.error ? (
        <p className="text-destructive mt-3 text-xs">{query.error}</p>
      ) : null}
    </div>
  )
}

function StatusBadge({
  status,
}: {
  status: NonNullable<ChatMessage["query"]>["status"]
}) {
  switch (status) {
    case "idle":
      return <Badge variant="outline">Idle</Badge>
    case "streaming":
      return <Badge variant="secondary">Streaming</Badge>
    case "succeeded":
      return <Badge variant="success">Done</Badge>
    case "failed":
      return <Badge variant="destructive">Failed</Badge>
    case "aborted":
      return <Badge variant="outline">Cancelled</Badge>
  }
}
