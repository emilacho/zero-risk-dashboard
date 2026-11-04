/** Regla C (Emilio 04-nov 10:54Z; mapa de pasos de CC2): la sala es una reunión de empresa. Solo un paso que CONSOLIDA (re-síntesis, integración, ajuste, cierre) con un agente abre la sala:
 *  se sientan quien lo dirige y los que aportaron ANTES de que empezara; lo demás es trabajo en el escritorio. Sin paso de consolidación no hay reunión. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { armarEscena, type Despacho, type EntradaDeLaEscena, type InvocacionViva } from "@/lib/escena-avatares"
import { agentesEnLaSala, esPasoDeConsolidacion, MINUTOS_CIERRE } from "@/lib/escena-sala"

const T0 = Date.parse("2026-11-04T10:00:00Z")
const en = (min: number) => new Date(T0 + min * 60_000).toISOString()
const AGENTES = ["brand-strategist", "editor-en-jefe", "jefe-client-success", "content-creator"]
const inv = (agent_name: string, exec: string, iniMin: number, finMin: number | null, extra: Partial<InvocacionViva> = {}): InvocacionViva =>
  ({ agent_name, client_id: "nau", workflow_id: "ssLtwYPt7zxuvnM2", workflow_execution_id: exec, status: finMin == null ? "running" : "completed", started_at: en(iniMin), ended_at: finMin == null ? null : en(finMin), cost_usd: 0.2, step_name: null, task_text: null, ...extra })
const entrada = (minAhora: number, invocaciones: InvocacionViva[], despachos: Despacho[] = []): EntradaDeLaEscena => ({
  despachos, invocaciones,
  directorio: AGENTES.map((a) => ({ agente: a, equipo: "estrategia", rol: "miembro" })),
  agentes: AGENTES.map((a) => ({ name: a, display_name: a })), clientes: [{ id: "nau", nombre: "Náufrago" }], equipos: null,
  ahora: new Date(T0 + minAhora * 60_000),
})
// «en su escritorio» = tiene un trabajo abierto (despacho en marcha) y no está en la sala
const abierto = (agent_name: string, exec: string, iniMin: number): Despacho => ({ id: `d-${agent_name}-${exec}`, agent_name, client_id: "nau", workflow_id: "ssLtwYPt7zxuvnM2", workflow_execution_id: exec, status: "running", running_at: en(iniMin), completed_at: null, created_at: en(iniMin) } as Despacho)
const sentadosEnMesas = (e: ReturnType<typeof armarEscena>) => new Set(e.mesas.flatMap((m) => m.sentados.map((s) => s.agente)))
// las 3 lentes aportan primero (en paralelo, minutos 0-4) y luego el estratega re-sintetiza (minuto 5 en adelante)
const lentes = () => [inv("brand-strategist", "900:bba-lente-1", 0, 4), inv("editor-en-jefe", "900:bba-lente-2", 0, 3), inv("jefe-client-success", "900:bba-lente-3", 0, 4.5)]

describe("regla C · qué pasos consolidan", () => {
  it("re-síntesis, integración, ajuste y cierre consolidan (en el nombre del paso o en la clave); lentes, revisores, jueces y análisis NO", () => {
    for (const p of ["bba-resintesis-c1", "bba-resintesis-c3", "bb-equipo-integracion", "ajuste", "cierre"]) expect(esPasoDeConsolidacion(`900:${p}`, null), p).toBe(true)
    expect(esPasoDeConsolidacion("900", "bba-resintesis-c2")).toBe(true) // también por step_name
    for (const p of ["bba-lente-1", "bba-revisor-brand-strategist-c1", "bba-revisor-jefe-client-success-c2", "analisis-mercado", "juez-de-fidelidad", "preresintesisx"]) expect(esPasoDeConsolidacion(`900:${p}`, null), p).toBe(false)
    expect(esPasoDeConsolidacion("900", null)).toBe(false)
  })
})

describe("regla C · cuándo hay reunión y quién se sienta", () => {
  it("sin paso que consolide no hay reunión: todos siguen en su escritorio", () => {
    const enMarcha = [inv("brand-strategist", "900:bba-lente-1", 0, null), inv("editor-en-jefe", "900:bba-lente-2", 0, null), inv("jefe-client-success", "900:bba-lente-3", 0, null)]
    const e = armarEscena(entrada(5, enMarcha, [abierto("brand-strategist", "900:bba-lente-1", 0), abierto("editor-en-jefe", "900:bba-lente-2", 0), abierto("jefe-client-success", "900:bba-lente-3", 0)]))
    expect(e.sala!.reunion).toBeNull()
    expect(agentesEnLaSala(e.sala).size).toBe(0)
    for (const a of ["brand-strategist", "editor-en-jefe", "jefe-client-success"]) expect(sentadosEnMesas(e).has(a), a).toBe(true)
  })

  it("la re-síntesis en curso abre la sala: dirige el estratega y se sientan los que aportaron antes; el que no aportó sigue en su escritorio", () => {
    const e = armarEscena(entrada(7, [...lentes(), inv("brand-strategist", "900:bba-resintesis-c1", 5, null), inv("content-creator", "901:otra-cosa", 1, null)], [abierto("brand-strategist", "900:bba-resintesis-c1", 5), abierto("content-creator", "901:otra-cosa", 1)]))
    const r = e.sala!.reunion!
    expect(r.estado).toBe("en_curso")
    expect(r.dirige).toBe("brand-strategist")
    expect(r.participantes[0]).toMatchObject({ agente: "brand-strategist", cabecera: true })
    expect(r.participantes.map((p) => p.agente).sort()).toEqual(["brand-strategist", "editor-en-jefe", "jefe-client-success"])
    expect(agentesEnLaSala(e.sala).has("brand-strategist")).toBe(true)
    expect(sentadosEnMesas(e).has("brand-strategist")).toBe(false) // el que dirige salió de su escritorio
    expect(sentadosEnMesas(e).has("content-creator")).toBe(true) // quien no aportó sigue trabajando
  })

  it("una llamada que TERMINA después de que empezó la consolidación es trabajo de escritorio, no entra a la reunión", () => {
    const tarde = inv("content-creator", "900:redaccion-seccion", 4, 6.5) // empezó antes pero terminó en plena consolidación
    const e = armarEscena(entrada(7, [...lentes(), tarde, inv("brand-strategist", "900:bba-resintesis-c1", 5, null)], [abierto("brand-strategist", "900:bba-resintesis-c1", 5), abierto("content-creator", "900:redaccion-seccion", 4)]))
    expect(e.sala!.reunion!.participantes.some((p) => p.agente === "content-creator")).toBe(false)
    expect(e.sala!.reunion!.participantes.map((p) => p.agente).sort()).toEqual(["brand-strategist", "editor-en-jefe", "jefe-client-success"])
  })

  it("con dos consolidaciones, la reunión es la ÚLTIMA (c2): la de c1 ya pasó", () => {
    const c1 = inv("brand-strategist", "900:bba-resintesis-c1", 5, 7)
    const c2 = inv("brand-strategist", "900:bba-resintesis-c2", 10, null)
    const revisor = inv("jefe-client-success", "900:bba-revisor-jefe-client-success-c2", 8, 9.5)
    const e = armarEscena(entrada(12, [...lentes(), c1, revisor, c2]))
    const r = e.sala!.reunion!
    expect(r.estado).toBe("en_curso")
    expect(r.participantes.map((p) => p.agente)).toContain("jefe-client-success") // aportó (revisor) antes de c2
    expect(r.dirige).toBe("brand-strategist")
  })

  it("el trabajo cruza dos corridas (el flujo principal y el sub-flujo de la re-síntesis): los de la corrida hermana del MISMO cliente que aportaron se sientan; los de otro cliente o de una corrida lejana, no", () => {
    const principal = [inv("brand-strategist", "216655:x", 0, 3, { step_name: "bb-lens-brand-strategist" }), inv("editor-en-jefe", "216655:y", 3, 5, { step_name: "bb-voz-revision" })]
    const sub = inv("jefe-client-success", "216679", 5, 6, { step_name: "bba-revisor-jefe-client-success-c1" })
    const consolida = inv("brand-strategist", "216679", 6, null, { step_name: "bba-resintesis-c2" })
    const otroCliente = inv("content-creator", "777", 1, 2, { client_id: "otro" })
    const lejana = inv("content-creator", "888", -120, -118)
    const r = armarEscena(entrada(7, [...principal, sub, consolida, otroCliente, lejana])).sala!.reunion!
    expect(r.dirige).toBe("brand-strategist")
    expect(r.participantes.map((p) => p.agente).sort()).toEqual(["brand-strategist", "editor-en-jefe", "jefe-client-success"])
  })

  it("terminada la consolidación: la sala se queda MINUTOS_CIERRE y luego se vacía; los que se sentaron vuelven a su escritorio", () => {
    const filas = [...lentes(), inv("brand-strategist", "900:bba-resintesis-c1", 5, 8)]
    const recien = armarEscena(entrada(9, filas))
    expect(recien.sala!.reunion?.estado).toBe("terminada")
    const luego = armarEscena(entrada(8 + MINUTOS_CIERRE + 2, filas))
    expect(luego.sala!.reunion).toBeNull()
    expect(agentesEnLaSala(luego.sala).size).toBe(0) // nadie queda en la sala: todos libres para volver a su escritorio
  })

  it("un despacho abierto de un paso que consolida abre la sala aunque la llamada aún no haya escrito su fila", () => {
    const d: Despacho = { id: "d1", agent_name: "brand-strategist", client_id: "nau", workflow_id: "ssLtwYPt7zxuvnM2", workflow_execution_id: "900:bba-resintesis-c1", status: "running", running_at: en(5), completed_at: null, created_at: en(5) } as Despacho
    const e = armarEscena(entrada(6, lentes(), [d]))
    expect(e.sala!.reunion?.estado).toBe("en_curso")
    expect(e.sala!.reunion?.dirige).toBe("brand-strategist")
    const sinPaso: Despacho = { ...d, workflow_execution_id: "900:bba-lente-1" } as Despacho
    expect(armarEscena(entrada(6, lentes(), [sinPaso])).sala!.reunion).toBeNull()
  })
})
