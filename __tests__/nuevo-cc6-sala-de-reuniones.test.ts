/** Dashboard nuevo · CC6 · S3 (01-nov): la sala de reuniones. Cada sesión real de varios empleados se sienta en la mesa redonda, con quien dirige a la cabecera;
 *  sin sesión, la sala vacía lo dice. Forma de los datos tomada de la corrida real de Náufrago 210273 (plan) + 210300 (jefatura). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { armarEscena, type Despacho, type EntradaDeLaEscena, type InvocacionViva } from "@/lib/escena-avatares"
import { agentesEnLaSala, lineasDeLaSala, MINUTOS_CIERRE, MINUTOS_ENLACE, SILLAS_DE_LA_SALA, SALA } from "@/lib/escena-sala"
import { Avatares } from "@/components/nuevo/escena/Avatares"
import { inicialesDe } from "@/components/nuevo/escena/SalaDeReuniones"

const T0 = Date.parse("2026-11-01T16:30:00Z")
const en = (min: number) => new Date(T0 + min * 60_000).toISOString()
const ANALISTAS = ["x-twitter-intelligence-analyst", "feedback-synthesizer", "growth-hacker", "competitive-intelligence-agent", "market_research_analyst"]
const PASOS = ["analisis-escucha_x", "analisis-voz_del_publico", "analisis-retencion", "analisis-competencia", "analisis-mercado"]
const inv = (agent_name: string, exec: string, finMin: number, extra: Partial<InvocacionViva> = {}): InvocacionViva =>
  ({ agent_name, client_id: "nau", workflow_id: "X9F0zp6LQ2xGEYVS", workflow_execution_id: exec, status: "completed", started_at: en(finMin - 2), ended_at: en(finMin), cost_usd: 0.3, step_name: null, task_text: null, ...extra })
const analisis = (): InvocacionViva[] => ANALISTAS.map((a, i) => inv(a, `210273:${PASOS[i]}`, 2 + i * 0.5))
const redaccion = inv("jefe-marketing", "210273", 17.85, { started_at: en(6.5) })
const jefatura = inv("editor-en-jefe", "210300", 19.1, { workflow_id: "o8qaF7bI0PKv2XGZ", started_at: en(18) })
const despachoJefe = (status: string): Despacho => ({ id: "dj", agent_name: "jefe-marketing", client_id: "nau", workflow_id: "X9F0zp6LQ2xGEYVS", workflow_execution_id: "210273", status, running_at: en(6.5), completed_at: status === "completed" ? en(17.85) : null, created_at: en(6.4) })
const entrada = (minAhora: number, extra: Partial<EntradaDeLaEscena> = {}): EntradaDeLaEscena => ({
  despachos: [], invocaciones: [],
  directorio: [...ANALISTAS.map((a) => ({ agente: a, equipo: "estrategia", rol: "miembro" })), { agente: "portero", equipo: null, rol: "portero" }],
  agentes: [{ name: "jefe-marketing", display_name: "Jefe de marketing" }, { name: "editor_en_jefe", display_name: "Editor en jefe" }, { name: "market_research_analyst", display_name: "Analista de mercado" }],
  clientes: [{ id: "nau", nombre: "Náufrago" }],
  equipos: null,
  ahora: new Date(T0 + minAhora * 60_000), ...extra,
})

describe("la sala de reuniones · S3", () => {
  it("la mesa y las 8 sillas están dentro de la sala de vidrio de la foto, la cabecera primero", () => {
    expect(SILLAS_DE_LA_SALA).toHaveLength(8)
    for (const s of SILLAS_DE_LA_SALA) { expect(s.x).toBeGreaterThan(1290); expect(s.x).toBeLessThan(1500); expect(s.y).toBeGreaterThan(410); expect(s.y).toBeLessThan(545) }
    expect(SILLAS_DE_LA_SALA[0].x).toBeLessThan(SALA.mesa.x) // cabecera: el lado que mira a la oficina
  })

  it("sin ninguna corrida: sala vacía, honesta", () => {
    const e = armarEscena(entrada(60))
    expect(e.sala?.reunion).toBeNull()
    expect(e.sala?.ultima).toBeNull()
    expect(lineasDeLaSala(e.sala)).toEqual(["SALA DE REUNIONES", "sala vacía · ninguna reunión en las últimas 24 h"])
  })

  it("la mesa de análisis + el jefe redactando (despacho abierto) = reunión EN CURSO de Náufrago; dirige el que corre la raíz; él está en la sala, no en su mesa", () => {
    const e = armarEscena(entrada(10, { invocaciones: analisis(), despachos: [despachoJefe("running")] }))
    const r = e.sala!.reunion!
    expect(r.estado).toBe("en_curso")
    expect(r.titulo).toBe("Plan de 90 días · Náufrago")
    expect(r.dirige).toBe("Jefe de marketing")
    expect(r.participantes).toHaveLength(6)
    expect(r.participantes[0]).toMatchObject({ agente: "jefe-marketing", cabecera: true, estado: "hablando", fase: "redacción", silla: SILLAS_DE_LA_SALA[0] })
    expect(r.participantes.slice(1).map((p) => p.agente)).toEqual(ANALISTAS)
    expect(r.participantes.slice(1).every((p) => p.estado === "hablo" && p.fase === "mesa de análisis" && p.equipo === "Estrategia")).toBe(true)
    expect(r.fases.map((f) => [f.nombre, f.estado])).toEqual([["mesa de análisis", "hecha"], ["redacción", "en_curso"]])
    // el jefe no se sienta además en Dirección
    expect(e.mesas.flatMap((m) => m.sentados).some((s) => s.agente === "jefe-marketing")).toBe(false)
    expect(agentesEnLaSala(e.sala).has("jefe-marketing")).toBe(true)
    expect(lineasDeLaSala(e.sala)[2]).toContain("en curso · redacción")
  })

  it("la revisión de la jefatura (otra corrida, mismo cliente, enseguida) es la última fase de la MISMA reunión", () => {
    const e = armarEscena(entrada(20, { invocaciones: [...analisis(), redaccion, jefatura], despachos: [despachoJefe("completed")] }))
    const r = e.sala!.reunion!
    expect(r.corridas).toEqual(["210273", "210300"])
    expect(r.fases.map((f) => f.nombre)).toEqual(["mesa de análisis", "redacción", "revisión de la jefatura"])
    const editor = r.participantes.find((p) => p.agente === "editor-en-jefe")!
    expect(editor).toMatchObject({ nombre: "Editor en jefe", equipo: "Jefatura · Dirección", cabecera: false, fase: "revisión de la jefatura" })
    expect(r.participantes[0].agente).toBe("jefe-marketing")
    expect(r.estado).toBe("en_curso") // la última fila es de hace menos de 5 min
  })

  it("una revisión de la jefatura de OTRO cliente o muy posterior no se pega a la reunión", () => {
    const otro = { ...jefatura, client_id: "otro" }
    const tarde = { ...jefatura, workflow_execution_id: "210400", started_at: en(17.85 + MINUTOS_ENLACE + 1), ended_at: en(17.85 + MINUTOS_ENLACE + 2) }
    for (const j of [otro, tarde]) expect(armarEscena(entrada(40, { invocaciones: [...analisis(), redaccion, j] })).sala!.reunion?.corridas ?? ["210273"]).toEqual(["210273"])
  })

  it("terminada: se queda sentada (atenuada) MINUTOS_CIERRE; luego la sala queda vacía y solo nombra la última", () => {
    const filas = [...analisis(), redaccion, jefatura]
    const recien = armarEscena(entrada(19.1 + 10, { invocaciones: filas })).sala!
    expect(recien.reunion?.estado).toBe("terminada")
    expect(lineasDeLaSala(recien)[2]).toContain("terminó hace")
    const luego = armarEscena(entrada(19.1 + MINUTOS_CIERRE + 2, { invocaciones: filas })).sala!
    expect(luego.reunion).toBeNull()
    expect(luego.ultima?.titulo).toBe("Plan de 90 días · Náufrago")
    expect(lineasDeLaSala(luego)[1]).toMatch(/^sala vacía · la última, Plan de 90 días · Náufrago, terminó hace/)
  })

  it("una corrida de un solo empleado, o de los de la biblioteca del cerebro, no es reunión", () => {
    const sola = [inv("jefe-marketing", "209670", 1)]
    const biblioteca = [inv("portero-del-cerebro", "208715", 1, { workflow_id: "ogfq" }), inv("etiquetador-del-cerebro", "208715", 1.5, { workflow_id: "ogfq" }), inv("reporting-agent", "208715", 2, { workflow_id: "ogfq" })]
    for (const f of [sola, biblioteca]) expect(armarEscena(entrada(3, { invocaciones: f })).sala!.reunion).toBeNull()
  })

  it("quien el directorio marca «dirige» va a la cabecera (la mesa de creativos la dirige creative-director-mesa)", () => {
    const crea = ["content-creator", "creative-director-mesa", "design-visual-storyteller"].map((a, i) => inv(a, `300:${["idea", "sintesis", "visual"][i]}`, 1 + i, { workflow_id: "GRAN" }))
    const e = armarEscena(entrada(4, { invocaciones: crea, directorio: [{ agente: "content-creator", equipo: "creativo", rol: "miembro" }, { agente: "creative-director-mesa", equipo: "creativo", rol: "direccion" }, { agente: "design-visual-storyteller", equipo: "creativo", rol: "miembro" }] }))
    expect(e.sala!.reunion!.participantes[0]).toMatchObject({ agente: "creative-director-mesa", cabecera: true })
    expect(e.sala!.reunion!.equipo).toBe("Creativo")
  })

  it("un participante que falló se marca en rojo; la fase queda «con fallo»", () => {
    const filas = analisis(); filas[2] = { ...filas[2], status: "failed" }
    const r = armarEscena(entrada(5, { invocaciones: filas })).sala!.reunion!
    expect(r.participantes.find((p) => p.agente === "growth-hacker")?.estado).toBe("fallo")
    expect(r.fases[0].estado).toBe("fallo")
  })

  it("las iniciales saltan «de», «del»…: Jefe de Marketing → JM", () => {
    expect(inicialesDe("Jefe de Marketing")).toBe("JM")
    expect(inicialesDe("X/Twitter Intelligence Analyst")).toBe("XA")
    expect(inicialesDe("Reality Checker")).toBe("RC")
    expect(inicialesDe("Growth")).toBe("G")
  })

  it("se dibuja: cabecera con «DIRIGE», la que habla late, el rótulo con nombre, equipo y cliente; sin avisos de gasto", () => {
    const e = armarEscena(entrada(10, { invocaciones: analisis(), despachos: [despachoJefe("running")] }))
    const html = renderToStaticMarkup(createElement(Avatares, { datosIniciales: e }))
    expect(html).toContain('data-sala="en_curso"')
    expect(html).toContain('data-cabecera="true"')
    expect(html).toContain("DIRIGE")
    expect(html).toContain('data-estado="hablando"')
    expect(html).toContain("Plan de 90 días · Náufrago")
    expect(html).toMatch(/dirige Jefe de marketing \(Dirección\)/)
    const vacia = renderToStaticMarkup(createElement(Avatares, { datosIniciales: armarEscena(entrada(60)) }))
    expect(vacia).toContain('data-sala="vacia"')
    const fuente = readFileSync("components/nuevo/escena/SalaDeReuniones.tsx", "utf8")
    expect(fuente).not.toMatch(/US\$|gasto|costo/i)
  })
})
