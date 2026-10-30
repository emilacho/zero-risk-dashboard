/**
 * INICIO · lectura (servidor, solo lectura). Reutiliza las lecturas de Oficinas y de Gasto para que una cifra tenga UN solo dueño.
 * Cada bloque se lee por separado: si uno falla, ese bloque dice que no pudo leerse y los demás siguen.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { leerOficinas } from "@/lib/oficinas-datos"
import { leerGasto } from "@/lib/gasto-datos"
import { leerTrabajoEnVivo, type TrabajoEnVivo } from "@/lib/trabajo-en-vivo"
import { esDeBaja, esDePractica } from "@/lib/clientes"
import { estadoDeLaPieza } from "@/lib/piezas"
import { leerAlertas } from "@/lib/alertas-datos"
import { desde, type TarjetaDeOficina } from "@/lib/oficinas"
import { contarPiezasPorAprobar, listarPiezas } from "@/lib/piezas-datos"
import { familiaLegible, resultadoDeJefaturaLegible, estadoDeCampanaLegible } from "@/lib/lenguaje"
import { estadoDelSistema, piezasPorSemana, teNecesitan, ultimosHechos, type EstadoDelSistema, type Hecho, type Pendiente, type Semana } from "@/lib/inicio"

type Fila = Record<string, unknown>
type R = PromiseLike<{ data: unknown; error: { message: string } | null }>
type C = PromiseLike<{ count: number | null; error: { message: string } | null }>

async function filas(q: R, que: string): Promise<Fila[]> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? []) as Fila[] }
async function contar(q: C, que: string): Promise<number> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return r.count ?? 0 }

/** un bloque que puede fallar sin tumbar a los demás */
export type Bloque<T> = { ok: true; valor: T } | { ok: false; error: string }
async function bloque<T>(f: () => Promise<T>): Promise<Bloque<T>> {
  try { return { ok: true, valor: await f() } } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) } }
}

export interface LecturaDeInicio {
  te_necesitan: Bloque<Pendiente[]>
  estado: Bloque<EstadoDelSistema>
  cifras: Bloque<{ piezas_semana: number; gasto_hoy: number; gasto_mes: number; mes: string; clientes_activos: number; gasto_30d: number[]; semanas: Semana[] }>
  /** las piezas por aprobar con su miniatura (la lámina 1), las 3 más nuevas */
  miniaturas: Bloque<Array<{ id: string; titulo: string; tiene_dibujo: boolean }>>
  oficinas: Bloque<TarjetaDeOficina[]>
  hechos: Bloque<Hecho[]>
  /** lo que hacen los empleados ahora (primera pintura del panel en vivo) */
  trabajo: Bloque<TrabajoEnVivo>
}

export async function leerInicio(supa: SupabaseClient, ahora: Date = new Date()): Promise<LecturaDeInicio> {
  // 30-oct · todo en paralelo (antes: oficinas → grupo → miniaturas, tres esperas seguidas)
  const [oficinas, te_necesitan, cifras, hechos, alertasNuevas, miniaturas, trabajo] = await Promise.all([
    bloque(() => leerOficinas(supa, ahora)),
    bloque(async () => {
      const [piezas, otras, preguntas] = await Promise.all([
        contarPiezasPorAprobar(supa),
        contar(supa.from("hitl_queue").select("*", { count: "exact", head: true }).eq("status", "pending").neq("type", "content_piece_review"), "hitl_queue"),
        contar(supa.from("finanzas_preguntas").select("*", { count: "exact", head: true }).is("respondida_en", null), "finanzas_preguntas"),
      ])
      return teNecesitan({ piezas, revisiones: otras, preguntas })
    }),
    bloque(async () => {
      const [g, enc, cli] = await Promise.all([
        leerGasto(supa, ahora),
        filas(supa.from("oficina_encargos").select("estado, dry_run, cerrado_en").gte("cerrado_en", desde(42, ahora)).limit(2000), "oficina_encargos"),
        // «clientes en servicio» = reales: sin archivados, dados de baja ni fichas de práctica (la misma regla que la lista de Clientes)
        filas(supa.from("clients").select("name, industry, status, archived_at").in("status", ["active", "onboarding"]).is("archived_at", null).limit(500), "clients"),
      ])
      const semanas = piezasPorSemana(enc, ahora, 6)
      const hechas = semanas[semanas.length - 1].piezas
      return { piezas_semana: hechas, gasto_hoy: g.resumen.hoy.total, gasto_mes: g.resumen.mes.total, mes: g.resumen.mes.etiqueta, clientes_activos: cli.filter((x) => !esDeBaja({ estado: String(x.status ?? ""), archivado: x.archived_at != null, nombre: String(x.name ?? "") }) && !esDePractica({ rubro: x.industry ? String(x.industry) : null, nombre: String(x.name ?? "") })).length, gasto_30d: g.resumen.ultimos.dias.map((x) => x.total), semanas }
    }),
    bloque(async () => {
      const [enc, rev, camp, dec] = await Promise.all([
        filas(supa.from("oficina_encargos").select("brief_id, familia, estado, cerrado_en, dry_run, hitl_queue_id").not("cerrado_en", "is", null).order("cerrado_en", { ascending: false }).limit(10), "oficina_encargos"),
        filas(supa.from("jefatura_revisiones").select("artifact_type, resultado, cerrado_en, dry_run").not("cerrado_en", "is", null).order("cerrado_en", { ascending: false }).limit(10), "jefatura_revisiones"),
        filas(supa.from("cadena_campanas").select("estado, creada_en, seco").order("creada_en", { ascending: false }).limit(5), "cadena_campanas"),
        filas(supa.from("hitl_queue").select("id, title, status, decided_at, decision").neq("status", "pending").not("decided_at", "is", null).eq("type", "content_piece_review").order("decided_at", { ascending: false }).limit(10), "hitl_queue"),
      ])
      const h: Hecho[] = []
      for (const e of enc.filter((x) => x.dry_run !== true)) h.push({ cuando: String(e.cerrado_en), texto: String(e.estado).startsWith("cerrado") ? `Pieza lista: ${familiaLegible(e.familia)}` : `Una pieza (${familiaLegible(e.familia).toLowerCase()}) no se pudo terminar`, href: e.hitl_queue_id ? "/piezas?id=" + String(e.hitl_queue_id) + "&estado=todas" : undefined })
      for (const r of rev.filter((x) => x.dry_run !== true)) h.push({ cuando: String(r.cerrado_en), texto: `La jefatura revisó ${r.artifact_type === "pieza" ? "una pieza" : r.artifact_type === "plan" ? "un plan" : "un trabajo"}: ${resultadoDeJefaturaLegible(r.resultado)}` })
      for (const c of camp.filter((x) => x.seco !== true)) h.push({ cuando: String(c.creada_en), texto: `Se armó una campaña (${estadoDeCampanaLegible(c.estado)})` })
      // una pieza «superada» (la reemplazó otra) o archivada NO la rechazó Emilio: no es un hecho para contar
      for (const d of dec.filter((x) => { const e = estadoDeLaPieza(String(x.status), x.decision); return e !== "superada" && e !== "archivada" })) h.push({ cuando: String(d.decided_at), texto: `Pieza ${d.status === "approved" ? "aprobada" : d.status === "rejected" ? "rechazada" : "con cambios"}: ${String(d.title).replace(/^⚠️\s*/, "").slice(0, 70)}`, href: `/piezas?id=${d.id}&estado=todas` })
      return ultimosHechos(h, 5)
    }),
    // el mismo número que muestra la pantalla de Alertas (misma lectura, ya sin duplicados)
    bloque(async () => (await leerAlertas(supa, ahora)).nuevas.length),
    bloque(async () => (await listarPiezas(supa, { estado: "pendiente", tipo: "piezas", limite: 3 })).map((p) => ({ id: p.id, titulo: p.titulo_legible, tiene_dibujo: p.tiene_dibujo }))),
    bloque(() => leerTrabajoEnVivo(supa, { limite: 8, ahora })),
  ])
  const estado: Bloque<EstadoDelSistema> = oficinas.ok ? { ok: true, valor: estadoDelSistema(oficinas.valor, alertasNuevas.ok ? alertasNuevas.valor : null) } : { ok: false, error: oficinas.error }
  return { te_necesitan, estado, cifras, oficinas, hechos, miniaturas, trabajo }
}
