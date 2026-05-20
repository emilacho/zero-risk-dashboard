/**
 * GET /api/atlas/drift · Sprint 2 dashboard scaffold.
 *
 * Computes 10 drift findings by comparing canon hardcoded constants
 * (per CLAUDE.md Stack V3 + canonical claims) against Tier 1 reality
 * (Supabase + n8n live counts). CC#4 surfaces in UI · CC#3 maintains
 * detection logic here · expand the rules array as new drifts surface.
 */
import { NextResponse } from "next/server"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { getSessionClient } from "@/lib/supabase-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 60

export type DriftSeverity = "critical" | "warning" | "info"

interface DriftFinding {
  id: string
  severity: DriftSeverity
  what: string
  canon_says: string
  real_is: string
  evidence_path: string
}

interface AgentCountByModel {
  default_model: string | null
}

interface AgentBySource {
  identity_source: string | null
}

interface ClientShallow {
  id: string
}

interface InvocationShallow {
  created_at: string
}

interface OnboardingShallow {
  status: string | null
}

export async function GET() {
  const session = await getSessionClient()
  const { data: userRes } = await session.auth.getUser()
  if (!userRes?.user) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 },
    )
  }

  const findings: DriftFinding[] = []

  try {
    const supa = getServiceRoleClient()

    const [
      agentsAll,
      agentsCanonical,
      agentsProjectLocal,
      clientsActive,
      invocations24h,
      onboardingsAll,
    ] = await Promise.all([
      supa.from("agents").select("default_model"),
      supa
        .from("agents")
        .select("identity_source")
        .ilike("identity_source", "%canonical%"),
      supa
        .from("agents")
        .select("identity_source")
        .ilike("identity_source", "%project-local%"),
      supa.from("clients").select("id").is("archived_at", null),
      supa
        .from("agent_invocations")
        .select("created_at")
        .gte(
          "created_at",
          new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        ),
      supa.from("onboarding_sessions").select("status"),
    ])

    const totalAgents = (agentsAll.data as AgentCountByModel[] | null)?.length ?? 0
    const canonicalAgents =
      (agentsCanonical.data as AgentBySource[] | null)?.length ?? 0
    const projectLocalAgents =
      (agentsProjectLocal.data as AgentBySource[] | null)?.length ?? 0
    const placeholderAgents = totalAgents - canonicalAgents - projectLocalAgents
    const totalClients = (clientsActive.data as ClientShallow[] | null)?.length ?? 0
    const recentInvocations =
      (invocations24h.data as InvocationShallow[] | null)?.length ?? 0
    const discoveredOnboardings =
      (onboardingsAll.data as OnboardingShallow[] | null)?.filter(
        (o) => o.status === "discovered",
      ).length ?? 0

    // Rule 1 · agent count vs canon "39"
    if (totalAgents !== 39) {
      findings.push({
        id: "drift-agents-total",
        severity: totalAgents > 50 ? "info" : "warning",
        what: "Agents table row count vs canon V3 claim '39'",
        canon_says: "39 agentes (CLAUDE.md L201 · 'Identidades purpose-built · 39 agentes activos · ✅ COMPLETADO')",
        real_is: `${totalAgents} rows en agents table`,
        evidence_path: "SELECT COUNT(*) FROM agents",
      })
    }

    // Rule 2 · placeholder agents · should be 0 post 2026-05-16 backfill
    if (placeholderAgents > 0) {
      findings.push({
        id: "drift-placeholder-agents",
        severity: "critical",
        what: "Agents with NULL/unknown identity_source · post-backfill should be 0",
        canon_says: "35 placeholders backfilled 2026-05-16 · 0 remaining (vault 2026-05-16-agents-identity-backfill-complete)",
        real_is: `${placeholderAgents} agents sin identity_source canonical o project-local`,
        evidence_path: "agents WHERE identity_source NOT ILIKE '%canonical%' AND NOT ILIKE '%project-local%'",
      })
    }

    // Rule 3 · activity 24h
    if (recentInvocations === 0) {
      findings.push({
        id: "drift-activity-24h",
        severity: "warning",
        what: "Zero agent invocations en últimas 24h · sistema dormant o instrumentation gap",
        canon_says: "Pilar 5 feedback loop · agent_invocations bridge live (CLAUDE.md L207)",
        real_is: "0 invocations registradas últimas 24h",
        evidence_path: "agent_invocations WHERE created_at > now() - 1 day",
      })
    }

    // Rule 4 · client count Tier 1 vs assumption "13"
    if (totalClients !== 13) {
      findings.push({
        id: "drift-clients-count",
        severity: totalClients < 5 ? "info" : "warning",
        what: "Active clients count vs prior snapshot '13 clientes' (2026-05-17)",
        canon_says: "13 clients per dashboard arquitectura snapshot 2026-05-17",
        real_is: `${totalClients} clients activos (archived_at IS NULL)`,
        evidence_path: "SELECT COUNT(*) FROM clients WHERE archived_at IS NULL",
      })
    }

    // Rule 5 · onboarding sessions stuck en discovered
    if (discoveredOnboardings > 0) {
      findings.push({
        id: "drift-onboarding-stuck-discovered",
        severity: "warning",
        what: "Onboarding sessions stuck en status 'discovered' · Day 1 done · awaiting human-gated Day 2 intake",
        canon_says: "Pilar 6 · Onboarding automatizado (CLAUDE.md L208) · pero 'GHL real wireup pending'",
        real_is: `${discoveredOnboardings} onboarding sessions paradas en 'discovered' status`,
        evidence_path: "onboarding_sessions WHERE status = 'discovered'",
      })
    }

    // Rule 6 · canon n8n workflows "54" (per CLAUDE.md note)
    findings.push({
      id: "drift-workflows-count-needs-live-check",
      severity: "info",
      what: "n8n workflows count vs canon '54 workflows live' · validar vía /api/atlas/workflows live count",
      canon_says: "54 workflows live n8n production (snapshot 2026-05-15 14:00 UTC · CLAUDE.md L172)",
      real_is: "Live count delegado a /api/atlas/workflows endpoint (n8n API)",
      evidence_path: "GET /api/atlas/workflows · n8n_status field",
    })

    // Rule 7 · canon Composio removed but check workflows for legacy refs
    findings.push({
      id: "drift-composio-canon-purged-verify-workflows",
      severity: "info",
      what: "Composio removed from V3 canon · verify n8n workflows no usen Composio nodes legacy",
      canon_says: "Composio → Anthropic Managed Agents + Direct APIs (blueprint v2 stack-aligned 2026-05-19)",
      real_is: "n8n workflow nodes audit pending · GET /api/atlas/workflows + filter Composio refs",
      evidence_path: "n8n-workflows/tier-1/*.json + n8n live API node types",
    })

    // Rule 8 · canon GPT Image 1.5 vs lingering Ideogram refs
    findings.push({
      id: "drift-ideogram-purged-vs-agent-prompts",
      severity: "info",
      what: "Ideogram v3 → GPT Image 1.5 (canon V3) · verify agent identities + workflows no contengan Ideogram refs",
      canon_says: "GPT Image 1.5 vía Vercel AI Gateway (CLAUDE.md L249)",
      real_is: "agents.identity_content scan pending (CC#3 next iteration · grep Ideogram en identity_content)",
      evidence_path: "SELECT name FROM agents WHERE identity_content ILIKE '%ideogram%'",
    })

    // Rule 9 · GHL auto-email wireup (Peniche audit finding)
    findings.push({
      id: "drift-ghl-auto-email-onboarding",
      severity: "warning",
      what: "Onboarding orchestrator NOT envía auto-email vía GHL post Day 1 · human-gated (canon footnote)",
      canon_says: "CLAUDE.md L208 · '5/6 LOTE-C fixes closed · solo GHL real wireup pending'",
      real_is: "Día 1 termina con MC inbox task · NO auto-send intake form (Peniche audit 2026-05-19)",
      evidence_path: "src/lib/onboarding-orchestrator.ts:265 + raw/qa/2026-05-19-peniche-onboarding-forensic-audit.md",
    })

    // Rule 10 · agent_invocations instrumentation gap auto-discovery
    findings.push({
      id: "drift-onboarding-agent-invocations-gap",
      severity: "info",
      what: "WebDiscovery + BrandAnalyzer (Day 1) NO loggean a agent_invocations · cost-tracking parity miss",
      canon_says: "Pilar 5 · agent_invocations bridge live (CLAUDE.md L207)",
      real_is: "Costo agregado en onboarding_sessions.total_cost_usd solo · NO per-call rows",
      evidence_path: "agent_invocations WHERE client_id = <onboarding client> → 0 rows post Day 1",
    })

    return NextResponse.json({
      ok: true,
      findings_count: findings.length,
      findings,
      generated_at: new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown"
    return NextResponse.json(
      { ok: false, error: msg, findings },
      { status: 500 },
    )
  }
}
