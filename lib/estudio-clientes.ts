/**
 * La lista de clientes del estudio (solo del servidor). Un cliente dado de baja o sin nombre no aparece:
 * no se puede crear ni cobrar una pieza para él.
 */
import { esDadoDeBaja } from "@/lib/cliente-financiero"

export type FilaDeCliente = { id: string; name: string | null; status: string | null }

export const clientesDelEstudio = (filas: FilaDeCliente[]): Array<{ id: string; nombre: string }> =>
  filas.filter((c) => !esDadoDeBaja(c.status) && c.name).map((c) => ({ id: c.id, nombre: String(c.name) }))
