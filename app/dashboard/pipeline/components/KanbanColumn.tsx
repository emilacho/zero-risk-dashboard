"use client"
import { useDroppable } from "@dnd-kit/core"
import { KanbanCard } from "./KanbanCard"
import { STATE_LABEL } from "../types"
import type { JourneyCard, JourneyState } from "../types"

interface KanbanColumnProps {
  state: JourneyState
  cards: JourneyCard[]
}

export function KanbanColumn({ state, cards }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: state })
  return (
    <div
      ref={setNodeRef}
      className={`flex h-full min-w-[260px] flex-1 flex-col gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 p-3 transition-colors ${
        isOver ? "border-[hsl(var(--foreground))]/50 bg-[hsl(var(--muted))]/40" : ""
      }`}
      data-state={state}
    >
      <header className="flex items-baseline justify-between">
        <h3 className="font-display text-sm font-semibold tracking-tight">
          {STATE_LABEL[state]}
        </h3>
        <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
          {cards.length}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {cards.map((c) => (
          <KanbanCard key={c.id} card={c} />
        ))}
        {cards.length === 0 ? (
          <div className="num flex flex-1 items-center justify-center rounded border border-dashed border-[hsl(var(--border))]/50 py-6 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            empty
          </div>
        ) : null}
      </div>
    </div>
  )
}
