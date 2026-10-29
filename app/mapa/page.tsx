import Link from "next/link"
import { redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerMapa, type LecturaDelMapa } from "@/lib/mapa-datos"
import { ESTACIONES, type DondeEsta } from "@/lib/mapa"
import { haceCuanto, usd } from "@/lib/oficinas"

export const dynamic = "force-dynamic"
export const metadata = { title: "Mapa" }

const DONDE: Record<DondeEsta, string> = { oficina: "En la oficina", bandeja: "En la bandeja de Emilio", fallo: "Falló" }
const COLOR: Record<DondeEsta, string> = { oficina: "text-[hsl(var(--muted-foreground))]", bandeja: "text-amber-300", fallo: "text-rose-300" }

export default async function MapaPage() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) redirect(puerta.status === 401 ? "/login?next=%2Fmapa" : "/login?error=forbidden")
  const ahora = new Date()
  let mapa: LecturaDelMapa | null = null
  let error: string | null = null
  try {
    mapa = await leerMapa(getServiceRoleClient(), ahora)
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }
  return (
    <main className="mx-auto max-w-[1300px] px-6 pb-16 pl-24 pt-10">
      <h1 className="font-display text-[34px] font-semibold leading-tight tracking-tight">Mapa</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">El recorrido de una pieza, de izquierda a derecha. Cada estación cuenta lo que pasó por ella en los últimos 7 días (solo trabajo real, sin ensayos).</p>
      {error && <p className="mt-6 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-[13px] text-rose-200">No pude leer el mapa: {error}</p>}
      {mapa && (
        <>
          <ol className="mt-8 grid gap-3 md:grid-cols-5">
            {ESTACIONES.map((est, i) => {
              const p = mapa!.pasos.find((x) => x.clave === est.clave)!
              return (
                <li key={est.clave} className="relative">
                  <div className="surface-card h-full p-4">
                    <span className="text-[11px] uppercase tracking-[0.08em] text-[hsl(var(--muted-foreground))]">{i + 1}. {est.nombre}</span>
                    <span className="num mt-2 block text-[36px] font-semibold leading-none">{p.cuantos}</span>
                    <span className="mt-2 block text-[12px] text-[hsl(var(--muted-foreground))]">{est.que_hace}</span>
                    <ul className="mt-3 space-y-0.5 text-[12px]">{p.detalle.map((d, k) => <li key={k}>{d}</li>)}</ul>
                    <span className="mt-3 block text-[11px] text-[hsl(var(--muted-foreground))]">Último movimiento: {haceCuanto(p.ultimo, ahora)}</span>
                  </div>
                  {i < ESTACIONES.length - 1 && <span aria-hidden className="absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-[hsl(var(--muted-foreground))] md:block">›</span>}
                </li>
              )
            })}
          </ol>
          <h2 className="mb-3 mt-10 text-[11px] font-medium uppercase tracking-[0.08em] text-[hsl(var(--muted-foreground))]">Dónde está cada pieza</h2>
          {mapa.piezas.length === 0 ? <p className="text-[13px] text-[hsl(var(--muted-foreground))]">No hubo piezas reales en los últimos 7 días.</p> : (
            <ul className="surface-card divide-y divide-white/5">
              {mapa.piezas.map((p) => (
                <li key={p.id} className="flex items-baseline gap-3 px-4 py-2.5 text-[13px]">
                  <span className="w-20 shrink-0 font-medium">{p.brief}</span>
                  <span className="w-36 shrink-0 text-[hsl(var(--muted-foreground))]">{p.familia}</span>
                  <span className={`w-48 shrink-0 ${COLOR[p.donde]}`}>{DONDE[p.donde]} · {p.estado}</span>
                  <span className="num w-20 shrink-0 text-right">{usd(p.gasto_usd)}</span>
                  <span className="ml-auto text-[11px] text-[hsl(var(--muted-foreground))]">{haceCuanto(p.creado_en, ahora)}</span>
                  {p.donde === "bandeja" && <Link href="/piezas" className="text-[12px] text-[hsl(var(--primary-glow))] hover:underline">Abrir →</Link>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  )
}
