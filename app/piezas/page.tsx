import Link from "next/link"
import { redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { cargarPieza, listarPiezas, type FiltroDeEstado } from "@/lib/piezas-datos"
import { VisorDePieza } from "./VisorDePieza"

export const dynamic = "force-dynamic"
export const metadata = { title: "Piezas" }

const hora = (iso: string) => new Date(iso).toLocaleString("es-EC", { timeZone: "America/Guayaquil", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
const usd = (n: number | null) => (n == null ? "—" : `US$ ${n.toFixed(2)}`)
const PUNTO: Record<string, string> = { pendiente: "bg-amber-400", aprobada: "bg-emerald-400", con_cambios: "bg-violet-400", rechazada: "bg-rose-400", otro: "bg-zinc-500" }

export default async function PiezasPage({ searchParams }: { searchParams: Promise<{ id?: string; estado?: string }> }) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) redirect(puerta.status === 401 ? "/login?next=%2Fpiezas" : "/login?error=forbidden")
  const sp = await searchParams
  const estado: FiltroDeEstado = sp.estado === "todas" ? "todas" : "pendiente"
  const supa = getServiceRoleClient()
  const piezas = await listarPiezas(supa, { estado })
  const elegida = sp.id ?? piezas.find((p) => p.es_pieza)?.id ?? piezas[0]?.id ?? null
  const detalle = elegida ? await cargarPieza(supa, elegida) : null
  const pendientes = piezas.filter((p) => p.es_pieza && p.estado === "pendiente")
  const siguiente = pendientes.find((p) => p.id !== elegida)?.id ?? null

  return (
    <div className="flex h-screen min-h-0 pl-16">
      <aside className="flex w-[340px] shrink-0 flex-col border-r-[0.5px] border-[hsl(var(--primary-glow)/0.18)]">
        <div className="px-4 pb-2 pt-4">
          <h1 className="font-display text-[17px] font-semibold">
            Piezas por revisar <span className="num ml-1 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{pendientes.length}</span>
          </h1>
          <div className="mt-3 flex gap-2 text-[11px]">
            <Link href="/piezas" className={`rounded-full border px-3 py-1 ${estado === "pendiente" ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.18)] text-white" : "border-white/10 text-[hsl(var(--muted-foreground))]"}`}>Pendientes</Link>
            <Link href="/piezas?estado=todas" className={`rounded-full border px-3 py-1 ${estado === "todas" ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.18)] text-white" : "border-white/10 text-[hsl(var(--muted-foreground))]"}`}>Todas</Link>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {piezas.length === 0 && <p className="px-4 py-6 text-sm text-[hsl(var(--muted-foreground))]">No hay nada por revisar. Cuando la oficina entregue una pieza aparecerá aquí.</p>}
          {piezas.map((p) => (
            <Link key={p.id} href={`/piezas?id=${p.id}${estado === "todas" ? "&estado=todas" : ""}`} className={`flex gap-3 border-t-[0.5px] border-white/5 px-4 py-3 transition-colors hover:bg-white/[0.03] ${p.id === elegida ? "bg-[hsl(var(--primary)/0.12)] shadow-[inset_3px_0_0_hsl(var(--primary))]" : ""} ${p.es_pieza ? "" : "opacity-60"}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PUNTO[p.estado]}`} />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{p.titulo.replace(/^⚠️\s*/, "")}</span>
                <span className="block text-[11px] text-[hsl(var(--muted-foreground))]">
                  {p.cliente ?? "—"} · {hora(p.creada)} · {usd(p.gasto_usd)}
                </span>
                <span className="block text-[11px] text-[hsl(var(--muted-foreground))]">
                  {p.es_pieza ? (p.tiene_dibujo ? "" : "sin dibujo · ") : `${p.tipo} · solo lectura · `}
                  {p.incompleta ? "revisión incompleta" : ""}{p.desacuerdos > 0 ? ` · ${p.desacuerdos} desacuerdos` : ""}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </aside>
      <section className="min-w-0 flex-1">
        {detalle ? <VisorDePieza key={detalle.id} pieza={detalle} siguienteId={siguiente} /> : <p className="p-8 text-sm text-[hsl(var(--muted-foreground))]">Elige una pieza de la lista.</p>}
      </section>
    </div>
  )
}
