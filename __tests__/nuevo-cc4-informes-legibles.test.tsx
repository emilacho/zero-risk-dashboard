import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { lecturaDelInforme, primerasOraciones, sinMarcas } from "@/lib/informe-lectura"
import { PanelInformes } from "@/components/nuevo/PanelInformes"

const RESUMEN = {
  narrative: "**Semana buena.** Subieron las visitas al local (según [ficha 6a0f94b0c1d2]). Se publicaron 4 piezas y dos tuvieron más de 300 reacciones. Hubo un pico el sábado. Otra oración que ya no entra en el resumen grande porque el texto sigue y sigue y sigue durante bastante rato más allá del límite que se fija para la vista de arriba, así que se corta limpio en la oración anterior.",
  highlights: ["**Reel del sábado**: 1.200 vistas", "Promo de almuerzo con buena respuesta"],
  kpis: { alcance: "5.400", reacciones: "310", detalle_interno: { a: 1, b: 2 } },
  recommendations: ["Repetir el reel con la carta del almuerzo (ver [6a0f94b0c1d2…]).", "Subir el presupuesto de la promo un 10 %."],
  next_week_focus: "Probar un formato de historia con precios.",
  sources: ["Instagram Insights · semana 44", "Informe de ventas de Loyverse"],
  workflow_execution_id: "wf_9981:abc",
  report_id: "3f2a9c10-1111-2222-3333-444455556666",
  charts: [{ tipo: "barras", datos: [1, 2, 3] }],
}

describe("CC4 · informes legibles · la lectura (lógica pura)", () => {
  const l = lecturaDelInforme(RESUMEN)
  it("arriba: «qué pasó» (pocas oraciones, sin ** ni códigos) y «qué conviene» (las primeras recomendaciones)", () => {
    expect(l.que_paso).toContain("Semana buena."); expect(l.que_paso).not.toMatch(/\*\*|6a0f94b0|ficha/)
    expect(l.que_paso!.length).toBeLessThanOrEqual(330); expect(l.que_paso).not.toContain("sigue y sigue")
    expect(l.que_conviene).toHaveLength(2); expect(l.que_conviene[0]).toMatch(/^Repetir el reel/); for (const x of l.que_conviene) expect(x).not.toMatch(/6a0f94b0|\[/)
  })
  it("las fuentes van en su lista y lo que parece interno (ids, ejecuciones, gráficos) va a «técnico», no al cuerpo", () => {
    expect(l.fuentes).toEqual(["Instagram Insights · semana 44", "Informe de ventas de Loyverse"])
    const clavesTec = l.tecnico.map((t) => t.clave)
    expect(clavesTec).toContain("workflow_execution_id"); expect(clavesTec).toContain("report_id"); expect(clavesTec).toContain("charts")
    const cuerpo = JSON.stringify(l.secciones)
    expect(cuerpo).not.toMatch(/wf_9981|3f2a9c10|barras|sources|workflow_execution_id/)
  })
  it("las secciones del cuerpo no traen JSON crudo: un objeto anidado se manda a técnico", () => {
    const cuerpo = JSON.stringify(l.secciones)
    expect(cuerpo).not.toMatch(/\{\\"a\\"/)
    expect(l.tecnico.some((t) => /detalle/i.test(t.clave))).toBe(true)
    expect(l.secciones.map((s) => s.titulo)).toEqual(expect.arrayContaining(["Lo que pasó", "Puntos altos", "Indicadores"]))
  })
  it("sinMarcas y primerasOraciones: sin ** ni #, sin cortar una palabra a la mitad", () => {
    expect(sinMarcas("**Hola** _mundo_ con `código` y [un enlace](http://x.y)")).toBe("Hola mundo con código y un enlace")
    expect(sinMarcas("## Título\n- uno\n- dos")).toBe("Título uno dos")
    expect(primerasOraciones("Una. Dos. " + "palabra ".repeat(60), 30)).toBe("Una. Dos.")
    expect(primerasOraciones("palabra ".repeat(60), 30)).toMatch(/palabra…$/)
  })
  it("un informe sin nada de lo esperado no inventa: queda vacío", () => {
    const v = lecturaDelInforme({})
    expect(v.que_paso).toBeNull(); expect(v.que_conviene).toEqual([]); expect(v.secciones).toEqual([]); expect(v.fuentes).toEqual([]); expect(v.tecnico).toEqual([])
  })
})

const informe = { id: "i1", tipo: "weekly", estado: "delivered", desde: "2026-11-02", hasta: "2026-11-08", resumen: RESUMEN, pdf_url: null, entregado_en: "2026-11-09T14:00:00Z", entregado_a: [], creado_en: "2026-11-09T13:00:00Z" }
const datos = { ok: true as const, cliente: { id: "c1", nombre: "Náufrago" }, informes: [informe], analisis: [] }

describe("CC4 · informes legibles · lo que se ve", () => {
  const h = renderToStaticMarkup(createElement(PanelInformes, { onCerrar: () => {}, datosIniciales: datos as never }))
  it("la tarjeta de la lista no muestra ** ni códigos de ficha", () => {
    expect(h).toContain("Semana buena."); expect(h).not.toMatch(/\*\*|6a0f94b0/)
  })
  it("el informe abierto: resumen grande con «Qué pasó» y «Qué conviene», secciones con título en ámbar, fuentes chicas y técnico plegado", () => {
    const a = renderToStaticMarkup(createElement(PanelInformes, { onCerrar: () => {}, datosIniciales: datos as never, informeInicial: "i1" }))
    expect(a).toContain("data-resumen-grande"); expect(a).toContain("Qué pasó"); expect(a).toContain("Qué conviene")
    expect(a).toMatch(/data-que-paso[\s\S]*Semana buena\./); expect(a).toContain("Repetir el reel con la carta del almuerzo")
    expect(a).toMatch(/<h3 class="[^"]*text-amber-400[^"]*" data-titulo-informe/); expect(a).toMatch(/<h4 class="mb-2 [^"]*text-amber-200[^"]*">Puntos altos<\/h4>/)
    expect(a).not.toMatch(/\*\*|6a0f94b0|\{"a"/)
    expect(a).toMatch(/data-fuentes[^>]*>Fuentes: Instagram Insights · semana 44 · Informe de ventas de Loyverse/)
    expect(a).toMatch(/<details data-tecnico[\s\S]*Datos técnicos[\s\S]*workflow_execution_id/); expect(a).not.toMatch(/<details data-tecnico[^>]* open/)
    // el id y la ejecución solo aparecen dentro de «Datos técnicos»
    const fuera = a.replace(/<details data-tecnico[\s\S]*?<\/details>/, "")
    expect(fuera).not.toMatch(/wf_9981|3f2a9c10|workflow_execution_id|report_id/)
  })
})
