/**
 * CACHÉ CORTA (30-oct · «dashboard rápido»): lo que varias pantallas piden casi a la vez (oficinas, gasto) se lee UNA vez cada pocos segundos.
 * Vive en la memoria del servidor; si dos pedidos llegan juntos comparten la misma lectura en curso. Una acción del tablero la vacía,
 * así que el reflejo inmediato tras un clic se conserva. En las pruebas no actúa (cada prueba lee lo suyo).
 */
type Entrada = { hasta: number; valor: Promise<unknown> }
const guardado = new Map<string, Entrada>()

export const TTL_CORTO_MS = 6_000

export function conCache<T>(clave: string, ttlMs: number, leer: () => Promise<T>, ahora: () => number = Date.now): Promise<T> {
  if (process.env.NODE_ENV === "test") return leer()
  const e = guardado.get(clave)
  if (e && e.hasta > ahora()) return e.valor as Promise<T>
  const valor = leer()
  guardado.set(clave, { hasta: ahora() + ttlMs, valor })
  // una lectura que falla no se queda guardada
  valor.catch(() => { if (guardado.get(clave)?.valor === valor) guardado.delete(clave) })
  return valor
}

export function vaciarCache(): void { guardado.clear() }
