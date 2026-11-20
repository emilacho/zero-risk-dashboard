"use client"

/**
 * EL FORMULARIO «CREAR CAMPAÑA» (20-nov · GO Lenovo 22:05 Zúrich · boceto aprobado por Emilio 22:03, «PERFECTO», con la pregunta escrita debajo del rótulo:
 * `raw/evidencia/2026-11-20-boceto-crear-campana-formulario/`). Estructura de Typeform, fachada del estilo base:
 *   · una pregunta por pantalla: rótulo dorado de 1 o 2 palabras y la pregunta debajo; arriba la barra de 5 tramos con «N de 5»;
 *   · «Atrás» (borde oro) a la izquierda y «Siguiente» (ámbar) a la derecha; «Siguiente» se apaga mientras falta la respuesta;
 *   · el tope es obligatorio y lleva al lado el MÍNIMO que lee la plataforma; debajo del mínimo, el número del mínimo en rojo. Sin mínimo leído, no se puede crear;
 *   · el último paso es el resumen con «Crear Campaña». El tablero no escribe la base: lo manda `POST /api/acciones/crear-campana` a la plataforma.
 * Las reglas viven en `lib/crear-campana.ts` (las mismas que exige el servidor del tablero).
 */
import { useEffect, useMemo, useState } from "react"
import { Acciones, BOTON_PRINCIPAL, BOTON_SECUNDARIO, Pares, PanelBase, ROTULO } from "@/components/nuevo/EstiloBase"
import { ClienteComoTexto } from "@/components/nuevo/ClienteComoTexto"
import {
  PASOS, TOPE_DE_FECHAS_CLAVE, TOPE_DEL_BRIEF, TOPE_DEL_CAMBIO, TOPE_DEL_NOMBRE, TOPE_DEL_QUE, VACIAS,
  clavesLlenas, cuerpoDeCrear, dolares, fechaCorta, minimoDeLaRespuesta, pasosListos, topeEscrito, type RespuestasDeCrear,
} from "@/lib/crear-campana"

const CAMPO = "w-full min-w-0 border-b border-linea-oro bg-transparent text-hueso focus:border-oro focus:outline-none"
const CAJA = "w-full resize-none rounded-control border border-linea bg-grafito-2 px-4 py-3 text-cuerpo text-hueso focus:border-linea-oro focus:outline-none"
/** la fecha se escribe con el selector del navegador, invisible encima del texto «5 dic 2026» (el formato del navegador no se muestra) */
const SELECTOR_DE_FECHA = "absolute inset-0 h-full w-full cursor-pointer opacity-0"

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

/** lo que la pantalla dice cuando la plataforma no creó la campaña (sin jerga ni montos) */
export function motivoDeNoCrear(j: Record<string, unknown> | null): string {
  const e = String(j?.plataforma_error ?? j?.error ?? "")
  if (e === "tope_bajo_el_minimo") return "El tope quedó debajo del mínimo. Revísalo."
  if (e === "todavia_no_disponible") return "Todavía no se puede crear: falta la parte de la plataforma. No se creó nada."
  if (e === "conflicto") return "Esta campaña ya se había pedido. No se creó otra."
  if (e === "sin_sesion" || e === "sin_permiso") return "Tu sesión no tiene permiso para crear campañas."
  if (e === "pedido_invalido" && typeof j?.detalle === "string") return `No se creó: ${j.detalle}.`
  return "La plataforma no contestó. No se creó nada: inténtalo otra vez."
}

export function FormularioCrearCampana({ clienteId, clienteNombre, onCerrar, onCreada, inicial = VACIAS, pasoInicial = 0, minimoInicial }: {
  clienteId: string
  clienteNombre: string | null
  onCerrar: () => void
  /** la campaña quedó pedida: el Centro vuelve a leer sus lugares */
  onCreada: () => void
  /** pruebas e imagen */
  inicial?: RespuestasDeCrear
  pasoInicial?: number
  /** pruebas e imagen: el mínimo ya leído (undefined = se lee de la plataforma al abrir) */
  minimoInicial?: number | null
}) {
  const [paso, setPaso] = useState(pasoInicial)
  const [r, setR] = useState<RespuestasDeCrear>(inicial)
  const [minimo, setMinimo] = useState<number | null>(minimoInicial ?? null)
  const [enviando, setEnviando] = useState(false)
  const [problema, setProblema] = useState<string | null>(null)
  // la llave del pedido: UNA por formulario abierto, así tocar «Crear Campaña» dos veces no crea dos campañas
  const llave = useMemo(() => `crear-${crypto.randomUUID()}`, [])

  const leerMinimo = useMemo(() => async () => {
    try {
      const res = await fetch(`/api/crear-campana/minimo?cliente=${encodeURIComponent(clienteId)}`, { cache: "no-store" })
      setMinimo(res.ok ? minimoDeLaRespuesta(await res.json().catch(() => null)) : null)
    } catch { setMinimo(null) }
  }, [clienteId])
  useEffect(() => { if (minimoInicial === undefined) void leerMinimo() }, [minimoInicial, leerMinimo])
  // Esc cierra el formulario y vuelve al Centro (no cierra el Centro ni la oficina)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onCerrar() } }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar])

  const listo = pasosListos(r, minimo)
  const resumen = paso === PASOS.length
  const tope = topeEscrito(r.tope)
  const bajoElMinimo = r.tope.trim() !== "" && minimo != null && (tope == null || tope < minimo)
  const cambiar = (p: Partial<RespuestasDeCrear>) => { setR({ ...r, ...p }); setProblema(null) }
  const cambiarClave = (i: number, p: Partial<{ fecha: string; que: string }>) => cambiar({ claves: r.claves.map((c, k) => (k === i ? { ...c, ...p } : c)) })

  const crear = async () => {
    if (enviando || !listo.every(Boolean)) return
    setEnviando(true); setProblema(null)
    try {
      const res = await fetch("/api/acciones/crear-campana", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpoDeCrear(clienteId, llave, r)) })
      const j = (await res.json().catch(() => null)) as Record<string, unknown> | null
      if (res.ok && j?.ok === true) { onCreada(); return }
      // el mínimo pudo cambiar entre leerlo y crear: se vuelve a leer y se vuelve a la pregunta del tope
      if (String(j?.plataforma_error ?? "") === "tope_bajo_el_minimo") { await leerMinimo(); setPaso(3) }
      setProblema(motivoDeNoCrear(j))
    } catch {
      setProblema(motivoDeNoCrear(null))
    } finally { setEnviando(false) }
  }

  return (
    <PanelBase titulo="Crear Campaña" id="crear-campana-titulo" seccion="crear-campana" onCerrar={onCerrar} etiquetaCerrar="Cerrar" ancho="max-w-[640px]">
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
              <label key={k} className="relative rounded-tarjeta border border-linea bg-grafito-2 px-4 py-4 text-center focus-within:border-linea-oro">
                <span className={`block ${ROTULO}`}>{k === "inicio" ? "Inicio" : "Fin"}</span>
                <span data-fecha={k} className="mt-2 flex items-center justify-center gap-2 text-cuerpo font-medio text-hueso">{fechaCorta(r[k])}<IconoDeCalendario /></span>
                <input type="date" aria-label={k === "inicio" ? "Inicio" : "Fin"} value={r[k]} onChange={(e) => cambiar({ [k]: e.target.value })} className={SELECTOR_DE_FECHA} />
              </label>
            ))}
          </div>
          <p className={`mb-2 mt-6 text-center ${ROTULO}`}>Fechas clave</p>
          <ul data-fechas-clave className="border-t border-linea">
            {r.claves.map((c, i) => (
              <li key={i} data-fecha-clave className="grid grid-cols-[120px_1fr] items-center gap-3 border-b border-linea px-2 py-3">
                <span className="relative flex items-center gap-2 text-dato text-gris [font-variant-numeric:tabular-nums]">
                  {fechaCorta(c.fecha)}
                  <input type="date" aria-label={`Fecha clave ${i + 1}`} value={c.fecha} onChange={(e) => cambiarClave(i, { fecha: e.target.value })} className={SELECTOR_DE_FECHA} />
                </span>
                <input aria-label={`Qué pasa en la fecha clave ${i + 1}`} value={c.que} maxLength={TOPE_DEL_QUE} onChange={(e) => cambiarClave(i, { que: e.target.value })}
                  className="w-full min-w-0 bg-transparent text-cuerpo text-hueso focus:outline-none" />
              </li>
            ))}
          </ul>
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

      {problema && <p role="alert" data-problema className="mt-4 border-y border-linea-alarma py-3 text-center text-dato text-hueso">{problema}</p>}

      <Acciones>
        <button type="button" data-atras disabled={paso === 0 || enviando} onClick={() => { setPaso(paso - 1); setProblema(null) }} className={`${BOTON_SECUNDARIO} min-h-12`}>Atrás</button>
        {resumen
          ? <button type="button" data-crear disabled={!listo.every(Boolean) || enviando} onClick={() => void crear()} className={`${BOTON_PRINCIPAL} min-h-12`}>Crear Campaña</button>
          : <button type="button" data-siguiente disabled={!listo[paso]} onClick={() => setPaso(paso + 1)} className={`${BOTON_PRINCIPAL} min-h-12`}>Siguiente</button>}
      </Acciones>
    </PanelBase>
  )
}
