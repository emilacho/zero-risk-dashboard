/**
 * EL CLIENTE CON EL QUE EMILIO ESTÁ TRABAJANDO (CC6 · 02-nov · CORRECCIÓN URGENTE de Lenovo, aprobada por Emilio: el pedido de cambios salió al cliente
 * equivocado porque los paneles abrían en un cliente por omisión). Se recuerda en este navegador el último que eligió (en «Seleccionar cliente» de arriba, en
 * el Centro de campaña o en el selector de un panel) y todos los paneles abren en ese. Sin recuerdo, decide el servidor (campaña activa → plan más reciente).
 * Es una comodidad del navegador: si el almacenamiento no está disponible, no pasa nada (se cae al servidor).
 */
export interface ClienteDeTrabajo { id: string | null; nombre: string | null }
const CLAVE = "nv-cliente-de-trabajo"

export function leerClienteDeTrabajo(): ClienteDeTrabajo | null {
  try {
    if (typeof window === "undefined") return null
    const v = JSON.parse(window.localStorage.getItem(CLAVE) ?? "null") as Partial<ClienteDeTrabajo> | null
    if (!v || typeof v !== "object") return null
    const id = typeof v.id === "string" && v.id ? v.id : null, nombre = typeof v.nombre === "string" && v.nombre ? v.nombre : null
    return id || nombre ? { id, nombre } : null
  } catch { return null }
}

export function guardarClienteDeTrabajo(c: Partial<ClienteDeTrabajo>): void {
  try {
    if (typeof window === "undefined") return
    const id = c.id ?? null, nombre = c.nombre ?? null
    if (!id && !nombre) return
    window.localStorage.setItem(CLAVE, JSON.stringify({ id, nombre }))
  } catch { /* sin almacenamiento: se cae al servidor */ }
}

/** de la lista del Centro, cuál es el cliente recordado (por id; si solo se recuerda el nombre, por nombre) */
export function clienteRecordadoEn(lista: Array<{ id: string; nombre: string }>, recordado: ClienteDeTrabajo | null): string | null {
  if (!recordado) return null
  if (recordado.id && lista.some((c) => c.id === recordado.id)) return recordado.id
  if (recordado.nombre) { const n = recordado.nombre.toLocaleLowerCase("es"); return lista.find((c) => c.nombre.toLocaleLowerCase("es") === n)?.id ?? null }
  return null
}
