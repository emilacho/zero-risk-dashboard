"use client"
import { useMemo } from "react"
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { usePipelineJourneys, useMoveJourney } from "../hooks/usePipelineJourneys"
import { KANBAN_COLUMNS, COLUMN_LABEL } from "../types"
import type { KanbanColumn as KanbanColumnId } from "../types"
import { KanbanColumn } from "./KanbanColumn"

export function PipelineBoard() {
  const { data, isLoading, error } = usePipelineJourneys()
  const move = useMoveJourney()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const columns = useMemo<KanbanColumnId[]>(
    () => (data?.states ?? KANBAN_COLUMNS) as KanbanColumnId[],
    [data?.states],
  )

  function handleDragEnd(e: DragEndEvent) {
    const id = e.active.id as string
    const fromColumn = (e.active.data?.current as { fromColumn?: KanbanColumnId } | undefined)
      ?.fromColumn
    const toColumn = e.over?.id as KanbanColumnId | undefined
    if (!id || !toColumn || !fromColumn || fromColumn === toColumn) return
    if (!KANBAN_COLUMNS.includes(toColumn)) return
    move.mutate({ id, to_column: toColumn })
  }

  if (isLoading) return <BoardSkeleton />
  if (error) {
    return (
      <div className="rounded border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/5 p-4 text-sm text-[hsl(var(--destructive))]">
        Pipeline load failed · {(error as Error).message}
      </div>
    )
  }

  return (
    <section className="surface-card rim-instr p-5" data-rim="violet">
      <div className="relative z-[2] flex flex-col gap-4">
        <header className="flex items-baseline justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Pipeline
            </h2>
            <p className="num mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              {data?.total ?? 0} journeys · source · {data?.source_table ?? "client_journey_state"} · drag entre columnas
            </p>
          </div>
          <div className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            {columns.length} columnas canónicas
          </div>
        </header>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex h-[68vh] gap-3 overflow-x-auto">
            {columns.map((c) => (
              <KanbanColumn
                key={c}
                column={c}
                cards={(data?.columns?.[c] ?? []) as never}
              />
            ))}
          </div>
        </DndContext>

        {move.isError ? (
          <div className="rounded border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/5 p-2 text-xs text-[hsl(var(--destructive))]">
            Move failed · reverted · {(move.error as Error).message}
          </div>
        ) : null}

        <footer className="num flex items-center gap-2 border-t border-[hsl(var(--border))]/40 pt-3 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
          legend ·
          {columns.map((c) => (
            <span key={c} className="inline-flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-[hsl(var(--foreground))]/40" />
              {COLUMN_LABEL[c]}
            </span>
          ))}
        </footer>
      </div>
    </section>
  )
}

function BoardSkeleton() {
  return (
    <div className="flex h-[68vh] gap-3 overflow-x-auto" aria-label="loading pipeline">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="min-w-[260px] flex-1 animate-pulse rounded-lg bg-[hsl(var(--muted))]/30"
        />
      ))}
    </div>
  )
}
