"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { DefsDelHolograma, HologramaFigura } from "@/components/nuevo/escena/Holograma"
import { LUGARES, duracionDelRecorrido, puntoDelMas, puntoEnLaRuta, repartirEnLaMesa, rutaDeLaPuertaALaSilla, rutaDeLaSillaALaPuerta, rutaPorLasLineas, rutaPorVarios } from "@/lib/escena-movimiento"
import { descripcionDelHolograma } from "@/lib/holograma"
import { mesaPorClave, type MesaViva, type Punto } from "@/lib/escena-avatares"
import type { ReunionDeLaSala } from "@/lib/escena-sala"
import { nombreCanonico } from "@/lib/organigrama"

/**
 * LOS AGENTES HOLOGRÁFICOS DE LA OFICINA (CC4 · 02-nov · sprints 1 y 2 + la sala): UN solo dueño de toda la animación, de punta a punta.
 * · En su escritorio: una silueta de luz por cada empleado que trabaja AHORA (o que falló: en rojo); el que escribe, sentado en la única silla; los que aportan, de pie alrededor.
 * · Reunión real en la sala (mesa de análisis, brief, gran idea): quien participa se LEVANTA, camina por las líneas de luz del piso hasta la puerta de cristal, ENTRA, rodea la
 *   mesa, llega a su silla y SE SIENTA; quien habla se ilumina (su globo de aporte lo dibuja la sala de CC6); al terminar la reunión se LEVANTA, sale por la puerta y camina de
 *   vuelta a su escritorio. Sin saltos: cada paso es una acción animada en una sola línea de tiempo por empleado.
 * Cada movimiento sale de una diferencia real entre la lectura anterior y la nueva. Con «reducir movimiento» no hay caminata ni transiciones: cada uno aparece en su sitio.
 * Los datos de la reunión (quién, en qué silla, quién habla) los lee de la sala de CC6; el panel y los globos siguen siendo de ella. El nombre se ve solo al pasar el cursor.
 */
type Accion =
  | { k: "levanta" | "sienta"; dur: number }
  | { k: "camina"; ruta: Punto[]; dur: number }
  | { k: "fade"; a: 0 | 1; dur: number }
interface Camina {
  clave: string; agente: string; nombre: string; mesa: string; color: string; descripcion: string
  pos: Punto; sentadoK: number; fallo: boolean; habla: boolean; cabecera: boolean
  op: number; lugar: "mesa" | "sala"; caminando: boolean
  acciones: Accion[]; t0: number; ini: number
}
interface Deseo { agente: string; nombre: string; mesa: string; color: string; pos: Punto; sentado: boolean; lugar: "mesa" | "sala"; fallo: boolean; habla: boolean; cabecera: boolean }
const FADE_MS = 600, LEVANTA_MS = 550, SIENTA_MS = 650
export const ESTILO_SILUETAS = `
.nv-av .nv-holo{filter:drop-shadow(0 0 5px rgba(255,170,60,.75))}
.nv-av .nv-holo[data-estado="falla"]{filter:drop-shadow(0 0 5px rgba(255,90,70,.8))}
.nv-av .nv-holo-cuerpo{animation:nvHoloFlicker 4.2s ease-in-out infinite}
.nv-av .nv-holo[data-estado="camina"] .nv-holo-cuerpo{animation:nvHoloPaso .5s ease-in-out infinite}
.nv-av .nv-holo-barrido{animation:nvHoloSube 3.4s linear infinite}
.nv-av .nv-sil{pointer-events:auto;cursor:default;outline:none}
.nv-av .nv-sil[data-lugar="sala"]{cursor:pointer}
.nv-av .nv-sil .nv-sil-nombre{opacity:0;transition:opacity .25s ease;pointer-events:none}
.nv-av .nv-sil:hover .nv-sil-nombre,.nv-av .nv-sil:focus-visible .nv-sil-nombre{opacity:1}
.nv-av .nv-sil:hover .nv-holo,.nv-av .nv-sil:focus-visible .nv-holo{filter:drop-shadow(0 0 8px rgba(255,215,150,.95))}
.nv-av .nv-sil[data-habla="true"] .nv-holo{filter:drop-shadow(0 0 9px rgba(255,200,110,1)) drop-shadow(0 0 18px rgba(255,160,50,.8))}
.nv-av .nv-sil[data-habla="true"] .nv-sil-halo{animation:nvSalaHabla 1.8s ease-in-out infinite}
@keyframes nvHoloFlicker{0%,100%{opacity:1}46%{opacity:.92}48%{opacity:.7}50%{opacity:.95}}
@keyframes nvHoloPaso{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}
@keyframes nvHoloSube{from{transform:translateY(0)}to{transform:translateY(4px)}}
@media (prefers-reduced-motion:reduce){.nv-av .nv-holo-cuerpo,.nv-av .nv-holo-barrido,.nv-av .nv-sil-halo{animation:none!important}}
`
const suave = (f: number) => (f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2)
/** un punto dentro de la sala de vidrio (sobre una silla o junto a la mesa) */
const dentroDeLaSala = (p: Punto): boolean => p.x > 1300 && p.x < 1500 && p.y > 405 && p.y < 585
const pegar = (...rutas: Punto[][]): Punto[] => rutaPorVarios(rutas.flat())

export function Siluetas({ mesas, reunion = null, enLaSala, onFoco, onTocar }: {
  mesas: MesaViva[]
  /** la reunión real de la sala (de CC6): quién, en qué silla, quién habla; `null` = sin reunión */
  reunion?: ReunionDeLaSala | null
  /** nombres canónicos de quienes están ahora en una reunión en curso */
  enLaSala: Set<string>
  onFoco?: (agente: string | null) => void
  onTocar?: (agente: string) => void
}) {
  // lo que DEBE verse ahora: los de la reunión, sentados en su silla; y los demás que trabajan, en su escritorio
  const deseos = useMemo(() => {
    const m = new Map<string, Deseo>()
    const enCurso = reunion?.estado === "en_curso" ? reunion : null
    for (const mesa of mesas) {
      const visibles = { ...mesa, sentados: mesa.sentados.filter((s) => !enLaSala.has(nombreCanonico(s.agente))) }
      for (const p of repartirEnLaMesa(visibles).puestos) m.set(nombreCanonico(p.s.agente), { agente: p.s.agente, nombre: p.s.nombre, mesa: mesa.nombre, color: mesa.color, pos: p.pos, sentado: p.postura === "sentado", lugar: "mesa", fallo: p.s.estado === "fallo", habla: false, cabecera: false })
    }
    for (const p of enCurso?.participantes ?? []) {
      if (!p.silla) continue
      m.set(nombreCanonico(p.agente), { agente: p.agente, nombre: p.nombre, mesa: p.equipo, color: (p.mesa ? mesaPorClave(p.mesa)?.color : null) ?? "#f5a524", pos: p.silla, sentado: true, lugar: "sala", fallo: p.estado === "fallo", habla: p.estado === "hablando", cabecera: p.cabecera })
    }
    return m
  }, [mesas, reunion, enLaSala])

  const almacen = useRef<Map<string, Camina> | null>(null)
  const primera = useRef(true)
  const nuevoCamina = (k: string, d: Deseo, o: Partial<Camina> = {}): Camina => ({
    clave: k, agente: d.agente, nombre: d.nombre, mesa: d.mesa, color: d.color, descripcion: descripcionDelHolograma(d.agente), pos: d.pos, sentadoK: d.sentado ? 1 : 0, fallo: d.fallo, habla: d.habla, cabecera: d.cabecera,
    op: 1, lugar: d.lugar, caminando: false, acciones: [], t0: 0, ini: 1, ...o,
  })
  // los que ya están al abrir la escena están en su sitio desde el primer cuadro (nada de entrada teatral por cada recarga)
  if (almacen.current === null) { const m = new Map<string, Camina>(); for (const [k, d] of deseos) m.set(k, nuevoCamina(k, d)); almacen.current = m }
  const [, setCuadro] = useState(0)
  const raf = useRef<number | null>(null)
  const reducir = useRef(false)
  useEffect(() => { reducir.current = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches }, [])

  useEffect(() => {
    const a = almacen.current!
    const sinAnimar = reducir.current
    const esPrimera = primera.current; primera.current = false
    const planear = (c: Camina, d: Deseo) => {
      const acc: Accion[] = []
      const sentadoAhora = c.sentadoK > 0.01
      const mismoSitio = Math.hypot(c.pos.x - d.pos.x, c.pos.y - d.pos.y) < 1 && c.lugar === d.lugar
      if (mismoSitio && !c.acciones.length) { if (sentadoAhora !== d.sentado) acc.push({ k: d.sentado ? "sienta" : "levanta", dur: SIENTA_MS }); return acc }
      if (sentadoAhora) acc.push({ k: "levanta", dur: LEVANTA_MS })
      const origenEnSala = c.lugar === "sala" && dentroDeLaSala(c.pos)
      // el camino: de la sala a la calle (si salía de una silla), de ahí al destino; de un escritorio a la calle y por la puerta a la silla; o directo entre dos puestos
      let ruta: Punto[]
      if (d.lugar === "sala") ruta = c.lugar === "sala" ? pegar([c.pos, d.pos]) : pegar(rutaPorLasLineas(c.pos, LUGARES.sala), rutaDeLaPuertaALaSilla(d.pos))
      else ruta = c.lugar === "sala" && origenEnSala ? pegar(rutaDeLaSillaALaPuerta(c.pos), rutaPorLasLineas(LUGARES.sala, d.pos)) : pegar(rutaPorLasLineas(c.pos, d.pos))
      acc.push({ k: "camina", ruta, dur: duracionDelRecorrido(ruta, 7000) })
      if (d.sentado) acc.push({ k: "sienta", dur: SIENTA_MS })
      return acc
    }
    for (const [k, d] of deseos) {
      const c = a.get(k)
      if (!c) {
        if (esPrimera) { a.set(k, nuevoCamina(k, d)); continue }
        // aparece: quien se sienta en la sala sin haber estado en un escritorio entra por la puerta; quien llega a su escritorio se enciende ahí
        const n = d.lugar === "sala" ? nuevoCamina(k, d, { pos: LUGARES.sala, sentadoK: 0, op: 0, lugar: "sala" }) : nuevoCamina(k, d, { op: 0 })
        n.acciones = [{ k: "fade", a: 1, dur: FADE_MS }, ...(d.lugar === "sala" ? [{ k: "camina", ruta: rutaDeLaPuertaALaSilla(d.pos), dur: duracionDelRecorrido(rutaDeLaPuertaALaSilla(d.pos), 7000) } as Accion, { k: "sienta", dur: SIENTA_MS } as Accion] : d.sentado ? [] : [])]
        n.lugar = d.lugar; n.pos = d.lugar === "sala" ? LUGARES.sala : d.pos
        a.set(k, n); continue
      }
      c.fallo = d.fallo; c.habla = d.habla; c.nombre = d.nombre; c.cabecera = d.cabecera; c.color = d.color; c.mesa = d.mesa
      const destinoActual = c.acciones.length ? (() => { const cam = [...c.acciones].reverse().find((x) => x.k === "camina") as Extract<Accion, { k: "camina" }> | undefined; return cam ? cam.ruta[cam.ruta.length - 1] : c.pos })() : c.pos
      const yaVa = c.acciones.length > 0 && Math.hypot(destinoActual.x - d.pos.x, destinoActual.y - d.pos.y) < 1 && c.lugar === d.lugar
      if (c.op < 1 && !c.acciones.some((x) => x.k === "fade" && x.a === 1) && !yaVa) c.acciones = [{ k: "fade", a: 1, dur: FADE_MS }, ...c.acciones.filter((x) => x.k !== "fade")]
      if (yaVa) continue
      const antes = c.lugar
      const acc = planear(c, d)
      c.acciones = acc; c.t0 = 0; c.lugar = d.lugar
      if (antes !== d.lugar || acc.some((x) => x.k === "camina")) c.ini = c.op
    }
    // los que ya no deben verse: si estaban sentados en la sala, se levantan y salen por la puerta; si no, se desvanecen donde están
    for (const [k, c] of a) {
      if (deseos.has(k)) continue
      if (c.acciones.length && c.acciones[c.acciones.length - 1].k === "fade" && (c.acciones[c.acciones.length - 1] as { a: number }).a === 0) continue
      if (c.lugar === "sala" && dentroDeLaSala(c.pos)) {
        const ruta = rutaDeLaSillaALaPuerta(c.pos)
        c.acciones = [...(c.sentadoK > 0.01 ? [{ k: "levanta", dur: LEVANTA_MS } as Accion] : []), { k: "camina", ruta, dur: duracionDelRecorrido(ruta, 7000) }, { k: "fade", a: 0, dur: FADE_MS }]
      } else c.acciones = [{ k: "fade", a: 0, dur: FADE_MS }]
      c.t0 = 0
    }
    // sin animación: se aplica todo de una vez
    if (sinAnimar) {
      for (const [k, c] of a) {
        for (const x of c.acciones) { if (x.k === "camina") c.pos = x.ruta[x.ruta.length - 1]; else if (x.k === "sienta") c.sentadoK = 1; else if (x.k === "levanta") c.sentadoK = 0; else if (x.k === "fade") c.op = x.a }
        c.acciones = []; c.caminando = false
        if (c.op === 0 && !deseos.has(k)) a.delete(k)
      }
    }
    if (raf.current == null && !sinAnimar) arrancar()
    if (sinAnimar) setCuadro((n) => n + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deseos])

  function arrancar() {
    const vuelta = (t: number) => {
      const a = almacen.current!
      let vivo = false
      for (const [k, c] of a) {
        c.caminando = false
        const x = c.acciones[0]
        if (x) {
          if (!c.t0) { c.t0 = t; c.ini = x.k === "fade" ? c.op : c.ini }
          const f = Math.min((t - c.t0) / Math.max(x.dur, 1), 1)
          if (x.k === "camina") { c.pos = puntoEnLaRuta(x.ruta, suave(f)); c.caminando = f < 1 }
          else if (x.k === "levanta") c.sentadoK = 1 - suave(f)
          else if (x.k === "sienta") c.sentadoK = suave(f)
          else if (x.k === "fade") c.op = c.ini + (x.a - c.ini) * suave(f)
          if (f >= 1) { if (x.k === "camina") c.pos = x.ruta[x.ruta.length - 1]; else if (x.k === "levanta") c.sentadoK = 0; else if (x.k === "sienta") c.sentadoK = 1; else if (x.k === "fade") c.op = x.a; c.acciones.shift(); c.t0 = 0 }
          vivo = true
        }
        if (!c.acciones.length && c.op === 0 && !almacenTiene(k)) a.delete(k)
      }
      setCuadro((n) => n + 1)
      raf.current = vivo ? requestAnimationFrame(vuelta) : null
    }
    raf.current = requestAnimationFrame(vuelta)
  }
  const deseosRef = useRef(deseos); deseosRef.current = deseos
  const almacenTiene = (k: string) => deseosRef.current.has(k)
  useEffect(() => () => { if (raf.current != null) cancelAnimationFrame(raf.current); raf.current = null }, [])

  const dibujo = [...almacen.current!.values()].sort((x, y) => x.pos.y - y.pos.y)
  const deMas = mesas.map((m) => ({ m, n: repartirEnLaMesa({ ...m, sentados: m.sentados.filter((s) => !enLaSala.has(nombreCanonico(s.agente))) }).deMas })).filter((x) => x.n > 0)
  return (
    <g data-siluetas>
      <defs><DefsDelHolograma /></defs>
      {dibujo.map((c) => {
        const estado = c.fallo ? "falla" : c.caminando ? "camina" : "trabajando"
        const k = c.sentadoK
        return (
          <g key={c.clave} className="nv-sil" data-agente={c.agente} data-lugar={c.lugar} data-postura={k > 0.5 ? "sentado" : "de_pie"} data-estado={c.fallo ? "fallo" : "trabajando"} data-habla={c.habla} data-cabecera={c.cabecera} data-caminando={c.caminando ? "true" : undefined}
            opacity={c.op} transform={`translate(${c.pos.x.toFixed(1)} ${c.pos.y.toFixed(1)})`} role="img" tabIndex={0} aria-label={`${c.nombre}. ${c.mesa}. ${c.fallo ? "con fallo" : c.habla ? "hablando ahora" : "trabajando ahora"}. ${c.descripcion}${c.lugar === "sala" ? ". Ver su aporte completo" : ""}`}
            onMouseEnter={c.lugar === "sala" && onFoco ? () => onFoco(c.agente) : undefined} onMouseLeave={c.lugar === "sala" && onFoco ? () => onFoco(null) : undefined}
            onFocus={c.lugar === "sala" && onFoco ? () => onFoco(c.agente) : undefined} onBlur={c.lugar === "sala" && onFoco ? () => onFoco(null) : undefined}
            onClick={c.lugar === "sala" && onTocar ? (e) => { e.stopPropagation(); onTocar(c.agente) } : undefined}>
            {c.habla && <ellipse className="nv-sil-halo" cx={0} cy={-40} rx={34} ry={46} fill="url(#nv-av-ambar)" />}
            {k < 0.99 && <g opacity={1 - k} transform={`translate(0 ${(12 * k).toFixed(1)})`}><HologramaFigura semilla={c.agente} color={c.color} postura="de_pie" estado={estado} /></g>}
            {k > 0.01 && <g opacity={k}><HologramaFigura semilla={c.agente} color={c.color} postura="sentado" estado={c.fallo ? "falla" : "trabajando"} /></g>}
            <rect x={-22} y={-86} width={44} height={96} fill="transparent" />
            <text className="nv-sil-nombre" y={-92} textAnchor="middle" fill="#ffe2a8" fontSize={17} fontFamily="system-ui, Arial, sans-serif" stroke="#000" strokeWidth={3} paintOrder="stroke">{c.nombre}{c.cabecera ? " · dirige" : ""}</text>
          </g>
        )
      })}
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
