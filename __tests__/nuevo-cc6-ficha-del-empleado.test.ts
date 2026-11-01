/**
 * CC6 · Sprint B · la ficha del empleado (ENCARGO Lenovo pedido por Emilio, 01-nov): currículum moderno al tocar un nombre en la lista de la mesa.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { APELLIDOS, NOMBRES, habilidadesDe, huella, iniciales, modeloLegible, nombresDePersona, numerosDelEmpleado, origenLegible, tareasRecientes, type FichaDelEmpleado as Ficha, type InvocacionDelEmpleado } from "@/lib/escena-empleado"
import { leerFichaDelEmpleado } from "@/lib/escena-empleado-datos"
import { FichaDelEmpleado } from "@/components/nuevo/escena/FichaDelEmpleado"

describe("el nombre de persona: inventado, diverso, sin repetir y ESTABLE", () => {
  const agentes = Array.from({ length: 71 }, (_, i) => ({ name: `agente-${i}`, created_at: `2026-04-${String(1 + (i % 28)).padStart(2, "0")}T00:00:00Z` }))
  it("cada empleado tiene un nombre y apellido de las listas, todos distintos", () => {
    const m = nombresDePersona(agentes)
    expect(m.size).toBe(71); expect(new Set(m.values()).size).toBe(71)
    for (const n of m.values()) { const [a, b] = n.split(" "); expect(NOMBRES).toContain(a); expect(APELLIDOS).toContain(b) }
  })
  it("no cambia entre visitas ni cuando entra un empleado nuevo (que llega después)", () => {
    const antes = nombresDePersona(agentes)
    expect(nombresDePersona([...agentes].reverse())).toEqual(antes) // el orden en que llegan las filas no importa
    const despues = nombresDePersona([...agentes, { name: "nuevo-agente", created_at: "2026-11-01T00:00:00Z" }])
    for (const [k, v] of antes) expect(despues.get(k)).toBe(v)
    expect(huella("market_research_analyst")).toBe(huella("market_research_analyst"))
    expect(iniciales("Valeria Ortiz")).toBe("VO")
  })
})

describe("origen, habilidades, métodos y modelo: de la base, sin inventar", () => {
  it("el origen sale de identity_source; la licencia no se inventa", () => {
    expect(origenLegible("canonical:msitarzewski/agency-agents@b37b5bb:design/design-whimsy-injector.md")).toEqual({ texto: "repositorio msitarzewski/agency-agents (versión b37b5bb)", repositorio: "msitarzewski/agency-agents", archivo: "design/design-whimsy-injector.md" })
    expect(origenLegible("project-local:src/agents/identities/jefe-marketing.md").texto).toBe("identidad propia de Zero Risk")
    expect(origenLegible("registry:managed_agents_registry:market-research · backfill").texto).toBe("registro de agentes administrados de Zero Risk")
    expect(origenLegible(null).texto).toBe("sin dato")
    expect(origenLegible("managed_agents_registry canonical seed post-PR22-unseed CC#2 2026-05-16").texto).toBe("registro de agentes administrados de Zero Risk") // sin notas internas
    expect(origenLegible("algo raro interno").texto).toBe("registrado en la base, sin repositorio declarado")
  })
  it("las habilidades: lo que sabe hacer según el directorio; sin tarjeta, las responsabilidades de su identidad; si no, nada", () => {
    expect(habilidadesDe(["señales con fuente y fecha", "decir «sin dato»"], "x")).toEqual({ lista: ["señales con fuente y fecha", "decir «sin dato»"], fuente: "directorio" })
    expect(habilidadesDe(null, "# A\n## Responsibilities\n- Track **trends**\n- Detect weak signals\n## Output\n- x")).toEqual({ lista: ["Track trends", "Detect weak signals"], fuente: "identidad" })
    expect(habilidadesDe([], "# sin secciones")).toEqual({ lista: [], fuente: null })
    expect(modeloLegible("claude-sonnet")).toBe("Claude Sonnet"); expect(modeloLegible(null)).toBe("sin dato")
  })
})

describe("el trabajo y los números", () => {
  const AHORA = new Date("2026-11-01T17:00:00Z")
  const inv = (x: Partial<InvocacionDelEmpleado>): InvocacionDelEmpleado => ({ created_at: "2026-10-30T10:00:00Z", status: "completed", cost_usd: 0.1, duration_ms: 120000, client_id: "c1", workflow_id: "X9F0zp6LQ2xGEYVS", workflow_execution_id: "209744:analisis-mercado", metadata: {}, ...x })
  const invs = [inv({}), inv({ status: "failed", cost_usd: 0.05, created_at: "2026-10-31T10:00:00Z" }), inv({ created_at: "2026-08-01T10:00:00Z", cost_usd: 1, duration_ms: 240000 })]
  it("tareas, éxito, tiempo promedio, gasto total y de 30 días", () => {
    expect(numerosDelEmpleado(invs, AHORA)).toEqual({ tareas: 3, completadas: 2, fallidas: 1, tasa_de_exito: 67, minutos_promedio: 2.7, gasto_total_usd: 1.15, gasto_30d_usd: 0.15, primera: "2026-08-01T10:00:00Z", ultima: "2026-10-31T10:00:00Z" })
    expect(numerosDelEmpleado([], AHORA)).toMatchObject({ tareas: 0, tasa_de_exito: null, minutos_promedio: null })
  })
  it("las últimas tareas con cliente, flujo y paso en palabras", () => {
    const r = tareasRecientes(invs, new Map([["c1", "Náufrago"]]))
    expect(r[0]).toEqual({ fecha: "2026-10-31T10:00:00Z", cliente: "Náufrago", flujo: "Plan de 90 días", paso: "analisis mercado", estado: "fallida", costo_usd: 0.05, minutos: 2 })
  })
})

/** base falsa: contesta por tabla; cualquier escritura rompe la prueba */
function baseFalsa(respuestas: Record<string, unknown | ((f: string[]) => unknown)>, error: Record<string, string> = {}) {
  const consulta = (tabla: string): unknown => {
    const q: Record<string, unknown> = {}; const filtros: string[] = []
    const enc = (n: string) => (...a: unknown[]) => { filtros.push(`${n}(${a.map((x) => JSON.stringify(x)).join(",")})`); return q }
    for (const n of ["select", "eq", "in", "order", "limit", "gte"]) q[n] = enc(n)
    const r = () => { const x = respuestas[tabla]; return typeof x === "function" ? (x as (f: string[]) => unknown)(filtros) : x }
    const e = error[tabla] ? { message: error[tabla] } : null
    q.maybeSingle = () => Promise.resolve({ data: e ? null : Array.isArray(r()) ? (r() as unknown[])[0] ?? null : r() ?? null, error: e })
    q.then = (ok: (v: unknown) => unknown, ko?: (v: unknown) => unknown) => Promise.resolve({ data: e ? null : r() ?? [], error: e }).then(ok, ko)
    for (const n of ["insert", "update", "upsert", "delete", "rpc"]) q[n] = () => { throw new Error(`escritura prohibida: ${tabla}.${n}`) }
    return q
  }
  return { from: consulta } as unknown as Parameters<typeof leerFichaDelEmpleado>[0]
}
const AG = { id: "a1", name: "market_research_analyst", display_name: "Trend Researcher", model: "claude-sonnet", created_at: "2026-04-10T22:49:19Z", identity_source: "registry:managed_agents_registry:market-research", identity_content: "# x", reports_to: null }

describe("la lectura (solo lectura)", () => {
  it("arma la ficha con lo real; un empleado que no existe da null; un error de la base lanza", async () => {
    const b = baseFalsa({
      agents: (f: string[]) => (f.some((x) => x.startsWith("eq(")) ? [AG] : [AG, { id: "a2", name: "otro", display_name: "Otro", created_at: "2026-04-11T00:00:00Z" }]),
      oficina_directorio: (f: string[]) => (f.some((x) => x.startsWith("eq(")) ? [{ agente: AG.name, especialidad: "mercado", sabe_hacer: ["señales con fuente"], equipo: "estrategia" }] : [{ agente: AG.name, equipo: "estrategia" }]),
      agent_invocations: [{ created_at: "2026-10-31T10:00:00Z", status: "completed", cost_usd: 0.2, duration_ms: 60000, client_id: "c1", workflow_id: null, workflow_execution_id: "1:analisis", metadata: {} }],
      agent_dispatches: [{ status: "running", created_at: "2026-10-30T10:00:00Z", running_at: "2026-10-30T10:00:00Z" }],
      oficina_mesa_aportes: [{ tipo: "usado" }, { tipo: "usado" }, { tipo: "descartado" }],
      agent_skill_assignments: [{ skill_id: "s1" }], agent_skills: [{ id: "s1", skill_name: "marketing-ideas", skill_source: "coreyhaines31/marketingskills" }],
      clients: [{ id: "c1", name: "Náufrago" }],
    })
    const f = await leerFichaDelEmpleado(b, AG.name, { ahora: new Date("2026-11-01T17:00:00Z") })
    expect(f).toMatchObject({ agente: AG.name, puesto: "Trend Researcher", especialidad: "mercado", modelo: "Claude Sonnet", contratado_en: AG.created_at, equipo: { clave: "estrategia", nombre: "Estrategia", origen: "directorio" }, metodos: [{ nombre: "marketing-ideas", fuente: "coreyhaines31/marketingskills" }], ahora: { trabajando: 0, sin_cierre_registrado: 1 }, aportes: [{ tipo: "usado", n: 2 }, { tipo: "descartado", n: 1 }] })
    expect(f!.persona).toMatch(/^\S+ \S+$/); expect(f!.revisa).toContain("sin dato")
    expect(f!.recientes[0]).toMatchObject({ cliente: "Náufrago", estado: "completada" })
    expect(await leerFichaDelEmpleado(baseFalsa({ agents: [], oficina_directorio: [], agent_invocations: [], agent_dispatches: [], oficina_mesa_aportes: [] }), "no-existe")).toBeNull()
    await expect(leerFichaDelEmpleado(baseFalsa({ agents: [AG] }, { agent_invocations: "se cayó" }), AG.name)).rejects.toThrow(/se cayó/)
  })
})

describe("la ficha en pantalla y su ruta", () => {
  const ficha: Ficha = {
    agente: "market_research_analyst", persona: "Valeria Ortiz", puesto: "Trend Researcher", especialidad: "mercado: tendencia y oportunidad", equipo: { clave: "estrategia", nombre: "Estrategia", origen: "directorio" },
    modelo: "Claude Sonnet", contratado_en: "2026-04-10T22:49:19Z", revisa: "sin dato (no tiene a quién reporta en la base)", origen: origenLegible("canonical:msitarzewski/agency-agents@b37b5bb:x.md"),
    habilidades: { lista: ["señales con fuente y fecha"], fuente: "directorio" }, metodos: [], numeros: { tareas: 3, completadas: 2, fallidas: 1, tasa_de_exito: 67, minutos_promedio: 2.7, gasto_total_usd: 1.15, gasto_30d_usd: 0.15, primera: null, ultima: null },
    recientes: [], ahora: { trabajando: 0, sin_cierre_registrado: 2 }, aportes: [], fuente: "agents · agent_invocations (3)", leido_en: "2026-11-01T17:00:00Z",
  }
  it("dibuja el currículum: nombre de persona y puesto real, retrato, habilidades, números, «sin cierre registrado», fuente y hora; «sin dato» honesto", () => {
    const html = renderToStaticMarkup(createElement(FichaDelEmpleado, { agente: ficha.agente, onCerrar: () => {}, datosIniciales: ficha }))
    expect(html).toContain("Valeria Ortiz"); expect(html).toContain("Trend Researcher"); expect(html).toContain(">VO<"); expect(html).toContain("señales con fuente y fecha")
    expect(html).toContain("67 %"); expect(html).toContain("2 sin cierre registrado"); expect(html).not.toContain("trabajando ahora")
    expect(html).toContain("sin métodos asignados en la base"); expect(html).toContain("sin tareas registradas"); expect(html).toContain("licencia: sin dato en la base")
    expect(html).toContain("leído 17:00Z"); expect(html).toContain("nv-panel") // no tapa el chat de abajo
  })
  it("la ruta es solo para administrador, valida el identificador y no escribe", () => {
    const r = readFileSync("app/api/escena-viva/empleado/route.ts", "utf8")
    expect(r).toContain("exigirAdmin()"); expect(r).toContain("agente_invalido"); expect(r).not.toMatch(/insert|update|delete|upsert/)
    expect(readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")).toContain("data-abrir-ficha={p.agente}")
  })
})
