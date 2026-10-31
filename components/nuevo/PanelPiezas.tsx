"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Bandeja } from "@/lib/bandeja-datos"
import type { DetalleDeLaPieza } from "@/lib/piezas-datos"
import { ESTADO_DE_PIEZA_LEGIBLE, MINIMOS, ORIGEN_CORTO, alcanceDeLosCambios, avisoTrasDecidir, avisosDeLaFila, cuerpoDeDecisionDePieza, cuerpoDeRehacer, errorTrasDecidir, filtrarBandeja, proporcionDeLaLamina, resumenDeLaBandeja, siguientePendiente, textoDelBotonDeCambios, tonoDelEstado, type FiltroDeLaBandeja, type RespuestaDeDecidir, type Tono } from "@/lib/bandeja"
import type { AccionDeLaPieza, EstadoPieza } from "@/lib/piezas"
import { estadoTrasDecidir } from "@/lib/reflejo"
import { botonesDeRevision } from "@/lib/revisiones"
import { cuerpoDeResolucion } from "@/lib/plan"
import { llamarAccion } from "@/components/nuevo/PanelManual"
import { TOPE_POR_PIEZA_USD } from "@/lib/tablero-acciones"
import { diaYHora, resultadoDeJefaturaDePiezaLegible, rolDeLaMesaLegible, tipoDeAporteLegible, tipoDeRevisionLegible, usdES } from "@/lib/lenguaje"

const AMBAR = "#f5a524"
type RespuestaBandeja = ({ ok: true } & Bandeja) | { ok: false; error: string }
type RespuestaPieza = { ok: true; pieza: DetalleDeLaPieza } | { ok: false; error: string }
type Dialogo = null | "aprobar" | "cambios" | "rechazar" | "rehacer"

const ESTILO = `
.pi-entra{animation:piEntra .4s cubic-bezier(.2,.8,.2,1) both}
.pi-lamina{transition:transform .2s ease}
.pi-fila[aria-current="true"]{background:rgba(255,255,255,.07);box-shadow:inset 2px 0 0 ${AMBAR}}
@keyframes piEntra{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.pi-entra{animation:none}.pi-lamina{transition:none}}
`
const PUNTO: Record<Tono, string> = { ambar: "bg-amber-400", verde: "bg-emerald-400", azul: "bg-sky-400", rojo: "bg-rose-400", neutro: "bg-zinc-500" }
const CHIP: Record<Tono, string> = { ambar: "border-amber-400/50 text-amber-200", verde: "border-emerald-400/40 text-emerald-200", azul: "border-sky-400/40 text-sky-200", rojo: "border-rose-400/40 text-rose-200", neutro: "border-white/15 text-zinc-300" }
const COLOR_AVISO = { rojo: "border-rose-500/40 bg-rose-500/10 text-rose-200", ambar: "border-amber-500/40 bg-amber-500/10 text-amber-100", info: "border-white/10 bg-white/5 text-zinc-300" } as const

const Chip = ({ children, tono = "neutro" }: { children: React.ReactNode; tono?: Tono }) => <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] ${CHIP[tono]}`}>{children}</span>
const Titulito = ({ children }: { children: React.ReactNode }) => <h4 className="mb-1 text-[11px] uppercase tracking-[0.08em] text-zinc-500">{children}</h4>
function Bloque({ titulo, children, etiqueta }: { titulo: string; children: React.ReactNode; etiqueta?: string }) {
  return (
    <div data-bloque={etiqueta ?? titulo}>
      <Titulito>{titulo}</Titulito>
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[12.5px] leading-relaxed text-zinc-200">{children}</div>
    </div>
  )
}
const BOTON = "rounded-md border px-3 py-1.5 text-[12px] transition disabled:cursor-not-allowed disabled:opacity-40"
const B_AMBAR = `${BOTON} border-amber-400/70 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25`
const B_SUAVE = `${BOTON} border-white/15 text-zinc-200 hover:bg-white/[0.06]`
const B_ROJO = `${BOTON} border-rose-400/60 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20`
const B_GRIS = `${BOTON} border-white/10 text-zinc-400 hover:bg-white/[0.05]`
const CAJA = "w-full resize-y rounded-md border border-white/15 bg-black/40 px-2.5 py-2 text-[13px] leading-relaxed text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400"

export function PanelPiezas({ onCerrar, bandejaInicial = null, piezaInicialDatos = null, clienteInicial = null, piezaInicial = null, accion = llamarAccion, fetchImpl = fetch }: {
  onCerrar: () => void
  /** lecturas ya hechas (pruebas) */
  bandejaInicial?: Bandeja | null
  piezaInicialDatos?: DetalleDeLaPieza | null
  /** filtrar por este cliente al abrir (el Dept. Marketing lo pasa); null = todos */
  clienteInicial?: string | null
  /** abrir con esta pieza elegida (el calendario la manda) */
  piezaInicial?: string | null
  /** cómo se envían las acciones del tablero (pruebas) */
  accion?: typeof llamarAccion
  /** cómo se llama a `POST /api/piezas/{id}/decidir` (pruebas) */
  fetchImpl?: typeof fetch
}) {
  const [bandeja, setBandeja] = useState<Bandeja | null>(bandejaInicial)
  const [errorBandeja, setErrorBandeja] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!bandejaInicial)
  const [filtro, setFiltro] = useState<FiltroDeLaBandeja>(bandejaInicial?.estado ?? (piezaInicial ? "todas" : "pendiente"))
  const [cliente, setCliente] = useState<string | null>(clienteInicial)
  const [elegida, setElegida] = useState<string | null>(piezaInicial ?? piezaInicialDatos?.id ?? null)
  const [pieza, setPieza] = useState<DetalleDeLaPieza | null>(piezaInicialDatos)
  const [errorPieza, setErrorPieza] = useState<string | null>(null)
  const [cargandoPieza, setCargandoPieza] = useState(false)
  const [n, setN] = useState(1)
  const [juntas, setJuntas] = useState(false)
  const [marcadas, setMarcadas] = useState<number[]>([])
  const [zoom, setZoom] = useState(false)
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [comentario, setComentario] = useState("")
  const [casilla, setCasilla] = useState(false)
  const [confirmoGasto, setConfirmoGasto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [errorDialogo, setErrorDialogo] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  // lo que la pantalla dice apenas el servidor contesta «ok», sin esperar la lectura nueva
  const [resultadoLocal, setResultadoLocal] = useState<{ id: string; estado: EstadoPieza } | null>(null)
  const cerrar = useRef<HTMLButtonElement>(null)

  const leerLaBandeja = useCallback(async (estado: FiltroDeLaBandeja) => {
    setCargando(true); setErrorBandeja(null)
    try {
      const r = await fetchImpl(`/api/bandeja?estado=${estado}`, { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as RespuestaBandeja | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver las piezas." : (j && !j.ok && j.error) || `No pude leer la bandeja (${r.status}).`)
      setBandeja(j)
    } catch (e) { setErrorBandeja(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [fetchImpl])

  const leerLaPieza = useCallback(async (id: string) => {
    setCargandoPieza(true); setErrorPieza(null)
    try {
      const r = await fetchImpl(`/api/piezas/${encodeURIComponent(id)}`, { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as RespuestaPieza | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 404 ? "Esa pieza ya no está en la bandeja." : r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver la pieza." : (j && !j.ok && j.error) || `No pude leer la pieza (${r.status}).`)
      setPieza(j.pieza)
    } catch (e) { setPieza(null); setErrorPieza(e instanceof Error ? e.message : String(e)) } finally { setCargandoPieza(false) }
  }, [fetchImpl])

  useEffect(() => { cerrar.current?.focus() }, [])
  useEffect(() => { if (!bandejaInicial) void leerLaBandeja(filtro) }, [leerLaBandeja, bandejaInicial, filtro])
  useEffect(() => { if (elegida && elegida !== pieza?.id) void leerLaPieza(elegida) }, [elegida, pieza?.id, leerLaPieza])
  // al cambiar de pieza, el visor vuelve a la primera lámina y se olvidan las marcas y el diálogo
  useEffect(() => { setN(1); setJuntas(false); setMarcadas([]); setZoom(false); setDialogo(null); setComentario(""); setCasilla(false); setConfirmoGasto(false); setErrorDialogo(null) }, [pieza?.id])

  const piezasVisibles = useMemo(() => (bandeja ? filtrarBandeja(bandeja.piezas, cliente) : []), [bandeja, cliente])
  const otrasVisibles = useMemo(() => (bandeja ? filtrarBandeja(bandeja.otras, cliente) : []), [bandeja, cliente])
  const otrasPendientes = otrasVisibles.filter((o) => o.estado === "pendiente").length
  // sin elección, la primera pieza visible (o la primera otra revisión)
  useEffect(() => { if (bandeja && !elegida) { const p = piezasVisibles[0] ?? otrasVisibles[0]; if (p) setElegida(p.id) } }, [bandeja, elegida, piezasVisibles, otrasVisibles])

  const total = pieza?.laminas.length ?? 0
  const ir = useCallback((d: number) => { if (total > 0) { setN((x) => ((x - 1 + d + total) % total) + 1); setZoom(false) } }, [total])
  // Esc cierra lo más cercano (zoom → diálogo → el panel), en captura para que la oficina no lo reciba; ← → cambian de lámina
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const enCampo = ["TEXTAREA", "INPUT", "SELECT"].includes((e.target as HTMLElement)?.tagName ?? "")
      if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); if (zoom) setZoom(false); else if (dialogo) setDialogo(null); else onCerrar(); return }
      if (enCampo || dialogo) return
      if (e.key === "ArrowRight") ir(1)
      if (e.key === "ArrowLeft") ir(-1)
    }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar, zoom, dialogo, ir])

  const estadoVisto: EstadoPieza | null = pieza ? (resultadoLocal?.id === pieza.id ? resultadoLocal.estado : pieza.estado) : null
  const pendiente = !!pieza && pieza.es_pieza && pieza.status === "pending" && estadoVisto === "pendiente"
  const lamina = pieza?.laminas[n - 1]
  const src = (k: number) => `/api/piezas/${pieza?.id}/lamina/${k}`
  const marcar = (k: number) => setMarcadas((m) => (m.includes(k) ? m.filter((x) => x !== k) : [...m, k].sort((a, b) => a - b)))
  const abrir = (d: Dialogo) => { setDialogo(d); setErrorDialogo(null); setAviso(null) }
  const cancelar = () => { setDialogo(null); setErrorDialogo(null) }

  /** Aprobar · Pedir cambios · Rechazar una PIEZA: la misma puerta que la ventana de siempre (`POST /api/piezas/{id}/decidir`) */
  async function decidir(a: AccionDeLaPieza) {
    if (!pieza) return
    const c = cuerpoDeDecisionDePieza({ accion: a, comentario, laminas: marcadas, casilla, total, exige_casilla: pieza.exige_casilla, estado_visto: pieza.status })
    if ("error" in c) { setErrorDialogo(c.error); return }
    setEnviando(true); setErrorDialogo(null)
    try {
      const r = await fetchImpl(`/api/piezas/${encodeURIComponent(pieza.id)}/decidir`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(c.cuerpo) })
      const j = (await r.json().catch(() => ({}))) as RespuestaDeDecidir
      if (r.ok && j.ok) {
        setAviso({ ok: true, texto: avisoTrasDecidir(a, j) }); setDialogo(null); setComentario(""); setCasilla(false); setMarcadas([])
        if (!j.simulado) {
          setResultadoLocal({ id: pieza.id, estado: estadoTrasDecidir(a) })
          const siguiente = siguientePendiente(piezasVisibles, pieza.id)
          await leerLaBandeja(filtro)
          if (siguiente && filtro === "pendiente") setElegida(siguiente); else void leerLaPieza(pieza.id)
        }
      } else {
        setErrorDialogo(errorTrasDecidir(r.status, j))
        if (r.status === 409) { await leerLaBandeja(filtro); void leerLaPieza(pieza.id) }
      }
    } catch (e) { setErrorDialogo(`No se pudo contactar al servidor: ${e instanceof Error ? e.message : String(e)}`) } finally { setEnviando(false) }
  }

  /** las OTRAS revisiones (plan con pendientes · lista de competidores · revisión del editor): la acción del tablero `revision-resolver`, la de siempre */
  async function resolver(decision: "aprobar" | "rechazar") {
    if (!pieza) return
    const cuerpo = cuerpoDeResolucion(pieza.id, decision, comentario)
    if ("error" in cuerpo) { setErrorDialogo(cuerpo.error); return }
    setEnviando(true); setErrorDialogo(null)
    const r = await accion("revision-resolver", cuerpo)
    setEnviando(false)
    if (!r.ok) { setErrorDialogo(r.texto); return }
    const res = typeof r.detalle.resultado === "string" ? r.detalle.resultado : decision === "aprobar" ? "aprobada" : "con cambios pedidos"
    setAviso({ ok: true, texto: `Decisión registrada: ${tipoDeRevisionLegible(pieza.tipo).toLowerCase()} · ${res}.` }); setDialogo(null); setComentario("")
    await leerLaBandeja(filtro); void leerLaPieza(pieza.id)
  }

  /** Rehacer una pieza rechazada: GASTA (hasta el tope por pieza), así que pide marcar que se entiende el gasto */
  async function rehacer() {
    if (!pieza?.encargo_id) return
    if (!confirmoGasto) { setErrorDialogo(`Marca que entiendes el gasto: rehacerla puede costar hasta ${usdES(TOPE_POR_PIEZA_USD)}.`); return }
    setEnviando(true); setErrorDialogo(null)
    const r = await accion("rehacer-pieza", cuerpoDeRehacer(pieza.encargo_id, comentario))
    setEnviando(false)
    if (!r.ok) { setErrorDialogo(r.texto); return }
    setAviso({ ok: true, texto: "Encargo enviado: la oficina creativa rehace la pieza y la versión nueva llega a esta bandeja." }); setDialogo(null); setComentario(""); setConfirmoGasto(false)
    await leerLaBandeja(filtro)
  }

  const nombreDelCliente = cliente ? bandeja?.clientes.find((c) => c.id === cliente)?.nombre ?? null : null
  const escondidas = bandeja && cliente ? bandeja.piezas.length - piezasVisibles.length : 0
  const botones = pieza && !pieza.es_pieza ? botonesDeRevision(pieza.tipo) : null
  const otraAbierta = !!pieza && !pieza.es_pieza

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-5" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onCerrar() }}>
      <style>{ESTILO}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="piezas-titulo" data-seccion="piezas" className="relative flex h-full max-h-full w-full max-w-[1440px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <h2 id="piezas-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Piezas</h2>
          {bandeja && <Chip tono={bandeja.por_aprobar > 0 ? "ambar" : "neutro"}>{resumenDeLaBandeja({ por_aprobar: bandeja.por_aprobar, otras_pendientes: otrasPendientes })}</Chip>}
          <p className="hidden text-[12px] text-zinc-500 lg:block">Lo que la oficina creativa entregó · aquí se aprueba, se piden cambios o se rechaza</p>
          <label className="ml-auto flex items-center gap-2 text-[12px] text-zinc-400">
            <span>Cliente</span>
            <select value={cliente ?? ""} onChange={(ev) => { setCliente(ev.target.value || null); setElegida(null) }} disabled={!bandeja} aria-label="Elegir el cliente"
              className="rounded-md border border-white/10 bg-[#111] px-2 py-1 text-[13px] text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
              <option value="">Todos los clientes</option>
              {(bandeja?.clientes ?? []).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          </label>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </header>

        {errorBandeja && <p role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[13px] text-rose-200 sm:px-5">{errorBandeja}</p>}
        {aviso && <p role="status" data-aviso={aviso.ok ? "ok" : "error"} className={`border-b px-4 py-2 text-[13px] sm:px-5 ${aviso.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-rose-500/30 bg-rose-500/10 text-rose-200"}`}>{aviso.texto}</p>}

        <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)]">
          {/* la lista: la bandeja */}
          <aside aria-label="La bandeja" className="flex min-h-0 flex-col border-r border-white/10">
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2.5">
              <div role="group" aria-label="Qué piezas ver" className="flex rounded-md border border-white/10 p-0.5 text-[11px]">
                {(["pendiente", "todas"] as const).map((f) => (
                  <button key={f} type="button" data-filtro={f} aria-pressed={filtro === f} onClick={() => { setFiltro(f); setElegida(null); if (!bandejaInicial) void leerLaBandeja(f) }}
                    className={`rounded px-2.5 py-1 transition ${filtro === f ? "bg-amber-400/20 text-amber-100" : "text-zinc-400 hover:text-zinc-200"}`}>{f === "pendiente" ? "Por aprobar" : "Todas"}</button>
                ))}
              </div>
              {cargando && <span className="text-[11px] text-zinc-500">Leyendo…</span>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {bandeja && piezasVisibles.length === 0 && (
                <div className="px-4 py-5 text-[12.5px] text-zinc-500">
                  <p>{filtro === "pendiente" ? `No hay piezas por aprobar${nombreDelCliente ? ` de ${nombreDelCliente}` : ""}.` : `${nombreDelCliente ?? "La bandeja"} no tiene piezas.`}</p>
                  {escondidas > 0 && <button type="button" data-accion="ver-todos-los-clientes" onClick={() => { setCliente(null); setElegida(null) }} className={`${B_SUAVE} mt-2`}>Ver las de todos los clientes ({escondidas})</button>}
                </div>
              )}
              <ul aria-label="Las piezas">
                {piezasVisibles.map((p) => {
                  const tono = tonoDelEstado(p.estado); const avisoFila = avisosDeLaFila(p)
                  return (
                    <li key={p.id}>
                      <button type="button" data-pieza={p.id} data-estado={p.estado} aria-current={p.id === elegida ? "true" : undefined} onClick={() => setElegida(p.id)}
                        className="pi-fila flex w-full gap-3 border-t-[0.5px] border-white/5 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PUNTO[tono]}`} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium text-zinc-100">{p.titulo_legible}</span>
                          <span className="block text-[11px] text-zinc-500">{diaYHora(p.creada)}{filtro === "todas" ? ` · ${ESTADO_DE_PIEZA_LEGIBLE[p.estado]}` : ""}</span>
                          {avisoFila && <span className="block text-[11px] text-amber-300/90">{avisoFila}</span>}
                        </span>
                        <span className="num shrink-0 text-[11px] text-zinc-500">{usdES(p.gasto_usd)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {otrasVisibles.length > 0 && (
                <details data-grupo="otras" open={otraAbierta || undefined} className="border-t border-white/10">
                  <summary className="cursor-pointer px-4 py-3 text-[12px] text-zinc-400 hover:text-white">Otras revisiones, no son piezas ({otrasVisibles.length}{otrasPendientes ? ` · ${otrasPendientes} por decidir` : ""})</summary>
                  <ul aria-label="Las otras revisiones">
                    {otrasVisibles.map((p) => (
                      <li key={p.id}>
                        <button type="button" data-revision={p.id} data-estado={p.estado} aria-current={p.id === elegida ? "true" : undefined} onClick={() => setElegida(p.id)}
                          className="pi-fila flex w-full gap-3 border-t-[0.5px] border-white/5 px-4 py-2.5 text-left text-[12px] transition-colors hover:bg-white/[0.03]">
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PUNTO[tonoDelEstado(p.estado)]}`} aria-hidden />
                          <span className="min-w-0 flex-1"><span className="block text-zinc-200">{p.titulo_legible}</span><span className="block text-[11px] text-zinc-500">{diaYHora(p.creada)}{filtro === "todas" ? ` · ${ESTADO_DE_PIEZA_LEGIBLE[p.estado]}` : ""}</span></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </aside>

          {/* el visor */}
          <section aria-label="La pieza" className="flex min-h-0 flex-col">
            {!elegida && bandeja && <p className="p-6 text-[13px] text-zinc-500">{piezasVisibles.length || otrasVisibles.length ? "Elige una pieza de la lista." : "Nada que mirar por ahora."}</p>}
            {elegida && !pieza && <p className={`p-6 text-[13px] ${errorPieza && !cargandoPieza ? "text-rose-300" : "text-zinc-500"}`}>{cargandoPieza ? "Leyendo la pieza…" : errorPieza ?? "Leyendo la pieza…"}</p>}
            {pieza && estadoVisto && (
              <>
                <div className="pi-entra flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3 sm:px-5" key={pieza.id}>
                  <h3 className="font-display text-[18px] font-semibold leading-tight tracking-tight text-zinc-50" data-titulo-pieza>{pieza.titulo}</h3>
                  <Chip tono={pieza.es_pieza ? tonoDelEstado(estadoVisto) : pieza.status === "pending" ? "ambar" : "neutro"}>{pieza.es_pieza ? ESTADO_DE_PIEZA_LEGIBLE[estadoVisto] : pieza.status === "pending" ? "espera tu decisión" : "ya resuelta"}</Chip>
                  {pieza.gasto_usd != null && <Chip>costó {usdES(pieza.gasto_usd)}</Chip>}
                  {pieza.version != null && <Chip>versión {pieza.version}</Chip>}
                  {pieza.jefatura.resultado && <Chip tono={pieza.jefatura.desacuerdos.length ? "ambar" : "neutro"}>jefatura {resultadoDeJefaturaDePiezaLegible(pieza.jefatura.resultado)}</Chip>}
                  {total > 0 && <button type="button" data-accion="ver-juntas" aria-pressed={juntas} onClick={() => { setJuntas((v) => !v); setZoom(false) }} className={`${B_SUAVE} ml-auto`}>{juntas ? "Ver una lámina" : `Ver las ${total} juntas`}</button>}
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_22rem]">
                  <div className="flex min-h-0 flex-col items-center gap-2 overflow-auto bg-black/40 p-4">
                    {total === 0 && pieza.es_pieza && <div className="max-w-md rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-[13px] text-rose-200">Sin dibujo: esta pieza no tiene láminas que mirar.</div>}
                    {!pieza.es_pieza && <div className="max-w-md rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[13px] text-zinc-300">Esta revisión no lleva láminas: es una decisión sobre «{tipoDeRevisionLegible(pieza.tipo).toLowerCase()}». Lo que hay que saber está al costado y la decisión abajo.</div>}
                    {total > 0 && !juntas && lamina && (
                      <>
                        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                          <div className="relative h-full max-h-full max-w-full overflow-hidden rounded-xl border border-white/10 bg-black" style={{ aspectRatio: proporcionDeLaLamina(lamina) }} data-zoom={zoom}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src(n)} alt={`Lámina ${n} de ${total}`} onClick={() => setZoom((z) => !z)} className={`pi-lamina h-full w-full object-contain ${zoom ? "scale-[1.8] cursor-zoom-out" : "cursor-zoom-in"}`} />
                            <span className="num absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-0.5 text-[11px]">{n} / {total}</span>
                            {total > 1 && <button type="button" onClick={() => ir(-1)} aria-label="Lámina anterior" className="absolute left-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 text-lg hover:bg-black/80">‹</button>}
                            {total > 1 && <button type="button" onClick={() => ir(1)} aria-label="Lámina siguiente" className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 text-lg hover:bg-black/80">›</button>}
                          </div>
                        </div>
                        <ol className="flex gap-1.5" aria-label="Las láminas">
                          {pieza.laminas.map((l) => (
                            <li key={l.n}>
                              <button type="button" data-lamina={l.n} aria-current={l.n === n ? "true" : undefined} aria-label={`Ir a la lámina ${l.n}`} onClick={() => { setN(l.n); setZoom(false) }} className={`block overflow-hidden rounded border-2 ${l.n === n ? "border-amber-400 opacity-100" : "border-transparent opacity-50 hover:opacity-80"}`}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={src(l.n)} alt="" className="h-12 w-[38px] object-cover" />
                              </button>
                            </li>
                          ))}
                        </ol>
                      </>
                    )}
                    {total > 0 && juntas && (
                      <div className="w-full self-start">
                        <ul className="grid w-full grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3" aria-label="Todas las láminas">
                          {pieza.laminas.map((l) => (
                            <li key={l.n} data-marcada={marcadas.includes(l.n)} className={`relative overflow-hidden rounded-xl border bg-[#111] ${marcadas.includes(l.n) ? "border-amber-400" : "border-white/10"}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={src(l.n)} alt={`Lámina ${l.n}`} onClick={() => { setN(l.n); setJuntas(false) }} className="block w-full cursor-zoom-in object-cover" style={{ aspectRatio: proporcionDeLaLamina(l) }} />
                              <button type="button" data-accion="marcar-lamina" data-n={l.n} onClick={() => pendiente && marcar(l.n)} disabled={!pendiente} title={pendiente ? "Marcar para pedir cambios solo en esta lámina" : undefined} className={`num absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-[11px] ${marcadas.includes(l.n) ? "bg-amber-400 text-black" : "bg-black/70 text-zinc-100"}`}>{marcadas.includes(l.n) ? `${l.n} · cambiar` : `${l.n} / ${total}`}</button>
                              {l.glifos_riesgosos && <span className="block border-t border-white/10 px-2 py-1 text-[10px] text-amber-200">signos que se dibujan como cuadros vacíos</span>}
                            </li>
                          ))}
                        </ul>
                        {pendiente && <p className="mt-2 text-[11.5px] text-zinc-500">Marca una lámina para pedir cambios solo en ella; sin marcas, el pedido va por toda la pieza.</p>}
                      </div>
                    )}
                  </div>

                  <aside className="min-h-0 space-y-3 overflow-y-auto border-l border-white/10 p-4" aria-label="Lo que acompaña a la pieza">
                    {(pieza.es_pieza ? pieza.avisos : []).map((a, i) => <div key={i} role={a.nivel === "rojo" ? "alert" : undefined} data-aviso-pieza={a.nivel} className={`rounded-lg border p-2.5 text-[12.5px] ${COLOR_AVISO[a.nivel]}`}>{a.texto}</div>)}
                    {lamina && !juntas && (
                      <Bloque titulo={`Lámina ${lamina.n} · ${ORIGEN_CORTO[lamina.origen]}`} etiqueta="lamina">
                        {[lamina.eyebrow, lamina.titular, lamina.cuerpo, lamina.pie].some(Boolean)
                          ? <>{lamina.eyebrow && <p className="text-[11px] uppercase tracking-wider text-zinc-400">{lamina.eyebrow}</p>}{lamina.titular && <p className="font-semibold text-zinc-50">{lamina.titular}</p>}{lamina.cuerpo && <p>{lamina.cuerpo}</p>}{lamina.pie && <p className="text-zinc-400">{lamina.pie}</p>}</>
                          : <p className="italic text-zinc-500">Sin texto guardado para esta lámina.</p>}
                      </Bloque>
                    )}
                    {pieza.pie && <Bloque titulo="Pie de la publicación" etiqueta="pie"><p className="whitespace-pre-wrap">{pieza.pie}</p></Bloque>}
                    {!pieza.pie && pieza.es_pieza && <Bloque titulo="Pie de la publicación" etiqueta="pie"><p className="italic text-zinc-500">La entrega no trae pie.</p></Bloque>}
                    {!pieza.es_pieza && pieza.resumen_de_la_bandeja && <Bloque titulo="Lo que dice la bandeja" etiqueta="bandeja"><p className="whitespace-pre-wrap">{pieza.resumen_de_la_bandeja.slice(0, 1200)}</p></Bloque>}
                    {pieza.es_pieza && <Bloque titulo={`Jefatura · ${resultadoDeJefaturaDePiezaLegible(pieza.jefatura.resultado)}`} etiqueta="jefatura">
                      {pieza.jefatura.desacuerdos.length > 0 && <><Titulito>Desacuerdos ({pieza.jefatura.desacuerdos.length})</Titulito><ul className="list-disc space-y-1 pl-4">{pieza.jefatura.desacuerdos.map((d, i) => <li key={i}>{d}</li>)}</ul></>}
                      {pieza.jefatura.opinion_externa && <details className="mt-2"><summary className="cursor-pointer text-[12px] text-zinc-400">Opinión externa (otro modelo, no vota)</summary><p className="mt-1 whitespace-pre-wrap text-[12px] text-zinc-300">{pieza.jefatura.opinion_externa.slice(0, 1400)}</p></details>}
                      {pieza.jefatura.desacuerdos.length === 0 && !pieza.jefatura.opinion_externa && <p className="italic text-zinc-500">Sin desacuerdos ni opinión externa guardados.</p>}
                    </Bloque>}
                    {pieza.es_pieza && <Bloque titulo={`La mesa de la oficina (${pieza.aportes.length})`} etiqueta="mesa">
                      {pieza.aportes.length === 0 ? <p className="italic text-zinc-500">La mesa no dejó aportes guardados para esta pieza.</p> : (
                        <ul className="space-y-2">{pieza.aportes.map((a) => <li key={a.n}><p className="text-[11px] text-zinc-400">{rolDeLaMesaLegible(a.de)} {tipoDeAporteLegible(a.tipo)}{a.para ? ` a ${rolDeLaMesaLegible(a.para)}` : ""}</p><p className="whitespace-pre-wrap">{a.texto.slice(0, 600)}</p></li>)}</ul>
                      )}
                    </Bloque>}
                    <Bloque titulo="Ficha" etiqueta="ficha">
                      <dl className="space-y-0.5 text-[12px] text-zinc-400">
                        <div><dt className="inline text-zinc-500">Entró a la bandeja · </dt><dd className="inline">{diaYHora(pieza.creada)}</dd></div>
                        {pieza.cliente && <div><dt className="inline text-zinc-500">Cliente · </dt><dd className="inline">{pieza.cliente}</dd></div>}
                        {!pieza.es_pieza && <div><dt className="inline text-zinc-500">Qué es · </dt><dd className="inline">{tipoDeRevisionLegible(pieza.tipo)}</dd></div>}
                        {pieza.brief_id && <div><dt className="inline text-zinc-500">Brief · </dt><dd className="inline">{pieza.brief_id}</dd></div>}
                        {total > 0 && <div><dt className="inline text-zinc-500">Láminas · </dt><dd className="inline">{total}{lamina?.ancho && lamina.alto ? ` · ${lamina.ancho}×${lamina.alto}` : ""}</dd></div>}
                      </dl>
                    </Bloque>
                  </aside>
                </div>

                {/* la decisión */}
                <footer className="border-t border-white/10 bg-black/30 px-4 py-3 sm:px-5" data-decision={dialogo ?? (pendiente || (botones && pieza.status === "pending") ? "quieto" : "resuelta")}>
                  {errorDialogo && <p role="alert" className="mb-2 text-[12.5px] text-rose-300">{errorDialogo}</p>}

                  {/* una pieza pendiente */}
                  {pendiente && dialogo === null && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" data-accion="pieza-aprobar" onClick={() => abrir("aprobar")} className={B_AMBAR}>Aprobar</button>
                      <button type="button" data-accion="pieza-pedir-cambios" onClick={() => abrir("cambios")} className={B_SUAVE}>{textoDelBotonDeCambios(marcadas)}…</button>
                      <button type="button" data-accion="pieza-rechazar" onClick={() => abrir("rechazar")} className={B_ROJO}>Rechazar…</button>
                      <span className="text-[11.5px] text-zinc-500">Aprobar no publica todavía: publicar es un paso aparte. Pedir cambios vuelve a gastar.</span>
                    </div>
                  )}
                  {pendiente && dialogo === "aprobar" && (
                    <div className="flex flex-wrap items-center gap-3" data-editor="pieza-aprobar">
                      <span className="text-[12.5px] text-zinc-300">Darla por buena tal como está. Publicarla en redes es un paso aparte.</span>
                      {pieza.exige_casilla && <label className="flex basis-full items-center gap-2 text-[12px] text-amber-200"><input type="checkbox" data-casilla="entiendo" checked={casilla} onChange={(e) => setCasilla(e.target.checked)} />Entiendo que la revisión de la jefatura no terminó o tiene desacuerdos abiertos.</label>}
                      <button type="button" data-accion="confirmar-aprobar-pieza" disabled={enviando || (pieza.exige_casilla && !casilla)} onClick={() => void decidir("aprobar")} className={B_AMBAR}>{enviando ? "Enviando…" : "Sí, aprobar"}</button>
                      <button type="button" onClick={cancelar} disabled={enviando} className={B_GRIS}>Cancelar</button>
                    </div>
                  )}
                  {pendiente && dialogo === "cambios" && (
                    <form data-editor="pieza-cambios" className="rounded-md border border-white/15 bg-black/30 p-3" onSubmit={(e) => { e.preventDefault(); void decidir("cambios") }}>
                      <p className="text-[12px] text-zinc-400">{alcanceDeLosCambios(marcadas, pieza.gasto_usd)}{marcadas.length === 0 && total > 1 ? " · en «Ver las juntas» puedes marcar solo algunas láminas" : ""}</p>
                      <label className="mt-2 block"><span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-zinc-500">¿Qué quieres distinto? (la oficina creativa lo lee)</span>
                        <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} maxLength={MINIMOS.maximo} aria-label="Qué debe cambiar en la pieza" autoFocus className={CAJA} /></label>
                      <p className="mt-1 text-[11px] text-zinc-500">{comentario.trim().length}/{MINIMOS.maximo} · mínimo {MINIMOS.cambios} letras</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button type="submit" data-accion="confirmar-pedir-cambios-pieza" disabled={enviando || comentario.trim().length < MINIMOS.cambios} className={B_AMBAR}>{enviando ? "Enviando…" : "Enviar el pedido de cambios"}</button>
                        <button type="button" onClick={cancelar} disabled={enviando} className={B_GRIS}>Cancelar</button>
                      </div>
                    </form>
                  )}
                  {pendiente && dialogo === "rechazar" && (
                    <form data-editor="pieza-rechazo" className="rounded-md border border-rose-400/30 bg-black/30 p-3" onSubmit={(e) => { e.preventDefault(); void decidir("rechazar") }}>
                      <label className="block"><span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-zinc-500">¿Por qué se rechaza? (queda registrado)</span>
                        <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} maxLength={MINIMOS.maximo} aria-label="Motivo del rechazo" autoFocus className={CAJA} /></label>
                      <p className="mt-1 text-[11px] text-zinc-500">{comentario.trim().length}/{MINIMOS.maximo} · mínimo {MINIMOS.rechazo} letras</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button type="submit" data-accion="confirmar-rechazar-pieza" disabled={enviando || comentario.trim().length < MINIMOS.rechazo} className={B_ROJO}>{enviando ? "Enviando…" : "Confirmar el rechazo"}</button>
                        <button type="button" onClick={cancelar} disabled={enviando} className={B_GRIS}>Cancelar</button>
                      </div>
                    </form>
                  )}

                  {/* una pieza ya resuelta */}
                  {pieza.es_pieza && !pendiente && dialogo !== "rehacer" && (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[12.5px] text-zinc-400">Esta pieza está {ESTADO_DE_PIEZA_LEGIBLE[estadoVisto]}.</span>
                      {pieza.encargo_id && (estadoVisto === "rechazada" || estadoVisto === "otro") && <button type="button" data-accion="pieza-rehacer" onClick={() => abrir("rehacer")} className={B_SUAVE}>Rehacer esta pieza…</button>}
                    </div>
                  )}
                  {pieza.es_pieza && !pendiente && dialogo === "rehacer" && (
                    <form data-editor="pieza-rehacer" className="rounded-md border border-amber-400/30 bg-black/30 p-3" onSubmit={(e) => { e.preventDefault(); void rehacer() }}>
                      <label className="block"><span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-zinc-500">Qué debe cambiar (opcional)</span>
                        <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} maxLength={MINIMOS.maximo} aria-label="Qué debe cambiar al rehacerla" autoFocus className={CAJA} /></label>
                      <label className="mt-2 flex items-center gap-2 text-[12px] text-amber-200"><input type="checkbox" data-casilla="gasto" checked={confirmoGasto} onChange={(e) => setConfirmoGasto(e.target.checked)} />Entiendo que rehacerla gasta: hasta {usdES(TOPE_POR_PIEZA_USD)} (tope por pieza).</label>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button type="submit" data-accion="confirmar-rehacer-pieza" disabled={enviando || !confirmoGasto} className={B_AMBAR}>{enviando ? "Enviando…" : "Rehacer la pieza"}</button>
                        <button type="button" onClick={cancelar} disabled={enviando} className={B_GRIS}>Cancelar</button>
                      </div>
                    </form>
                  )}

                  {/* una revisión que no es pieza */}
                  {botones && pieza.status === "pending" && dialogo === null && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="basis-full text-[12.5px] text-zinc-400">{tipoDeRevisionLegible(pieza.tipo)}{botones.pista ? ` · ${botones.pista}` : ""}{pieza.tipo === "plan_con_pendientes" ? " También la ves en el Plan de 90 días." : ""}</span>
                      <button type="button" data-accion="revision-aprobar" onClick={() => abrir("aprobar")} className={B_AMBAR}>{botones.aprobar}</button>
                      <button type="button" data-accion="revision-rechazar" onClick={() => abrir("rechazar")} className={B_ROJO}>{botones.rechazar}…</button>
                    </div>
                  )}
                  {botones && pieza.status === "pending" && dialogo === "aprobar" && (
                    <div className="flex flex-wrap items-center gap-3" data-editor="revision-aprobar">
                      <span className="text-[12.5px] text-zinc-300">Se registra en la bandeja del sistema y la oficina que la pidió sigue con eso.</span>
                      <button type="button" data-accion="confirmar-revision-aprobar" disabled={enviando} onClick={() => void resolver("aprobar")} className={B_AMBAR}>{enviando ? "Enviando…" : `Sí, ${botones.aprobar.toLowerCase()}`}</button>
                      <button type="button" onClick={cancelar} disabled={enviando} className={B_GRIS}>Cancelar</button>
                    </div>
                  )}
                  {botones && pieza.status === "pending" && dialogo === "rechazar" && (
                    <form data-editor="revision-rechazo" className="rounded-md border border-rose-400/30 bg-black/30 p-3" onSubmit={(e) => { e.preventDefault(); void resolver("rechazar") }}>
                      <label className="block"><span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-zinc-500">¿Por qué? (la oficina lo lee)</span>
                        <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} maxLength={1000} aria-label="Por qué se devuelve" autoFocus className={CAJA} /></label>
                      <p className="mt-1 text-[11px] text-zinc-500">{comentario.trim().length}/1000 · mínimo 5 letras</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button type="submit" data-accion="confirmar-revision-rechazar" disabled={enviando || comentario.trim().length < 5} className={B_ROJO}>{enviando ? "Enviando…" : botones.rechazar}</button>
                        <button type="button" onClick={cancelar} disabled={enviando} className={B_GRIS}>Cancelar</button>
                      </div>
                    </form>
                  )}
                  {botones && pieza.status !== "pending" && <p className="text-[12.5px] text-zinc-400">{tipoDeRevisionLegible(pieza.tipo)} · ya resuelta ({ESTADO_DE_PIEZA_LEGIBLE[pieza.estado]}).</p>}
                </footer>
              </>
            )}
          </section>
        </div>
      </section>
    </div>
  )
}
