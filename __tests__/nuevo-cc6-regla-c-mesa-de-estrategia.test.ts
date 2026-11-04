/** REGLA C · la mesa de estrategia del plan (CC6 · 04-nov · encargo de Lenovo 17:59Z; diseño de CC2: cada turno lleva `paso` = `mesa-estrategia-<rol>` y
 *  el consolidador `mesa-estrategia-consolida`). Los aportes de la mesa son trabajo de escritorio; consolidar abre la sala. El paso puede venir solo en la
 *  columna `paso` (#878), no en la clave de ejecución ni en `metadata.step_name`. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { armarEscena, type Despacho, type EntradaDeLaEscena, type InvocacionViva } from "@/lib/escena-avatares"
import { agentesEnLaSala, esPasoDeConsolidacion } from "@/lib/escena-sala"

const T0 = Date.parse("2026-11-05T10:00:00Z")
const en = (min: number) => new Date(T0 + min * 60_000).toISOString()
const MESA = ["jefe-marketing", "paid_media_paid_social_strategist", "tracking-specialist", "growth-hacker"]
// la mesa corre en la corrida del plan: la clave de ejecución NO trae el paso; el paso viene de la columna `paso` (aquí ya volcado en step_name, como lo hace la lectura)
const inv = (agent_name: string, paso: string, iniMin: number, finMin: number | null): InvocacionViva =>
  ({ agent_name, client_id: "nau", workflow_id: "X9F0zp6LQ2xGEYVS", workflow_execution_id: "217500", status: finMin == null ? "running" : "completed", started_at: en(iniMin), ended_at: finMin == null ? null : en(finMin), cost_usd: 0.1, step_name: paso, task_text: null })
const entrada = (minAhora: number, invocaciones: InvocacionViva[], despachos: Despacho[] = []): EntradaDeLaEscena => ({
  despachos, invocaciones,
  directorio: MESA.map((a) => ({ agente: a, equipo: "estrategia", rol: "miembro" })),
  agentes: MESA.map((a) => ({ name: a, display_name: a })), clientes: [{ id: "nau", nombre: "Náufrago" }], equipos: null,
  ahora: new Date(T0 + minAhora * 60_000),
})
const aportes = () => [inv("paid_media_paid_social_strategist", "mesa-estrategia-paid-social", 0, 3), inv("tracking-specialist", "mesa-estrategia-medicion", 0, 2), inv("growth-hacker", "mesa-estrategia-growth", 0, 4)]

describe("la mesa de estrategia: qué consolida", () => {
  it("«mesa-estrategia-consolida» (y «…-consolidacion») consolida; los aportes de cada rol, no", () => {
    for (const p of ["mesa-estrategia-consolida", "mesa-estrategia-consolidacion", "consolida"]) expect(esPasoDeConsolidacion("217500", p), p).toBe(true)
    for (const p of ["mesa-estrategia-jefe-marketing", "mesa-estrategia-paid-social", "mesa-estrategia-busqueda", "mesa-estrategia-medicion", "mesa-estrategia-growth", "consolidado", "preconsolida", "mesa-estrategia-consolidador-previo"]) expect(esPasoDeConsolidacion("217500", p), p).toBe(false)
  })
})

describe("la mesa de estrategia en la escena", () => {
  it("mientras aportan, cada uno en su escritorio; al consolidar, la sala se abre con el que consolida y los que aportaron", () => {
    const enMarcha = [inv("paid_media_paid_social_strategist", "mesa-estrategia-paid-social", 0, null), inv("tracking-specialist", "mesa-estrategia-medicion", 0, null)]
    expect(armarEscena(entrada(1, enMarcha)).sala!.reunion).toBeNull()
    const e = armarEscena(entrada(6, [...aportes(), inv("jefe-marketing", "mesa-estrategia-consolida", 5, null)]))
    const r = e.sala!.reunion!
    expect(r.estado).toBe("en_curso")
    expect(r.participantes.map((p) => p.agente).sort()).toEqual([...MESA].sort())
    expect(agentesEnLaSala(e.sala).has("jefe-marketing")).toBe(true)
  })
  it("un despacho abierto con `paso` de consolidación abre la sala aunque su clave de ejecución no lo diga", () => {
    const d = { id: "d1", agent_name: "jefe-marketing", client_id: "nau", workflow_id: "X9F0zp6LQ2xGEYVS", workflow_execution_id: "217500", status: "running", running_at: en(5), completed_at: null, created_at: en(5), paso: "mesa-estrategia-consolida" } as Despacho
    expect(armarEscena(entrada(6, aportes(), [d])).sala!.reunion?.estado).toBe("en_curso")
    expect(armarEscena(entrada(6, aportes(), [{ ...d, paso: "mesa-estrategia-jefe-marketing" } as Despacho])).sala!.reunion).toBeNull()
    expect(armarEscena(entrada(6, aportes(), [{ ...d, paso: null } as Despacho])).sala!.reunion).toBeNull()
  })
})

describe("la lectura trae el paso de la columna (solo lectura)", () => {
  it("llamadas y despachos piden `paso`; la llamada usa `metadata.step_name` y, si no hay, `paso`", () => {
    const s = readFileSync("lib/escena-avatares-datos.ts", "utf8")
    expect(s).toContain('select("id, agent_name, client_id, workflow_id, workflow_execution_id, status, running_at, completed_at, created_at, paso")')
    expect(s).toContain("cost_usd, paso, step_name:metadata->>step_name")
    expect(s).toContain("step_name: i.step_name ?? meta.step_name ?? i.paso")
    expect(s).toContain("created_at: s(d.created_at), paso: s(d.paso) }))")
  })
})
