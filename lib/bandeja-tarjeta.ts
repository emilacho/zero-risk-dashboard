/**
 * LA BANDEJA ÚNICA en el tablero de Emilio (CC#3 · 19-oct · arreglo 3): una fila de `hitl_queue` con la forma que espera la tarjeta de aprobación.
 * Va en `lib/` (y no en la página) porque una página de Next solo puede exportar la página.
 */
export interface HitlQueueRow {
  id: string
  status: string
  priority: string | null
  client_id: string | null
  created_at: string
  payload: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  title: string | null
  agent_name: string | null
  type: string | null
  output_preview: string | null
  resolution_notes: string | null
}

export interface HitlRowRaw {
  id: string
  status: string
  priority: string | null
  client_id: string | null
  created_at: string
  payload: Record<string, unknown> | null
  context: Record<string, unknown> | null
  rejection_reason: string | null
}

export const COLUMNAS_DE_LA_BANDEJA = "id, status, priority, client_id, created_at, payload, metadata, title, agent_name, type, output_preview, resolution_notes"

/** la tarjeta muestra la carga (`payload`): se le antepone lo que dice la bandeja (título, quién, tipo, vista previa) para que una pieza de la oficina se entienda a simple vista */
export function filaParaLaTarjeta(r: HitlQueueRow): HitlRowRaw {
  const resumen: Record<string, unknown> = {}
  if (r.title) resumen.titulo = r.title
  if (r.agent_name) resumen.empleado = r.agent_name
  if (r.type) resumen.tipo = r.type
  if (r.output_preview) resumen.vista_previa = r.output_preview
  return {
    id: r.id,
    status: r.status,
    priority: r.priority,
    client_id: r.client_id,
    created_at: r.created_at,
    payload: { ...resumen, ...(r.payload ?? {}) },
    context: r.metadata,
    rejection_reason: r.resolution_notes,
  }
}
