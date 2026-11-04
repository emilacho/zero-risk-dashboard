/** LA FLECHA DE FORMA, VISIBLE, Y LA ✕ ROJA SI FALLA (CC6 · 04-nov · encargo de Lenovo, Emilio 13:38Z). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { agentesConFalloSinReponer } from "@/lib/escena-avatares"
import { EQUIS_DE_FALLO, FLECHA_SIN_DATOS, FlechasDeForma } from "@/components/nuevo/escena/FlechasDeForma"

const inv = (agent_name: string, ended_at: string, status: string) => ({ agent_name, client_id: "c1", workflow_id: "X", workflow_execution_id: "1", status, started_at: ended_at, ended_at, cost_usd: 0, step_name: null, task_text: null })
const desp = (agent_name: string, completed_at: string | null, status: string) => ({ id: agent_name + status, agent_name, client_id: "c1", workflow_id: "X", workflow_execution_id: "2", status, running_at: "2026-11-04T13:00:00Z", completed_at, created_at: "2026-11-04T13:00:00Z" })

describe("quién lleva ✕ roja: su ÚLTIMA llamada terminada falló (por agente, no por mesa)", () => {
  it("falla sola → ✕; falla y después una buena → vuelve la flecha; una nueva EN CURSO no la borra", () => {
    expect(agentesConFalloSinReponer({ despachos: [], invocaciones: [inv("content-creator", "2026-11-04T13:10:00Z", "failed")] } as never)).toEqual(["content-creator"])
    expect(agentesConFalloSinReponer({ despachos: [], invocaciones: [inv("content-creator", "2026-11-04T13:10:00Z", "failed"), inv("content-creator", "2026-11-04T13:20:00Z", "completed")] } as never)).toEqual([])
    expect(agentesConFalloSinReponer({ despachos: [desp("content-creator", null, "running")], invocaciones: [inv("content-creator", "2026-11-04T13:10:00Z", "failed")] } as never)).toEqual(["content-creator"])
    expect(agentesConFalloSinReponer({ despachos: [desp("carousel-designer", "2026-11-04T13:30:00Z", "error")], invocaciones: [inv("carousel-designer", "2026-11-04T13:10:00Z", "completed")] } as never)).toEqual(["carousel-designer"])
  })
  it("en la misma mesa: solo el que falló lleva la ✕", () => {
    expect(agentesConFalloSinReponer({ despachos: [], invocaciones: [inv("content-creator", "2026-11-04T13:10:00Z", "failed"), inv("carousel-designer", "2026-11-04T13:11:00Z", "completed")] } as never)).toEqual(["content-creator"])
  })
})

describe("la flecha se ve SIEMPRE sobre cada agente de la escena", () => {
  const puestos = [
    { agente: "content-creator", nombre: "Creador", color: "#f5a524", x: 100, y: 200, sentado: true },
    { agente: "carousel-designer", nombre: "Diseñador", color: "#f5a524", x: 160, y: 200, sentado: false },
    { agente: "jefe-marketing", nombre: "Jefe", color: "#f5a524", x: 220, y: 200, sentado: false },
  ]
  const datos = { "content-creator": { agente: "content-creator", forma: "baja" }, "jefe-marketing": { agente: "jefe-marketing", forma: null, motivo_sin_flecha: "pocas tareas todavía" } } as never
  it("con forma: su flecha; sin datos (o sin ficha de rendimiento): la flecha gris neutra del mismo tamaño", () => {
    const h = renderToStaticMarkup(createElement("svg", null, createElement(FlechasDeForma, { datosIniciales: datos, puestosIniciales: puestos })))
    expect(h).toMatch(/data-forma-de="content-creator" data-forma="baja"[\s\S]*?>↘</)
    expect(h).toMatch(/data-forma-de="jefe-marketing" data-forma="sin"[\s\S]*?fill="#a1a1aa"[^>]*>→</)
    expect(h).toMatch(/data-forma-de="carousel-designer" data-forma="sin"/) // sin ficha de rendimiento: igual lleva marca
    expect((h.match(/font-size="24"/g) ?? []).length).toBe(3)
    expect(FLECHA_SIN_DATOS.color).toBe("#a1a1aa")
  })
  it("si su última llamada falló: ✕ roja en el mismo lugar y tamaño; los demás, su flecha", () => {
    const h = renderToStaticMarkup(createElement("svg", null, createElement(FlechasDeForma, { datosIniciales: datos, puestosIniciales: puestos, conFallo: ["content-creator"] })))
    expect(h).toMatch(/data-forma-de="content-creator" data-forma="falla"[\s\S]*?fill="#ef4444"[^>]*>✕</)
    expect(h).toContain("Creador: su última tarea falló"); expect(h).toMatch(/data-forma-de="jefe-marketing" data-forma="sin"/)
    expect(EQUIS_DE_FALLO).toMatchObject({ flecha: "✕", color: "#ef4444" })
  })
})
