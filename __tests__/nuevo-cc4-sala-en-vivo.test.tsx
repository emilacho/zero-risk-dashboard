import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { armarEscena, type EntradaDeLaEscena, type InvocacionViva } from "@/lib/escena-avatares"
import { fraseDelGlobo, lineasDelResultado, lineasDeLaSala, masReuniones, tituloPorElPedido, type ParticipanteDeLaSala } from "@/lib/escena-sala"
import { GloboEnLaFoto, globoVisible } from "@/components/nuevo/escena/SalaDeReuniones"
import { HologramaFigura } from "@/components/nuevo/escena/Holograma"
import { lecturaInicial, pasoNatural } from "@/components/nuevo/escena/Siluetas"
import { VELOCIDAD_PX_S } from "@/lib/escena-movimiento"

// CORRECCIÓN de Lenovo 04-nov (Emilio 09:55Z): la sala de reuniones en vivo durante la reescritura del manual

const T0 = Date.parse("2026-11-04T10:00:00Z")
const en = (min: number) => new Date(T0 + min * 60_000).toISOString()
const ANALISTAS = ["x-twitter-intelligence-analyst", "feedback-synthesizer", "growth-hacker"]
const inv = (agent_name: string, exec: string, finMin: number, extra: Partial<InvocacionViva> = {}): InvocacionViva =>
  ({ agent_name, client_id: "nau", workflow_id: "uuid-de-despacho-sin-nombre", workflow_execution_id: exec, status: "completed", started_at: en(finMin - 2), ended_at: en(finMin), cost_usd: 0.3, step_name: null, task_text: null, ...extra })
const entrada = (minAhora: number, invocaciones: InvocacionViva[]): EntradaDeLaEscena => ({
  despachos: [], invocaciones,
  directorio: ANALISTAS.map((a) => ({ agente: a, equipo: "estrategia", rol: "miembro" })),
  agentes: ANALISTAS.map((a) => ({ name: a, display_name: a })), clientes: [{ id: "nau", nombre: "Náufrago" }], equipos: null,
  ahora: new Date(T0 + minAhora * 60_000),
})
const PEDIDO = "Reescribe el manual de la marca con los datos del cliente"
// regla C: el último analista está re-sintetizando (paso que consolida, en curso); los otros dos aportaron antes
const enCurso = () => ANALISTAS.map((a, i) => inv(a, i === 2 ? "700:bba-resintesis-c1" : `700:paso${i}`, 2 + i, { task_text: PEDIDO, status: i === 2 ? "running" : "completed", ended_at: i === 2 ? null : en(2 + i), ...(i === 2 ? { started_at: en(4) } : {}) }))

const p = (extra: Partial<ParticipanteDeLaSala> = {}): ParticipanteDeLaSala => ({ agente: "growth-hacker", nombre: "Growth Hacker", mesa: null, equipo: "Estrategia", cabecera: false, fase: "análisis mercado", estado: "hablo", ultima: null, hace: "hace 1 min", corrida: "700:analisis-mercado", silla: { x: 1350, y: 432 }, aporte: { resumen: "Scores emitidos. Razonamiento breve por campo: Campo Score Fundamento positioning 0.88 Olón, GYE", uso: "usado", motivo: "entró al cerebro", recortado: false }, ...extra } as ParticipanteDeLaSala)

describe("CC4 · sala en vivo · 1 · el globo es una línea en español claro", () => {
  it("dice qué hace según su papel y NO trae nombres internos, números, inglés ni abreviaturas del texto crudo", () => {
    const frases = [
      fraseDelGlobo(p({ agente: "editor_en_jefe" })),
      fraseDelGlobo(p({ cabecera: true })),
      fraseDelGlobo(p({ corrida: "700:analisis-mercado" })),
      fraseDelGlobo(p({ corrida: null })),
      fraseDelGlobo(p({ estado: "hablando" })),
    ]
    expect(frases[0]).toBe("Revisa que el texto diga solo lo que está en los datos")
    expect(frases[1]).toBe("Arma el resultado con lo que traen los demás") // quien dirige
    expect(frases[2]).toBe("Aporta su informe de la mesa de análisis"); expect(frases[3]).toBe("Aporta lo que sabe de su área"); expect(frases[4]).toBe("Prepara su aporte")
    expect(fraseDelGlobo(p({ agente: "market_research_analyst", fase: "bb faithfulness judge c2", corrida: null }))).toBe(frases[0]) // el caso de la captura de Emilio
    for (const f of frases) { expect(f).not.toMatch(/\d|faithfulness|judge|Score|Campo|GYE|bb |c2|\.json|_/i); expect(f.split("\n")).toHaveLength(1); expect(f.length).toBeLessThanOrEqual(60) }
  })
  it("el globo trae solo el nombre y esa frase: ni la fase interna ni el texto del aporte", () => {
    const r = { estado: "terminada", participantes: [p()] } as never
    const g = globoVisible(r, "growth-hacker")!
    expect(g.lineas).toEqual(["Growth Hacker", "Aporta su informe de la mesa de análisis"])
    expect(JSON.stringify(g.lineas)).not.toMatch(/faithfulness|Scores|0\.88|GYE/)
  })
})

describe("CC4 · sala en vivo · 2 y 3 · margen del globo y solo con el cursor encima", () => {
  const g = globoVisible({ estado: "en_curso", participantes: [p()] } as never, "growth-hacker")!
  const svg = renderToStaticMarkup(createElement("svg", null, createElement(GloboEnLaFoto, { g })))
  it("el texto queda a ≥ 18 px del borde del globo y el globo no pasa de 260 + márgenes de ancho", () => {
    const rect = svg.match(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"/)!
    const textos = [...svg.matchAll(/<text x="([\d.-]+)"/g)].map((m) => Number(m[1]))
    expect(textos.length).toBeGreaterThanOrEqual(2) // el nombre y la frase (que se parte en renglones cortos)
    for (const x of textos) expect(x - Number(rect[1])).toBeGreaterThanOrEqual(18)
    expect(Number(rect[3])).toBeLessThanOrEqual(260 + 36)
  })
  it("sin cursor encima no hay globo de ningún agente (antes se quedaba el del último que habló); con el cursor, sí", () => {
    const viva = { estado: "en_curso", participantes: [p({ estado: "hablando" })] } as never
    expect(globoVisible(viva, null)).toBeNull()
    expect(globoVisible(viva, "growth-hacker")).not.toBeNull()
  })
})

describe("CC4 · sala en vivo · 4 · el caminar", () => {
  it("el paso es creíble (≤ 160 px/s de la foto) y arranca y frena suave: 0 en el inicio, 1 al final, nunca baja, y en el medio no supera la velocidad de crucero", () => {
    expect(VELOCIDAD_PX_S).toBeLessThanOrEqual(160)
    const T = 6000
    expect(pasoNatural(0, T)).toBe(0); expect(pasoNatural(T, T)).toBeCloseTo(1, 6)
    let ant = 0
    for (let t = 0; t <= T; t += 100) { const v = pasoNatural(t, T); expect(v).toBeGreaterThanOrEqual(ant - 1e-9); ant = v }
    const crucero = 1 / (T - 700) // fracción por ms
    const vel = (t: number) => (pasoNatural(t + 10, T) - pasoNatural(t, T)) / 10
    expect(vel(20)).toBeLessThan(crucero * 0.2) // arranca despacio
    expect(vel(T - 30)).toBeLessThan(crucero * 0.2) // frena despacio
    expect(vel(T / 2)).toBeCloseTo(crucero, 6) // en medio, constante (la curva en S de antes lo duplicaba)
  })
})

describe("CC4 · sala en vivo · 5 · las piernas de quien está sentado en la sala no van sobre la mesa", () => {
  it("con `sinPiernas` la figura sentada no dibuja la pierna; la silueta lo pide para todo el que está en la sala", () => {
    const con = renderToStaticMarkup(createElement("svg", null, createElement(HologramaFigura, { semilla: "growth-hacker", color: "#f5a524", postura: "sentado" })))
    const sin = renderToStaticMarkup(createElement("svg", null, createElement(HologramaFigura, { semilla: "growth-hacker", color: "#f5a524", postura: "sentado", sinPiernas: true })))
    expect((con.match(/<path/g) ?? []).length).toBeGreaterThan((sin.match(/<path/g) ?? []).length)
  })
})

describe("CC4 · sala en vivo · 6 y 7 · el título y «y N reuniones más»", () => {
  it("el título sale del pedido en curso: «Reescritura del manual · Náufrago», no «un trabajo sin nombre registrado»", () => {
    expect(tituloPorElPedido([null, PEDIDO])).toBe("Reescritura del manual")
    expect(tituloPorElPedido([null])).toBe("Un trabajo en curso")
    const sala = armarEscena(entrada(6, enCurso())).sala!
    expect(sala.reunion?.titulo).toBe("Reescritura del manual · Náufrago")
    expect(JSON.stringify(sala)).not.toMatch(/sin nombre registrado/)
  })
  it("singular o plural según toque, y la lista de las otras reuniones viaja en la sala para decir cuáles son", () => {
    expect(masReuniones(1)).toBe("y 1 reunión más"); expect(masReuniones(3)).toBe("y 3 reuniones más")
    const l = lineasDeLaSala({ reunion: { titulo: "Reescritura del manual · Náufrago", participantes: [], fases: [], dirige: "x", equipo: "e", estado: "en_curso", hace: "ahora" } as never, ultima: null, otras_en_curso: 1, otras: ["Plan de 90 días · Náufrago"], fuente: "x" })
    expect(l.join(" ")).toContain("y 1 reunión más"); expect(l.join(" ")).not.toMatch(/reunión\(es\)|\+1/)
  })
})

describe("CC4 · sala en vivo · 8 · al recargar no se repite la escena", () => {
  it("la primera lectura CON datos se pinta de una vez en su sitio; lo que cambia después sí se anima", () => {
    let est = { esPrimera: false, yaPaso: false }
    est = lecturaInicial(est.yaPaso, false); expect(est.esPrimera).toBe(false) // aún sin datos: nada que pintar
    est = lecturaInicial(est.yaPaso, true); expect(est.esPrimera).toBe(true) // llegaron los datos: ya sentados, sin caminata
    est = lecturaInicial(est.yaPaso, true); expect(est.esPrimera).toBe(false) // lo siguiente sí entra caminando
  })
})

describe("CC4 · sala en vivo · el cableado en la pantalla (reserva de CC3 sobre #261: lo que se comprobó a ojo queda fijado)", () => {
  const sil = readFileSync("components/nuevo/escena/Siluetas.tsx", "utf8")
  const ava = readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")
  it("la silueta sentada en la sala pide «sin piernas»; la de un escritorio, no", () => {
    expect(sil).toContain('postura="sentado" estado={c.fallo ? "falla" : "trabajando"} sinPiernas={c.lugar === "sala"}')
  })
  it("el bucle de animación usa el paso natural (no la curva en S) y el tope de un recorrido no es el de 7 s", () => {
    expect(sil).toContain("c.pos = puntoEnLaRuta(x.ruta, pasoNatural(t - c.t0, x.dur))")
    expect(sil).not.toContain("puntoEnLaRuta(x.ruta, suave(f))")
    expect(sil).toContain("const TOPE_DE_UN_RECORRIDO_MS = 20000"); expect(sil).not.toMatch(/duracionDelRecorrido\([^)]*\), 7000\)/)
  })
  it("la escena le dice a las siluetas si ya llegó la lectura, y la primera lectura con datos sale de `lecturaInicial`", () => {
    expect(ava).toContain("cargado={datos != null}")
    expect(sil).toContain("lecturaInicial(!primera.current, cargado)")
  })
})

describe("CC4 · sala en vivo · rótulo «sin texto guardado» ya no queda prendido (corrección de Lenovo 04-nov 13:43Z)", () => {
  const cerrada = (titulo: string | null) => ({ estado: "terminada", fallo: true, participantes: [p()], resultado: { titulo, usados: 0, informes: 0, revision: null } }) as never
  it("un resultado sin texto no se anuncia: ni líneas ni globo en el centro de la mesa", () => {
    expect(lineasDelResultado(cerrada(null))).toEqual([])
    expect(globoVisible(cerrada(null), null)).toBeNull()
    expect(lineasDelResultado(cerrada("PLAN DE CAMPAÑA"))[0]).toBe("Resultado · PLAN DE CAMPAÑA")
  })
  it("sin trabajo vivo ni resultado con texto la mesa no dibuja burbujas; en curso o con resultado sí", () => {
    const src = readFileSync("components/nuevo/escena/SalaDeReuniones.tsx", "utf8")
    expect(src).toContain('r && (r.estado === "en_curso" || lineasDelResultado(r).length > 0) && (() => {')
    expect(readFileSync("lib/escena-sala.ts", "utf8")).not.toContain("Resultado · sin texto guardado")
  })
})
