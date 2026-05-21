"use client"
import { useDraggable } from "@dnd-kit/core"
import { Lock, Clock, Pause } from "@phosphor-icons/react"
import type { JourneyCard } from "../types"

function formatRelative(iso: string | null): string {
  if (!iso) return "—"
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / (24 * 3600 * 1000))
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.floor(days / 30)}mo`
  return `${Math.floor(days / 365)}y`
}

export function KanbanCard({ card }: { card: JourneyCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { fromColumn: card.column },
  })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined

  const paused = card.status === "paused"

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group cursor-grab rounded border bg-[hsl(var(--background))] p-3 shadow-sm active:cursor-grabbing ${
        paused
          ? "border-amber-500/40 ring-1 ring-amber-500/20"
          : "border-[hsl(var(--border))]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm font-medium">
            {card.client_name}
          </div>
          {card.client_slug ? (
            <div className="num truncate text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              {card.client_slug}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {paused ? (
            <span
              title="journey paused"
              className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"
            >
              <Pause size={9} weight="bold" />
              paused
            </span>
          ) : null}
          {card.pending_hitl > 0 ? (
            <span
              title={`${card.pending_hitl} HITL pending`}
              className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"
            >
              <Lock size={9} weight="bold" />
              {card.pending_hitl}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">
        <span className="num rounded bg-[hsl(var(--muted))]/30 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em]">
          {card.journey}
        </span>
        {card.current_stage ? <span className="truncate">{card.current_stage}</span> : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[hsl(var(--border))]/40 pt-2">
        <div className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
          {card.trigger_source ?? card.trigger_type ?? "—"}
        </div>
        <div className="inline-flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]">
          <Clock size={9} />
          {formatRelative(card.last_activity_at)}
        </div>
      </div>
    </article>
  )
}
