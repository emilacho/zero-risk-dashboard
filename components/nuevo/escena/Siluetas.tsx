"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { DefsDelHolograma, HologramaFigura } from "@/components/nuevo/escena/Holograma"
import { LUGARES, decidirMovimiento, duracionDelRecorrido, puntoDelMas, puntoEnLaRuta, repartirEnLaMesa, rutaPorLasLineas, type Postura, type PuestoDeAgente, type Visto } from "@/lib/escena-movimiento"
import { descripcionDelHolograma } from "@/lib/holograma"
import type { MesaViva, Punto } from "@/lib/escena-avatares"
import { nombreCanonico } from "@/lib/organigrama"

/**
 * LOS AGENTES EN SUS ESCRITORIOS Y CAMINANDO A LA SALA (CC4 · 02-nov · sprints 1 y 2): una silueta de luz ámbar por cada empleado que trabaja AHORA (o que falló: en rojo),
 * en su escritorio: el que escribe, sentado en la única silla; los que aportan, de pie alrededor de esa computadora. Cada uno lleva su toque propio (`lib/holograma`).
 * Sprint 2: cuando hay una reunión real en la sala (mesa de análisis, brief, gran idea), quien participa CAMINA por las líneas de luz del piso desde su escritorio hasta la
 * entrada de la sala y desaparece ahí (adentro lo sienta la sala de CC6: aquí no se dibuja ninguna reunión); cuando la reunión termina, sale de la entrada y camina de vuelta
 * a su puesto. Cada movimiento sale de una diferencia real entre la lectura anterior y la nueva (nada se mueve «porque sí»). Con «reducir movimiento» no hay caminata:
 * aparece y desaparece en su sitio. El nombre se ve solo al pasar el cursor.
 */
interface Camina {
  clave: string; agente: string; nombre: string; mesa: string; color: string; descripcion: string
  pos: Punto; postura: Postura; fallo: boolean
  op: number; opObjetivo: number
  ruta: Punto[] | null; t0: number; dur: number
  luego: "queda" | "quita"
}
const FADE_MS = 700
export const ESTILO_SILUETAS = `
.nv-av .nv-holo{filter:drop-shadow(0 0 5px rgba(255,170,60,.75))}
.nv-av .nv-holo[data-estado="falla"]{filter:drop-shadow(0 0 5px rgba(255,90,70,.8))}
.nv-av .nv-holo-cuerpo{animation:nvHoloFlicker 4.2s ease-in-out infinite}
.nv-av .nv-holo[data-estado="camina"] .nv-holo-cuerpo{animation:nvHoloPaso .5s ease-in-out infinite}
.nv-av .nv-holo-barrido{animation:nvHoloSube 3.4s linear infinite}
.nv-av .nv-sil{pointer-events:auto;cursor:default;outline:none}
.nv-av .nv-sil .nv-sil-nombre{opacity:0;transition:opacity .25s ease;pointer-events:none}
.nv-av .nv-sil:hover .nv-sil-nombre,.nv-av .nv-sil:focus-visible .nv-sil-nombre{opacity:1}
.nv-av .nv-sil:hover .nv-holo,.nv-av .nv-sil:focus-visible .nv-holo{filter:drop-shadow(0 0 8px rgba(255,215,150,.95))}
@keyframes nvHoloFlicker{0%,100%{opacity:1}46%{opacity:.92}48%{opacity:.7}50%{opacity:.95}}
@keyframes nvHoloPaso{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}
@keyframes nvHoloSube{from{transform:translateY(0)}to{transform:translateY(4px)}}
@media (prefers-reduced-motion:reduce){.nv-av .nv-holo-cuerpo,.nv-av .nv-holo-barrido{animation:none!important}}
`
const suave = (f: number) => (f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2)

export function Siluetas({ mesas, enLaSala }: { mesas: MesaViva[]; /** nombres canónicos de quienes están ahora en la sala de reuniones */ enLaSala: Set<string> }) {
  // quién está a la vista en un escritorio ahora: los que trabajan y NO están en la sala (esos los dibuja la sala)
  const puestosAhora = useMemo(() => {
    const m = new Map<string, PuestoDeAgente & { mesa: string; color: string; fallo: boolean }>()
    for (const mesa of mesas) {
      const visibles = { ...mesa, sentados: mesa.sentados.filter((s) => !enLaSala.has(nombreCanonico(s.agente))) }
      for (const p of repartirEnLaMesa(visibles).puestos) m.set(nombreCanonico(p.s.agente), { ...p, mesa: mesa.nombre, color: mesa.color, fallo: p.s.estado === "fallo" })
    }
    return m
  }, [mesas, enLaSala])

  // los que ya trabajan al abrir la escena están en su puesto desde el primer cuadro (nada de entrada teatral por cada recarga)
  const almacen = useRef<Map<string, Camina> | null>(null)
  if (almacen.current === null) {
    const m = new Map<string, Camina>()
    for (const [k, p] of puestosAhora) m.set(k, { clave: k, agente: p.s.agente, nombre: p.s.nombre, mesa: p.mesa, color: p.color, descripcion: descripcionDelHolograma(p.s.agente), pos: p.pos, postura: p.postura, fallo: p.fallo, op: 1, opObjetivo: 1, ruta: null, t0: 0, dur: 0, luego: "queda" })
    almacen.current = m
  }
  const previoEnSala = useRef(new Set<string>())
  const [, setCuadro] = useState(0)
  const raf = useRef<number | null>(null)
  const reducir = useRef(false)
  useEffect(() => { reducir.current = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches }, [])

  useEffect(() => {
    const ahora = performance.now()
    const a = almacen.current!
    const sinAnimar = reducir.current
    const nuevo = (k: string, p: { s: { agente: string; nombre: string }; mesa: string; color: string; fallo: boolean; pos: Punto; postura: Postura }, desde: Punto, op: number): Camina => ({
      clave: k, agente: p.s.agente, nombre: p.s.nombre, mesa: p.mesa, color: p.color, descripcion: descripcionDelHolograma(p.s.agente), pos: desde, postura: p.postura, fallo: p.fallo, op, opObjetivo: 1, ruta: null, t0: ahora, dur: 0, luego: "queda",
    })
    const caminar = (c: Camina, hasta: Punto, luego: Camina["luego"]) => {
      const ruta = rutaPorLasLineas(c.pos, hasta)
      c.ruta = sinAnimar ? null : ruta; c.t0 = ahora; c.dur = duracionDelRecorrido(ruta); c.luego = luego
      if (sinAnimar) { c.pos = hasta; if (luego === "quita") c.opObjetivo = 0 }
    }
    for (const [k, p] of puestosAhora) {
      const previo = a.get(k)
      const antes = previo && previo.luego !== "quita" ? ({ pos: previo.ruta ? previo.ruta[previo.ruta.length - 1] : previo.pos, postura: previo.postura } satisfies Visto) : undefined
      const intencion = decidirMovimiento(antes, p, { enLaSala: false, veniaDeLaSala: previoEnSala.current.has(k) })
      let c = previo
      if (c && c.luego === "quita") { c = undefined; a.delete(k) } // vuelve a trabajar mientras se iba: entra de nuevo
      if (intencion.tipo === "aparece") { a.set(k, nuevo(k, p, intencion.hasta, 0)) }
      else if (intencion.tipo === "llega_de_la_sala") { const n = nuevo(k, p, { ...LUGARES.sala }, 1); a.set(k, n); caminar(n, intencion.hasta, "queda") }
      else if (intencion.tipo === "camina" && c) { c.postura = p.postura; c.mesa = p.mesa; c.color = p.color; caminar(c, intencion.hasta, "queda") }
      if (c) { c.fallo = p.fallo; c.opObjetivo = 1; c.nombre = p.s.nombre }
    }
    // los que ya no están en su escritorio: a la sala (si la reunión real los sentó) o se desvanecen
    for (const [k, c] of a) {
      if (puestosAhora.has(k) || c.luego === "quita") continue
      const quehacer = decidirMovimiento({ pos: c.pos, postura: c.postura }, undefined, { enLaSala: enLaSala.has(k), veniaDeLaSala: false })
      if (quehacer.tipo === "va_a_la_sala") caminar(c, LUGARES.sala, "quita")
      else { c.luego = "quita"; c.opObjetivo = 0 }
    }
    previoEnSala.current = new Set(enLaSala)
    if (raf.current == null) arrancar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puestosAhora, enLaSala])

  function arrancar() {
    const vuelta = (t: number) => {
      const a = almacen.current!
      let vivo = false
      for (const [k, c] of a) {
        if (c.ruta) {
          const f = (t - c.t0) / c.dur
          if (f >= 1) { c.pos = c.ruta[c.ruta.length - 1]; c.ruta = null; if (c.luego === "quita") c.opObjetivo = 0 } else { c.pos = puntoEnLaRuta(c.ruta, suave(Math.max(f, 0))); vivo = true }
        }
        if (c.op !== c.opObjetivo) { const paso = 16 / FADE_MS; c.op = c.op < c.opObjetivo ? Math.min(c.op + paso, c.opObjetivo) : Math.max(c.op - paso, c.opObjetivo); vivo = true }
        if (c.luego === "quita" && c.op === 0 && !c.ruta) a.delete(k)
      }
      setCuadro((n) => n + 1)
      raf.current = vivo ? requestAnimationFrame(vuelta) : null
    }
    raf.current = requestAnimationFrame(vuelta)
  }
  useEffect(() => () => { if (raf.current != null) cancelAnimationFrame(raf.current); raf.current = null }, [])

  const dibujo = [...almacen.current!.values()].sort((x, y) => x.pos.y - y.pos.y)
  const deMas = mesas.map((m) => ({ m, n: repartirEnLaMesa({ ...m, sentados: m.sentados.filter((s) => !enLaSala.has(nombreCanonico(s.agente))) }).deMas })).filter((x) => x.n > 0)
  return (
    <g data-siluetas>
      <defs><DefsDelHolograma /></defs>
      {dibujo.map((c) => (
        <g key={c.clave} className="nv-sil" data-agente={c.agente} data-postura={c.postura} data-estado={c.fallo ? "fallo" : "trabajando"} data-caminando={c.ruta ? "true" : undefined} opacity={c.op} transform={`translate(${c.pos.x.toFixed(1)} ${c.pos.y.toFixed(1)})`}
          role="img" tabIndex={0} aria-label={`${c.nombre}. ${c.mesa}. ${c.fallo ? "con fallo" : "trabajando ahora"}. ${c.descripcion}`}>
          <HologramaFigura semilla={c.agente} color={c.color} postura={c.postura} estado={c.fallo ? "falla" : c.ruta ? "camina" : "trabajando"} />
          <rect x={-22} y={-86} width={44} height={96} fill="transparent" />
          <text className="nv-sil-nombre" y={-92} textAnchor="middle" fill="#ffe2a8" fontSize={17} fontFamily="system-ui, Arial, sans-serif" stroke="#000" strokeWidth={3} paintOrder="stroke">{c.nombre}</text>
        </g>
      ))}
      {deMas.map(({ m, n }) => {
        const p = puntoDelMas(m)
        return (
          <g key={m.clave} data-de-mas={m.clave} transform={`translate(${p.x} ${p.y})`} aria-label={`${n} más trabajando en ${m.nombre}`}>
            <rect x={-20} y={-14} width={40} height={26} rx={13} fill="#0e0c0a" fillOpacity={0.88} stroke="#ffb347" strokeOpacity={0.75} />
            <text y={5} textAnchor="middle" fill="#ffd9a0" fontSize={17} fontFamily="system-ui, Arial, sans-serif">+{n}</text>
          </g>
        )
      })}
    </g>
  )
}
