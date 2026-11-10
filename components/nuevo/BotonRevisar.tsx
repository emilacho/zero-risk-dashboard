"use client"

/**
 * «✓ REVISAR» · #310 ajuste 2 (Emilio 09-nov 23:45Z · boceto `raw/evidencia/2026-11-10-alertas/APROBADO-alertas-un-solo-camino.png`).
 * Un solo camino para toda alerta: Nueva → Revisada (solo cuando tocas «✓ Revisar»; abrirla no cuenta) → Resuelta (la cierra el sistema).
 * LA MISMA PIEZA en el panel de decisiones y en la antena (CC5 la importa de aquí; no se copia).
 * Guarda en la libreta de «ya lo vi» de siempre (`POST /api/alertas/visto`) con la clave que arma la plataforma (`decision:<fuente>:<id>`, CC1 #965).
 * Solo si se guardó pasa a «✓ Revisada»; si no, lo dice y el botón sigue ahí.
 */
import { useState } from "react"
import { marcarRevisada } from "@/lib/revisar-alerta"

const BOTON = "zr-apagable inline-flex min-h-11 items-center gap-1.5 rounded-control border border-linea px-3 text-dato text-gris hover:border-linea-oro hover:text-hueso focus-visible:outline focus-visible:outline-1 focus-visible:outline-oro whitespace-nowrap"
const SELLO = "inline-flex min-h-11 items-center gap-1.5 rounded-control border border-linea-oro px-3 text-dato text-oro whitespace-nowrap"

export function BotonRevisar({ clave, revisadaEn = null, alRevisar, fetchImpl }: {
  clave: string
  /** si ya viene revisada (la plataforma lo dice), el sello en vez del botón */
  revisadaEn?: string | null
  /** avisa al panel para que mueva sus contadores (Nuevas → Revisadas) sin esperar la próxima lectura */
  alRevisar?: (clave: string, en: string) => void
  fetchImpl?: typeof fetch
}) {
  const [hecha, setHecha] = useState<string | null>(revisadaEn)
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  if (hecha) return <span data-revisada={clave} className={SELLO}><span aria-hidden>✓</span>Revisada</span>
  return (
    <span className="inline-flex flex-col items-center">
      <button type="button" data-revisar={clave} disabled={enviando} aria-busy={enviando || undefined}
        onClick={async () => {
          setEnviando(true); setFallo(null)
          const r = await marcarRevisada(fetchImpl ?? fetch, clave)
          setEnviando(false)
          if (r.ok) { setHecha(r.en); alRevisar?.(clave, r.en) } else setFallo(r.error)
        }}
        className={BOTON}><span aria-hidden>✓</span>{enviando ? "Guardando…" : "Revisar"}</button>
      {fallo && <span data-revisar-fallo role="status" className="mt-1 text-dato text-alarma">{fallo}</span>}
    </span>
  )
}
