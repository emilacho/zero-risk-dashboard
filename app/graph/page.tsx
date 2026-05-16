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
      <main className="mx-auto max-w-7xl px-6 pb-16 pt-12">
        <section className="mb-8 flex flex-col gap-3">
          <span className="eyebrow-chip self-start">Memory graph</span>
          <h1 className="font-display text-[40px] font-semibold leading-[1.05] tracking-tight md:text-[52px]">
            <span className="text-gradient">Cliente · agent · workflow · tool</span>
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Portfolio view · todos los clientes activos. Hover un nodo para
            expand · zoom + pan disponibles · cascade-flow edges animan.
          </p>
        </section>
        {clients ? (
          <MemoryGraph
            data={clientsToMemoryGraph(clients.clients)}
            height={640}
            title={null}
          />
        ) : (
          <p className="text-sm text-destructive-foreground">
            Could not load graph data · platform endpoint unreachable.
          </p>
        )}
      </main>
    </>
  )
}
