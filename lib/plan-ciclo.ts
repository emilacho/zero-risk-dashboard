/**
 * CICLO DEL PLAN · la llamada del panel (navegador) a la puerta del tablero (CC6 · 01-nov · contrato certificado de CC1 §2).
 * El panel no arma pedidos propios: manda el cuerpo a `/api/acciones/{plan-cambios|plan-aprobar}` (solo administrador; el servidor valida, exige la
 * confirmación del gasto y llama a la plataforma con la llave interna) y recibe la respuesta ya dicha en palabras (`palabrasDeLaRespuesta`).
 */
import { palabrasDeLaRespuesta, type RespuestaDelCiclo } from "@/lib/plan"

export type PuertaDelCiclo = "plan-cambios" | "plan-aprobar"

export async function enviarAlCiclo(accion: PuertaDelCiclo, cuerpo: Record<string, unknown>, fetchImpl: typeof fetch = fetch): Promise<RespuestaDelCiclo> {
  try {
    const r = await fetchImpl(`/api/acciones/${accion}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) })
    const j = (await r.json().catch(() => ({}))) as unknown
    return palabrasDeLaRespuesta(accion, r.status, j)
  } catch (e) {
    return { ok: false, texto: `No se pudo enviar: ${e instanceof Error ? e.message : String(e)}. No se cambió nada.`, reintentar: false, releer: false }
  }
}
