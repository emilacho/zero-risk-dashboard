import { Suspense } from "react"
import Link from "next/link"
import { api, type ClientRow } from "@/lib/api"
import { ClienteCarpetaCard } from "@/lib/dashboard-components"
import { clientRowToFolder } from "@/lib/transforms"
import { Skeleton } from "@/components/Skeleton"
import { StaggerList } from "@/components/StaggerList"

export const dynamic = "force-dynamic"

/**
 * Infer 3-5 chip pills for a client card · industry tag + tools we know
 * the agency uses for that industry + status badge. Visual-only · the
 * platform doesn't ship a `pills` field per cliente.
 */
function inferPills(c: ClientRow): string[] {
  const out: string[] = []
  if (c.industry) {
    // first token of industry as a short pill (e.g. "food-delivery LATAM" → "food-delivery")
    out.push(c.industry.split(/[·\-,\s]/)[0]?.toLowerCase() || c.industry.toLowerCase())
  }
  // Tools we expect for almost every cliente
  out.push("ghl", "supabase", "anthropic")
  // Status-correlated tool · onboarding clients get figma
  if (c.status === "onboarding") out.push("figma")
  if (c.status === "active") out.push("posthog")
  return out.slice(0, 5)
}

function cellClassFor(folderStatus: string, healthScore: number): string {
  const isFeature =
    (folderStatus === "active" && healthScore >= 75) || folderStatus === "onboarding"
  return isFeature ? "lg:col-span-2" : "lg:col-span-1"
}

async function ClientsGrid() {
  const data = await api.clients(100).catch(() => null)
  if (!data) {
    return (
      <p className="text-sm text-rose-300">
        Could not load clients · platform endpoint unreachable.
      </p>
    )
  }
  const folders = data.clients.map((c) => ({
    ...clientRowToFolder(c),
    pills: inferPills(c),
  }))
  return (
    <StaggerList className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {folders.map((folder, i) => (
        <Link
          key={data.clients[i].id}
          href={`/clients/${data.clients[i].id}`}
          className={`block ${cellClassFor(folder.status, folder.healthScore)}`}
        >
          <ClienteCarpetaCard folder={folder} interactive className="h-full" />
        </Link>
      ))}
    </StaggerList>
  )
}

export default function ClientsPage() {
  return (
    <>
      <main className="mx-auto max-w-7xl px-6 pb-16 pt-10">
        <section className="mb-10 flex flex-col gap-3">
          <span className="eyebrow-chip self-start">Carpetas · clientes</span>
          <h1 className="font-display text-[40px] font-semibold leading-[1.05] tracking-tight md:text-[52px]">
            <span className="text-gradient">Portfolio</span>
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Portfolio bento · cliente con health ≥ 75 + onboarding ocupan 2
            celdas · paused / churned se compactan a 1. Cada carpeta lleva
            pills de industry, status y tools integradas.
          </p>
        </section>
        <Suspense fallback={<Skeleton kind="page" />}>
          <ClientsGrid />
        </Suspense>
      </main>
    </>
  )
}
