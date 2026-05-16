import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Header } from "@/components/Header"

/**
 * Client carpeta · /clients/[id]
 *
 * Phase 0 · placeholder layout. Phase 1 wires:
 *  - clients row + brand_assets (logo · colors · fonts)
 *  - client_journey_state · current stage + history
 *  - latest cascade-summary.json from Storage
 *  - cost-by-client breakdown
 *  - linked landing URL (client-sites deploy)
 *  - HITL items pending approval
 */
export default async function ClienteCarpetaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Clients
        </Link>
        <header className="mt-4 flex items-end justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Carpeta cliente
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {id}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Placeholder · Phase 1 carga clients row + journey state + último
              cascade-summary + linked landing URL.
            </p>
          </div>
        </header>

        <section className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Placeholder title="Brand assets" lines={4} />
          <Placeholder title="Journey state" lines={3} />
          <Placeholder title="Last cascade · agents x6" lines={5} />
          <Placeholder title="Spend · all-time" lines={3} />
          <Placeholder title="Landing URL" lines={2} />
          <Placeholder title="HITL pending" lines={3} />
        </section>
      </main>
    </>
  )
}

function Placeholder({ title, lines }: { title: string; lines: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded bg-muted/60"
            style={{ width: `${60 + ((i * 23) % 38)}%` }}
          />
        ))}
      </div>
    </div>
  )
}
