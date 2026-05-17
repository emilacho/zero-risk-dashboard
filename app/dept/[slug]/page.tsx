import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import {
  DEPT_BY_SLUG,
  type DeptSlug,
} from "@/lib/departments"
import { DeptOpsBody } from "@/components/dept/DeptOpsBody"
import { DeptCsmBody } from "@/components/dept/DeptCsmBody"
import { DeptFinBody } from "@/components/dept/DeptFinBody"
import { DeptMktBody } from "@/components/dept/DeptMktBody"
import { DeptQaBody } from "@/components/dept/DeptQaBody"

// Pure dynamic · no prerender at build time · avoids build-time
// platform endpoint reachability flakiness that pinned /dept/ops to
// a frozen error response (digest 3406040795 on builds buik7g6ao +
// khcjxnmt3). Each request hits the platform endpoint live.
export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function DeptPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const dept = DEPT_BY_SLUG[slug as DeptSlug]
  if (!dept) notFound()

  const body = (() => {
    switch (dept.slug) {
      case "ops":
        return <DeptOpsBody />
      case "csm":
        return <DeptCsmBody />
      case "fin":
        return <DeptFinBody />
      case "mkt":
        return <DeptMktBody />
      case "qa":
        return <DeptQaBody />
      default:
        return null
    }
  })()

  return (
    <main className="mx-auto max-w-[1400px] px-6 pb-16 pt-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft strokeWidth={1.5} className="h-3 w-3" /> Overview
      </Link>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p
            className="num font-mono text-[11px] uppercase tracking-[0.2em]"
            style={{ color: `hsl(var(--hue-${dept.hue}))` }}
          >
            Departamento · {dept.cardinal}
          </p>
          <h1 className="mt-2 font-display text-[44px] font-semibold leading-[1.02] tracking-tight md:text-[56px]">
            <span className="text-gradient">{dept.label}</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[hsl(var(--muted-foreground))]">
            {dept.tagline}
          </p>
        </div>
        <div className="text-right">
          {dept.managerAgent ? (
            <Link
              href={`/agents/${dept.managerAgent}`}
              className="num text-[11px] text-[hsl(var(--muted-foreground))] hover:text-foreground"
            >
              gerente · <code className="font-mono">{dept.managerAgent}</code> →
            </Link>
          ) : (
            <span className="num text-[11px] text-[hsl(var(--muted-foreground))]">
              gerente · (sin jefe asignado · vista derivada)
            </span>
          )}
        </div>
      </header>

      <div className="mt-10">{body}</div>
    </main>
  )
}
