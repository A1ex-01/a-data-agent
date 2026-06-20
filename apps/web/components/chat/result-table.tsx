"use client"

/**
 * ResultTable — render the SQL result rows returned by the agent.
 *
 * The backend's `run_sql` node produces `[dict(row) for row in …]` —
 * so we get a list of plain key/value records. We display them as a
 * compact table that scrolls horizontally if there are many columns.
 */

import { useMemo } from "react"

import { cn } from "@a-data-agent/shared"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface ResultTableProps {
  rows: ReadonlyArray<Record<string, unknown>>
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "object") {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

export function ResultTable({ rows }: ResultTableProps) {
  const columns = useMemo(() => {
    const seen = new Set<string>()
    for (const row of rows) {
      for (const key of Object.keys(row)) seen.add(key)
    }
    return Array.from(seen)
  }, [rows])

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Query executed successfully but returned no rows.
      </p>
    )
  }

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-md border",
        "max-h-80 overflow-y-auto"
      )}
    >
      <Table>
        <TableHeader className="bg-muted/40 sticky top-0 z-10 backdrop-blur">
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col} className="whitespace-nowrap text-xs">
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rowIdx) => (
            <TableRow key={rowIdx}>
              {columns.map((col) => (
                <TableCell
                  key={col}
                  className="whitespace-nowrap font-mono text-xs"
                >
                  {formatCell(row[col])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
