"use client"
/**
 * ClickableSummaryCard · STEP 4.5 reusable pattern.
 *
 * Use case · any KPI tile that surfaces a count + needs drill-down ·
 * "Untagged agents · 15" · "Active 9/59" · "Workflows 36 active" ·
 * "HITL pending · N" · etc.
 *
 *   - Card · violet rim · count + label + optional icon + optional
 *     sub-line · cursor pointer · subtle hover lift
 *   - Modal · Radix Dialog · sobrio · dark bg + violet glow border
 *     0.5px hairline · max-w 600px · header with title + count +
 *     close · scrollable body · table of items + optional drill-down
 *     link per row
 *
 * NO function-prop callbacks crossing boundary · client component
 * receives primitive `items[]` (already loaded server-side by the
 * calling page · pre-serialized).
 */
import type { ReactNode } from "react"
import { useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import Link from "next/link"
import { X, ArrowRight, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr"

export type SummaryHue =
  | "violet"
  | "cyan"
  | "amber"
  | "emerald"
  | "rose"
  | "orange"
  | "purple"
  | "teal"
  | "sky"
  | "lime"

export interface SummaryItem {
  /** Primary identifier shown left · mono · usually slug or short id */
  primary: string
  /** Optional secondary label shown next to primary · e.g. role · model · status */
  secondary?: string
  /** Optional tertiary · e.g. last activity · cost · count · relative time */
  tertiary?: string
  /** Optional status string · drives color dot in row · "active" | "completed" | "failed" | "pending" | etc */
  status?: string
  /** Optional drill-down href · row click navigates here · external if /https?:/ */
  href?: string
}

export interface ClickableSummaryCardProps {
  title: string
  /** Number rendered big · supports null for "—" placeholder. Used as
   * the modal header "Title · count" too. */
  count: number | null
  /** Optional pre-formatted display value (e.g. "$6.85" · "99.1%") ·
   * overrides numeric rendering of `count`. The numeric `count` is
   * still used for the modal header. */
  displayValue?: string
  /** Optional sub-label below count · e.g. "of 59 total · utilization 15%" */
  sub?: string
  /** Hue token · drives rim color + dot color */
  hue?: SummaryHue
  /** Icon node · 16-20px lucide stroke 1.5 typical */
  icon?: ReactNode
  /** Rows to show in drill-down modal · loaded server-side */
  items: SummaryItem[]
  /** Modal header description · explains what the rows represent */
  modalDescription?: string
  /** Optional "see all" link at bottom of modal (e.g. /system/agents) */
  seeAllHref?: string
  /** "wire pending" badge when value source unwired · disables modal */
  badge?: string
  /** Card variant · "compact" for grids · "full" for standalone */
  variant?: "compact" | "full"
}

function statusColor(status: string | undefined): string {
  if (!status) return "hsl(var(--muted-foreground))"
  const s = status.toLowerCase()
  if (
    s === "completed" ||
    s === "active" ||
    s === "success" ||
    s === "live" ||
    s === "ok"
  )
    return "hsl(var(--success))"
  if (s === "failed" || s === "error" || s === "rejected") return "hsl(var(--danger))"
  if (
    s === "pending" ||
    s === "queued" ||
    s === "running" ||
    s === "in_progress" ||
    s === "creating"
  )
    return "hsl(var(--accent))"
  if (s === "paused" || s === "idle" || s === "draft" || s === "deprecated")
    return "hsl(var(--hue-amber))"
  return "hsl(var(--muted-foreground))"
}

export function ClickableSummaryCard({
  title,
  count,
  displayValue,
  sub,
  hue = "violet",
  icon,
  items,
  modalDescription,
  seeAllHref,
  badge,
  variant = "compact",
}: ClickableSummaryCardProps) {
  const [open, setOpen] = useState(false)
  const isPending = count == null || badge === "wire pending"
  const isFull = variant === "full"

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          disabled={isPending || items.length === 0}
          className={[
            "surface-card rim-instr group relative w-full text-left disabled:cursor-not-allowed",
            isFull ? "p-5" : "p-4",
          ].join(" ")}
          data-rim={hue}
          data-pop="true"
        >
          <div className="relative z-[2]">
            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
              {icon ? (
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-md border-[0.5px]"
                  style={{
                    borderColor: `hsl(var(--hue-${hue}) / 0.4)`,
                    background: `hsl(var(--hue-${hue}) / 0.12)`,
                    color: `hsl(var(--hue-${hue}))`,
                  }}
                >
                  {icon}
                </span>
              ) : null}
              <span className="font-mono text-[10px] uppercase tracking-[0.18em]">
                {title}
              </span>
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <span
                className={[
                  "font-display font-semibold leading-none tabular-nums",
                  isFull ? "text-4xl" : "text-2xl",
                ].join(" ")}
                style={{ color: isPending ? "hsl(var(--muted-foreground))" : undefined }}
              >
                {isPending
                  ? "—"
                  : (displayValue ?? count.toLocaleString("en-US"))}
              </span>
              {!isPending && items.length > 0 ? (
                <span
                  className="num text-[10px] uppercase tracking-[0.16em] transition group-hover:text-foreground"
                  style={{ color: `hsl(var(--hue-${hue}))` }}
                >
                  ver lista →
                </span>
              ) : badge ? (
                <span className="num text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--danger))] opacity-80">
                  {badge}
                </span>
              ) : null}
            </div>
            {sub ? (
              <p className="num mt-1 text-[10px] tabular-nums text-[hsl(var(--muted-foreground))]">
                {sub}
              </p>
            ) : null}
          </div>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm data-[state=open]:animate-blur-fade" />
        <Dialog.Content
          className="surface-card rim-instr fixed left-1/2 top-1/2 z-[71] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 p-6"
          data-rim={hue}
        >
          <div className="relative z-[2]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p
                  className="num text-[10px] uppercase tracking-[0.22em]"
                  style={{ color: `hsl(var(--hue-${hue}))` }}
                >
                  drill-down · {items.length} rows
                </p>
                <Dialog.Title className="font-display text-xl font-semibold tracking-tight">
                  {title} · {displayValue ?? count?.toLocaleString("en-US") ?? "—"}
                </Dialog.Title>
                {modalDescription ? (
                  <p className="num mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                    {modalDescription}
                  </p>
                ) : null}
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--primary-glow)/0.08)]"
                >
                  <X strokeWidth={1.5} className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            {items.length === 0 ? (
              <p className="num text-xs text-[hsl(var(--muted-foreground))]">
                Sin items que mostrar.
              </p>
            ) : (
              <ul className="max-h-[60vh] divide-y divide-[hsl(var(--border)/0.6)] overflow-y-auto">
                {items.map((it, i) => {
                  const isExternal = it.href?.startsWith("http")
                  const Inner = (
                    <div className="flex items-center justify-between gap-3 px-1 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {it.status ? (
                            <span
                              className="inline-block h-1.5 w-1.5 rounded-full"
                              style={{ background: statusColor(it.status) }}
                            />
                          ) : null}
                          <span className="font-mono text-[12px] text-[hsl(var(--accent))]">
                            {it.primary}
                          </span>
                          {it.secondary ? (
                            <span className="num text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                              {it.secondary}
                            </span>
                          ) : null}
                        </div>
                        {it.tertiary ? (
                          <p className="num mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                            {it.tertiary}
                          </p>
                        ) : null}
                      </div>
                      {it.href ? (
                        isExternal ? (
                          <ArrowSquareOut
                            strokeWidth={1.5}
                            className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--accent))]"
                          />
                        ) : (
                          <ArrowRight
                            strokeWidth={1.5}
                            className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--accent))]"
                          />
                        )
                      ) : null}
                    </div>
                  )
                  if (!it.href) {
                    return <li key={`${it.primary}-${i}`}>{Inner}</li>
                  }
                  return (
                    <li key={`${it.primary}-${i}`}>
                      {isExternal ? (
                        <a
                          href={it.href}
                          target="_blank"
                          rel="noreferrer"
                          className="block transition hover:bg-[hsl(var(--primary-glow)/0.06)]"
                        >
                          {Inner}
                        </a>
                      ) : (
                        <Link
                          href={it.href}
                          onClick={() => setOpen(false)}
                          className="block transition hover:bg-[hsl(var(--primary-glow)/0.06)]"
                        >
                          {Inner}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {seeAllHref ? (
              <div className="mt-4 flex justify-end">
                <Link
                  href={seeAllHref}
                  onClick={() => setOpen(false)}
                  className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:text-foreground"
                >
                  → ver todos en vista completa
                </Link>
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
