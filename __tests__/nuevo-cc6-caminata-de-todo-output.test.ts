/** CADA OUTPUT QUE TERMINA CAMINA AL PIZARRÓN (CC6 · 04-nov · ADENDAS 1 y 2 de Lenovo, pasadas de CC4 a CC6). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { armarEntregas, FIN_DEL_TRABAJO, MAXIMO_DE_CUADROS, quienCerroElTrabajo, trabajosTerminados } from "@/lib/escena-entregas"
import { leerTrabajosTerminados } from "@/lib/escena-avatares-datos"

const AHORA = new Date("2026-11-04T15:30:00Z")
const base = { encargos: [], turnos: [], filas: [], revisiones: [], pasos: [], bandeja: [], ahora: AHORA }
// datos de forma real (lectura del 04-nov): el plan r3 de Náufrago y la reescritura del manual
const PLAN = { id: "2c0d2236-50da-44b2-95c5-3aa19885fea4", estado: "hecha", dry_run: false, actualizado_en: "2026-11-04T13:49:30.138+00:00" }
const PEDIDO = { id: "7d9913a3-007f-4685-bcdd-a2321793a39c", estado: "aplicado", documento: "manual", actualizado_en: "2026-11-04T10:00:10.213+00:00" }
const llamada = (agent_name: string, trabajo_tipo: string, trabajo_id: string, ended_at: string, status = "completed") => ({ agent_name, trabajo_tipo, trabajo_id, ended_at, status })

describe("1 · «terminó un output» sale del estado final de su trabajo raíz", () => {
  it("plan hecho, pedido aplicado y alta completada → un output cada uno, con su nombre", () => {
    const w = trabajosTerminados({ planes: [PLAN], pedidos: [PEDIDO, { ...PEDIDO, id: "p2", documento: "plan" }], altas: [{ id: "j1", status: "completed", updated_at: "2026-11-04T12:00:00Z" }] })
    expect(w.map((x) => [x.tipo, x.titulo])).toEqual([["plan", "Plan de 90 días terminado"], ["pedido", "Manual de marca reescrito"], ["pedido", "Plan corregido"], ["alta", "Alta del cliente terminada"]])
  })
  it("lo que no terminó bien o es ensayo NO es un output", () => {
    expect(trabajosTerminados({ planes: [{ ...PLAN, estado: "fallida" }, { ...PLAN, dry_run: true }, { ...PLAN, estado: "en_curso" }], pedidos: [{ ...PEDIDO, estado: "fallido" }], altas: [{ id: "j", status: "active", updated_at: "2026-11-04T12:00:00Z" }, { id: "k", status: "abandoned", updated_at: "2026-11-04T12:00:00Z" }] })).toEqual([])
  })
  it("las clases de trabajo con final conocido son las que la base admite (sin la pieza, que ya tenía el suyo)", () => {
    expect(Object.keys(FIN_DEL_TRABAJO).sort()).toEqual(["alta", "pedido", "plan"])
  })
})

describe("2 · quién camina: quien lo dirigió o lo cerró, solo con llamadas reales de ese trabajo", () => {
  const w = { tipo: "plan", id: PLAN.id }
  it("el que el directorio marca de dirección gana aunque haya hecho menos llamadas", () => {
    const ll = [llamada("finance-fpa-analyst", "plan", PLAN.id, "2026-11-04T13:17:11Z"), llamada("finance-fpa-analyst", "plan", PLAN.id, "2026-11-04T13:19:14Z"), llamada("campaign-brief-agent", "plan", PLAN.id, "2026-11-04T13:20:00Z")]
    expect(quienCerroElTrabajo(w, ll, ["campaign-brief-agent"])).toBe("campaign-brief-agent")
  })
  it("sin dirección: el que más llamadas hizo; empate → el que terminó último", () => {
    const ll = [llamada("finance-fpa-analyst", "plan", PLAN.id, "2026-11-04T13:17:11Z"), llamada("jefe-marketing", "plan", PLAN.id, "2026-11-04T13:39:12Z"), llamada("jefe-marketing", "plan", PLAN.id, "2026-11-04T13:45:17Z"), llamada("tracking-specialist", "plan", PLAN.id, "2026-11-04T13:22:08Z")]
    expect(quienCerroElTrabajo(w, ll, [])).toBe("jefe-marketing")
    expect(quienCerroElTrabajo(w, [llamada("a", "plan", PLAN.id, "2026-11-04T13:00:00Z"), llamada("b", "plan", PLAN.id, "2026-11-04T13:10:00Z")], [])).toBe("b")
    // el que más hizo gana aunque otro haya terminado después
    expect(quienCerroElTrabajo(w, [llamada("a", "plan", PLAN.id, "2026-11-04T13:00:00Z"), llamada("a", "plan", PLAN.id, "2026-11-04T13:05:00Z"), llamada("b", "plan", PLAN.id, "2026-11-04T13:10:00Z")], [])).toBe("a")
  })
  it("no cuenta llamadas fallidas ni de OTRO trabajo (ni el mismo id de otra clase); sin ninguna → nadie camina", () => {
    const ll = [llamada("x", "plan", PLAN.id, "2026-11-04T13:50:00Z", "failed"), llamada("y", "plan", "otro", "2026-11-04T13:50:00Z"), llamada("z", "pedido", PLAN.id, "2026-11-04T13:50:00Z")]
    expect(quienCerroElTrabajo(w, ll, [])).toBeNull()
    expect(quienCerroElTrabajo(w, [], ["campaign-brief-agent"])).toBeNull()
  })
})

describe("3 · entran a la caminata junto a las piezas", () => {
  it("el plan y el manual de hoy salen como entregas (de la más nueva a la más vieja); quien camina, si hay dato", () => {
    const trabajos = trabajosTerminados({ planes: [PLAN], pedidos: [PEDIDO] })
    const e = armarEntregas({ ...base, trabajos, llamadasDeTrabajos: [llamada("jefe-marketing", "plan", PLAN.id, "2026-11-04T13:45:17Z")], directores: [] }).entregas
    expect(e.map((x) => [x.id, x.agente, x.titulo])).toEqual([[`plan:${PLAN.id}`, "jefe-marketing", "Plan de 90 días terminado"], [`pedido:${PEDIDO.id}`, null, "Manual de marca reescrito"]])
  })
  it("junto a una pieza cerrada, en orden; fuera de las 24 h o en el futuro no camina; nunca más de MAXIMO_DE_CUADROS", () => {
    const pieza = { id: "enc1", estado: "cerrado", cerrado_en: "2026-11-04T12:00:00Z", sala_ref: null }
    const trabajos = trabajosTerminados({ planes: [PLAN, { ...PLAN, id: "viejo", actualizado_en: "2026-11-03T15:00:00Z" }, { ...PLAN, id: "futuro", actualizado_en: "2026-11-04T16:00:00Z" }], pedidos: [PEDIDO] })
    expect(armarEntregas({ ...base, encargos: [pieza], trabajos }).entregas.map((x) => x.id)).toEqual([`plan:${PLAN.id}`, "enc1", `pedido:${PEDIDO.id}`])
    const muchos = trabajosTerminados({ planes: Array.from({ length: 20 }, (_, i) => ({ ...PLAN, id: `p${i}`, actualizado_en: `2026-11-04T1${i % 5}:00:00Z` })) })
    expect(armarEntregas({ ...base, trabajos: muchos }).entregas.length).toBe(MAXIMO_DE_CUADROS)
  })
})

describe("4 · la lectura (solo lectura) pide solo lo terminado, real y de la ventana", () => {
  it("filtra por estado final, sin ensayos, desde la ventana; busca las llamadas por esos trabajos", async () => {
    const pedidos: string[] = []
    const supa = { from: (tabla: string) => {
      const r: Record<string, unknown> = {}, q: string[] = [tabla]
      for (const m of ["select", "eq", "gte", "limit", "in"]) r[m] = (...a: unknown[]) => { q.push(`${m}(${a.map((x) => JSON.stringify(x)).join(",")})`); return r }
      r.then = (ok: (x: unknown) => unknown) => { pedidos.push(q.join(".")); const d = tabla === "plan_corridas" ? [PLAN] : tabla === "plan_cambios" ? [PEDIDO] : tabla === "oficina_directorio" ? [{ agente: "campaign-brief-agent" }] : tabla === "agent_invocations" ? [llamada("jefe-marketing", "plan", PLAN.id, "2026-11-04T13:45:17Z")] : []; return Promise.resolve({ data: d, error: null }).then(ok) }
      return r
    } } as never
    const x = await leerTrabajosTerminados(supa, "2026-11-03T15:30:00.000Z")
    expect(x.trabajos.map((w) => w.tipo)).toEqual(["plan", "pedido"]); expect(x.directores).toEqual(["campaign-brief-agent"]); expect(x.llamadasDeTrabajos.length).toBe(1)
    const p = pedidos.join("\n")
    expect(p).toContain('plan_corridas.select("id, estado, dry_run, actualizado_en").eq("estado","hecha").eq("dry_run",false).gte("actualizado_en","2026-11-03T15:30:00.000Z")')
    expect(p).toContain('plan_cambios.select("id, estado, documento, actualizado_en").eq("estado","aplicado").gte("actualizado_en","2026-11-03T15:30:00.000Z")')
    expect(p).toContain('client_journey_state.select("id, status, updated_at").eq("status","completed")')
    expect(p).toContain('oficina_directorio.select("agente").eq("rol","direccion")')
    expect(p).toContain(`agent_invocations.select("agent_name, trabajo_tipo, trabajo_id, status, ended_at").in("trabajo_id",${JSON.stringify([PLAN.id, PEDIDO.id])})`)
  })
  it("una tabla que falla lanza (la escena sigue sin entregas; no se inventan)", async () => {
    const supa = { from: (tabla: string) => { const r: Record<string, unknown> = {}; for (const m of ["select", "eq", "gte", "limit", "in"]) r[m] = () => r; r.then = (ok: (x: unknown) => unknown) => Promise.resolve(tabla === "plan_cambios" ? { data: null, error: { message: "caída" } } : { data: [], error: null }).then(ok); return r } } as never
    await expect(leerTrabajosTerminados(supa, "2026-11-03T15:30:00.000Z")).rejects.toThrow()
  })
})

describe("5 · al recargar no se repite (la primera lectura solo siembra)", () => {
  it("Siluetas: la primera lista de entregas se marca como vista sin caminar", () => {
    const s = readFileSync("components/nuevo/escena/Siluetas.tsx", "utf8")
    expect(s).toContain("if (vistas.current === null) { vistas.current = new Set(entregas.map((e) => e.id)); return }")
  })
})
