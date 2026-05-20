"use client"
/**
 * AtlasFooter · Section 12 · timestamp + refresh button + 2 quick actions.
 *
 * Quick actions canon · Fix key · Build L1 · ambos genera prompts
 * canónicos copy-to-clipboard. Refresh dispara `refetch()` del snapshot
 * + invalida la cache de los hooks dependientes.
 */
import { useCallback, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  ArrowsClockwise,
  Key,
  TreeStructure,
  Check,
  Copy,
} from "@phosphor-icons/react/dist/ssr"
import { useAtlasSnapshot } from "../hooks/useAtlasSnapshot"
import { formatRelativeIso } from "../tokens"

const FIX_KEY_PROMPT = `[ATLAS-QUICK-ACTION · fix-stale-key]

Contexto · uno de los pings de integrations-health volvió "degraded · HTTP 401" · key expirada o rotada.

Pasos sugeridos ·
1. Identificar qué provider falló (Slack #equipo report o /dashboard/atlas surface)
2. Rotar la key en el provider's portal
3. Update Vercel env var (preview + production)
4. Trigger redeploy
5. Verify /api/atlas/integrations-health row vuelve a "ok"

Response signal · [ATLAS-KEY-ROTATED-<provider>]`

const BUILD_L1_PROMPT = `[ATLAS-QUICK-ACTION · build-L1-master-journey]

Contexto · Master Journey Orchestrator (L1 router) sigue como skeleton no implementado · Peniche onboarding paró por este gap.

Acción · arrancar build del L1 dispatcher per CC#1 SPRINT1-L1-ARCH-DECISION (Opción B Vercel-resident library).

Files target · src/lib/journey-orchestrator/{dispatch,state-machine,routes-map,validators}.ts + POST /api/journey/dispatch + POST /api/journey/event-log.

Response signal · [CC#-L1-MASTER-JOURNEY-DONE]`

interface QuickActionProps {
  label: string
  icon: React.ReactNode
  prompt: string
}

function QuickAction({ label, icon, prompt }: QuickActionProps) {
  const [copied, setCopied] = useState(false)
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // no-op
    }
  }, [prompt])
  return (
    <button
      type="button"
      onClick={onCopy}
      className="num flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] transition-colors hover:bg-[hsl(var(--secondary))]"
    >
      {copied ? (
        <>
          <Check size={11} weight="regular" />
          prompt copiado
        </>
      ) : (
        <>
          {icon}
          {label}
          <Copy size={10} weight="regular" className="ml-1 opacity-60" />
        </>
      )}
    </button>
  )
}

export function AtlasFooter() {
  const { data, refetch, isFetching } = useAtlasSnapshot()
  const queryClient = useQueryClient()

  const handleRefresh = useCallback(() => {
    void refetch()
    // Invalidate all dependent atlas queries · cascade refresh
    void queryClient.invalidateQueries({ queryKey: ["atlas"] })
  }, [refetch, queryClient])

  return (
    <footer
      className="surface-card rim-instr p-4"
      data-rim="cyan"
      aria-label="Atlas footer"
    >
      <div className="relative z-[2] flex flex-wrap items-center justify-between gap-3">
        <div className="num flex flex-col gap-0.5 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
          <span>
            snapshot · {formatRelativeIso(data?.last_validated_at ?? null)}
          </span>
          <span className="normal-case lowercase tracking-normal">
            {data?.last_validated_at
              ? new Date(data.last_validated_at).toLocaleString()
              : "—"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <QuickAction
            label="fix key"
            icon={<Key size={12} weight="regular" />}
            prompt={FIX_KEY_PROMPT}
          />
          <QuickAction
            label="build L1"
            icon={<TreeStructure size={12} weight="regular" />}
            prompt={BUILD_L1_PROMPT}
          />
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isFetching}
            className="num flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] transition-colors hover:bg-[hsl(var(--secondary))] disabled:opacity-50"
            aria-label="Refresh snapshot"
          >
            <ArrowsClockwise
              size={12}
              weight="regular"
              className={isFetching ? "animate-spin" : ""}
            />
            {isFetching ? "refreshing…" : "refresh"}
          </button>
        </div>
      </div>
    </footer>
  )
}
