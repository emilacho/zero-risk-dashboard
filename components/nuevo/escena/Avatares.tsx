"use client"

import { EVENTO_ABRIR_PLANTEL, type PedidoDePlantel } from "@/lib/buscador"
import { leerClienteDeTrabajo } from "@/lib/cliente-de-trabajo"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ESTILO_SILUETAS, Siluetas } from "@/components/nuevo/escena/Siluetas"
import { PanelDeLaVitrina, PanelDelPizarron } from "@/components/nuevo/escena/PanelesDelPizarron"
import { AntenaDeAlertas, PanelDeLasAlertas } from "@/components/nuevo/escena/AntenaDeAlertas"
import { FranjaDeLasRedes, MOSTRAR_LA_FRANJA_DE_REDES, botonesDeLaFranja } from "@/components/nuevo/escena/FranjaDeLasRedes"
import { EVENTO_ABRIR_PANEL, type PedidoDePanel } from "@/lib/buscador"
import { CuadrosDeMetricas, ESTILO_ENTREGAS, TarjetaDeLaEntrega, VitrinaVertical } from "@/components/nuevo/escena/EntregasEnLaFoto"
import type { EntregaViva } from "@/lib/escena-entregas"
import { agentesEnLaSala, lineasDeLaSala } from "@/lib/escena-sala"
import { FigurasSpline } from "@/components/nuevo/escena/FigurasSpline"
import { ESTILO_PANTALLAS, PantallaDeLaMesa } from "@/components/nuevo/escena/PantallaDeLaMesa"
import { FichaDelEmpleado } from "@/components/nuevo/escena/FichaDelEmpleado"
import { FlechasDeForma } from "@/components/nuevo/escena/FlechasDeForma"
import { PlantelDelEquipo } from "@/components/nuevo/escena/PlantelDelEquipo"
import { nombreCanonico } from "@/lib/organigrama"
import { ESTILO_SALA, GloboEnLaFoto, globoVisible, PanelDeLaSala, SalaEnLaFoto, subidaDelRotulo } from "@/components/nuevo/escena/SalaDeReuniones"
import { AporteCompleto } from "@/components/nuevo/escena/AporteCompleto"
import { datosDelAgente, ElAgenteAhora } from "@/components/nuevo/escena/ElAgenteAhora"
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
/** las mesas que la escena tiene ANTES de leer nada (las 6, vacías): por eso siempre hay una mesa que abrir (CC3 · reserva 3 de #225) */
export const mesasSinLeer = (): MesaViva[] => MESAS.map(vacia)
/** CC6 · 03-nov · qué mesa abre el Squad Hub cuando lo pide el Centro de campaña: la pedida, si no la primera con gente, si no la primera.
 *  Con las mesas sin leer abre la primera (vacía) y se llena sola cuando llegan los datos. */
export function mesaParaAbrir(mesas: MesaViva[], pedida: string | null = null): MesaViva | null {
  return (pedida && mesas.find((m) => m.clave === pedida)) || mesas.find((m) => m.equipo.length > 0) || mesas[0] || null
}

export function Avatares({ datosIniciales = null }: { /** solo pruebas y el arnés: arrancar con estos datos */ datosIniciales?: EscenaDatos | null }) {
  const [datos, setDatos] = useState<EscenaDatos | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [mesaAbierta, setMesaAbierta] = useState<ClaveDeMesa | null>(null)
  const [agenteDelPlantel, setAgenteDelPlantel] = useState<string | null>(null) // el empleado que el plantel muestra en su detalle al abrirse (si vino de tocar su flecha)
  const [fichaDe, setFichaDe] = useState<string | null>(null) // Sprint B · el empleado cuya ficha (currículum) está abierta
  const [panelTablero, setPanelTablero] = useState<{ tipo: "pizarron"; clave: string | null } | { tipo: "vitrina" } | { tipo: "antena" } | null>(null) // 03-nov · pizarrón y vitrina tocables
  const [salaAbierta, setSalaAbierta] = useState(false) // S3 · el panel de la reunión
  const [enSala, setEnSala] = useState<string | null>(null) // S3 · el participante bajo el cursor
  const [aporteDe, setAporteDe] = useState<string | null>(null) // S4 · el participante cuyo aporte completo está abierto
  const [tocado, setTocado] = useState<string | null>(null) // sprint 4 · el empleado cuyo cuerpo se tocó: su tarjeta de «ahora»
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  const leer = useCallback(async () => {
    try {
      // CC6 · 02-nov (corrección de Lenovo): la escena sigue al cliente con el que Emilio trabaja (el mismo que abren los paneles)
      const id = leerClienteDeTrabajo()?.id
      const r = await fetch(`/api/escena-viva${id ? `?cliente=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" })
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
  // Esc o clic fuera cierran el panel de la sala
  useEffect(() => {
    if (!salaAbierta) return
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setSalaAbierta(false) } }
    const alClic = (e: MouseEvent) => { if (!(e.target as Element | null)?.closest?.(".nv-sala-panel,.nv-sala-rotulo")) setSalaAbierta(false) }
    window.addEventListener("keydown", alTeclear, true)
    window.addEventListener("click", alClic, true)
    return () => { window.removeEventListener("keydown", alTeclear, true); window.removeEventListener("click", alClic, true) }
  }, [salaAbierta])

  const mesas: MesaViva[] = useMemo(() => (datos ? datos.mesas : mesasSinLeer()), [datos])
  const colocaciones = useMemo(() => colocarFiguras(mesas), [mesas])
  const hayFiguras = ESCENA_AVATARES !== ""
  const abierta = mesaAbierta ? mesas.find((m) => m.clave === mesaAbierta) ?? null : null
  const cerrarPlantel = useCallback(() => { setMesaAbierta(null); setAgenteDelPlantel(null) }, [])
  // CC6 · 03-nov · una sola vista del equipo: el Centro de campaña › Equipo abre ESTE plantel (Squad Hub), en la mesa pedida o la primera con gente
  const mesasActuales = useRef(mesas); mesasActuales.current = mesas
  useEffect(() => {
    const alPedir = (e: Event) => {
      const { mesa = null } = ((e as CustomEvent<PedidoDePlantel>).detail ?? {}) as PedidoDePlantel
      const elegida = mesaParaAbrir(mesasActuales.current, mesa)
      if (elegida) { setAgenteDelPlantel(null); setMesaAbierta(elegida.clave) }
    }
    window.addEventListener(EVENTO_ABRIR_PLANTEL, alPedir)
    return () => window.removeEventListener(EVENTO_ABRIR_PLANTEL, alPedir)
  }, [])
  // tocar la flecha de un empleado: su detalle dentro del plantel de su equipo (false = no está en ningún plantel: se abre la ficha de rendimiento de siempre)
  const abrirPlantelDe = useCallback((agente: string) => {
    const m = mesas.find((q) => q.equipo.some((p) => nombreCanonico(p.agente) === nombreCanonico(agente)))
    if (!m) return false
    setAgenteDelPlantel(agente); setMesaAbierta(m.clave)
    return true
  }, [mesas])
  const [sentadosEnSala, setSentadosEnSala] = useState<Set<string>>(new Set())
  const [tarjeta, setTarjeta] = useState<EntregaViva | null>(null) // sprint 3 · la entrega que se está dejando ahora en el pizarrón
  const entregasVigentes = datos?.entregas?.entregas ?? []
  const globoActual = globoVisible(datos?.sala?.reunion, enSala)
  const quienEstaEnLaSala = useMemo(() => agentesEnLaSala(datos?.sala), [datos])
  return (
    <div className="nv-av absolute inset-0" data-escena-viva data-leido={datos?.leido_en ?? ""} data-error={error ?? ""}>
      <style>{ESTILO + ESTILO_PANTALLAS + ESTILO_SALA + ESTILO_SILUETAS + ESTILO_ENTREGAS}</style>
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
          // 04-nov (Emilio 13:38Z): la mesa ya no se pinta por ningún estado (ni ámbar, ni tenue, ni rojo): la falla va en la ✕ roja del agente
          const subtitulo = estadoDeLaMesa(m)
          return (
            <g key={m.clave} className="nv-av-mesa" data-mesa={m.clave} data-etapa={m.etapa} data-ocupada={m.sentados.length > 0} data-trabajando={m.trabajando} opacity={m.etapa === "segunda_etapa" && !m.sentados.length ? 0.75 : 1}>
              {/* la luz del monitor de la foto: ámbar cuando alguien trabaja, roja si lo último fue un fallo; el derrame al piso va sobre la silla */}
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
        {/* el pizarrón de métricas: «General» y un cuadro por red del cliente; hoy «métricas pronto» (los gastos se ven en Tu oficina › Dinero). Las entregas ya no quedan fijas aquí: su tarjeta aparece 8 s */}
        <CuadrosDeMetricas metricas={datos?.metricas} onAbrir={(k) => setPanelTablero({ tipo: "pizarron", clave: k || null })}
          avisos={datos?.avisos ?? []} onAviso={(a) => window.dispatchEvent(new CustomEvent<PedidoDePanel>(EVENTO_ABRIR_PANEL, { detail: a.abre === "piezas" ? { panel: "piezas" } : { panel: "aplicaciones", vista: a.abre } }))} />
        <Siluetas mesas={mesas} reunion={datos?.sala?.reunion ?? null} cargado={datos != null} enLaSala={quienEstaEnLaSala} onFoco={setEnSala} onTocar={(a) => setTocado(a)} onSentados={setSentadosEnSala} entregas={datos?.entregas ? entregasVigentes : undefined} onTarjeta={setTarjeta} />
        <TarjetaDeLaEntrega e={tarjeta} />
        {/* CC6 · 02-nov · la flecha de forma sobre cada empleado (capa propia: lee dónde está cada silueta, no toca la animación) */}
        <FlechasDeForma onAbrir={abrirPlantelDe} conFallo={datos?.con_fallo ?? []} />
        {/* la pantalla vertical: la vitrina de las mejores piezas, rotando (hoy «métricas pronto» + la última pieza aprobada) */}
        <VitrinaVertical vitrina={datos?.vitrina} onAbrir={() => setPanelTablero({ tipo: "vitrina" })} />
        {/* 04-nov (Emilio 14:08Z): sin lámpara en Dirección; el aviso de firma vive solo en el pizarrón (`firma.pendientes` sigue en el dato) */}
        {/* 04-nov (Emilio 15:19Z): la antena en su opción 3, con luz sutil; la lista abre un panel como los demás */}
        <AntenaDeAlertas alertas={datos?.alertas} onAbrir={() => setPanelTablero({ tipo: "antena" })} />
        <GloboEnLaFoto g={globoActual} />
      </svg>
      {/* 03-nov · las redes del pizarrón como botones de ≥44 px, en la zona vacía de arriba del pizarrón: la franja ocupa el 76 % izquierdo del ancho y se centra ahí, o sea sobre el pizarrón (los cuadros de la foto son de 8×12 px a este ancho) */}
      {MOSTRAR_LA_FRANJA_DE_REDES && <FranjaDeLasRedes botones={botonesDeLaFranja(datos?.metricas)} className="absolute left-0 z-[3]" style={{ width: "76%", top: pct(70, FOTO.h) }}
        onAbrir={(k) => setPanelTablero(k === "vitrina" ? { tipo: "vitrina" } : { tipo: "pizarron", clave: k })} />}
      {/* 06-nov · la lista de la antena se abre encima en estilo base (su propio panel); sigues en Dept. Marketing */}
      {panelTablero?.tipo === "antena" && <PanelDeLasAlertas alertas={datos?.alertas} onCerrar={() => setPanelTablero(null)} onAbrir={(a) => { setPanelTablero(null); if (a.abre) window.dispatchEvent(new CustomEvent<PedidoDePanel>(EVENTO_ABRIR_PANEL, { detail: { panel: a.abre } })) }} />}
      {panelTablero && panelTablero.tipo !== "antena" && (
        <div role="dialog" aria-label={panelTablero.tipo === "vitrina" ? "La vitrina" : "El pizarrón de métricas"} className="nv-av-lista absolute left-1/2 top-1/2 z-[5] max-h-[80%] w-[min(26rem,92%)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl border border-white/15 bg-[#121110]/95 p-4 text-zinc-200 shadow-[0_8px_30px_rgba(0,0,0,.6)]" onClick={(e) => e.stopPropagation()}>
          {panelTablero.tipo === "vitrina" ? <PanelDeLaVitrina vitrina={datos?.vitrina} onCerrar={() => setPanelTablero(null)} /> : <PanelDelPizarron metricas={datos?.metricas} inicial={panelTablero.clave} onCerrar={() => setPanelTablero(null)} />}
        </div>
      )}
      {salaAbierta && (
        <div role="dialog" aria-label="La reunión de la sala" className="nv-av-lista nv-sala-panel absolute z-[4] w-[24rem] max-h-[60%] overflow-auto rounded-xl border border-white/15 bg-[#121110]/95 p-3 text-[12px] text-zinc-200 shadow-[0_8px_30px_rgba(0,0,0,.6)]"
          style={{ left: pct(SALA.mesa.x + 190, FOTO.w), top: pct(SALA.rotulo.y - 40, FOTO.h) }} onClick={(e) => e.stopPropagation()}>
          <PanelDeLaSala sala={datos?.sala} onCerrar={() => setSalaAbierta(false)} onTocar={(a) => setAporteDe(a)} />
        </div>
      )}
      {/* 02-nov · «Ver el equipo» abre el PLANTEL del equipo (como el Squad Hub de EA FC); tocar la flecha de un empleado abre su detalle dentro de su plantel */}
      {abierta && <PlantelDelEquipo mesa={abierta} mesas={mesas} agenteInicial={agenteDelPlantel} onCerrar={cerrarPlantel} onFicha={(a) => { cerrarPlantel(); setFichaDe(a) }} onTrabajo={(a) => { cerrarPlantel(); setTocado(a) }} />}
      {/* en qué se trabaja: el cliente y el momento de su campaña, discreto, abajo a la izquierda */}
      {datos?.contexto && <p data-contexto className="pointer-events-none absolute bottom-[3.2%] left-[2.6%] max-w-[44%] text-[12px] tracking-wide text-zinc-400/85">{datos.contexto.cliente}<span className="mx-1.5 text-zinc-600">·</span>{datos.contexto.momento}</p>}
      {error && <span className="sr-only" data-error-lectura>{error}</span>}
      {(() => { const p = aporteDe ? datos?.sala?.reunion?.participantes.find((x) => x.agente === aporteDe) : null; return p ? <AporteCompleto p={p} onCerrar={() => setAporteDe(null)} onFicha={() => { setAporteDe(null); setFichaDe(p.agente) }} /> : null })()}
      {tocado && <ElAgenteAhora datos={datosDelAgente(tocado, datos)} onCerrar={() => setTocado(null)} onFicha={() => { setTocado(null); setFichaDe(tocado) }} onAporte={datos?.sala?.reunion?.participantes.some((x) => x.agente === tocado) ? () => { setTocado(null); setAporteDe(tocado) } : undefined} />}
      {fichaDe && <FichaDelEmpleado agente={fichaDe} onCerrar={() => setFichaDe(null)} />}
    </div>
  )
}
