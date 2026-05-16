import { Suspense } from "react"
import Link from "next/link"
import { api } from "@/lib/api"
import { ClienteCarpetaCard } from "@/lib/dashboard-components"
import { clientRowToFolder } from "@/lib/transforms"
import { Header } from "@/components/Header"
import { Skeleton } from "@/components/Skeleton"

export const dynamic = "force-dynamic"

/**
 * Map a folder to a bento cell size based on importance:
 *   - high health (≥75) → 2 cols wide (feature card)
 *   - active onboarding → 2 cols wide
 *   - paused/churned    → 1 col
 *   - other              → 1 col
 *
 * Falls back to single-col on mobile / narrow viewports.
 */
function cellClassFor(folderStatus: string, healthScore: number): string {
  const isFeature =
    folderStatus === "active" && healthScore >= 75 ||
    folderStatus === "onboarding"
  return isFeature ? "lg:col-span-2" : "lg:col-span-1"
}

async function ClientsGrid() {
  const data = await api.clients(100).catch(() => null)
  if (!data) {
    return (
      <p className="text-sm text-destructive-foreground">
        Could not load clients · platform endpoint unreachable.
      </p>
    )
  }
  const folders = data.clients.map(clientRowToFolder)
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {folders.map((folder, i) => (
        <Link
          key={data.clients[i].id}
          href={`/clients/${data.clients[i].id}`}
          className={`block ${cellClassFor(folder.status, folder.healthScore)}`}
        >
          <ClienteCarpetaCard folder={folder} interactive className="h-full" />
        </Link>
      ))}
    </div>
  )
}

export default function ClientsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-6 pb-16 pt-12">
        <section className="mb-10 flex flex-col gap-3">
          <span className="eyebrow-chip self-start">Carpetas · clientes</span>
          <h1 className="font-display text-[40px] font-semibold leading-[1.05] tracking-tight md:text-[52px]">
            <span className="text-gradient">Portfolio</span>
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Portfolio bento · cliente con health ≥ 75 + onboarding ocupan 2
            celdas · churned / paused se compactan a 1. Click una carpeta
            para ver memoria + cascadas.
          </p>
        </section>
        <Suspense fallback={<Skeleton kind="page" />}>
          <ClientsGrid />
        </Suspense>
      </main>
    </>
  )
}
