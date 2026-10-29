import { redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerAlertas } from "@/lib/alertas-datos"
import { VENTANA_OFICINA_DIAS, type Alerta, type FuenteDeAlerta } from "@/lib/alertas"
import { BotonYaLoVi } from "./BotonYaLoVi"

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
          {FUENTE[a.fuente]} · última vez {cuando(a.ultima_en)}
          {a.repeticiones > 1 ? ` · se repitió ${a.repeticiones} veces desde ${cuando(a.desde)}` : ""}
          {a.cerrada ? " · ya cerrada" : ""}
          {!conBoton && a.vista_en ? ` · vista ${cuando(a.vista_en)}` : ""}
        </p>
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
    <main className="mx-auto max-w-[900px] px-6 pb-16 pl-24 pt-10">
      <h1 className="font-display text-xl font-semibold text-zinc-100">Alertas</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Lo que el sistema marcó como problema. «Ya lo vi» la manda abajo; si vuelve a ocurrir, reaparece arriba como nueva.
      </p>

      <p className="mt-4 rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[12px] text-zinc-400">
        Esta pantalla muestra las alarmas del cerebro, los topes de costo y los problemas reales de la oficina (últimos {VENTANA_OFICINA_DIAS} días).
        Todavía no lee el historial del canal #alertas de Slack: la llave del bot no tiene permiso para leer ese historial.
      </p>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-zinc-200">Nuevas <span className="num text-zinc-500">({nuevas.length})</span></h2>
        {nuevas.length === 0 ? <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-4 text-sm text-zinc-400">Nada pendiente. Todo lo que el sistema marcó ya lo viste.</p> : (
          <ul className="rounded-lg border border-zinc-800 bg-zinc-900/60">{nuevas.map((a) => <Fila key={a.clave} a={a} conBoton />)}</ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-medium text-zinc-200">Ya vistas <span className="num text-zinc-500">({vistas.length})</span></h2>
        {vistas.length === 0 ? <p className="text-sm text-zinc-500">Todavía no marcaste ninguna.</p> : (
          <ul className="rounded-lg border border-zinc-800 bg-zinc-900/40">{vistas.map((a) => <Fila key={a.clave} a={a} conBoton={false} />)}</ul>
        )}
      </section>
    </main>
  )
}
