"use client"

import { PLAN_ESPERA_EL_MANUAL } from "@/lib/manual-primero"
import { clienteRecordadoEn, guardarClienteDeTrabajo, leerClienteDeTrabajo } from "@/lib/cliente-de-trabajo"
import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import type { Pizarron } from "@/lib/pizarron-datos"
import { APLICACIONES, type ClaveDeAplicacion } from "@/lib/aplicaciones-marketing"
import { PanelPizarron, textoDeLaFase } from "@/components/nuevo/PanelPizarron"
import { PanelManual } from "@/components/nuevo/PanelManual"
import { PanelPlan } from "@/components/nuevo/PanelPlan"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import { PanelInformes } from "@/components/nuevo/PanelInformes"
import { PanelBrief } from "@/components/nuevo/PanelBrief"
import { PanelGranIdea } from "@/components/nuevo/PanelGranIdea"
import { ClienteComoTexto, useAlCambiarElCliente } from "@/components/nuevo/ClienteComoTexto"
import { EVENTO_ABRIR_PLANTEL, type PedidoDePlantel } from "@/lib/buscador"
import type { Centro } from "@/lib/centro-datos"
import { PanelBase } from "@/components/nuevo/EstiloBase"
import { tarjetaDelCentro, type TonoDeEstado } from "@/lib/centro-tarjetas"

type Respuesta = ({ ok: true } & Pizarron) | { ok: false; error: string }
type RespuestaCentro = ({ ok: true } & Centro) | { ok: false; error: string }


/** el icono de cada cuadro: trazos finos en ámbar, como los rótulos de la escena */
function Icono({ clave }: { clave: ClaveDeAplicacion }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  switch (clave) {
    case "manual": return <svg viewBox="0 0 32 32" aria-hidden className="ap-icono h-11 w-11 text-ambar"><path {...p} d="M6 7.5A2.5 2.5 0 0 1 8.5 5H16v21H8.5A2.5 2.5 0 0 0 6 28.5V7.5ZM26 7.5A2.5 2.5 0 0 0 23.5 5H16v21h7.5a2.5 2.5 0 0 1 2.5 2.5V7.5Z" /><path {...p} d="M9.5 10.5h3.5M9.5 14h3.5M19 10.5h3.5M19 14h3.5" /></svg>
    case "plan": return <svg viewBox="0 0 32 32" aria-hidden className="ap-icono h-11 w-11 text-ambar"><path {...p} d="M5 26h22M8 26V14M16 26V8M24 26v-9" /><path {...p} d="M8 14l8-6 8 3" /><circle cx="8" cy="14" r="1.6" {...p} /><circle cx="16" cy="8" r="1.6" {...p} /><circle cx="24" cy="11" r="1.6" {...p} /></svg>
    case "calendario": return <svg viewBox="0 0 32 32" aria-hidden className="ap-icono h-11 w-11 text-ambar"><rect x="5" y="7" width="22" height="20" rx="2.5" {...p} /><path {...p} d="M5 12.5h22M11 4.5v5M21 4.5v5" /><path {...p} d="M9.5 17h3v3h-3zM14.5 17h3v3h-3zM19.5 17h3v3h-3zM9.5 22h3v3h-3zM14.5 22h3v3h-3z" /></svg>
    case "piezas": return <svg viewBox="0 0 32 32" aria-hidden className="ap-icono h-11 w-11 text-ambar"><rect x="4" y="9" width="18" height="18" rx="2" {...p} /><path {...p} d="M10 5h16a2 2 0 0 1 2 2v16" /><path {...p} d="M4 22l5-5 4 4 3-3 6 6" /><circle cx="16" cy="14" r="1.8" {...p} /></svg>
    case "brief": return <svg viewBox="0 0 32 32" aria-hidden className="ap-icono h-11 w-11 text-ambar"><path {...p} d="M7 6h18v22H7z" /><path {...p} d="M11 12h10M11 16h10M11 20h6" /><path {...p} d="M12 3v5M20 3v5" /></svg>
    case "gran_idea": return <svg viewBox="0 0 32 32" aria-hidden className="ap-icono h-11 w-11 text-ambar"><path {...p} d="M16 4a8 8 0 0 0-4.5 14.6c.9.7 1.5 1.7 1.5 2.9V23h6v-1.5c0-1.2.6-2.2 1.5-2.9A8 8 0 0 0 16 4Z" /><path {...p} d="M13 26h6M14 29h4" /><path {...p} d="M16 10v4M14 12h4" /></svg>
    case "equipo": return <svg viewBox="0 0 32 32" aria-hidden className="ap-icono h-11 w-11 text-ambar"><circle cx="16" cy="10" r="3.5" {...p} /><circle cx="7.5" cy="13" r="2.8" {...p} /><circle cx="24.5" cy="13" r="2.8" {...p} /><path {...p} d="M10 25c0-4 2.7-6.5 6-6.5s6 2.5 6 6.5" /><path {...p} d="M3 24c0-3 2-5 4.5-5 .9 0 1.7.2 2.4.6M29 24c0-3-2-5-4.5-5-.9 0-1.7.2-2.4.6" /></svg>
    case "informes": return <svg viewBox="0 0 32 32" aria-hidden className="ap-icono h-11 w-11 text-ambar"><path {...p} d="M8 4h11l6 6v18H8V4Z" /><path {...p} d="M19 4v6h6" /><path {...p} d="M12 22v-4M16 22v-7M20 22v-5" /><path {...p} d="M12 13h3" /></svg>
    case "gasto": return <svg viewBox="0 0 32 32" aria-hidden className="ap-icono h-11 w-11 text-ambar"><circle cx="16" cy="16" r="11" {...p} /><path {...p} d="M16 9.5v13M19.5 12.5c0-1.5-1.5-2.5-3.5-2.5s-3.5 1-3.5 2.5 1.5 2.3 3.5 2.6 3.5 1.2 3.5 2.7-1.5 2.7-3.5 2.7-3.5-1-3.5-2.5" /></svg>
  }
}

/** la segunda línea de cada cuadro: un dato de la lectura cuando lo hay, si no la descripción fija */
export function detalleDelCuadro(clave: ClaveDeAplicacion, datos: Pizarron | null, centro: Centro | null = null): { texto: string; aviso: boolean } {
  const fijo = APLICACIONES.find((a) => a.clave === clave)!.descripcion
  // 6.10: la segunda línea de informes · brief · gran idea · equipo la trae una lectura aparte (`/api/centro`), con lo real o con lo que falta
  if (centro) {
    if (clave === "informes") return { texto: centro.informes.texto, aviso: centro.informes.aviso }
    if (clave === "brief") return { texto: centro.brief.texto, aviso: centro.brief.aviso }
    if (clave === "gran_idea") return { texto: centro.gran_idea.texto, aviso: centro.gran_idea.aviso }
    if (clave === "equipo") return { texto: centro.equipo.texto, aviso: centro.equipo.aviso }
  }
  if (!datos) return { texto: fijo, aviso: false }
  // 03-nov (firma de Emilio 14:46Z): la cadena no sigue hasta que apruebes el manual
  // con una campaña en marcha, el plan NO espera: lo que espera es el manual nuevo (reserva 3 de CC3)
  if (clave === "plan" && datos.manual_aprobado === false) {
    // MANUAL PRIMERO (Lenovo 20:37Z): con o sin campaña, el mismo texto que el panel del Plan; el plan no se firma antes del manual
    return { texto: PLAN_ESPERA_EL_MANUAL, aviso: true }
  }
  if (clave === "plan") return { texto: datos.campana ? textoDeLaFase(datos) : "Sin campaña todavía", aviso: false }
  if (clave === "calendario") return { texto: datos.campana ? (datos.filas.length ? `${datos.filas.length} publicaciones${datos.campana.del_plan_anterior ? " · del plan anterior" : ""}` : "La campaña todavía no tiene publicaciones") : "Sin campaña todavía", aviso: false }
  if (clave === "piezas") {
    // las piezas del calendario de un plan anterior no esperan nada: ese plan ya no es el vigente
    if (datos.campana?.del_plan_anterior) return { texto: "Nada por aprobar del plan vigente", aviso: false }
    const n = datos.totales.emilio ?? 0; return { texto: n ? `${n} ${n === 1 ? "pieza espera" : "piezas esperan"} tu aprobación` : "Nada por aprobar ahora", aviso: n > 0 } }
  return { texto: fijo, aviso: false }
}

/** ESTILO BASE (Lenovo 06-nov, boceto 2): tarjetas más pequeñas y centradas, el ícono un poco más grande; sin sombras ni brillos */
/** 09-nov · sin panel de fondo: la tarjeta va directo sobre la escena con su color de hoy (token `tarjeta-escena`) y el borde tenue */
const CLASE_DEL_CUADRO = "ap-cuadro relative flex flex-col items-center rounded-tarjeta border border-linea bg-tarjeta-escena px-4 pb-4 pt-5 text-center hover:border-linea-oro focus-visible:outline focus-visible:outline-1 focus-visible:outline-oro"
const COLOR_DEL_TONO: Record<TonoDeEstado, string> = { oro: "text-oro", alarma: "text-alarma", gris: "text-gris" }
const PUNTO_DEL_TONO: Record<TonoDeEstado, string> = { oro: "bg-oro", alarma: "bg-alarma", gris: "bg-gris" }

export function PanelAplicaciones({ onCerrar, datosIniciales = null, centroInicial = null, vistaInicial }: { onCerrar: () => void; datosIniciales?: Pizarron | null; /** 09-nov · la lectura del centro ya hecha (pruebas e imagen); en la pantalla llega por `/api/centro` */ centroInicial?: Centro | null; /** 04-nov · abrir directo en una aplicación (el aviso del pizarrón abre el manual) */ vistaInicial?: ClaveDeAplicacion }) {
  const [datos, setDatos] = useState<Pizarron | null>(datosIniciales)
  const [centro, setCentro] = useState<Centro | null>(centroInicial)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [cliente, setCliente] = useState<string | null>(datosIniciales?.cliente?.id ?? null)
  const [vista, setVista] = useState<"inicio" | ClaveDeAplicacion>(vistaInicial ?? "inicio")
  // una pieza abierta desde el calendario: al cerrarla se vuelve al calendario, no a los cuadros
  const [piezaAbierta, setPiezaAbierta] = useState<{ id: string; desde: "calendario" | "inicio" } | null>(null)
  const primero = useRef<HTMLAnchorElement>(null)

  useEffect(() => { if (vista === "inicio") primero.current?.focus() }, [vista])
  // Esc cierra las aplicaciones y NO la oficina (captura + stop); cuando el calendario está encima, su propio Esc lo cierra y volvemos aquí
  useEffect(() => {
    if (vista !== "inicio") return
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onCerrar() } }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar, vista])

  const leer = useCallback(async (id: string | null) => {
    setCargando(true); setError(null)
    try {
      const r = await fetch(`/api/pizarron${id ? `?cliente=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Respuesta | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver las aplicaciones." : (j && !j.ok && j.error) || `No pude leer los datos del cliente (${r.status}).`)
      setDatos(j); setCliente(j.cliente?.id ?? null)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [])
  // CC6 · 02-nov (corrección urgente): abre en el cliente con el que Emilio trabaja (el último que eligió, recordado); sin recuerdo, decide el servidor
  useEffect(() => {
    if (datosIniciales) return
    const r = leerClienteDeTrabajo()
    void leer(r?.id ?? null)
  }, [leer, datosIniciales])
  // si solo se recuerda el nombre (elegido en «Seleccionar cliente» de arriba), se pasa a ese cliente apenas llega la lista
  useEffect(() => {
    if (!datos) return
    const id = clienteRecordadoEn(datos.clientes, leerClienteDeTrabajo())
    if (id && id !== datos.cliente?.id) void leer(id)
    else if (datos.cliente) guardarClienteDeTrabajo({ id: datos.cliente.id, nombre: datos.cliente.nombre })
  }, [datos, leer])
  // 06-nov · selector único: si se elige otro cliente arriba con el Centro abierto, el Centro se pasa a ese
  useAlCambiarElCliente(datos?.cliente?.id ?? cliente, (id) => void leer(id))
  // la segunda línea de los cuadros nuevos (6.10): una lectura liviana aparte, por cliente; si falla, los cuadros quedan con su descripción fija
  const idDelCentro = datos?.cliente?.id ?? null
  useEffect(() => {
    if (!datos) return
    let vivo = true
    setCentro(null)
    fetch(`/api/centro${idDelCentro ? `?cliente=${encodeURIComponent(idDelCentro)}` : ""}`, { cache: "no-store" })
      .then(async (r) => { const j = (await r.json().catch(() => null)) as RespuestaCentro | null; if (vivo && r.ok && j && j.ok) setCentro(j) })
      .catch(() => {})
    return () => { vivo = false }
  }, [datos, idDelCentro])

  const volverAlInicio = useCallback(() => setVista("inicio"), [])
  // 03-nov · una sola vista del equipo (auditoría 15): «Equipo» ya no abre una vista propia; cierra el Centro y abre el Squad Hub de la escena (de CC4)
  const abrirElSquadHub = useCallback(() => {
    onCerrar()
    window.dispatchEvent(new CustomEvent<PedidoDePlantel>(EVENTO_ABRIR_PLANTEL, { detail: { cliente: datos?.cliente?.id ?? cliente ?? null } }))
  }, [onCerrar, datos, cliente])
  const abrirPieza = useCallback((id: string) => { setPiezaAbierta({ id, desde: "calendario" }); setVista("piezas") }, [])
  const cerrarPiezas = useCallback(() => { setVista(piezaAbierta?.desde === "calendario" ? "calendario" : "inicio"); setPiezaAbierta(null) }, [piezaAbierta])
  if (vista === "calendario") return <PanelPizarron onCerrar={volverAlInicio} datosIniciales={datos} onAbrirPieza={abrirPieza} />
  if (vista === "manual") return <PanelManual onCerrar={volverAlInicio} clienteInicial={cliente} />
  if (vista === "plan") return <PanelPlan onCerrar={volverAlInicio} clienteInicial={cliente} />
  if (vista === "piezas") return <PanelPiezas onCerrar={cerrarPiezas} clienteInicial={cliente} piezaInicial={piezaAbierta?.id ?? null} />
  if (vista === "informes") return <PanelInformes key={cliente ?? ""} onCerrar={volverAlInicio} clienteInicial={cliente} />
  if (vista === "brief") return <PanelBrief key={cliente ?? ""} onCerrar={volverAlInicio} clienteInicial={cliente} />
  if (vista === "gran_idea") return <PanelGranIdea key={cliente ?? ""} onCerrar={volverAlInicio} clienteInicial={cliente} />

  const idCliente = datos?.cliente?.id ?? null
  return (
    <PanelBase titulo="Centro de campaña" id="aplicaciones-titulo" seccion="aplicaciones" onCerrar={onCerrar} etiquetaCerrar="Cerrar" ancho="max-w-[820px]" fondo={false}>
        {/* 06-nov · selector único (#300): el cliente se elige arriba; aquí solo se dice cuál es */}
        <div className="mb-6 mt-1 flex justify-center"><ClienteComoTexto nombre={datos ? datos.cliente?.nombre : "Leyendo…"} /></div>

        {error && <p role="alert" className="mb-4 border-y border-linea-alarma py-3 text-center text-dato text-hueso">{error}</p>}

        <ul className="grid grid-cols-3 gap-3" aria-label="Los 9 pasos del Centro de campaña">
          {APLICACIONES.map((a, i) => {
            const d = detalleDelCuadro(a.clave, datos, centro)
            const href = a.enlace(idCliente, datos?.cliente?.nombre ?? null)
            const t = tarjetaDelCentro(a.clave, datos, centro, cargando)
            // 09-nov (boceto aprobado por Emilio 15:15Z): sin número de paso ni descripción; debajo del nombre, el estado con su punto, una línea fina y la cantidad
            const dentro = (
              <>
                <Icono clave={a.clave} />
                <span className="mt-3 block text-cuerpo font-medio text-hueso">{a.nombre}</span>
                <span data-estado={t.estado} data-tono={t.tono} className={`mt-1.5 flex items-center justify-center gap-1.5 text-rotulo font-medio uppercase tracking-rotulo ${COLOR_DEL_TONO[t.tono]}`}>
                  <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${PUNTO_DEL_TONO[t.tono]}`} aria-hidden />{t.estado}
                </span>
                <span className="mt-3 block w-full border-t border-linea" aria-hidden />
                <span className="mt-3 flex w-full min-w-0 items-center gap-3 text-left">
                  <span data-cantidad className="min-w-11 shrink-0 rounded-control border border-linea px-2.5 py-1 text-center text-cuerpo font-medio text-hueso [font-variant-numeric:tabular-nums]">{t.cantidad}</span>
                  <span data-linea className="min-w-0 truncate text-dato text-gris">{t.linea}</span>
                </span>
              </>
            )
            return (
              <li key={a.clave} className="contents">
                {href
                  ? <a ref={i === 0 ? (primero as RefObject<HTMLAnchorElement>) : undefined} href={href} data-aplicacion={a.clave} data-aviso={d.aviso} className={CLASE_DEL_CUADRO}>{dentro}</a>
                  : <button type="button" data-aplicacion={a.clave} data-aviso={d.aviso} onClick={() => (a.clave === "equipo" ? abrirElSquadHub() : setVista(a.clave))} aria-haspopup="dialog" className={CLASE_DEL_CUADRO}>{dentro}</button>}
              </li>
            )
          })}
        </ul>
        <p className="mt-4 text-center text-dato text-apagado">Esc o clic fuera para volver a la oficina</p>
    </PanelBase>
  )
}
