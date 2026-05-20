"use client"
/**
 * AtlasDriftAlert · Section 2 · drift findings banner.
 *
 * Counts findings by severity + surfaces a single "Reconciliar" CTA
 * that scrolls to the AtlasDriftList below. If no drift detected the
 * banner is suppressed entirely (zero noise).
 */
import { WarningOctagon, ShieldCheck } from "@phosphor-icons/react/dist/ssr"
import { useAtlasDrift } from "../hooks/useAtlasDrift"
import { DRIFT_HUE, DRIFT_LABEL } from "../tokens"
import { AtlasStatusPill } from "./AtlasStatusPill"

export function AtlasDriftAlert() {
  const { data, isLoading } = useAtlasDrift()

  if (isLoading) {
    return (
      <section
        className="surface-card rim-instr p-4"
        data-rim="cyan"
        aria-busy="true"
      >
        <p className="relative z-[2] num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
          drift · loading…
        </p>
      </section>
    )
  }

  const findings = data?.findings ?? []
  const counts = {
    critical: findings.filter((f) => f.severity === "critical").length,
    warning: findings.filter((f) => f.severity === "warning").length,
    info: findings.filter((f) => f.severity === "info").length,
  }
  const total = findings.length

  if (total === 0) {
    return (
      <section className="surface-card rim-instr p-4" data-rim="cyan">
        <div className="relative z-[2] flex items-center gap-3">
          <ShieldCheck size={18} weight="regular" className="text-[hsl(var(--success))]" />
          <p className="text-sm">
            <span className="font-display font-medium">Sin drift detectado</span>
            <span className="ml-2 text-[hsl(var(--muted-foreground))]">canon === reality</span>
          </p>
        </div>
      </section>
    )
  }

  const primaryHue =
    counts.critical > 0 ? "rose" : counts.warning > 0 ? "amber" : "cyan"

  return (
    <section
      className="surface-card rim-instr p-4"
      data-rim={primaryHue === "rose" ? "rose" : primaryHue === "amber" ? "amber" : "cyan"}
      aria-label="Drift detection summary"
    >
      <div className="relative z-[2] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <WarningOctagon
            size={18}
            weight="regular"
            className={
              primaryHue === "rose"
                ? "text-[hsl(var(--danger))]"
                : "text-[hsl(var(--hue-amber))]"
            }
          />
          <div className="flex flex-col">
            <p className="text-sm">
              <span className="font-display font-medium">
                {total} drift {total === 1 ? "finding" : "findings"}
              </span>
              <span className="ml-2 text-[hsl(var(--muted-foreground))]">
                canon vs reality
              </span>
            </p>
            <div className="num mt-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em]">
              {(["critical", "warning", "info"] as const).map((sev) =>
                counts[sev] > 0 ? (
                  <AtlasStatusPill key={sev} hue={DRIFT_HUE[sev]} size="sm">
                    {counts[sev]} {DRIFT_LABEL[sev]}
                  </AtlasStatusPill>
                ) : null,
              )}
            </div>
          </div>
        </div>

        <a
          href="#atlas-drift-list"
          className="num self-start rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] transition-colors hover:bg-[hsl(var(--secondary))]"
        >
          reconciliar →
        </a>
      </div>
    </section>
  )
}
