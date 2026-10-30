"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { INTERVALO_DE_ACTUALIZACION_MS, debeRefrescar, rutaSeRefresca } from "@/lib/tiempo-real"

/** ¿el cursor está en un campo, o hay un panel de botón abierto (marcado con data-editando)? */
function estaEscribiendo(): boolean {
  const a = document.activeElement
  if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || (a as HTMLElement).isContentEditable)) return true
  return document.querySelector("[data-editando]") !== null
}

/**
 * Pone al día la pantalla sin recargarla (no parpadea ni pierde la lámina que miras: el estado del navegador se conserva).
 * Se vuelve a leer cada pocos segundos mientras la pestaña se ve, y al instante al volver a ella.
 * Un puntito discreto abajo a la derecha dice la hora de la última lectura.
 */
export function ActualizarSolo() {
  const router = useRouter()
  const ruta = usePathname()
  const [hora, setHora] = useState<string | null>(null)
  const ultima = useRef(0)

  useEffect(() => {
    if (!rutaSeRefresca(ruta)) return
    const marcar = () => {
      ultima.current = Date.now()
      setHora(new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
    }
    const leer = () => {
      if (!debeRefrescar({ ruta, oculta: document.hidden, escribiendo: estaEscribiendo(), sinRed: !navigator.onLine })) return
      router.refresh()
      marcar()
    }
    marcar()
    const t = setInterval(leer, INTERVALO_DE_ACTUALIZACION_MS)
    const alVolver = () => { if (!document.hidden && Date.now() - ultima.current > 2_000) leer() }
    document.addEventListener("visibilitychange", alVolver)
    window.addEventListener("focus", alVolver)
    window.addEventListener("online", alVolver)
    return () => {
      clearInterval(t)
      document.removeEventListener("visibilitychange", alVolver)
      window.removeEventListener("focus", alVolver)
      window.removeEventListener("online", alVolver)
    }
  }, [ruta, router])

  if (!rutaSeRefresca(ruta) || !hora) return null
  return (
    <div aria-live="off" className="pointer-events-none fixed bottom-2 right-3 z-30 flex items-center gap-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      <span>En vivo · {hora}</span>
    </div>
  )
}
