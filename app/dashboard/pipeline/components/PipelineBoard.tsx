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
import { JOURNEY_STATES, STATE_LABEL } from "../types"
import type { JourneyState } from "../types"
import { KanbanColumn } from "./KanbanColumn"

export function PipelineBoard() {
  const { data, isLoading, error } = usePipelineJourneys()
  const move = useMoveJourney()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const states = useMemo<JourneyState[]>(
    () => (data?.states ?? JOURNEY_STATES.filter((s) => s !== "churned")) as JourneyState[],
    [data?.states],
  )

  function handleDragEnd(e: DragEndEvent) {
    const id = e.active.id as string
    const fromState = (e.active.data?.current as { fromState?: JourneyState } | undefined)
      ?.fromState
    const toState = e.over?.id as JourneyState | undefined
    if (!id || !toState || !fromState || fromState === toState) return
    if (!JOURNEY_STATES.includes(toState)) return
    move.mutate({ id, to_state: toState })
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
              {data?.total ?? 0} journeys · drag entre columnas para mover stage
            </p>
          </div>
          <div className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            {states.length} stages canónicos · journey_executions
          </div>
        </header>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex h-[68vh] gap-3 overflow-x-auto">
            {states.map((s) => (
              <KanbanColumn
                key={s}
                state={s}
                cards={(data?.columns?.[s] ?? []) as never}
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
          {states.map((s) => (
            <span key={s} className="inline-flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-[hsl(var(--foreground))]/40" />
              {STATE_LABEL[s]}
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
