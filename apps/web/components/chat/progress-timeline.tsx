"use client"

/**
 * ProgressTimeline — vertical list of agent pipeline steps with their
 * live status. Used inside an assistant message to show what the backend
 * is currently doing while a query streams.
 */

import {
  AGENT_STEPS,
  AGENT_STEPS_BY_ID,
  type StepProgress,
  type StepStatus,
  cn,
} from "@a-data-agent/shared"

import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"

interface ProgressTimelineProps {
  /** Most-recent status per step id, in arrival order. */
  steps: StepProgress[]
}

const STATUS_DOT: Record<StepStatus | "idle", string> = {
  running: "bg-amber-500",
  success: "bg-emerald-500",
  error: "bg-destructive",
  idle: "bg-muted-foreground/30",
}

const STATUS_LABEL: Record<StepStatus | "idle", string> = {
  running: "Running",
  success: "Done",
  error: "Failed",
  idle: "Idle",
}

export function ProgressTimeline({ steps }: ProgressTimelineProps) {
  const seen = new Map(steps.map((s) => [s.id, s]))

  return (
    <ol className="flex flex-col gap-1.5 text-xs">
      {AGENT_STEPS.map((step) => {
        const current = seen.get(step.id)
        const isIdle = !current
        const status: StepStatus | "idle" = current?.status ?? "idle"
        const isRunning = status === "running"
        const dotClass =
          STATUS_DOT[status] + (isRunning ? " animate-pulse" : "")
        return (
          <li
            key={step.id}
            className="flex items-center gap-2"
            data-status={status}
          >
            <span className={cn("size-1.5 shrink-0 rounded-full", dotClass)} />
            <span
              className={cn(
                "flex-1",
                isIdle && "text-muted-foreground/60"
              )}
            >
              {step.label}
              {step.terminal ? " · final" : ""}
            </span>
            {isRunning ? (
              <Spinner className="size-3 text-amber-500" />
            ) : current ? (
              <Badge
                variant={
                  status === "success"
                    ? "success"
                    : status === "error"
                      ? "destructive"
                      : "secondary"
                }
                className="px-1.5 py-0 text-[10px]"
              >
                {STATUS_LABEL[status]}
              </Badge>
            ) : null}
            {current?.error ? (
              <span className="text-destructive max-w-[14rem] truncate text-[11px]">
                {current.error}
              </span>
            ) : null}
          </li>
        )
      })}
      {steps
        .filter((s) => !AGENT_STEPS_BY_ID[s.id])
        .map((s) => {
          const dot = STATUS_DOT[s.status]
          return (
            <li
              key={s.id}
              className="text-muted-foreground flex items-center gap-2"
              data-status={s.status}
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  dot
                )}
              />
              <span className="flex-1">{s.id}</span>
              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                {STATUS_LABEL[s.status]}
              </Badge>
            </li>
          )
        })}
    </ol>
  )
}
