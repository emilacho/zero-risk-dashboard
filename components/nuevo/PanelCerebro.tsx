"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { CerebroDelCliente } from "@/lib/cerebro-datos"
import { MAX_RESPUESTA, MAX_TEMA, alcanceLegible, arbolDelCerebro, claseLegible, decisionLegible, errorTrasGuardar, fechaDeLaFicha, origenLegible, porSede, propiedadLegible, textoTrasGuardar, vigenciaLegible, type CarpetaArmada, type ClaveDeCarpeta, type FichaDelCerebro, type PerfilIdeal, type PreguntaPendiente, type TonoDeVigencia } from "@/lib/cerebro"
import { diaCorto, diaYHora, plural } from "@/lib/lenguaje"

const AMBAR = "#f5a524"
type Respuesta = ({ ok: true } & CerebroDelCliente) | { ok: false; error: string }
/** lo que el dueño está escribiendo: un dato nuevo, la respuesta a una pregunta pendiente o la corrección de un dato suyo */
type Formulario = { modo: "nuevo" | "responder" | "corregir"; tema: string; respuesta: string; sede_clave: string; pregunta: string | null; pregunta_id: string | null; temaFijo: boolean }

const ESTILO = `
.ce-entra{animation:ceEntra .4s cubic-bezier(.2,.8,.2,1) both}
.ce-carpeta{transition:transform .15s ease,border-color .15s ease,background .15s ease}
.ce-carpeta:hover,.ce-carpeta:focus-visible{transform:translateY(-2px);border-color:rgba(245,165,36,.55);background:rgba(245,165,36,.06)}
.ce-nodo[aria-current="true"]{background:rgba(245,165,36,.12);color:#fde68a}
.ce-recorte{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
@keyframes ceEntra{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.ce-entra{animation:none}.ce-carpeta{transition:none}}
`
type Tono = TonoDeVigencia | "azul"
const CHIP: Record<Tono, string> = { ambar: "border-amber-400/50 text-amber-200", verde: "border-emerald-400/40 text-emerald-200", azul: "border-sky-400/40 text-sky-200", rojo: "border-rose-400/40 text-rose-200", neutro: "border-white/15 text-zinc-300" }
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
/** los botones que escriben van GRANDES, como en las piezas (Emilio, 31-oct) */
const GRANDE = `${BOTON} px-6 py-3 text-[15px] font-medium`
const B_AMBAR = `${GRANDE} border-amber-400/80 bg-amber-400/20 text-amber-50 hover:bg-amber-400/30`
const B_SUAVE = `${GRANDE} border-white/20 bg-white/[0.04] text-zinc-100 hover:bg-white/[0.09]`
const B_GRIS = `${BOTON} px-3 py-1.5 text-[12px] border-white/10 text-zinc-400 hover:bg-white/[0.05]`
const B_CHICO = `${BOTON} px-3 py-1.5 text-[12px] border-white/15 text-zinc-200 hover:bg-white/[0.06]`
const CAJA = "w-full rounded-md border border-white/15 bg-black/40 px-2.5 py-2 text-[13px] leading-relaxed text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400"
const CUADRICULA = "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
const CARPETA = "ce-carpeta flex w-full flex-col items-start gap-2 rounded-xl border border-white/10 bg-[#1c1c1c] p-4 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400"
const TARJETA = "ce-carpeta flex w-full flex-col gap-1.5 rounded-xl border border-white/10 bg-[#1c1c1c] p-3.5 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400"
const MIGA = "rounded px-1.5 py-0.5 text-[12.5px] text-zinc-300 hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400"

function IconoCarpeta({ abierta = false }: { abierta?: boolean }) {
  return <svg viewBox="0 0 32 32" aria-hidden className="h-9 w-9 shrink-0"><path d="M4 9.5A2.5 2.5 0 0 1 6.5 7h6l3 3h10A2.5 2.5 0 0 1 28 12.5v12a2.5 2.5 0 0 1-2.5 2.5h-19A2.5 2.5 0 0 1 4 24.5v-15Z" fill={abierta ? "rgba(245,165,36,.18)" : "none"} stroke={AMBAR} strokeWidth="1.5" strokeLinejoin="round" /><path d="M4 14h24" stroke={AMBAR} strokeWidth="1.5" /></svg>
}
const IconoCarpetaChica = () => <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 shrink-0"><path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h3l1.5 1.5H13A1.5 1.5 0 0 1 14.5 6v6A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12v-7.5Z" fill="none" stroke={AMBAR} strokeWidth="1.2" strokeLinejoin="round" /></svg>
const IconoFicha = () => <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 shrink-0 text-zinc-500"><path d="M6 3h8l4 4v14H6V3Z M14 3v4h4 M9 12h6 M9 16h6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
const Sep = () => <span className="text-zinc-600" aria-hidden>›</span>
const Lapiz = () => <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden><path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
const enlaceCorto = (u: string) => u.replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 70)

/** una ficha como archivo del explorador */
function TarjetaDeFicha({ f, onAbrir, ahora }: { f: FichaDelCerebro; onAbrir: () => void; ahora: Date }) {
  const v = vigenciaLegible(f, ahora)
  return (
    <li>
      <button type="button" data-ficha={f.id} data-clase={f.clase} onClick={onAbrir} className={TARJETA}>
        <div className="flex w-full items-start gap-2">
          <IconoFicha />
          <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-zinc-100">{f.titulo}</span>
        </div>
        {(f.que_es || f.contenido) && <p className="ce-recorte text-[12px] leading-relaxed text-zinc-400">{f.que_es ?? f.contenido}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <Chip tono={f.origen === "dueno" ? "ambar" : "neutro"}>{origenLegible(f.origen)}</Chip>
          {f.propiedad === "ajena" && <Chip tono="azul">{propiedadLegible(f.propiedad)}</Chip>}
          {f.propiedad === "incierta" && <Chip>{propiedadLegible(f.propiedad)}</Chip>}
          {v.tono !== "neutro" && v.tono !== "verde" && <Chip tono={v.tono}>{v.texto}</Chip>}
        </div>
        <span className="text-[11px] text-zinc-500">{fechaDeLaFicha(f) ? diaCorto(fechaDeLaFicha(f)) : "sin fecha"}{f.sede ? ` · sede ${f.sede}` : ""} · {claseLegible(f.clase)}</span>
      </button>
    </li>
  )
}

/** un segmento del cliente ideal, con sus listas */
function TarjetaDePerfil({ p }: { p: PerfilIdeal }) {
  const Lista = ({ t, xs }: { t: string; xs: string[] }) => (xs.length ? <div><Titulito>{t}</Titulito><ul className="list-disc space-y-0.5 pl-4 text-[12.5px] text-zinc-200">{xs.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null)
  return (
    <li data-perfil={p.id} className="rounded-xl border border-white/10 bg-[#1c1c1c] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[14px] font-medium text-zinc-100">{p.segmento}</h3>
        {p.prioridad != null && <Chip tono={p.prioridad === 1 ? "ambar" : "neutro"}>Prioridad {p.prioridad}</Chip>}
        {p.geografia && <Chip>{p.geografia}</Chip>}
        {p.presupuesto && <Chip>Presupuesto {p.presupuesto}</Chip>}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Lista t="Qué busca" xs={p.metas} /><Lista t="Qué le duele" xs={p.dolores} /><Lista t="Qué quiere resolver" xs={p.tareas} /><Lista t="Qué objeta" xs={p.objeciones} /><Lista t="Por dónde se le llega" xs={p.canales} /><Lista t="Cómo decide" xs={p.criterios} />
      </div>
      {(p.compra || p.contenido) && <p className="mt-3 text-[12px] leading-relaxed text-zinc-400">{[p.compra, p.contenido].filter(Boolean).join(" · ")}</p>}
    </li>
  )
}

/** el cuadro donde el dueño escribe: va EXACTO a la puerta del dueño de la plataforma (reemplaza lo anterior del mismo tema · US$ 0) */
function FormularioDelDueno({ f, sedes, enviando, error, onCambiar, onEnviar, onCancelar }: { f: Formulario; sedes: CerebroDelCliente["sedes"]; enviando: boolean; error: string | null; onCambiar: (f: Formulario) => void; onEnviar: () => void; onCancelar: () => void }) {
  const caja = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { caja.current?.focus() }, [])
  const titulo = f.modo === "responder" ? "Responder a la oficina" : f.modo === "corregir" ? "Corregir este dato" : "Agregar un dato del dueño"
  return (
    <form data-editor="dato-del-dueno" data-modo={f.modo} className="ce-entra rounded-xl border border-amber-400/30 bg-black/30 p-4" onSubmit={(e) => { e.preventDefault(); onEnviar() }}>
      <h3 className="text-[13px] font-medium text-amber-100">{titulo}</h3>
      {f.pregunta && <p className="mt-1 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[12.5px] italic text-zinc-300">«{f.pregunta}»</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-zinc-500">De qué habla (tema)</span>
          <input value={f.tema} onChange={(e) => onCambiar({ ...f, tema: e.target.value })} maxLength={MAX_TEMA} readOnly={f.temaFijo} placeholder="horario de Olón · presupuesto de pauta · platos que no se promocionan" aria-label="Tema del dato" className={`${CAJA} ${f.temaFijo ? "opacity-70" : ""}`} />
        </label>
        {sedes.length >= 2 && (
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-zinc-500">Sede</span>
            <select value={f.sede_clave} onChange={(e) => onCambiar({ ...f, sede_clave: e.target.value })} aria-label="Sede del dato" className={`${CAJA} min-w-[160px]`}>
              <option value="">Todo el negocio</option>
              {sedes.map((s) => <option key={s.clave} value={s.clave}>{s.ciudad ? `${s.ciudad} (${s.clave})` : s.clave}</option>)}
            </select>
          </label>
        )}
      </div>
      <label className="mt-3 block">
        <span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-zinc-500">El dato, con tus palabras</span>
        <textarea ref={caja} value={f.respuesta} onChange={(e) => onCambiar({ ...f, respuesta: e.target.value })} rows={5} maxLength={MAX_RESPUESTA} aria-label="El dato del dueño" className={`${CAJA} resize-y`} />
      </label>
      <p className="mt-1 text-[11px] text-zinc-500">{f.respuesta.trim().length}/{MAX_RESPUESTA} · Lo que dices aquí manda sobre lo que las oficinas dedujeron del mismo tema.</p>
      {error && <p role="alert" className="mt-2 text-[12px] text-rose-300">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="submit" disabled={enviando} data-accion="guardar-dato-del-dueno" className={B_AMBAR}>{enviando ? "Guardando…" : "Guardar en el cerebro"}</button>
        <button type="button" onClick={onCancelar} disabled={enviando} className={B_SUAVE}>Cancelar</button>
        <span className="ml-auto text-[11px] text-zinc-500">Sin costo · reemplaza lo anterior del mismo tema · el siguiente empleado lo lee así</span>
      </div>
    </form>
  )
}

export function PanelCerebro({ onCerrar, datosIniciales = null, clienteInicial = null, carpetaInicial = null, fetchImpl = fetch, ahora: ahoraFija }: {
  onCerrar: () => void
  /** lectura ya hecha (pruebas) */
  datosIniciales?: CerebroDelCliente | null
  /** el cliente en el que está enfocada la oficina (lo pasa el Dept. Marketing). El explorador NO cambia de cliente: para eso está la ventana de selección */
  clienteInicial?: string | null
  /** abrir dentro de esta carpeta */
  carpetaInicial?: ClaveDeCarpeta | null
  /** cómo se llama al servidor (pruebas) */
  fetchImpl?: typeof fetch
  /** «ahora» fijo (pruebas) */
  ahora?: Date
}) {
  const [datos, setDatos] = useState<CerebroDelCliente | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [carpeta, setCarpeta] = useState<ClaveDeCarpeta | null>(carpetaInicial)
  const [fichaId, setFichaId] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<Formulario | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const cerrar = useRef<HTMLButtonElement>(null)
  const ahora = useMemo(() => ahoraFija ?? new Date(), [ahoraFija])
  const clienteId = datos?.cliente?.id ?? clienteInicial

  const leer = useCallback(async (id: string | null) => {
    setCargando(true); setError(null)
    try {
      const r = await fetchImpl(`/api/cerebro${id ? `?cliente=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Respuesta | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver el cerebro." : (j && !j.ok && j.error) || `No pude leer el cerebro (${r.status}).`)
      setDatos(j)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [fetchImpl])
  useEffect(() => { cerrar.current?.focus() }, [])
  useEffect(() => { if (!datosIniciales) void leer(clienteInicial) }, [leer, datosIniciales, clienteInicial])
  // Esc cierra lo más cercano (formulario → ficha → carpeta → el panel), en captura para que la oficina no lo reciba
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation(); e.preventDefault()
      if (formulario) setFormulario(null); else if (fichaId) setFichaId(null); else if (carpeta) setCarpeta(null); else onCerrar()
    }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar, formulario, fichaId, carpeta])

  const arbol = useMemo(() => (datos ? arbolDelCerebro(datos.fichas, { perfiles: datos.perfiles.length, preguntas: datos.preguntas.length, ahora }) : []), [datos, ahora])
  const carpetaActual: CarpetaArmada | null = carpeta ? arbol.find((k) => k.clave === carpeta) ?? null : null
  const ficha = fichaId && carpetaActual ? carpetaActual.fichas.find((f) => f.id === fichaId) ?? null : null
  const nombre = datos?.cliente?.nombre ?? "Cliente"
  const irA = (k: ClaveDeCarpeta | null) => { setCarpeta(k); setFichaId(null); setFormulario(null); setErrorForm(null) }
  const abrirFormulario = (f: Formulario) => { setFormulario(f); setErrorForm(null); setAviso(null) }
  const nuevo = () => abrirFormulario({ modo: "nuevo", tema: "", respuesta: "", sede_clave: "", pregunta: null, pregunta_id: null, temaFijo: false })
  const responder = (p: PreguntaPendiente) => abrirFormulario({ modo: "responder", tema: p.tema, respuesta: "", sede_clave: p.sede_clave ?? "", pregunta: p.pregunta || null, pregunta_id: p.id, temaFijo: true })
  const corregir = (f: FichaDelCerebro) => abrirFormulario({ modo: "corregir", tema: f.tema ?? f.titulo.replace(/^Dueño\s*·\s*/i, "").replace(/\s*·\s*sede .*$/i, ""), respuesta: f.respuesta ?? f.que_es ?? f.contenido ?? "", sede_clave: f.sede ?? "", pregunta: f.pregunta, pregunta_id: null, temaFijo: true })

  /** la escritura: `POST /api/cerebro/dueno` → la puerta del dueño de la plataforma. Al volver «ok», se relee el cerebro: la ficha nueva es la que ven las oficinas */
  async function guardar() {
    if (!formulario || !clienteId) return
    setEnviando(true); setErrorForm(null)
    try {
      const cuerpo = { client_id: clienteId, tema: formulario.tema, respuesta: formulario.respuesta, pregunta: formulario.pregunta, sede_clave: formulario.sede_clave || null, pregunta_id: formulario.pregunta_id }
      const r = await fetchImpl("/api/cerebro/dueno", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) })
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>
      if (r.ok && j.ok === true) {
        setAviso({ ok: true, texto: textoTrasGuardar(j) }); setFormulario(null); setFichaId(null); setCarpeta("dueno")
        await leer(clienteId)
      } else setErrorForm(errorTrasGuardar(r.status, j))
    } catch (e) { setErrorForm(`No se pudo contactar al servidor: ${e instanceof Error ? e.message : String(e)}`) } finally { setEnviando(false) }
  }

  const porVencer = arbol.reduce((n, k) => n + k.por_vencer, 0)
  const resumen = datos ? `${plural(datos.fichas.length, "ficha vigente", "fichas vigentes")} · ${plural(datos.trozos, "trozo", "trozos")} en el índice que consultan las oficinas${datos.retiradas ? ` · ${datos.retiradas} archivadas` : ""}${porVencer ? ` · ${porVencer} por reconfirmar` : ""}` : ""

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{ESTILO}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="cerebro-titulo" data-seccion="cerebro" className="relative flex h-full max-h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="cerebro-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Cerebro</h2>
          <p className="hidden text-[12px] text-zinc-500 md:block">Lo que el sistema sabe de {nombre}{resumen ? ` · ${resumen}` : ""}</p>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar el cerebro" className="ml-auto rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">Cerrar · Esc</button>
        </header>
        {/* la ruta, como un explorador: cliente › carpeta › ficha */}
        <nav aria-label="Dónde estás" data-ruta className="flex flex-wrap items-center gap-1 border-b border-white/10 px-4 py-2 sm:px-6">
          <button type="button" data-miga="cliente" onClick={() => irA(null)} aria-current={!carpeta ? "page" : undefined} className={`${MIGA} ${!carpeta ? "text-white" : ""}`}>{nombre}</button>
          {carpetaActual && <><Sep /><button type="button" data-miga="carpeta" onClick={() => { setFichaId(null); setFormulario(null) }} aria-current={!ficha && !formulario ? "page" : undefined} className={`${MIGA} ${!ficha && !formulario ? "text-white" : ""}`}>{carpetaActual.nombre}</button></>}
          {ficha && <><Sep /><span data-miga="ficha" className="truncate px-1.5 text-[12.5px] text-white">{ficha.titulo}</span></>}
          {formulario && <><Sep /><span data-miga="formulario" className="px-1.5 text-[12.5px] text-amber-100">{formulario.modo === "responder" ? "Responder" : formulario.modo === "corregir" ? "Corregir" : "Dato nuevo"}</span></>}
        </nav>
        {aviso && <p role="status" data-aviso={aviso.ok ? "ok" : "error"} className={`mx-4 mt-3 rounded-md border px-3 py-2 text-[12.5px] sm:mx-6 ${aviso.ok ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100" : "border-rose-500/40 bg-rose-500/10 text-rose-200"}`}>{aviso.texto}</p>}

        <div className="flex min-h-0 flex-1">
          {/* el árbol: el cliente y sus carpetas */}
          <aside className="hidden w-[250px] shrink-0 overflow-y-auto border-r border-white/10 p-3 md:block" aria-label="Carpetas del cerebro">
            <button type="button" data-nodo="cliente" onClick={() => irA(null)} aria-current={!carpeta} className="ce-nodo flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-zinc-100 hover:bg-white/[0.05]"><IconoCarpeta abierta /><span className="truncate">{nombre}</span></button>
            <ul className="mt-1 space-y-0.5 pl-4">
              {arbol.map((k) => (
                <li key={k.clave}>
                  <button type="button" data-nodo-carpeta={k.clave} onClick={() => irA(k.clave)} aria-current={carpeta === k.clave} className="ce-nodo flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-zinc-300 hover:bg-white/[0.05]">
                    <IconoCarpetaChica /><span className="min-w-0 flex-1 truncate">{k.nombre}</span>
                    <span className={`shrink-0 rounded-full px-1.5 text-[10.5px] ${k.preguntas ? "bg-amber-400/20 text-amber-200" : k.por_vencer ? "bg-rose-400/15 text-rose-200" : "bg-white/[0.06] text-zinc-400"}`}>{k.preguntas ? `${k.total} · ${k.preguntas}?` : k.total}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {error && <p role="alert" className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-200">{error}</p>}
            {cargando && !datos && <p className="text-[13px] text-zinc-400">Leyendo…</p>}
            {datos && !datos.cliente && <p className="text-[13px] text-zinc-400">No hay un cliente elegido.</p>}

            {/* nivel 1 · las carpetas */}
            {datos?.cliente && !carpeta && (
              <div data-vista="carpetas" className="ce-entra">
                <p className="mb-3 text-[12.5px] text-zinc-400">Todo lo que el sistema sabe de {nombre}, de lo que tú dijiste a lo que dicen los demás. Lo tuyo manda: corrígelo o agrégalo en «Lo que dijo el dueño».</p>
                <ul className={CUADRICULA}>
                  {arbol.map((k) => (
                    <li key={k.clave}>
                      <button type="button" data-carpeta={k.clave} onClick={() => irA(k.clave)} className={CARPETA}>
                        <IconoCarpeta />
                        <span className="text-[13.5px] font-medium leading-snug text-zinc-100">{k.nombre}</span>
                        <span className={`text-[11.5px] ${k.preguntas ? "text-amber-300" : k.por_vencer ? "text-rose-300/90" : "text-zinc-500"}`}>{k.detalle}</span>
                        <span className="text-[11px] leading-snug text-zinc-500">{k.descripcion}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* nivel 2 · dentro de una carpeta */}
            {datos?.cliente && carpetaActual && !ficha && !formulario && (
              <div data-vista="fichas" data-carpeta-abierta={carpetaActual.clave} className="ce-entra space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-[15px] font-medium text-zinc-100">{carpetaActual.nombre}</h3>
                  <span className="text-[12px] text-zinc-500">{carpetaActual.detalle} · {carpetaActual.descripcion}</span>
                  {carpetaActual.clave === "dueno" && <button type="button" data-accion="dato-nuevo" onClick={nuevo} className={`${B_AMBAR} ml-auto flex items-center gap-2`}><Lapiz />Agregar un dato</button>}
                </div>
                {carpetaActual.clave === "dueno" && datos.preguntas.length > 0 && (
                  <div data-bloque="preguntas-pendientes" className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-4">
                    <h4 className="text-[12px] uppercase tracking-[0.08em] text-amber-200">{plural(datos.preguntas.length, "pregunta espera", "preguntas esperan")} tu respuesta</h4>
                    <ul className="mt-2 space-y-2">
                      {datos.preguntas.map((p) => (
                        <li key={p.id} data-pregunta={p.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] text-zinc-100">{p.pregunta || p.tema}</p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">Tema «{p.tema}» · preguntó {p.oficina ?? "una oficina"}{p.agente ? ` (${p.agente})` : ""}{p.desde ? ` · ${diaYHora(p.desde)}` : ""}{p.sede_clave ? ` · sede ${p.sede_clave}` : ""}</p>
                          </div>
                          <button type="button" data-accion="responder-pregunta" onClick={() => responder(p)} className={`${B_CHICO} border-amber-400/60 text-amber-100`}>Responder</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {carpetaActual.clave === "ideal" ? (
                  datos.perfiles.length ? <ul className="space-y-3">{datos.perfiles.map((p) => <TarjetaDePerfil key={p.id} p={p} />)}</ul> : <p className="text-[13px] text-zinc-400">El sistema todavía no armó el perfil del cliente ideal de {nombre}.</p>
                ) : carpetaActual.fichas.length === 0 ? (
                  <p className="text-[13px] text-zinc-400">{carpetaActual.clave === "dueno" ? `Todavía no hay datos tuyos sobre ${nombre}. Agrega el primero: lo que digas aquí manda sobre lo que las oficinas dedujeron.` : `No hay fichas vigentes en «${carpetaActual.nombre}».`}</p>
                ) : (
                  porSede(carpetaActual.fichas).map((g) => (
                    <div key={g.sede ?? "_"} data-grupo-sede={g.sede ?? "sin-sede"}>
                      {datos.sedes.length >= 2 && <Titulito>{g.sede ? `Sede ${g.sede}` : "Todo el negocio"} · {plural(g.fichas.length, "ficha", "fichas")}</Titulito>}
                      <ul className={CUADRICULA}>{g.fichas.map((f) => <TarjetaDeFicha key={f.id} f={f} ahora={ahora} onAbrir={() => { setFichaId(f.id); setAviso(null) }} />)}</ul>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* el formulario del dueño */}
            {datos?.cliente && formulario && <FormularioDelDueno f={formulario} sedes={datos.sedes} enviando={enviando} error={errorForm} onCambiar={setFormulario} onEnviar={() => void guardar()} onCancelar={() => setFormulario(null)} />}

            {/* nivel 3 · la ficha */}
            {datos?.cliente && ficha && !formulario && (
              <article data-vista="ficha" data-ficha-abierta={ficha.id} className="ce-entra space-y-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 data-titulo-ficha className="text-[16px] font-medium leading-snug text-zinc-50">{ficha.titulo}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Chip>{claseLegible(ficha.clase)}</Chip>
                      <Chip tono={ficha.origen === "dueno" ? "ambar" : "neutro"}>{origenLegible(ficha.origen)}</Chip>
                      {ficha.propiedad && <Chip tono={ficha.propiedad === "ajena" ? "azul" : "neutro"}>{propiedadLegible(ficha.propiedad)}</Chip>}
                      {ficha.sede && <Chip>Sede {ficha.sede}</Chip>}
                      <Chip tono={vigenciaLegible(ficha, ahora).tono}>{vigenciaLegible(ficha, ahora).texto}</Chip>
                    </div>
                  </div>
                  {ficha.origen === "dueno" && <button type="button" data-accion="corregir-dato" onClick={() => corregir(ficha)} className={`${B_AMBAR} flex items-center gap-2`}><Lapiz />Corregir este dato</button>}
                </div>
                {ficha.origen === "dueno" ? (
                  <>
                    <Bloque titulo="Lo que dijiste" etiqueta="contenido"><p className="whitespace-pre-wrap text-[14px] text-amber-50">{ficha.respuesta ?? ficha.que_es ?? ficha.contenido ?? <span className="italic text-zinc-500">sin texto</span>}</p></Bloque>
                    {ficha.contenido && ficha.contenido !== (ficha.respuesta ?? ficha.que_es) && <Bloque titulo="Cómo lo guardó el cerebro (la cita que leen las oficinas)" etiqueta="cita"><p className="whitespace-pre-wrap text-zinc-400">{ficha.contenido}</p></Bloque>}
                  </>
                ) : (
                  <>
                    <Bloque titulo="Lo que dice" etiqueta="contenido"><p className="whitespace-pre-wrap">{ficha.contenido ?? <span className="italic text-zinc-500">sin texto</span>}</p></Bloque>
                    {ficha.que_es && <Bloque titulo="Qué es" etiqueta="que-es"><p className="whitespace-pre-wrap">{ficha.que_es}</p></Bloque>}
                  </>
                )}
                {ficha.pregunta && <Bloque titulo="La pregunta que respondía" etiqueta="pregunta"><p className="italic">«{ficha.pregunta}»</p></Bloque>}
                <div className="grid gap-3 md:grid-cols-2">
                  <Bloque titulo="De dónde salió" etiqueta="fuente">
                    <p>{origenLegible(ficha.origen)}{ficha.canal ? ` · por ${ficha.canal}` : ""}</p>
                    {ficha.fuente_url && <a href={ficha.fuente_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-[12px] text-sky-300 underline-offset-2 hover:underline">{enlaceCorto(ficha.fuente_url)}</a>}
                    <p className="mt-1 text-[11.5px] text-zinc-500">{fechaDeLaFicha(ficha) ? `Observado el ${diaYHora(fechaDeLaFicha(ficha))}` : "Sin fecha de observación"}{ficha.vigente_hasta ? ` · vigente hasta el ${diaCorto(ficha.vigente_hasta)}` : ""}</p>
                  </Bloque>
                  <Bloque titulo="Qué hizo el cerebro con esto" etiqueta="decision">
                    <p>{decisionLegible(ficha.decision)}{ficha.razon_de_decision ? ` · ${ficha.razon_de_decision}` : ""}</p>
                    {ficha.porque && <p className="mt-1 text-zinc-400">{ficha.porque}</p>}
                    {(alcanceLegible(ficha.alcance) || ficha.atributo) && <p className="mt-1 text-[11.5px] text-zinc-500">{[alcanceLegible(ficha.alcance), ficha.atributo ? `atributo ${ficha.atributo}` : null].filter(Boolean).join(" · ")}</p>}
                  </Bloque>
                </div>
                {ficha.origen !== "dueno" && <p className="text-[11.5px] text-zinc-500">Esta ficha la armó una oficina y se lee tal cual. Si está mal, dilo en «Lo que dijo el dueño»: tu dato manda sobre esta.</p>}
                <div><button type="button" onClick={() => setFichaId(null)} className={B_GRIS}>← Volver a {carpetaActual?.nombre}</button></div>
              </article>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
