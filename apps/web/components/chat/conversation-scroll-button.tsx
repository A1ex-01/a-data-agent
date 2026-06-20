"use client"

/**
 * ConversationScrollButton — small pill that appears at the bottom-right
 * of the conversation when the user has scrolled up. Clicking it jumps
 * back to the latest message. Modeled after Vercel Chatbot's AI Elements
 * ConversationScrollButton, but without a runtime dependency on
 * `elements.ai-sdk.dev` — we resolve the scroll viewport via the
 * `[data-slot="conversation-viewport"]` marker on `ScrollArea`.
 */

import * as React from "react"
import { ArrowDown } from "lucide-react"

import { cn } from "@/lib/utils"

const VIEWPORT_SELECTOR = "[data-slot='conversation-viewport']"

function findViewport(container: HTMLElement | null): HTMLElement | null {
  if (!container) return null
  // Look up through ancestors so the button can be placed anywhere in
  // the same scroll container.
  let node: HTMLElement | null = container
  while (node) {
    const found = node.querySelector<HTMLElement>(VIEWPORT_SELECTOR)
    if (found) return found
    node = node.parentElement
  }
  return null
}

interface ConversationScrollButtonProps {
  className?: string
}

export function ConversationScrollButton({
  className,
}: ConversationScrollButtonProps) {
  const buttonRef = React.useRef<HTMLButtonElement | null>(null)
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const button = buttonRef.current
    if (!button) return
    const viewport = findViewport(button)
    if (!viewport) return

    const update = () => {
      const distance =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
      // Show when there's at least ~120px of unread content below.
      setVisible(distance > 120)
    }

    update()
    viewport.addEventListener("scroll", update, { passive: true })

    // Also re-evaluate when the conversation content changes.
    const observer = new ResizeObserver(update)
    observer.observe(viewport)

    return () => {
      viewport.removeEventListener("scroll", update)
      observer.disconnect()
    }
  }, [])

  const handleClick = React.useCallback(() => {
    const button = buttonRef.current
    if (!button) return
    const viewport = findViewport(button)
    if (!viewport) return
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: "smooth",
    })
  }, [])

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label="Scroll to latest message"
      onClick={handleClick}
      className={cn(
        "absolute right-4 bottom-4 z-10 inline-flex size-8 items-center justify-center rounded-full",
        "bg-background text-foreground border-border border shadow-md",
        "hover:bg-muted transition-all duration-200",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0",
        className
      )}
    >
      <ArrowDown className="size-4" />
    </button>
  )
}
