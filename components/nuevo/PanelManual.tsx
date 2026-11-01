"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ManualDelCliente } from "@/lib/manual-datos"
import { CAMPOS_DEL_LECTOR, type CampoLeido } from "@/lib/manual-lector"
import { EDITABLES_DESDE_EL_TABLERO, contrasteDelTexto, cuerpoDeEdicion, esEditableDesdeElTablero, etiquetaDelHueco, fechaCortaEC, procedenciaLegible, rolDeLaLetraLegible, rolDelColorLegible, separarPropuesta, textoParaEditar } from "@/lib/manual"

const AMBAR = "#f5a524"
type Respuesta = ({ ok: true } & ManualDelCliente) | { ok: false; error: string }

const ESTILO = `
.mn-seccion{animation:mnEntra .45s cubic-bezier(.2,.8,.2,1) both}
.mn-color{transition:transform .18s ease,box-shadow .18s ease}
.mn-color:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(0,0,0,.45)}
@keyframes mnEntra{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.mn-seccion{animation:none}.mn-color{transition:none}}
`

/** los apartados del manual, en el orden en que se leen: qué es la marca · cómo habla · a quién le habla */
export const APARTADOS_DEL_MANUAL: ReadonlyArray<{ titulo: string; claves: string[] }> = [
  { titulo: "Lo que la marca es", claves: ["proposito", "mision", "vision", "valores", "eslogan", "posicionamiento", "personalidad"] },
  { titulo: "Cómo habla", claves: ["voz", "mensajes_clave", "propuestas_de_valor", "nunca"] },
  { titulo: "A quién le habla", claves: ["publico"] },
]
const LARGO_PLEGADO = 650
const esLista = (clave: string) => CAMPOS_DEL_LECTOR.find((c) => c.clave === clave)?.lista === true

/** un valor de lista guardado como «a · b · c» vuelve a ser lista para leerse como viñetas */
export function viñetasDelCampo(c: Pick<CampoLeido, "clave" | "valor">): string[] | null {
  if (!c.valor || !esLista(c.clave)) return null
  const partes = c.valor.split(" · ").map((s) => s.trim()).filter(Boolean)
  return partes.length > 1 ? partes : null
}

function Chip({ children, tono = "neutro" }: { children: React.ReactNode; tono?: "neutro" | "ambar" | "verde" }) {
  const clase = tono === "ambar" ? "border-amber-400/50 text-amber-200" : tono === "verde" ? "border-emerald-400/40 text-emerald-200" : "border-white/15 text-zinc-300"
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] ${clase}`}>{children}</span>
}

/** el cuadro de edición de un campo: lo que hay, por qué cambia, guardar. La escritura la valida el servidor del tablero y la hace la plataforma (versión nueva + cerebro). */
function Editor({ clave, valor, onGuardado, onCancelar, enviar }: { clave: string; valor: string | null; onGuardado: (r: ResultadoDeGuardado) => void; onCancelar: () => void; enviar: Enviar }) {
  const def = EDITABLES_DESDE_EL_TABLERO.find((e) => e.clave === clave)!
  const [texto, setTexto] = useState(() => textoParaEditar(clave, valor))
  const [porque, setPorque] = useState("")
  const [estado, setEstado] = useState<"quieto" | "enviando">("quieto")
  const [error, setError] = useState<string | null>(null)
  const caja = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { caja.current?.focus() }, [])
  async function guardar() {
    setError(null)
    const cuerpo = enviar.cliente ? cuerpoDeEdicion(enviar.cliente, clave, texto, porque) : { error: "No hay cliente elegido" }
    if ("error" in cuerpo) { setError(cuerpo.error); return }
    setEstado("enviando")
    const r = await enviar.accion("manual-campos", cuerpo)
    setEstado("quieto")
    if (r.ok) onGuardado(r); else setError(r.texto)
  }
  return (
    <form data-editor={clave} className="mt-1 rounded-md border border-amber-400/30 bg-black/30 p-3" onSubmit={(e) => { e.preventDefault(); void guardar() }}>
      <label className="block">
        <span className="sr-only">{def.etiqueta}</span>
        <textarea ref={caja} value={texto} onChange={(e) => setTexto(e.target.value)} rows={def.lista ? 5 : 4} maxLength={2000} aria-label={`Editar ${def.etiqueta}`}
          className="w-full resize-y rounded-md border border-white/15 bg-black/40 px-2.5 py-2 text-[13px] leading-relaxed text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400" />
      </label>
      <p className="mt-1 text-[11px] text-zinc-500">{def.ayuda} · {texto.trim().length}/2000</p>
      <label className="mt-2 block">
        <span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-zinc-500">¿Por qué cambia? (opcional · el sistema aprende de esto)</span>
        <input value={porque} onChange={(e) => setPorque(e.target.value)} maxLength={1000} className="w-full rounded-md border border-white/15 bg-black/40 px-2.5 py-1.5 text-[12.5px] text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400" />
      </label>
      {error && <p role="alert" className="mt-2 text-[12px] text-rose-300">{error}</p>}
      <div className="mt-2 flex items-center gap-2">
        <button type="submit" disabled={estado === "enviando"} data-accion="guardar-campo" className="rounded-md border border-amber-400/70 bg-amber-400/15 px-3 py-1.5 text-[12px] text-amber-100 transition hover:bg-amber-400/25 disabled:opacity-50">{estado === "enviando" ? "Guardando…" : "Guardar en el sistema"}</button>
        <button type="button" onClick={onCancelar} disabled={estado === "enviando"} className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-zinc-400 hover:bg-white/[0.05]">Cancelar</button>
        <span className="ml-auto text-[11px] text-zinc-500">Crea una versión nueva · el siguiente empleado la lee</span>
      </div>
    </form>
  )
}

type ResultadoDeGuardado = { ok: true; texto: string; detalle: Record<string, unknown> } | { ok: false; texto: string }
interface Enviar { cliente: string | null; accion: (nombre: string, cuerpo: Record<string, unknown>) => Promise<ResultadoDeGuardado> }

/** una llamada a `POST /api/acciones/<nombre>` dicha con franqueza: hecho (con lo que dijo la plataforma), no disponible, o por qué falló */
export async function llamarAccion(nombre: string, cuerpo: Record<string, unknown>, fetchImpl: typeof fetch = fetch): Promise<ResultadoDeGuardado> {
  try {
    const r = await fetchImpl(`/api/acciones/${encodeURIComponent(nombre)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) })
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>
    if (r.ok && j.ok) return { ok: true, texto: "Guardado", detalle: (j.resultado ?? {}) as Record<string, unknown> }
    const texto = r.status === 501 ? "Todavía no está disponible: la plataforma aún no tiene esta acción. No se cambió nada." : r.status === 401 ? "Tu sesión venció: entra de nuevo." : r.status === 409 ? `Otra decisión se adelantó: recarga. ${String(j.detalle ?? "")}` : `No se pudo: ${String(j.detalle ?? j.error ?? r.status)}`
    return { ok: false, texto }
  } catch (e) { return { ok: false, texto: `No se pudo: ${e instanceof Error ? e.message : String(e)}` } }
}

/** lo que se le dice a Emilio después de guardar: versión nueva y si el cerebro ya lo tiene */
export function resumenDelGuardado(d: Record<string, unknown>): string {
  const v = d.version_nueva != null ? `versión ${String(d.version_nueva)} guardada` : "guardado"
  const c = (d.cerebro && typeof d.cerebro === "object" ? d.cerebro : {}) as { indice?: unknown; enviados?: unknown; pendientes?: unknown }
  const pend = Array.isArray(c.pendientes) ? c.pendientes.length : 0
  const env = Array.isArray(c.enviados) ? c.enviados.length : 0
  const cerebro = pend ? `el cerebro recibió ${env} y quedan ${pend} pendientes` : env ? "el cerebro ya lo tiene: el siguiente empleado lo lee así" : c.indice === "sin_cambios" ? "sin cambios" : "el cerebro lo recibe en breve"
  return `${v[0].toUpperCase()}${v.slice(1)} · ${cerebro}`
}

function Campo({ c: crudo, opciones = [], enviar, editando, onEditar, onGuardado }: { c: CampoLeido; /** opciones de eslogan cuando el eslogan aún no está decidido */ opciones?: string[]; enviar: Enviar; editando: boolean; onEditar: (clave: string | null) => void; onGuardado: (r: ResultadoDeGuardado) => void }) {
  const sep = separarPropuesta(crudo.valor)
  const c: CampoLeido = sep.propuesta ? { ...crudo, valor: sep.valor, estado: "propuesta" } : crudo
  const viñetas = viñetasDelCampo(c)
  const largo = !!c.valor && !viñetas && c.valor.length > LARGO_PLEGADO
  const opcionesLeidas = c.valor ? [] : opciones.map((o) => separarPropuesta(o)).filter((o): o is { valor: string; propuesta: boolean } => !!o.valor)
  const editable = esEditableDesdeElTablero(c.clave)
  return (
    <div data-campo={c.clave} data-estado={c.estado} data-editable={editable} className="group/campo border-t border-white/[0.06] py-3 first:border-t-0 first:pt-0">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h4 className="text-[11px] uppercase tracking-[0.08em] text-zinc-500">{c.etiqueta}</h4>
        {c.estado === "propuesta" && <Chip tono="ambar">propuesta del agente · sin validar</Chip>}
        {c.origen === "dueno" && <Chip tono="verde">escrito por el dueño</Chip>}
        {c.origen === "aceptado" && <Chip>aceptado por el dueño</Chip>}
        {editable && !editando && (
          <button type="button" data-accion="editar-campo" data-campo-editar={c.clave} onClick={() => onEditar(c.clave)} aria-label={`Editar ${c.etiqueta}`} title="Editar"
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400 transition hover:border-amber-400/60 hover:text-amber-200 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
            <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden><path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>Editar
          </button>
        )}
        {!editable && <span className="ml-auto text-[10.5px] text-zinc-600" title="La plataforma todavía no acepta este campo desde el tablero">se edita en el próximo paso</span>}
      </div>
      {editando && <Editor clave={c.clave} valor={c.valor} enviar={enviar} onCancelar={() => onEditar(null)} onGuardado={onGuardado} />}
      {!editando && !c.valor && <p className="text-[13px] italic text-amber-200/80">{c.nota ?? "Sin dato"}</p>}
      {!editando && c.valor && viñetas && <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-zinc-200">{viñetas.map((v, i) => <li key={i}>{v}</li>)}</ul>}
      {!editando && c.valor && !viñetas && !largo && <p className="whitespace-pre-line text-[13px] leading-relaxed text-zinc-200">{c.valor}</p>}
      {!editando && c.valor && !viñetas && largo && (
        <details className="group">
          <summary className="cursor-pointer list-none whitespace-pre-line text-[13px] leading-relaxed text-zinc-200 group-open:hidden">{c.valor.slice(0, LARGO_PLEGADO).trimEnd()}… <span className="text-amber-300">Leer todo</span></summary>
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-zinc-200">{c.valor}</p>
        </details>
      )}
      {c.explicacion && <details className="mt-1 text-[11.5px] text-zinc-500"><summary className="cursor-pointer">Por qué se propone</summary><p className="mt-1">{c.explicacion}</p></details>}
      {opcionesLeidas.length > 0 && (
        <div className="mt-2" data-opciones={c.clave}>
          <h5 className="mb-1 text-[11px] text-zinc-500">Opciones de eslogan · sin decidir</h5>
          <ul className="space-y-1">{opcionesLeidas.map((o, i) => <li key={i} className="flex flex-wrap items-center gap-2 text-[13px] text-zinc-200"><span>«{o.valor}»</span>{o.propuesta ? <Chip tono="ambar">propuesta del agente</Chip> : <Chip tono="verde">dicho por el cliente</Chip>}</li>)}</ul>
        </div>
      )}
    </div>
  )
}

export function PanelManual({ onCerrar, datosIniciales = null, clienteInicial = null, accion = llamarAccion }: { onCerrar: () => void; datosIniciales?: ManualDelCliente | null; /** abrir con este cliente (el harness local lo usa) */ clienteInicial?: string | null; /** cómo se envían las acciones (pruebas) */ accion?: typeof llamarAccion }) {
  const [datos, setDatos] = useState<ManualDelCliente | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [cliente, setCliente] = useState<string | null>(datosIniciales?.cliente?.id ?? clienteInicial)
  const [editando, setEditando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [validando, setValidando] = useState<"quieto" | "confirmar" | "enviando">("quieto")
  const cerrar = useRef<HTMLButtonElement>(null)

  useEffect(() => { cerrar.current?.focus() }, [])
  // Esc cierra el manual y NO la oficina: se atiende en captura y se detiene ahí
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onCerrar() } }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar])

  const leer = useCallback(async (id: string | null) => {
    setCargando(true); setError(null)
    try {
      const r = await fetch(`/api/manual${id ? `?cliente=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Respuesta | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver el manual." : (j && !j.ok && j.error) || `No pude leer el manual (${r.status}).`)
      setDatos(j); setCliente(j.cliente?.id ?? null)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [])
  useEffect(() => { if (!datosIniciales) void leer(clienteInicial) }, [leer, datosIniciales, clienteInicial])

  const enviar: Enviar = { cliente, accion }
  // después de guardar: se dice qué pasó y se vuelve a leer (la versión nueva es la que verá el siguiente empleado)
  const guardado = (r: ResultadoDeGuardado) => { setEditando(null); setAviso(r.ok ? { ok: true, texto: resumenDelGuardado(r.detalle) } : { ok: false, texto: r.texto }); if (r.ok) void leer(cliente) }
  async function validar() {
    if (!cliente) return
    setValidando("enviando"); setAviso(null)
    const r = await accion("manual-validar", { client_id: cliente })
    setValidando("quieto")
    if (r.ok) { const d = r.detalle; setAviso({ ok: true, texto: d.sin_cambios ? "Ya estaba validado por ti." : `Validado por ti · versión ${String(d.version_nueva ?? "nueva")} · el siguiente empleado lo lee como tuyo` }); void leer(cliente) } else setAviso({ ok: false, texto: r.texto })
  }

  const m = datos?.manual ?? null
  const campos = new Map((m?.lector.campos ?? []).map((c) => [c.clave, c]))
  const faltan = m ? m.lector.huecos.map(etiquetaDelHueco) : []

  return (
    <div className="nv-panel fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{ESTILO}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="manual-titulo" data-seccion="manual" className="relative flex max-h-full w-full max-w-[1280px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="manual-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Manual de marca</h2>
          <p className="hidden text-[12px] text-zinc-500 md:block">Lo que la marca es, cómo habla y cómo se ve · se edita aquí</p>
          <label className="ml-auto flex items-center gap-2 text-[12px] text-zinc-400">
            <span>Cliente</span>
            <select value={cliente ?? ""} onChange={(e) => void leer(e.target.value || null)} disabled={!datos || cargando} aria-label="Elegir el cliente"
              className="rounded-md border border-white/10 bg-[#111] px-2 py-1 text-[13px] text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
              {(datos?.clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.con_manual ? "" : " · sin manual"}</option>)}
              {!datos && <option value="">Leyendo…</option>}
            </select>
          </label>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </header>

        {error && <p role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[13px] text-rose-200 sm:px-6">{error}</p>}
        {aviso && <p role="status" data-aviso={aviso.ok ? "ok" : "error"} className={`border-b px-4 py-2 text-[13px] sm:px-6 ${aviso.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-rose-500/30 bg-rose-500/10 text-rose-200"}`}>{aviso.texto}</p>}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {!datos && !error && <p className="text-[13px] text-zinc-500">Leyendo el manual…</p>}
          {datos && !m && <p className="text-[13px] text-zinc-400">{datos.cliente ? `${datos.cliente.nombre} todavía no tiene manual de marca.` : "No hay clientes para mostrar."}</p>}
          {datos && m && (
            <>
              {/* la portada: quién es, qué versión, quién lo validó, qué falta */}
              <section aria-label="La portada del manual" className="mn-seccion mb-5 rounded-lg border border-white/10 bg-black/30 p-4 sm:p-5">
                <h3 className="font-display text-[24px] font-semibold leading-tight tracking-tight text-zinc-50">{datos.cliente?.nombre}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Chip>{m.version != null ? `versión ${m.version}` : "sin versión"}{m.versiones > 1 ? ` · ${m.versiones} versiones` : ""}</Chip>
                  <Chip tono={m.lector.validadoPor === "propuesta" ? "ambar" : "verde"}>{m.lector.rotulo}</Chip>
                  <Chip tono={m.lector.completo ? "neutro" : "ambar"}>{m.lector.completo ? (m.lector.rotuloVisual ?? "Completo") : `Incompleto · faltan ${faltan.length}`}</Chip>
                  <Chip>{m.fidelidad}</Chip>
                  {m.origen && <Chip>{m.origen}</Chip>}
                </div>
                {!m.lector.completo && faltan.length > 0 && <p className="mt-2 text-[12px] text-amber-200/80">Falta: {faltan.join(" · ")}</p>}
                {m.lector.validadoPor !== "dueno" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {validando !== "confirmar" ? (
                      <button type="button" data-accion="validar-manual" onClick={() => setValidando("confirmar")} disabled={validando === "enviando"} className="rounded-md border border-white/15 px-3 py-1.5 text-[12px] text-zinc-200 transition hover:border-amber-400/60 hover:text-amber-100 disabled:opacity-50">{validando === "enviando" ? "Validando…" : "Validar el manual"}</button>
                    ) : (
                      <>
                        <span className="text-[12px] text-zinc-300">Validar significa que tú das este manual por bueno: la oficina creativa y la planeación lo leerán como tuyo.</span>
                        <button type="button" data-accion="confirmar-validar" onClick={() => void validar()} className="rounded-md border border-amber-400/70 bg-amber-400/15 px-3 py-1.5 text-[12px] text-amber-100 hover:bg-amber-400/25">Sí, validar</button>
                        <button type="button" onClick={() => setValidando("quieto")} className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-zinc-400 hover:bg-white/[0.05]">Cancelar</button>
                      </>
                    )}
                  </div>
                )}
                <p className="mt-2 text-[11.5px] text-zinc-500">{m.actualizado_en ? `Última actualización ${fechaCortaEC(m.actualizado_en)}` : ""}{m.creado_en ? ` · creado ${fechaCortaEC(m.creado_en)}` : ""}</p>
              </section>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
                <div className="min-w-0 space-y-5">
                  {APARTADOS_DEL_MANUAL.map((ap, i) => {
                    // un campo opcional vacío el lector no lo muestra; si se puede editar desde aquí, se muestra vacío con su botón (si no, no habría cómo escribirlo)
                    const vacio = (k: string): CampoLeido | null => { const d = CAMPOS_DEL_LECTOR.find((x) => x.clave === k); return d && esEditableDesdeElTablero(k) ? { clave: k, etiqueta: d.etiqueta, valor: null, estado: "hueco", nota: "Sin dato todavía: escríbelo aquí", explicacion: null, origen: null } : null }
                    const lista = ap.claves.map((k) => campos.get(k) ?? vacio(k)).filter((c): c is CampoLeido => !!c)
                    if (!lista.length) return null
                    return (
                      <section key={ap.titulo} aria-label={ap.titulo} className="mn-seccion rounded-lg border border-white/10 bg-white/[0.02] p-4" style={{ animationDelay: `${60 + i * 60}ms` }}>
                        <h3 className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em]" style={{ color: AMBAR }}>{ap.titulo}</h3>
                        {lista.map((c) => <Campo key={c.clave} c={c} opciones={c.clave === "eslogan" ? m.opciones_eslogan : []} enviar={enviar} editando={editando === c.clave} onEditar={setEditando} onGuardado={guardado} />)}
                      </section>
                    )
                  })}

                  {(m.palabras_prohibidas.length > 0 || m.terminos_propios.length > 0 || m.politica_competidores) && (
                    <section aria-label="Palabras" className="mn-seccion rounded-lg border border-white/10 bg-white/[0.02] p-4" style={{ animationDelay: "240ms" }}>
                      <h3 className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em]" style={{ color: AMBAR }}>Palabras</h3>
                      {m.terminos_propios.length > 0 && (
                        <div className="mb-3"><h4 className="mb-1.5 text-[11px] uppercase tracking-[0.08em] text-zinc-500">Términos propios · se usan</h4>
                          <ul className="flex flex-wrap gap-1.5">{m.terminos_propios.map((t) => <li key={t} className="rounded-md border border-emerald-400/25 bg-emerald-400/[0.06] px-2 py-0.5 text-[12px] text-emerald-100">{t}</li>)}</ul></div>
                      )}
                      {m.palabras_prohibidas.length > 0 && (
                        <div className="mb-3"><h4 className="mb-1.5 text-[11px] uppercase tracking-[0.08em] text-zinc-500">Palabras prohibidas · nunca</h4>
                          <ul className="flex flex-wrap gap-1.5">{m.palabras_prohibidas.map((t) => <li key={t} className="rounded-md border border-rose-400/25 bg-rose-400/[0.06] px-2 py-0.5 text-[12px] text-rose-100 line-through decoration-rose-300/60">{t}</li>)}</ul></div>
                      )}
                      {m.politica_competidores && <p className="text-[12.5px] text-zinc-300"><span className="text-zinc-500">Competencia · </span>{m.politica_competidores}</p>}
                    </section>
                  )}
                </div>

                {/* la identidad visual: colores y letras con su procedencia */}
                <aside aria-label="Identidad visual" className="mn-seccion space-y-5 lg:sticky lg:top-0 lg:self-start" style={{ animationDelay: "120ms" }}>
                  <section className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                    <h3 className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em]" style={{ color: AMBAR }}>Colores</h3>
                    {m.colores.length === 0 ? <p className="text-[12.5px] italic text-zinc-500">Sin colores observados todavía.</p> : (
                      <ul className="grid grid-cols-3 gap-2" aria-label="La paleta">
                        {m.colores.map((c, i) => (
                          <li key={`${c.hex}-${i}`} className="min-w-0">
                            <div className="mn-color flex aspect-square items-end rounded-lg p-1.5 ring-1 ring-white/10" style={{ background: c.hex }} data-color={c.hex} title={procedenciaLegible(c.procedencia) ?? undefined}>
                              <span className="font-mono text-[10px]" style={{ color: contrasteDelTexto(c.hex) }}>{c.hex}</span>
                            </div>
                            <p className="mt-1 truncate text-[11px] text-zinc-400">{rolDelColorLegible(c.rol)}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                    {m.colores[0]?.procedencia && <p className="mt-2 text-[11px] text-zinc-500">Tomados {procedenciaLegible(m.colores[0].procedencia)}.</p>}
                  </section>
                  <section className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                    <h3 className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em]" style={{ color: AMBAR }}>Letras</h3>
                    {m.tipografias.length === 0 ? <p className="text-[12.5px] italic text-zinc-500">{m.lector.rotuloVisual ? "Sin letra observada en el sitio." : "Sin tipografías observadas todavía."}</p> : (
                      <ul className="space-y-2">
                        {m.tipografias.map((t, i) => (
                          <li key={`${t.familia}-${i}`} className="flex items-baseline justify-between gap-3 border-t border-white/[0.06] pt-2 first:border-t-0 first:pt-0">
                            <span className="text-[16px] text-zinc-100" style={{ fontFamily: `"${t.familia}", system-ui, sans-serif` }}>{t.familia}</span>
                            <span className="shrink-0 text-[11px] text-zinc-500">{rolDeLaLetraLegible(t.rol)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </aside>
              </div>
            </>
          )}
        </div>
        <footer className="border-t border-white/10 px-4 py-2 text-[11.5px] text-zinc-500 sm:px-6">Cada «Guardar» crea una versión nueva del manual en el sistema y la manda al cerebro: el siguiente empleado la lee actualizada. Los campos sin «Editar» se habilitan cuando la plataforma los acepte.</footer>
      </section>
    </div>
  )
}
