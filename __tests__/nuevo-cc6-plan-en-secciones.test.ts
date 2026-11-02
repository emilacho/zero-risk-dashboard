/** Dashboard nuevo · CC6 · el plan en secciones (Emilio, 02-nov: «que esté bien segmentado para que el lector no se pierda entre párrafos gigantes»). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { anclaDe, bloquesDelMarkdown, datosClave, resumenDeLaSeccion, seccionesDelPlan, trozosDelTexto } from "@/lib/plan-documento"
import { PlanEnSecciones } from "@/components/nuevo/PlanEnSecciones"

const PLAN = [
  "# PLAN DE CAMPAÑA 90 DÍAS · NÁUFRAGO",
  "**Olón, Santa Elena, Ecuador · 2 de noviembre de 2026 – 24 de enero de 2027**",
  "", "---", "",
  "## QUÉ CAMBIÓ EN ESTA VERSIÓN (v2)", "- Lo pidió el dueño", "",
  "## Resumen ejecutivo", "Tres apuestas. Un número. Un plazo.", "", "**Apuesta 1 — El encebollado.** Texto largo.", "",
  "## Ingresos", "El número que persigue el plan: 130 tickets semanales al cierre de la semana 12.", "",
  "## Presupuesto (propuesta para aprobación)", "**Lo que declaró el negocio:** $200 por semana en pauta.", "",
  "| | |", "|---|---|", "| Cuánto cuesta el mes | $800 en pauta |", "| Pedidos | No calculable |", "",
  "## Hoja de ruta de 84 días", "### FASE 1 · Desbloquear · Semanas 1-2", "- a", "### FASE 2 · Cimientos", "- b", "",
  "## Qué asumimos", "| Supuesto | Fuente |", "|---|---|", "| X | Y |", "| Z | W |",
].join("\n")

describe("el plan en secciones", () => {
  it("parte por «##», saca título y bajada, y no repite «Qué cambió» (ya se ve arriba)", () => {
    const d = seccionesDelPlan(PLAN)
    expect(d.titulo).toBe("PLAN DE CAMPAÑA 90 DÍAS · NÁUFRAGO")
    expect(d.bajada).toBe("Olón, Santa Elena, Ecuador · 2 de noviembre de 2026 – 24 de enero de 2027")
    expect(d.secciones.map((s) => s.id)).toEqual(["resumen-ejecutivo", "ingresos", "presupuesto-propuesta-para-aprobacion", "hoja-de-ruta-de-84-dias", "que-asumimos"])
    expect(d.secciones[3].subtitulos).toEqual(["FASE 1 · Desbloquear · Semanas 1-2", "FASE 2 · Cimientos"])
    expect(seccionesDelPlan("sin títulos").secciones).toEqual([])
    expect(anclaDe("Qué asumimos y de dónde")).toBe("que-asumimos-y-de-donde")
  })
  it("cada sección trae un resumen corto: su comienzo; si empieza con subtítulos, ellos; si con tabla, cuántas filas y la cabecera", () => {
    const d = seccionesDelPlan(PLAN)
    expect(d.secciones[0].resumen).toEqual(["Tres apuestas. Un número. Un plazo.", "Apuesta 1 — El encebollado. Texto largo."])
    expect(d.secciones[3].resumen).toEqual(["FASE 1 · Desbloquear · Semanas 1-2", "FASE 2 · Cimientos"])
    expect(d.secciones[4].resumen).toEqual(["Tabla de 2 filas: Supuesto · Fuente"])
    expect(resumenDeLaSeccion("x".repeat(400), 3, 50)[0].length).toBeLessThanOrEqual(50)
  })
  it("los datos clave se copian del documento (fechas, dónde, presupuesto, la meta); lo que no está, null", () => {
    const d = Object.fromEntries(datosClave(seccionesDelPlan(PLAN)).map((x) => [x.clave, x.valor]))
    expect(d).toEqual({ fechas: "2 de noviembre de 2026 – 24 de enero de 2027", lugar: "Olón, Santa Elena, Ecuador", presupuesto: "Lo que declaró el negocio: $200 por semana en pauta.", meta: "El número que persigue el plan: 130 tickets semanales al cierre de la semana 12." })
    expect(datosClave(seccionesDelPlan("# T\n## Otra\nnada")).every((x) => x.valor === null)).toBe(true)
  })
  it("el markdown en bloques: tablas como tablas (sin la fila de guiones), listas, subtítulos, párrafos", () => {
    const b = bloquesDelMarkdown(seccionesDelPlan(PLAN).secciones[2].cuerpo)
    expect(b.map((x) => x.tipo)).toEqual(["parrafo", "tabla"])
    expect(b[1]).toEqual({ tipo: "tabla", cabecera: ["", ""], filas: [["Cuánto cuesta el mes", "$800 en pauta"], ["Pedidos", "No calculable"]] })
    expect(bloquesDelMarkdown("### Sub\n1. uno\n2. dos\n\n> cita").map((x) => x.tipo)).toEqual(["titulo", "lista", "cita"])
  })
  it("cifras y fechas destacadas, negritas aparte", () => {
    const t = trozosDelTexto("**Meta:** 130 tickets, $200 por semana, 15 % al 2 nov en la semana 12")
    expect(t.filter((x) => x.cifra).map((x) => x.t)).toEqual(["$200", "15 %", "2 nov", "semana 12"])
    expect(t[0]).toEqual({ t: "Meta:", negrita: true })
  })
  it("se pinta: tarjetas, índice, secciones cerradas con resumen; abierta, la tabla sin cabecera vacía y «Pedir cambios en esta sección»", () => {
    const cerrado = renderToStaticMarkup(createElement(PlanEnSecciones, { prosa: PLAN }))
    expect((cerrado.match(/data-dato=/g) ?? []).length).toBe(4)
    expect((cerrado.match(/data-ir=/g) ?? []).length).toBe(5)
    expect(cerrado).toContain('data-abierta="false"')
    expect(cerrado).not.toContain("data-pedir-en") // sin función para pedir cambios, no hay botón
    const abierto = renderToStaticMarkup(createElement(PlanEnSecciones, { prosa: PLAN, abiertasIniciales: ["presupuesto-propuesta-para-aprobacion"], onPedirCambios: () => {} }))
    expect(abierto).toContain("data-tabla")
    expect(abierto).not.toContain("<thead") // la cabecera vacía no se pinta
    expect(abierto).toContain('data-pedir-en="presupuesto-propuesta-para-aprobacion"')
    expect(renderToStaticMarkup(createElement(PlanEnSecciones, { prosa: "solo texto" }))).toContain("solo texto") // sin secciones: el texto tal cual
  })
})
