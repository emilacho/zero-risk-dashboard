/**
 * El rol de una persona cambia casi nunca: se recuerda 60 s en la memoria del servidor para no hacer un segundo viaje a la base en cada clic
 * (el portero y cada pantalla lo preguntaban por separado). La sesión SÍ se verifica en cada pedido; solo el rol se recuerda.
 */
export type Rol = "admin" | "client_viewer" | null
const RECUERDO_MS = 60_000
const recuerdos = new Map<string, { rol: Rol; hasta: number }>()

export async function rolDe(userId: string, leer: () => Promise<Rol>, ahora: () => number = Date.now): Promise<Rol> {
  if (process.env.NODE_ENV === "test" && ahora === Date.now) return leer()
  const r = recuerdos.get(userId)
  if (r && r.hasta > ahora()) return r.rol
  const rol = await leer()
  recuerdos.set(userId, { rol, hasta: ahora() + RECUERDO_MS })
  return rol
}
export function olvidarRoles(): void { recuerdos.clear() }
