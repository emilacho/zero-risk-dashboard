"use client"
/**
 * AtlasStackGrid · Section 7 · 2 cards side-by-side · stack técnico
 * canónico de cada repo del workspace.
 *
 * Dependencies hardcoded · canon V3 reference. Versions live se leen
 * por inspección manual periódica (no API endpoint dedicado en sprint
 * 2 · post-MVP es candidate para auto-sync via package.json read).
 */

interface StackEntry {
  repo: string
  next: string
  highlight: string
  deps: Array<{ name: string; version: string; note?: string }>
}

const STACK: StackEntry[] = [
  {
    repo: "zero-risk-platform",
    next: "Next 15 + React 19",
    highlight: "Tailwind v4 · Supabase Pro · Anthropic Managed Agents · n8n Railway",
    deps: [
      { name: "next", version: "^15.1.0" },
      { name: "react", version: "^19.0.0" },
      { name: "@anthropic-ai/sdk", version: "^0.40.x" },
      { name: "@supabase/supabase-js", version: "^2.47.0" },
      { name: "tailwindcss", version: "^4.0.0" },
      { name: "zod", version: "^3.25.76" },
    ],
  },
  {
    repo: "zero-risk-dashboard",
    next: "Next 15 + React 19",
    highlight: "Tremor · @xyflow/react · TanStack Query · Phosphor · Lumen design",
    deps: [
      { name: "next", version: "^15.1.0" },
      { name: "react", version: "^19.0.0" },
      { name: "@tanstack/react-query", version: "^5.100.11" },
      { name: "@tanstack/react-table", version: "^8.21.3" },
      { name: "@tremor/react", version: "^3.18.0" },
      { name: "@xyflow/react", version: "^12.4.0" },
      { name: "@phosphor-icons/react", version: "^2.1.10" },
      { name: "framer-motion", version: "^11.15.0" },
    ],
  },
]

export function AtlasStackGrid() {
  return (
    <section aria-label="Stack técnico">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {STACK.map((s) => (
          <div key={s.repo} className="surface-card rim-instr p-5" data-rim="cyan">
            <div className="relative z-[2] flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <span className="eyebrow-chip">{s.next}</span>
                  <h3 className="font-display mt-2 text-base font-semibold leading-none tracking-tight">
                    {s.repo}
                  </h3>
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                {s.highlight}
              </p>

              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-[hsl(var(--border))]/60">
                    <th className="num py-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                      pkg
                    </th>
                    <th className="num py-1.5 text-right text-[9px] font-medium uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                      version
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {s.deps.map((d) => (
                    <tr
                      key={d.name}
                      className="border-b border-[hsl(var(--border))]/30 last:border-0"
                    >
                      <td className="num py-1.5 pr-3 tabular-nums">{d.name}</td>
                      <td className="num py-1.5 text-right tabular-nums text-[hsl(var(--muted-foreground))]">
                        {d.version}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
