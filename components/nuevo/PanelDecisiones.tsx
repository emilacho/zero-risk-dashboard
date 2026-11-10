"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { EditorDeCifra, type VerCambio } from "@/components/nuevo/EditorDeCifra"
import { PanelPlan } from "@/components/nuevo/PanelPlan"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import { PanelGranIdea } from "@/components/nuevo/PanelGranIdea"
import { Acciones, Aviso, BOTON_PRINCIPAL, BOTON_SECUNDARIO, PanelBase, Paginas, Pares, Recuadros, Rotulo } from "@/components/nuevo/EstiloBase"
import {
  TOPE_MOTIVO, TOPE_RESPUESTA, accionesDe, costoDeLaDecision, dondeSeDecide, faltaQueLeer, gruposDeDecisiones, haceCuanto, nombreDeOficina, prioridadLegible, tituloDeDecision,
  type AccionDeDecision, type CifraDeFirma, type Decision, type Decisiones, cifraEnRecuadro, cifrasDelFrente, decisivoCorto, desbloqueaElPlan, DESBLOQUEA_EL_PLAN_CORTO, DIAS_DE_RESUELTAS, esRevisada, primeraFrase, type Resuelta } from "@/lib/direccion-decisiones"
import type { PasoDelRegistro, ResultadoDeContestar } from "@/lib/decisiones-contestar"
import { HORA_24 } from "@/lib/formato"
import { FichaDeDecision } from "@/components/nuevo/FichaDeDecision"
import { ACCION_DEL_VERBO, VERBO_DE_LA_ACCION, esPregunta, fichaDeLaPregunta, NOMBRE_DEL_DEPARTAMENTO, departamentoDeLaOficina, type ClaveDeDepartamento } from "@/lib/ficha-de-decision"
import { BotonRevisar } from "@/components/nuevo/BotonRevisar"

/**
 * TU OFICINA · DECISIONES (6.20 · la mesa del director): todo lo que espera la firma de Emilio, de cualquier departamento.
 * ESTILO BASE aprobado por Emilio el 05-nov (guía zr-vault `00-meta/ESTILO-DASHBOARD.md`, imagen `APROBADO-concepto.png`):
 *  - arriba, los recuadros con el número: NUEVAS · REVISADAS · RESUELTAS (10-nov, #310 ajuste 2; antes «Esperan · Detenidas»); lo que se atiende fuera o está en pausa, en su propio
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
  hitl_queue: "Bandeja de revisión", finanzas_tableros: "Oficina Financiera", finanzas_preguntas: "Oficina Financiera",
  cerebro_dueno_preguntas: "El cerebro del cliente", dueno_preguntas: "Preguntas de las oficinas", plan_aprobaciones: "Oficina de planeación",
}
/** el departamento (rótulo fijo DEPARTAMENTO / valor): solo los nombres oficiales (Emilio 09-nov 23:29Z), nunca «Financiero» ni el nombre de un documento.
 *  La bandeja (gran idea, piezas), el plan y las preguntas de Planeación, la Oficina Creativa o Revisión son del Departamento de Marketing */
const DEPARTAMENTO_DE_LA_FUENTE: Record<string, ClaveDeDepartamento> = {
  hitl_queue: "marketing", plan_aprobaciones: "marketing", finanzas_tableros: "finanzas", finanzas_preguntas: "finanzas",
}
const DEPARTAMENTO_DEL_TIPO: Partial<Record<Decision["tipo"], ClaveDeDepartamento>> = {
  plan: "marketing", gran_idea: "marketing", pieza: "marketing", revision: "marketing", firma_de_finanzas: "finanzas", pregunta_de_finanzas: "finanzas",
}
export function departamentoDe(d: Pick<Decision, "tipo" | "fuente" | "pregunta_de">): string {
  const clave = DEPARTAMENTO_DEL_TIPO[d.tipo] ?? (d.pregunta_de ? departamentoDeLaOficina(d.pregunta_de.oficina) : null) ?? DEPARTAMENTO_DE_LA_FUENTE[d.fuente ?? ""] ?? null
  if (clave) return NOMBRE_DEL_DEPARTAMENTO[clave]
  // lo que no es de un departamento (el cerebro del cliente, una oficina sin departamento): su oficina tal cual, sin inventar un departamento
  if (d.pregunta_de) { const o = nombreDeOficina(d.pregunta_de.oficina).replace(/^Oficina (de |del )?/i, ""); return o.charAt(0).toLocaleUpperCase("es") + o.slice(1) }
  return d.fuente === "cerebro_dueno_preguntas" ? "Cerebro" : ""
}
const fecha = (iso: string | null) => { if (!iso) return null; const t = new Date(iso); return Number.isNaN(t.getTime()) ? null : t.toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" }) }
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
/** 6.52 · «Zero Risk Seguridad Industrial» → «Zero Risk SI» (nombres largos en un rótulo corto) */
export const clienteCorto = (c: string): string => { const w = c.trim().split(/\s+/); return w.length > 3 ? `${w.slice(0, 2).join(" ")} ${w.slice(2).map((x) => x[0]?.toLocaleUpperCase("es") ?? "").join("")}` : c }
/** el grupo que se mira: lo que espera tu firma, lo que tiene un trabajo detenido, lo que se atiende fuera, o lo de un cliente en pausa */
// 10-nov (#310 ajuste 2 · Emilio): un solo camino para toda alerta, Nueva → Revisada (solo con «✓ Revisar») → Resuelta (la cierra el sistema). Reemplaza «Esperan · Detenidas»
type Grupo = "nuevas" | "revisadas" | "resueltas" | "fuera" | `pausa:${string}`
/** 09-nov · ajuste 4 de CC6: al tocar «Asumir», la llamada sale recién pasado este tiempo; «Deshacer» en ese lapso no manda nada */
export const ESPERA_PARA_DESHACER_MS = 5000

/** 10-nov (#310 ajuste 2) · RESUELTAS: solo lectura; las cierra el sistema cuando se deciden. Sin registro, se dice (nunca «nada») */
function ListaDeResueltas({ resueltas, completo }: { resueltas: Resuelta[] | null; completo: boolean }) {
  if (!resueltas) return <p data-resueltas-sin-dato className="py-6 text-center text-dato text-gris">Sin dato: todavía no llega el registro de lo resuelto.</p>
  return (
    <div data-resueltas className="text-center">
      <p className="mb-2 text-dato text-gris">Lo que se decidió en los últimos {DIAS_DE_RESUELTAS} días.{completo ? "" : " Puede faltar alguna: el registro vino incompleto."}</p>
      {resueltas.length ? <ul>{resueltas.map((r) => (
        <li key={r.id} data-resuelta={r.id} className="border-t border-linea py-3">
          <p className="text-cuerpo text-hueso">{r.titulo}</p>
          <p className="mt-1 text-dato text-gris">{[r.cliente, r.resuelta_en ? `resuelta ${haceCuanto(r.resuelta_en)}` : null].filter(Boolean).join(" · ")}</p>
        </li>
      ))}</ul> : <p className="py-4 text-dato text-gris">Nada se resolvió en estos días.</p>}
    </div>
  )
}

/** 04-nov · lo que pasó con una decisión que contestaste (el registro de su detalle) */
export interface Contestada { d: Decision; resultado: ResultadoDeContestar; accion: AccionDeDecision; en: string }
const hora = (iso: string | null) => { if (!iso) return null; const t = new Date(iso); return Number.isNaN(t.getTime()) ? null : t.toLocaleTimeString("es-EC", { ...HORA_24 }) }
/** el punto de cada paso del registro: alarma solo si falló; oro lo que hiciste tú; lo demás, apagado */
const PUNTO_DEL_PASO: Record<PasoDelRegistro["estado"], string> = { pregunto: "bg-apagado", respondiste: "bg-oro", asumiste: "bg-oro", firmaste: "bg-oro", descartaste: "bg-oro", guardado: "bg-hueso", retomado: "bg-hueso", espera: "bg-apagado", fallo: "bg-alarma" }

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
/** el número solo, grande; la moneda en el rótulo (Lenovo 06-nov) */
function CuerpoDeCifra({ c }: { c: CifraDeFirma }) {
  const r = cifraEnRecuadro(c)
  return <><span data-numero-de-cifra className="block whitespace-nowrap text-numero font-normal [font-variant-numeric:tabular-nums] text-hueso">{r.numero}</span><span className="mt-1 block text-rotulo uppercase tracking-rotulo text-gris">{r.rotulo}</span>{c.nota && <span className="mt-1 block text-dato text-gris">{c.nota}</span>}</>
}

export function TarjetaDelFrente({ d, alDecidir, enPausa, detiene, contestar, verCambio, previa, detalleInicial = false, asumir }: {
  d: Decision; alDecidir: (d: Decision) => void; enPausa: string | null; detiene: boolean
  contestar: (d: Decision, accion: AccionDeDecision, texto: { respuesta?: string; motivo?: string; cambio?: { clave: string; firmado: number } }) => Promise<ResultadoDeContestar | null>
  verCambio: (d: Decision, clave: string, firmado: number) => ReturnType<VerCambio>
  /** lo que pasó la última vez que se contestó esta decisión (si no salió, se muestra el motivo) */
  previa: Contestada | null
  /** para pruebas e imágenes: el detalle ya abierto */
  detalleInicial?: boolean
  /** 09-nov · asumir el supuesto: lo maneja el panel (la llamada sale 5 s después, con «Deshacer»). Sin esta función no hay botón */
  asumir?: (d: Decision) => void
}) {
  const pr = prioridadLegible(d.prioridad), donde = dondeSeDecide(d), acciones = accionesDe(d)
  const [respuesta, setRespuesta] = useState(previa?.accion === "responder" ? (previa.resultado.registro.find((p) => p.cita)?.cita ?? "") : "")
  const [descartando, setDescartando] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [enviando, setEnviando] = useState<AccionDeDecision | null>(null)
  const [cambiando, setCambiando] = useState<string | null>(null) // la cifra que Emilio está cambiando: una a la vez, porque la meta y el presupuesto están atados
  const cifraEnCambio = d.cifras?.find((c) => c.clave === cambiando && c.editable) ?? null
  const [verDetalle, setVerDetalle] = useState(detalleInicial) // 09-nov: el texto entero, al tocar «Decisivo» o «Uso» (sin botón nuevo)
  const { frente, detalle: cifrasDelDetalle } = cifrasDelFrente(d.cifras ?? [])
  const corto = d.criticos?.length ? decisivoCorto(d.criticos[0]) : null
  // 09-nov · si no se pudo asumir, el aviso es la línea roja fina bajo los botones (boceto 4), no el aviso de arriba
  const sinGuardar = !!previa && !previa.resultado.sale && previa.accion === "asumir"
  const fallo = previa && !previa.resultado.sale && !sinGuardar ? previa.resultado.motivo ?? previa.resultado.texto : null
  const conAsumir = acciones.includes("asumir") && !!asumir && !!d.supuesto
  // las preguntas de las oficinas (la ruta de la plataforma): si la oficina no propuso supuesto, se dice por qué no hay «Asumir»
  const esDeLasOficinas = d.tipo === "pregunta_al_dueno" && d.fuente === "dueno_preguntas"
  const destraba = d.destraba ?? (d.tipo === "pregunta_al_dueno" && detiene ? desbloqueaElPlan(d.cliente) : null)
  // 10-nov (#310 ajuste 1): el corto que manda la oficina; si el texto lo pone el tablero (el plan espera), «Sigue el Plan de Marketing»; si la oficina no mandó corto, la primera frase
  const destrabaCorto = d.destraba ? (d.destraba_corto ?? null) : destraba ? DESBLOQUEA_EL_PLAN_CORTO : null
  const hacer = async (a: AccionDeDecision, t: { respuesta?: string; motivo?: string; cambio?: { clave: string; firmado: number } }) => { setEnviando(a); try { return await contestar(d, a, t) } finally { setEnviando(null) } }
  const contestable = acciones.length > 0
  const falta = faltaQueLeer(d)
  const editables = acciones.includes("editar") ? (d.cifras ?? []).filter((c) => c.editable) : []
  // CC6 #290: si la firma no trae «Decisivo», «Uso» ni «Desbloquea», no hay bloque que abra el detalle; entonces las demás cifras se ven sin tocar nada (ninguna información se pierde)
  const sinPuerta = !corto && !d.para_que && !destraba
  // CC6 #290 (e145a7c): el detalle solo existe si tiene algo que mostrar; si no, «Uso / Desbloquea» es texto, no un botón que abre una caja vacía
  // 09-nov (#957): el frente lleva el corto de la oficina; si no vino, la primera frase entera (como hasta hoy)
  const usoAlFrente = d.para_que ? (d.para_que_corto ?? primeraFrase(d.para_que)) : null
  const destrabaAlFrente = destraba ? (destrabaCorto || primeraFrase(destraba)) : null
  const usoDeMas = !!d.para_que && usoAlFrente !== d.para_que.trim()
  const destrabaDeMas = !!destraba && destrabaAlFrente !== destraba.trim()
  const hayDetalle = !!d.criticos?.length || usoDeMas || destrabaDeMas || cifrasDelDetalle.length > 0
  const recuadro = (c: CifraDeFirma, marca: Record<string, string>) => editables.some((x) => x.clave === c.clave)
    ? <div key={c.clave} {...marca}><button type="button" data-cambiar={c.clave} disabled={!!enviando} onClick={() => setCambiando(c.clave)} aria-label={`Cambiar ${c.nombre}`} className="zr-apagable block min-h-11 w-full rounded-tarjeta border border-linea bg-grafito px-2 py-4 text-center hover:border-linea-oro focus-visible:outline focus-visible:outline-1 focus-visible:outline-oro"><CuerpoDeCifra c={c} /></button></div>
    : <div key={c.clave} {...marca} className="rounded-tarjeta border border-linea bg-grafito px-2 py-4 text-center"><CuerpoDeCifra c={c} /></div>
  // lo que no salió se lee sin bajar (CC6 · #283)
  const porQue = useRef<HTMLDivElement>(null)
  const pie = useRef<HTMLElement>(null) // Firmar no va fijo: se llega a él pasando por las cifras y por lo que sigue abierto (CC6 · #283)
  useEffect(() => { if (fallo) porQue.current?.scrollIntoView({ block: "center", behavior: "smooth" }) }, [fallo, previa?.en, cifraEnCambio])
  // 09-nov · T1 de la ficha única (GO Lenovo, boceto v7 de Emilio): las preguntas se dibujan con la ficha; las demás siguen aquí hasta el T2
  if (esPregunta(d)) {
    const ficha = fichaDeLaPregunta(d, { departamento: departamentoDe(d), detiene, destraba, destrabaCorto, conAsumir, responder: acciones.includes("responder"), descartar: acciones.includes("descartar") })
    return (
      <FichaDeDecision ficha={ficha} enviando={enviando ? VERBO_DE_LA_ACCION[enviando] ?? null : null} textoInicial={respuesta}
        nota={enPausa ? `${enPausa} está en pausa por tu decisión: esto no cuenta en «esperan».` : undefined}
        alVerbo={(v, t) => { if (v === "asumir") { asumir?.(d); return } const a = ACCION_DEL_VERBO[v]; if (a) void hacer(a, v === "responder" ? { respuesta: t.texto ?? "" } : { motivo: t.motivo ?? "" }) }}
        alIr={() => alDecidir(d)}
        estado={{
          arriba: fallo ? <span data-chip="volvio" className="inline-flex items-center gap-1.5"><span aria-hidden className="h-[7px] w-[7px] rounded-full bg-alarma" />No salió</span> : null,
          abajo: <>
            {fallo && <div ref={porQue} data-por-que-volvio role="status"><Aviso rotulo="No salió">{fallo}</Aviso></div>}
            {sinGuardar && <div data-sin-guardar role="status" className="mt-5 border-t border-linea-alarma pt-3 text-center"><Rotulo tono="alarma">Sin guardar</Rotulo><p className="mt-1 text-dato text-gris">{previa?.resultado.ya_no_se_asume ? previa.resultado.motivo : "No se pudo asumir. La pregunta sigue abierta; vuelve a intentarlo."}</p></div>}
          </>,
        }} />
    )
  }
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
      {esDeLasOficinas && <Rotulo className="mt-5">Pregunta</Rotulo>}
      {!d.cifras?.length && <h3 data-titulo className={`${esDeLasOficinas ? "mt-1.5" : "mt-5"} text-cuerpo font-medio text-hueso`}>{tituloDeDecision(d)}</h3>}
      {esDeLasOficinas && !cifraEnCambio && (d.supuesto
        // 09-nov · lo que se acepta al asumir, tal cual lo propuso la oficina (boceto 1)
        ? <div data-si-asumes className="mt-5"><Rotulo tono="gris">Si asumes</Rotulo>
          <div className="mt-3 rounded-tarjeta border border-linea bg-grafito px-3 py-4 text-center">
            <span data-supuesto className={`block ${d.supuesto.length <= 24 ? "whitespace-nowrap text-numero font-normal [font-variant-numeric:tabular-nums]" : "text-cuerpo"} text-hueso`}>{d.supuesto}</span>
            <span className="mt-1 block text-rotulo uppercase tracking-rotulo text-gris">Supuesto</span>
          </div></div>
        : <div data-sin-supuesto className="mt-5 border-t border-linea pt-4"><Rotulo tono="gris">Sin supuesto</Rotulo><p className="mt-1.5 text-dato text-gris">La oficina no propuso un supuesto: respóndela o descártala.</p></div>)}
      {fallo && !cifraEnCambio && <div ref={porQue} data-por-que-volvio role="status"><Aviso rotulo="No salió">{fallo}</Aviso></div>}
      {cifraEnCambio ? <EditorDeCifra cifra={cifraEnCambio} todas={d.cifras ?? []} alEditar={d.al_editar ?? null} criticos={d.criticos ?? []} ver={(firmado) => verCambio(d, cifraEnCambio.clave, firmado)} firmar={(firmado) => hacer("editar", { cambio: { clave: cifraEnCambio.clave, firmado } })} volver={() => setCambiando(null)} /> : d.cifras?.length ? (
        <div data-cifras className="mt-5">
          <Rotulo tono="gris">Propuesta</Rotulo>
          {/* 09-nov · solo las dos cifras que decide el dueño; las demás, en el detalle */}
          <div className={`mt-3 grid gap-3 ${frente.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {frente.map((c) => recuadro(c, { "data-cifra": c.clave }))}
          </div>
        </div>
      ) : null}
      {!cifraEnCambio && corto && (
        // 09-nov · «Decisivo»: una frase y su porqué en dos líneas; tocar el bloque abre el texto entero
        <button type="button" data-criticos aria-expanded={verDetalle} onClick={() => setVerDetalle((v) => !v)} aria-label={verDetalle ? "Cerrar el detalle" : "Leer el detalle completo"} className="block w-full rounded-control text-center focus-visible:outline focus-visible:outline-1 focus-visible:outline-oro">
          <Aviso rotulo="Decisivo"><span data-frase className="block">{corto.frase}</span>{corto.porque && <span data-porque className="block text-cuerpo font-normal text-gris">{corto.porque}</span>}</Aviso>
        </button>
      )}
      {!cifraEnCambio && (d.para_que || destraba) && (() => {
        const pares = <Pares valor="text-dato" pares={[
          ...(d.para_que ? [{ rotulo: "Uso", valor: <span data-uso>{usoAlFrente}</span> }] : []),
          ...(destraba ? [{ rotulo: "Desbloquea", valor: <span data-destraba>{destrabaAlFrente}</span> }] : []),
        ]} />
        return hayDetalle
          ? <button type="button" data-contexto aria-expanded={verDetalle} onClick={() => setVerDetalle((v) => !v)} aria-label={verDetalle ? "Cerrar el detalle" : "Leer el detalle completo"} className="mt-4 block w-full rounded-control focus-visible:outline focus-visible:outline-1 focus-visible:outline-oro">{pares}</button>
          : <div data-contexto-solo className="mt-4">{pares}</div>
      })()}
      {!cifraEnCambio && hayDetalle && (verDetalle || (sinPuerta && cifrasDelDetalle.length > 0)) && (
        <div data-detalle className="mt-4 space-y-4 border-t border-linea pt-4 text-left">
          {d.criticos?.length ? <div><Rotulo tono="alarma">Decisivo</Rotulo><ul className="mt-1.5 space-y-2 text-dato text-hueso">{d.criticos.map((c) => <li key={c} data-critico-entero>{c}</li>)}</ul></div> : null}
          {usoDeMas && <div><Rotulo tono="gris">Uso</Rotulo><p data-uso-entero className="mt-1.5 text-dato text-hueso">{d.para_que}</p></div>}
          {destrabaDeMas && <div><Rotulo tono="gris">Desbloquea</Rotulo><p data-destraba-entero className="mt-1.5 text-dato text-hueso">{destraba}</p></div>}
          {cifrasDelDetalle.length > 0 && <div><Rotulo tono="gris">Las demás cifras</Rotulo><div className="mt-2 grid grid-cols-2 gap-3">{cifrasDelDetalle.map((c) => recuadro(c, { "data-cifra-del-detalle": c.clave }))}</div></div>}
        </div>
      )}
      {falta && <div data-falta-informacion role="status"><Aviso rotulo="Nada que firmar">Falta información: la Oficina Financiera debe mandar las cifras que propone.</Aviso></div>}
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
      {!cifraEnCambio && <footer ref={pie} data-pie>
        {(contestable && !descartando) && (
          <Acciones>
            {acciones.includes("descartar") && <button type="button" data-descartar-abrir disabled={!!enviando} onClick={() => setDescartando(true)} className={`${BOTON_SECUNDARIO} whitespace-nowrap`}>Descartar</button>}
            {conAsumir && <button type="button" data-asumir disabled={!!enviando} onClick={() => asumir!(d)} className={`${BOTON_SECUNDARIO} whitespace-nowrap`}>Asumir</button>}
            {editables.length > 0 && <button type="button" data-cambiar-cifra disabled={!!enviando} onClick={() => setCambiando(editables[0].clave)} className={BOTON_SECUNDARIO}>Cambiar cifra</button>}
            {acciones.includes("responder") && <button type="button" data-enviar disabled={!!enviando || !respuesta.trim()} onClick={() => void hacer("responder", { respuesta })} className={`${BOTON_PRINCIPAL} whitespace-nowrap`}>{enviando === "responder" ? "Enviando…" : conAsumir ? "Responder" : fallo ? "Enviar de nuevo" : "Enviar respuesta"}</button>}
            {acciones.includes("aceptar") && <button type="button" data-firmar disabled={!!enviando} onClick={() => void hacer("aceptar", {})} className={BOTON_PRINCIPAL}>{enviando === "aceptar" ? "Firmando…" : fallo ? "Firmar de nuevo" : "Firmar"}</button>}
          </Acciones>
        )}
        {sinGuardar && <div data-sin-guardar role="status" className="mt-5 border-t border-linea-alarma pt-3 text-center"><Rotulo tono="alarma">Sin guardar</Rotulo><p className="mt-1 text-dato text-gris">{previa?.resultado.ya_no_se_asume ? previa.resultado.motivo : "No se pudo asumir. La pregunta sigue abierta; vuelve a intentarlo."}</p></div>}
        {!contestable && !falta && (donde.panel
          ? <Acciones><button type="button" data-decidir={donde.panel} onClick={() => alDecidir(d)} className={BOTON_PRINCIPAL}>{donde.boton}</button></Acciones>
          : <p data-sin-panel className="mt-5 text-dato text-gris">{donde.nota}</p>)}
        {(contestable || falta) && <p data-espera className="mt-4 text-dato text-gris">Espera {haceCuanto(d.desde)}</p>}
      </footer>}
    </article>
  )
}

export function PanelDecisiones({ onCerrar, datosIniciales = null, fetchImpl = fetch, detalleInicial = false }: { onCerrar: () => void; datosIniciales?: Decisiones | null; fetchImpl?: typeof fetch; /** para pruebas e imágenes */ detalleInicial?: boolean }) {
  const [datos, setDatos] = useState<Decisiones | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [grupo, setGrupo] = useState<Grupo>("nuevas")
  const [revisadasAqui, setRevisadasAqui] = useState<Record<string, string>>({}) // las que marcaste «✓ Revisar» en esta visita (clave → cuándo)
  const [i, setI] = useState(0)
  const [abierta, setAbierta] = useState<Decision | null>(null) // la decisión abierta en su panel
  const [contestadas, setContestadas] = useState<Contestada[]>([]) // lo que contestaste en esta visita (con su registro)
  const [registro, setRegistro] = useState<Contestada | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  // 09-nov · ASUMIR (boceto aprobado + ajustes de CC6): una sola constancia a la vez, arriba de la tarjeta; se va con tu próxima acción o al cerrar el panel
  const [constancia, setConstancia] = useState<{ tipo: "asumida" | "cerrada"; id: string; texto: string; enEspera: boolean } | null>(null)
  const [foco, setFoco] = useState<string | null>(null) // la que vuelve a la lista (deshacer · no se pudo asumir): se muestra al frente
  // la llamada sale 5 s después de tocar «Asumir»; «Deshacer» en ese tiempo no manda nada
  const enEspera = useRef<{ d: Decision; reloj: ReturnType<typeof setTimeout> } | null>(null)

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
  const nuevas = useMemo(() => g.firma.filter((d) => !esRevisada(d, revisadasAqui)), [g, revisadasAqui])
  const revisadas = useMemo(() => g.firma.filter((d) => esRevisada(d, revisadasAqui)), [g, revisadasAqui])
  const lista = useMemo(() => (grupo === "nuevas" ? nuevas : grupo === "revisadas" ? revisadas : grupo === "resueltas" ? [] : grupo === "fuera" ? g.fuera : g.pausa.find((p) => `pausa:${p.cliente}` === grupo)?.decisiones ?? []), [g, grupo, nuevas, revisadas])
  const enPausa = grupo.startsWith("pausa:") ? clienteCorto(grupo.slice(6)) : null
  const n = lista.length, actual = n ? lista[Math.min(i, n - 1)] : null
  const mover = useCallback((paso: number) => setI((k) => (n ? (Math.min(k, n - 1) + paso + n) % n : 0)), [n])
  useEffect(() => { if (!foco) return; const k = lista.findIndex((x) => x.id === foco); if (k >= 0) { setI(k); setFoco(null) } }, [lista, foco])

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
  const pedir = useCallback(async (d: Decision, accion: AccionDeDecision, t: { respuesta?: string; motivo?: string; cambio?: { clave: string; firmado: number } }): Promise<ResultadoDeContestar> => {
    let resultado: ResultadoDeContestar
    try {
      const r = await fetchImpl("/api/direccion/decisiones/contestar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: d.id, accion, ...t }) })
      const j = (await r.json().catch(() => ({}))) as Partial<ResultadoDeContestar> & { error?: string; detalle?: string }
      // CC6 #303: la decisión ya no estaba cuando salió la llamada (otro la cerró, también durante los 5 s de «Asumir»): es «ya estaba cerrada», no «asumida»
      if (r.status === 409 && j.error === "ya_no_esta") resultado = { ok: true, sale: true, cerrada_antes: true, texto: "Ya estaba resuelta en otro lugar.", registro: [{ cuando: new Date().toISOString(), quien: "sistema", estado: "guardado", texto: String(j.detalle ?? "Ya no estaba pendiente") }] }
      else if (r.status === 409 && j.error === "accion_no_permitida" && accion === "asumir") resultado = { ok: false, sale: false, ya_no_se_asume: true, texto: "No salió.", motivo: "La oficina ya no propone un supuesto: respóndela o descártala.", registro: [] }
      else if (Array.isArray(j.registro)) resultado = j as ResultadoDeContestar
      else resultado = { ok: false, sale: false, texto: "No salió.", motivo: r.status === 401 ? "Tu sesión venció: entra de nuevo." : String(j.detalle ?? j.error ?? `No se pudo (${r.status}).`), registro: [] }
    } catch (e) { resultado = { ok: false, sale: false, texto: "No salió.", motivo: `No se pudo contactar al tablero: ${e instanceof Error ? e.message : String(e)}`, registro: [] } }
    return resultado
  }, [fetchImpl])

  // asumir, ya pasados los 5 s (o antes, si haces otra cosa o cierras el panel): recién aquí sale la llamada
  const enviarAsumida = useCallback(async (d: Decision) => {
    if (enEspera.current?.d.id === d.id) { clearTimeout(enEspera.current.reloj); enEspera.current = null }
    setConstancia((c) => (c && c.id === d.id ? { ...c, enEspera: false } : c))
    const resultado = await pedir(d, "asumir", {})
    setContestadas((xs) => [{ d, resultado, accion: "asumir" as const, en: new Date().toISOString() }, ...xs.filter((x) => x.d.id !== d.id)])
    if (resultado.sale) {
      // 409: otra persona la cerró. No es un error; la lista se vuelve a leer entera (el número pudo cambiar por otras razones)
      if (resultado.cerrada_antes) setConstancia((c) => (c && c.id === d.id ? { tipo: "cerrada", id: d.id, texto: "Otra persona la cerró antes que tú.", enEspera: false } : c))
      void leer()
      return
    }
    // no se pudo: vuelve al frente con la línea «Sin guardar»
    setConstancia((c) => (c && c.id === d.id ? null : c))
    // si la oficina retiró el supuesto, vuelve SIN él (sin «Asumir» que fallaría siempre) y la lista se relee
    const vuelve = resultado.ya_no_se_asume ? { ...d, supuesto: null, permite: d.permite?.filter((a) => a !== "asumir") ?? null } : d
    setDatos((x) => (x && !x.decisiones.some((y) => y.id === d.id) ? { ...x, decisiones: [vuelve, ...x.decisiones] } : x))
    setFoco(d.id)
    if (resultado.ya_no_se_asume) void leer()
  }, [pedir, leer])
  const soltarLaEspera = useCallback(() => { const p = enEspera.current; if (p) void enviarAsumida(p.d) }, [enviarAsumida])
  const asumir = useCallback((d: Decision) => {
    soltarLaEspera() // la que esperaba sale ya: tocar otra es tu próxima acción
    setRegistro(null); setAviso(null)
    setDatos((x) => (x ? { ...x, decisiones: x.decisiones.filter((y) => y.id !== d.id) } : x)) // el contador baja y se ve la siguiente
    setConstancia({ tipo: "asumida", id: d.id, texto: `${d.supuesto ?? ""}, como supuesto tuyo`, enEspera: true })
    enEspera.current = { d, reloj: setTimeout(() => { void enviarAsumida(d) }, ESPERA_PARA_DESHACER_MS) }
  }, [soltarLaEspera, enviarAsumida])
  const deshacer = useCallback(() => {
    const p = enEspera.current
    if (!p) return
    clearTimeout(p.reloj); enEspera.current = null
    setConstancia(null)
    setDatos((x) => (x && !x.decisiones.some((y) => y.id === p.d.id) ? { ...x, decisiones: [p.d, ...x.decisiones] } : x))
    setFoco(p.d.id)
  }, [])
  // al cerrar el panel con una asumida esperando, sale ya: tu toque fue «Asumir», y solo «Deshacer» la anula
  const soltarAlCerrar = useRef(soltarLaEspera)
  soltarAlCerrar.current = soltarLaEspera
  useEffect(() => () => soltarAlCerrar.current(), [])

  const contestar = useCallback(async (d: Decision, accion: AccionDeDecision, t: { respuesta?: string; motivo?: string; cambio?: { clave: string; firmado: number } }): Promise<ResultadoDeContestar | null> => {
    soltarLaEspera(); setConstancia(null) // tu próxima acción: la asumida que esperaba sale ya, y su constancia se va
    const resultado = await pedir(d, accion, t)
    const c: Contestada = { d, resultado, accion, en: new Date().toISOString() }
    setContestadas((xs) => [c, ...xs.filter((x) => x.d.id !== d.id)])
    if (resultado.sale) {
      setAviso(accion === "editar" ? "Firmado con tu cambio. Salió de Tu oficina." : accion === "aceptar" ? "Firmado. Salió de Tu oficina." : accion === "descartar" ? "Descartada. Salió de Tu oficina, de la oficina que preguntó y de la antena." : "Contestada. Salió de Tu oficina, de la oficina que preguntó y de la antena.")
      setDatos((x) => (x ? { ...x, decisiones: x.decisiones.filter((y) => y.id !== d.id) } : x)) // ya salió de su fuente: se quita sin esperar la lectura
      setRegistro(c)
      void leer()
    } else setAviso(null)
    return resultado
  }, [pedir, leer, soltarLaEspera])
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
  // «Resueltas»: lo del registro de la plataforma (7 días) más lo que salió en esta visita y el registro todavía no trae; sin registro, «sin dato» (nunca 0)
  const resueltas = datos?.resueltas ? [...datos.resueltas, ...contestadas.filter((c) => c.resultado.sale && !datos.resueltas!.some((r) => r.id === c.d.id)).map((c): Resuelta => ({ id: c.d.id, titulo: tituloDeDecision(c.d), tipo: c.d.tipo, cliente: c.d.cliente, resuelta_en: c.resultado.registro.at(-1)?.cuando ?? null, resultado: null }))] : null
  const aparte = [fuera ? `${plural(fuera, "se atiende", "se atienden")} fuera de este tablero` : null, ...g.pausa.map((p) => `${p.decisiones.length} en pausa (${clienteCorto(p.cliente)})`)].filter(Boolean).map((x) => ` · ${x}`).join("")
  // 10-nov (CC7 · alerta sin estado): si la libreta de «ya lo vi» no se leyó, las tarjetas siguen en «Nuevas» (no se calla nada), pero el NÚMERO dice «—»
  // (Lenovo 00:30Z: solo el guion estándar, sin texto): un número lleno contradiría a la plataforma (`contadores.nuevas = null`)
  const sinLibreta = nuevas.some((d) => d.alerta && d.alerta.estado === null && !revisadasAqui[d.alerta.clave])
  const resumen = !datos ? "" : `${total ? `${sinLibreta ? "nuevas sin dato" : plural(nuevas.length, "nueva", "nuevas")} · ${plural(revisadas.length, "revisada", "revisadas")}` : "Nada espera por ti ahora"}${resueltas ? ` · ${plural(resueltas.length, "resuelta", "resueltas")} en ${DIAS_DE_RESUELTAS} días` : ""}${detienen ? ` · ${plural(detienen, "tiene un trabajo detenido", "tienen un trabajo detenido")}` : ""}${aparte}${datos.completo ? "" : " · la lista puede estar incompleta"}`
  const elegir = (x: string) => { setGrupo(x as Grupo); setI(0); setRegistro(null) }
  const cifra = (k: number) => (datos ? k : "…")
  const recuadros = [
    { clave: "nuevas", numero: sinLibreta ? "—" : cifra(nuevas.length), rotulo: "Nuevas", activo: grupo === "nuevas" },
    { clave: "revisadas", numero: cifra(revisadas.length), rotulo: "Revisadas", activo: grupo === "revisadas" },
    { clave: "resueltas", numero: !datos ? "…" : resueltas ? resueltas.length : "—", rotulo: "Resueltas", activo: grupo === "resueltas" },
    ...(fuera ? [{ clave: "fuera", numero: fuera, rotulo: "Fuera", activo: grupo === "fuera" }] : []),
    ...g.pausa.map((p) => ({ clave: `pausa:${p.cliente}`, numero: p.decisiones.length, rotulo: g.pausa.length > 1 ? `Pausa ${clienteCorto(p.cliente)}` : "En pausa", activo: grupo === `pausa:${p.cliente}` })),
  ]

  return (
    <PanelBase titulo="Decisiones" id="decisiones-titulo" seccion="decisiones" onCerrar={onCerrar} etiquetaCerrar="Cerrar las decisiones" ancho="max-w-[520px]">
      <p data-resumen className="sr-only">{cargando && !datos ? "Leyendo…" : resumen}</p>
      <Recuadros etiqueta="Filtrar las decisiones" alElegir={elegir} items={recuadros} />
      {error && <p role="alert" className="mb-4 border-y border-linea-alarma py-3 text-center text-dato text-hueso">{error}</p>}
      {constancia && (
        // 09-nov · la constancia, entre líneas y fuera de la tarjeta (boceto 2); «Deshacer» solo mientras la llamada no salió
        <div data-constancia={constancia.tipo} role="status" className="mb-4 border-y border-linea py-3 text-center">
          <Rotulo>{constancia.tipo === "asumida" ? "Asumida" : "Ya estaba cerrada"}</Rotulo>
          <p data-constancia-texto className="mt-1 text-dato text-gris">{constancia.texto}</p>
          {constancia.enEspera && <button type="button" data-deshacer onClick={deshacer} className="mt-1 min-h-11 px-3 text-dato font-medio text-oro hover:text-hueso focus-visible:outline focus-visible:outline-1 focus-visible:outline-oro">Deshacer</button>}
        </div>
      )}
      {/* ajuste 1 de CC6: solo si la pregunta del frente de verdad detiene el plan (señal de la plataforma), nunca texto fijo */}
      {!registro && actual?.tipo === "pregunta_al_dueno" && g.detienen.some((x) => x.id === actual.id) && <p data-linea-plan className="-mt-1 mb-4 text-center text-dato text-gris">El plan espera hasta que cierres todas las preguntas</p>}
      {aviso && <p data-aviso role="status" className="mb-4 rounded-full border border-linea-oro px-4 py-2 text-center text-dato text-hueso">{aviso}</p>}

      {registro ? <Registro c={registro} onCerrar={() => setRegistro(null)} />
        : grupo === "resueltas" ? <ListaDeResueltas resueltas={resueltas} completo={datos?.resueltas_completo !== false} />
        : actual ? (
          <>
            {actual.alerta && (
              // 10-nov (#310 ajuste 2): «✓ Revisar» lleva la decisión de Nuevas a Revisadas; abrirla no cuenta. La MISMA pieza que la antena
              <div data-fila-revisar className="-mt-2 mb-3 flex justify-end">
                <BotonRevisar key={actual.alerta.clave} clave={actual.alerta.clave} fetchImpl={fetchImpl}
                  revisadaEn={revisadasAqui[actual.alerta.clave] ?? (actual.alerta.estado === "revisada" ? actual.alerta.revisada_en ?? actual.alerta.clave : null)}
                  alRevisar={(c, en) => { setRevisadasAqui((m) => ({ ...m, [c]: en })); if (grupo === "nuevas") setAviso("La marcaste como revisada: ahora está en «Revisadas».") }} />
              </div>
            )}
            <TarjetaDelFrente key={actual.id} d={actual} alDecidir={setAbierta} enPausa={enPausa} detiene={g.detienen.some((x) => x.id === actual.id)} contestar={contestar} verCambio={verCambio} previa={contestadas.find((c) => c.d.id === actual.id) ?? null} detalleInicial={detalleInicial} asumir={asumir} />
            <Paginas actual={Math.min(i, n - 1) + 1} total={n} alMover={mover} etiqueta="Pasar de una decisión a otra" />
          </>
        ) : (
          <div data-vacio className="py-6 text-center">
            {cargando ? <p className="text-dato text-gris">Leyendo tus decisiones…</p>
              : grupo === "nuevas" && revisadas.length ? <><p className="text-cuerpo font-medio text-hueso">No hay nuevas</p><p className="mt-2 text-dato text-gris">Lo que ya revisaste sigue pendiente en «Revisadas».</p></>
              : grupo === "revisadas" ? <p className="text-dato text-gris">No has marcado ninguna como revisada.</p>
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
    </PanelBase>
  )
}
