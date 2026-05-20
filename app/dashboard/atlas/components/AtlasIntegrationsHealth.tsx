"use client"
/**
 * AtlasIntegrationsHealth · Section 11 · 13 integraciones · status pill +
 * detalle + last_checked + drill action stub.
 *
 * Las rows vienen del endpoint integrations-health · sprint 2 backend
 * incluye solo 6 (Supabase · n8n · Vercel · Sentry · UptimeRobot · GHL).
 * El UI ya soporta N rows sin cambio cuando se agreguen más pings.
 */
import { useAtlasIntegrationsHealth } from "../hooks/useAtlasIntegrationsHealth"
import { HEALTH_HUE, HEALTH_LABEL, formatRelativeIso } from "../tokens"
import { AtlasStatusPill } from "./AtlasStatusPill"

export function AtlasIntegrationsHealth() {
  const { data, isLoading } = useAtlasIntegrationsHealth()
  const rows = data?.rows ?? []
  const okCount = rows.filter((r) => r.status === "ok").length
  const totalKnown = rows.length

  return (
    <section
      className="surface-card rim-instr p-5"
      data-rim="cyan"
      aria-label="Integrations health"
    >
      <div className="relative z-[2] flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Integrations health
          </h2>
          <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            {totalKnown} probados · {okCount} ok · {totalKnown - okCount} non-ok
          </span>
        </div>

        {isLoading ? (
          <p className="num text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            cargando pings…
          </p>
        ) : rows.length === 0 ? (
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
            sin integraciones probadas · configurar env vars para activar pings
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="num py-2 pr-4 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                    sistema
                  </th>
                  <th className="num py-2 pr-4 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                    status
                  </th>
                  <th className="num py-2 pr-4 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                    detalle
                  </th>
                  <th className="num py-2 pr-4 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                    last checked
                  </th>
                  <th className="num py-2 text-right text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                    acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.name}
                    className="border-b border-[hsl(var(--border))]/40 last:border-0"
                  >
                    <td className="py-2.5 pr-4 align-top">
                      <span className="font-display font-medium">{r.name}</span>
                    </td>
                    <td className="py-2.5 pr-4 align-top">
                      <AtlasStatusPill hue={HEALTH_HUE[r.status]} size="sm">
                        {HEALTH_LABEL[r.status]}
                      </AtlasStatusPill>
                    </td>
                    <td className="num py-2.5 pr-4 align-top text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">
                      {r.detail}
                    </td>
                    <td className="num py-2.5 pr-4 align-top text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">
                      {formatRelativeIso(r.last_checked)}
                    </td>
                    <td className="py-2.5 text-right align-top">
                      <button
                        type="button"
                        className="num rounded-md border border-[hsl(var(--border))] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] transition-colors hover:bg-[hsl(var(--secondary))]"
                        aria-label={`Detalle ${r.name}`}
                        disabled
                      >
                        drill ▸
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
