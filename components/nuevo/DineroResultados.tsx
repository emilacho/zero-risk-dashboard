"use client"
/**
 * DINERO · PARTE 3 (6.38): sección 6 «costo por resultado» y costo de rehacer (Langfuse/Helicone: el costo pegado a lo que produjo), sección 7 «anomalías»
 * (aviso solo en el panel, sin Slack, con enlace a la corrida) y sección 8 «ahorro» (caché y oportunidades que no bajan la calidad) + el registro de los topes
 * suaves. SOLO LECTURA.
 */
import { useMemo } from "react"
import { Ayuda } from "@/components/nuevo/DineroAyuda"
import { ahorro, anomalias, costoDeRehacer, costoPorResultado, fechaCorta, usdCorto, veces, type Dinero } from "@/lib/dinero-completo"

const SIN_DATO = <span data-sin-dato-todavia className="italic text-zinc-500">sin dato todavía</span>
const CAJA = "rounded-xl border border-white/[0.09] bg-[#1b1815] p-4 sm:p-5"
const TITULO = "mb-3 flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-[#ffb86b]"

type Rango = { desde: string; hasta: string }

export function CostoPorResultado({ datos, rango }: { datos: Dinero; rango: Rango }) {
  const res = useMemo(() => costoPorResultado(datos, rango), [datos, rango])
  const rh = useMemo(() => costoDeRehacer(datos, rango), [datos, rango])
  const totalRehacer = rh.reduce((s, x) => s + (x.usd ?? 0), 0)
  return (
    <section data-dinero="resultado" className={CAJA}>
      <h3 className={TITULO}>Costo por resultado <Ayuda texto="Plan y manual: lo que costó cada corrida de su proceso. Pieza: el costo anotado en la bandeja de revisión. Rehacer: piezas devueltas, fallas, cortes por tope y pruebas." /></h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {res.map((r) => (
          <div key={r.clave} data-resultado={r.clave} className="rounded-lg border border-white/[0.07] bg-black/20 p-3">
            <p className="text-[12px] text-zinc-400">{r.nombre}</p>
            <p className="mt-1 text-[22px] tabular-nums text-zinc-100">{r.por_unidad == null ? SIN_DATO : usdCorto(r.por_unidad)}</p>
            <p className="mt-1 text-[11.5px] text-zinc-500">{r.nota}{r.por_unidad != null && r.cuantos > 1 ? ` · total ${usdCorto(r.total)}` : ""}</p>
          </div>
        ))}
      </div>
      <h4 className="mb-2 mt-5 text-[12px] text-zinc-300">Costo de rehacer <span data-total-rehacer className="ml-1 tabular-nums text-zinc-100">{usdCorto(totalRehacer)}</span></h4>
      <div className="divide-y divide-white/[0.05]">
        {rh.map((x) => (
          <div key={x.clave} data-rehacer={x.clave} className="flex items-baseline justify-between gap-3 py-2 text-[13px]">
            <span className="text-zinc-200">{x.nombre}<span className="ml-2 text-[11.5px] text-zinc-500">{x.nota}</span></span>
            <span className="whitespace-nowrap tabular-nums text-zinc-100">{x.usd == null ? SIN_DATO : usdCorto(x.usd)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Anomalias({ datos, rango, hoy, alAbrirCorrida }: { datos: Dinero; rango: Rango; hoy: string; alAbrirCorrida?: (id: string) => void }) {
  const lista = useMemo(() => anomalias(datos, hoy, rango), [datos, hoy, rango])
  return (
    <section data-dinero="anomalias" className={CAJA}>
      <h3 className={TITULO}>Anomalías <Ayuda texto="Días o corridas que gastaron 3× lo normal o más. Una corrida se compara con las de su mismo proceso. El aviso vive solo aquí, sin mensajes a Slack." /></h3>
      {lista.length === 0 ? <p className="text-[13px] text-zinc-400">Nada fuera de lo normal en este período.</p> : (
        <ul className="max-h-[340px] divide-y divide-white/[0.05] overflow-auto [scrollbar-width:thin]">
          {lista.map((a, i) => (
            <li key={`${a.tipo}-${a.corrida ?? a.d}-${i}`} data-anomalia={a.tipo} className="flex items-start gap-3 py-2.5 text-[13px]">
              <span className="mt-0.5 shrink-0 rounded-full border border-amber-500/40 px-1.5 text-[11px] tabular-nums text-amber-300">{veces(a.veces)}</span>
              <span className="min-w-0 flex-1">
                <span className="text-zinc-200">{a.texto}</span>
                <span className="block text-[11.5px] text-zinc-500">{fechaCorta(a.d)} · {a.tipo === "dia" ? "día" : "corrida"} · <span className="tabular-nums">{usdCorto(a.usd)}</span></span>
              </span>
              {a.corrida && alAbrirCorrida && <button type="button" onClick={() => alAbrirCorrida(a.corrida!)} className="shrink-0 text-[12px] text-zinc-200 underline decoration-amber-600/60 underline-offset-2 hover:decoration-amber-400">Ver la corrida →</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function Ahorro({ datos, rango }: { datos: Dinero; rango: Rango }) {
  const a = useMemo(() => ahorro(datos, rango), [datos, rango])
  return (
    <section data-dinero="ahorro" className={CAJA}>
      <h3 className={TITULO}>Ahorro <Ayuda lado="izquierda" texto="Lo ahorrado se estima con el precio de entrada de cada modelo (leer del caché cuesta la décima parte). Nunca se propone pasar a un modelo más barato." /></h3>
      <div className="grid grid-cols-2 gap-3">
        <div data-ahorro="cache" className="rounded-lg border border-white/[0.07] bg-black/20 p-3">
          <p className="text-[12px] text-zinc-400">Leído desde el caché (período)</p>
          <p className="mt-1 text-[22px] tabular-nums text-zinc-100">{a.pct_cache == null ? SIN_DATO : `${a.pct_cache} %`}</p>
        </div>
        <div data-ahorro="usd" className="rounded-lg border border-white/[0.07] bg-black/20 p-3">
          <p className="text-[12px] text-zinc-400">Ahorrado por el caché (estimado)</p>
          <p className="mt-1 text-[22px] tabular-nums text-[#7fc99a]">{a.ahorrado_usd == null ? SIN_DATO : usdCorto(a.ahorrado_usd)}</p>
        </div>
      </div>
      <h4 className="mb-2 mt-5 text-[12px] text-zinc-300">Oportunidades</h4>
      {a.oportunidades.length === 0 ? <p className="text-[13px] text-zinc-400">Ninguna clara en este período.</p> : (
        <ul className="space-y-2">
          {a.oportunidades.map((o, i) => (
            <li key={i} data-oportunidad className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-zinc-200">{o.texto}</span>
              {o.usd != null && <span className="whitespace-nowrap text-[12px] tabular-nums text-zinc-400">≈ {usdCorto(o.usd)}</span>}
            </li>
          ))}
        </ul>
      )}
      <h4 className="mb-1 mt-5 text-[12px] text-zinc-300">Registro de topes suaves</h4>
      <p data-registro-topes className="flex items-center gap-1.5 text-[13px] text-zinc-400">{SIN_DATO} <Ayuda lado="izquierda" texto="Hoy los topes suaves solo se sugieren; el registro empieza cuando se puedan fijar (llega con su certificación)." /></p>
    </section>
  )
}
