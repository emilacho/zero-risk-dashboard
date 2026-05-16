import { api } from "@/lib/api"
import { MemoryGraph } from "@/lib/dashboard-components"
import { clientsToMemoryGraph } from "@/lib/transforms"
import { Header } from "@/components/Header"

export const dynamic = "force-dynamic"

export default async function GraphPage() {
  const clients = await api.clients(100).catch(() => null)
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Memory graph
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Cliente · agent · workflow · tool
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Portfolio view · todos los clientes activos. Click un cliente para
            ver agents que trabajaron en él.
          </p>
        </div>
        {clients ? (
          <div className="rounded-xl border border-border bg-card">
            <MemoryGraph
              data={clientsToMemoryGraph(clients.clients)}
              height={640}
              title={null}
            />
          </div>
        ) : (
          <p className="text-sm text-destructive-foreground">
            Could not load graph data · platform endpoint unreachable.
          </p>
        )}
      </main>
    </>
  )
}
