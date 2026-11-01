/**
 * CC4 (temporal en el equipo del dashboard) · 01-nov · los 10 arreglos de la oficina de marketing (revisión en vivo de Lenovo con Emilio, 17:30Z).
 * Cada prueba lleva el número del punto. Datos de ejemplo con la forma de los reales de Náufrago (sonda de solo lectura del 01-nov). US$ 0 · sin red.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { armarEscena, estadoDeLaMesa, FILA_DE_PUESTOS, MAXIMO_DE_PUESTOS, momentoDeLaCampana, puestosDeLaMesa, MESAS, type EntradaDeLaEscena } from "@/lib/escena-avatares"
import { Avatares } from "@/components/nuevo/escena/Avatares"
import { analisisDesdeFila, detalleDeInformes } from "@/lib/informes"
import { PanelInformes } from "@/components/nuevo/PanelInformes"
import type { InformesDelCliente } from "@/lib/informes-datos"
import { detalleDelCuadro } from "@/components/nuevo/PanelAplicaciones"
import type { Pizarron } from "@/lib/pizarron-datos"

const ahora = new Date("2026-11-01T18:00:00Z")
const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const hace = (min: number) => new Date(ahora.getTime() - min * 60_000).toISOString()

// ── la plantilla real: lo que hay en `agents` (con sus nombres de identidad) y en `oficina_directorio` ──
const directorio = [
  ...["carousel-designer", "content-creator", "creative-director-mesa", "design-image-prompt-engineer", "design-visual-storyteller", "inclusive-visuals-specialist", "marketing_instagram_curator", "marketing_short_video_editing_coach", "marketing_video_optimization_specialist", "tiktok-strategist", "video-editor", "whimsy-injector"].map((agente) => ({ agente, equipo: "creativo" })),
  ...["campaign-brief-agent", "competitive-intelligence-agent", "feedback-synthesizer", "growth-hacker", "market_research_analyst", "x-twitter-intelligence-analyst"].map((agente) => ({ agente, equipo: "estrategia" })),
  { agente: "portero", equipo: null },
]
const agentes = [
  { name: "jefe-marketing", display_name: "Jefe de Marketing", activo: true },
  { name: "spell-check-corrector", display_name: "Spell-Check Corrector", activo: true },
  { name: "editor_en_jefe", display_name: "Reality Checker", activo: true },
  { name: "brand_strategist", display_name: "Brand Guardian", activo: true },
  { name: "jefe_client_success", display_name: "Account Strategist", activo: true },
  { name: "market_research_analyst", display_name: "Trend Researcher", activo: true },
  { name: "reporting_agent", display_name: "Executive Summary Generator", activo: true },
  { name: "growth-hacker", display_name: "Growth Hacker", activo: true },
  { name: "tracking-specialist", display_name: "Tracking Specialist", activo: false },
]
const entrada = (extra: Partial<EntradaDeLaEscena> = {}): EntradaDeLaEscena => ({
  despachos: [], invocaciones: [], directorio, agentes, clientes: [{ id: NAUFRAGO, nombre: "Náufrago" }],
  equipos: [{ clave: "direccion", nombre: "Dirección", etapa: "activo" }, { clave: "estrategia", nombre: "Estrategia", etapa: "activo" }, { clave: "creativo", nombre: "Creativo", etapa: "activo" }, { clave: "web", nombre: "Web y búsqueda", etapa: "segunda_etapa" }, { clave: "medios", nombre: "Medios y Performance", etapa: "segunda_etapa" }, { clave: "relaciones", nombre: "Relaciones", etapa: "segunda_etapa" }],
  ahora, ...extra,
})
// las mismas personas, escritas con guion en `agent_invocations` (así llegan de verdad)
const invocacion = (agent_name: string, min: number) => ({ agent_name, client_id: NAUFRAGO, workflow_id: "X9F0zp6LQ2xGEYVS", workflow_execution_id: "210273:paso", status: "completed", started_at: hace(min + 1), ended_at: hace(min), cost_usd: 0.1, step_name: null, task_text: null })
const nombres = (r: ReturnType<typeof armarEscena>, clave: string) => r.mesas.find((m) => m.clave === clave)!.equipo.map((p) => p.nombre)

describe("punto 3 · empleados repetidos en las listas de equipo", () => {
  it("el mismo empleado escrito con guion y con guion bajo cuenta una sola vez (Reality Checker, Executive Summary Generator)", () => {
    const r = armarEscena(entrada({ invocaciones: [invocacion("editor-en-jefe", 30), invocacion("reporting-agent", 30), invocacion("market_research_analyst", 30)] }))
    const todos = r.mesas.flatMap((m) => m.equipo.map((p) => p.nombre))
    for (const n of new Set(todos)) expect(todos.filter((x) => x === n), n).toHaveLength(1)
    expect(todos.filter((n) => n === "Executive Summary Generator").length).toBeLessThanOrEqual(1)
  })
  it("un empleado dado de baja no se sienta", () => {
    const r = armarEscena(entrada({ invocaciones: [invocacion("tracking-specialist", 30)] }))
    expect(r.mesas.flatMap((m) => m.equipo.map((p) => p.nombre))).not.toContain("Tracking Specialist")
  })
})

describe("punto 4 · Dirección y Estrategia según el mapa firmado", () => {
  it("Dirección NO lista a los 3 jefes de la jefatura (Reality Checker, Account Strategist, Brand Guardian) y sí a jefe-marketing y spell-check", () => {
    const r = armarEscena(entrada({ invocaciones: [invocacion("editor-en-jefe", 30), invocacion("brand-strategist", 30), invocacion("jefe-client-success", 30)] }))
    const d = nombres(r, "direccion")
    expect(d).toEqual(expect.arrayContaining(["Jefe de Marketing", "Spell-Check Corrector"]))
    for (const jefe of ["Reality Checker", "Account Strategist", "Brand Guardian"]) expect(d).not.toContain(jefe)
  })
  it("Legal Compliance Checker (firmado, sin instalar) se dice «por instalar» en Dirección; no se sienta", () => {
    const r = armarEscena(entrada())
    const dir = r.mesas.find((m) => m.clave === "direccion")!
    expect(dir.por_instalar).toContain("Legal Compliance Checker")
    expect(dir.equipo.map((p) => p.nombre)).not.toContain("Legal Compliance Checker")
    // lo firmado que YA está instalado no se repite como «por instalar» (Feedback Synthesizer ya tiene tarjeta en Estrategia)
    expect(r.mesas.find((m) => m.clave === "estrategia")!.por_instalar).not.toContain("Feedback Synthesizer")
  })
  it("market_research_analyst sale en Estrategia (su tarjeta manda); su nombre de identidad lo trae `agents.display_name`", () => {
    expect(nombres(armarEscena(entrada()), "estrategia")).toContain("Trend Researcher")
  })
})

describe("punto 1 · todos en su puesto", () => {
  it("cada empleado activo de cada equipo está en su mesa (trabaje o no); trabajando primero", () => {
    const r = armarEscena(entrada({ despachos: [{ id: "d1", agent_name: "content-creator", client_id: NAUFRAGO, workflow_id: "X9F0zp6LQ2xGEYVS", workflow_execution_id: "210300", status: "running", running_at: hace(3), completed_at: null, created_at: hace(3) }] }))
    const creativo = r.mesas.find((m) => m.clave === "creativo")!
    expect(creativo.equipo).toHaveLength(12)
    expect(creativo.equipo[0]).toMatchObject({ agente: "content-creator", estado: "trabajando" })
    expect(creativo.equipo.slice(1).every((p) => p.estado !== "trabajando")).toBe(true)
  })
  it("los puestos caben: en fila al frente del escritorio, sin salirse de la celda de la mesa", () => {
    for (const m of MESAS) {
      const pts = puestosDeLaMesa(m, MAXIMO_DE_PUESTOS)
      expect(pts).toHaveLength(MAXIMO_DE_PUESTOS); expect(FILA_DE_PUESTOS).toBe(MAXIMO_DE_PUESTOS)
      for (const p of pts) { expect(Math.abs(p.x - m.centro.x)).toBeLessThan(160); expect(p.y).toBeGreaterThan(0) }
      expect(new Set(pts.map((p) => `${p.x},${p.y}`)).size).toBe(pts.length) // nadie encima de nadie
    }
    expect(puestosDeLaMesa(MESAS[0], 0)).toEqual([])
    expect(puestosDeLaMesa(MESAS[0], 99)).toHaveLength(MAXIMO_DE_PUESTOS)
  })
  it("la escena dibuja una figura por empleado: el monitor sigue negro si nadie trabaja, la figura de quien trabaja brilla", () => {
    const datos = armarEscena(entrada({ despachos: [{ id: "d1", agent_name: "content-creator", client_id: NAUFRAGO, workflow_id: null, workflow_execution_id: "210300", status: "running", running_at: hace(3), completed_at: null, created_at: hace(3) }] }))
    const html = renderToStaticMarkup(createElement(Avatares, { datosIniciales: datos }))
    const figuras = html.match(/class="nv-av-fig"/g)!.length
    expect(figuras).toBe(datos.mesas.reduce((n, m) => n + Math.min(m.equipo.length, MAXIMO_DE_PUESTOS), 0)) // las que caben, sin amontonar
    expect(html).toMatch(/>\+8</) // Creativo tiene 12 y caben 4: el resto se dice «+8»
    expect(html).toContain('data-estado="trabajando"')
  })
})

describe("punto 5 · nada técnico a la vista", () => {
  it("ni «(mapa)», ni nombres de tablas, ni «sin fin registrado» en la escena ni en la lista del equipo", () => {
    const datos = armarEscena(entrada({
      directorio: [...directorio],
      despachos: [{ id: "viejo", agent_name: "growth-hacker", client_id: NAUFRAGO, workflow_id: null, workflow_execution_id: "1", status: "running", running_at: hace(26 * 60), completed_at: null, created_at: hace(26 * 60) }],
    }))
    const html = renderToStaticMarkup(createElement(Avatares, { datosIniciales: datos }))
    for (const prohibido of ["(mapa)", "agent_dispatches", "agent_invocations", "sin fin registrado", "despacho"]) expect(html, prohibido).not.toContain(prohibido)
    expect(JSON.stringify(datos.mesas.flatMap((m) => m.equipo.map((p) => p.nota)))).not.toContain("sin fin")
    expect(datos.fuente).toMatch(/^al día a las \d\d:\d\d$/)
  })
})

describe("punto 6 · un solo estado verdadero de la mesa", () => {
  it("«nadie trabaja ahora» y «activo» no conviven: el mismo texto en el rótulo y en el encabezado de la lista", () => {
    const quieta = armarEscena(entrada()).mesas.find((m) => m.clave === "estrategia")!
    expect(estadoDeLaMesa(quieta)).toBe("en espera · nadie trabaja ahora")
    expect(estadoDeLaMesa(armarEscena(entrada()).mesas.find((m) => m.clave === "web")!)).toBe("por activar · nadie trabaja")
    const activa = armarEscena(entrada({ despachos: [{ id: "d1", agent_name: "market_research_analyst", client_id: NAUFRAGO, workflow_id: null, workflow_execution_id: "9", status: "running", running_at: hace(2), completed_at: null, created_at: hace(2) }] })).mesas.find((m) => m.clave === "estrategia")!
    expect(estadoDeLaMesa(activa)).toBe("1 trabajando ahora")
  })
})

describe("punto 2 · en qué se trabaja (cliente y momento de la campaña)", () => {
  const plan = (estado: "esperando" | "aprobado" | "sin") => ({
    cliente: { id: NAUFRAGO, nombre: "Náufrago" },
    campana: { estado: "pausada" } as never,
    documento: estado === "sin" ? null : ({ id: "p1", status: estado === "aprobado" ? "approved" : "draft" } as never),
    ciclo: estado === "sin" ? null : ({ disponible: true, version: 1, con_compuerta: true, historial: [], compuerta: estado === "aprobado" ? { estado: "aprobado", decidido_por: "emilio", decidido_en: null, despertado: true, despertar_detalle: null } : { estado: "pendiente", decidido_por: null, decidido_en: null, despertado: null, despertar_detalle: null }, pedido: null, avance: null } as never),
  })
  it("«Náufrago · plan esperando tu decisión»", () => {
    expect(momentoDeLaCampana(plan("esperando"))).toEqual({ cliente: "Náufrago", momento: "plan esperando tu decisión" })
    expect(momentoDeLaCampana(plan("aprobado"))?.momento).toBe("plan aprobado · sigue el brief")
    expect(momentoDeLaCampana({ ...plan("sin"), campana: null })?.momento).toBe("todavía sin plan")
    expect(momentoDeLaCampana({ ...plan("sin"), cliente: null })).toBeNull()
  })
  it("la escena lo dice discreto, abajo a la izquierda; sin dato, no dice nada", () => {
    const con = renderToStaticMarkup(createElement(Avatares, { datosIniciales: { ...armarEscena(entrada()), contexto: { cliente: "Náufrago", momento: "plan esperando tu decisión" } } }))
    expect(con).toContain("data-contexto"); expect(con).toContain("Náufrago"); expect(con).toContain("plan esperando tu decisión")
    expect(renderToStaticMarkup(createElement(Avatares, { datosIniciales: armarEscena(entrada()) }))).not.toContain("data-contexto")
  })
})

describe("punto 7 · informes de la mesa de análisis (viven en el cerebro)", () => {
  const ficha = (tipo: string, contenido: string) => ({ id: `f-${tipo}`, titulo: `Informe · ${tipo} · corte 2026-11-01`, contenido: `[informe de análisis · ${tipo} · PROPUESTA: no es dato del cliente] ${contenido}`, observado_en: "2026-11-01T16:34:50Z", creado_en: "2026-11-01T16:34:50Z", provenance_tag: { datos: { tipo, citas: ["a", "b", "c"], fecha_de_corte: "2026-11-01T16:32:12Z" } } })
  it("se leen de las fichas vigentes: sin el rótulo de sistema, con su tipo en palabras y su fecha de corte", () => {
    const a = analisisDesdeFila(ficha("voz_del_publico", "El encebollado es el elogio central."))
    expect(a).toMatchObject({ tipo: "voz_del_publico", titulo: "Informe de voz del público", texto: "El encebollado es el elogio central.", citas: 3, corte: "2026-11-01T16:32:12Z" })
    expect(a.texto).not.toContain("[informe de análisis")
  })
  it("el cuadro del Centro de campaña ya no dice «todavía no hay informes» si la mesa de análisis los hizo", () => {
    const tres = ["mercado", "competencia", "voz_del_publico"].map((t) => analisisDesdeFila(ficha(t, "texto")))
    expect(detalleDeInformes([], [])).toEqual({ texto: "Todavía no hay informes de este cliente", aviso: false })
    expect(detalleDeInformes([], tres).texto).toBe("3 informes de análisis · al 1 nov")
  })
  it("el panel los muestra rotulados como propuesta, y no dice «Todavía no hay informes»", () => {
    const datos: InformesDelCliente = { clientes: [{ id: NAUFRAGO, nombre: "Náufrago" }], cliente: { id: NAUFRAGO, nombre: "Náufrago" }, informes: [], analisis: [analisisDesdeFila(ficha("mercado", "Puente de dos feriados."))], leido_en: "x" }
    const html = renderToStaticMarkup(createElement(PanelInformes, { onCerrar: () => {}, datosIniciales: datos }))
    expect(html).toContain('data-vista="analisis"'); expect(html).toContain("Informe de mercado"); expect(html).toContain("Puente de dos feriados."); expect(html).toContain("Propuesta de la mesa de análisis")
    expect(html).not.toContain("Todavía no hay informes"); expect(html).not.toContain('data-vista="vacio"')
  })
})

describe("punto 10 · el calendario del plan anterior se dice", () => {
  const datos = (anterior: boolean): Pizarron => ({
    clientes: [{ id: NAUFRAGO, nombre: "Náufrago", con_campana: true }], cliente: { id: NAUFRAGO, nombre: "Náufrago" },
    campana: { id: "c", estado: "pausada", desde: "2026-11-02", hasta: "2027-01-30", version_calendario: 1, version_estrategia: 1, del_plan_anterior: anterior },
    fases: [], fase_activa: { situacion: "sin_fases" } as never, gran_idea: { texto: null, nota: "" }, esperas: [],
    filas: Array.from({ length: 136 }, (_, i) => ({ id: `f${i}` })) as never, semanas: [], totales: {}, hoy: "2026-11-01", leido_en: "x",
  })
  it("«136 publicaciones · del plan anterior» si la campaña apunta a un plan que ya no es el vigente; sin versiones", () => {
    expect(detalleDelCuadro("calendario", datos(true)).texto).toBe("136 publicaciones · del plan anterior")
    expect(detalleDelCuadro("calendario", datos(false)).texto).toBe("136 publicaciones")
  })
})
