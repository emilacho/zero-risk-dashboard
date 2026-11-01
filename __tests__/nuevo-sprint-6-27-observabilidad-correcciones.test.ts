/**
 * DASHBOARD NUEVO · SPRINT 6.27 (1-nov): 4 correcciones de Observabilidad (encargo `2026-11-01-ENCARGO-LENOVO-a-CC5-observabilidad-correcciones.md`):
 * 1 · la hora en la zona del navegador · 2 · nombres de oficina (el técnico solo en Metadatos) · 3 · el mantenimiento del cerebro es «Interno» ·
 * 4 · Entrada y Salida de cada paso desde el libro de los empleados (`agent_invocations.input_summary` / `output_summary`).
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import {
  NOMBRE_DE_OFICINA, clienteVisible, conTextos, cuando, leerTextosDePasos, nombreDeLaCorrida, nombreLimpio, normalizarDetalle, normalizarLista, sinLlaves, textoDeFila,
} from "@/lib/direccion-corridas"
import { PanelObservabilidad } from "@/components/nuevo/PanelObservabilidad"

const NAU = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const ID1 = "d0047a78-852b-40ea-98cc-1f1647d4d417", ID2 = "11111111-2222-4333-8444-555555555555"
const corrida = (extra: Record<string, unknown> = {}) => ({ workflow_id: "X9F0zp6LQ2xGEYVS", workflow_execution_id: "210611", client_id: NAU, cliente: "Náufrago", inicio: "2026-11-01T19:34:00.000Z", fin: "2026-11-01T19:48:04.000Z", duracion_ms: 844000, costo_usd: 0.55, tokens: 100054, pasos: 1, despachos: 1, fallos: 0, ramas: [], estado: "completa", ...extra })
const paso = (id: string, agente: string, extra: Record<string, unknown> = {}) => ({ origen: "invocacion", id, agente, modelo: "claude-sonnet-4-6", inicio: "2026-11-01T19:42:05.169Z", fin: "2026-11-01T19:48:04.241Z", duracion_ms: 359072, costo_usd: 0.546954, tokens: { entrada: 3, salida: 15268, cache_lectura: 0, cache_escritura: 84780 }, tokens_total: 100051, turnos: 1, estado: "completed", error: null, despacho: null, ...extra })
const panel = () => readFileSync("components/nuevo/PanelObservabilidad.tsx", "utf8")
const CEREBRO_N8N = "Zero Risk — Cerebro · mantenimiento diario del portero (que ALIMENTA) · CC-CEREBRO"

describe("6.27 · 1 · la hora", () => {
  it("se muestra en la zona de quien mira: el «Pedir cambios» de las 19:34 UTC sale 20:34 en España y 14:34 en Ecuador", () => {
    expect(cuando("2026-11-01T19:34:00Z", "Europe/Madrid")).toContain("20:34")
    expect(cuando("2026-11-01T19:34:00Z", "America/Guayaquil")).toContain("14:34")
    expect(readFileSync("lib/direccion-corridas.ts", "utf8")).not.toMatch(/timeZone:\s*"America\/Guayaquil"/)
  })
})

describe("6.27 · 2 · nombres claros", () => {
  it("los nombres de n8n pierden prefijos, paréntesis y firmas de equipo, y empiezan con mayúscula", () => {
    expect(nombreLimpio(CEREBRO_N8N)).toBe("Cerebro · mantenimiento diario del portero")
    expect(nombreLimpio("Zero Risk — planeacion (esqueleto B0 · piezas se pegan en C2)")).toBe("Planeacion")
    expect(nombreLimpio("Zero Risk â€” Client Onboarding E2E v2 (Webhook: Deal Won)")).toBe("Client Onboarding E2E v2")
    expect(nombreLimpio("Zero Risk — Portero · recibir (prueba) (paso 8 · CC#1)")).toBe("Portero · recibir")
  })
  it("los procesos conocidos llevan nombre de oficina, como pidió Emilio", () => {
    const n = new Map([["ogfq56oIEoHufFPM", CEREBRO_N8N], ["X9F0zp6LQ2xGEYVS", "Zero Risk — planeacion (esqueleto B0 · piezas se pegan en C2)"]])
    expect(nombreDeLaCorrida("X9F0zp6LQ2xGEYVS", "210611", n)).toBe("Planeación del plan de 90 días")
    expect(nombreDeLaCorrida("ogfq56oIEoHufFPM", "210492", n)).toBe("Cerebro · mantenimiento del portero")
    expect(nombreDeLaCorrida("cc-cerebro-fallas-y-retencion", "pasos-n-transcripcion-1793527592265")).toBe("Cerebro · fallas y retención")
    expect(nombreDeLaCorrida("cc-cerebro-nuevo-oficio", "x")).toBe("Cerebro · nuevo oficio")
    expect(nombreDeLaCorrida("api:revisor-externo", "gpt-jefatura-1")).toBe("Revisor externo")
    expect(nombreDeLaCorrida(null, "pasos-n-transcripcion-1793527592265")).toBe("Corrida sin nombre de proceso")
    for (const v of Object.values(NOMBRE_DE_OFICINA)) { expect(v.charAt(0)).toBe(v.charAt(0).toLocaleUpperCase("es")); expect(v).not.toMatch(/CC[#-]|Zero Risk|\(que/) }
  })
  it("el nombre técnico y la ejecución quedan solo en Metadatos; la lista y la cabecera ya no los muestran", () => {
    const l = normalizarLista({ corridas: [corrida({ workflow_id: "ogfq56oIEoHufFPM", workflow_execution_id: "pasos-n-transcripcion-1793527592265" })] }, new Map([["ogfq56oIEoHufFPM", CEREBRO_N8N]]))
    expect(l.corridas[0].nombre_tecnico).toContain("CC-CEREBRO")
    const h = renderToStaticMarkup(createElement(PanelObservabilidad, { onCerrar: () => {}, listaInicial: l }))
    expect(h).toContain("Cerebro · mantenimiento del portero"); expect(h).not.toContain("CC-CEREBRO"); expect(h).not.toContain(">pasos-n-transcripcion")
    expect(panel()).not.toContain("{c.workflow_execution_id}</span>")
    expect(panel()).toContain('["Nombre técnico"')
  })
})

describe("6.27 · 3 · el cliente real", () => {
  it("el mantenimiento del cerebro dice «Interno · cerebro de Náufrago»; el trabajo para el cliente sigue diciendo Náufrago", () => {
    const l = normalizarLista({ corridas: [corrida({ workflow_id: "ogfq56oIEoHufFPM", workflow_execution_id: "210492" }), corrida({ workflow_id: "cc-cerebro-tendencias", workflow_execution_id: "tend-1", client_id: null, cliente: null }), corrida()] })
    expect(l.corridas.map(clienteVisible)).toEqual(["Interno · cerebro de Náufrago", "Interno", "Náufrago"])
    const h = renderToStaticMarkup(createElement(PanelObservabilidad, { onCerrar: () => {}, listaInicial: l }))
    expect(h.match(/data-cliente="interno"/g)).toHaveLength(2)
  })
})

describe("6.27 · 4 · entrada y salida de cada paso", () => {
  it("lee las columnas de texto del libro y dice cuánto se recortó", () => {
    const t = textoDeFila({ input_summary: "Eres el redactor…".padEnd(2000, "x") + "…", output_summary: "# PLAN".padEnd(2000, "y") + "…", response_length: "47158" })
    expect(t.entrada_recortada).toBe(true); expect(t.entrada?.endsWith("…")).toBe(false); expect(t.salida_total).toBe(47158)
    expect(textoDeFila({ input_summary: null, output_summary: '{"busquedas":[]}', response_length_real: "16" })).toEqual({ entrada: null, entrada_recortada: false, salida: '{"busquedas":[]}', salida_total: 16 })
  })
  it("nunca muestra una llave aunque haya quedado en el texto", () => {
    expect(sinLlaves("usa sk-ant-api03-abcdefghijklmnopqrstuv y listo")).toBe("usa [llave oculta] y listo")
    expect(sinLlaves("token eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.SflKxwRJSMeKKF2QT4f")).toBe("token [llave oculta]")
  })
  it("consulta solo esos pasos y solo columnas de texto (solo lectura); si la base falla, no inventa", async () => {
    const llamadas: unknown[] = []
    const db = (data: unknown[] | null, error: unknown = null) => ({ from: (t: string) => ({ select: (c: string) => ({ in: async (k: string, v: string[]) => { llamadas.push([t, c, k, v]); return { data, error } } }) }) })
    const m = await leerTextosDePasos(db([{ id: ID1, input_summary: "pide", output_summary: "responde", response_length: "8" }]), [ID1, "dispatch:o8q:jefe:210611", ID1])
    expect(m?.get(ID1)?.salida).toBe("responde")
    expect(llamadas[0]).toEqual(["agent_invocations", expect.stringContaining("input_summary, output_summary"), "id", [ID1]])
    expect(await leerTextosDePasos(db(null, { message: "caída" }), [ID1])).toBeNull()
    const src = readFileSync("app/api/direccion/corridas/[id]/route.ts", "utf8")
    expect(src).toContain("exigirAdmin"); expect(src).not.toMatch(/\.(insert|update|upsert|delete)\(/)
  })
  it("el panel muestra el texto en las pestañas; sin texto dice por qué", () => {
    const d = normalizarDetalle({ corrida: corrida(), arbol: [{ rama: null, costo_usd: 0.55, pasos: [paso(ID1, "jefe-marketing"), paso(ID2, "portero-del-cerebro")] }] })
    if (!d) throw new Error("sin detalle")
    const conT = conTextos(d, new Map([[ID1, { entrada: "Eres el redactor de planes", entrada_recortada: true, salida: "# PLAN DE CAMPAÑA 90 DÍAS", salida_total: 47158 }], [ID2, { entrada: null, entrada_recortada: false, salida: "{}", salida_total: 2 }]]))
    const j = normalizarDetalle(JSON.parse(JSON.stringify(conT)))
    expect(j?.arbol[0].pasos[0].salida).toBe("# PLAN DE CAMPAÑA 90 DÍAS"); expect(j?.arbol[0].pasos[0].salida_total).toBe(47158); expect(j?.arbol[0].pasos[1].entrada).toBeNull()
    const src = panel()
    expect(src).toContain("data-texto={pestana}"); expect(src).toContain("data-recorte={pestana}")
    expect(src).toContain("Este empleado no guarda lo que se le pidió"); expect(src).not.toContain("todavía no guarda el texto")
  })
})
