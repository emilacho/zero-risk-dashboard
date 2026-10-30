import Link from "next/link"
import { redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerAlertas } from "@/lib/alertas-datos"
import type { Alerta, FuenteDeAlerta } from "@/lib/alertas"
import { BotonYaLoVi } from "./BotonYaLoVi"
import { AccionBoton } from "@/components/AccionBoton"
import { TOPE_POR_PIEZA_USD } from "@/lib/tablero-acciones"

export const dynamic = "force-dynamic"
export const metadata = { title: "Alertas" }

const FUENTE: Record<FuenteDeAlerta, string> = { cerebro: "Cerebro", costo: "Costos", oficina: "Oficina" }
const cuando = (iso: string) => new Date(iso).toLocaleString("es-EC", { timeZone: "America/Guayaquil", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

function Fila({ a, conBoton }: { a: Alerta; conBoton: boolean }) {
  return (
    <li className="flex items-start gap-3 border-t border-zinc-800 px-4 py-3 first:border-t-0">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${conBoton ? "bg-amber-400" : "bg-zinc-600"}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-zinc-100">{a.titulo}</p>
        {a.detalle && <p className="mt-0.5 break-words text-[12px] text-zinc-400">{a.detalle}</p>}
        <p className="mt-1 text-[11px] text-zinc-500">
          {FUENTE[a.fuente]} · {cuando(a.ultima_en)}
          {a.repeticiones > 1 ? ` · ${a.repeticiones} veces` : ""}
          {a.cerrada ? " · cerrada" : ""}
        </p>
        {(a.acciones.length > 0 || a.encargo_id) && (
          <p className="mt-2 flex flex-wrap gap-2">
            {a.acciones.map((x) => <Link key={x.texto} href={x.href} className="rounded border border-zinc-700 px-2.5 py-1 text-[12px] text-zinc-200 hover:bg-zinc-800">{x.texto}</Link>)}
            {a.encargo_id && conBoton && <AccionBoton accion="rehacer-pieza" datos={{ encargo_id: a.encargo_id }} etiqueta="Rehacer" tope_usd={TOPE_POR_PIEZA_USD} variante="suave" campos={[{ clave: "comentario", etiqueta: "Qué debe cambiar (opcional)", tipo: "largo" }]} />}
          </p>
        )}
      </div>
      {conBoton && <BotonYaLoVi clave={a.clave} />}
    </li>
  )
}

export default async function AlertasPage() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) redirect(puerta.status === 401 ? "/login?next=%2Falertas" : "/login?error=forbidden")
  const { nuevas, vistas } = await leerAlertas(getServiceRoleClient())

  return (
    <main data-seccion="alertas" className="mx-auto max-w-[900px] px-6 pb-16 pl-24 pt-10">
      <h1 className="font-display text-[34px] font-semibold leading-tight tracking-tight">Alertas</h1>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-zinc-200">Nuevas <span className="num text-zinc-500">({nuevas.length})</span></h2>
        {nuevas.length === 0 ? <p className="surface-card px-4 py-4 text-sm text-zinc-400">Nada pendiente.</p> : (
          <ul className="surface-card">{nuevas.map((a) => <Fila key={a.clave} a={a} conBoton />)}</ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-medium text-zinc-200">Ya vistas <span className="num text-zinc-500">({vistas.length})</span></h2>
        {vistas.length === 0 ? <p className="text-sm text-zinc-500">Ninguna.</p> : (
          <ul className="surface-card">{vistas.map((a) => <Fila key={a.clave} a={a} conBoton={false} />)}</ul>
        )}
      </section>
    </main>
  )
}
