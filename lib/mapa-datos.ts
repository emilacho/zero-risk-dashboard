/**
 * MAPA · lectura (servidor, solo lectura). Un error de la base lanza; nunca se lee como «0».
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { contarCosas, dondeEstaElEncargo, humanizar, type Paso, type PiezaEnElMapa } from "@/lib/mapa"
import { agrupar, desde } from "@/lib/oficinas"

type Fila = Record<string, unknown>
type R = PromiseLike<{ data: unknown; error: { message: string } | null }>
async function filas(q: R, que: string): Promise<Fila[]> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? []) as Fila[] }
const ultimo = (f: Fila[], col: string): string | null => f.map((x) => String(x[col] ?? "")).filter(Boolean).sort().pop() ?? null

export interface LecturaDelMapa { pasos: Paso[]; piezas: PiezaEnElMapa[] }

export async function leerMapa(supa: SupabaseClient, ahora: Date = new Date()): Promise<LecturaDelMapa> {
  const hace7 = desde(7, ahora)
  const todos = await filas(supa.from("oficina_encargos").select("id, brief_id, familia, estado, hitl_queue_id, dry_run, gasto_usd, creado_en, cerrado_en").gte("creado_en", hace7).order("creado_en", { ascending: false }).limit(500), "oficina_encargos")
  const enc = todos.filter((e) => e.dry_run !== true)
  const ids = enc.map((e) => String(e.id))
  const [turnos, aportes, revisiones, bandeja] = await Promise.all([
    ids.length ? filas(supa.from("oficina_turnos").select("encargo_id, tipo, estado, fin").in("encargo_id", ids).limit(5000), "oficina_turnos") : Promise.resolve([] as Fila[]),
    ids.length ? filas(supa.from("oficina_mesa_aportes").select("encargo_id, creado_en").in("encargo_id", ids).limit(5000), "oficina_mesa_aportes") : Promise.resolve([] as Fila[]),
    filas(supa.from("jefatura_revisiones").select("resultado, dry_run, cerrado_en, creado_en").gte("creado_en", hace7).limit(1000), "jefatura_revisiones"),
    filas(supa.from("hitl_queue").select("status, created_at").eq("type", "content_piece_review").gte("created_at", hace7).limit(1000), "hitl_queue"),
  ])
  const rev = revisiones.filter((r) => r.dry_run !== true)
  const porResultado = agrupar(rev, "resultado")
  const porEstadoBandeja = agrupar(bandeja, "status")
  const turnosDeTrabajo = turnos.filter((t) => t.tipo === "agente" || t.tipo === "codigo")
  const fallidos = turnos.filter((t) => t.estado === "fallo").length
  const pasos: Paso[] = [
    { clave: "brief", cuantos: new Set(enc.map((e) => String(e.brief_id))).size, detalle: [contarCosas(enc.length, "encargo", "encargos") + " (con repeticiones)"], ultimo: ultimo(enc, "creado_en") },
    { clave: "oficina", cuantos: enc.filter((e) => String(e.estado).startsWith("cerrado")).length, detalle: [`${turnosDeTrabajo.length} turnos de trabajo`, fallidos > 0 ? `${contarCosas(fallidos, "turno fallido", "turnos fallidos")}` : "sin turnos fallidos", `${enc.filter((e) => e.estado === "fallido").length} encargos fallidos`], ultimo: ultimo(turnos, "fin") },
    { clave: "mesa", cuantos: aportes.length, detalle: [`${new Set(aportes.map((a) => String(a.encargo_id))).size} piezas pasaron por la mesa`], ultimo: ultimo(aportes, "creado_en") },
    { clave: "jefatura", cuantos: rev.length, detalle: Object.entries(porResultado).map(([k, n]) => `${n} ${humanizar(k)}`), ultimo: ultimo(rev, "cerrado_en") },
    { clave: "bandeja", cuantos: bandeja.length, detalle: Object.entries(porEstadoBandeja).map(([k, n]) => `${n} ${k === "pending" ? "pendiente" : k === "approved" ? "aprobada" : k === "rejected" ? "rechazada" : humanizar(k)}`), ultimo: ultimo(bandeja, "created_at") },
  ]
  const piezas: PiezaEnElMapa[] = enc.slice(0, 8).map((e) => ({ id: String(e.id), brief: String(e.brief_id), familia: humanizar(e.familia), donde: dondeEstaElEncargo(e), estado: humanizar(e.estado), creado_en: String(e.creado_en), gasto_usd: Number(e.gasto_usd ?? 0) }))
  return { pasos, piezas }
}
