"use client"

/**
 * 6.49 · OBSERVABILIDAD VISUAL · las piezas gráficas del boceto aprobado por Emilio (2-nov):
 *  · GraficoDeBarras: barras grandes por día (o por hora), el mismo estilo que «Gasto en el tiempo» de Dinero: eje con cifras redondas, el día abajo,
 *    el total al pasar el cursor; los días que la lectura no alcanzó se dibujan «no leído» (borde punteado gris), nunca como cero.
 *  · CascadaVisible: la corrida con error como cascada; cada fase un tramo con su largo real, la que falló en rojo, tocar un tramo abre ese paso.
 *  · BarraHorizontal: la barra de un proceso o de un empleado (largo proporcional al mayor, tramo rojo = errores).
 * Colores: ámbar = normal · rojo = error · gris = interno / no leído. Nada más.
 */
import { useEffect, useRef, useState, type ReactNode } from "react"
import { pasoRedondo } from "@/lib/dinero-completo"
import { demoraCorta, type Cascada } from "@/lib/observabilidad"

export const AMBAR = "#e8731a"
export const ROJO = "#ff5a36"
export const GRIS = "#6f6a64"
const TENUE = "#8a8580"

/** el ancho real del contenedor: el gráfico se dibuja en píxeles reales (letras nítidas a cualquier ancho) */
export function useAncho<T extends HTMLElement>(inicial: number) {
  const ref = useRef<T>(null)
  const [ancho, setAncho] = useState(inicial)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(240, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, ancho] as const
}

export interface Capa { clave: string; nombre: string; color: string; valores: number[] }

export function GraficoDeBarras({ dato, rotulos, rotulo, capas, formato, noLeido, alto = 200, detalle, vacio, titulo, enteros = false }: {
  dato: string; rotulos: string[]; rotulo: (i: number) => string; capas: Capa[]; formato: (v: number) => string; noLeido?: boolean[]; alto?: number
  detalle: (i: number, total: number) => ReactNode; vacio: string; titulo: string; /** cuentas (corridas): el eje nunca dice «0,5» */ enteros?: boolean
}) {
  const [ref, W] = useAncho<HTMLDivElement>(640)
  const [sobre, setSobre] = useState<number | null>(null)
  const H = alto, IZQ = 62, ABAJO = 24, ARRIBA = 10
  const totales = rotulos.map((_, i) => capas.reduce((t, c) => t + (c.valores[i] ?? 0), 0))
  const tope = Math.max(0, ...totales)
  const pasoEje = tope > 0 ? (enteros ? Math.max(1, Math.round(pasoRedondo(tope / 4))) : pasoRedondo(tope / 4)) : 1
  const max = tope > 0 ? Math.ceil(tope / pasoEje - 1e-9) * pasoEje : 1
  const n = rotulos.length, paso = (W - IZQ - 8) / Math.max(1, n)
  const ancho = Math.max(Math.min(12, paso - 2), Math.min(56, paso * 0.68))
  const y = (v: number) => H - ABAJO - (v / max) * (H - ABAJO - ARRIBA)
  const cada = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((W - IZQ) / 58))))
  const lineas = tope > 0 ? Array.from({ length: Math.round(max / pasoEje) }, (_, i) => (i + 1) * pasoEje) : []
  const hayNoLeido = !!noLeido?.some(Boolean)
  const vacioTodo = tope === 0 && !hayNoLeido
  return (
    <div ref={ref} className="relative" onMouseLeave={() => setSobre(null)}>
      <svg data-grafico-obs={dato} width="100%" height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label={titulo}>
        {lineas.map((v) => (
          <g key={v}>
            <line x1={IZQ} x2={W - 4} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.07)" />
            <text data-eje x={IZQ - 8} y={y(v) + 4} textAnchor="end" fontSize={12} fill={TENUE}>{formato(v)}</text>
          </g>
        ))}
        <line x1={IZQ} x2={W - 4} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,.18)" />
        {rotulos.map((r, i) => {
          const x = IZQ + i * paso + (paso - ancho) / 2
          let acum = 0
          return (
            <g key={r} data-barra-dia={r} onMouseEnter={() => setSobre(i)}>
              <rect x={IZQ + i * paso} y={ARRIBA} width={paso} height={H - ABAJO - ARRIBA} fill={sobre === i ? "rgba(255,255,255,.05)" : "transparent"} />
              {noLeido?.[i] ? (
                <g data-no-leido={r}>
                  <rect x={x} y={ARRIBA + 28} width={ancho} height={H - ABAJO - ARRIBA - 28} fill="none" stroke={GRIS} strokeDasharray="3 4" rx={3} />
                  {ancho >= 40 && <text x={x + ancho / 2} y={(H - ABAJO + ARRIBA + 28) / 2 + 4} textAnchor="middle" fontSize={11} fill={GRIS}>no leído</text>}
                </g>
              ) : capas.map((c) => {
                const v = c.valores[i] ?? 0
                if (!v) return null
                const y1 = y(acum + v), y0 = y(acum)
                acum += v
                return <rect key={c.clave} data-capa={c.clave} x={x} y={y1} width={ancho} height={Math.max(1, y0 - y1)} fill={c.color} rx={acum === v ? 0 : 2} opacity={sobre == null || sobre === i ? 1 : 0.6} />
              })}
              {(i % cada === 0 || i === n - 1) && <text x={x + ancho / 2} y={H - 6} textAnchor="middle" fontSize={12} fill={TENUE}>{rotulo(i)}</text>}
            </g>
          )
        })}
        {vacioTodo && <text x={(W + IZQ) / 2} y={H / 2} textAnchor="middle" fontSize={14} fill="#6f6a64">{vacio}</text>}
      </svg>
      {sobre != null && (
        <div data-detalle-barra className="pointer-events-none absolute top-2 z-10 min-w-[160px] rounded-lg border border-white/10 bg-[#0f0d0c]/95 px-3 py-2 text-[12px] shadow-xl"
          style={{ left: `${Math.min(76, Math.max(2, ((IZQ + sobre * paso + paso) / W) * 100))}%` }}>
          {noLeido?.[sobre] ? <p className="text-zinc-400">La lectura no alcanzó este día: la plataforma entrega 200 ejecuciones por lectura.</p> : detalle(sobre, totales[sobre])}
        </div>
      )}
    </div>
  )
}

const recorta = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false })

export function CascadaVisible({ c, alTocar }: { c: Cascada; alTocar: (clave: string) => void }) {
  const [ref, W] = useAncho<HTMLDivElement>(1200)
  const pos = c.fases.map((f) => { const w = Math.max((f.dur_ms / c.total_ms) * 100, 1.2); return { l: Math.min((f.desde_ms / c.total_ms) * 100, 100 - w), w } })
  // las etiquetas van arriba del tramo; si pisan la anterior, abajo (así una fase corta al final no tapa a la de al lado)
  let finArriba = -Infinity, finAbajo = -Infinity
  const etiquetas = c.fases.map((f, i) => {
    const texto = `${recorta(f.nombre)}${f.fallo ? " ✕" : ""}`, largo = (texto.length + 7) * 6.8
    let x = (pos[i].l / 100) * W
    if (x + largo > W) x = Math.max(0, W - largo)
    const arriba = x >= finArriba
    if (arriba) finArriba = x + largo + 10; else finAbajo = x + largo + 10
    return { texto, x, arriba, derecha: x + largo >= W - 1 }
  })
  const pieLibre = finAbajo === -Infinity || etiquetas.every((e) => e.arriba || e.x > 190)
  return (
    <div ref={ref} data-cascada className="relative mt-1.5 h-[60px]">
      {c.fases.map((f, i) => (
        <button key={f.clave} type="button" data-fase={i + 1} data-fase-fallo={f.fallo ? "si" : undefined} onClick={() => alTocar(f.clave)}
          title={`${f.nombre} · ${demoraCorta(f.dur_ms)}${f.pasos > 1 ? ` · ${f.pasos} pasos` : ""} · tocar para ver el paso`}
          className="absolute top-[21px] h-[18px] rounded-[3px] hover:brightness-125 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-300"
          style={{ left: `${pos[i].l}%`, width: `${pos[i].w}%`, background: f.fallo ? ROJO : AMBAR }} />
      ))}
      {etiquetas.map((e, i) => (
        <p key={c.fases[i].clave} data-fase-nombre={i + 1} className="absolute whitespace-nowrap text-[12px]"
          style={{ top: e.arriba ? 0 : 42, left: e.derecha ? undefined : e.x, right: e.derecha ? 0 : undefined, color: c.fases[i].fallo ? ROJO : "#e4e4e7" }}>
          {e.texto} <span className="text-zinc-500">{demoraCorta(c.fases[i].dur_ms)}</span>
        </p>
      ))}
      {pieLibre && <p className="absolute left-0 top-[42px] text-[11px] text-zinc-500">{hora(c.inicio)} · {demoraCorta(c.total_ms)} en total</p>}
    </div>
  )
}

/** la barra de un proceso o de un empleado: largo proporcional al mayor; el tramo rojo (al final) es la parte con error */
export function BarraHorizontal({ pct, rojo = 0, color = AMBAR, alto = 20 }: { pct: number; rojo?: number; color?: string; alto?: number }) {
  return (
    <div className="w-full" style={{ height: alto }}>
      <div data-barra-largo={Math.round(pct)} className="flex h-full justify-end overflow-hidden rounded-[3px]" style={{ width: `${Math.max(pct, 0.6)}%`, background: color }}>
        {rojo > 0 && <div data-tramo-rojo className="h-full" style={{ width: `${Math.min(100, rojo)}%`, background: ROJO }} />}
      </div>
    </div>
  )
}
