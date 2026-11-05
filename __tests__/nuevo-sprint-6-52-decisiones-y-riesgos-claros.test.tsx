/**
 * DASHBOARD NUEVO · SPRINT 6.52 · DECISIONES Y RIESGOS HABLAN CLARO (corrección aprobada por Emilio 2-nov 20:45Z,
 * `2026-11-02-CORRECCION-LENOVO-a-CC5-decisiones-y-riesgos-hablan-claro.md`).
 */
import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { costoDeLaDecision, gruposDeDecisiones, nombreDeEmpleado, normalizarDecisiones, resumenDeDecisiones, tituloDeDecision } from "@/lib/direccion-decisiones"
import { esTextoTecnico, riesgoClaro } from "@/lib/riesgo-claro"
import { costoComoDato } from "@/lib/direccion-corridas"
import { tokensEnPalabras } from "@/lib/formato"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {}, back: () => {} }) }))

const NAU = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", ZR = "df7e47cc-bec4-4fa2-bc24-ff97ba5213a5"
const dec = (id: string, tipo: string, cliente: string, titulo: string, x: Record<string, unknown> = {}) => ({ id, tipo, titulo, cliente, client_id: cliente === "Náufrago" ? NAU : ZR, fuente: "hitl_queue", decidir: {}, ...x })
// la lectura real del 2-nov (10 decisiones): 7 de Zero Risk SI (en pausa) y 3 de Náufrago
const CRUDO = {
  ok: true, completo: true, fuentes: [], sin_fuente: [],
  pausados: [{ cliente: "Zero Risk Seguridad Industrial", motivo: "Pausa por decisión del dueño 31-oct: foco en Náufrago" }],
  decisiones: [
    dec("r1", "revision", "Zero Risk Seguridad Industrial", "editor_escalation · content-creator", { subtipo: "editor_escalation" }),
    dec("r2", "revision", "Zero Risk Seguridad Industrial", "editor_escalation · content-creator", { subtipo: "editor_escalation" }),
    dec("r3", "revision", "Zero Risk Seguridad Industrial", "editor_escalation · content-creator", { subtipo: "editor_escalation" }),
    dec("r4", "revision", "Náufrago", "editor_escalation · content-creator", { subtipo: "editor_escalation", costo_usd: 0.42 }),
    dec("f1", "firma_de_finanzas", "Zero Risk Seguridad Industrial", "Tablero financiero: espera tu firma"),
    dec("q1", "pregunta_al_dueno", "Zero Risk Seguridad Industrial", "¿Tu Business Manager de Meta está activo?"),
    dec("q2", "pregunta_al_dueno", "Zero Risk Seguridad Industrial", "¿Cuál es el monto promedio?"),
    dec("q3", "pregunta_al_dueno", "Zero Risk Seguridad Industrial", "¿Tienes a alguien para WhatsApp?"),
    dec("f2", "firma_de_finanzas", "Náufrago", "Tablero financiero: espera tu firma"),
    dec("p1", "plan", "Náufrago", "Plan de 90 días: espera tu decisión", { fuente: "plan_aprobaciones", costo_nota: "aprobar no gasta por sí mismo" }),
  ],
}
const D = normalizarDecisiones(CRUDO)

describe("6.52 · Decisiones · un solo número", () => {
  it("esperan tu firma = lo que se firma aquí y no es de un cliente en pausa; lo de fuera y lo en pausa, aparte con su número", () => {
    const g = gruposDeDecisiones(D)
    expect(g.firma.map((x) => x.id)).toEqual(["r4", "f2", "p1"]) // 04-nov · la firma ya se firma en Tu oficina
    expect(g.fuera.map((x) => x.id)).toEqual([])
    expect(g.pausa).toEqual([expect.objectContaining({ cliente: "Zero Risk Seguridad Industrial", decisiones: expect.any(Array) })]); expect(g.pausa[0].decisiones).toHaveLength(7)
    expect(resumenDeDecisiones(D).total).toBe(3) // la tarjeta de la oficina dice lo mismo
  })
  it("sin la lectura de pausas no se achica nada a ciegas", () => {
    expect(resumenDeDecisiones(normalizarDecisiones({ ...CRUDO, pausados: [] })).total).toBe(10) // 04-nov · las preguntas y firmas también se contestan aquí
  })
  // estilo base (05-nov · guía de Emilio, reglas 5 y 6): los recuadros de número son los filtros; una tarjeta a la vez con «1 de N»; sin pila ni índice por tipo
  it("en pantalla: el resumen, el recuadro «Esperan» y el «1 de N» dicen lo mismo; la pausa va en su propio recuadro", async () => {
    const { PanelDecisiones } = await import("@/components/nuevo/PanelDecisiones")
    const h = renderToStaticMarkup(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: D })).replace(/<!-- -->/g, "")
    expect(h).toContain("3 esperan por ti · 7 en pausa (Zero Risk SI)"); expect(h).not.toContain("fuera de este tablero")
    expect(h).toMatch(/data-recuadro="firma"[^>]*>.*?>3<\/span>/)
    expect(h).toContain("1 de 3")
    expect(h).toMatch(/data-recuadro="pausa:Zero Risk Seguridad Industrial" aria-pressed="false"[^>]*>.*?>7<\/span>.*?>En pausa</)
  }, 30_000) // dibuja el panel entero: con la máquina cargada pasa de 5 s
})

describe("6.52 · Decisiones · sin nombres internos y con costo", () => {
  it("«editor_escalation · content-creator» → «El editor pidió que mires un texto de 👤 Content Creator»", () => {
    expect(tituloDeDecision({ titulo: "editor_escalation · content-creator", subtipo: "editor_escalation" })).toBe("El editor pidió que mires un texto de 👤 Content Creator")
    expect(tituloDeDecision({ titulo: "algo_raro · brand-strategist", subtipo: null })).toBe("Algo raro de 👤 Brand Strategist")
    expect(tituloDeDecision({ titulo: "Plan de 90 días: espera tu decisión", subtipo: null })).toBe("Plan de 90 días: espera tu decisión")
    expect(nombreDeEmpleado("jefe-client-success")).toBe("Jefe Client Success")
  })
  it("el costo de producirlo: el dato con coma, o «sin dato todavía»", () => {
    expect(costoDeLaDecision({ costo_usd: 0.42 })).toBe("US$ 0,42"); expect(costoDeLaDecision({ costo_usd: null })).toBe("sin dato todavía")
  })
  it("la tarjeta lo dice; sin nombres internos a la vista", async () => {
    const { PanelDecisiones } = await import("@/components/nuevo/PanelDecisiones")
    const h = renderToStaticMarkup(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: D })).replace(/<!-- -->/g, "")
    expect(h).toContain("El editor pidió que mires un texto de 👤 Content Creator"); expect(h).not.toMatch(/editor_escalation|content-creator/)
    expect(h).toContain("Costó producirlo"); expect(h).toContain("US$ 0,42")
  })
  it("la ruta agrega los clientes en pausa (las pausas que decidiste), solo leyendo", () => {
    const src = readFileSync("app/api/direccion/decisiones/route.ts", "utf8")
    expect(src).toContain("exigirAdmin()"); expect(src).toContain("decisiones_tuyas"); expect(src).toContain("pausados")
  })
})

const R = (x: Record<string, unknown>) => ({ id: "x", titulo: "", detalle: null, sector: "flujos", cliente: null, fuente: "n8n", desde: null, ...x }) as Parameters<typeof riesgoClaro>[0]
describe("6.52 · Riesgos · qué pasó, a quién afecta, quién lo arregla", () => {
  it("el cambio de Apify en una frase; el texto técnico detrás de «ver detalle»", () => {
    const c = riesgoClaro(R({ sector: "datos", fuente: "alertas", titulo: ":warning: [RASPADOR] cambió el esquema de «trustpilot_scraper» en Apify · ya no existen: — · campos nuevos: useWarmPool. Arreglo: node scripts/ops/«recongelar esq»" }))
    expect(c.frase).toBe("Apify cambió el lector de Trustpilot"); expect(c.arregla).toBe("lo revisa CC2"); expect(c.tecnico).toContain("node scripts/ops")
    expect(riesgoClaro(R({ titulo: ":warning: [RASPADOR] cambió el esquema de «twitter_scraper» en Apify" })).frase).toBe("Apify cambió el lector de X (Twitter)")
  })
  it("el manual que no salió: motivo en español; el inglés, detrás", () => {
    const c = riesgoClaro(R({ id: "cambios-sin-version:2237", titulo: "Pediste cambios al manual y no salió la versión nueva", cliente: "Zero Risk Seguridad Industrial", detalle: "El flujo terminó sin dejar una versión nueva del manual · Task execution timed out after 120 seconds" }))
    expect(c.detalle).toBe("Motivo: un paso pasó de 2 min (su límite) y se cortó."); expect(c.afecta).toBe("Zero Risk Seguridad Industrial"); expect(c.tecnico).toContain("timed out")
  })
  it("un proceso automático; lo no asignado dice «sin responsable», no inventa", () => {
    expect(riesgoClaro(R({ titulo: "Falló el proceso «GEO Content Freshness Cron»", detalle: "1 ejecución fallida en las últimas horas" }))).toMatchObject({ frase: "Falló el proceso automático «GEO Content Freshness Cron»", afecta: "Toda la empresa", arregla: "lo revisa CC2", tecnico: null })
    expect(riesgoClaro(R({ sector: "dinero", fuente: "x", titulo: "Saldo bajo", detalle: null })).arregla).toBeNull()
    expect(esTextoTecnico("1 ejecución fallida en las últimas horas")).toBe(false); expect(esTextoTecnico("Task execution timed out")).toBe(true)
  })
  // estilo base (05-nov): el panel ya no repite los 8 sectores; el sector va una vez, en la tarjeta del riesgo
  it("en pantalla: frase, a quién y quién; el sector sale UNA vez; hora en 24 h", async () => {
    const { PanelRiesgos } = await import("@/components/nuevo/PanelRiesgos")
    const datos = { generado_en: null, completo: true, total: 1, por_gravedad: { 1: 0, 2: 1, 3: 0 }, por_sector: { dinero: 0, accesos: 0, servicios: 0, flujos: 0, datos: 1, calidad: 0, plazos: 0, seguridad: 0 },
      riesgos: [R({ id: "a", gravedad: 2, sector: "datos", titulo: ":warning: [RASPADOR] cambió el esquema de «trustpilot_scraper» en Apify", desde: "2026-11-02T19:29:00Z" })], decisiones_tuyas: [], caducados: 0, saldos: [], topes: [], fuentes: [], sin_fuente: [] }
    const h = renderToStaticMarkup(createElement(PanelRiesgos, { onCerrar: () => {}, datosIniciales: datos as never })).replace(/<!-- -->/g, "")
    expect(h).toContain("Apify cambió el lector de Trustpilot"); expect(h).toContain("lo revisa CC2"); expect(h).toContain("data-ver-detalle")
    expect(h).not.toMatch(/>[^<]*:warning:[^<]*<\/(h3|span)>/)
    expect(h).not.toContain("data-placa="); expect(h).not.toContain("data-tarjeta-sector="); expect(h).toContain('data-ficha="a"')
    expect(h).toContain("14:29"); expect(h).not.toMatch(/p\.\s?m\./)
  }, 30_000) // dibuja el panel entero: con la máquina cargada pasa de 5 s
})

describe("6.52 · de paso en Observabilidad", () => {
  it("el costo con coma y los tokens en palabras", () => {
    expect(costoComoDato(2.12)).toBe("US$ 2,12")
    expect(tokensEnPalabras(3_007_000)).toBe("3 millones de tokens"); expect(tokensEnPalabras(1_520_000)).toBe("1,5 millones de tokens")
    expect(tokensEnPalabras(1_000_000)).toBe("1 millón de tokens"); expect(tokensEnPalabras(12_400)).toBe("12 mil tokens"); expect(tokensEnPalabras(850)).toBe("850 tokens")
  })
  it("ninguna hora de Tu oficina en formato de 12 horas", () => {
    for (const f of ["components/nuevo/PanelRiesgos.tsx", "components/nuevo/PanelOrganizacion.tsx"]) expect(readFileSync(f, "utf8"), f).toMatch(/hourCycle: "h23"|...HORA_24/)
  })
})
