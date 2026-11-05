"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BajaParaFirmar, EditorDeCifra, type VerCambio } from "@/components/nuevo/EditorDeCifra"
import { PanelPlan } from "@/components/nuevo/PanelPlan"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import { PanelGranIdea } from "@/components/nuevo/PanelGranIdea"
import { Acciones, Aviso, BOTON_PRINCIPAL, BOTON_SECUNDARIO, PanelBase, Paginas, Pares, Recuadros, Rotulo } from "@/components/nuevo/EstiloBase"
import {
  NOMBRE_DEL_TIPO, TOPE_MOTIVO, TOPE_RESPUESTA, accionesDe, costoDeLaDecision, dondeSeDecide, faltaQueLeer, textoDeCifra, gruposDeDecisiones, haceCuanto, nombreDeOficina, prioridadLegible, tituloDeDecision,
  type AccionDeDecision, type Decision, type Decisiones,
} from "@/lib/direccion-decisiones"
import type { PasoDelRegistro, ResultadoDeContestar } from "@/lib/decisiones-contestar"
import { HORA_24 } from "@/lib/formato"

/**
 * TU OFICINA · DECISIONES (6.20 · la mesa del director): todo lo que espera la firma de Emilio, de cualquier departamento.
 * ESTILO BASE aprobado por Emilio el 05-nov (guía zr-vault `00-meta/ESTILO-DASHBOARD.md`, imagen `APROBADO-concepto.png`):
 *  - arriba, los recuadros con el número: ESPERAN (tu firma) y DETENIDAS (tienen un trabajo parado); lo que se atiende fuera o está en pausa, en su propio
 *    recuadro. Los recuadros SON los filtros: no hay pestañas ni índice por tipo.
 *  - una tarjeta por decisión, siempre en el mismo orden: quién (CUENTA / cliente · DEPARTAMENTO / oficina) → propuesta o pregunta → aviso → para qué →
 *    acciones (el botón principal, ámbar y único, a la derecha). Se pasa de una a otra con «‹ 1 de N ›» o las flechas del teclado.
 * Lo que se contesta aquí se contesta en la misma tarjeta (04-nov): responder o descartar una pregunta, firmar, cambiar una cifra antes de firmar (05-nov).
 * Al contestar, la decisión sale de todas partes a la vez y queda su registro; si no salió, la tarjeta se queda con el motivo.
 * «Decidir» abre en el mismo lugar el panel nuevo donde esa decisión se toma (plan · gran idea · piezas); lo que no tiene panel lo dice, sin botón falso.
 * Datos: `/api/direccion/decisiones`. Si la lista está incompleta, nunca dice «nada pendiente».
 */
type Respuesta = ({ ok: true } & Decisiones) | { ok: false; error: string }

/** de qué parte de la empresa viene cada decisión (la tabla de origen, en palabras de negocio) */
const ORIGEN: Record<string, string> = {
  hitl_queue: "Bandeja de revisión", finanzas_tableros: "Oficina financiera", finanzas_preguntas: "Oficina financiera",
  cerebro_dueno_preguntas: "El cerebro del cliente", plan_aprobaciones: "Oficina de planeación",
}
/** el departamento en una o dos palabras (rótulo fijo DEPARTAMENTO / valor) */
const DEPARTAMENTO: Record<string, string> = {
  hitl_queue: "Revisión", finanzas_tableros: "Financiero", finanzas_preguntas: "Financiero", cerebro_dueno_preguntas: "Cerebro", plan_aprobaciones: "Planeación",
}
export function departamentoDe(d: Pick<Decision, "tipo" | "fuente" | "pregunta_de">): string {
  if (d.tipo === "firma_de_finanzas" || d.tipo === "pregunta_de_finanzas") return "Financiero"
  if (d.pregunta_de) { const o = nombreDeOficina(d.pregunta_de.oficina).replace(/^Oficina (de |del )?/i, ""); return o === "financiera" ? "Financiero" : o.charAt(0).toLocaleUpperCase("es") + o.slice(1) }
  return DEPARTAMENTO[d.fuente ?? ""] ?? NOMBRE_DEL_TIPO[d.tipo].nombre
}
const fecha = (iso: string | null) => { if (!iso) return null; const t = new Date(iso); return Number.isNaN(t.getTime()) ? null : t.toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" }) }
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
/** 6.52 · «Zero Risk Seguridad Industrial» → «Zero Risk SI» (nombres largos en un rótulo corto) */
export const clienteCorto = (c: string): string => { const w = c.trim().split(/\s+/); return w.length > 3 ? `${w.slice(0, 2).join(" ")} ${w.slice(2).map((x) => x[0]?.toLocaleUpperCase("es") ?? "").join("")}` : c }
/** el grupo que se mira: lo que espera tu firma, lo que tiene un trabajo detenido, lo que se atiende fuera, o lo de un cliente en pausa */
type Grupo = "firma" | "detienen" | "fuera" | `pausa:${string}`

/** 04-nov · lo que pasó con una decisión que contestaste (el registro de su detalle) */
export interface Contestada { d: Decision; resultado: ResultadoDeContestar; accion: AccionDeDecision; en: string }
const hora = (iso: string | null) => { if (!iso) return null; const t = new Date(iso); return Number.isNaN(t.getTime()) ? null : t.toLocaleTimeString("es-EC", { ...HORA_24 }) }
/** el punto de cada paso del registro: alarma solo si falló; oro lo que hiciste tú; lo demás, apagado */
const PUNTO_DEL_PASO: Record<PasoDelRegistro["estado"], string> = { pregunto: "bg-apagado", respondiste: "bg-oro", firmaste: "bg-oro", descartaste: "bg-oro", guardado: "bg-hueso", retomado: "bg-hueso", espera: "bg-apagado", fallo: "bg-alarma" }

/** el registro de una decisión: qué preguntó la oficina, qué hiciste tú y qué hizo el sistema después */
function Registro({ c, onCerrar }: { c: Contestada; onCerrar: () => void }) {
  return (
    <section data-registro aria-label="Registro de la decisión" className="rounded-tarjeta border border-linea bg-grafito-2 p-6">
      <Rotulo className="text-center">Registro</Rotulo>
      <p className="mt-2 text-center text-cuerpo font-medio text-hueso">{tituloDeDecision(c.d)}</p>
      <ol className="mt-5 border-l border-linea pl-5">
        {c.resultado.registro.map((p, k) => (
          <li key={k} data-paso={p.estado} className="relative mb-4">
            <span aria-hidden className={`absolute -left-[24px] top-1.5 h-[7px] w-[7px] rounded-full ${PUNTO_DEL_PASO[p.estado]}`} />
            <p className="text-rotulo uppercase tracking-rotulo text-gris">{[hora(p.cuando), p.quien === "tu" ? "tú" : p.quien === "oficina" ? "la oficina" : "el sistema"].filter(Boolean).join(" · ")}</p>
            <p className="mt-0.5 text-dato text-hueso">{p.texto}</p>
            {p.cita && <q className="mt-1.5 block border-l border-linea-oro pl-2.5 text-dato text-gris [quotes:none]">{p.cita}</q>}
          </li>
        ))}
      </ol>
      {c.resultado.sale
        ? <><Rotulo className="text-center">Ya no aparece en</Rotulo>
          <p data-donde className="mt-1.5 text-center text-dato text-gris">{c.d.tipo === "pregunta_al_dueno" ? "Tu oficina · la oficina que preguntó · la antena · el contador de arriba" : "Tu oficina · el contador de arriba"}. Todos leen el mismo registro: al contestar aquí, sale de todos a la vez.</p></>
        : c.resultado.motivo ? <Aviso rotulo="No salió"><span data-motivo-registro>{c.resultado.motivo}</span></Aviso> : null}
      <Acciones><button type="button" data-cerrar-registro onClick={onCerrar} className={BOTON_SECUNDARIO}>Volver</button></Acciones>
    </section>
  )
}

/** la tarjeta del frente: todo lo que hace falta para decidir, en palabras de negocio; lo que se contesta aquí, se contesta en la misma tarjeta */
export function TarjetaDelFrente({ d, alDecidir, enPausa, detiene, contestar, verCambio, previa }: {
  d: Decision; alDecidir: (d: Decision) => void; enPausa: string | null; detiene: boolean
  contestar: (d: Decision, accion: AccionDeDecision, texto: { respuesta?: string; motivo?: string; cambio?: { clave: string; firmado: number } }) => Promise<ResultadoDeContestar | null>
  verCambio: (d: Decision, clave: string, firmado: number) => ReturnType<VerCambio>
  /** lo que pasó la última vez que se contestó esta decisión (si no salió, se muestra el motivo) */
  previa: Contestada | null
}) {
  const pr = prioridadLegible(d.prioridad), donde = dondeSeDecide(d), acciones = accionesDe(d)
  const [respuesta, setRespuesta] = useState(previa?.accion === "responder" ? (previa.resultado.registro.find((p) => p.cita)?.cita ?? "") : "")
  const [descartando, setDescartando] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [enviando, setEnviando] = useState<AccionDeDecision | null>(null)
  const [cambiando, setCambiando] = useState<string | null>(null) // la cifra que Emilio está cambiando: una a la vez, porque la meta y el presupuesto están atados
  const cifraEnCambio = d.cifras?.find((c) => c.clave === cambiando && c.editable) ?? null
  const fallo = previa && !previa.resultado.sale ? previa.resultado.motivo ?? previa.resultado.texto : null
  const destraba = d.destraba ?? (d.tipo === "pregunta_al_dueno" && detiene ? `El plan de 90 días${d.cliente ? ` de ${d.cliente}` : ""} sigue en cuanto contestes sus preguntas.` : null)
  const hacer = async (a: AccionDeDecision, t: { respuesta?: string; motivo?: string; cambio?: { clave: string; firmado: number } }) => { setEnviando(a); try { return await contestar(d, a, t) } finally { setEnviando(null) } }
  const contestable = acciones.length > 0
  const falta = faltaQueLeer(d)
  const editables = acciones.includes("editar") ? (d.cifras ?? []).filter((c) => c.editable) : []
  // lo que no salió se lee sin bajar (CC6 · #283)
  const porQue = useRef<HTMLDivElement>(null)
  const pie = useRef<HTMLElement>(null) // Firmar no va fijo: se llega a él pasando por las cifras y por lo que sigue abierto (CC6 · #283)
  useEffect(() => { if (fallo) porQue.current?.scrollIntoView({ block: "center", behavior: "smooth" }) }, [fallo, previa?.en, cifraEnCambio])
  const estado = falta ? <span data-chip="falta">Falta información</span>
    : fallo ? <span data-chip="volvio" className="inline-flex items-center gap-1.5 text-alarma"><span aria-hidden className="h-[7px] w-[7px] rounded-full bg-alarma" />No salió</span>
    : detiene ? <span data-chip="detiene" className="inline-flex items-center gap-1.5 text-oro"><span aria-hidden className="h-[7px] w-[7px] rounded-full bg-oro" />Detiene el plan</span>
    : pr.nivel === 3 ? <span data-prioridad={pr.nivel} className="text-oro">Prioridad {pr.texto.toLocaleLowerCase("es")}</span>
    : null // como en la imagen aprobada: la línea de arriba solo aparece cuando hay algo que avisar
  return (
    <article data-decision={d.id} data-tipo={d.tipo} data-fallo={fallo ? "si" : undefined} className="flex flex-col rounded-tarjeta border border-linea bg-grafito-2 p-6 text-center">
      {estado && <p data-estado className="mb-4 flex flex-wrap items-center justify-center gap-x-2 text-rotulo uppercase tracking-rotulo text-gris">{estado}</p>}
      <div><Pares valor="text-cuerpo font-medio" pares={[
        { rotulo: "Cuenta", valor: <span data-cliente>{d.cliente ? clienteCorto(d.cliente) : "Sin cliente"}</span> },
        { rotulo: "Departamento", valor: <span data-departamento>{departamentoDe(d)}</span> },
      ]} /></div>
      {enPausa && <p data-en-pausa className="mt-3 text-dato text-gris">{enPausa} está en pausa por tu decisión: esto no cuenta en «esperan».</p>}
      {!d.cifras?.length && <h3 data-titulo className="mt-5 text-cuerpo font-medio text-hueso">{tituloDeDecision(d)}</h3>}
      {fallo && !cifraEnCambio && <div ref={porQue} data-por-que-volvio role="status"><Aviso rotulo="No salió">{fallo}</Aviso></div>}
      {cifraEnCambio ? <EditorDeCifra cifra={cifraEnCambio} todas={d.cifras ?? []} alEditar={d.al_editar ?? null} criticos={d.criticos ?? []} ver={(firmado) => verCambio(d, cifraEnCambio.clave, firmado)} firmar={(firmado) => hacer("editar", { cambio: { clave: cifraEnCambio.clave, firmado } })} volver={() => setCambiando(null)} /> : d.cifras?.length ? (
        <div data-cifras className="mt-5">
          <Rotulo tono="gris">Propuesta</Rotulo>
          <div className={`mt-3 grid gap-3 ${d.cifras.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {d.cifras.map((c) => {
              const cuerpo = <><span className="block whitespace-nowrap text-cifra font-medio [font-variant-numeric:tabular-nums] text-hueso">{textoDeCifra(c)}</span><span className="mt-1 block text-rotulo uppercase tracking-rotulo text-gris">{c.nombre}</span>{c.nota && <span className="mt-1 block text-dato text-gris">{c.nota}</span>}</>
              return editables.some((x) => x.clave === c.clave)
                ? <div key={c.clave} data-cifra={c.clave}><button type="button" data-cambiar={c.clave} disabled={!!enviando} onClick={() => setCambiando(c.clave)} aria-label={`Cambiar ${c.nombre}`} className="zr-apagable block min-h-11 w-full rounded-tarjeta border border-linea bg-grafito px-2 py-4 hover:border-linea-oro focus-visible:outline focus-visible:outline-1 focus-visible:outline-oro">{cuerpo}</button></div>
                : <div key={c.clave} data-cifra={c.clave} className="rounded-tarjeta border border-linea bg-grafito px-2 py-4">{cuerpo}</div>
            })}
          </div>
        </div>
      ) : null}
      {!cifraEnCambio && d.criticos?.length ? <div data-criticos><Aviso rotulo="Sigue abierto"><ul className="space-y-1">{d.criticos.map((c) => <li key={c}>{c}</li>)}</ul></Aviso></div> : null}
      {!cifraEnCambio && (d.para_que || destraba) && (
        <div data-contexto className="mt-4"><Pares valor="text-dato" pares={[
          ...(d.para_que ? [{ rotulo: "Uso", valor: d.para_que }] : []),
          ...(destraba ? [{ rotulo: "Desbloquea", valor: <span data-destraba>{destraba}</span> }] : []),
        ]} /></div>
      )}
      {falta && <div data-falta-informacion role="status"><Aviso rotulo="Nada que firmar">Falta información: la Oficina financiera debe mandar las cifras que propone.</Aviso></div>}
      {!contestable && !falta && (
        <div className="mt-5 space-y-4">
          <Pares valor="text-dato" pares={[
            { rotulo: "Espera", valor: <span data-espera>{haceCuanto(d.desde)}</span>, dato: fecha(d.desde) ?? undefined },
            { rotulo: "Vence", valor: <span data-vence>{d.vence ? `${fecha(d.vence)}${d.vencida ? " · vencida" : ""}` : "Sin fecha límite"}</span> },
          ]} />
          <Pares valor="text-dato" pares={[
            { rotulo: "Origen", valor: <span data-origen>{ORIGEN[d.fuente ?? ""] ?? "Sin dato"}</span> },
            { rotulo: "Costó producirlo", valor: <span data-costo title={d.costo_nota ?? undefined}>{costoDeLaDecision(d)}</span> },
          ]} />
        </div>
      )}
      {acciones.includes("responder") && (
        <label className="mt-5 block text-left">
          <span className="sr-only">Tu respuesta</span>
          <textarea data-respuesta value={respuesta} onChange={(e) => setRespuesta(e.target.value)} maxLength={TOPE_RESPUESTA} rows={3} placeholder="Escribe tu respuesta…" disabled={!!enviando}
            className="block w-full resize-y rounded-control border border-linea bg-carbon px-4 py-3 text-cuerpo text-hueso placeholder:text-gris focus:border-linea-oro focus:outline-none" />
        </label>
      )}
      {descartando && (
        <div data-descartar className="mt-3 text-left">
          <input data-motivo value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={TOPE_MOTIVO} placeholder="Por qué (opcional)" className="min-h-11 w-full rounded-control border border-linea bg-carbon px-4 text-cuerpo text-hueso placeholder:text-gris focus:border-linea-oro focus:outline-none" />
          <Acciones>
            <button type="button" onClick={() => setDescartando(false)} className={BOTON_SECUNDARIO}>Volver</button>
            <button type="button" data-confirmar-descartar disabled={!!enviando} onClick={() => void hacer("descartar", { motivo })} className={BOTON_SECUNDARIO}>{enviando === "descartar" ? "Descartando…" : "Descartar"}</button>
          </Acciones>
        </div>
      )}
      {!cifraEnCambio && acciones.includes("aceptar") && <BajaParaFirmar hasta={pie} />}
      {!cifraEnCambio && <footer ref={pie} data-pie>
        {(contestable && !descartando) && (
          <Acciones>
            {acciones.includes("descartar") && <button type="button" data-descartar-abrir disabled={!!enviando} onClick={() => setDescartando(true)} className={BOTON_SECUNDARIO}>Descartar</button>}
            {editables.length > 0 && <button type="button" data-cambiar-cifra disabled={!!enviando} onClick={() => setCambiando(editables[0].clave)} className={BOTON_SECUNDARIO}>Cambiar cifra</button>}
            {acciones.includes("responder") && <button type="button" data-enviar disabled={!!enviando || !respuesta.trim()} onClick={() => void hacer("responder", { respuesta })} className={BOTON_PRINCIPAL}>{enviando === "responder" ? "Enviando…" : fallo ? "Enviar de nuevo" : "Enviar respuesta"}</button>}
            {acciones.includes("aceptar") && <button type="button" data-firmar disabled={!!enviando} onClick={() => void hacer("aceptar", {})} className={BOTON_PRINCIPAL}>{enviando === "aceptar" ? "Firmando…" : fallo ? "Firmar de nuevo" : "Firmar"}</button>}
          </Acciones>
        )}
        {!contestable && !falta && (donde.panel
          ? <Acciones><button type="button" data-decidir={donde.panel} onClick={() => alDecidir(d)} className={BOTON_PRINCIPAL}>{donde.boton}</button></Acciones>
          : <p data-sin-panel className="mt-5 text-dato text-gris">{donde.nota}</p>)}
        {(contestable || falta) && <p data-espera className="mt-4 text-dato text-gris">Espera {haceCuanto(d.desde)}</p>}
      </footer>}
    </article>
  )
}

export function PanelDecisiones({ onCerrar, datosIniciales = null, fetchImpl = fetch }: { onCerrar: () => void; datosIniciales?: Decisiones | null; fetchImpl?: typeof fetch }) {
  const [datos, setDatos] = useState<Decisiones | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [grupo, setGrupo] = useState<Grupo>("firma")
  const [i, setI] = useState(0)
  const [abierta, setAbierta] = useState<Decision | null>(null) // la decisión abierta en su panel
  const [contestadas, setContestadas] = useState<Contestada[]>([]) // lo que contestaste en esta visita (con su registro)
  const [registro, setRegistro] = useState<Contestada | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const leer = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const r = await fetchImpl("/api/direccion/decisiones", { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Respuesta | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver tus decisiones." : (j && !j.ok && j.error) || `No pude leer tus decisiones (${r.status}).`)
      setDatos(j)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [fetchImpl])
  useEffect(() => { if (!datosIniciales) void leer() }, [leer, datosIniciales])

  // 6.52 · UN SOLO NÚMERO: «esperan tu firma» (lo mismo en la oficina y en el recuadro); lo de fuera y lo de clientes en pausa, aparte
  const g = useMemo(() => gruposDeDecisiones(datos ?? { decisiones: [] }), [datos])
  const lista = useMemo(() => (grupo === "firma" ? g.firma : grupo === "detienen" ? g.detienen : grupo === "fuera" ? g.fuera : g.pausa.find((p) => `pausa:${p.cliente}` === grupo)?.decisiones ?? []), [g, grupo])
  const enPausa = grupo.startsWith("pausa:") ? clienteCorto(grupo.slice(6)) : null
  const n = lista.length, actual = n ? lista[Math.min(i, n - 1)] : null
  const mover = useCallback((paso: number) => setI((k) => (n ? (Math.min(k, n - 1) + paso + n) % n : 0)), [n])

  useEffect(() => {
    if (abierta) return // el panel abierto maneja sus propias teclas
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onCerrar() }
      else if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return // en una caja de texto, las flechas mueven el cursor: no cambian de tarjeta
      else if (e.key === "ArrowRight") { e.preventDefault(); mover(1) }
      else if (e.key === "ArrowLeft") { e.preventDefault(); mover(-1) }
    }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar, mover, abierta])

  // 04-nov · contestar en el lugar: el servidor del tablero lo manda a la puerta de la plataforma de esa fuente y confirma que salió
  const contestar = useCallback(async (d: Decision, accion: AccionDeDecision, t: { respuesta?: string; motivo?: string; cambio?: { clave: string; firmado: number } }): Promise<ResultadoDeContestar | null> => {
    let resultado: ResultadoDeContestar
    try {
      const r = await fetchImpl("/api/direccion/decisiones/contestar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: d.id, accion, ...t }) })
      const j = (await r.json().catch(() => ({}))) as Partial<ResultadoDeContestar> & { error?: string; detalle?: string }
      if (r.status === 409 && j.error === "ya_no_esta") resultado = { ok: true, sale: true, texto: "Ya estaba resuelta en otro lugar.", registro: [{ cuando: new Date().toISOString(), quien: "sistema", estado: "guardado", texto: String(j.detalle ?? "Ya no estaba pendiente") }] }
      else if (Array.isArray(j.registro)) resultado = j as ResultadoDeContestar
      else resultado = { ok: false, sale: false, texto: "No salió.", motivo: r.status === 401 ? "Tu sesión venció: entra de nuevo." : String(j.detalle ?? j.error ?? `No se pudo (${r.status}).`), registro: [] }
    } catch (e) { resultado = { ok: false, sale: false, texto: "No salió.", motivo: `No se pudo contactar al tablero: ${e instanceof Error ? e.message : String(e)}`, registro: [] } }
    const c: Contestada = { d, resultado, accion, en: new Date().toISOString() }
    setContestadas((xs) => [c, ...xs.filter((x) => x.d.id !== d.id)])
    if (resultado.sale) {
      setAviso(accion === "editar" ? "Firmado con tu cambio. Salió de Tu oficina." : accion === "aceptar" ? "Firmado. Salió de Tu oficina." : accion === "descartar" ? "Descartada. Salió de Tu oficina, de la oficina que preguntó y de la antena." : "Contestada. Salió de Tu oficina, de la oficina que preguntó y de la antena.")
      setDatos((x) => (x ? { ...x, decisiones: x.decisiones.filter((y) => y.id !== d.id) } : x)) // ya salió de su fuente: se quita sin esperar la lectura
      setRegistro(c)
      void leer()
    } else setAviso(null)
    return resultado
  }, [fetchImpl, leer])
  // 05-nov · ver cómo quedaría una cifra cambiada: no firma, no mueve la lista y no queda como «contestada»
  const verCambio = useCallback(async (d: Decision, clave: string, firmado: number): Promise<ResultadoDeContestar> => {
    try {
      const r = await fetchImpl("/api/direccion/decisiones/contestar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: d.id, accion: "recalcular", cambio: { clave, firmado } }) })
      const j = (await r.json().catch(() => ({}))) as Partial<ResultadoDeContestar> & { detalle?: string }
      return Array.isArray(j.registro) ? (j as ResultadoDeContestar) : { ok: false, sale: false, texto: "No salió.", motivo: r.status === 401 ? "Tu sesión venció: entra de nuevo." : String(j.detalle ?? `No se pudo calcular (${r.status}).`), registro: [] }
    } catch (e) { return { ok: false, sale: false, texto: "No salió.", motivo: `No se pudo contactar al tablero: ${e instanceof Error ? e.message : String(e)}`, registro: [] } }
  }, [fetchImpl])
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(null), 6000); return () => clearTimeout(t) }, [aviso])

  // decidir: el panel donde esa decisión ya se toma, en el mismo lugar; al volver, la mesa se lee de nuevo
  const volver = useCallback(() => { setAbierta(null); void leer() }, [leer])
  if (abierta) {
    const donde = dondeSeDecide(abierta)
    if (donde.panel === "plan") return <PanelPlan onCerrar={volver} clienteInicial={abierta.client_id} />
    if (donde.panel === "gran_idea") return <PanelGranIdea onCerrar={volver} clienteInicial={abierta.client_id} />
    if (donde.panel === "piezas") return <PanelPiezas onCerrar={volver} clienteInicial={abierta.client_id} piezaInicial={abierta.id} />
  }

  const total = g.firma.length, fuera = g.fuera.length, detienen = g.detienen.length
  const aparte = [fuera ? `${plural(fuera, "se atiende", "se atienden")} fuera de este tablero` : null, ...g.pausa.map((p) => `${p.decisiones.length} en pausa (${clienteCorto(p.cliente)})`)].filter(Boolean).map((x) => ` · ${x}`).join("")
  const resumen = !datos ? "" : `${total ? `${plural(total, "espera", "esperan")} por ti` : "Nada espera por ti ahora"}${detienen ? ` · ${plural(detienen, "tiene un trabajo detenido", "tienen un trabajo detenido")}` : ""}${aparte}${datos.completo ? "" : " · la lista puede estar incompleta"}`
  const elegir = (x: string) => { setGrupo(x as Grupo); setI(0); setRegistro(null) }
  const cifra = (k: number) => (datos ? k : "…")
  const recuadros = [
    { clave: "firma", numero: cifra(total), rotulo: "Esperan", activo: grupo === "firma" },
    { clave: "detienen", numero: cifra(detienen), rotulo: "Detenidas", activo: grupo === "detienen" },
    ...(fuera ? [{ clave: "fuera", numero: fuera, rotulo: "Fuera", activo: grupo === "fuera" }] : []),
    ...g.pausa.map((p) => ({ clave: `pausa:${p.cliente}`, numero: p.decisiones.length, rotulo: g.pausa.length > 1 ? `Pausa ${clienteCorto(p.cliente)}` : "En pausa", activo: grupo === `pausa:${p.cliente}` })),
  ]
  const faltan = (datos?.fuentes ?? []).filter((f) => f.estado === "error" || f.estado === "sin_credencial")

  return (
    <PanelBase titulo="Decisiones" id="decisiones-titulo" seccion="decisiones" onCerrar={onCerrar} etiquetaCerrar="Cerrar las decisiones" ancho="max-w-[520px]">
      <p data-resumen className="sr-only">{cargando && !datos ? "Leyendo…" : resumen}</p>
      <Recuadros etiqueta="Filtrar las decisiones" alElegir={elegir} items={recuadros} />
      {error && <p role="alert" className="mb-4 border-y border-linea-alarma py-3 text-center text-dato text-hueso">{error}</p>}
      {aviso && <p data-aviso role="status" className="mb-4 rounded-full border border-linea-oro px-4 py-2 text-center text-dato text-hueso">{aviso}</p>}

      {registro ? <Registro c={registro} onCerrar={() => setRegistro(null)} />
        : actual ? (
          <>
            <TarjetaDelFrente key={actual.id} d={actual} alDecidir={setAbierta} enPausa={enPausa} detiene={g.detienen.some((x) => x.id === actual.id)} contestar={contestar} verCambio={verCambio} previa={contestadas.find((c) => c.d.id === actual.id) ?? null} />
            <Paginas actual={Math.min(i, n - 1) + 1} total={n} alMover={mover} etiqueta="Pasar de una decisión a otra" />
          </>
        ) : (
          <div data-vacio className="py-6 text-center">
            {cargando ? <p className="text-dato text-gris">Leyendo tus decisiones…</p>
              : datos?.completo && !error ? <><p className="text-cuerpo font-medio text-hueso">Estás al día</p><p className="mt-2 text-dato text-gris">Nada espera por ti en este momento.{recuadros.length > 2 ? " Lo que se atiende fuera o está en pausa sigue en su recuadro." : ""}</p></>
                : <p className="text-dato text-gris">No pude leer todas las fuentes: no puedo asegurarte que no haya nada pendiente.</p>}
          </div>
        )}

      {contestadas.length > 0 && (
        <div data-lo-que-contestaste className="mt-6 border-t border-linea pt-4 text-center">
          <Rotulo>Contestadas</Rotulo>
          <p className="mt-1 text-dato text-gris">{plural(contestadas.filter((c) => c.resultado.sale).length, "salió", "salieron")} · {plural(contestadas.filter((c) => !c.resultado.sale).length, "sigue aquí", "siguen aquí")}</p>
          {contestadas.slice(0, 5).map((c) => <button key={c.d.id} type="button" onClick={() => setRegistro(c)} className="mt-1 block min-h-11 w-full truncate text-dato text-hueso hover:text-oro">{c.resultado.sale ? "✓" : "!"} {tituloDeDecision(c.d)}</button>)}
        </div>
      )}
      {(datos?.sin_fuente.length || faltan.length) ? (
        <div data-sin-dato className="mt-6 border-t border-linea pt-4 text-center">
          <Rotulo>Sin dato</Rotulo>
          {faltan.map((f) => <p key={f.fuente} className="mt-1 text-dato text-gris">{f.fuente}: no se pudo leer</p>)}
          {datos?.sin_fuente.map((s) => <p key={s.que} title={s.motivo} className="mt-1 text-dato text-gris">{s.que}</p>)}
        </div>
      ) : null}
    </PanelBase>
  )
}
