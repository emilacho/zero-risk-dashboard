/**
 * DASHBOARD NUEVO · SPRINT 6.47 · OBSERVABILIDAD FÁCIL DE LEER (encargo firmado por Emilio 2-nov: «veo una lista gigante, nada user friendly»).
 * Resumen arriba · «lo que falló» primero con motivo en palabras y salto al paso · grupos por proceso / cliente / empleado · interno oculto ·
 * empleados que más fallan y tardan con la flecha a su ficha · la corrida como línea de tiempo · el costo es la misma cuenta que Dinero.
 */
import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { normalizarDetalle, normalizarLista, type Corrida } from "@/lib/direccion-corridas"
import { resumenDelPeriodo, rangoDe, anteriorDe, type Dinero, type Movimiento } from "@/lib/dinero-completo"
import {
  agrupar, agruparPorEmpleado, cobertura, conFallosDelProceso, costoDelPeriodo, costoPorEjecucion, dondeFallo, empleadosDe, esCorridaInterna, motivoEnPalabras, numerosDe, procesoDe, topEmpleados, ventanaDe,
} from "@/lib/observabilidad"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {}, back: () => {} }) }))

const NAU = "0a2ffbd4-0000-4000-8000-000000000001"
const c = (id: string, x: Record<string, unknown> = {}) => ({ workflow_id: null, workflow_execution_id: id, client_id: NAU, cliente: "Náufrago", inicio: "2026-11-01T17:32:00.000Z", fin: "2026-11-01T17:48:00.000Z", duracion_ms: 960000, costo_usd: 1, tokens: 1000, pasos: 7, despachos: 1, fallos: 0, ramas: [], estado: "completa", ...x })
const LISTA = normalizarLista({
  total: 7, ejecuciones_total: 7, ejecuciones_leidas: 7,
  corridas: [
    c("plan-1", { workflow_id: "X9F0zp6LQ2xGEYVS", estado: "fallida", fallos: 1 }),
    c("pedido:abc", { nombre: "Cambios al plan de 90 días · pedido del dueño", inicio: "2026-10-31T15:00:00.000Z", fin: "2026-10-31T15:16:00.000Z", duracion_ms: 960000 }),
    c("cer-1", { workflow_id: "ogfq56oIEoHufFPM", duracion_ms: 3000, inicio: "2026-11-02T13:00:00.000Z" }),
    c("cer-2", { workflow_id: "ogfq56oIEoHufFPM", duracion_ms: 3000, inicio: "2026-11-02T14:00:00.000Z" }),
    c("alta-1", { workflow_id: "LyVoKcrypS5uLyuu", duracion_ms: 240000, inicio: "2026-10-29T15:00:00.000Z" }),
    c("viva-1", { workflow_id: "X9F0zp6LQ2xGEYVS", estado: "en_curso", fin: null, duracion_ms: null, inicio: "2026-11-02T15:00:00.000Z" }),
    c("vieja-1", { workflow_id: "X9F0zp6LQ2xGEYVS", inicio: "2026-10-22T15:00:00.000Z", duracion_ms: 600000 }),
  ],
})
const m = (corrida: string, d: string, usd: number, x: Partial<Movimiento> = {}): Movimiento => ({ t: `${d}T15:00:00.000Z`, d, proveedor: "Anthropic", modelo: "claude-sonnet-4-6", empleado: "Jefe de Marketing", cliente: "Náufrago", client_id: NAU, corrida, usd, ok: true, cota: false, proceso: "Planeación del plan de 90 días", ...x })
const DINERO: Dinero = {
  movimientos: [
    m("plan-1", "2026-11-01", 1.86), m("abc", "2026-10-31", 1.34, { proceso: null }), m("alta-1", "2026-10-29", 2.3, { proceso: "Alta de un cliente nuevo" }),
    m("cer-1", "2026-11-02", 0.004, { proceso: "Cerebro · mantenimiento del portero" }), m("cer-2", "2026-11-02", 0.004, { proceso: "Cerebro · mantenimiento del portero" }),
    m("vieja-1", "2026-10-22", 0.9), m("sin-corrida", "2026-11-01", 0.5, { corrida: null, proceso: null }),
  ],
  saldos: [], cache: null, desde: "2026-09-01T00:00:00Z", leido_en: "2026-11-02T17:00:00Z", faltan: [], topes: [], piezas: [], manuales: [], manuales_de: [],
}
const hoy = "2026-11-02"
const v = ventanaDe("7", hoy)

describe("6.47 · definiciones", () => {
  it("el período es el de Dinero; pide a la plataforma el período más el anterior (hasta 30 días)", () => {
    expect(v.r).toEqual({ desde: "2026-10-27", hasta: "2026-11-02" }); expect(v.ant.desde).toBe("2026-10-20"); expect(v.dias).toBe(14); expect(v.dias_periodo).toBe(7)
    expect(ventanaDe("hoy", hoy).dias).toBe(2); expect(ventanaDe("30", hoy).dias).toBe(30)
  })
  it("interno = cerebro, portero, pruebas y ensayos", () => {
    const [plan, , cer] = LISTA.corridas
    expect(esCorridaInterna(cer)).toBe(true); expect(esCorridaInterna(plan)).toBe(false)
    expect(esCorridaInterna({ interno: false, nombre: "Ensayo del plan (temporal)" })).toBe(true)
  })
  it("% con error sin contar las en curso; demora típica = la mediana, con la más lenta aparte", () => {
    const n = numerosDe(LISTA.corridas.filter((x) => !esCorridaInterna(x) && x.inicio! >= "2026-10-27"))
    expect(n.corridas).toBe(4); expect(n.con_error).toBe(1); expect(n.pct_error).toBe(33.3)
    expect(n.mediana_ms).toBe(960000); expect(n.max_ms).toBe(960000)
  })
  it("el motivo del error en palabras; el texto técnico no se muestra a la vista", () => {
    expect(motivoEnPalabras("Request timed out after 800000ms")).toBe("se acabó el tiempo")
    expect(motivoEnPalabras("529 overloaded_error")).toBe("el modelo no respondió")
    expect(motivoEnPalabras("missing client_id")).toBe("faltó un dato del cliente o del pedido")
    expect(motivoEnPalabras("revisión rechazada: veredicto rojo")).toBe("la revisión no pasó")
    expect(motivoEnPalabras(null, "atascada")).toBe("se quedó sin dar señales de vida")
  })
  it("el proceso en palabras de oficina", () => {
    expect(procesoDe({ nombre: "Ejecución 205994" })).toBe("Sin nombre de proceso"); expect(procesoDe({ nombre: "Encargo de oficina · un turno" })).toBe("Oficina")
    expect(LISTA.corridas.map(procesoDe)).toEqual(["Plan de 90 días", "Cambios al plan", "Mantenimiento del cerebro", "Mantenimiento del cerebro", "Manual de marca y alta", "Plan de 90 días", "Plan de 90 días"])
  })
})

describe("6.47 · el costo es la misma cuenta que Dinero", () => {
  it("con interno = el número de Dinero al centavo; sin interno le resta el cerebro", () => {
    const r = rangoDe("7", hoy), dinero = resumenDelPeriodo(DINERO.movimientos, r, anteriorDe("7", r), hoy)
    expect(costoDelPeriodo(DINERO, v, hoy, true).total).toBe(dinero.total)
    expect(costoDelPeriodo(DINERO, v, hoy, true).total).toBe(6.01)
    expect(costoDelPeriodo(DINERO, v, hoy, false).total).toBe(6)
  })
  it("el costo de un grupo sale de Dinero por sus ejecuciones (un pedido junta las suyas)", () => {
    const g = agrupar(LISTA.corridas.filter((x) => x.inicio! >= "2026-10-27"), "proceso", costoPorEjecucion(DINERO), v.r)
    const plan = g.find((x) => x.clave === "Plan de 90 días")!
    expect(plan.costo).toBe(1.86); expect(plan.numeros.con_error).toBe(1)
    expect(g[0].clave).toBe("Plan de 90 días") // los grupos con errores van primero
  })
})

describe("6.47 · lo que alcanza a leer", () => {
  it("el período se lee solo (así el tope de 200 no se lo come el anterior); el anterior, en una segunda lectura", () => {
    expect(v.dias_periodo).toBe(7); expect(ventanaDe("hoy", hoy).dias_periodo).toBe(1); expect(ventanaDe("mes", hoy).dias_periodo).toBe(2)
  })
  it("sin corte cubre lo pedido; con corte rotula «sobre las últimas N»; 30 días no alcanzan al anterior", () => {
    expect(cobertura(LISTA.corridas, false, v.dias_periodo, v.r.desde, hoy)).toMatchObject({ cubre: true, cortada: false })
    expect(cobertura(LISTA.corridas, false, v.dias, v.ant.desde, hoy).cubre).toBe(true)
    const cortada = cobertura(LISTA.corridas.filter((x) => x.inicio! >= "2026-10-31"), true, v.dias_periodo, v.r.desde, hoy)
    expect(cortada).toMatchObject({ cubre: false, desde_dia: "2026-10-31" })
    const t = ventanaDe("30", hoy); expect(cobertura(LISTA.corridas, false, t.dias, t.ant.desde, hoy).cubre).toBe(false)
  })
})

describe("6.47 · empleados", () => {
  const filas = [
    { agent_name: "jefe-marketing", status: "completed", duration_ms: 60000, cost_usd: 0.5, workflow_id: "X9F0zp6LQ2xGEYVS", workflow_execution_id: "plan-1" },
    { agent_name: "jefe-marketing", status: "error", duration_ms: 120000, cost_usd: 0.2, workflow_id: "X9F0zp6LQ2xGEYVS", workflow_execution_id: "plan-1:rama" },
    { agent_name: "portero-cerebro", status: "completed", duration_ms: 3000, cost_usd: 0.004, workflow_id: "ogfq56oIEoHufFPM", workflow_execution_id: "cer-1" },
    { agent_name: "portero-cerebro", status: "timeout", duration_ms: 5000, cost_usd: 0, workflow_id: "ogfq56oIEoHufFPM", workflow_execution_id: "cer-2" },
  ]
  const nombre = (s: string) => ({ "jefe-marketing": "Jefe de Marketing", "portero-cerebro": "Portero del cerebro" }[s] ?? s)
  const proc = (w: string | null) => (w === "ogfq56oIEoHufFPM" ? "Cerebro · mantenimiento del portero" : "Planeación del plan de 90 días")
  const e = empleadosDe(filas, nombre, proc)
  it("el libro completo del período, con y sin interno; nombres reales", () => {
    expect(e.todo.map((x) => [x.nombre, x.llamadas, x.errores, x.mediana_ms])).toEqual([["Jefe de Marketing", 2, 1, 90000], ["Portero del cerebro", 2, 1, 4000]])
    expect(e.sin_interno.map((x) => x.nombre)).toEqual(["Jefe de Marketing"]); expect(e.todo[0].ejecuciones).toEqual(["plan-1"])
  })
  it("top 5 de los que más fallan y más tardan; agrupar por empleado muestra sus corridas", () => {
    const t = topEmpleados(e.todo)
    expect(t.fallan.map((x) => x.slug)).toEqual(["jefe-marketing", "portero-cerebro"]); expect(t.tardan[0].slug).toBe("jefe-marketing")
    const g = agruparPorEmpleado(e.sin_interno, LISTA.corridas, v.r)
    expect(g[0]).toMatchObject({ nombre: "Jefe de Marketing", llamadas: 2 }); expect(g[0].corridas.map((x: Corrida) => x.workflow_execution_id)).toEqual(["plan-1"])
  })
})

describe("6.47 · el empleado no contradice a «lo que falló»", () => {
  it("un fallo que anotó el proceso se suma al empleado que lo tuvo", () => {
    const es = [{ slug: "jefe-marketing", nombre: "Jefe de Marketing", llamadas: 13, errores: 0, mediana_ms: 40000, max_ms: 90000, usd: 3.91, ejecuciones: [], interno: false }]
    expect(conFallosDelProceso(es, [{ agente: "jefe-marketing", del_proceso: true }, { agente: "otro", del_proceso: false }], (x) => x.toLowerCase())[0].errores).toBe(1)
    expect(conFallosDelProceso(es, [{ agente: "jefe-marketing", del_proceso: false }], (x) => x)[0].errores).toBe(0)
  })
})

describe("6.47 · dónde falló", () => {
  it("el primer paso en rojo de la traza: «paso k de n» y su clave para abrir ahí", () => {
    const paso = (id: string, estado: string, inicio: string, error: string | null = null) => ({ origen: "invocacion", id, agente: "editor-en-jefe", modelo: "claude-sonnet-4-6", inicio, fin: inicio, duracion_ms: 1000, costo_usd: 0.1, tokens: {}, tokens_total: 10, turnos: 1, estado, error, despacho: null })
    const d = normalizarDetalle({ corrida: c("plan-1", { estado: "fallida" }), arbol: [{ rama: null, costo_usd: 0, pasos: [paso("a", "completed", "2026-11-01T17:33:00Z"), paso("b", "error", "2026-11-01T17:40:00Z", "review gate: rojo"), paso("c", "completed", "2026-11-01T17:45:00Z")] }] })!
    expect(dondeFallo(d)).toMatchObject({ clave: "p:b", paso: 2, de: 3, motivo: "la revisión no pasó", error: "review gate: rojo" })
  })
})

describe("6.47 · en pantalla", () => {
  const empleados = empleadosDe([{ agent_name: "jefe-marketing", status: "error", duration_ms: 60000, cost_usd: 0.5, workflow_id: "X9F0zp6LQ2xGEYVS", workflow_execution_id: "plan-1" }], () => "Jefe de Marketing", () => "Planeación del plan de 90 días")
  const render = async (x: Record<string, unknown> = {}) => {
    const { PanelObservabilidad } = await import("@/components/nuevo/PanelObservabilidad")
    return renderToStaticMarkup(createElement(PanelObservabilidad, { onCerrar: () => {}, listaInicial: LISTA, dineroInicial: DINERO, empleadosInicial: empleados, hoy, ...x })).replace(/<!-- -->/g, "")
  }
  it("de arriba hacia abajo: controles, resumen (4 tarjetas con mini gráfico), lo que falló, grupos, empleados", async () => {
    const h = await render()
    expect(h).toMatch(/^<div class="nv-panel fixed inset-0 z-\[70\]/)
    const orden = ["data-controles", "data-resumen", "data-lo-que-fallo", "data-grupos=", "data-empleados-obs"]
    const pos = orden.map((k) => h.indexOf(k)); expect(pos.every((p) => p > 0)).toBe(true); expect([...pos].sort((a, b) => a - b)).toEqual(pos)
    expect(h.match(/data-tarjeta-obs=/g)).toHaveLength(4); expect(h.match(/data-mini-grafico/g)!.length).toBeGreaterThanOrEqual(4)
    expect(h.match(/data-periodo=/g)).toHaveLength(4); expect(h).toContain("data-mostrar-interno"); expect(h).toContain("data-busca"); expect(h).toContain("data-agrupar-por")
  }, 60000)
  it("interno oculto por defecto: no aparece el cerebro y se dice cuánto quedó oculto", async () => {
    const h = await render()
    expect(h).not.toContain('data-grupo="Mantenimiento del cerebro"'); expect(h).toMatch(/data-interno-oculto[^>]*>\(interno oculto: 2 corridas · US\$ 0,01/)
    const con = await render({ internoInicial: true })
    expect(con).toContain('data-grupo="Mantenimiento del cerebro"'); expect(con).not.toContain("data-interno-oculto"); expect(con).toContain("igual que en Dinero")
  }, 60000)
  it("lo que falló arriba, con el botón al paso; sin errores dice «sin errores» con ✓", async () => {
    const h = await render()
    expect(h).toContain('data-falla="plan-1"'); expect(h).toContain('data-ver-donde-fallo="plan-1"'); expect(h).toContain("Ver dónde falló →")
    const sin = await render({ listaInicial: normalizarLista({ total: 1, corridas: [c("ok-1")] }) })
    expect(sin).toContain("data-sin-errores"); expect(sin).toContain("Sin errores en 7 días ✓")
  }, 60000)
  it("empleados con la flecha a su ficha de rendimiento (la de CC6, sin tocar su código)", async () => {
    const h = await render()
    expect(h).toContain('data-top="fallan"'); expect(h).toContain('data-ficha-de="jefe-marketing"'); expect(h).toContain("Jefe de Marketing")
    expect(readFileSync("components/nuevo/PanelObservabilidad.tsx", "utf8")).toContain('import { FichaDeRendimiento } from "@/components/nuevo/escena/FichaDeRendimiento"')
  }, 60000)
  it("el error de un paso: motivo en palabras a la vista y el texto técnico plegado", async () => {
    const paso = { origen: "invocacion", id: "e", agente: "jefe-marketing", modelo: "claude-sonnet-4-6", inicio: "2026-11-01T17:33:00Z", fin: "2026-11-01T17:34:00Z", duracion_ms: 60000, costo_usd: 0, tokens: {}, tokens_total: 0, turnos: 1, estado: "error", error: "Request timed out after 800000ms", despacho: null }
    const d = normalizarDetalle({ corrida: c("plan-1", { estado: "fallida" }), arbol: [{ rama: null, costo_usd: 0, pasos: [paso] }] })
    const { PanelObservabilidad } = await import("@/components/nuevo/PanelObservabilidad")
    const h = renderToStaticMarkup(createElement(PanelObservabilidad, { onCerrar: () => {}, listaInicial: LISTA, detalleInicial: d, dineroInicial: DINERO, hoy })).replace(/<!-- -->/g, "")
    expect(h).toContain("data-errores"); expect(h).toContain("se acabó el tiempo")
    expect(h).toContain("data-arbol"); expect(h).toContain("data-barra")
  }, 60000)
  it("solo lectura; la ruta nueva exige administrador y no escribe", () => {
    const ruta = readFileSync("app/api/direccion/observabilidad/route.ts", "utf8")
    expect(ruta).toContain("await exigirAdmin()"); expect(ruta).not.toMatch(/\.(insert|update|upsert|delete)\(/); expect(ruta).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/)
    expect(readFileSync("components/nuevo/PanelObservabilidad.tsx", "utf8")).not.toMatch(/method:\s*"(POST|PUT|PATCH|DELETE)"/)
  })
})
