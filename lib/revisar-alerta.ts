/**
 * «✓ Revisar» (#310 ajuste 2): guarda la marca en la libreta de «ya lo vi» de siempre. Solo con la respuesta `ok` cuenta como revisada.
 * Una clave que la libreta no acepta ni se manda (la plataforma la arma; si llega rota, se dice).
 */
import { claveValida } from "@/lib/alertas"

export type ResultadoDeRevisar = { ok: true; en: string } | { ok: false; error: string }
export const NO_SE_GUARDO = "No se guardó que la revisaste. Prueba otra vez."

export async function marcarRevisada(fetchImpl: typeof fetch, clave: string, ahora: () => Date = () => new Date()): Promise<ResultadoDeRevisar> {
  if (!claveValida(clave)) return { ok: false, error: NO_SE_GUARDO }
  try {
    const r = await fetchImpl("/api/alertas/visto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clave }) })
    const j = (await r.json().catch(() => null)) as { ok?: boolean } | null
    if (!r.ok || !j?.ok) return { ok: false, error: NO_SE_GUARDO }
    return { ok: true, en: ahora().toISOString() }
  } catch { return { ok: false, error: NO_SE_GUARDO } }
}
