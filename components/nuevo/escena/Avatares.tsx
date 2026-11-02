"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { ESTILO_SILUETAS, Siluetas } from "@/components/nuevo/escena/Siluetas"
import { agentesEnLaSala, lineasDeLaSala } from "@/lib/escena-sala"
import { FigurasSpline } from "@/components/nuevo/escena/FigurasSpline"
import { ESTILO_PANTALLAS, PantallaDeLaMesa } from "@/components/nuevo/escena/PantallaDeLaMesa"
import { FichaDelEmpleado } from "@/components/nuevo/escena/FichaDelEmpleado"
import { ESTILO_SALA, GloboEnLaFoto, globoVisible, PanelDeLaSala, SalaEnLaFoto, subidaDelRotulo } from "@/components/nuevo/escena/SalaDeReuniones"
import { AporteCompleto } from "@/components/nuevo/escena/AporteCompleto"
import { SALA } from "@/lib/escena-sala"
import {
  colocarFiguras, ESCENA_AVATARES, estadoDeLaMesa, FOTO, MESAS, tableroDeLaMesa,
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
.nv-av .nv-av-zona polygon{fill:rgba(0,0,0,0);stroke:none} /* 02-nov · al pasar el cursor NO se pinta nada sobre el escritorio: solo aparece el rótulo del equipo */
.nv-av .nv-av-rotulo{opacity:0;transform:translateY(5px);transition:opacity .4s ease,transform .4s ease;pointer-events:none}
.nv-av .nv-av-zona:hover .nv-av-rotulo,.nv-av .nv-av-zona:focus-visible .nv-av-rotulo,.nv-av .nv-av-zona[aria-expanded="true"] .nv-av-rotulo{opacity:1;transform:none}
.nv-av .nv-av-luz{opacity:0;transition:opacity .6s ease}
.nv-av .nv-av-luz[data-on="ambar"]{opacity:.9;animation:nvAvLate 2.6s ease-in-out infinite}
.nv-av .nv-av-luz[data-on="rojo"]{opacity:.85;animation:nvAvLateRojo 1.4s ease-in-out infinite}
.nv-av .nv-av-luz[data-on="tenue"]{opacity:.2;animation:nvAvTenue 5s ease-in-out infinite}
@keyframes nvAvTenue{0%,100%{opacity:.14}50%{opacity:.26}}
.nv-av .nv-av-asiento{pointer-events:auto;cursor:default;outline:none}
.nv-av .nv-av-asiento rect{fill:transparent}
.nv-av .nv-av-sombra{fill:rgba(0,0,0,.45)}
.nv-av .nv-av-silla{fill:#0c0a08;stroke:rgba(255,170,60,.22);stroke-width:1.5}
.nv-av .nv-av-cuerpo,.nv-av .nv-av-cabeza{fill:#1b1712;stroke:rgba(255,170,60,.34);stroke-width:1.7;transition:stroke .3s ease,filter .3s ease}
.nv-av .nv-av-franja{opacity:.5;transition:opacity .3s ease}
.nv-av .nv-av-fig[data-estado="reciente"] .nv-av-cuerpo,.nv-av .nv-av-fig[data-estado="reciente"] .nv-av-cabeza{stroke:rgba(255,170,60,.55)}
.nv-av .nv-av-fig[data-estado="reciente"] .nv-av-franja{opacity:.75}
.nv-av .nv-av-fig[data-estado="trabajando"] .nv-av-cuerpo,.nv-av .nv-av-fig[data-estado="trabajando"] .nv-av-cabeza{stroke:#ffb347;filter:drop-shadow(0 0 5px rgba(255,160,50,.85))}
.nv-av .nv-av-fig[data-estado="trabajando"] .nv-av-franja{opacity:1}
.nv-av .nv-av-fig[data-estado="trabajando"] .nv-av-persona{animation:nvAvInclina 3.2s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
.nv-av .nv-av-fig[data-estado="trabajando"] .nv-av-silla{stroke:rgba(255,170,60,.5)}
.nv-av .nv-av-fig[data-estado="fallo"] .nv-av-cuerpo,.nv-av .nv-av-fig[data-estado="fallo"] .nv-av-cabeza{stroke:#ff5a4a;filter:drop-shadow(0 0 5px rgba(255,80,60,.8))}
.nv-av .nv-av-fig[data-estado="fallo"] .nv-av-franja{opacity:.9}
.nv-av .nv-av-asiento:hover .nv-av-cuerpo,.nv-av .nv-av-asiento:hover .nv-av-cabeza,.nv-av .nv-av-asiento:focus-visible .nv-av-cuerpo,.nv-av .nv-av-asiento:focus-visible .nv-av-cabeza{stroke:rgba(255,215,150,.95)}
@keyframes nvAvInclina{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px) rotate(-1.2deg)}}
.nv-av .nv-av-ficha,.nv-av .nv-av-lista{pointer-events:auto;animation:nvAvEntra .25s ease both}
@keyframes nvAvLate{0%,100%{opacity:.9}50%{opacity:.55}}
@keyframes nvAvLateRojo{0%,100%{opacity:.85}50%{opacity:.4}}
@keyframes nvAvEntra{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.nv-av .nv-av-fig{animation:none!important}.nv-av .nv-av-luz[data-on]{animation:none}.nv-av .nv-av-ficha,.nv-av .nv-av-lista{animation:none}.nv-av .nv-av-rotulo,.nv-av .nv-av-luz{transition:none}}
`

/** la mesa vacía que se dibuja antes de que llegue el dato (y si la lectura falla): sin sentados, sin equipo, sin inventar */
const vacia = (m: Mesa): MesaViva => ({ ...m, sentados: [], equipo: [], trabajando: 0, fallando: 0 })

export function Avatares({ datosIniciales = null }: { /** solo pruebas y el arnés: arrancar con estos datos */ datosIniciales?: EscenaDatos | null }) {
  const [datos, setDatos] = useState<EscenaDatos | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [mesaAbierta, setMesaAbierta] = useState<ClaveDeMesa | null>(null)
  const [fichaDe, setFichaDe] = useState<string | null>(null) // Sprint B · el empleado cuya ficha (currículum) está abierta
  const [salaAbierta, setSalaAbierta] = useState(false) // S3 · el panel de la reunión
  const [enSala, setEnSala] = useState<string | null>(null) // S3 · el participante bajo el cursor
  const [aporteDe, setAporteDe] = useState<string | null>(null) // S4 · el participante cuyo aporte completo está abierto
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

  // Esc o clic fuera cierran el panel de la sala
  useEffect(() => {
    if (!salaAbierta) return
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setSalaAbierta(false) } }
    const alClic = (e: MouseEvent) => { if (!(e.target as Element | null)?.closest?.(".nv-sala-panel,.nv-sala-rotulo")) setSalaAbierta(false) }
    window.addEventListener("keydown", alTeclear, true)
    window.addEventListener("click", alClic, true)
    return () => { window.removeEventListener("keydown", alTeclear, true); window.removeEventListener("click", alClic, true) }
  }, [salaAbierta])

  const mesas: MesaViva[] = useMemo(() => (datos ? datos.mesas : MESAS.map(vacia)), [datos])
  const colocaciones = useMemo(() => colocarFiguras(mesas), [mesas])
  const hayFiguras = ESCENA_AVATARES !== ""
  const abierta = mesaAbierta ? mesas.find((m) => m.clave === mesaAbierta) ?? null : null
  const [sentadosEnSala, setSentadosEnSala] = useState<Set<string>>(new Set())
  const globoActual = globoVisible(datos?.sala?.reunion, enSala)
  const quienEstaEnLaSala = useMemo(() => agentesEnLaSala(datos?.sala), [datos])
  return (
    <div className="nv-av absolute inset-0" data-escena-viva data-leido={datos?.leido_en ?? ""} data-error={error ?? ""}>
      <style>{ESTILO + ESTILO_PANTALLAS + ESTILO_SALA + ESTILO_SILUETAS}</style>
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
          const on = m.trabajando > 0 ? "ambar" : m.fallando > 0 ? "rojo" : "tenue" // sin nadie: brillo tenue (la oficina no se ve muerta; la pantalla sigue negra)
          const subtitulo = estadoDeLaMesa(m)
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
            </g>
          )
        })}
        {/* S3 · la sala de reuniones: la reunión real con sus participantes sentados; sin reunión, vacía */}
        <SalaEnLaFoto sala={datos?.sala} abierta={salaAbierta} onAbrir={() => setSalaAbierta((v) => !v)} sentados={sentadosEnSala} subir={subidaDelRotulo(globoActual, lineasDeLaSala(datos?.sala).length)} />
        {/* 02-nov · los agentes holográficos (un solo dueño de toda la animación): en su escritorio, caminando a la sala, sentados en ella, hablando y de vuelta. Van sobre la zona de la sala para recibir el ratón */}
        <Siluetas mesas={mesas} reunion={datos?.sala?.reunion ?? null} enLaSala={quienEstaEnLaSala} onFoco={setEnSala} onTocar={(a) => setAporteDe(a)} onSentados={setSentadosEnSala} />
        <GloboEnLaFoto g={globoActual} />
      </svg>
      {salaAbierta && (
        <div role="dialog" aria-label="La reunión de la sala" className="nv-av-lista nv-sala-panel absolute z-[4] w-[24rem] max-h-[60%] overflow-auto rounded-xl border border-white/15 bg-[#121110]/95 p-3 text-[12px] text-zinc-200 shadow-[0_8px_30px_rgba(0,0,0,.6)]"
          style={{ left: pct(SALA.mesa.x + 190, FOTO.w), top: pct(SALA.rotulo.y - 40, FOTO.h) }} onClick={(e) => e.stopPropagation()}>
          <PanelDeLaSala sala={datos?.sala} onCerrar={() => setSalaAbierta(false)} onTocar={(a) => setAporteDe(a)} />
        </div>
      )}
      {/* el equipo de la mesa, al tocarla: todos, con su estado real; los que trabajan ahora primero */}
      {abierta && (
        <div role="dialog" aria-label={`Equipo ${abierta.nombre}`} className="nv-av-lista absolute z-[4] w-[22rem] max-h-[60%] overflow-auto rounded-xl border border-white/15 bg-[#121110]/95 p-3 text-[12px] text-zinc-200 shadow-[0_8px_30px_rgba(0,0,0,.6)]"
          style={{ left: pct(Math.min(abierta.centro.x + 130, FOTO.w - 700), FOTO.w), top: pct(Math.max(abierta.centro.y - 160, 40), FOTO.h) }} onClick={(e) => e.stopPropagation()}>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div><span className="text-[13px] font-semibold" style={{ color: abierta.color }}>{abierta.nombre}</span><span className="ml-2 text-[11px] text-zinc-500" data-estado-de-la-mesa>{estadoDeLaMesa(abierta)}</span></div>
            <button type="button" onClick={() => setMesaAbierta(null)} aria-label="Cerrar" className="rounded px-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200">×</button>
          </div>
          {abierta.equipo.length === 0 ? (
            <p className="text-zinc-500">{datos ? "Todavía no hay nadie asignado a este equipo." : "leyendo…"}</p>
          ) : (
            <ul className="space-y-1">
              {abierta.equipo.map((p) => (
                <li key={p.agente} className="flex items-baseline justify-between gap-2" data-miembro={p.agente} data-estado={p.estado}>
                  <span className="min-w-0 truncate"><button type="button" data-abrir-ficha={p.agente} onClick={(e) => { e.stopPropagation(); setFichaDe(p.agente) }} title={`Ver la ficha de ${p.nombre}`} className="truncate text-left underline decoration-white/20 decoration-dotted underline-offset-4 hover:text-amber-100 hover:decoration-amber-300 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">{p.nombre}</button></span>
                  <span className={`shrink-0 text-[11px] ${p.estado === "trabajando" ? "text-amber-200" : p.estado === "fallo" ? "text-red-300" : p.estado === "reciente" ? "text-zinc-300" : "text-zinc-500"}`}>
                    {p.estado === "trabajando" ? "trabajando ahora" : p.estado === "fallo" ? `falló ${p.hace}` : p.estado === "reciente" ? `trabajó ${p.hace}` : p.ultima ? `última ${p.hace}` : "sin trabajo en 24 h"}
                    {p.nota && <span className="block text-[10px] text-zinc-500">{p.nota}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {(abierta.por_instalar?.length ?? 0) > 0 && <p data-por-instalar className="mt-2 text-[11px] text-zinc-500">Firmados, todavía sin instalar: {abierta.por_instalar!.join(" · ")}</p>}
          <p className="mt-2 text-[10px] text-zinc-600">{datos ? datos.fuente : "sin dato todavía"}</p>
        </div>
      )}
      {/* en qué se trabaja: el cliente y el momento de su campaña, discreto, abajo a la izquierda */}
      {datos?.contexto && <p data-contexto className="pointer-events-none absolute bottom-[3.2%] left-[2.6%] max-w-[44%] text-[12px] tracking-wide text-zinc-400/85">{datos.contexto.cliente}<span className="mx-1.5 text-zinc-600">·</span>{datos.contexto.momento}</p>}
      {error && <span className="sr-only" data-error-lectura>{error}</span>}
      {(() => { const p = aporteDe ? datos?.sala?.reunion?.participantes.find((x) => x.agente === aporteDe) : null; return p ? <AporteCompleto p={p} onCerrar={() => setAporteDe(null)} onFicha={() => { setAporteDe(null); setFichaDe(p.agente) }} /> : null })()}
      {fichaDe && <FichaDelEmpleado agente={fichaDe} onCerrar={() => setFichaDe(null)} />}
    </div>
  )
}
