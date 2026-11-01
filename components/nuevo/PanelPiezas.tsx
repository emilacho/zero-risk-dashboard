"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Bandeja } from "@/lib/bandeja-datos"
import type { DetalleDeLaPieza, FilaDeLaLista } from "@/lib/piezas-datos"
import { CAMPO_LEGIBLE, ESTADO_DE_PIEZA_LEGIBLE, MINIMOS, ORIGEN_CORTO, alcanceDeLosCambios, arbolDeLaBandeja, avisoTrasDecidir, avisosDeLaFila, comentarioDeEdiciones, conEdicion, cuentaDeLaCarpeta, cuerpoDeDecisionDePieza, cuerpoDeRehacer, errorTrasDecidir, laminasDeLasEdiciones, proporcionDeLaLamina, resumenDeLaBandeja, siguientePendiente, textoDelBotonDeCambios, tonoDelEstado, type CampoEditable, type ClienteDeLaBandeja, type Edicion, type FiltroDeLaBandeja, type RespuestaDeDecidir, type Tono } from "@/lib/bandeja"
import type { AccionDeLaPieza, EstadoPieza } from "@/lib/piezas"
import { Kanban } from "@/components/nuevo/Kanban"
import { armarKanban, tarjetaDePieza } from "@/lib/kanban"
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
/** 6.11 (ADENDA 3): las piezas como carpetas (lista) o como Kanban por columnas */
export type VistaDePiezas = "lista" | "kanban"

const ESTILO = `
.pi-entra{animation:piEntra .4s cubic-bezier(.2,.8,.2,1) both}
.pi-lamina{transition:transform .2s ease}
.pi-carpeta{transition:transform .15s ease,border-color .15s ease,background .15s ease}
.pi-carpeta:hover,.pi-carpeta:focus-visible{transform:translateY(-2px);border-color:rgba(245,165,36,.55);background:rgba(245,165,36,.06)}
.pi-nodo[aria-current="true"]{background:rgba(245,165,36,.12);color:#fde68a}
@keyframes piEntra{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.pi-entra{animation:none}.pi-lamina,.pi-carpeta{transition:none}}
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
const BOTON = "rounded-md border transition disabled:cursor-not-allowed disabled:opacity-40"
/** los botones de la decisión van GRANDES (Emilio, 31-oct) */
const GRANDE = `${BOTON} px-6 py-3 text-[15px] font-medium`
const B_AMBAR = `${GRANDE} border-amber-400/80 bg-amber-400/20 text-amber-50 hover:bg-amber-400/30`
const B_SUAVE = `${GRANDE} border-white/20 bg-white/[0.04] text-zinc-100 hover:bg-white/[0.09]`
const B_ROJO = `${GRANDE} border-rose-400/70 bg-rose-400/15 text-rose-50 hover:bg-rose-400/25`
const B_GRIS = `${BOTON} px-3 py-1.5 text-[12px] border-white/10 text-zinc-400 hover:bg-white/[0.05]`
const B_CHICO = `${BOTON} px-3 py-1.5 text-[12px] border-white/15 text-zinc-200 hover:bg-white/[0.06]`
const CAJA = "w-full resize-y rounded-md border border-white/15 bg-black/40 px-2.5 py-2 text-[13px] leading-relaxed text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400"
const CUADRICULA = "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
const CARPETA = "pi-carpeta flex w-full flex-col items-start gap-2 rounded-xl border border-white/10 bg-[#1c1c1c] p-4 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400"
const MIGA = "rounded px-1.5 py-0.5 text-[12.5px] text-zinc-300 hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400"

function IconoCarpeta({ abierta = false }: { abierta?: boolean }) {
  return <svg viewBox="0 0 32 32" aria-hidden className="h-9 w-9 shrink-0"><path d="M4 9.5A2.5 2.5 0 0 1 6.5 7h6l3 3h10A2.5 2.5 0 0 1 28 12.5v12a2.5 2.5 0 0 1-2.5 2.5h-19A2.5 2.5 0 0 1 4 24.5v-15Z" fill={abierta ? "rgba(245,165,36,.18)" : "none"} stroke={AMBAR} strokeWidth="1.5" strokeLinejoin="round" /><path d="M4 14h24" stroke={AMBAR} strokeWidth="1.5" /></svg>
}
const IconoCarpetaChica = () => <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 shrink-0"><path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h3l1.5 1.5H13A1.5 1.5 0 0 1 14.5 6v6A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12v-7.5Z" fill="none" stroke={AMBAR} strokeWidth="1.2" strokeLinejoin="round" /></svg>
const Sep = () => <span className="text-zinc-600" aria-hidden>›</span>

/** un texto de la pieza con su botón «Editar» (solo si la pieza sigue pendiente): el texto nuevo se suma al pedido de cambios */
function CampoDeTexto({ etiqueta, valor, campo, lamina, editable, edicion, onEditar, fuerte = false }: { etiqueta: string; valor: string | null; campo: CampoEditable; lamina: number | null; editable: boolean; edicion: Edicion | undefined; onEditar: (e: Edicion) => void; fuerte?: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState(edicion?.despues ?? valor ?? "")
  useEffect(() => { setTexto(edicion?.despues ?? valor ?? ""); setAbierto(false) }, [valor, edicion?.despues, lamina])
  const clave = `${lamina ?? "pie"}-${campo}`
  return (
    <div data-campo={clave} data-editado={!!edicion}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <span className="block text-[10.5px] uppercase tracking-[0.08em] text-zinc-500">{etiqueta}</span>
          {edicion ? (
            <><p className="whitespace-pre-wrap text-amber-100">{edicion.despues}</p>{edicion.antes && <p className="whitespace-pre-wrap text-[11.5px] text-zinc-500 line-through">{edicion.antes}</p>}</>
          ) : valor ? <p className={`whitespace-pre-wrap ${fuerte ? "font-semibold text-zinc-50" : ""}`}>{valor}</p> : <p className="italic text-zinc-500">sin texto</p>}
        </div>
        {editable && !abierto && (
          <button type="button" data-accion="editar-texto" data-campo-editar={clave} onClick={() => setAbierto(true)} aria-label={`Editar ${etiqueta.toLowerCase()}`} className="flex shrink-0 items-center gap-1 rounded border border-white/15 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-amber-400/60 hover:text-amber-100">
            <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden><path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>Editar
          </button>
        )}
      </div>
      {abierto && (
        <form data-editor={clave} className="mt-1.5 rounded-md border border-amber-400/30 bg-black/30 p-2" onSubmit={(e) => { e.preventDefault(); onEditar({ lamina, campo, antes: valor, despues: texto }); setAbierto(false) }}>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={campo === "pie" ? 5 : 2} maxLength={600} autoFocus aria-label={`Editar ${etiqueta.toLowerCase()}`} className={CAJA} />
          <div className="mt-1.5 flex items-center gap-2">
            <button type="submit" data-accion="guardar-texto" className={`${B_CHICO} border-amber-400/60 text-amber-100`}>Sumar al pedido de cambios</button>
            <button type="button" onClick={() => { setAbierto(false); setTexto(edicion?.despues ?? valor ?? "") }} className={B_GRIS}>Cancelar</button>
          </div>
          <p className="mt-1 text-[10.5px] text-zinc-500">El texto va exacto a la oficina creativa, que vuelve a dibujar la lámina.</p>
        </form>
      )}
    </div>
  )
}

/** una pieza como archivo del explorador: la primera lámina de miniatura, el estado y lo que avisa */
function TarjetaDePieza({ p, onAbrir }: { p: FilaDeLaLista; onAbrir: () => void }) {
  const [conLamina, setConLamina] = useState(p.tiene_dibujo)
  const tono = tonoDelEstado(p.estado); const avisoFila = avisosDeLaFila(p)
  return (
    <li>
      <button type="button" data-pieza={p.id} data-estado={p.estado} onClick={onAbrir} className="pi-carpeta flex w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1c1c1c] text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/50">
          {conLamina && p.es_pieza
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={`/api/piezas/${p.id}/lamina/1`} alt="" loading="lazy" onError={() => setConLamina(false)} className="h-full w-full object-cover" />
            : <div className="flex h-full w-full items-center justify-center px-3 text-center text-[11.5px] text-zinc-500">{p.es_pieza ? "sin dibujo" : tipoDeRevisionLegible(p.tipo)}</div>}
          <span className={`absolute left-2 top-2 h-2.5 w-2.5 rounded-full ${PUNTO[tono]}`} aria-hidden />
        </div>
        <div className="p-3">
          <span className="block text-[13px] font-medium leading-snug text-zinc-100">{p.titulo_legible}</span>
          <span className="mt-0.5 block text-[11px] text-zinc-500">{diaYHora(p.creada)} · {ESTADO_DE_PIEZA_LEGIBLE[p.estado]}{p.gasto_usd != null ? ` · ${usdES(p.gasto_usd)}` : ""}</span>
          {avisoFila && <span className="mt-0.5 block text-[11px] text-amber-300/90">{avisoFila}</span>}
        </div>
      </button>
    </li>
  )
}

export function PanelPiezas({ onCerrar, bandejaInicial = null, piezaInicialDatos = null, clienteInicial = null, carpetaInicial = null, piezaInicial = null, accion = llamarAccion, fetchImpl = fetch, vistaInicial = "lista" }: {
  onCerrar: () => void
  /** lecturas ya hechas (pruebas) */
  bandejaInicial?: Bandeja | null
  piezaInicialDatos?: DetalleDeLaPieza | null
  /** el cliente en el que está enfocada la oficina (lo pasa el Dept. Marketing). El explorador NO cambia de cliente: para eso está la ventana de selección (Emilio, 31-oct) */
  clienteInicial?: string | null
  /** abrir dentro de esta carpeta del cliente (tipo de pieza) */
  carpetaInicial?: string | null
  /** abrir con esta pieza elegida (el calendario la manda) */
  piezaInicial?: string | null
  /** cómo se envían las acciones del tablero (pruebas) */
  accion?: typeof llamarAccion
  /** cómo se llama a `POST /api/piezas/{id}/decidir` (pruebas) */
  fetchImpl?: typeof fetch
  /** 6.11: abrir como lista (carpetas) o como Kanban */
  vistaInicial?: VistaDePiezas
}) {
  const [bandeja, setBandeja] = useState<Bandeja | null>(bandejaInicial)
  const [errorBandeja, setErrorBandeja] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!bandejaInicial)
  const [filtro, setFiltro] = useState<FiltroDeLaBandeja>(bandejaInicial?.estado ?? (piezaInicial ? "todas" : "pendiente"))
  const [vista, setVista] = useState<VistaDePiezas>(vistaInicial)
  const [carpeta, setCarpeta] = useState<string | null>(() => {
    // si ya viene la bandeja y una pieza elegida, el explorador arranca parado en su carpeta
    const id = piezaInicial ?? piezaInicialDatos?.id ?? null
    const f = bandejaInicial && id ? [...bandejaInicial.piezas, ...bandejaInicial.otras].find((x) => x.id === id) : null
    return f ? f.carpeta : carpetaInicial
  })
  const [elegida, setElegida] = useState<string | null>(piezaInicial ?? piezaInicialDatos?.id ?? null)
  const [pieza, setPieza] = useState<DetalleDeLaPieza | null>(piezaInicialDatos)
  const [errorPieza, setErrorPieza] = useState<string | null>(null)
  const [cargandoPieza, setCargandoPieza] = useState(false)
  const [n, setN] = useState(1)
  const [juntas, setJuntas] = useState(false)
  const [marcadas, setMarcadas] = useState<number[]>([])
  const [ediciones, setEdiciones] = useState<Edicion[]>([])
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
  // al cambiar de pieza, el visor vuelve a la primera lámina y se olvidan marcas, ediciones y diálogo
  useEffect(() => { setN(1); setJuntas(false); setMarcadas([]); setEdiciones([]); setZoom(false); setDialogo(null); setComentario(""); setCasilla(false); setConfirmoGasto(false); setErrorDialogo(null) }, [pieza?.id])

  const arbol = useMemo(() => (bandeja ? arbolDeLaBandeja(bandeja.piezas, bandeja.otras) : []), [bandeja])
  const todas = useMemo(() => (bandeja ? [...bandeja.piezas, ...bandeja.otras] : []), [bandeja])
  const filaElegida = elegida ? todas.find((f) => f.id === elegida) ?? null : null
  // la pieza que llega de afuera (calendario) ubica el explorador en su carpeta
  useEffect(() => { if (filaElegida && carpeta !== filaElegida.carpeta) setCarpeta(filaElegida.carpeta) }, [filaElegida, carpeta])
  // el cliente lo decide la oficina (ventana de selección); aquí no se cambia
  const clienteId = clienteInicial ?? filaElegida?.cliente_id ?? arbol[0]?.id ?? null
  const clienteActual: ClienteDeLaBandeja | null = arbol.find((c) => (c.id ?? "") === (clienteId ?? "")) ?? null
  const carpetaActual = clienteActual && carpeta ? clienteActual.carpetas.find((k) => k.nombre === carpeta) ?? null : null
  const nombreDelCliente = bandeja?.clientes.find((c) => c.id === clienteId)?.nombre ?? clienteActual?.nombre ?? filaElegida?.cliente ?? pieza?.cliente ?? "Cliente"
  const filasDelCliente = clienteActual ? clienteActual.carpetas.flatMap((k) => k.filas) : []
  const porAprobarDelCliente = filasDelCliente.filter((f) => f.estado === "pendiente" && f.es_pieza).length
  const otrasPendientes = filasDelCliente.filter((f) => f.estado === "pendiente" && !f.es_pieza).length

  const irA = (k: string | null) => { setCarpeta(k); setElegida(null); setPieza(null); setErrorPieza(null) }
  const verTodas = () => { setFiltro("todas"); if (!bandejaInicial) void leerLaBandeja("todas") }
  // el Kanban muestra TODAS las piezas del cliente (decididas incluidas): entrar a él pasa el filtro a «todas»
  const verComo = (v: VistaDePiezas) => { setVista(v); if (v === "kanban") { setElegida(null); setPieza(null); if (filtro !== "todas") verTodas() } }
  // solo piezas (lo que no es pieza —plan con pendientes, revisión del editor— sigue en «Otras revisiones» de las carpetas)
  const kanbanDePiezas = vista === "kanban" ? armarKanban(filasDelCliente.filter((f) => f.es_pieza).map(tarjetaDePieza)) : []

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
  const editar = (e: Edicion) => setEdiciones((l) => conEdicion(l, e))
  const edicionDe = (lam: number | null, campo: CampoEditable) => ediciones.find((e) => e.lamina === lam && e.campo === campo)
  const laminasDelPedido = [...new Set([...marcadas, ...laminasDeLasEdiciones(ediciones)])].sort((a, b) => a - b)

  /** Aprobar · Pedir cambios · Rechazar una PIEZA: la misma puerta que la ventana de siempre (`POST /api/piezas/{id}/decidir`) */
  async function decidir(a: AccionDeLaPieza) {
    if (!pieza) return
    let texto = comentario
    if (a === "cambios" && ediciones.length) { const c = comentarioDeEdiciones(ediciones, comentario); if ("error" in c) { setErrorDialogo(c.error); return } texto = c.comentario }
    const c = cuerpoDeDecisionDePieza({ accion: a, comentario: texto, laminas: a === "cambios" ? laminasDelPedido : marcadas, casilla, total, exige_casilla: pieza.exige_casilla, estado_visto: pieza.status })
    if ("error" in c) { setErrorDialogo(c.error); return }
    setEnviando(true); setErrorDialogo(null)
    try {
      const r = await fetchImpl(`/api/piezas/${encodeURIComponent(pieza.id)}/decidir`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(c.cuerpo) })
      const j = (await r.json().catch(() => ({}))) as RespuestaDeDecidir
      if (r.ok && j.ok) {
        setAviso({ ok: true, texto: avisoTrasDecidir(a, j) }); setDialogo(null); setComentario(""); setCasilla(false); setMarcadas([]); setEdiciones([])
        if (!j.simulado) {
          setResultadoLocal({ id: pieza.id, estado: estadoTrasDecidir(a) })
          const siguiente = siguientePendiente(carpetaActual?.filas ?? [], pieza.id)
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

  const botones = pieza && !pieza.es_pieza ? botonesDeRevision(pieza.tipo) : null

  return (
    <div className="nv-panel fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-5" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onCerrar() }}>
      <style>{ESTILO}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="piezas-titulo" data-seccion="piezas" className="relative flex h-full max-h-full w-full max-w-[1480px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <h2 id="piezas-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Piezas</h2>
          {bandeja && <Chip tono={porAprobarDelCliente > 0 ? "ambar" : "neutro"}>{resumenDeLaBandeja({ por_aprobar: porAprobarDelCliente, otras_pendientes: otrasPendientes })}</Chip>}
          <p className="hidden text-[12px] text-zinc-500 xl:block">Lo que la oficina creativa entregó para {nombreDelCliente}, por tipo de pieza · aquí se aprueba, se piden cambios o se rechaza</p>
          <div role="group" aria-label="Cómo ver las piezas" className="ml-auto flex rounded-md border border-white/10 p-0.5 text-[11px]">
            {(["lista", "kanban"] as const).map((v) => (
              <button key={v} type="button" data-vista-piezas={v} aria-pressed={vista === v} onClick={() => verComo(v)}
                className={`rounded px-2.5 py-1 transition ${vista === v ? "bg-amber-400/20 text-amber-100" : "text-zinc-400 hover:text-zinc-200"}`}>{v === "lista" ? "Carpetas" : "Kanban"}</button>
            ))}
          </div>
          <div role="group" aria-label="Qué piezas ver" className="flex rounded-md border border-white/10 p-0.5 text-[11px]">
            {(["pendiente", "todas"] as const).map((f) => (
              <button key={f} type="button" data-filtro={f} aria-pressed={filtro === f} onClick={() => { setFiltro(f); if (!bandejaInicial) void leerLaBandeja(f) }}
                className={`rounded px-2.5 py-1 transition ${filtro === f ? "bg-amber-400/20 text-amber-100" : "text-zinc-400 hover:text-zinc-200"}`}>{f === "pendiente" ? "Por aprobar" : "Todas"}</button>
            ))}
          </div>
          {cargando && <span className="text-[11px] text-zinc-500">Leyendo…</span>}
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </header>

        {/* la barra de dirección: de macro a micro, dentro del cliente enfocado */}
        <nav aria-label="Dónde estás" data-ruta className="flex flex-wrap items-center gap-1 border-b border-white/10 bg-black/30 px-4 py-2 sm:px-5">
          <button type="button" data-miga="cliente" onClick={() => irA(null)} aria-current={!carpeta ? "page" : undefined} className={`${MIGA} ${!carpeta ? "text-amber-200" : ""}`}>{nombreDelCliente}</button>
          {carpeta && <><Sep /><button type="button" data-miga="carpeta" onClick={() => irA(carpeta)} aria-current={!elegida ? "page" : undefined} className={`${MIGA} ${!elegida ? "text-amber-200" : ""}`}>{carpeta}</button></>}
          {elegida && <><Sep /><span data-miga="pieza" aria-current="page" className="px-1.5 text-[12.5px] text-amber-200">{pieza?.titulo ?? filaElegida?.titulo_legible ?? "Pieza"}</span></>}
          {elegida && total > 0 && <><Sep /><span data-miga="lamina" className="px-1.5 text-[12.5px] text-zinc-400">{juntas ? `${total} láminas` : `lámina ${n} de ${total}`}</span></>}
        </nav>

        {errorBandeja && <p role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[13px] text-rose-200 sm:px-5">{errorBandeja}</p>}
        {aviso && <p role="status" data-aviso={aviso.ok ? "ok" : "error"} className={`border-b px-4 py-2 text-[13px] sm:px-5 ${aviso.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-rose-500/30 bg-rose-500/10 text-rose-200"}`}>{aviso.texto}</p>}

        <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)]">
          {/* el árbol, como el panel izquierdo de un explorador: el cliente enfocado y sus carpetas por tipo de pieza */}
          <aside aria-label="Las carpetas del cliente" className="min-h-0 overflow-y-auto border-r border-white/10 py-2">
            <button type="button" data-nodo="cliente" onClick={() => irA(null)} aria-current={!carpeta ? "true" : undefined} className="pi-nodo flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-zinc-200 hover:bg-white/[0.04]"><IconoCarpetaChica /><span className="min-w-0 flex-1 truncate">{nombreDelCliente}</span>{porAprobarDelCliente + otrasPendientes > 0 && <span className="num rounded-full bg-amber-400/20 px-1.5 text-[10.5px] text-amber-200">{porAprobarDelCliente + otrasPendientes}</span>}</button>
            {bandeja && !clienteActual && <p className="px-4 py-3 text-[12px] text-zinc-500">{filtro === "pendiente" ? "Nada por aprobar ahora." : "Sin piezas."}</p>}
            <ul>
              {clienteActual?.carpetas.map((k2) => (
                <li key={k2.nombre}>
                  <button type="button" data-nodo-carpeta={k2.nombre} onClick={() => irA(k2.nombre)} aria-current={carpeta === k2.nombre ? "true" : undefined} className="pi-nodo flex w-full items-center gap-2 py-1.5 pl-8 pr-3 text-left text-[12px] text-zinc-300 hover:bg-white/[0.04]">
                    <IconoCarpetaChica /><span className="min-w-0 flex-1 truncate">{k2.nombre}</span><span className="num text-[10.5px] text-zinc-500">{k2.filas.length}</span>
                    {k2.por_aprobar > 0 && <span className="num rounded-full bg-amber-400/20 px-1.5 text-[10.5px] text-amber-200">{k2.por_aprobar}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {/* el panel derecho: carpetas → piezas → la pieza */}
          <section aria-label="El contenido" className="flex min-h-0 flex-col">
            {!elegida && bandeja && vista === "kanban" && (
              <div className="pi-entra overflow-y-auto p-5" data-vista="kanban">
                <p className="mb-3 text-[12px] text-zinc-500">Las piezas de {nombreDelCliente} por columna, según dónde están de verdad. Lo que todavía se está haciendo o revisando antes de llegar a esta bandeja se ve en el Kanban del Centro de campaña (Calendario → Kanban). Toca una tarjeta para abrir la pieza.</p>
                <Kanban columnas={kanbanDePiezas} onElegir={(id) => setElegida(id)} etiqueta="Las piezas por columna" />
              </div>
            )}
            {!elegida && bandeja && vista === "lista" && !carpeta && (
              <div className="pi-entra overflow-y-auto p-5" data-vista="carpetas">
                {!clienteActual ? <p className="text-[13px] text-zinc-400">{filtro === "pendiente" ? `No hay piezas por aprobar de ${nombreDelCliente}.` : `${nombreDelCliente} no tiene piezas.`}{filtro === "pendiente" ? <> <button type="button" data-accion="ver-todas" onClick={verTodas} className="underline decoration-dotted hover:text-amber-200">Ver también las ya decididas</button></> : null}</p> : (
                  <>
                    <p className="mb-3 text-[12px] text-zinc-500">Las piezas de {clienteActual.nombre}, por tipo. Entra a una carpeta.</p>
                    <ul className={CUADRICULA} aria-label="Las carpetas">
                      {clienteActual.carpetas.map((k2) => (
                        <li key={k2.nombre}><button type="button" data-carpeta={k2.nombre} onClick={() => irA(k2.nombre)} className={CARPETA}>
                          <IconoCarpeta /><span className="text-[14px] font-medium text-zinc-100">{k2.nombre}</span><span className="text-[11.5px] text-zinc-400">{cuentaDeLaCarpeta({ por_aprobar: k2.por_aprobar, total: k2.filas.length })}</span></button></li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
            {!elegida && bandeja && vista === "lista" && carpetaActual && (
              <div className="pi-entra overflow-y-auto p-5" data-vista="piezas">
                <p className="mb-3 text-[12px] text-zinc-500">{carpetaActual.nombre} de {clienteActual?.nombre} · {cuentaDeLaCarpeta({ por_aprobar: carpetaActual.por_aprobar, total: carpetaActual.filas.length })}. Abre una para verla lámina por lámina.</p>
                <ul className={CUADRICULA} aria-label="Las piezas">
                  {carpetaActual.filas.map((p) => <TarjetaDePieza key={p.id} p={p} onAbrir={() => setElegida(p.id)} />)}
                </ul>
              </div>
            )}
            {!elegida && bandeja && vista === "lista" && carpeta && !carpetaActual && <p className="p-5 text-[13px] text-zinc-400">Esa carpeta ya no tiene piezas con este filtro. <button type="button" onClick={() => irA(null)} className="underline decoration-dotted hover:text-amber-200">Volver a las carpetas de {nombreDelCliente}</button></p>}
            {elegida && !pieza && <p className={`p-6 text-[13px] ${errorPieza && !cargandoPieza ? "text-rose-300" : "text-zinc-500"}`}>{cargandoPieza ? "Leyendo la pieza…" : errorPieza ?? "Leyendo la pieza…"}</p>}

            {pieza && estadoVisto && (
              <>
                <div className="pi-entra flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3 sm:px-5" key={pieza.id}>
                  <button type="button" data-accion="volver-a-la-carpeta" onClick={() => irA(carpeta)} aria-label="Volver a la carpeta" className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-zinc-300 hover:bg-white/[0.06]">‹</button>
                  <h3 className="font-display text-[18px] font-semibold leading-tight tracking-tight text-zinc-50" data-titulo-pieza>{pieza.titulo}</h3>
                  <Chip tono={pieza.es_pieza ? tonoDelEstado(estadoVisto) : pieza.status === "pending" ? "ambar" : "neutro"}>{pieza.es_pieza ? ESTADO_DE_PIEZA_LEGIBLE[estadoVisto] : pieza.status === "pending" ? "espera tu decisión" : "ya resuelta"}</Chip>
                  {pieza.gasto_usd != null && <Chip>costó {usdES(pieza.gasto_usd)}</Chip>}
                  {pieza.version != null && <Chip>versión {pieza.version}</Chip>}
                  {pieza.jefatura.resultado && <Chip tono={pieza.jefatura.desacuerdos.length ? "ambar" : "neutro"}>jefatura {resultadoDeJefaturaDePiezaLegible(pieza.jefatura.resultado)}</Chip>}
                  {total > 0 && <button type="button" data-accion="ver-juntas" aria-pressed={juntas} onClick={() => { setJuntas((v) => !v); setZoom(false) }} className={`${B_CHICO} ml-auto`}>{juntas ? "Ver una lámina" : `Ver las ${total} juntas`}</button>}
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_23rem]">
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
                        <div className="space-y-2">
                          <CampoDeTexto etiqueta="Encabezado" valor={lamina.eyebrow} campo="encabezado" lamina={lamina.n} editable={pendiente} edicion={edicionDe(lamina.n, "encabezado")} onEditar={editar} />
                          <CampoDeTexto etiqueta="Titular" valor={lamina.titular} campo="titular" lamina={lamina.n} editable={pendiente} edicion={edicionDe(lamina.n, "titular")} onEditar={editar} fuerte />
                          <CampoDeTexto etiqueta="Cuerpo" valor={lamina.cuerpo} campo="cuerpo" lamina={lamina.n} editable={pendiente} edicion={edicionDe(lamina.n, "cuerpo")} onEditar={editar} />
                          {lamina.pie && <p className="text-[11.5px] text-zinc-400">{lamina.pie}</p>}
                        </div>
                      </Bloque>
                    )}
                    {pieza.es_pieza && (
                      <Bloque titulo="Pie de la publicación" etiqueta="pie">
                        <CampoDeTexto etiqueta="Texto que acompaña la publicación" valor={pieza.pie} campo="pie" lamina={null} editable={pendiente} edicion={edicionDe(null, "pie")} onEditar={editar} />
                      </Bloque>
                    )}
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

                {/* la decisión · botones grandes */}
                <footer className="border-t border-white/10 bg-black/30 px-4 py-3 sm:px-5" data-decision={dialogo ?? (pendiente || (botones && pieza.status === "pending") ? "quieto" : "resuelta")}>
                  {errorDialogo && <p role="alert" className="mb-2 text-[12.5px] text-rose-300">{errorDialogo}</p>}

                  {/* una pieza pendiente */}
                  {pendiente && dialogo === null && (
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" data-accion="pieza-aprobar" onClick={() => abrir("aprobar")} className={B_AMBAR}>Aprobar</button>
                      <button type="button" data-accion="pieza-pedir-cambios" onClick={() => abrir("cambios")} className={`${B_SUAVE} ${ediciones.length ? "border-amber-400/60" : ""}`}>{ediciones.length ? `Enviar ${ediciones.length === 1 ? "1 cambio de texto" : `${ediciones.length} cambios de texto`}${marcadas.length ? ` y ${textoDelBotonDeCambios(marcadas).toLowerCase()}` : ""}` : textoDelBotonDeCambios(marcadas)}…</button>
                      <button type="button" data-accion="pieza-rechazar" onClick={() => abrir("rechazar")} className={B_ROJO}>Rechazar…</button>
                      <span className="text-[12px] text-zinc-500">Aprobar no publica todavía: publicar es un paso aparte. Pedir cambios vuelve a gastar.{ediciones.length ? " Tus textos editados viajan en el pedido de cambios." : ""}</span>
                    </div>
                  )}
                  {pendiente && dialogo === "aprobar" && (
                    <div className="flex flex-wrap items-center gap-3" data-editor="pieza-aprobar">
                      <span className="text-[13px] text-zinc-300">Darla por buena tal como está. Publicarla en redes es un paso aparte.{ediciones.length ? ` Ojo: tienes ${ediciones.length} ${ediciones.length === 1 ? "cambio de texto" : "cambios de texto"} sin enviar; aprobar no los aplica.` : ""}</span>
                      {pieza.exige_casilla && <label className="flex basis-full items-center gap-2 text-[13px] text-amber-200"><input type="checkbox" data-casilla="entiendo" checked={casilla} onChange={(e) => setCasilla(e.target.checked)} className="h-4 w-4" />Entiendo que la revisión de la jefatura no terminó o tiene desacuerdos abiertos.</label>}
                      <button type="button" data-accion="confirmar-aprobar-pieza" disabled={enviando || (pieza.exige_casilla && !casilla)} onClick={() => void decidir("aprobar")} className={B_AMBAR}>{enviando ? "Enviando…" : "Sí, aprobar"}</button>
                      <button type="button" onClick={cancelar} disabled={enviando} className={B_GRIS}>Cancelar</button>
                    </div>
                  )}
                  {pendiente && dialogo === "cambios" && (
                    <form data-editor="pieza-cambios" className="rounded-md border border-white/15 bg-black/30 p-3" onSubmit={(e) => { e.preventDefault(); void decidir("cambios") }}>
                      <p className="text-[12.5px] text-zinc-400">{alcanceDeLosCambios(laminasDelPedido, pieza.gasto_usd)}{laminasDelPedido.length === 0 && total > 1 ? " · en «Ver las juntas» puedes marcar solo algunas láminas" : ""}</p>
                      {ediciones.length > 0 && (
                        <ul data-ediciones className="mt-2 space-y-1 rounded-md border border-amber-400/20 bg-amber-400/[0.05] p-2 text-[12.5px]" aria-label="Los textos editados">
                          {ediciones.map((e) => <li key={`${e.lamina}-${e.campo}`} className="flex items-start gap-2"><span className="min-w-0 flex-1 text-zinc-200">{e.lamina != null ? `Lámina ${e.lamina} · ` : ""}{CAMPO_LEGIBLE[e.campo]}: <span className="text-amber-100">«{e.despues}»</span>{e.antes ? <span className="text-zinc-500"> (antes «{e.antes}»)</span> : null}</span><button type="button" data-accion="quitar-edicion" onClick={() => setEdiciones((l) => l.filter((x) => x !== e))} aria-label="Quitar este cambio" className="text-[11px] text-zinc-500 hover:text-rose-200">quitar</button></li>)}
                        </ul>
                      )}
                      <label className="mt-2 block"><span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-zinc-500">{ediciones.length ? "Algo más para la oficina (opcional)" : "¿Qué quieres distinto? (la oficina creativa lo lee)"}</span>
                        <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} maxLength={MINIMOS.maximo} aria-label="Qué debe cambiar en la pieza" autoFocus className={CAJA} /></label>
                      <p className="mt-1 text-[11px] text-zinc-500">{comentario.trim().length}/{MINIMOS.maximo}{ediciones.length ? "" : ` · mínimo ${MINIMOS.cambios} letras`}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button type="submit" data-accion="confirmar-pedir-cambios-pieza" disabled={enviando || (!ediciones.length && comentario.trim().length < MINIMOS.cambios)} className={B_AMBAR}>{enviando ? "Enviando…" : "Enviar el pedido de cambios a la oficina"}</button>
                        <button type="button" onClick={cancelar} disabled={enviando} className={B_GRIS}>Cancelar</button>
                      </div>
                    </form>
                  )}
                  {pendiente && dialogo === "rechazar" && (
                    <form data-editor="pieza-rechazo" className="rounded-md border border-rose-400/30 bg-black/30 p-3" onSubmit={(e) => { e.preventDefault(); void decidir("rechazar") }}>
                      <label className="block"><span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-zinc-500">¿Por qué se rechaza? (queda registrado)</span>
                        <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} maxLength={MINIMOS.maximo} aria-label="Motivo del rechazo" autoFocus className={CAJA} /></label>
                      <p className="mt-1 text-[11px] text-zinc-500">{comentario.trim().length}/{MINIMOS.maximo} · mínimo {MINIMOS.rechazo} letras</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button type="submit" data-accion="confirmar-rechazar-pieza" disabled={enviando || comentario.trim().length < MINIMOS.rechazo} className={B_ROJO}>{enviando ? "Enviando…" : "Confirmar el rechazo"}</button>
                        <button type="button" onClick={cancelar} disabled={enviando} className={B_GRIS}>Cancelar</button>
                      </div>
                    </form>
                  )}

                  {/* una pieza ya resuelta */}
                  {pieza.es_pieza && !pendiente && dialogo !== "rehacer" && (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[13px] text-zinc-400">Esta pieza está {ESTADO_DE_PIEZA_LEGIBLE[estadoVisto]}.</span>
                      {pieza.encargo_id && (estadoVisto === "rechazada" || estadoVisto === "otro") && <button type="button" data-accion="pieza-rehacer" onClick={() => abrir("rehacer")} className={B_SUAVE}>Rehacer esta pieza…</button>}
                    </div>
                  )}
                  {pieza.es_pieza && !pendiente && dialogo === "rehacer" && (
                    <form data-editor="pieza-rehacer" className="rounded-md border border-amber-400/30 bg-black/30 p-3" onSubmit={(e) => { e.preventDefault(); void rehacer() }}>
                      <label className="block"><span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-zinc-500">Qué debe cambiar (opcional)</span>
                        <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} maxLength={MINIMOS.maximo} aria-label="Qué debe cambiar al rehacerla" autoFocus className={CAJA} /></label>
                      <label className="mt-2 flex items-center gap-2 text-[13px] text-amber-200"><input type="checkbox" data-casilla="gasto" checked={confirmoGasto} onChange={(e) => setConfirmoGasto(e.target.checked)} className="h-4 w-4" />Entiendo que rehacerla gasta: hasta {usdES(TOPE_POR_PIEZA_USD)} (tope por pieza).</label>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button type="submit" data-accion="confirmar-rehacer-pieza" disabled={enviando || !confirmoGasto} className={B_AMBAR}>{enviando ? "Enviando…" : "Rehacer la pieza"}</button>
                        <button type="button" onClick={cancelar} disabled={enviando} className={B_GRIS}>Cancelar</button>
                      </div>
                    </form>
                  )}

                  {/* una revisión que no es pieza */}
                  {botones && pieza.status === "pending" && dialogo === null && (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="basis-full text-[13px] text-zinc-400">{tipoDeRevisionLegible(pieza.tipo)}{botones.pista ? ` · ${botones.pista}` : ""}{pieza.tipo === "plan_con_pendientes" ? " También la ves en el Plan de 90 días." : ""}</span>
                      <button type="button" data-accion="revision-aprobar" onClick={() => abrir("aprobar")} className={B_AMBAR}>{botones.aprobar}</button>
                      <button type="button" data-accion="revision-rechazar" onClick={() => abrir("rechazar")} className={B_ROJO}>{botones.rechazar}…</button>
                    </div>
                  )}
                  {botones && pieza.status === "pending" && dialogo === "aprobar" && (
                    <div className="flex flex-wrap items-center gap-3" data-editor="revision-aprobar">
                      <span className="text-[13px] text-zinc-300">Se registra en la bandeja del sistema y la oficina que la pidió sigue con eso.</span>
                      <button type="button" data-accion="confirmar-revision-aprobar" disabled={enviando} onClick={() => void resolver("aprobar")} className={B_AMBAR}>{enviando ? "Enviando…" : `Sí, ${botones.aprobar.toLowerCase()}`}</button>
                      <button type="button" onClick={cancelar} disabled={enviando} className={B_GRIS}>Cancelar</button>
                    </div>
                  )}
                  {botones && pieza.status === "pending" && dialogo === "rechazar" && (
                    <form data-editor="revision-rechazo" className="rounded-md border border-rose-400/30 bg-black/30 p-3" onSubmit={(e) => { e.preventDefault(); void resolver("rechazar") }}>
                      <label className="block"><span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-zinc-500">¿Por qué? (la oficina lo lee)</span>
                        <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} maxLength={1000} aria-label="Por qué se devuelve" autoFocus className={CAJA} /></label>
                      <p className="mt-1 text-[11px] text-zinc-500">{comentario.trim().length}/1000 · mínimo 5 letras</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button type="submit" data-accion="confirmar-revision-rechazar" disabled={enviando || comentario.trim().length < 5} className={B_ROJO}>{enviando ? "Enviando…" : botones.rechazar}</button>
                        <button type="button" onClick={cancelar} disabled={enviando} className={B_GRIS}>Cancelar</button>
                      </div>
                    </form>
                  )}
                  {botones && pieza.status !== "pending" && <p className="text-[13px] text-zinc-400">{tipoDeRevisionLegible(pieza.tipo)} · ya resuelta ({ESTADO_DE_PIEZA_LEGIBLE[pieza.estado]}).</p>}
                </footer>
              </>
            )}
          </section>
        </div>
      </section>
    </div>
  )
}
