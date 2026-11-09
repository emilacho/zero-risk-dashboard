/**
 * EL CLIENTE CON EL QUE EMILIO ESTÁ TRABAJANDO (CC6 · 02-nov · CORRECCIÓN URGENTE de Lenovo, aprobada por Emilio: el pedido de cambios salió al cliente
 * equivocado porque los paneles abrían en un cliente por omisión). Se recuerda en este navegador el último que eligió y todos los paneles abren en ese.
 * Sin recuerdo, decide el servidor (campaña activa → plan más reciente).
 * Es una comodidad del navegador: si el almacenamiento no está disponible, no pasa nada (se cae al servidor).
 *
 * 06-nov · SELECTOR ÚNICO (boceto 2, aprobado tal cual por Emilio): el cliente se elige SOLO arriba. Los paneles lo muestran como texto y, si cambia con
 * un panel abierto, se enteran por el aviso `EVENTO_CLIENTE_DE_TRABAJO` y se pasan a ese cliente.
 * «Todos los clientes» existe solo para Dinero y Observabilidad: se guarda como `todos: true` SIN olvidar el último cliente, así los paneles de un solo
 * cliente siguen con ese y lo dicen arriba.
 */
export interface ClienteDeTrabajo { id: string | null; nombre: string | null; /** «Todos los clientes» (solo Dinero y Observabilidad) */ todos?: boolean }
const CLAVE = "nv-cliente-de-trabajo"
/** el aviso que reciben los paneles abiertos cuando cambia el cliente de arriba */
export const EVENTO_CLIENTE_DE_TRABAJO = "nv-cliente-de-trabajo-cambio"

export function leerClienteDeTrabajo(): ClienteDeTrabajo | null {
  try {
    if (typeof window === "undefined") return null
    const v = JSON.parse(window.localStorage.getItem(CLAVE) ?? "null") as Partial<ClienteDeTrabajo> | null
    if (!v || typeof v !== "object") return null
    const id = typeof v.id === "string" && v.id ? v.id : null, nombre = typeof v.nombre === "string" && v.nombre ? v.nombre : null, todos = v.todos === true
    return id || nombre || todos ? { id, nombre, todos } : null
  } catch { return null }
}

/**
 * Guarda el cliente de trabajo y avisa a los paneles abiertos (solo si cambió).
 * Si no se dice nada de `todos`, se conserva lo que había: un panel que recuerda su cliente no apaga «Todos» de arriba.
 */
export function guardarClienteDeTrabajo(c: Partial<ClienteDeTrabajo>): void {
  try {
    if (typeof window === "undefined") return
    const antes = leerClienteDeTrabajo()
    const id = c.id ?? null, nombre = c.nombre ?? null, todos = c.todos ?? antes?.todos ?? false
    if (!id && !nombre) return
    const nuevo: ClienteDeTrabajo = { id, nombre, todos }
    if (antes && antes.id === id && antes.nombre === nombre && (antes.todos === true) === todos) return
    window.localStorage.setItem(CLAVE, JSON.stringify(nuevo))
    avisar(nuevo)
  } catch { /* sin almacenamiento: se cae al servidor */ }
}

/** «Todos los clientes» (Dinero y Observabilidad): se recuerda el último cliente para los paneles de uno solo */
export function elegirTodosLosClientes(): void {
  try {
    if (typeof window === "undefined") return
    const antes = leerClienteDeTrabajo()
    if (antes?.todos) return
    const nuevo: ClienteDeTrabajo = { id: antes?.id ?? null, nombre: antes?.nombre ?? null, todos: true }
    window.localStorage.setItem(CLAVE, JSON.stringify(nuevo))
    avisar(nuevo)
  } catch { /* sin almacenamiento: no pasa nada */ }
}

function avisar(c: ClienteDeTrabajo): void {
  try { window.dispatchEvent(new CustomEvent<ClienteDeTrabajo>(EVENTO_CLIENTE_DE_TRABAJO, { detail: c })) } catch { /* sin eventos: los paneles leen al abrir */ }
}

/** escucha los cambios del cliente de trabajo (en esta pestaña y en otras); devuelve con qué dejar de escuchar */
export function escucharClienteDeTrabajo(w: Pick<Window, "addEventListener" | "removeEventListener">, alCambiar: (c: ClienteDeTrabajo | null) => void): () => void {
  const aqui = (e: Event) => alCambiar((e as CustomEvent<ClienteDeTrabajo>).detail ?? leerClienteDeTrabajo())
  const otraPestana = (e: Event) => { if ((e as StorageEvent).key === CLAVE) alCambiar(leerClienteDeTrabajo()) }
  w.addEventListener(EVENTO_CLIENTE_DE_TRABAJO, aqui)
  w.addEventListener("storage", otraPestana)
  return () => { w.removeEventListener(EVENTO_CLIENTE_DE_TRABAJO, aqui); w.removeEventListener("storage", otraPestana) }
}

/** de la lista del Centro, cuál es el cliente recordado (por id; si solo se recuerda el nombre, por nombre) */
export function clienteRecordadoEn(lista: Array<{ id: string; nombre: string }>, recordado: ClienteDeTrabajo | null): string | null {
  if (!recordado) return null
  if (recordado.id && lista.some((c) => c.id === recordado.id)) return recordado.id
  if (recordado.nombre) { const n = recordado.nombre.toLocaleLowerCase("es"); return lista.find((c) => c.nombre.toLocaleLowerCase("es") === n)?.id ?? null }
  return null
}
