"use client"

/**
 * Composer — multiline text input with an inline submit/stop button,
 * modeled after Vercel Chatbot's `PromptInput`. Differences from
 * shadcn's standalone Button:
 *
 *   - The button is *inside* the textarea frame, absolutely positioned
 *     at `bottom-1 right-1`.
 *   - Its icon swaps between three states:
 *       ready       →  up-arrow (`ArrowUp`)
 *       streaming   →  square (`Square`)
 *       submitting  →  spinner (`Loader2`)
 *   - The textarea grows up to 8 lines, then scrolls internally.
 *
 * Submitting fires on `Enter`; a newline is inserted on `Shift+Enter`.
 * Cmd/Ctrl+Enter also submits for parity with the previous version.
 */

import * as React from "react"
import { ArrowUp, Loader2, Square } from "lucide-react"

import { cn } from "@/lib/utils"

export type ComposerStatus = "ready" | "submitted" | "streaming"

interface ComposerProps {
  /** True while we're still receiving events from the backend. */
  streaming?: boolean
  /**
   * Whether to show the transient "submitting" spinner state. Use this
   * for the brief window between submitting the form and the first
   * event arriving on the stream.
   */
  submitting?: boolean
  onSubmit: (text: string) => void
  onCancel?: () => void
  placeholder?: string
  disabled?: boolean
}

export function Composer({
  streaming,
  submitting,
  onSubmit,
  onCancel,
  placeholder = "Send a message…",
  disabled,
}: ComposerProps) {
  const [value, setValue] = React.useState("")
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)

  const trimmed = value.trim()
  const hasText = trimmed.length > 0
  const status: ComposerStatus = streaming
    ? "streaming"
    : submitting
      ? "submitted"
      : "ready"
  const canSubmit = !disabled && !streaming && hasText

  const submit = React.useCallback(() => {
    if (!canSubmit) return
    onSubmit(trimmed)
    setValue("")
    // Reset textarea height after submit.
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (el) el.style.height = "auto"
    })
  }, [canSubmit, onSubmit, trimmed])

  const autoResize = React.useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    // Cap at ~8 lines (≈ 160px).
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [])

  React.useEffect(() => {
    autoResize()
  }, [value, autoResize])

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="relative"
    >
      <textarea
        ref={textareaRef}
        aria-label="Message"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        rows={1}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            submit()
          }
          if (
            (event.metaKey || event.ctrlKey) &&
            event.key === "Enter"
          ) {
            event.preventDefault()
            submit()
          }
        }}
        className={cn(
          "border-input bg-background ring-offset-background placeholder:text-muted-foreground",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
          "block w-full resize-none rounded-2xl border px-4 py-3 pr-12 pb-12 text-base leading-relaxed shadow-sm transition-[color,box-shadow] outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      />

      <div className="absolute right-2 bottom-2 flex items-center gap-2">
        <SubmitButton
          status={status}
          canSubmit={canSubmit}
          onSubmit={submit}
          onCancel={onCancel}
        />
      </div>
    </form>
  )
}

interface SubmitButtonProps {
  status: ComposerStatus
  canSubmit: boolean
  onSubmit: () => void
  onCancel?: () => void
}

function SubmitButton({
  status,
  canSubmit,
  onSubmit,
  onCancel,
}: SubmitButtonProps) {
  const isStreaming = status === "streaming"

  if (isStreaming) {
    return (
      <button
        type="button"
        onClick={onCancel}
        aria-label="Stop generating"
        className={cn(
          "bg-foreground text-background hover:bg-foreground/90",
          "inline-flex size-8 items-center justify-center rounded-full transition-colors",
          "focus-visible:ring-ring focus-visible:ring-3 focus-visible:outline-none"
        )}
      >
        <Square className="size-3.5 fill-current" />
      </button>
    )
  }

  const isSubmitted = status === "submitted"
  const disabled = !canSubmit || isSubmitted

  return (
    <button
      type="submit"
      onClick={onSubmit}
      disabled={disabled}
      aria-label="Send message"
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full transition-colors focus-visible:ring-ring focus-visible:ring-3 focus-visible:outline-none",
        disabled
          ? "bg-muted text-muted-foreground cursor-not-allowed"
          : "bg-primary text-primary-foreground hover:bg-primary/90"
      )}
    >
      {isSubmitted ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <ArrowUp className="size-4" />
      )}
    </button>
  )
}
