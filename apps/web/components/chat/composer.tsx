"use client"

/**
 * Composer — multiline input with submit button. Submits on Cmd/Ctrl+Enter
 * or by clicking the Send button. Disables itself while a query is in
 * flight, but offers a Stop button in that case.
 */

import * as React from "react"
import { Send, Square } from "lucide-react"

import { cn } from "@a-data-agent/shared"

import { Button } from "@/components/ui/button"

interface ComposerProps {
  disabled?: boolean
  /** True when an assistant message is currently streaming. */
  streaming?: boolean
  onSubmit: (text: string) => void
  onCancel?: () => void
  placeholder?: string
}

export function Composer({
  disabled,
  streaming,
  onSubmit,
  onCancel,
  placeholder = "Ask a question about your data…",
}: ComposerProps) {
  const [value, setValue] = React.useState("")

  const trimmed = value.trim()
  const canSubmit = !disabled && !streaming && trimmed.length > 0

  const submit = React.useCallback(() => {
    if (!canSubmit) return
    onSubmit(trimmed)
    setValue("")
  }, [canSubmit, onSubmit, trimmed])

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <textarea
        aria-label="Ask a question"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (
            (event.metaKey || event.ctrlKey) &&
            event.key === "Enter"
          ) {
            event.preventDefault()
            submit()
          }
        }}
        rows={1}
        className={cn(
          "border-input bg-background ring-offset-background placeholder:text-muted-foreground",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
          "min-h-9 max-h-40 flex-1 resize-none rounded-md border px-3 py-2 text-sm shadow-xs outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
        onInput={(event) => {
          // Auto-grow up to max-h-40.
          const el = event.currentTarget
          el.style.height = "auto"
          el.style.height = `${Math.min(el.scrollHeight, 160)}px`
        }}
      />
      {streaming ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onCancel}
          aria-label="Stop generating"
        >
          <Square className="size-4" />
        </Button>
      ) : (
        <Button
          type="submit"
          size="icon"
          disabled={!canSubmit}
          aria-label="Send"
        >
          <Send className="size-4" />
        </Button>
      )}
    </form>
  )
}
