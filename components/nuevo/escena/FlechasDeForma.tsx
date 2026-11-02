"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { FichaDeRendimiento } from "@/components/nuevo/escena/FichaDeRendimiento"
import { FORMA_LEGIBLE, type Rendimiento } from "@/lib/rendimiento"
import { nombreCanonico } from "@/lib/organigrama"

/**
 * LA FLECHA DE FORMA SOBRE CADA EMPLEADO (CC6 · 02-nov · idea de Emilio, como la de los juegos FIFA): una CAPA PROPIA dentro del dibujo de la oficina.
 * No toca la animación de CC4: lee dónde está cada silueta (`.nv-sil[data-agente]`, su `translate` y su postura) y dibuja encima la flecha de su forma.
 * ↑ verde · ↗ verde claro · → ámbar · ↘ naranja · ↓ rojo; con pocas tareas, un punto tenue. Al TOCAR la flecha se abre su ficha de rendimiento.
 * Corrección de Emilio (02-nov 16:08Z, «así no se mostraba en FIFA; además está muy grande»): SOLO la flecha coloreada, sin recuadro ni brillo, del tamaño
 * de la letra del nombre (17), pegada encima de la cabeza; cuando el nombre aparece (al pasar el cursor), la flecha se corre junto al nombre. El área de toque
 * sigue siendo generosa (un cuadro transparente). El punto de «pocas entregas», casi imperceptible.
 */
/** un nombre de agente seguro dentro de un selector CSS entre comillas */
const CSS_SEGURO = (s: string) => s.replace(/["\\]/g, "")
interface Puesto { agente: string; nombre: string; color: string; x: number; y: number; sentado: boolean }
const TRASLADO = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/
/** la altura de la flecha (su línea de base) sobre los pies de la silueta: justo encima de la cabeza (centro de la cabeza −72 de pie / −44 sentado, radio ~7 + cabello) */
export const ALTO = { de_pie: 85, sentado: 57 } as const
/** la letra del nombre de la silueta (`.nv-sil-nombre`, 17) y su línea de base (−92): la flecha usa el mismo tamaño y, con el nombre a la vista, se pone a su lado */
export const TAM_FLECHA = 17
const Y_DEL_NOMBRE = -92
/** cuánto se corre la flecha para quedar junto al nombre (ancho aproximado del nombre / 2 + aire) */
export const corrimientoJuntoAlNombre = (nombre: string): number => Math.round((nombre.length * TAM_FLECHA * 0.56) / 2 + 10)

export function leerPuestos(raiz: ParentNode): Puesto[] {
  const salida: Puesto[] = []
  raiz.querySelectorAll<SVGGElement>(".nv-sil[data-agente]").forEach((g) => {
    const m = TRASLADO.exec(g.getAttribute("transform") ?? "")
    if (!m || Number(g.getAttribute("opacity") ?? "1") < 0.5) return
    const etiqueta = g.getAttribute("aria-label") ?? ""
    salida.push({ agente: g.getAttribute("data-agente") ?? "", nombre: etiqueta.split(".")[0] || (g.getAttribute("data-agente") ?? ""), color: g.querySelector("[data-color]")?.getAttribute("data-color") ?? "#f5a524", x: Number(m[1]), y: Number(m[2]), sentado: g.getAttribute("data-postura") === "sentado" })
  })
  return salida
}
const igual = (a: Puesto[], b: Puesto[]) => a.length === b.length && a.every((p, i) => p.agente === b[i].agente && Math.abs(p.x - b[i].x) < 0.5 && Math.abs(p.y - b[i].y) < 0.5 && p.sentado === b[i].sentado)

export function FlechasDeForma({ datosIniciales = null, puestosIniciales = null }: { /** solo pruebas y el arnés */ datosIniciales?: Record<string, Rendimiento> | null; /** solo pruebas */ puestosIniciales?: Puesto[] | null }) {
  const capa = useRef<SVGGElement>(null)
  const [datos, setDatos] = useState<Record<string, Rendimiento> | null>(datosIniciales)
  const [puestos, setPuestos] = useState<Puesto[]>(puestosIniciales ?? [])
  const [abierta, setAbierta] = useState<Puesto | null>(null)

  // los datos: una vez y cada 5 min (la forma no cambia de un segundo a otro)
  useEffect(() => {
    if (datosIniciales) return
    let vivo = true
    const leer = async () => { try { const r = await fetch("/api/rendimiento", { cache: "no-store" }); const j = (await r.json()) as { ok: boolean; empleados?: Record<string, Rendimiento> }; if (vivo && j.ok && j.empleados) setDatos(j.empleados) } catch { /* sin datos: no se dibuja nada */ } }
    void leer(); const id = setInterval(leer, 5 * 60_000)
    return () => { vivo = false; clearInterval(id) }
  }, [datosIniciales])
  // dónde está cada silueta: se lee del dibujo de CC4 en cada cuadro, sin tocarlo
  useEffect(() => {
    if (puestosIniciales) return
    let id = 0
    const mirar = () => { const svg = capa.current?.ownerSVGElement; if (svg) { const nuevos = leerPuestos(svg); setPuestos((v) => (igual(v, nuevos) ? v : nuevos)) } id = requestAnimationFrame(mirar) }
    id = requestAnimationFrame(mirar)
    return () => cancelAnimationFrame(id)
  }, [puestosIniciales])

  const r = (a: string) => datos?.[nombreCanonico(a)] ?? null
  // con el nombre a la vista (cursor encima de la silueta), la flecha va junto al nombre en vez de encima de la cabeza
  const junto = puestos.filter((p) => r(p.agente)?.forma).map((p) => {
    const a = CSS_SEGURO(p.agente)
    const dy = Y_DEL_NOMBRE - -(p.sentado ? ALTO.sentado : ALTO.de_pie)
    return `.nv-av:has(.nv-sil[data-agente="${a}"]:hover) [data-forma-de="${a}"] .nv-flecha,.nv-av:has(.nv-sil[data-agente="${a}"]:focus-visible) [data-forma-de="${a}"] .nv-flecha{transform:translate(${corrimientoJuntoAlNombre(p.nombre)}px,${dy}px)}`
  }).join("")
  return (
    <g ref={capa} data-flechas-de-forma style={{ pointerEvents: "none" }}>
      <style>{`.nv-flecha{transition:transform .25s ease}@media (prefers-reduced-motion:reduce){.nv-flecha{transition:none}}${junto}`}</style>
      {puestos.map((p) => {
        const x = r(p.agente)
        if (!x) return null
        const y = p.y - (p.sentado ? ALTO.sentado : ALTO.de_pie)
        if (!x.forma) return <circle key={p.agente} data-forma-de={p.agente} data-forma="sin" cx={p.x} cy={y - 4} r={1.6} fill="#ffb347" opacity={0.22}><title>{`${p.nombre}: ${x.motivo_sin_flecha ?? "sin flecha"}`}</title></circle>
        const f = FORMA_LEGIBLE[x.forma]
        return (
          <g key={p.agente} data-forma-de={p.agente} data-forma={x.forma} transform={`translate(${p.x.toFixed(1)} ${y.toFixed(1)})`} style={{ pointerEvents: "auto", cursor: "pointer" }} role="button" tabIndex={0} aria-label={`${p.nombre}: ${f.texto}. Toca para ver su rendimiento.`}
            onClick={(e) => { e.stopPropagation(); setAbierta(p) }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAbierta(p) } }}>
            {/* el área de toque, invisible y generosa */}
            <rect data-toque x={-16} y={-24} width={32} height={30} fill="transparent" />
            <g className="nv-flecha">
              <text x={0} y={0} textAnchor="middle" fontSize={TAM_FLECHA} fontWeight={700} fill={f.color} fontFamily="system-ui, Arial, sans-serif" stroke="#000" strokeWidth={2.5} strokeOpacity={0.55} paintOrder="stroke">{`${f.flecha}︎`}</text>
            </g>
          </g>
        )
      })}
      {abierta && r(abierta.agente) && typeof document !== "undefined" && createPortal(<FichaDeRendimiento r={r(abierta.agente)!} nombre={abierta.nombre} color={abierta.color} onCerrar={() => setAbierta(null)} />, document.body)}
    </g>
  )
}
