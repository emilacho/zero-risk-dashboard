/**
 * 6.51 · LAS FALLAS DEL FLUJO (corrección aprobada por Emilio 2-nov, `2026-11-02-CORRECCION-LENOVO-a-CC5-CC1-lo-que-fallo-no-ve-las-fallas-del-flujo.md`).
 * Un pedido puede fallar aunque cada empleado haya terminado bien: se corta la conexión, un paso pasa de su límite de tiempo… Eso no queda en el libro de
 * los empleados (agent_invocations) sino en el pedido: `plan_cambios.estado = 'fallido'` con su motivo (`despertar_detalle`). SOLO LECTURA.
 */
import { diaLocal } from "@/lib/dinero-completo"

export interface FallaDelFlujo {
  id: string; client_id: string | null; cliente: string | null; documento: string | null; seccion: string | null
  inicio: string; fin: string | null; dia: string; ejecucion: string | null; motivo: string; detalle: string | null
}

const txt = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)
const minutos = (ms: number) => `${Math.max(1, Math.round(ms / 60000))} min`

/** el motivo en palabras: «se cortó la conexión a los 6 min», «un paso pasó de 2 min y se cortó (a los 16 min)» */
export function motivoDelFlujo(detalle: string | null, inicio: string | null, fin: string | null): string {
  const d = detalle ?? "", dur = inicio && fin ? Date.parse(fin) - Date.parse(inicio) : NaN, cuando = Number.isFinite(dur) && dur > 0 ? ` a los ${minutos(dur)}` : ""
  const tope = d.match(/timed out after (\d+) ?(seconds|s|ms)\b/i)
  if (tope) { const s = tope[2].toLowerCase() === "ms" ? Number(tope[1]) / 1000 : Number(tope[1]); return `un paso pasó de ${s >= 60 ? minutos(s * 1000) : `${s} s`} (su límite) y se cortó${cuando}` }
  if (/connection .*closed|ECONNRESET|socket hang up|offline/i.test(d)) return `se cortó la conexión${cuando}`
  if (/timeout|timed out|tiempo l[ií]mite/i.test(d)) return `se pasó del tiempo límite${cuando}`
  if (/sin dejar una versi[oó]n nueva/i.test(d)) return `terminó sin dejar la versión nueva${cuando}`
  return `el flujo falló${cuando}`
}

/** el proceso en palabras de oficina (igual que la lista): «Cambios al manual», «Cambios al plan» */
export const procesoDeLaFalla = (f: Pick<FallaDelFlujo, "documento">): string => (f.documento === "plan" ? "Cambios al plan" : f.documento === "manual" ? "Cambios al manual" : "Cambios pedidos")

export function normalizarFallas(filas: unknown[], nombreCliente: Map<string, string>): FallaDelFlujo[] {
  return filas.flatMap((v) => {
    const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {}
    const id = txt(o.id), inicio = txt(o.creado_en)
    if (!id || !inicio || o.estado !== "fallido") return []
    const fin = txt(o.actualizado_en), detalle = txt(o.despertar_detalle), cid = txt(o.client_id)
    return [{ id, client_id: cid, cliente: cid ? nombreCliente.get(cid) ?? null : null, documento: txt(o.documento), seccion: txt(o.seccion), inicio, fin, dia: diaLocal(inicio), ejecucion: txt(o.workflow_execution_id), motivo: motivoDelFlujo(detalle, inicio, fin), detalle }]
  }).sort((a, b) => b.inicio.localeCompare(a.inicio))
}

/** la corrida de los empleados que nació de ese pedido (mismo cliente, empezó dentro de la ventana del pedido): ahí se ven sus pasos */
export function corridaDelPedido<C extends { client_id: string | null; inicio: string | null; workflow_execution_id: string }>(f: Pick<FallaDelFlujo, "client_id" | "inicio" | "fin">, cs: C[]): C | null {
  const a = Date.parse(f.inicio) - 5000, b = f.fin ? Date.parse(f.fin) : a + 3600_000
  return cs.filter((c) => c.client_id === f.client_id && c.inicio && Date.parse(c.inicio) >= a && Date.parse(c.inicio) <= b).sort((x, y) => (x.inicio ?? "").localeCompare(y.inicio ?? ""))[0] ?? null
}
/** suma las fallas del flujo a los errores (el pedido falló aunque sus empleados terminaran bien) */
export function conFallasDelFlujo<N extends { corridas: number; con_error: number; pct_error: number | null }>(n: N, fallas: number): N {
  if (!fallas) return n
  // las que cuentan para el %: las terminadas (se deducen del % que ya traía); el pedido que falló ya está entre las corridas (su sub-corrida «terminó bien»)
  const cuentan = n.pct_error != null && n.con_error > 0 ? Math.round(n.con_error / (n.pct_error / 100)) : n.corridas
  const con_error = n.con_error + fallas, corridas = Math.max(n.corridas, con_error), base = Math.max(cuentan, con_error)
  return { ...n, corridas, con_error, pct_error: base > 0 ? Math.round((con_error / base) * 1000) / 10 : null }
}
