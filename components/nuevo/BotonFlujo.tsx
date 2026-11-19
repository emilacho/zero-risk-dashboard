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
import { quieroAlTocar, type CampanaDelFlujo, type ColorDelFlujo, type FlujoDeCampana } from "@/lib/flujo-de-campana"

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

export function BotonFlujo({ clienteId, inicial = null }: { clienteId: string | null; /** la lectura ya hecha (los lugares de campaña, pruebas e imagen) */ inicial?: LecturaDeUnBoton | null }) {
  const [lectura, setLectura] = useState(inicial)
  const [enviando, setEnviando] = useState(false)
  const [nota, setNota] = useState<string | null>(null)
  const idPropio = useRef<string | null>(inicial?.campana_id ?? null)

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

  const accion = flujo.color === "verde" ? "Parar el flujo de la campaña" : "Reanudar el flujo de la campaña"
  return (
    <div className="mt-3">
      <button type="button" data-flujo={flujo.color} onClick={tocar} disabled={enviando} aria-label={`${accion}${lectura.nombre ? ` «${lectura.nombre}»` : ""} · ${flujo.linea}`} className={`${CLASE_DEL_BOTON} ${c.borde}`}>
        <IconoDeEncendido className={c.texto} />
        <span className="mt-3 block text-cuerpo font-medio text-hueso">Flujo de la campaña</span>
        {lectura.nombre && <span data-nombre-de-la-campana title={lectura.nombre} className="mt-1 block max-w-full truncate text-dato text-hueso">{lectura.nombre}</span>}
        <span data-linea-del-flujo className={`mt-1.5 flex items-center justify-center gap-2 text-rotulo font-medio uppercase tracking-rotulo ${c.texto}`}>
          <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${c.punto}`} aria-hidden />{flujo.linea}
        </span>
      </button>
      {nota && <p role="status" data-nota-del-flujo className="mt-2 text-center text-dato text-gris">{nota}</p>}
    </div>
  )
}
