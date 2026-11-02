/**
 * 6.52 · RIESGOS HABLAN CLARO (corrección aprobada por Emilio 2-nov 20:45Z, `2026-11-02-CORRECCION-LENOVO-a-CC5-decisiones-y-riesgos-hablan-claro.md`).
 * Cada riesgo dice en una frase simple QUÉ PASÓ, A QUIÉN AFECTA y QUIÉN LO ARREGLA. El texto técnico (inglés, comandos, marcas «:warning:») va detrás de
 * «ver detalle», nunca a la vista.
 * Quién lo arregla: solo lo que está asignado en la auditoría del 2-nov (`raw/estado/AUDITORIA-DASHBOARD-2026-11-02.md` punto 8: flujos automáticos que
 * fallan y cambios de Apify → CC2). Lo demás dice «sin responsable asignado»; no se inventa.
 */
import { motivoDelFlujo } from "@/lib/fallas-del-flujo"
import type { Riesgo } from "@/lib/direccion-riesgos"

export interface RiesgoClaro { frase: string; afecta: string; arregla: string | null; detalle: string | null; tecnico: string | null }

/** «trustpilot_scraper» → «Trustpilot» · «twitter_scraper» → «X (Twitter)» */
const RED: Record<string, string> = { twitter: "X (Twitter)", x: "X (Twitter)", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", linkedin: "LinkedIn", youtube: "YouTube", trustpilot: "Trustpilot", google_maps: "Google Maps", maps: "Google Maps" }
export const nombreDelLector = (slug: string): string => {
  const base = slug.replace(/[-_]?(scraper|actor|lector)$/i, "").toLowerCase()
  return RED[base] ?? base.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase())
}

/** ¿este texto es técnico (inglés de sistema, comandos, marcas, nombres internos)? Entonces no va a la vista */
export const esTextoTecnico = (t: string): boolean =>
  /:[a-z_]+:|\[[A-Z]{3,}\]|scripts\/|node |\bnpm\b|https?:\/\/|\b(timed out|timeout|exception|failed|failure|unexpected|connection|offline|retry|undefined|null)\b|[a-z]+_[a-z]+/i.test(t)

const ARREGLA_CC2 = "lo revisa CC2"

export function riesgoClaro(r: Pick<Riesgo, "titulo" | "detalle" | "sector" | "cliente" | "fuente" | "desde" | "id">): RiesgoClaro {
  const afecta = r.cliente ?? "Toda la empresa"
  const crudo = [r.titulo, r.detalle].filter(Boolean).join("\n")
  // Apify cambió un lector (raspador)
  const rasp = crudo.match(/RASPADOR\]?\s*cambi[oó] el esquema de\s*[«"]?([A-Za-z0-9_-]+)/i)
  if (rasp) {
    const red = nombreDelLector(rasp[1])
    return { frase: `Apify cambió el lector de ${red}`, afecta: `${afecta} · los datos de ${red}`, arregla: ARREGLA_CC2, detalle: `Hasta que se revise, lo que se lea de ${red} puede llegar incompleto.`, tecnico: crudo }
  }
  // un pedido de cambios que no dejó la versión nueva
  if (/^cambios-sin-version:/.test(r.id) || /no sali[oó] la versi[oó]n nueva/i.test(r.titulo)) {
    return { frase: r.titulo, afecta, arregla: ARREGLA_CC2, detalle: r.detalle ? `Motivo: ${motivoDelFlujo(r.detalle, null, null)}.` : null, tecnico: r.detalle && esTextoTecnico(r.detalle) ? r.detalle : null }
  }
  // un proceso automático que falló
  const proc = r.titulo.match(/^Fall[oó] el proceso\s*[«"](.+?)[»"]/)
  if (proc) return { frase: `Falló el proceso automático «${proc[1]}»`, afecta, arregla: r.sector === "flujos" ? ARREGLA_CC2 : null, detalle: r.detalle && !esTextoTecnico(r.detalle) ? r.detalle : null, tecnico: r.detalle && esTextoTecnico(r.detalle) ? r.detalle : null }
  // lo demás: el título si es legible; si es técnico, una frase genérica y el texto detrás de «ver detalle»
  const tituloTecnico = esTextoTecnico(r.titulo), detalleTecnico = !!r.detalle && esTextoTecnico(r.detalle)
  return {
    frase: tituloTecnico ? "El sistema avisó un problema" : r.titulo, afecta, arregla: null,
    detalle: r.detalle && !detalleTecnico ? r.detalle : null,
    tecnico: [tituloTecnico ? r.titulo : null, detalleTecnico ? r.detalle : null].filter(Boolean).join("\n") || null,
  }
}
