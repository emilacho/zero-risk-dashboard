"use client"
/**
 * AtlasDriftList · Section 9 · expandable drift findings list.
 *
 * Sorted by severity (critical → warning → info). Each row collapsible
 * con detalle canon vs real + evidence_path. CTA "Reconciliar" copia un
 * prompt Cowork-ready al clipboard (template canon).
 */
import { useState, useCallback } from "react"
import {
  CaretDown,
  CaretRight,
  Copy,
  Check,
  WarningOctagon,
} from "@phosphor-icons/react/dist/ssr"
import { useAtlasDrift } from "../hooks/useAtlasDrift"
import type { AtlasDriftFinding } from "../types"
import { DRIFT_HUE, DRIFT_LABEL, DRIFT_SORT_ORDER } from "../tokens"
import { AtlasStatusPill } from "./AtlasStatusPill"

function buildReconcilePrompt(finding: AtlasDriftFinding): string {
  return [
    `[ATLAS-RECONCILE-REQUEST · ${finding.id}]`,
    ``,
    `Contexto · drift detectado en Atlas dashboard · severity ${finding.severity}.`,
    ``,
    `Qué · ${finding.what}`,
    `Canon dice · ${finding.canon_says}`,
    `Realidad es · ${finding.real_is}`,
    `Evidence path · ${finding.evidence_path}`,
    ``,
    `Acción requerida · reconciliar la divergencia (actualizar canon doc OR fix realidad).`,
    `Decidir vía Cowork qué lado mueve · usualmente canon doc se actualiza si la realidad es la deseada · OR migración/fix si canon era la verdad.`,
    ``,
    `Response signal · [ATLAS-RECONCILE-DONE-${finding.id}]`,
  ].join("\n")
}

function DriftRow({ finding }: { finding: AtlasDriftFinding }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildReconcilePrompt(finding))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // graceful fallback · do nothing if clipboard API blocked
    }
  }, [finding])

  return (
    <li className="border-b border-[hsl(var(--border))]/40 last:border-0">
      <div className="flex flex-col gap-2 py-3">
        <button
          type="button"
          onClick={() => setExpanded((s) => !s)}
          className="flex w-full items-start gap-3 text-left"
          aria-expanded={expanded}
        >
          <span className="mt-0.5">
            {expanded ? (
              <CaretDown size={12} weight="regular" />
            ) : (
              <CaretRight size={12} weight="regular" />
            )}
          </span>
          <AtlasStatusPill hue={DRIFT_HUE[finding.severity]} size="sm">
            {DRIFT_LABEL[finding.severity]}
          </AtlasStatusPill>
          <span className="flex-1 text-sm leading-snug">{finding.what}</span>
        </button>

        {expanded ? (
          <div className="ml-7 flex flex-col gap-2 pt-1 text-[12px]">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30 p-2.5">
                <p className="num text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                  canon
                </p>
                <p className="mt-1 leading-snug">{finding.canon_says}</p>
              </div>
              <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30 p-2.5">
                <p className="num text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                  real
                </p>
                <p className="mt-1 leading-snug">{finding.real_is}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <code className="num text-[10px] tabular-nums text-[hsl(var(--muted-foreground))]">
                {finding.evidence_path}
              </code>
              <button
                type="button"
                onClick={copyPrompt}
                className="num flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] transition-colors hover:bg-[hsl(var(--secondary))]"
                aria-label="Copiar prompt Cowork-ready"
              >
                {copied ? (
                  <>
                    <Check size={11} weight="regular" />
                    copiado
                  </>
                ) : (
                  <>
                    <Copy size={11} weight="regular" />
                    reconciliar
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </li>
  )
}

export function AtlasDriftList() {
  const { data, isLoading, isError } = useAtlasDrift()
  const findings = (data?.findings ?? [])
    .slice()
    .sort(
      (a, b) =>
        DRIFT_SORT_ORDER[a.severity] - DRIFT_SORT_ORDER[b.severity],
    )

  return (
    <section
      id="atlas-drift-list"
      className="surface-card rim-instr p-5"
      data-rim="cyan"
      aria-label="Drift findings"
    >
      <div className="relative z-[2] flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Drift findings
          </h2>
          <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            {findings.length} active · ordenado por severity
          </span>
        </div>

        {isLoading ? (
          <p className="num text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            cargando findings…
          </p>
        ) : isError ? (
          <p className="text-[11px] text-[hsl(var(--danger))]">
            failed to load drift findings
          </p>
        ) : findings.length === 0 ? (
          <div className="flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">
            <WarningOctagon size={14} weight="regular" />
            sin drift detectado · canon === reality
          </div>
        ) : (
          <ul className="flex flex-col">
            {findings.map((f) => (
              <DriftRow key={f.id} finding={f} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
