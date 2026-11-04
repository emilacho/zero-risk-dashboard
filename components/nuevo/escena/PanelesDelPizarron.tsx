/**
 * 03-nov (CC4) · lo que se abre al tocar el pizarrón y la vitrina de la foto. De macro a micro: primero el pizarrón con todas las redes en botones GRANDES,
 * luego la tarjeta grande de la red tocada (sus números, o «sin cuenta todavía · se conecta cuando exista»). La vitrina abre su propia tarjeta.
 */
import { useState } from "react"
import { TEXTO_SIN_CUENTA, type CuadroDeMetrica, type MetricasDelPizarron } from "@/lib/escena-metricas"
import { textoDeLaVitrinaVacia, type VitrinaDeLaEscena } from "@/lib/escena-vitrina"
import { enlaceDeLaPieza } from "@/lib/pizarron"

export const SIN_CUENTA_LARGO = "sin cuenta todavía · se conecta cuando exista"

export function textoDeLaTarjeta(c: CuadroDeMetrica): string {
  return c.tiene ? (c.principal ?? c.texto) : SIN_CUENTA_LARGO
}

export function PanelDelPizarron({ metricas, inicial, onCerrar }: { metricas: MetricasDelPizarron | undefined; inicial?: string | null; onCerrar: () => void }) {
  const [clave, setClave] = useState<string | null>(inicial ?? null)
  const cuadros = metricas?.cuadros ?? []
  const c = cuadros.find((x) => x.clave === clave) ?? null
  return (
    <div className="flex flex-col gap-3" data-panel-pizarron>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[.18em] text-zinc-500">Pizarrón de métricas</div>
          <div className="text-[18px] font-semibold text-amber-100">{c ? c.nombre : "Elige una red"}</div>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="min-h-[44px] min-w-[44px] rounded-lg text-[22px] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200">×</button>
      </div>
      {c ? (
        <div data-tarjeta-de-red={c.clave} className="rounded-2xl border border-amber-300/30 bg-white/[0.03] p-4">
          <div className={`text-[22px] font-semibold ${c.tiene ? "text-amber-100" : "text-zinc-400"}`}>{textoDeLaTarjeta(c)}</div>
          {c.tiene && c.variacion && <div className="mt-1 text-[15px] text-zinc-300">{c.variacion}</div>}
          <button type="button" data-volver-al-pizarron onClick={() => setClave(null)} className="mt-4 min-h-[52px] w-full rounded-xl border border-white/15 text-[15px] text-zinc-200 hover:bg-white/[0.06]">← Todas las redes</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2" aria-label="Redes">
          {cuadros.map((x) => (
            <button key={x.clave} type="button" data-red={x.clave} data-tiene={x.tiene} onClick={() => setClave(x.clave)}
              className={`min-h-[72px] rounded-2xl border px-3 py-2 text-left ${x.tiene ? "border-amber-300/40 bg-amber-300/[0.08] text-amber-100" : "border-white/10 bg-white/[0.02] text-zinc-400"}`}>
              <div className="text-[16px] font-semibold">{x.nombre}</div>
              <div className="text-[12px] opacity-80">{x.tiene ? x.texto : TEXTO_SIN_CUENTA}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function PanelDeLaVitrina({ vitrina, onCerrar }: { vitrina: VitrinaDeLaEscena | undefined; onCerrar: () => void }) {
  const piezas = vitrina?.piezas ?? []
  const otras = vitrina?.otros_clientes
  const [verOtras, setVerOtras] = useState(false)
  return (
    <div className="flex flex-col gap-3" data-panel-vitrina>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[.18em] text-zinc-500">Vitrina</div>
          <div className="text-[18px] font-semibold text-amber-100">{piezas.length ? "Las mejores piezas" : "Aún sin piezas"}</div>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="min-h-[44px] min-w-[44px] rounded-lg text-[22px] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200">×</button>
      </div>
      {piezas.length === 0 ? (
        <div data-vitrina-vacia className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[16px] text-zinc-300">{textoDeLaVitrinaVacia(vitrina)}</p>
          {/* Lenovo 22:06Z: la Vitrina filtra por el cliente elegido; si hay aprobadas de otros clientes, lo dice y se ven con un toque */}
          {otras && otras.cuantos > 0 && (verOtras ? (
            <ul data-vitrina-otros-clientes className="mt-3 space-y-2">
              {otras.piezas.map((p) => (
                <li key={p.id}><a href={enlaceDeLaPieza(p.id)} className="flex min-h-[52px] items-center rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[15px] text-zinc-100 hover:bg-white/[0.06]">{p.titulo}{p.cliente && !p.titulo.includes(p.cliente) ? ` · ${p.cliente}` : ""}</a></li>
              ))}
            </ul>
          ) : (
            <button type="button" data-accion="vitrina-ver-otros-clientes" onClick={() => setVerOtras(true)} className="mt-3 min-h-[52px] w-full rounded-xl border border-amber-300/40 bg-amber-300/[0.08] text-[15px] text-amber-100 hover:bg-amber-300/[0.14]">Verlas</button>
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {piezas.map((p, i) => (
            <li key={i} data-pieza className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              {p.imagen && <img src={p.imagen} alt="" className="h-14 w-14 rounded-lg object-cover" />}
              <div><div className="text-[15px] font-medium text-zinc-100">{p.titulo}</div>{p.texto && <div className="text-[12px] text-zinc-400">{p.texto}</div>}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
