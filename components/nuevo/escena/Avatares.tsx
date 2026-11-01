"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { FigurasSpline } from "@/components/nuevo/escena/FigurasSpline"
import { ESTILO_PANTALLAS, PantallaDeLaMesa } from "@/components/nuevo/escena/PantallaDeLaMesa"
import { FichaDelEmpleado } from "@/components/nuevo/escena/FichaDelEmpleado"
import {
  asientosDeLaMesa, colocarFiguras, ESCENA_AVATARES, FOTO, lineasDeLaFicha, MAXIMO_POR_MESA, MESAS, tableroDeLaMesa,
  type ClaveDeMesa, type EscenaDatos, type Mesa, type MesaViva,
} from "@/lib/escena-avatares"

/**
 * LA ESCENA VIVA · AVATARES (CC6 · Sprint 1 · 01-nov): la capa que va ENCIMA de la foto de la oficina de marketing, dentro de la proyección de `EscenaViva`.
 * - Las 6 MESAS de la foto regenerada (01-nov): rejilla de 2 filas × 3 columnas, cada una en su celda; la sala de reuniones encierra solo la mesa redonda y el mueble.
 * - En la silla de cada mesa se SIENTA SOLO quien está trabajando ahora (dato real de `agent_dispatches`); si trabajan varios, se sientan a lo largo de la mesa.
 *   Mesa sin nadie trabajando = vacía y quieta. Al tocar la mesa se ve el equipo completo con su estado. Nunca hay avatares de relleno.
 * - Estados por el monitor de la FOTO: trabajando = brilla ámbar y late · en espera = como en la foto · falló = en rojo.
 * - Al pasar el cursor por una figura: la ficha (nombre · equipo · estado · en qué · desde cuándo · gasto de esa tarea · fuente y hora). Lo que no hay dice «sin dato».
 * - Las figuras 3D (cuerpo completo, hechas en Spline) las pinta `FigurasSpline` en un lienzo transparente del tamaño de la foto; esta capa solo decide dónde y en qué estado.
 * Solo LECTURA: la escena muestra, no manda acciones. Pide `/api/escena-viva` cada SONDEO_MS (se detiene con la pestaña oculta).
 */
export const SONDEO_MS = 5000
type Respuesta = ({ ok: true } & EscenaDatos) | { ok: false; error: string }
const pct = (n: number, total: number) => `${((n / total) * 100).toFixed(3)}%`
const TAM_ROTULO = 26

const ESTILO = `
.nv-av{pointer-events:none}
.nv-av .nv-av-zona{pointer-events:auto;cursor:pointer;outline:none}
.nv-av .nv-av-zona polygon{fill:rgba(255,140,40,0);stroke:none;transition:fill .3s ease}
.nv-av .nv-av-zona:hover polygon,.nv-av .nv-av-zona:focus-visible polygon,.nv-av .nv-av-zona[aria-expanded="true"] polygon{fill:rgba(255,140,40,.06)}
.nv-av .nv-av-rotulo{opacity:0;transform:translateY(5px);transition:opacity .4s ease,transform .4s ease;pointer-events:none}
.nv-av .nv-av-zona:hover .nv-av-rotulo,.nv-av .nv-av-zona:focus-visible .nv-av-rotulo,.nv-av .nv-av-zona[aria-expanded="true"] .nv-av-rotulo,.nv-av .nv-av-mesa[data-ocupada="true"] .nv-av-rotulo{opacity:1;transform:none}
.nv-av .nv-av-luz{opacity:0;transition:opacity .6s ease}
.nv-av .nv-av-luz[data-on="ambar"]{opacity:.9;animation:nvAvLate 2.6s ease-in-out infinite}
.nv-av .nv-av-luz[data-on="rojo"]{opacity:.85;animation:nvAvLateRojo 1.4s ease-in-out infinite}
.nv-av .nv-av-asiento{pointer-events:auto;cursor:default;outline:none}
.nv-av .nv-av-asiento ellipse{fill:rgba(255,170,60,0);stroke:rgba(255,170,60,0);transition:fill .3s ease,stroke .3s ease}
.nv-av .nv-av-asiento[data-figura="false"] ellipse{stroke:rgba(255,170,60,.55);stroke-width:2;fill:rgba(255,170,60,.1)}
.nv-av .nv-av-asiento[data-figura="false"][data-estado="fallo"] ellipse{stroke:rgba(255,90,74,.7);fill:rgba(255,90,74,.12)}
.nv-av .nv-av-asiento:hover ellipse,.nv-av .nv-av-asiento:focus-visible ellipse{stroke:rgba(255,200,120,.8)}
.nv-av .nv-av-ficha,.nv-av .nv-av-lista{pointer-events:auto;animation:nvAvEntra .25s ease both}
@keyframes nvAvLate{0%,100%{opacity:.9}50%{opacity:.55}}
@keyframes nvAvLateRojo{0%,100%{opacity:.85}50%{opacity:.4}}
@keyframes nvAvEntra{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.nv-av .nv-av-luz[data-on]{animation:none}.nv-av .nv-av-ficha,.nv-av .nv-av-lista{animation:none}.nv-av .nv-av-rotulo,.nv-av .nv-av-luz{transition:none}}
`

/** la mesa vacía que se dibuja antes de que llegue el dato (y si la lectura falla): sin sentados, sin equipo, sin inventar */
const vacia = (m: Mesa): MesaViva => ({ ...m, sentados: [], equipo: [], trabajando: 0, fallando: 0 })

export function Avatares({ datosIniciales = null }: { /** solo pruebas y el arnés: arrancar con estos datos */ datosIniciales?: EscenaDatos | null }) {
  const [datos, setDatos] = useState<EscenaDatos | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [mesaAbierta, setMesaAbierta] = useState<ClaveDeMesa | null>(null)
  const [ficha, setFicha] = useState<string | null>(null) // «mesa|agente» de la figura bajo el cursor
  const [fichaDe, setFichaDe] = useState<string | null>(null) // Sprint B · el empleado cuya ficha (currículum) está abierta
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  const leer = useCallback(async () => {
    try {
      const r = await fetch("/api/escena-viva", { cache: "no-store" })
      const j = (await r.json()) as Respuesta
      if (!j.ok) throw new Error(j.error)
      setDatos(j); setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }, [])
  // sondeo cada SONDEO_MS; con la pestaña oculta no se pide nada
  useEffect(() => {
    let vivo = true
    const vuelta = async () => { if (!vivo) return; if (document.visibilityState !== "hidden") await leer(); if (vivo) temporizador.current = setTimeout(vuelta, SONDEO_MS) }
    void vuelta()
    const alVolver = () => { if (document.visibilityState === "visible") void leer() }
    document.addEventListener("visibilitychange", alVolver)
    return () => { vivo = false; if (temporizador.current) clearTimeout(temporizador.current); document.removeEventListener("visibilitychange", alVolver) }
  }, [leer])
  // Esc o clic fuera cierran la lista del equipo
  useEffect(() => {
    if (!mesaAbierta) return
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setMesaAbierta(null) } }
    const alClic = (e: MouseEvent) => { if (!(e.target as Element | null)?.closest?.(".nv-av-lista,.nv-av-zona")) setMesaAbierta(null) }
    window.addEventListener("keydown", alTeclear, true)
    window.addEventListener("click", alClic, true)
    return () => { window.removeEventListener("keydown", alTeclear, true); window.removeEventListener("click", alClic, true) }
  }, [mesaAbierta])

  const mesas: MesaViva[] = useMemo(() => (datos ? datos.mesas : MESAS.map(vacia)), [datos])
  const colocaciones = useMemo(() => colocarFiguras(mesas), [mesas])
  const hayFiguras = ESCENA_AVATARES !== ""
  const abierta = mesaAbierta ? mesas.find((m) => m.clave === mesaAbierta) ?? null : null
  const enFicha = ficha ? (() => { const [mk, ag] = ficha.split("|"); const m = mesas.find((x) => x.clave === mk); const s = m?.sentados.find((x) => x.agente === ag); return m && s ? { m, s } : null })() : null
  const posFicha = enFicha ? asientosDeLaMesa(enFicha.m, enFicha.m.sentados.length)[Math.min(enFicha.m.sentados.indexOf(enFicha.s), MAXIMO_POR_MESA - 1)] : null

  return (
    <div className="nv-av absolute inset-0" data-escena-viva data-leido={datos?.leido_en ?? ""} data-error={error ?? ""}>
      <style>{ESTILO + ESTILO_PANTALLAS}</style>
      {hayFiguras && <FigurasSpline colocaciones={colocaciones} />}
      <svg viewBox={`0 0 ${FOTO.w} ${FOTO.h}`} className="absolute inset-0 h-full w-full" role="group" aria-label="Las mesas de la oficina de marketing y quién trabaja ahora" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="nv-av-ambar"><stop offset="0" stopColor="#ffb347" stopOpacity=".75" /><stop offset=".45" stopColor="#ff9a2e" stopOpacity=".28" /><stop offset="1" stopColor="#ff8c1a" stopOpacity="0" /></radialGradient>
          <linearGradient id="nv-pa-reflejo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity=".09" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" /></linearGradient>
          <radialGradient id="nv-av-rojo"><stop offset="0" stopColor="#ff6a55" stopOpacity=".8" /><stop offset=".45" stopColor="#ff4a3a" stopOpacity=".3" /><stop offset="1" stopColor="#ff3a2a" stopOpacity="0" /></radialGradient>
        </defs>
        {/* Sprint A · la pantalla de cada monitor: negra si nadie trabaja, viva según el oficio si alguien trabaja, roja si falló */}
        {mesas.map((m) => <PantallaDeLaMesa key={`pantalla-${m.clave}`} m={m} />)}
        {mesas.map((m) => {
          const on = m.trabajando > 0 ? "ambar" : m.fallando > 0 ? "rojo" : ""
          const asientos = asientosDeLaMesa(m, m.sentados.length)
          const deMas = m.sentados.length - asientos.length
          const subtitulo = m.sentados.length ? `${m.trabajando} trabajando${m.fallando ? ` · ${m.fallando} con fallo` : ""}` : m.etapa === "segunda_etapa" ? "por activar · nadie trabaja" : "nadie trabaja ahora"
          return (
            <g key={m.clave} className="nv-av-mesa" data-mesa={m.clave} data-etapa={m.etapa} data-ocupada={m.sentados.length > 0} data-trabajando={m.trabajando} opacity={m.etapa === "segunda_etapa" && !m.sentados.length ? 0.75 : 1}>
              {/* la luz del monitor de la foto: ámbar cuando alguien trabaja, roja si lo último fue un fallo; el derrame al piso va sobre la silla */}
              <ellipse className="nv-av-luz" data-on={on || undefined} cx={m.monitor.x} cy={m.monitor.y} rx={150} ry={95} fill={on === "rojo" ? "url(#nv-av-rojo)" : "url(#nv-av-ambar)"} />
              <ellipse className="nv-av-luz" data-on={on || undefined} cx={m.silla.x + 10} cy={m.silla.y + 30} rx={170} ry={70} fill={on === "rojo" ? "url(#nv-av-rojo)" : "url(#nv-av-ambar)"} style={{ opacity: on ? 0.45 : 0 } as CSSProperties} />
              {/* la zona del ratón: el tablero de la mesa (en las 2 nuevas, además, el trazo punteado del boceto) */}
              <g className="nv-av-zona" role="button" tabIndex={0} aria-label={`${m.nombre}: ${subtitulo}. Ver el equipo`} aria-haspopup="dialog" aria-expanded={mesaAbierta === m.clave}
                onClick={(e) => { e.stopPropagation(); setMesaAbierta((k) => (k === m.clave ? null : m.clave)) }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMesaAbierta((k) => (k === m.clave ? null : m.clave)) } }}>
                <polygon points={tableroDeLaMesa(m)} />
                <g className="nv-av-rotulo">
                  <text x={m.rotulo.x} y={m.rotulo.y} textAnchor="middle" fill="none" stroke={m.etapa === "activo" ? "#e8731a" : "#9a9a9a"} strokeWidth={(TAM_ROTULO * 0.9) / 16} fontSize={TAM_ROTULO} fontWeight="500" letterSpacing={(TAM_ROTULO * 3.4) / 16} fontFamily="system-ui, Arial, sans-serif">{m.nombre.toUpperCase()}</text>
                  <text x={m.rotulo.x} y={m.rotulo.y + 24} textAnchor="middle" fill={m.sentados.length ? "#ffd9a0" : "#9a9a9a"} fontSize={17} fontFamily="system-ui, Arial, sans-serif">{subtitulo}</text>
                </g>
              </g>
              {/* los asientos ocupados: el blanco del cursor para la ficha (la figura 3D la pinta Spline encima; sin escena, un marcador en la silla) */}
              {asientos.map((p, i) => {
                const s = m.sentados[i]
                const k = `${m.clave}|${s.agente}`
                return (
                  <g key={k} className="nv-av-asiento" data-agente={s.agente} data-estado={s.estado} data-figura={hayFiguras} role="img" tabIndex={0} aria-label={lineasDeLaFicha(s, m).join(". ")}
                    onMouseEnter={() => setFicha(k)} onMouseLeave={() => setFicha((f) => (f === k ? null : f))} onFocus={() => setFicha(k)} onBlur={() => setFicha((f) => (f === k ? null : f))}>
                    <ellipse cx={p.x} cy={p.y - 40} rx={38} ry={62} />
                  </g>
                )
              })}
              {deMas > 0 && <text x={asientos[asientos.length - 1].x + 50} y={asientos[asientos.length - 1].y - 70} fill="#ffd9a0" fontSize={20} fontFamily="system-ui, Arial, sans-serif">+{deMas}</text>}
            </g>
          )
        })}
        {/* trabajando ahora sin mesa conocida: se dice, no se inventa una mesa */}
        {datos && datos.sin_mesa.length > 0 && (
          <text x={560} y={1120} fill="#bdb3a4" fontSize={18} fontFamily="system-ui, Arial, sans-serif" data-sin-mesa>sin mesa conocida · {datos.sin_mesa.map((s) => `${s.nombre} (${s.estado})`).join(" · ")}</text>
        )}
      </svg>
      {/* la ficha al pasar el cursor por una figura */}
      {enFicha && posFicha && (
        <div role="tooltip" className="nv-av-ficha absolute z-[3] w-max max-w-[22rem] -translate-y-full rounded-xl border border-amber-400/60 bg-[#0e0c0a]/95 px-3.5 py-2.5 text-[12px] leading-[1.45] text-zinc-200 shadow-[0_8px_30px_rgba(0,0,0,.6)]"
          style={{ left: pct(posFicha.x + 50, FOTO.w), top: pct(posFicha.y - 110, FOTO.h) }} data-ficha={enFicha.s.agente}>
          {lineasDeLaFicha(enFicha.s, enFicha.m).map((l, i) => (
            <div key={i} className={i === 0 ? "text-[13px] font-semibold text-amber-100" : i === lineasDeLaFicha(enFicha.s, enFicha.m).length - 1 ? "mt-1 text-[11px] text-zinc-500" : undefined}>{l}</div>
          ))}
        </div>
      )}
      {/* el equipo de la mesa, al tocarla: todos, con su estado real; los que trabajan ahora primero */}
      {abierta && (
        <div role="dialog" aria-label={`Equipo ${abierta.nombre}`} className="nv-av-lista absolute z-[4] w-[22rem] max-h-[60%] overflow-auto rounded-xl border border-white/15 bg-[#121110]/95 p-3 text-[12px] text-zinc-200 shadow-[0_8px_30px_rgba(0,0,0,.6)]"
          style={{ left: pct(Math.min(abierta.centro.x + 130, FOTO.w - 700), FOTO.w), top: pct(Math.max(abierta.centro.y - 160, 40), FOTO.h) }} onClick={(e) => e.stopPropagation()}>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div><span className="text-[13px] font-semibold" style={{ color: abierta.color }}>{abierta.nombre}</span><span className="ml-2 text-[11px] text-zinc-500">{abierta.etapa === "activo" ? "activo" : "segunda etapa · por activar"}</span></div>
            <button type="button" onClick={() => setMesaAbierta(null)} aria-label="Cerrar" className="rounded px-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200">×</button>
          </div>
          {abierta.equipo.length === 0 ? (
            <p className="text-zinc-500">{datos ? "nadie asignado a esta mesa en el directorio ni en el mapa" : "leyendo…"}</p>
          ) : (
            <ul className="space-y-1">
              {abierta.equipo.map((p) => (
                <li key={p.agente} className="flex items-baseline justify-between gap-2" data-miembro={p.agente} data-estado={p.estado}>
                  <span className="min-w-0 truncate"><button type="button" data-abrir-ficha={p.agente} onClick={(e) => { e.stopPropagation(); setFichaDe(p.agente) }} title={`Ver la ficha de ${p.nombre}`} className="truncate text-left underline decoration-white/20 decoration-dotted underline-offset-4 hover:text-amber-100 hover:decoration-amber-300 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">{p.nombre}</button>{p.origen_de_la_mesa === "mapa" && <span className="ml-1 text-[10px] text-zinc-500" title="sin tarjeta en el directorio; equipo según el mapa firmado">(mapa)</span>}</span>
                  <span className={`shrink-0 text-[11px] ${p.estado === "trabajando" ? "text-amber-200" : p.estado === "fallo" ? "text-red-300" : p.estado === "reciente" ? "text-zinc-300" : "text-zinc-500"}`}>
                    {p.estado === "trabajando" ? "trabajando ahora" : p.estado === "fallo" ? `falló ${p.hace}` : p.estado === "reciente" ? `trabajó ${p.hace}` : p.ultima ? `última ${p.hace}` : "sin trabajo en 24 h"}
                    {p.nota && <span className="block text-[10px] text-zinc-500">{p.nota}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[10px] text-zinc-600">{datos ? datos.fuente : "sin dato todavía"}{datos && datos.sin_fin_registrado > 0 ? ` · ${datos.sin_fin_registrado} despacho(s) abiertos sin fin registrado (no se sientan)` : ""}</p>
        </div>
      )}
      {error && <span className="sr-only" data-error-lectura>{error}</span>}
      {fichaDe && <FichaDelEmpleado agente={fichaDe} onCerrar={() => setFichaDe(null)} />}
    </div>
  )
}
