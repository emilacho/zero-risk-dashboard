// @vitest-environment jsdom
/**
 * CERTIFICACIÓN CC6 #322 🟡 (10-nov): las pantallas, vigiladas por lo que SE VE y no por el texto del archivo.
 * Se pintan el panel de la gran idea y el del brief con lo que devolvió producción el 10-nov para Náufrago (fixtures enteros), cerrados (los resúmenes
 * plegados) y abiertos. Los textos humanos se «ensucian» además con códigos de la cadena, para que cada campo que se muestra quede vigilado aunque hoy
 * venga limpio. Y la ficha de una pregunta: todo su texto lo escriben los agentes.
 */
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { PanelGranIdea } from "@/components/nuevo/PanelGranIdea"
import { PanelBrief } from "@/components/nuevo/PanelBrief"
import { FichaDeDecision } from "@/components/nuevo/FichaDeDecision"
import { fichaDeLaPregunta } from "@/lib/ficha-de-decision"
import { codigosDeFotos } from "@/lib/gran-idea-datos"
import { sinCodigos } from "@/lib/sin-codigos"
import type { Decision } from "@/lib/direccion-decisiones"

afterEach(cleanup)
const leer = (n: string) => JSON.parse(readFileSync(`__tests__/fixtures/${n}.json`, "utf8"))
/** ningún código del sistema queda a la vista */
const CODIGO = /\b(?:brf|con|pln|man|pie|rev|cam)-[0-9a-f]{6,}|\bC\d+-I\d+\b|foto:|(?<![\p{L}\p{N}_-])v\d+(?![\p{L}\p{N}_-])|\(revisi[oó]n\)|`[0-9a-f]{7,12}`|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/u
const SUCIO = " (con-28de888eb3f2-v3 · v2 (revisión)) la idea C1-I08 `pie-5a1b2c3d4e`"
const nofetch = (async () => new Response("{}", { status: 404 })) as unknown as typeof fetch
const abrirTodo = (c: HTMLElement) => { for (let k = 0; k < 3; k++) for (const b of c.querySelectorAll<HTMLButtonElement>("[data-bloque][data-abierta='false'] > button, [data-seccion][data-abierta='false'] > button")) fireEvent.click(b) }
const esperar = () => new Promise((r) => setTimeout(r, 30))

/** la gran idea real, con cada texto que se muestra ensuciado */
function granIdeaSucia() {
  const g = leer("naufrago-gran-idea-10-nov")
  const d = g.detalle
  d.gran_idea = { nombre: d.gran_idea.nombre + SUCIO, frase: d.gran_idea.frase + SUCIO }
  d.titulo += SUCIO
  d.avisos = d.avisos.map((a: string) => a + SUCIO)
  for (const k of ["por_que_funciona", "como_se_ve", "como_suena", "caminos_descartados", "devolucion_del_brief"]) d[k] = `${SUCIO.trim()} ${d[k] ?? "texto"}`
  for (const c of d.capitulos) { c.nombre += SUCIO; c.que_cuenta = `${SUCIO.trim()} ${c.que_cuenta}`; for (const s of c.series) s.nombre += SUCIO }
  g.fotos = Object.fromEntries(codigosDeFotos(d).map((c) => [c, `https://x.supabase.co/storage/v1/object/public/fotos/${c}.jpg`]))
  return g
}

describe("la gran idea real de Náufrago, como la ve Emilio", () => {
  it("cerrada (los resúmenes plegados) no muestra ningún código", async () => {
    const r = render(createElement(PanelGranIdea, { onCerrar: () => {}, datosIniciales: granIdeaSucia(), fetchImpl: nofetch }))
    await esperar()
    expect(r.container.querySelector("[data-bloque='avisos']")).not.toBeNull() // de verdad pintó la gran idea
    expect(r.container.textContent).toContain("El oro que nunca buscaste")
    expect(r.container.textContent).not.toMatch(CODIGO)
  })
  it("abierta entera tampoco, y las fotos citadas salen como miniaturas", async () => {
    const g = granIdeaSucia()
    const r = render(createElement(PanelGranIdea, { onCerrar: () => {}, datosIniciales: g, fetchImpl: nofetch }))
    await esperar(); abrirTodo(r.container)
    expect(r.container.querySelectorAll("[data-bloque][data-abierta='false']")).toHaveLength(0)
    expect(r.container.textContent).not.toMatch(CODIGO)
    expect(r.container.textContent).toContain("la idea 8 del capítulo 1")
    const minis = r.container.querySelectorAll("[data-bloque='como_se_ve'] [data-miniatura]")
    expect(minis.length).toBe(9) // las 9 fotos que cita «Cómo se ve» en producción
    expect(r.container.querySelectorAll("[data-miniatura]").length).toBe(11) // 11 en toda la gran idea
    expect(r.container.querySelector("[data-bloque='caminos_descartados'] [data-miniatura]")).not.toBeNull()
  })
  it("el texto guardado no cambia al mostrarlo", async () => {
    const g = granIdeaSucia(), antes = JSON.stringify(g)
    render(createElement(PanelGranIdea, { onCerrar: () => {}, datosIniciales: g, fetchImpl: nofetch })); await esperar()
    expect(JSON.stringify(g)).toBe(antes)
  })
})

describe("el brief real de Náufrago, como lo ve Emilio", () => {
  const briefSucio = () => {
    const b = leer("naufrago-brief-10-nov")
    b.briefs[0].motivo = "cambios_de_emilio" + SUCIO
    b.briefs[0].devolucion_texto = `${SUCIO.trim()}\n${b.briefs[0].devolucion_texto}`
    return b
  }
  it("cerrado y abierto, sin códigos (incluidos la devolución y el motivo)", async () => {
    const b = briefSucio()
    const r = render(createElement(PanelBrief, { onCerrar: () => {}, datosIniciales: b, fetchImpl: nofetch }))
    await esperar()
    expect(r.container.textContent).toContain("Por qué esta versión")
    expect(r.container.textContent).toContain("falta la sección «## Público»")
    expect(r.container.textContent).not.toMatch(CODIGO)
    abrirTodo(r.container)
    expect(r.container.querySelectorAll("[data-seccion]").length).toBeGreaterThan(3)
    expect(r.container.querySelectorAll("[data-seccion][data-abierta='false']")).toHaveLength(0)
    expect(r.container.textContent).toContain("Brief creativo de campaña")
    for (const c of b.fotos as string[]) expect(r.container.textContent).not.toContain(c) // las fotos del cliente que cita, tampoco en los resúmenes (sin comillas)
    expect(r.container.textContent).toContain("desde la versión 2") // la versión del sistema, en palabras
    expect(r.container.textContent).not.toMatch(CODIGO)
  })
})

describe("la ficha de una pregunta: lo que escriben los agentes, sin códigos", () => {
  const d = {
    id: "p1", tipo: "pregunta", titulo: "¿Usamos la idea C1-I08 del brief (brf-28de888eb3f2 v2)?", cliente: "Náufrago", client_id: "c",
    criticos: ["La pieza pie-5a1b2c3d4e sale el lunes: sin tu respuesta, se atrasa"], para_que: "Para cerrar el concepto con-28de888eb3f2-v3",
    para_que_corto: "cerrar con-28de888eb3f2-v3", destraba: "el plan pln-28de888eb3f2 v2", supuesto: "Sí, la C1-I08", desde: "2026-11-10T10:00:00Z", fuente: "dueno_preguntas",
  } as unknown as Decision
  it("título, decisivo, para qué, desbloquea y supuesto salen limpios, cerrada y abierta", () => {
    const f = fichaDeLaPregunta(d, { departamento: "Departamento de Marketing", detiene: false, destraba: "el plan pln-28de888eb3f2 v2", conAsumir: true, responder: true, descartar: false })
    expect(f.que_se_decide).toBe(d.titulo) // el traductor no toca el dato: limpia el dibujante
    for (const abiertoInicial of [false, true]) {
      const html = renderToStaticMarkup(createElement(FichaDeDecision, { ficha: f, enviando: null, alVerbo: () => {}, alIr: () => {}, abiertoInicial }))
      const texto = html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ")
      expect(texto).toContain(sinCodigos(d.titulo))
      expect(texto).toContain("la idea 8 del capítulo 1")
      expect(texto).not.toMatch(CODIGO)
    }
  })
})
