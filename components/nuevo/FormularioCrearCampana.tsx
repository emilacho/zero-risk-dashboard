"use client"

/**
 * EL FORMULARIO «CREAR CAMPAÑA» (20-nov · GO Lenovo 22:05 Zúrich · boceto aprobado por Emilio 22:03, «PERFECTO», con la pregunta escrita debajo del rótulo:
 * `raw/evidencia/2026-11-20-boceto-crear-campana-formulario/`). Estructura de Typeform, fachada del estilo base:
 *   · una pregunta por pantalla: rótulo dorado de 1 o 2 palabras y la pregunta debajo; arriba la barra de 5 tramos con «N de 5»;
 *   · «Atrás» (borde oro) a la izquierda y «Siguiente» (ámbar) a la derecha; «Siguiente» se apaga mientras falta la respuesta;
 *   · el tope es obligatorio y lleva al lado el MÍNIMO que lee la plataforma PARA LAS FECHAS ELEGIDAS (se vuelve a pedir al cambiarlas); debajo del mínimo, el número
 *     del mínimo en rojo. Sin mínimo leído, no se puede crear;
 *   · el último paso es el resumen con «Crear Campaña». El tablero no escribe la base: lo manda `POST /api/acciones/crear-campana` a la plataforma.
 * Las reglas viven en `lib/crear-campana.ts` (las mismas que exige el servidor del tablero).
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { Acciones, BOTON_PRINCIPAL, BOTON_SECUNDARIO, Pares, PanelBase, ROTULO } from "@/components/nuevo/EstiloBase"
import { ClienteComoTexto } from "@/components/nuevo/ClienteComoTexto"
import { SelectorDeFecha } from "@/components/nuevo/SelectorDeFecha"
import {
  PASOS, TOPE_DE_FECHAS_CLAVE, TOPE_DEL_BRIEF, TOPE_DEL_CAMBIO, TOPE_DEL_NOMBRE, TOPE_DEL_QUE, VACIAS,
  SIN_PLAN_APROBADO, clavesLlenas, hayAlgoEscrito, nuevaLlave, cuerpoDeCrear, dolares, fechaCorta, fechasDelMinimo, hoyEnEcuador, minimoDeLaRespuesta, minimoDelRechazo, pasosListos, topeEscrito, type RespuestasDeCrear,
} from "@/lib/crear-campana"

// 21-nov · `focus-visible:shadow-none`: la regla global de foco pone una sombra violeta; el foco del estilo base es el borde dorado
const CAMPO = "w-full min-w-0 border-b border-linea-oro bg-transparent text-hueso focus:border-oro focus:outline-none focus-visible:shadow-none"
const CAJA = "w-full resize-none rounded-control border border-linea bg-grafito-2 px-4 py-3 text-cuerpo text-hueso focus:border-linea-oro focus:outline-none focus-visible:shadow-none"
/** la fecha se escribe con el selector del navegador, invisible encima del texto «5 dic 2026» (el formato del navegador no se muestra) */

function IconoDeCalendario() {
  return <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 text-gris" fill="none" stroke="currentColor" strokeWidth={1.6}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>
}

function Progreso({ paso }: { paso: number }) {
  const total = PASOS.length
  return (
    <div data-progreso className="mb-8">
      <div className="grid grid-cols-5 gap-1.5" aria-hidden>
        {PASOS.map((p, i) => <span key={p.clave} data-tramo={i <= paso ? "hecho" : "falta"} className={`h-[2px] rounded-full ${i <= paso ? "bg-oro" : "bg-linea"}`} />)}
      </div>
      <p data-posicion className="mt-3 text-center text-rotulo uppercase tracking-rotulo text-gris [font-variant-numeric:tabular-nums]">{paso < total ? `${paso + 1} de ${total}` : "Resumen"}</p>
    </div>
  )
}

function Pregunta({ paso }: { paso: number }) {
  const p = PASOS[paso]
  return (
    <div className="mb-6 text-center">
      <p data-rotulo-del-paso className={ROTULO}>{p.rotulo}</p>
      {p.pregunta && <p data-pregunta className="mx-auto mt-2 max-w-[460px] text-titulo font-medio text-hueso">{p.pregunta}</p>}
    </div>
  )
}

/** el código de la plataforma detrás de la respuesta de la acción: un 409 llega en `plataforma.error`; otro rechazo, en `plataforma_error` */
export function codigoDeNoCrear(j: Record<string, unknown> | null): string {
  const p = j?.plataforma && typeof j.plataforma === "object" ? (j.plataforma as Record<string, unknown>).error : undefined
  return String(p ?? j?.plataforma_error ?? j?.error ?? "")
}
export const SIN_PLAN = "El cliente no tiene su Plan de Marketing aprobado. No se puede crear una campaña."
/** lo que la pantalla dice cuando la plataforma no creó la campaña (sin jerga ni montos) · códigos del contrato de CC1 (21:04Z) */
// 21-nov · «Campaña en proceso»: el botón dorado del estilo base, encendido, con un indicador que gira (quieto si se pide menos movimiento)
const EN_PROCESO = "flex min-h-12 cursor-progress items-center justify-center gap-3 rounded-control border border-oro bg-oro px-3 text-boton font-medio text-carbon focus:outline-none focus-visible:shadow-none"
function Girando() {
  return (
    <svg data-girando viewBox="0 0 24 24" aria-hidden className="h-5 w-5 animate-spin motion-reduce:animate-none" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
      <circle cx="12" cy="12" r="9" opacity={0.25} /><path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  )
}

/** 21-nov (#54 del barrido) · la pregunta antes de cerrar con algo escrito */
export const AL_CERRAR = "¿Cerrar sin crear? Se pierde lo que escribiste."
/** 21-nov (#54 parte 2 · texto aprobado por Lenovo 05:35Z) · el reintento volvió «ya_pedida» y lo escrito después no entró */
export const CON_LO_ANTERIOR = "La campaña ya se había pedido con el brief anterior; tus cambios no entraron. Puedes pedirlos desde el brief, en el Centro."
export const SIN_NACER = "El pedido salió, pero la campaña todavía no aparece. Revisa en unos minutos."

export function motivoDeNoCrear(j: Record<string, unknown> | null): string {
  const e = codigoDeNoCrear(j)
  if (e === "tope_bajo_minimo") return "El tope quedó debajo del mínimo. Revísalo."
  if (e === SIN_PLAN_APROBADO) return SIN_PLAN
  if (e === "todavia_no_disponible") return "Todavía no se puede crear: falta la parte de la plataforma. No se creó nada."
  if (e === "sin_sesion" || e === "sin_permiso") return "Tu sesión no tiene permiso para crear campañas."
  if ((e === "pedido_invalido" || e === "entrada_invalida") && typeof j?.detalle === "string" && j.detalle) return `No se creó: ${j.detalle}.`
  if (e === "cadena_no_admite") return "Este cliente todavía no puede tener campañas nuevas. No se creó nada."
  if (e === "minimo_ilegible") return "No se pudo calcular el mínimo. No se creó nada: inténtalo otra vez."
  if (e === "conflicto") return "Otra decisión se adelantó. No se creó nada: inténtalo otra vez."
  return "La plataforma no contestó. No se creó nada: inténtalo otra vez."
}

export function FormularioCrearCampana({ clienteId, clienteNombre, onCerrar, onCreada, sinNacer = false, inicial = VACIAS, pasoInicial = 0, minimoInicial }: {
  clienteId: string
  clienteNombre: string | null
  onCerrar: () => void
  /** la campaña quedó pedida (con este nombre; si ya había nacido, «ya_pedida» trae su id): el Centro relee sus lugares hasta verla nacer */
  onCreada: (nombre: string, campanaId?: string | null, quedarse?: boolean) => void
  // `quedarse` (21-nov · #54 parte 2): la campaña ya estaba pedida con lo escrito antes; el formulario se queda abierto con el aviso hasta que el dueño lo cierre
  /** 21-nov · el Centro esperó y la campaña no apareció: el formulario lo dice en el lugar del motivo y el botón vuelve */
  sinNacer?: boolean
  /** pruebas e imagen */
  inicial?: RespuestasDeCrear
  pasoInicial?: number
  /** pruebas e imagen: el mínimo ya leído (undefined = se lee de la plataforma al abrir) */
  minimoInicial?: number | null
}) {
  const [paso, setPaso] = useState(pasoInicial)
  const [r, setR] = useState<RespuestasDeCrear>(inicial)
  const [minimo, setMinimo] = useState<number | null>(minimoInicial ?? null)
  const [sinPlan, setSinPlan] = useState(false)
  const [enviando, setEnviando] = useState(false)
  // 21-nov (GO Lenovo 01:40Z · Emilio no vio respuesta al clic) · el pedido ya salió: la campaña nace poco después en la puerta; el botón sigue trabajando hasta entonces
  const [pedida, setPedida] = useState(false)
  const enProceso = enviando || pedida
  // el candado del envío: una referencia, no el estado (dos toques antes de repintar verían el estado viejo y mandarían dos)
  const enCurso = useRef(false)
  // el pedido ya salió (la plataforma lo guardó): cerrar no pierde nada · y cerrar pedido mientras el pedido vuela, que se cumple al saber la respuesta
  const yaSalio = useRef(false)
  const cerrarAlSaber = useRef(false)
  // 21-nov (#54 parte 2 · Lenovo 05:35Z) · lo mandado en cada intento desde el último guardado confirmado: si «ya_pedida» llega con algo distinto, lo nuevo no entró
  const intentos = useRef<string[]>([])
  const [problema, setProblema] = useState<string | null>(null)
  // 21-nov (🟡 de CC5) · vencida la espera, se avisa: el pedido salió, la campaña todavía no se ve (otro «Crear Campaña» lleva la misma llave: no duplica)
  useEffect(() => { if (sinNacer) { setPedida(false); setProblema(SIN_NACER) } }, [sinNacer])
  // `llave_formulario`: UNA por formulario abierto, así un doble toque o un reintento da «ya pedida» y no abre dos campañas
  const llave = useMemo(() => nuevaLlave(), [])

  // el mínimo depende de las fechas (la plataforma compara con el de las fechas de la campaña): se pide con ellas y se vuelve a pedir al cambiarlas
  const fechas = fechasDelMinimo(r.inicio, r.fin)
  const conFechas = fechas ? `&inicio=${encodeURIComponent(fechas.inicio)}&fin=${encodeURIComponent(fechas.fin)}` : ""
  // cada lectura lleva su número: si llega tarde una vieja (otras fechas), no pisa a la nueva
  const vez = useRef(0)
  const leerMinimo = useMemo(() => async () => {
    const esta = ++vez.current
    setMinimo(null)
    try {
      const res = await fetch(`/api/crear-campana/minimo?cliente=${encodeURIComponent(clienteId)}${conFechas}`, { cache: "no-store" })
      const j = await res.json().catch(() => null)
      if (esta !== vez.current) return
      setMinimo(res.ok ? minimoDeLaRespuesta(j) : null)
      setSinPlan(!res.ok && (j as Record<string, unknown> | null)?.error === SIN_PLAN_APROBADO)
    } catch { if (esta === vez.current) { setMinimo(null); setSinPlan(false) } }
  }, [clienteId, conFechas])
  const primera = useRef(true)
  useEffect(() => {
    if (primera.current) { primera.current = false; if (minimoInicial !== undefined) return }
    void leerMinimo()
  }, [leerMinimo]) // eslint-disable-line react-hooks/exhaustive-deps -- `minimoInicial` solo cuenta al abrir
  // 21-nov (#54 del barrido · Lenovo 05:01Z) · cerrar (Esc, «Cerrar» o un clic fuera) con algo escrito pregunta antes de perderlo; ya pedida la campaña, no se pierde nada
  const [preguntaCerrar, setPreguntaCerrar] = useState(false)
  // 21-nov (🔴 de CC5 05:24Z) · con el pedido EN VUELO nunca se dice «sin crear»: cerrar espera la respuesta (si salió, cierra; si falló, el motivo queda a la vista).
  // Se leen referencias (no el estado): siempre dicen lo de este instante, aunque la tecla tenga una pintada vieja
  const pedirCerrar = () => {
    if (yaSalio.current) onCerrar()
    else if (enCurso.current) cerrarAlSaber.current = true
    else if (!hayAlgoEscrito(r)) onCerrar()
    else setPreguntaCerrar(true)
  }
  // Esc cierra el formulario y vuelve al Centro (no cierra el Centro ni la oficina); con la pregunta a la vista, Esc es «Seguir escribiendo»
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if ((e.target as Element | null)?.closest?.("[data-calendario-abierto], [data-calendario]")) return // 21-nov · Esc con el calendario abierto (en la casilla o en el calendario) cierra solo el calendario
      e.stopPropagation(); e.preventDefault()
      if (preguntaCerrar) setPreguntaCerrar(false); else pedirCerrar()
    }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }) // corre en cada pintada: lee lo escrito y la pregunta del momento

  const hoy = hoyEnEcuador()
  // dónde se abren los calendarios: debajo de inicio y fin, y debajo de las fechas clave (a todo lo ancho, sin que el panel los recorte)
  const [sitioDeFechas, setSitioDeFechas] = useState<HTMLElement | null>(null)
  const [sitioDeClaves, setSitioDeClaves] = useState<HTMLElement | null>(null)
  const listo = pasosListos(r, minimo, hoy)
  const resumen = paso === PASOS.length
  const tope = topeEscrito(r.tope)
  const bajoElMinimo = r.tope.trim() !== "" && minimo != null && (tope == null || tope < minimo)
  const cambiar = (p: Partial<RespuestasDeCrear>) => { setR({ ...r, ...p }); setProblema(null); setPreguntaCerrar(false) }
  const cambiarClave = (i: number, p: Partial<{ fecha: string; que: string }>) => cambiar({ claves: r.claves.map((c, k) => (k === i ? { ...c, ...p } : c)) })

  const crear = async () => {
    if (enCurso.current || !llave || !listo.every(Boolean)) return
    enCurso.current = true; setEnviando(true); setProblema(null)
    const contenido = JSON.stringify(cuerpoDeCrear(clienteId, llave, r))
    const antes = intentos.current
    intentos.current = [...antes, contenido]
    try {
      const res = await fetch("/api/acciones/crear-campana", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpoDeCrear(clienteId, llave, r)) })
      const j = (await res.json().catch(() => null)) as Record<string, unknown> | null
      if (res.ok && j?.ok === true) {
        // «ya_pedida» con algo distinto de lo mandado antes: la campaña quedó con lo anterior (la plataforma no la rehace) y se dice; «pedida» o «actualizada» = quedó lo de ahora
        const conLoAnterior = j.estado === "ya_pedida" && antes.some((x) => x !== contenido)
        if (j.estado !== "ya_pedida") intentos.current = [contenido]
        yaSalio.current = true; setPedida(true)
        if (conLoAnterior) setProblema(CON_LO_ANTERIOR)
        onCreada(r.nombre, typeof j.campana_id === "string" ? j.campana_id : null, conLoAnterior)
        if (cerrarAlSaber.current && !conLoAnterior) onCerrar()
        return
      }
      cerrarAlSaber.current = false
      // el mínimo pudo cambiar entre leerlo y crear: se muestra el que trae el rechazo (el de las fechas de la campaña) y se vuelve a la pregunta del tope
      if (codigoDeNoCrear(j) === "tope_bajo_minimo") {
        const delRechazo = minimoDelRechazo(j)
        if (delRechazo != null) setMinimo(delRechazo); else await leerMinimo()
        setPaso(3)
      }
      setProblema(motivoDeNoCrear(j))
    } catch {
      cerrarAlSaber.current = false
      setProblema(motivoDeNoCrear(null))
    } finally { enCurso.current = false; setEnviando(false) }
  }

  return (
    <PanelBase titulo="Crear Campaña" id="crear-campana-titulo" seccion="crear-campana" onCerrar={pedirCerrar} etiquetaCerrar="Cerrar" ancho="max-w-[640px]">
      <div className="mb-6 mt-1 flex justify-center"><ClienteComoTexto nombre={clienteNombre} /></div>
      <Progreso paso={paso} />

      {!resumen && <Pregunta paso={paso} />}

      {paso === 0 && (
        <input data-campo="nombre" aria-label="Nombre" value={r.nombre} maxLength={TOPE_DEL_NOMBRE} autoFocus onChange={(e) => cambiar({ nombre: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter" && listo[0]) setPaso(1) }} className={`${CAMPO} py-2 text-center text-titulo`} />
      )}

      {paso === 1 && (
        <textarea data-campo="cambio" aria-label="Cambio" value={r.cambio} rows={4} maxLength={TOPE_DEL_CAMBIO} autoFocus onChange={(e) => cambiar({ cambio: e.target.value })} className={CAJA} />
      )}

      {paso === 2 && (
        <div data-campo="fechas">
          <div className="grid grid-cols-2 gap-3">
            {(["inicio", "fin"] as const).map((k) => (
              <div key={k} data-fecha={k} className="rounded-tarjeta border border-linea bg-grafito-2 px-4 py-4 text-center focus-within:border-linea-oro">
                <span className={`block ${ROTULO}`}>{k === "inicio" ? "Inicio" : "Fin"}</span>
                <span className="mt-2 flex items-center justify-center gap-2">
                  <span className="w-[120px]"><SelectorDeFecha valor={r[k]} onCambio={(iso) => cambiar({ [k]: iso })} etiqueta={k === "inicio" ? "Inicio" : "Fin"} hoy={hoy}
                    rango={{ inicio: r.inicio, fin: r.fin }} desde={k === "fin" && r.inicio ? r.inicio : hoy} clase="text-center text-cuerpo font-medio text-hueso" sitio={sitioDeFechas} /></span>
                  <IconoDeCalendario />
                </span>
              </div>
            ))}
          </div>
          <div ref={setSitioDeFechas} data-sitio-del-calendario="fechas" />
          <p className={`mb-2 mt-6 text-center ${ROTULO}`}>Fechas clave</p>
          <ul data-fechas-clave className="border-t border-linea">
            {r.claves.map((c, i) => (
              <li key={i} data-fecha-clave className="grid grid-cols-[120px_1fr] items-center gap-3 border-b border-linea px-2 py-3">
                <SelectorDeFecha valor={c.fecha} onCambio={(iso) => cambiarClave(i, { fecha: iso })} etiqueta={`Fecha clave ${i + 1}`} hoy={hoy}
                  rango={{ inicio: r.inicio, fin: r.fin }} desde={hoy} clase="text-dato text-gris [font-variant-numeric:tabular-nums]" sitio={sitioDeClaves} />
                <input aria-label={`Qué pasa en la fecha clave ${i + 1}`} value={c.que} maxLength={TOPE_DEL_QUE} onChange={(e) => cambiarClave(i, { que: e.target.value })}
                  className="w-full min-w-0 bg-transparent text-cuerpo text-hueso focus:outline-none" />
              </li>
            ))}
          </ul>
          <div ref={setSitioDeClaves} data-sitio-del-calendario="claves" />
          <div className="mt-3 flex justify-center">
            <button type="button" data-agregar-fecha-clave disabled={r.claves.length >= TOPE_DE_FECHAS_CLAVE} onClick={() => cambiar({ claves: [...r.claves, { fecha: "", que: "" }] })} className={`${BOTON_SECUNDARIO} px-5`}>+ Agregar</button>
          </div>
        </div>
      )}

      {paso === 3 && (
        <div data-campo="tope" className="grid grid-cols-2 gap-3">
          <label className="rounded-tarjeta border border-linea-oro bg-grafito-2 px-4 py-5 text-center">
            <span className={`block ${ROTULO}`}>Tope</span>
            <span className="mt-2 flex items-baseline justify-center gap-2">
              <span className="text-dato text-gris">US$</span>
              <input aria-label="Tope" value={r.tope} inputMode="decimal" autoFocus required onChange={(e) => cambiar({ tope: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter" && listo[3]) setPaso(4) }} className={`${CAMPO} w-28 text-center text-cifra font-medio [font-variant-numeric:tabular-nums]`} />
            </span>
          </label>
          <div data-minimo className="rounded-tarjeta border border-linea bg-grafito-2 px-4 py-5 text-center">
            <span className={`block ${ROTULO}`}>Mínimo</span>
            <span data-minimo-valor={minimo ?? ""} className={`mt-2 block text-cifra font-medio [font-variant-numeric:tabular-nums] ${bajoElMinimo ? "text-alarma" : "text-hueso"}`}>{minimo == null ? "—" : dolares(minimo)}</span>
          </div>
        </div>
      )}

      {paso === 4 && (
        <textarea data-campo="brief" aria-label="Tu brief" value={r.brief} rows={10} maxLength={TOPE_DEL_BRIEF} autoFocus onChange={(e) => cambiar({ brief: e.target.value })} className={CAJA} />
      )}

      {resumen && (
        <div data-resumen className="border-t border-linea">
          <div className="border-b border-linea py-4"><Pares pares={[{ rotulo: "Nombre", valor: r.nombre.trim() }]} /></div>
          <div className="border-b border-linea py-4"><Pares pares={[{ rotulo: "Cambio", valor: r.cambio.trim() }]} valor="text-cuerpo" /></div>
          <div className="border-b border-linea py-4"><Pares pares={[{ rotulo: "Inicio", valor: fechaCorta(r.inicio) }, { rotulo: "Fin", valor: fechaCorta(r.fin) }]} /></div>
          {clavesLlenas(r.claves).length > 0 && (
            <div className="border-b border-linea py-4"><Pares pares={[{ rotulo: "Fechas clave", valor: clavesLlenas(r.claves).map((c) => `${fechaCorta(c.fecha)} · ${c.que}`).join("\n") }]} valor="whitespace-pre-line text-cuerpo" /></div>
          )}
          <div className="border-b border-linea py-4"><Pares pares={[{ rotulo: "Tope", valor: tope == null ? "—" : dolares(tope) }, { rotulo: "Mínimo", valor: minimo == null ? "—" : dolares(minimo) }]} /></div>
          <div className="border-b border-linea py-4"><Pares pares={[{ rotulo: "Tu brief", valor: <span className="line-clamp-4">{r.brief.trim()}</span> }]} valor="text-cuerpo" /></div>
        </div>
      )}

      {preguntaCerrar && (
        // el mismo aviso de «¿Retirar esta idea?» del banco (BancoDeIdeas), en el lugar del motivo
        <div role="alertdialog" aria-label="¿Cerrar sin crear?" data-aviso-cerrar className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-tarjeta border border-linea-alarma bg-carbon px-3 py-2">
          <span className="text-dato text-hueso">{AL_CERRAR}</span>
          <button type="button" data-accion="confirmar-cerrar" onClick={onCerrar} className="rounded-control border border-linea-alarma px-3 py-1 text-dato text-alarma hover:border-alarma">Sí, cerrar</button>
          <button type="button" data-accion="seguir-escribiendo" autoFocus onClick={() => setPreguntaCerrar(false)} className="rounded-control border border-linea px-3 py-1 text-dato text-gris hover:bg-grafito">Seguir escribiendo</button>
        </div>
      )}
      {!preguntaCerrar && !problema && sinPlan && (paso === 3 || resumen) && <p role="alert" data-problema className="mt-4 border-y border-linea-alarma py-3 text-center text-dato text-hueso">{SIN_PLAN}</p>}
      {!preguntaCerrar && problema && <p role="alert" data-problema className="mt-4 border-y border-linea-alarma py-3 text-center text-dato text-hueso">{problema}</p>}

      <Acciones>
        <button type="button" data-atras disabled={paso === 0 || enProceso} onClick={() => { setPaso(paso - 1); setProblema(null) }} className={`${BOTON_SECUNDARIO} min-h-12`}>Atrás</button>
        {resumen
          ? (enProceso
            // trabajando: dorado y encendido (no apagado), con el indicador que gira; otro clic no manda nada (`crear` ya está en curso)
            ? <button type="button" data-crear data-en-proceso aria-busy="true" aria-disabled="true" className={EN_PROCESO}><Girando />Campaña en proceso</button>
            : <button type="button" data-crear disabled={!llave || !listo.every(Boolean)} onClick={() => void crear()} className={`${BOTON_PRINCIPAL} min-h-12`}>Crear Campaña</button>)
          : <button type="button" data-siguiente disabled={!listo[paso]} onClick={() => setPaso(paso + 1)} className={`${BOTON_PRINCIPAL} min-h-12`}>Siguiente</button>}
      </Acciones>
    </PanelBase>
  )
}
