"use client"

/**
 * EL BOTÓN «FLUJO DE LA CAMPAÑA» (boceto aprobado por Emilio el 18-nov, 13:43 Zúrich · `raw/evidencia/2026-11-18-boton-flujo-campana/boceto-aprobado-3-estados.png`).
 * Debajo de los 9 cuadros del Centro de campaña, del ancho de los 3, con el mismo estilo: ícono de encendido, título y UNA línea de estado.
 *   · verde «● EN MARCHA» → tocar para todo el flujo (el paso en curso termina; el siguiente no arranca)
 *   · dorado fijo «● PARADO POR TI · <hito>» → tocar reanuda desde ahí
 *   · rojo que parpadea «● DETENIDO · <motivo breve>» → tocar intenta reanudar; si la causa sigue, vuelve a rojo y se dice sin alarma (el detalle va en Alertas)
 * El color lo decide la campaña real (`/api/flujo`), nunca la pantalla.
 */
import { useCallback, useEffect, useState } from "react"
import { quieroAlTocar, type ColorDelFlujo, type FlujoDeCampana } from "@/lib/flujo-de-campana"

type Lectura = { ok: true; campana_id: string | null; flujo: FlujoDeCampana | null } | { ok: false; error: string }

/** las clases por color: SOLO tokens de la guía (+ el verde `marcha`, solo para este estado) */
export const CLASES_DEL_FLUJO: Record<ColorDelFlujo, { borde: string; texto: string; punto: string }> = {
  verde: { borde: "border-linea", texto: "text-marcha", punto: "bg-marcha" },
  dorado: { borde: "border-oro", texto: "text-oro", punto: "bg-oro" },
  rojo: { borde: "border-alarma zr-flujo-detenido", texto: "text-alarma", punto: "bg-alarma" },
}
const CLASE_DEL_BOTON = "relative flex w-full flex-col items-center rounded-tarjeta border bg-tarjeta-escena px-4 pb-5 pt-6 text-center focus-visible:outline focus-visible:outline-1 focus-visible:outline-oro zr-apagable"

function IconoDeEncendido({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={`h-9 w-9 ${className}`}>
      <path d="M16 5v10" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <path d="M10.2 9.2a9 9 0 1 0 11.6 0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}

export function BotonFlujo({ clienteId, inicial = null }: { clienteId: string | null; /** pruebas e imagen: la lectura ya hecha */ inicial?: { campana_id: string | null; flujo: FlujoDeCampana | null } | null }) {
  const [lectura, setLectura] = useState(inicial)
  const [enviando, setEnviando] = useState(false)
  const [nota, setNota] = useState<string | null>(null)

  const leer = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/flujo?cliente=${encodeURIComponent(id)}`, { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Lectura | null
      if (r.ok && j && j.ok) setLectura({ campana_id: j.campana_id, flujo: j.flujo })
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
      if (j.flujo) setLectura({ campana_id: lectura.campana_id, flujo: j.flujo })
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
      <button type="button" data-flujo={flujo.color} onClick={tocar} disabled={enviando} aria-label={`${accion} · ${flujo.linea}`} className={`${CLASE_DEL_BOTON} ${c.borde}`}>
        <IconoDeEncendido className={c.texto} />
        <span className="mt-3 block text-cuerpo font-medio text-hueso">Flujo de la campaña</span>
        <span data-linea-del-flujo className={`mt-1.5 flex items-center justify-center gap-2 text-rotulo font-medio uppercase tracking-rotulo ${c.texto}`}>
          <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${c.punto}`} aria-hidden />{flujo.linea}
        </span>
      </button>
      {nota && <p role="status" data-nota-del-flujo className="mt-2 text-center text-dato text-gris">{nota}</p>}
    </div>
  )
}
