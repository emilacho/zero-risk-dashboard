"use client"
/**
 * LiveAgentFeed · STEP 10 · home control panel realtime feed.
 *
 *   - Server seeds the initial 5-7 rows + 24h counter via
 *     loadAgentFeed() and passes them as primitives.
 *   - On mount · subscribes to Supabase Realtime postgres-changes on
 *     `agent_invocations` INSERT · prepends new rows + bumps counter
 *     with a fade-in stagger.
 *   - Polling fallback · every 30s the client refetches
 *     `/api/agents/recent-feed` and merges any rows the realtime
 *     channel missed (RLS gaps · transient disconnects). Belt-and-
 *     braces.
 *   - Each row hover-expands the metadata (input + output preview)
 *     via Radix Tooltip · agente icon (STEP 7 NodeIcons) on the
 *     left · status pill + cost on the right · link to /agents/
 *     {slug}.
 *
 * Phase 4.1 regression-safe · receives plain serializable objects ·
 * exposes no callback props · no server→client function pass-through.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import * as Tooltip from "@radix-ui/react-tooltip"
import { Activity, ExternalLink, Loader2, Plug, WifiOff } from "lucide-react"
import { getBrowserClient } from "@/lib/supabase-browser"
import { IconForKind } from "@/components/workflows/NodeIcons"
import { formatValue } from "@/components/AnimatedNumber"
import type { AgentFeedRow } from "@/lib/agent-feed"

interface LiveAgentFeedProps {
  initialRows: AgentFeedRow[]
  initialCount24h: number
  initialCost24h: number
  /** Max rows kept in the visible feed · scroll older off the bottom. */
  maxRows?: number
  /** Polling-fallback interval ms · default 30s. */
  pollMs?: number
}

const STATUS_HUE: Record<string, { color: string; label: string }> = {
  ok: { color: "hsl(var(--success))", label: "ok" },
  running: { color: "hsl(var(--accent))", label: "running" },
  queued: { color: "hsl(var(--hue-amber))", label: "queued" },
  failed: { color: "hsl(var(--danger))", label: "failed" },
  unknown: { color: "hsl(var(--muted-foreground))", label: "unknown" },
}

function fmtAgo(iso: string): string {
  if (!iso) return "—"
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 1000) return "just now"
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return `${Math.floor(ms / 86_400_000)}d ago`
}

/** Heuristic icon kind for an agent row · agente (default) · camino_qa
 * when the slug screams QA / Camino / reviewer · cliente when slug ==
 * "cliente" (rare · just for completeness). */
function iconForAgent(slug: string): "agente" | "camino_qa" | "cliente" {
  const s = slug.toLowerCase()
  if (/(qa|camino|reviewer|critic)/.test(s)) return "camino_qa"
  if (s === "cliente") return "cliente"
  return "agente"
}

function statusFromAnyRaw(raw: unknown): string {
  const s = String(raw ?? "").toLowerCase()
  if (s.includes("error") || s.includes("fail")) return "failed"
  if (s.includes("complet") || s === "ok" || s === "done") return "ok"
  if (s.includes("run") || s.includes("progress")) return "running"
  if (s.includes("queue")) return "queued"
  return s || "unknown"
}

export function LiveAgentFeed({
  initialRows,
  initialCount24h,
  initialCost24h,
  maxRows = 7,
  pollMs = 30_000,
}: LiveAgentFeedProps) {
  const [rows, setRows] = useState<AgentFeedRow[]>(initialRows.slice(0, maxRows))
  const [count24h, setCount24h] = useState(initialCount24h)
  const [cost24h, setCost24h] = useState(initialCost24h)
  const [channelState, setChannelState] = useState<
    "connecting" | "live" | "polling" | "error"
  >("connecting")
  const lastInsertAtRef = useRef<number>(Date.now())

  // Reload from API endpoint · used by realtime fallback + initial
  // retry path. Merges by id to keep the optimistic realtime rows.
  const refetch = useMemo(
    () => async () => {
      try {
        const res = await fetch("/api/agents/recent-feed?limit=" + maxRows, {
          cache: "no-store",
        })
        const json = (await res.json()) as {
          ok: boolean
          rows?: AgentFeedRow[]
          count24h?: number
          totalCost24h?: number
        }
        if (!json.ok || !Array.isArray(json.rows)) return
        setRows((prev) => {
          const map = new Map<string, AgentFeedRow>()
          for (const r of [...json.rows!, ...prev]) {
            map.set(r.id, r)
          }
          return [...map.values()]
            .sort(
              (a, b) =>
                new Date(b.startedAt).getTime() -
                new Date(a.startedAt).getTime(),
            )
            .slice(0, maxRows)
        })
        if (typeof json.count24h === "number") setCount24h(json.count24h)
        if (typeof json.totalCost24h === "number") setCost24h(json.totalCost24h)
      } catch {
        /* swallow · stays on last known good */
      }
    },
    [maxRows],
  )

  // ── Realtime subscription ────────────────────────────────────────
  useEffect(() => {
    const supa = getBrowserClient()
    const channel = supa
      .channel("agent_invocations:live-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agent_invocations" },
        (payload) => {
          const r = payload.new as Record<string, unknown>
          const id = String(r.id ?? "")
          if (!id) return
          const meta = (r.metadata as Record<string, unknown>) ?? {}
          const newRow: AgentFeedRow = {
            id,
            startedAt: String(r.started_at ?? new Date().toISOString()),
            agentName: String(r.agent_name ?? "_unknown"),
            // Realtime payload doesn't carry the joined client name ·
            // best-effort label from metadata fields · the polling
            // pass will reconcile with the proper resolver.
            clientLabel:
              typeof meta.client_label === "string"
                ? (meta.client_label as string)
                : String(r.client_id ?? "Unknown"),
            status: statusFromAnyRaw(r.status),
            costUsd:
              typeof r.cost_usd === "number" ? Number(r.cost_usd) : null,
            model: (r.model as string) ?? null,
            durationMs: (r.duration_ms as number) ?? null,
            inputPreview:
              typeof meta.input === "string"
                ? (meta.input as string).slice(0, 140)
                : null,
            outputPreview:
              typeof meta.output === "string"
                ? (meta.output as string).slice(0, 200)
                : null,
          }
          setRows((prev) => {
            if (prev.some((p) => p.id === newRow.id)) return prev
            return [newRow, ...prev].slice(0, maxRows)
          })
          setCount24h((c) => c + 1)
          if (typeof newRow.costUsd === "number") {
            setCost24h((c) => c + (newRow.costUsd ?? 0))
          }
          lastInsertAtRef.current = Date.now()
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setChannelState("live")
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          setChannelState("error")
      })
    return () => {
      void supa.removeChannel(channel)
    }
  }, [maxRows])

  // ── Polling fallback ─────────────────────────────────────────────
  // Triggers when realtime has been silent for > pollMs OR channel
  // errored out. Lightweight · 1 API call every interval.
  useEffect(() => {
    const id = window.setInterval(() => {
      const silentFor = Date.now() - lastInsertAtRef.current
      if (channelState === "error" || silentFor > pollMs) {
        if (channelState !== "error") setChannelState("polling")
        void refetch()
      }
    }, pollMs)
    return () => window.clearInterval(id)
  }, [channelState, pollMs, refetch])

  // ── Render ───────────────────────────────────────────────────────
  return (
    <section className="surface-card rim-instr p-5" data-rim="cyan">
      <div className="relative z-[2] flex flex-col gap-3">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border-[0.5px] border-[hsl(var(--accent)/0.5)] bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))]">
              <Activity strokeWidth={1.5} className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight">
                Equipo virtual · live feed
              </h2>
              <p className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                últimas {rows.length} invocaciones · {count24h.toLocaleString("en-US")} en 24h ·{" "}
                {formatValue(cost24h, "currency", {
                  decimals: cost24h < 1 ? 4 : 2,
                })}{" "}
                spend
              </p>
            </div>
          </div>
          <FeedStateBadge state={channelState} />
        </header>

        {rows.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border-[0.5px] border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/0.3)] px-3 py-6 text-[12px] text-[hsl(var(--muted-foreground))]">
            <Loader2 strokeWidth={1.5} className="h-3.5 w-3.5 animate-spin" />
            Esperando actividad de agentes…
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {rows.map((r, i) => (
                <motion.li
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: -8, scale: 0.985 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { delay: i === 0 ? 0 : Math.min(i, 6) * 0.025 },
                  }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 32,
                  }}
                >
                  <FeedRow row={r} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  )
}

function FeedStateBadge({
  state,
}: {
  state: "connecting" | "live" | "polling" | "error"
}) {
  if (state === "live") {
    return (
      <span className="num inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--success))]">
        <span className="animate-breathing inline-block h-2 w-2 rounded-full bg-[hsl(var(--success))]" />
        Realtime
      </span>
    )
  }
  if (state === "polling") {
    return (
      <span className="num inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--hue-amber))]">
        <Plug strokeWidth={1.5} className="h-3 w-3" />
        Polling fallback
      </span>
    )
  }
  if (state === "error") {
    return (
      <span className="num inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--danger))]">
        <WifiOff strokeWidth={1.5} className="h-3 w-3" />
        Realtime offline
      </span>
    )
  }
  return (
    <span className="num inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
      <Loader2 strokeWidth={1.5} className="h-3 w-3 animate-spin" />
      Conectando…
    </span>
  )
}

function FeedRow({ row }: { row: AgentFeedRow }) {
  const status = STATUS_HUE[row.status] ?? STATUS_HUE.unknown
  const iconKind = iconForAgent(row.agentName)
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Link
            href={`/agents/${row.agentName}`}
            className="group flex items-center gap-3 rounded-md border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.45)] px-3 py-2 transition hover:border-[hsl(var(--accent)/0.5)] hover:bg-[hsl(var(--accent)/0.05)]"
          >
            {/* agent icon · large enough to read as "empleado virtual" */}
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.35)] bg-[hsl(var(--primary-glow)/0.1)]"
              style={{ color: "hsl(var(--accent))" }}
            >
              <IconForKind kind={iconKind} size={26} strokeWidth={1.5} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-[11.5px] text-[hsl(var(--accent))]">
                  {row.agentName}
                </span>
                <span className="num text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                  → {row.clientLabel}
                </span>
              </div>
              <p className="num mt-0.5 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                <span>{fmtAgo(row.startedAt)}</span>
                {row.model ? <span>· {row.model}</span> : null}
                {row.durationMs != null ? (
                  <span>
                    ·{" "}
                    {row.durationMs < 1000
                      ? `${row.durationMs}ms`
                      : `${(row.durationMs / 1000).toFixed(1)}s`}
                  </span>
                ) : null}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                className="num inline-flex items-center gap-1 rounded-full border-[0.5px] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em]"
                style={{
                  borderColor: `${status.color} / 0.4`,
                  color: status.color,
                  background: "transparent",
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: status.color }}
                />
                {status.label}
              </span>
              {typeof row.costUsd === "number" ? (
                <span className="num text-[10px] tabular-nums text-[hsl(var(--muted-foreground))]">
                  {formatValue(row.costUsd, "currency", {
                    decimals: row.costUsd < 0.01 ? 5 : row.costUsd < 1 ? 4 : 2,
                  })}
                </span>
              ) : null}
              <ExternalLink
                strokeWidth={1.5}
                className="h-3 w-3 text-[hsl(var(--muted-foreground))] transition group-hover:text-[hsl(var(--accent))]"
              />
            </div>
          </Link>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="bottom"
            align="start"
            sideOffset={6}
            className="surface-card rim-instr z-[80] max-w-[420px] p-3"
            data-rim="cyan"
          >
            <div className="relative z-[2] flex flex-col gap-2">
              <p className="num text-[9px] uppercase tracking-[0.22em] text-[hsl(var(--accent))]">
                Invocación · {row.id.slice(0, 8)}…
              </p>
              {row.inputPreview ? (
                <div>
                  <p className="num text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                    input
                  </p>
                  <p className="whitespace-pre-wrap text-[11px] text-[hsl(var(--foreground))]">
                    {row.inputPreview}
                  </p>
                </div>
              ) : null}
              {row.outputPreview ? (
                <div>
                  <p className="num text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                    output
                  </p>
                  <p className="whitespace-pre-wrap text-[11px] text-[hsl(var(--foreground))]">
                    {row.outputPreview}
                  </p>
                </div>
              ) : null}
              {!row.inputPreview && !row.outputPreview ? (
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  Sin preview disponible · click → ver detalle en /agents/{row.agentName}
                </p>
              ) : null}
            </div>
            <Tooltip.Arrow className="fill-[hsl(var(--card))]" width={10} height={4} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
