import { redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerGasto } from "@/lib/gasto-datos"
import { familiaLegible, estadoDeLaPiezaLegible } from "@/lib/lenguaje"
import { usd2, usdFino, type DiaDeGasto, type Reparto } from "@/lib/gasto"

export const dynamic = "force-dynamic"
export const metadata = { title: "Gasto" }

/** el techo diario que vigilan las alarmas (canon: US$ 10 al día) */
const TECHO_DIARIO_USD = 10

const corto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`

function Cifra({ titulo, valor, nota }: { titulo: string; valor: string; nota: string }) {
  return (
    <div className="surface-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{titulo}</p>
      <p className="num mt-1 text-2xl font-semibold text-zinc-100">{valor}</p>
      <p className="mt-1 text-[12px] text-zinc-500">{nota}</p>
    </div>
  )
}

function Barras({ dias }: { dias: DiaDeGasto[] }) {
  const max = Math.max(TECHO_DIARIO_USD, ...dias.map((d) => d.total))
  return (
    <div>
      <div className="relative flex h-40 items-end gap-[3px] border-b border-zinc-800">
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-zinc-700" style={{ bottom: `${(TECHO_DIARIO_USD / max) * 100}%` }} />
        {dias.map((d) => (
          <div key={d.dia} className="flex h-full flex-1 flex-col justify-end" title={`${corto(d.dia)} · ${usd2(d.total)} (empleados ${usd2(d.agentes)} · Apify ${usd2(d.apify)})`}>
            <div className="bg-zinc-500" style={{ height: `${(d.apify / max) * 100}%` }} />
            <div className="bg-zinc-300" style={{ height: `${(d.agentes / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-zinc-500">
        <span>{corto(dias[0].dia)}</span>
        <span>línea punteada: techo diario de la alarma ({usd2(TECHO_DIARIO_USD)})</span>
        <span>{corto(dias[dias.length - 1].dia)}</span>
      </div>
      <p className="mt-2 flex gap-4 text-[11px] text-zinc-400">
        <span><span className="mr-1 inline-block h-2 w-2 bg-zinc-300" />empleados AI</span>
        <span><span className="mr-1 inline-block h-2 w-2 bg-zinc-500" />Apify</span>
      </p>
    </div>
  )
}

function Tabla({ titulo, filas, vacio }: { titulo: string; filas: Reparto[]; vacio: string }) {
  return (
    <section className="surface-card p-4">
      <h2 className="text-sm font-medium text-zinc-200">{titulo}</h2>
      {filas.length === 0 ? <p className="mt-3 text-sm text-zinc-500">{vacio}</p> : (
        <table className="mt-3 w-full text-[13px]">
          <tbody>
            {filas.map((f) => (
              <tr key={f.clave || "_"} className="border-t border-zinc-800">
                <td className="py-1.5 pr-2 text-zinc-300">{f.nombre}</td>
                <td className="num whitespace-nowrap py-1.5 pr-2 text-right text-zinc-500">{f.llamadas} llamadas</td>
                <td className="num whitespace-nowrap py-1.5 text-right text-zinc-100">{usdFino(f.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export default async function GastoPage() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) redirect(puerta.status === 401 ? "/login?next=%2Fgasto" : "/login?error=forbidden")
  const { resumen: r, por_cliente_visible, cortado, leido_en } = await leerGasto(getServiceRoleClient())
  const sobreElTecho = r.hoy.total > TECHO_DIARIO_USD

  return (
    <main data-seccion="gasto" className="mx-auto max-w-[1100px] px-6 pb-16 pl-24 pt-10">
      <h1 className="font-display text-xl font-semibold text-zinc-100">Gasto</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Lo que cuestan los empleados AI y Apify. Es la misma cifra que miran los vigías. Días contados en hora de Ecuador.
      </p>

      {cortado && <p className="mt-4 rounded border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-300">Hay más filas de las que esta pantalla alcanza a leer: las cifras pueden estar incompletas.</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Cifra titulo="Hoy" valor={usd2(r.hoy.total)} nota={`empleados ${usd2(r.hoy.agentes)} · Apify ${usd2(r.hoy.apify)}${sobreElTecho ? " · sobre el techo diario" : ""}`} />
        <Cifra titulo={`Este mes · ${r.mes.etiqueta}`} valor={usd2(r.mes.total)} nota={`empleados ${usd2(r.mes.agentes)} · Apify ${usd2(r.mes.apify)}`} />
        <Cifra titulo="Últimos 30 días" valor={usd2(r.ultimos.total)} nota={`promedio ${usd2(r.ultimos.promedio_por_dia)} al día`} />
      </div>

      <section className="mt-6 surface-card p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-200">Gasto por día</h2>
        <Barras dias={r.ultimos.dias} />
      </section>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <Tabla titulo="Por cliente (30 días)" filas={por_cliente_visible} vacio="Sin gasto en estos 30 días." />
        <Tabla titulo="Por proveedor (30 días)" filas={r.por_proveedor} vacio="Sin gasto en estos 30 días." />
      </div>

      <section className="mt-6 surface-card p-4">
        <h2 className="text-sm font-medium text-zinc-200">Piezas de la oficina · gasto contra tope</h2>
        {r.piezas.length === 0 ? <p className="mt-3 text-sm text-zinc-500">Todavía no hay piezas.</p> : (
          <table className="mt-3 w-full text-[13px]">
            <tbody>
              {r.piezas.map((p) => (
                <tr key={p.id} className="border-t border-zinc-800">
                  <td className="py-1.5 pr-2 text-zinc-300">{familiaLegible(p.familia)}{p.dry_run ? " · prueba" : ""}</td>
                  <td className="py-1.5 pr-2 text-zinc-500">{estadoDeLaPiezaLegible(p.estado)}</td>
                  <td className="num py-1.5 text-right text-zinc-100">{usdFino(p.gasto_usd)} <span className="text-zinc-500">de {usd2(p.tope_usd)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-6 text-[12px] leading-relaxed text-zinc-500">
        <h2 className="text-sm font-medium text-zinc-300">Cómo se calcula</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Empleados AI: lo que registra el libro de llamadas de cada empleado.</li>
          <li>Apify: el detalle de cada llamada de la libreta de costos; los días anteriores al 5 de septiembre solo tienen el total del día.</li>
          <li>Gasto de la agencia = sin cliente asignado: {usd2(r.sin_cliente_agentes_usd)} de empleados y {usd2(r.apify_sin_cliente_usd)} de Apify en estos 30 días.</li>
          <li>Leído el {new Date(leido_en).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}.</li>
        </ul>
      </section>
    </main>
  )
}
