/**
 * LOS NOMBRES DE LOS TRABAJOS DE LA SALA, EN CACHÉ (CC4 · 03-nov · reserva 1 de CC3 sobre #220): la sala dice «Cambios al manual», no «flujo 2128…», y el nombre sale de n8n.
 * Cada sondeo de la escena no puede ir a n8n (hasta 12 llamadas de 4 s): un nombre encontrado se guarda 5 min (el nombre de un trabajo casi no cambia) y uno que n8n no dio
 * se vuelve a pedir al minuto. Solo lectura.
 */
import { nombresDeProcesos } from "@/lib/direccion-riesgos"

export const TTL_NOMBRE_MS = 300_000
export const TTL_SIN_NOMBRE_MS = 60_000
const guardado = new Map<string, { hasta: number; nombre: string | null }>()

export async function nombresDeFlujosEnCache(ids: string[], f: typeof fetch, ahora: () => number = Date.now): Promise<Record<string, string>> {
  const t = ahora()
  const faltan = ids.filter((id) => { const e = guardado.get(id); return !e || e.hasta <= t })
  if (faltan.length) {
    const hallados = await nombresDeProcesos(faltan, f).catch(() => new Map<string, string>())
    for (const id of faltan) {
      const nombre = hallados.get(id) ?? null
      guardado.set(id, { hasta: t + (nombre ? TTL_NOMBRE_MS : TTL_SIN_NOMBRE_MS), nombre })
    }
  }
  const salida: Record<string, string> = {}
  for (const id of ids) { const n = guardado.get(id)?.nombre; if (n) salida[id] = n }
  return salida
}

export function vaciarNombresDeFlujos(): void { guardado.clear() }
