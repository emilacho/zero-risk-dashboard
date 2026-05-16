import { Suspense } from "react"
import Link from "next/link"
import { api } from "@/lib/api"
import { ClienteCarpetaCard } from "@/lib/dashboard-components"
import { clientRowToFolder } from "@/lib/transforms"
import { Header } from "@/components/Header"
import { Skeleton } from "@/components/Skeleton"

export const dynamic = "force-dynamic"

async function ClientsGrid() {
  const data = await api.clients(100).catch(() => null)
  if (!data) {
    return (
      <p className="text-sm text-destructive-foreground">
        Could not load clients · platform endpoint unreachable.
      </p>
    )
  }
  return (
    <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.clients.map((c) => (
        <Link key={c.id} href={`/clients/${c.id}`}>
          <ClienteCarpetaCard folder={clientRowToFolder(c)} />
        </Link>
      ))}
    </div>
  )
}

export default function ClientsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Carpetas · clientes
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Portfolio · onboarded · active · churned
          </h1>
        </div>
        <Suspense fallback={<Skeleton lines={6} />}>
          <ClientsGrid />
        </Suspense>
      </main>
    </>
  )
}
