"use client"
/**
 * AtlasClientsTable · Section 6 · clients table.
 *
 * Rows · active first (Náufrago + Pérez) · then smoke-with-data (Peniche
 * etc) · then smoke-empty collapsed into a single summary row to keep
 * the table scannable.
 */
import { useState } from "react"
import { CaretDown, CaretRight } from "@phosphor-icons/react/dist/ssr"
import { useAtlasClients } from "../hooks/useAtlasClients"
import type { AtlasClientRow } from "../types"
import { formatRelativeIso } from "../tokens"
import { AtlasStatusPill } from "./AtlasStatusPill"

function clientHue(row: AtlasClientRow): "emerald" | "amber" | "muted" {
  if (row.invocations_30d > 0) return "emerald"
  if (row.journey_status && row.journey_status !== "smoke") return "amber"
  return "muted"
}

export function AtlasClientsTable() {
  const { data } = useAtlasClients()
  const [smokeExpanded, setSmokeExpanded] = useState(false)
  const rows = data?.rows ?? []
  const active = rows.filter((r) => r.invocations_30d > 0)
  const withDataNoExec = rows.filter(
    (r) => r.invocations_30d === 0 && r.journey_status && r.journey_status !== "smoke",
  )
  const smoke = rows.filter(
    (r) => r.invocations_30d === 0 && (!r.journey_status || r.journey_status === "smoke"),
  )

  return (
    <section
      className="surface-card rim-instr p-5"
      data-rim="cyan"
      aria-label="Clientes"
    >
      <div className="relative z-[2] flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Clientes
          </h2>
          <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            {data?.total ?? 0} total · {data?.active_real ?? 0} active ·{" "}
            {smoke.length} smoke
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="num py-2 pr-4 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                  cliente
                </th>
                <th className="num py-2 pr-4 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                  vertical
                </th>
                <th className="num py-2 pr-4 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                  journey
                </th>
                <th className="num py-2 pr-4 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                  status
                </th>
                <th className="num py-2 pr-4 text-right text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                  invocations 30d
                </th>
                <th className="num py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                  last activity
                </th>
              </tr>
            </thead>
            <tbody>
              {[...active, ...withDataNoExec].map((c) => {
                const hue = clientHue(c)
                return (
                  <tr
                    key={c.id}
                    className="border-b border-[hsl(var(--border))]/40 last:border-0"
                  >
                    <td className="py-2.5 pr-4 align-top">
                      <span className="font-display font-medium">{c.name}</span>
                    </td>
                    <td className="py-2.5 pr-4 align-top text-[hsl(var(--muted-foreground))]">
                      {c.vertical ?? "—"}
                    </td>
                    <td className="num py-2.5 pr-4 align-top text-[11px] text-[hsl(var(--muted-foreground))]">
                      {c.journey_status ?? "—"}
                    </td>
                    <td className="py-2.5 pr-4 align-top">
                      <AtlasStatusPill hue={hue} size="sm">
                        {hue === "emerald"
                          ? "active"
                          : hue === "amber"
                            ? "stuck"
                            : "idle"}
                      </AtlasStatusPill>
                    </td>
                    <td className="num py-2.5 pr-4 text-right align-top tabular-nums font-semibold">
                      {c.invocations_30d}
                    </td>
                    <td className="num py-2.5 align-top text-[11px] text-[hsl(var(--muted-foreground))]">
                      {formatRelativeIso(c.last_activity_at)}
                    </td>
                  </tr>
                )
              })}

              {smoke.length > 0 ? (
                <tr className="border-b border-[hsl(var(--border))]/40 last:border-0">
                  <td colSpan={6} className="py-2.5">
                    <button
                      type="button"
                      onClick={() => setSmokeExpanded((s) => !s)}
                      className="flex w-full items-center gap-2 text-left"
                      aria-expanded={smokeExpanded}
                    >
                      {smokeExpanded ? (
                        <CaretDown size={12} weight="regular" />
                      ) : (
                        <CaretRight size={12} weight="regular" />
                      )}
                      <span className="num text-[11px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                        {smoke.length} smoke clients · empty · expand
                      </span>
                    </button>
                  </td>
                </tr>
              ) : null}

              {smokeExpanded
                ? smoke.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-[hsl(var(--border))]/30 bg-[hsl(var(--secondary))]/40 last:border-0"
                    >
                      <td className="py-2 pr-4 align-top text-[hsl(var(--muted-foreground))]">
                        {c.name}
                      </td>
                      <td className="py-2 pr-4 align-top text-[hsl(var(--muted-foreground))]">
                        {c.vertical ?? "—"}
                      </td>
                      <td className="py-2 pr-4 align-top text-[11px] text-[hsl(var(--muted-foreground))]">
                        {c.journey_status ?? "—"}
                      </td>
                      <td className="py-2 pr-4 align-top">
                        <AtlasStatusPill hue="muted" size="sm">
                          smoke
                        </AtlasStatusPill>
                      </td>
                      <td className="num py-2 pr-4 text-right align-top tabular-nums">0</td>
                      <td className="num py-2 align-top text-[11px] text-[hsl(var(--muted-foreground))]">
                        —
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
