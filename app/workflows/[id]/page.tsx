import Link from "next/link"
import { ArrowLeft, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr"
import { WorkflowLiveCanvas } from "@/components/workflows/WorkflowLiveCanvas"
import { translateWorkflowTitle, workflowSubtitle } from "@/lib/n8n-workflow-titles"

export const dynamic = "force-dynamic"

interface WorkflowDetail {
  id: string
  name: string
  active: boolean
  nodes: Array<{ id: string; name: string; type: string; position?: [number, number] }>
  connections: Record<
    string,
    { main?: Array<Array<{ node: string; type?: string; index?: number }>> }
  >
  updatedAt: string
  triggerCount: number
}

async function loadWorkflow(id: string): Promise<WorkflowDetail | null> {
  const base = process.env.N8N_BASE_URL
  const key = process.env.N8N_API_KEY
  if (!base || !key) return null
  try {
    const res = await fetch(
      `${base.replace(/\/+$/, "")}/api/v1/workflows/${id}`,
      {
        headers: { "X-N8N-API-KEY": key, Accept: "application/json" },
        cache: "no-store",
      },
    )
    if (!res.ok) return null
    const json = (await res.json()) as {
      id: string
      name: string
      active: boolean
      nodes: Array<{ id: string; name: string; type: string }>
      connections: Record<string, { main?: Array<Array<{ node: string }>> }>
      updatedAt: string
    }
    return {
      id: json.id,
      name: json.name,
      active: json.active,
      nodes: json.nodes ?? [],
      connections: json.connections ?? {},
      updatedAt: json.updatedAt,
      triggerCount: (json.nodes ?? []).filter((n) =>
        /trigger|webhook|cron|schedule/i.test(n.type),
      ).length,
    }
  } catch {
    return null
  }
}

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const wf = await loadWorkflow(id)

  if (!wf) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm text-[hsl(var(--danger))]">
          Workflow{" "}
          <code className="font-mono">{id}</code> not found · check n8n
          envs.
        </p>
        <Link
          href="/system/workflows"
          className="num mt-4 inline-block text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:text-foreground"
        >
          ← all workflows
        </Link>
      </main>
    )
  }

  const triggerNodeNames = wf.nodes
    .filter((n) => /trigger|webhook|cron|schedule/i.test(n.type))
    .map((n) => n.name)

  return (
    <main className="mx-auto max-w-[1400px] px-6 pb-16 pt-10">
      <Link
        href="/system/workflows"
        className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft strokeWidth={1.5} className="h-3 w-3" /> Workflows
      </Link>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p
            className="num text-[11px] uppercase tracking-[0.2em]"
            style={{
              color: wf.active
                ? "hsl(var(--success))"
                : "hsl(var(--muted-foreground))",
            }}
          >
            {wf.active ? "● ACTIVO" : "○ INACTIVO"} · {wf.triggerCount} disparador{wf.triggerCount === 1 ? "" : "es"} · {wf.nodes.length} nodos
          </p>
          <h1 className="mt-2 font-display text-[36px] font-semibold leading-[1.05] tracking-tight md:text-[44px]">
            <span className="text-gradient">{translateWorkflowTitle(wf.name)}</span>
          </h1>
          {(() => {
            const sub = workflowSubtitle(wf.name)
            return sub ? (
              <p className="mt-1 num text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                n8n · <span className="font-mono">{sub}</span>
              </p>
            ) : null
          })()}
          <p className="mt-1 num text-[10px] text-[hsl(var(--muted-foreground))]">
            id · <code className="font-mono">{wf.id}</code> · updated{" "}
            {wf.updatedAt
              ? new Date(wf.updatedAt).toISOString().slice(0, 16).replace("T", " ")
              : "—"}
          </p>
        </div>
        <a
          href={`https://n8n-production-72be.up.railway.app/workflow/${wf.id}`}
          target="_blank"
          rel="noreferrer"
          className="num inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:text-foreground"
        >
          abrir en n8n <ArrowSquareOut strokeWidth={1.5} className="h-3 w-3" />
        </a>
      </header>

      <div className="mt-8">
        <WorkflowLiveCanvas
          workflowId={wf.id}
          nodes={wf.nodes}
          connections={wf.connections}
          triggerNodeNames={triggerNodeNames}
        />
      </div>
    </main>
  )
}
