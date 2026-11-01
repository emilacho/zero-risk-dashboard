/** Dashboard nuevo · CC6 · S4 (01-nov): los aportes de la sala de reuniones. Globo que se enciende cuando habla; al cerrar, lo usado al centro y lo que no
 *  se usó se apaga; tocar el avatar = aporte completo. Forma de los datos tomada de la reunión real de Náufrago (210273 + 210300). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { armarEscena, type Despacho, type EntradaDeLaEscena, type InvocacionViva } from "@/lib/escena-avatares"
import { conAportes, globoDe, lineasDelResultado, pasoDeAnalisis, resumenDeLaRevision, resumenDelAporte, SALA, tituloDelResultado } from "@/lib/escena-sala"
import { destinoEnElCentro, globoVisible, luzDeLaBurbuja } from "@/components/nuevo/escena/SalaDeReuniones"
import { Avatares } from "@/components/nuevo/escena/Avatares"
import { AporteCompleto, bloquesDelTexto } from "@/components/nuevo/escena/AporteCompleto"
import { mismoComienzo } from "@/lib/escena-aporte-datos"

const T0 = Date.parse("2026-11-01T16:30:00Z")
const en = (min: number) => new Date(T0 + min * 60_000).toISOString()
const ANALISTAS = ["x-twitter-intelligence-analyst", "feedback-synthesizer", "growth-hacker", "competitive-intelligence-agent", "market_research_analyst"]
const PASOS = ["analisis-escucha_x", "analisis-voz_del_publico", "analisis-retencion", "analisis-competencia", "analisis-mercado"]
const inv = (agent_name: string, exec: string, finMin: number, extra: Partial<InvocacionViva> = {}): InvocacionViva =>
  ({ agent_name, client_id: "nau", workflow_id: "X9F0zp6LQ2xGEYVS", workflow_execution_id: exec, status: "completed", started_at: en(finMin - 2), ended_at: en(finMin), cost_usd: 0.3, step_name: null, task_text: null, ...extra })
const analisis = (): InvocacionViva[] => ANALISTAS.map((a, i) => inv(a, `210273:${PASOS[i]}`, 2 + i * 0.5))
const redaccion = inv("jefe-marketing", "210273", 17.85, { started_at: en(6.5) })
const jefatura = inv("editor-en-jefe", "210300", 19.1, { workflow_id: "o8qaF7bI0PKv2XGZ", started_at: en(18) })
const despachoJefe: Despacho = { id: "dj", agent_name: "jefe-marketing", client_id: "nau", workflow_id: "X9F0zp6LQ2xGEYVS", workflow_execution_id: "210273", status: "running", running_at: en(6.5), completed_at: null, created_at: en(6.4) }
const entrada = (minAhora: number, extra: Partial<EntradaDeLaEscena> = {}): EntradaDeLaEscena => ({
  despachos: [], invocaciones: [],
  directorio: ANALISTAS.map((a) => ({ agente: a, equipo: "estrategia", rol: "miembro" })),
  agentes: [{ name: "jefe-marketing", display_name: "Jefe de marketing" }, { name: "editor_en_jefe", display_name: "Editor en jefe" }],
  clientes: [{ id: "nau", nombre: "Náufrago" }], equipos: null, ahora: new Date(T0 + minAhora * 60_000), ...extra,
})
const ENCABEZADO = (k: string) => `[informe de análisis · ${k} · PROPUESTA: no es dato del cliente]\n\n`
const SALIDAS = [
  { agent_name: ANALISTAS[0], workflow_execution_id: `210273:${PASOS[0]}`, output_summary: ENCABEZADO("escucha_x") + "**Sin dato.** Ninguna ficha del cerebro está marcada como publicación de X." },
  ...ANALISTAS.slice(1).map((a, j) => ({ agent_name: a, workflow_execution_id: `210273:${PASOS[j + 1]}`, output_summary: ENCABEZADO(PASOS[j + 1].slice(9)) + `- **Hallazgo ${j + 1}** con cita [41294896] ` + "x".repeat(j === 3 ? 2100 : 50) })),
  { agent_name: "jefe-marketing", workflow_execution_id: "210273", output_summary: "# PLAN DE CAMPAÑA 90 DÍAS · NÁUFRAGO\n**Olón, Santa Elena**\n\nTres apuestas." },
  { agent_name: "editor-en-jefe", workflow_execution_id: "210300", output_summary: "{\"fichas\":[{\"que\":\"una observación\",\"gravedad\":\"bloquea\"}]}" },
]
// dato real 01-nov: entraron al cerebro voz_del_publico, competencia y mercado; escucha_x y retencion no
const FICHAS = ["informe:voz_del_publico:030db57c64680169", "informe:competencia:091d41aaf72e331a", "informe:mercado:e11ce35730c783fc"]
const REVISION = { estado_del_motor: { fichas: [{ gravedad: "bloquea" }, { gravedad: "bloquea" }, { gravedad: "mejora" }] } }
const reunion = (minAhora: number) => armarEscena(entrada(minAhora, { invocaciones: [...analisis(), redaccion, jefatura] })).sala!.reunion!

describe("los aportes de la sala · S4", () => {
  it("cada participante guarda su corrida (para pedir el aporte completo) y la reunión su cliente", () => {
    const r = reunion(20)
    expect(r.participantes.find((p) => p.agente === "market_research_analyst")?.corrida).toBe("210273:analisis-mercado")
    expect(r.participantes[0].corrida).toBe("210273")
    expect(r.cliente_id).toBe("nau")
  })

  it("al cerrar: el informe que entró al cerebro se usó; el que no, se apaga (si dijo «sin dato», se dice); quien dirige da el resultado; la jefatura revisa", () => {
    const r = conAportes(reunion(30), { salidas: SALIDAS, informesEnElCerebro: FICHAS, revision: REVISION })
    expect(Object.fromEntries(r.participantes.map((p) => [p.agente, p.aporte?.uso]))).toEqual({
      "jefe-marketing": "resultado", "x-twitter-intelligence-analyst": "apagado", "feedback-synthesizer": "usado", "growth-hacker": "apagado",
      "competitive-intelligence-agent": "usado", market_research_analyst: "usado", "editor-en-jefe": "revision",
    })
    expect(r.participantes.find((p) => p.agente === "x-twitter-intelligence-analyst")?.aporte?.motivo).toBe("dijo «sin dato» y su informe no entró al cerebro")
    expect(r.participantes.find((p) => p.agente === "growth-hacker")?.aporte?.motivo).toBe("su informe no entró al cerebro (sin motivo registrado)")
    expect(r.resultado).toEqual({ titulo: "PLAN DE CAMPAÑA 90 DÍAS · NÁUFRAGO", usados: 3, informes: 5, revision: "3 observaciones, 2 bloquean" })
    expect(lineasDelResultado(r)).toEqual(["Resultado · PLAN DE CAMPAÑA 90 DÍAS · NÁUFRAGO", "usó 3 de 5 informes de la mesa de análisis", "revisión de la jefatura · 3 observaciones, 2 bloquean"])
  })

  it("el texto del globo: sin encabezado ni citas, recortado; se sabe si la base guardó el aporte recortado", () => {
    expect(resumenDelAporte(ENCABEZADO("mercado") + "- **URGENTE · Puente** se apoya en [6a9f94b0 · 2026-11-02] fichas")).toBe("- URGENTE · Puente se apoya en fichas")
    expect(resumenDelAporte("y".repeat(400))!.length).toBeLessThanOrEqual(220)
    expect(resumenDelAporte("")).toBeNull()
    const r = conAportes(reunion(30), { salidas: SALIDAS, informesEnElCerebro: FICHAS, revision: null })
    expect(r.participantes.find((p) => p.agente === "market_research_analyst")?.aporte?.recortado).toBe(true)
    expect(r.participantes.find((p) => p.agente === "feedback-synthesizer")?.aporte?.recortado).toBe(false)
    expect(r.resultado?.revision).toBeNull()
    expect(pasoDeAnalisis("210273:analisis-voz_del_publico")).toBe("voz_del_publico")
    expect(pasoDeAnalisis("210273")).toBeNull()
    expect(resumenDeLaRevision({ fichas: [] })).toBe("0 observaciones")
    expect(resumenDeLaRevision(null)).toBeNull()
    expect(tituloDelResultado("sin encabezado")).toBeNull()
  })

  it("la revisión de la jefatura nunca se muestra como JSON crudo; el globo no tapa los avatares; el texto largo solo es suyo si empieza igual", () => {
    expect(resumenDelAporte("```json\n{\"fichas\":[{\"que\":\"El plan usa «el mejor de Olón»\",\"gravedad\":\"bloquea\"},{\"que\":\"Otra\",\"gravedad\":\"mejora\"}]}")).toBe("2 observaciones, 1 bloquea. La primera: El plan usa «el mejor de Olón»")
    expect(resumenDelAporte("{\"fichas\":[{\"que\":\"Una\",\"gravedad\":\"bloquea\"}" + " ".repeat(2000))).toMatch(/^al menos 1 observación, 1 bloquea/)
    expect(resumenDelAporte("{\"fichas\":[]}")).toBe("sin observaciones")
    expect(readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")).toMatch(/top: pct\(g\.ancla\.y - 14, FOTO\.h\), pointerEvents: "none"/)
    expect(mismoComienzo("# PLAN DE CAMPAÑA\n\nTres  apuestas", "# PLAN DE CAMPAÑA Tres apuestas")).toBe(true)
    expect(mismoComienzo("# PLAN DE CAMPAÑA", "{\"fichas\":[]}")).toBe(false)
    expect(mismoComienzo(null, null)).toBe(false)
  })

  it("el aporte completo se lee limpio: viñetas aunque venga en una sola línea, negritas, sin «---»; no cambia lo que dice", () => {
    const b = bloquesDelTexto("[informe] **Mercado · Náufrago** --- - **URGENTE · Puente** se apoya en fichas - **Pico** en feb\n# PLAN\n---\nTexto final")
    expect(b.map((x) => [x.titulo, x.vineta, x.partes.map((p) => (p.negrita ? `*${p.t}*` : p.t)).join("")])).toEqual([
      [false, false, "[informe] *Mercado · Náufrago*"], [false, true, "*URGENTE · Puente* se apoya en fichas"], [false, true, "*Pico* en feb"], [true, false, "PLAN"], [false, false, "Texto final"],
    ])
  })

  it("sin dato de uso no se inventa: un participante fuera de la mesa de análisis queda «sin dato de uso»", () => {
    const crea = ["content-creator", "creative-director-mesa"].map((a, i) => inv(a, `300:${["idea", "sintesis"][i]}`, 1 + i, { workflow_id: "GRAN" }))
    const e = armarEscena(entrada(3, { invocaciones: crea, directorio: [{ agente: "content-creator", equipo: "creativo", rol: "miembro" }, { agente: "creative-director-mesa", equipo: "creativo", rol: "direccion" }] }))
    const r = conAportes(e.sala!.reunion!, { salidas: [], informesEnElCerebro: [], revision: null })
    expect(r.participantes.find((p) => p.agente === "content-creator")?.aporte).toMatchObject({ uso: "sin_dato", motivo: "no hay dato de si su aporte se usó", resumen: null })
    expect(globoDe(r.participantes.find((p) => p.agente === "content-creator")!)).toBe("aporte · sin texto guardado")
    expect(r.resultado).toMatchObject({ informes: 0, titulo: null })
  })

  it("las luces: la que habla se enciende; si nadie habla, el último que habló; al cerrar, lo usado va al centro y lo que no se usó se apaga", () => {
    const enCurso = conAportes(armarEscena(entrada(10, { invocaciones: analisis(), despachos: [despachoJefe] })).sala!.reunion!, { salidas: SALIDAS, informesEnElCerebro: FICHAS, revision: null })
    expect(enCurso.participantes.map((p) => luzDeLaBurbuja(p, enCurso))).toEqual(["habla", "normal", "normal", "normal", "normal", "normal"])
    expect(globoDe(enCurso.participantes[0])).toBe("escribiendo el resultado…")
    expect(globoVisible(enCurso, null)).toMatchObject({ tipo: "participante", p: { agente: "jefe-marketing" } })
    const pausa = conAportes(reunion(19.5), { salidas: SALIDAS, informesEnElCerebro: FICHAS, revision: REVISION })
    expect(pausa.estado).toBe("en_curso")
    expect(pausa.participantes.filter((p) => luzDeLaBurbuja(p, pausa) === "ultimo").map((p) => p.agente)).toEqual(["editor-en-jefe"])
    const cerrada = conAportes(reunion(30), { salidas: SALIDAS, informesEnElCerebro: FICHAS, revision: REVISION })
    expect(Object.fromEntries(cerrada.participantes.map((p) => [p.agente, luzDeLaBurbuja(p, cerrada)]))).toMatchObject({ "jefe-marketing": "centro", "feedback-synthesizer": "centro", "growth-hacker": "apagado", "x-twitter-intelligence-analyst": "apagado", "editor-en-jefe": "quieto" })
    expect(globoVisible(cerrada, null)).toMatchObject({ tipo: "resultado" })
    expect(globoVisible(cerrada, "growth-hacker")).toMatchObject({ tipo: "participante", lineas: expect.arrayContaining(["no se usó · su informe no entró al cerebro (sin motivo registrado)"]) })
    for (let i = 0; i < 3; i++) { const d = destinoEnElCentro(i, 3, false); expect(Math.abs(d.x - SALA.mesa.x)).toBeLessThanOrEqual(45); expect(Math.abs(d.y - SALA.mesa.y)).toBeLessThanOrEqual(35) }
  })

  it("se dibuja: 7 burbujas con su luz y el globo del resultado al cerrar; tocar un avatar abre el aporte completo, no la ficha", () => {
    const e = armarEscena(entrada(30, { invocaciones: [...analisis(), redaccion, jefatura] }))
    e.sala = { ...e.sala!, reunion: conAportes(e.sala!.reunion!, { salidas: SALIDAS, informesEnElCerebro: FICHAS, revision: REVISION }) }
    const html = renderToStaticMarkup(createElement(Avatares, { datosIniciales: e }))
    expect((html.match(/data-burbuja=/g) ?? []).length).toBe(7)
    expect(html).toContain('data-luz="apagado"')
    expect(html).toContain('data-luz="centro"')
    expect(html).toContain('data-globo="resultado"')
    expect(html).toContain("usó 3 de 5 informes de la mesa de análisis")
    expect(html).toContain("Ver su aporte completo")
    expect(readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")).toMatch(/onTocar=\{\(a\) => setAporteDe\(a\)\}/)
  })

  it("el aporte completo: texto entero, de dónde sale, aviso si está recortado, `nv-panel` (el chat sigue visible) y sin avisos de gasto", () => {
    const p = conAportes(reunion(30), { salidas: SALIDAS, informesEnElCerebro: FICHAS, revision: REVISION }).participantes.find((x) => x.agente === "growth-hacker")!
    const html = renderToStaticMarkup(createElement(AporteCompleto, { p, onCerrar: () => {}, onFicha: () => {}, datosIniciales: { agente: p.agente, corrida: p.corrida!, texto: "Texto entero del informe", titulo: null, fuente: "agent_invocations.output_summary", recortado: true, creado_en: en(3) } }))
    expect(html).toContain("Texto entero del informe")
    expect(html).toContain("recortado a 2.000 caracteres")
    expect(html).toContain("no se usó: su informe no entró al cerebro")
    expect(html).toContain("nv-panel")
    expect(html).toContain("ver su ficha")
    for (const f of ["components/nuevo/escena/AporteCompleto.tsx", "components/nuevo/escena/SalaDeReuniones.tsx"]) expect(readFileSync(f, "utf8")).not.toMatch(/US\$|gasto|costo/i)
  })
})
