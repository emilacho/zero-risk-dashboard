/**
 * MAPA · lectura (servidor, solo lectura). Un error de la base lanza; nunca se lee como «0».
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { familiaLegible, estadoDeLaPiezaLegible, resultadoDeJefaturaLegible, tituloDePieza } from "@/lib/lenguaje"
import { contarCosas, dondeEstaElEncargo, type Paso, type PiezaEnElMapa } from "@/lib/mapa"
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
  const ultimoPorClave = new Map<string, Fila>()
  for (const e of enc) { const k = `${e.brief_id}|${e.familia}`; const p = ultimoPorClave.get(k); if (!p || String(e.creado_en) > String(p.creado_en)) ultimoPorClave.set(k, e) }
  const finales = [...ultimoPorClave.values()].sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en)))
  const rev = revisiones.filter((r) => r.dry_run !== true)
  const porResultado = agrupar(rev, "resultado")
  const porEstadoBandeja = agrupar(bandeja, "status")
  const pasos: Paso[] = [
    { clave: "brief", cuantos: new Set(enc.map((e) => String(e.brief_id))).size, detalle: [contarCosas(new Set(enc.map((e) => String(e.brief_id))).size, "pedido de pieza", "pedidos de piezas") + " en 7 días"], ultimo: ultimo(enc, "creado_en") },
    { clave: "oficina", cuantos: finales.filter((e) => String(e.estado).startsWith("cerrado")).length, detalle: [`${contarCosas(finales.filter((e) => String(e.estado).startsWith("cerrado")).length, "pieza entregada", "piezas entregadas")}`, finales.filter((e) => e.estado === "fallido").length > 0 ? `${contarCosas(finales.filter((e) => e.estado === "fallido").length, "pieza que falló y no se rehízo", "piezas que fallaron y no se rehicieron")}` : "ninguna pieza fallida sin rehacer"], ultimo: ultimo(turnos, "fin") },
    { clave: "mesa", cuantos: aportes.length, detalle: [`${contarCosas(new Set(aportes.map((a) => String(a.encargo_id))).size, "pieza pasó por la mesa", "piezas pasaron por la mesa")}`], ultimo: ultimo(aportes, "creado_en") },
    { clave: "jefatura", cuantos: rev.length, detalle: Object.entries(porResultado).map(([k, n]) => `${n} ${resultadoDeJefaturaLegible(k)}`), ultimo: ultimo(rev, "cerrado_en") },
    { clave: "bandeja", cuantos: bandeja.length, detalle: Object.entries(porEstadoBandeja).map(([k, n]) => `${n} ${k === "pending" ? "por aprobar" : k === "approved" ? "aprobada" : k === "rejected" ? "rechazada" : k === "edited" ? "con cambios pedidos" : "en otro estado"}`), ultimo: ultimo(bandeja, "created_at") },
  ]
  const piezas: PiezaEnElMapa[] = finales.slice(0, 8).map((e) => ({ id: String(e.id), brief: tituloDePieza({ familia: e.familia, creada: String(e.creado_en) }), familia: familiaLegible(e.familia), donde: dondeEstaElEncargo(e), estado: estadoDeLaPiezaLegible(e.estado), creado_en: String(e.creado_en), gasto_usd: Number(e.gasto_usd ?? 0) }))
  return { pasos, piezas }
}
