"use client"

/**
 * LAS PIEZAS DEL PEDIDO DE CAMBIOS (CC6 · 02-nov · encargo «pedir cambios al manual»: el manual funciona IGUAL que el plan). Salen tal cual del panel del
 * plan para que los dos documentos usen las mismas: la barra de avance (cinco pasos, «Ahora: …», Ocultar) y «Qué cambió» (dos a la vista, el resto al abrir).
 * La animación vive en ESTILO_DEL_PEDIDO (el plan la trae en su propio estilo con las mismas clases).
 */
import { useState } from "react"
import type { AvanceDelPedido } from "@/lib/plan"
import { plural } from "@/lib/lenguaje"
import { HORA_24 } from "@/lib/formato"

export const ESTILO_DEL_PEDIDO = `
.nv-pl-paso-vivo{animation:none}
@keyframes nvPlPaso{0%,100%{box-shadow:0 0 0 0 rgba(245,165,36,.0)}50%{box-shadow:0 0 0 6px rgba(245,165,36,.25)}}
@media (prefers-reduced-motion:reduce){.nv-pl-paso-vivo{animation:none}}
`

const COLOR_PASO: Record<string, string> = { hecho: "border-amber-300 bg-amber-400 text-black", en_curso: "nv-pl-paso-vivo border-amber-300 bg-amber-400/25 text-amber-100", pendiente: "border-white/20 bg-transparent text-zinc-500", fallo: "border-rose-400 bg-rose-500/80 text-white" }
/** LA BARRA DE PROGRESO del pedido de cambios (ADENDA 1 de Emilio, 01-nov): cinco pasos con su hora, el tiempo estimado y, si falla, el paso en rojo con qué hacer */
export function BarraDelPedido({ avance, onOcultar }: { avance: AvanceDelPedido; /** cerrarla a propósito (se reabre con «Ver el avance») */ onOcultar?: () => void }) {
  return (
    <div data-barra-del-pedido data-fallo={avance.fallo ? "si" : "no"} className="relative mt-4 rounded-lg border border-white/10 bg-black/30 p-4" role="group" aria-label="El avance de tu pedido de cambios">
      {onOcultar && <button type="button" data-accion="ocultar-avance" onClick={onOcultar} className="absolute right-2 top-2 rounded px-2 py-0.5 text-[11px] text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200">Ocultar</button>}
      <ol className={`grid grid-cols-1 gap-3 ${avance.pasos.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-5"}`}>
        {avance.pasos.map((p, i) => (
          <li key={p.clave} data-paso={p.clave} data-estado={p.estado} className="flex items-start gap-2 sm:flex-col sm:items-center sm:text-center">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold ${COLOR_PASO[p.estado]}`}>{p.estado === "hecho" ? "✓" : p.estado === "fallo" ? "!" : i + 1}</span>
            <span className="min-w-0">
              <span className={`block text-[12.5px] ${p.estado === "pendiente" ? "text-zinc-500" : p.estado === "fallo" ? "text-rose-200" : "text-zinc-100"}`}>{p.nombre}</span>
              <span className="block text-[11px] text-zinc-500">{p.hora ? horaCortaEC(p.hora) : p.estado === "en_curso" ? "en curso" : "—"}</span>
              {p.detalle && <span className="block text-[11px] text-rose-300">{p.detalle}</span>}
              {p.detalle_tecnico && <details data-detalle-tecnico className="text-[10.5px] text-zinc-500"><summary className="cursor-pointer">ver detalle</summary><span className="block break-words">{p.detalle_tecnico}</span></details>}
            </span>
          </li>
        ))}
      </ol>
      {avance.ahora && <p data-ahora={avance.ahora.quien} className="mt-3 flex items-center gap-2 text-[13px] text-zinc-100"><span aria-hidden className="nv-pl-paso-vivo inline-block h-2 w-2 rounded-full bg-violet-400" />Ahora: {avance.ahora.texto.charAt(0).toLowerCase()}{avance.ahora.texto.slice(1)}{avance.ahora.desde ? ` · desde las ${horaCortaEC(avance.ahora.desde)}` : ""}</p>}
      <p className="mt-3 text-[12px] text-zinc-400" data-estimado>{avance.estimado}</p>
      {avance.nota && <p className="mt-1 text-[12px] text-amber-200">{avance.nota}</p>}
      {avance.fallo && <p role="alert" className="mt-2 rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-100">{avance.fallo.texto} <span className="text-rose-200/80">{avance.fallo.que_hacer}</span></p>}
    </div>
  )
}
/** la hora (Ecuador) de un instante: «15:42» */
export const horaCortaEC = (iso: string): string => { try { return new Date(iso).toLocaleTimeString("es-EC", { ...HORA_24, timeZone: "America/Guayaquil" }) } catch { return "—" } }

export function QueCambio({ titulo, lineas }: { titulo: string; lineas: string[] }) {
  const [abierto, setAbierto] = useState(false)
  const visibles = abierto ? lineas : lineas.slice(0, 2)
  return (
    <div data-que-cambio data-abierto={abierto} className="mt-3 rounded-lg border border-amber-400/40 bg-black/30 p-3">
      <button type="button" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)} className="flex w-full items-center gap-2 text-left">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-amber-300">{titulo} · {plural(lineas.length, "cambio", "cambios")}</span>
        <span aria-hidden className={`ml-auto text-zinc-500 transition ${abierto ? "rotate-90" : ""}`}>›</span>
      </button>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-zinc-100">{visibles.map((l, i) => <li key={i} className={abierto ? "" : "line-clamp-2"}>{l}</li>)}</ul>
      {lineas.length > 2 && <button type="button" data-accion="ver-que-cambio" onClick={() => setAbierto((v) => !v)} className="mt-1 text-[11.5px] text-amber-300 underline decoration-dotted underline-offset-4 hover:text-amber-200">{abierto ? "Ver menos" : `Ver los ${lineas.length} cambios`}</button>}
    </div>
  )
}

