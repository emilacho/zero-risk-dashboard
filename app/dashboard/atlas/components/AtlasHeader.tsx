"use client"
/**
 * AtlasHeader · Section 1 · title + version + last_validated_at strip.
 *
 * Pure presentational client component · consumes `last_validated_at`
 * from snapshot. Eyebrow chip + display title + meta strip · cero
 * cromatismo decorativo.
 */
import { useAtlasSnapshot } from "../hooks/useAtlasSnapshot"
import { formatRelativeIso } from "../tokens"

export function AtlasHeader() {
  const { data } = useAtlasSnapshot()
  const validatedAt = data?.last_validated_at ?? null

  return (
    <section
      className="surface-card rim-instr p-6"
      data-rim="cyan"
      aria-labelledby="atlas-title"
    >
      <div className="relative z-[2] flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="eyebrow-chip">ZeroRiskBible · v2</span>
          <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            ground truth dashboard
          </span>
        </div>

        <h1
          id="atlas-title"
          className="font-display text-2xl font-semibold tracking-tight"
        >
          Atlas del sistema
        </h1>

        <p className="max-w-[60ch] text-sm text-[hsl(var(--muted-foreground))]">
          Mapa canónico de agentes · workflows · clientes · integraciones ·
          contrastados contra Tier 1 ground truth (Supabase · n8n · git).
        </p>

        <div className="num mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
          <span>
            last validated · {formatRelativeIso(validatedAt)}
            {validatedAt ? (
              <span className="ml-2 normal-case lowercase tracking-normal opacity-60">
                ({new Date(validatedAt).toLocaleString()})
              </span>
            ) : null}
          </span>
          <span>audit cadence · 60s stale · 5min gc</span>
          <span>sprint · 2 · equipo B</span>
        </div>
      </div>
    </section>
  )
}
