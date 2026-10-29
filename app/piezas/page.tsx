import Link from "next/link"
import { redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { cargarPieza, contarPiezasPorAprobar, listarPiezas, type FiltroDeEstado } from "@/lib/piezas-datos"
import { diaYHora, usdES } from "@/lib/lenguaje"
import { VisorDePieza } from "./VisorDePieza"

export const dynamic = "force-dynamic"
export const metadata = { title: "Piezas" }

const PUNTO: Record<string, string> = { pendiente: "bg-amber-400", aprobada: "bg-emerald-400", con_cambios: "bg-sky-400", rechazada: "bg-rose-400", otro: "bg-zinc-500" }
const ETIQUETA: Record<string, string> = { pendiente: "por aprobar", aprobada: "aprobada", con_cambios: "con cambios pedidos", rechazada: "rechazada", otro: "otro estado" }

export default async function PiezasPage({ searchParams }: { searchParams: Promise<{ id?: string; estado?: string }> }) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) redirect(puerta.status === 401 ? "/login?next=%2Fpiezas" : "/login?error=forbidden")
  const sp = await searchParams
  const estado: FiltroDeEstado = sp.estado === "todas" ? "todas" : "pendiente"
  const supa = getServiceRoleClient()
  const [piezas, otras, porAprobar] = await Promise.all([
    listarPiezas(supa, { estado, tipo: "piezas" }),
    listarPiezas(supa, { estado, tipo: "otras" }),
    contarPiezasPorAprobar(supa),
  ])
  const elegida = sp.id ?? piezas[0]?.id ?? otras[0]?.id ?? null
  const detalle = elegida ? await cargarPieza(supa, elegida) : null
  const siguiente = piezas.find((p) => p.estado === "pendiente" && p.id !== elegida)?.id ?? null
  const enlace = (id: string) => `/piezas?id=${id}${estado === "todas" ? "&estado=todas" : ""}`

  return (
    <div data-seccion="piezas" className="flex h-screen min-h-0 pl-16">
      <aside className="flex w-[340px] shrink-0 flex-col border-r-[0.5px] border-white/10">
        <div className="px-4 pb-2 pt-4">
          <h1 className="font-display text-[17px] font-semibold">
            Piezas por aprobar <span className="num ml-1 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{porAprobar}</span>
          </h1>
          <div className="mt-3 flex gap-2 text-[11px]">
            <Link href="/piezas" className={`rounded-full border px-3 py-1 ${estado === "pendiente" ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.18)] text-white" : "border-white/10 text-[hsl(var(--muted-foreground))]"}`}>Por aprobar</Link>
            <Link href="/piezas?estado=todas" className={`rounded-full border px-3 py-1 ${estado === "todas" ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.18)] text-white" : "border-white/10 text-[hsl(var(--muted-foreground))]"}`}>Todas</Link>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {piezas.length === 0 && <p className="px-4 py-6 text-sm text-[hsl(var(--muted-foreground))]">No hay piezas por aprobar. Cuando la oficina entregue una aparecerá aquí.</p>}
          {piezas.map((p) => (
            <Link key={p.id} href={enlace(p.id)} className={`flex gap-3 border-t-[0.5px] border-white/5 px-4 py-3 transition-colors hover:bg-white/[0.03] ${p.id === elegida ? "bg-white/[0.06]" : ""}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PUNTO[p.estado]}`} />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{p.titulo_legible}</span>
                <span className="block text-[11px] text-[hsl(var(--muted-foreground))]">{diaYHora(p.creada)} · {usdES(p.gasto_usd)} · {ETIQUETA[p.estado]}</span>
                {(!p.tiene_dibujo || p.incompleta || p.desacuerdos > 0) && (
                  <span className="block text-[11px] text-amber-300/90">
                    {[!p.tiene_dibujo ? "sin dibujo" : "", p.incompleta ? "revisión de la jefatura incompleta" : "", p.desacuerdos > 0 ? `${p.desacuerdos} desacuerdos` : ""].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
            </Link>
          ))}
          {otras.length > 0 && (
            <details className="border-t-[0.5px] border-white/10">
              <summary className="cursor-pointer px-4 py-3 text-[12px] text-[hsl(var(--muted-foreground))] hover:text-white">Otras revisiones, no son piezas ({otras.length})</summary>
              {otras.map((p) => (
                <Link key={p.id} href={enlace(p.id)} className={`block border-t-[0.5px] border-white/5 px-4 py-2.5 text-[12px] hover:bg-white/[0.03] ${p.id === elegida ? "bg-white/[0.06]" : ""}`}>
                  <span className="block">{p.titulo_legible}</span>
                  <span className="block text-[11px] text-[hsl(var(--muted-foreground))]">{diaYHora(p.creada)} · solo lectura</span>
                </Link>
              ))}
            </details>
          )}
        </div>
      </aside>
      <section className="min-w-0 flex-1">
        {detalle ? <VisorDePieza key={detalle.id} pieza={detalle} siguienteId={siguiente} /> : <p className="p-8 text-sm text-[hsl(var(--muted-foreground))]">Elige una pieza de la lista.</p>}
      </section>
    </div>
  )
}
