"use client"

/**
 * EL BOTÓN «FLUJO DE LA CAMPAÑA» (boceto aprobado por Emilio el 18-nov, 13:43 Zúrich · `raw/evidencia/2026-11-18-boton-flujo-campana/boceto-aprobado-3-estados.png`).
 * Debajo de los 9 cuadros del Centro de campaña, del ancho de los 3, con el mismo estilo: ícono de encendido, título y UNA línea de estado.
 *   · verde «● EN MARCHA» → tocar para todo el flujo (el paso en curso termina; el siguiente no arranca)
 *   · dorado fijo «● PARADO POR TI · <hito>» → tocar reanuda desde ahí
 *   · rojo que parpadea «● DETENIDO · <motivo breve>» → tocar intenta reanudar; si la causa sigue, vuelve a rojo y se dice sin alarma (el detalle va en Alertas)
 * El color lo decide la campaña real (`/api/flujo`), nunca la pantalla.
 * 19-nov (boceto aprobado por Emilio 21:45 y 22:03 Zúrich · `raw/evidencia/2026-11-19-boceto-boton-flujo-nombre/`): VARIAS CAMPAÑAS.
 *   · cada botón es de UNA campaña: muestra su nombre (línea entre el título y el estado, cortado con «…») y, tras tocar, relee ESA campaña
 *   · el alto queda fijo para que los 3 lugares midan igual (`LugaresDeCampana.tsx`)
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Archive } from "@phosphor-icons/react/dist/ssr/Archive"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"
import { quieroAlTocar, type CampanaDelFlujo, type ColorDelFlujo, type FlujoDeCampana } from "@/lib/flujo-de-campana"
import type { AccionDelArchivo } from "@/lib/archivo-de-campana"

/**
 * 26-nov (diseño de Emilio · GO Lenovo 11:57Z) · «ARCHIVAR» Y «ELIMINAR».
 *   · al pasar el cursor se ilumina todo el botón; el clic sigue siendo parar/reanudar (no cambia);
 *   · si el cursor se queda encima, a la derecha aparecen 2 botones sencillos (una palabra + su ícono), sin menús ni ventanas;
 *   · «Archivar» = un clic · «Eliminar» = dos clics en el mismo botón: el primero cambia la palabra a «¿Seguro?», que vuelve sola a «Eliminar»
 *     si no llega el segundo en unos segundos o si sale el cursor.
 */
export const ESPERA_DE_LAS_OPCIONES_MS = 600
export const ESPERA_DEL_SEGURO_MS = 4000
export const TEXTO_SEGURO = "¿Seguro?"
/** 26-nov (Lenovo 15:12Z) · lo que contesta la plataforma cuando un agente sigue trabajando para esa campaña */
export const ERROR_TRABAJO_EN_CURSO = "trabajo_en_curso"
export const TEXTO_TRABAJO_EN_CURSO = "Hay trabajo en curso, intenta en unos minutos."
export const CLASE_DE_LA_OPCION = "flex items-center gap-1.5 rounded-control border bg-carbon px-2.5 py-1.5 text-dato font-medio focus-visible:outline focus-visible:outline-1 focus-visible:outline-oro disabled:opacity-60"

type Lectura = { ok: true; campana_id: string | null; flujo: FlujoDeCampana | null; campanas?: CampanaDelFlujo[] } | { ok: false; error: string }
/** lo que pinta un botón: la campaña, su botón y (19-nov) su nombre */
export type LecturaDeUnBoton = { campana_id: string | null; flujo: FlujoDeCampana | null; nombre?: string | null }

/** las clases por color: SOLO tokens de la guía (+ el verde `marcha`, solo para este estado) */
export const CLASES_DEL_FLUJO: Record<ColorDelFlujo, { borde: string; texto: string; punto: string }> = {
  verde: { borde: "border-linea", texto: "text-marcha", punto: "bg-marcha" },
  dorado: { borde: "border-oro", texto: "text-oro", punto: "bg-oro" },
  rojo: { borde: "border-alarma zr-flujo-detenido", texto: "text-alarma", punto: "bg-alarma" },
}
export const CLASE_DEL_BOTON = "relative flex min-h-[164px] w-full flex-col items-center justify-center rounded-tarjeta border bg-tarjeta-escena px-4 pb-5 pt-6 text-center focus-visible:outline focus-visible:outline-1 focus-visible:outline-oro zr-apagable"

function IconoDeEncendido({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={`h-9 w-9 ${className}`}>
      <path d="M16 5v10" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <path d="M10.2 9.2a9 9 0 1 0 11.6 0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}

export function BotonFlujo({ clienteId, inicial = null, onQuitada }: {
  clienteId: string | null
  /** la lectura ya hecha (los lugares de campaña, pruebas e imagen) */
  inicial?: LecturaDeUnBoton | null
  /** 26-nov · la campaña se archivó o se eliminó: el Centro vuelve a leer y su lugar queda libre */
  onQuitada?: () => void
}) {
  const [lectura, setLectura] = useState(inicial)
  const [enviando, setEnviando] = useState(false)
  const [nota, setNota] = useState<string | null>(null)
  const idPropio = useRef<string | null>(inicial?.campana_id ?? null)
  const [opciones, setOpciones] = useState(false)
  const [seguro, setSeguro] = useState(false)
  const [quitando, setQuitando] = useState<AccionDelArchivo | null>(null)
  const relojOpciones = useRef<ReturnType<typeof setTimeout> | null>(null)
  const relojSeguro = useRef<ReturnType<typeof setTimeout> | null>(null)
  const parar = (r: { current: ReturnType<typeof setTimeout> | null }) => { if (r.current) clearTimeout(r.current); r.current = null }
  useEffect(() => () => { parar(relojOpciones); parar(relojSeguro) }, [])
  const entrar = () => { parar(relojOpciones); relojOpciones.current = setTimeout(() => setOpciones(true), ESPERA_DE_LAS_OPCIONES_MS) }
  const salir = () => { parar(relojOpciones); parar(relojSeguro); setOpciones(false); setSeguro(false) }

  const leer = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/flujo?cliente=${encodeURIComponent(id)}`, { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Lectura | null
      if (!(r.ok && j && j.ok)) return
      // 19-nov · un botón con campaña relee ESA campaña (de `campanas`), nunca «la más nueva» del cliente
      const mia = idPropio.current
      if (!mia) { setLectura({ campana_id: j.campana_id, flujo: j.flujo }); return }
      const c = (j.campanas ?? []).find((x) => x.campana_id === mia)
      if (c) setLectura({ campana_id: c.campana_id, flujo: c.flujo, nombre: c.nombre })
      else if (j.campana_id === mia) setLectura((l) => ({ campana_id: mia, flujo: j.flujo, nombre: l?.nombre ?? null }))
    } catch { /* sin lectura no se muestra el botón: nunca un color inventado */ }
  }, [])
  useEffect(() => { if (!inicial && clienteId) void leer(clienteId) }, [clienteId, inicial, leer])

  const flujo = lectura?.flujo ?? null
  if (!lectura?.campana_id || !flujo) return null
  const c = CLASES_DEL_FLUJO[flujo.color]

  const tocar = async () => {
    if (enviando) return
    setEnviando(true); setNota(null)
    try {
      const r = await fetch("/api/flujo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campana_id: lectura.campana_id, quiero: quieroAlTocar(flujo) }) })
      const j = (await r.json().catch(() => ({}))) as { flujo?: FlujoDeCampana | null; detalle?: string; detail?: string }
      if (j.flujo) setLectura({ campana_id: lectura.campana_id, flujo: j.flujo, nombre: lectura.nombre ?? null })
      // 409 · la causa sigue (o la campaña cambió): se dice tranquilo, el detalle está en Alertas
      if (r.status === 409) setNota(j.detalle ?? j.detail ?? "Todavía no se puede reanudar: el detalle está en Alertas.")
      else if (!r.ok) setNota("No se pudo cambiar el flujo ahora. Vuelve a intentarlo en un momento.")
      if (!j.flujo && clienteId) await leer(clienteId)
    } catch {
      setNota("No se pudo cambiar el flujo ahora. Vuelve a intentarlo en un momento.")
    } finally { setEnviando(false) }
  }

  // 26-nov · «Archivar» (un clic) y «Eliminar» (dos clics): lo aplica la plataforma; al salir bien, el lugar queda libre (el Centro vuelve a leer)
  const quitar = async (que: AccionDelArchivo) => {
    if (quitando || enviando) return
    if (que === "eliminar" && !seguro) {
      setSeguro(true); parar(relojSeguro)
      relojSeguro.current = setTimeout(() => setSeguro(false), ESPERA_DEL_SEGURO_MS)
      return
    }
    parar(relojSeguro); setSeguro(false); setQuitando(que); setNota(null)
    try {
      const r = await fetch("/api/campana-archivo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campana_id: lectura.campana_id, accion: que }) })
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (r.ok && j.ok === true) { setOpciones(false); onQuitada?.(); return }
      // 26-nov (Lenovo 15:12Z) · la plataforma la detuvo pero un agente seguía trabajando: se dice tal cual, en el mismo botón, y el lugar se queda para reintentar
      if (j.error === ERROR_TRABAJO_EN_CURSO) { setNota(TEXTO_TRABAJO_EN_CURSO); return }
      setNota(que === "archivar" ? "No se pudo archivar ahora. Vuelve a intentarlo en un momento." : "No se pudo eliminar ahora. Vuelve a intentarlo en un momento.")
    } catch {
      setNota(que === "archivar" ? "No se pudo archivar ahora. Vuelve a intentarlo en un momento." : "No se pudo eliminar ahora. Vuelve a intentarlo en un momento.")
    } finally { setQuitando(null) }
  }

  // 21-nov (Emilio 10:28–10:30Z · GO Lenovo 10:31Z): los botones vuelven a ser solo «Flujo de la campaña»; la campaña se elige con la flecha ▾ del subtítulo (`CampanaComoTexto`)
  const accion = flujo.color === "verde" ? "Parar el flujo de la campaña" : "Reanudar el flujo de la campaña"
  const nombre = lectura.nombre ? ` «${lectura.nombre}»` : ""
  return (
    <div className="mt-3">
      <div data-lugar-de-la-campana className="group relative" onMouseEnter={entrar} onMouseLeave={salir}
        onFocus={() => setOpciones(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) salir() }}>
        <button type="button" data-flujo={flujo.color} onClick={() => void tocar()} disabled={enviando} aria-label={`${accion}${nombre} · ${flujo.linea}`} className={`${CLASE_DEL_BOTON} ${c.borde} group-hover:border-linea-oro group-hover:bg-grafito-2`}>
          <IconoDeEncendido className={c.texto} />
          <span className="mt-3 block text-cuerpo font-medio text-hueso">Flujo de la campaña</span>
          {lectura.nombre && <span data-nombre-de-la-campana title={lectura.nombre} className="mt-1 block max-w-full truncate text-dato text-hueso">{lectura.nombre}</span>}
          <span data-linea-del-flujo className={`mt-1.5 flex items-center justify-center gap-2 text-rotulo font-medio uppercase tracking-rotulo ${c.texto}`}>
            <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${c.punto}`} aria-hidden />{flujo.linea}
          </span>
        </button>
        {opciones && (
          <div data-opciones-de-campana className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1.5">
            <button type="button" data-archivar-campana onClick={() => void quitar("archivar")} disabled={!!quitando} aria-label={`Archivar la campaña${nombre}`}
              className={`${CLASE_DE_LA_OPCION} border-linea text-hueso hover:border-linea-oro`}>
              <Archive aria-hidden className="h-4 w-4" />{quitando === "archivar" ? "Archivando…" : "Archivar"}
            </button>
            <button type="button" data-eliminar-campana data-seguro={seguro ? "si" : "no"} onClick={() => void quitar("eliminar")} disabled={!!quitando}
              aria-label={seguro ? `Confirmar: eliminar la campaña${nombre}` : `Eliminar la campaña${nombre}`}
              className={`${CLASE_DE_LA_OPCION} border-linea-alarma text-alarma`}>
              <Trash aria-hidden className="h-4 w-4" />{quitando === "eliminar" ? "Eliminando…" : seguro ? TEXTO_SEGURO : "Eliminar"}
            </button>
          </div>
        )}
      </div>
      {nota && <p role="status" data-nota-del-flujo className="mt-2 text-center text-dato text-gris">{nota}</p>}
    </div>
  )
}
