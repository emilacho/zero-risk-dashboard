/**
 * 10-nov · NOMBRES DE LOS DEPARTAMENTOS (Emilio 09-nov 23:29Z · RESPUESTA de Lenovo): «Departamento de Marketing» y «Departamento de Finanzas»,
 * nombres propios. En la fila «Departamento» de la ficha, completos; nunca «Financiero» ni «Plan de 90 días». La revisión de estilo los atrapa. US$ 0 · sin red.
 */
import { describe, expect, it } from "vitest"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { departamentoDe } from "@/components/nuevo/PanelDecisiones"
import { NOMBRES_PROPIOS, NOMBRE_DEL_DEPARTAMENTO, departamentoDeLaOficina } from "@/lib/ficha-de-decision"
import type { Decision } from "@/lib/direccion-decisiones"

const D = (x: Partial<Pick<Decision, "tipo" | "fuente" | "pregunta_de">>) => ({ tipo: "pregunta_al_dueno", fuente: "dueno_preguntas", pregunta_de: null, ...x }) as Pick<Decision, "tipo" | "fuente" | "pregunta_de">

describe("los dos nombres oficiales", () => {
  it("son exactamente los de Emilio, y son nombres propios del sistema", () => {
    expect(NOMBRE_DEL_DEPARTAMENTO).toEqual({ marketing: "Departamento de Marketing", finanzas: "Departamento de Finanzas" })
    for (const n of Object.values(NOMBRE_DEL_DEPARTAMENTO)) expect(NOMBRES_PROPIOS).toContain(n)
  })
  it("cada oficina va a su departamento (Planeación, la Oficina Creativa y Revisión son de Marketing); una que no es de ninguno no inventa uno", () => {
    expect(departamentoDeLaOficina("financiera")).toBe("finanzas")
    expect(departamentoDeLaOficina("Oficina Financiera")).toBe("finanzas")
    for (const o of ["planeacion", "planeación", "oficina-creativa", "creativa", "revision", "marketing"]) expect(departamentoDeLaOficina(o), o).toBe("marketing")
    for (const o of ["cerebro", "dashboard", "oficinas", "", null]) expect(departamentoDeLaOficina(o), String(o)).toBeNull()
  })
})

describe("la fila «Departamento» de la decisión", () => {
  it("la pregunta real de la Oficina Financiera dice «Departamento de Finanzas» (antes «Financiero»)", () => {
    expect(departamentoDe(D({ pregunta_de: { oficina: "financiera", agente: "jefe-financiero" } }))).toBe("Departamento de Finanzas")
  })
  it("firma y pregunta de finanzas → Finanzas; plan, gran idea, piezas y revisión → Marketing (el plan nunca dice «Plan de 90 días»)", () => {
    expect(departamentoDe(D({ tipo: "firma_de_finanzas", fuente: "finanzas_tableros" }))).toBe("Departamento de Finanzas")
    expect(departamentoDe(D({ tipo: "pregunta_de_finanzas", fuente: "finanzas_preguntas" }))).toBe("Departamento de Finanzas")
    for (const tipo of ["plan", "gran_idea", "pieza", "revision"] as const) expect(departamentoDe(D({ tipo, fuente: null })), tipo).toBe("Departamento de Marketing")
    expect(departamentoDe(D({ tipo: "plan", fuente: "plan_aprobaciones" }))).not.toMatch(/Plan de 90/)
  })
  it("una pregunta de Planeación o de la Oficina Creativa dice «Departamento de Marketing»", () => {
    expect(departamentoDe(D({ pregunta_de: { oficina: "planeacion", agente: "x" } }))).toBe("Departamento de Marketing")
    expect(departamentoDe(D({ pregunta_de: { oficina: "oficina-creativa", agente: "x" } }))).toBe("Departamento de Marketing")
  })
  it("lo que no es de un departamento no se disfraza de uno: el cerebro sigue diciendo «Cerebro»", () => {
    expect(departamentoDe(D({ tipo: "pregunta_al_dueno", fuente: "cerebro_dueno_preguntas" }))).toBe("Cerebro")
    expect(departamentoDe(D({ pregunta_de: { oficina: "cerebro", agente: "x" } }))).not.toMatch(/^Departamento/)
  })
  it("ningún archivo del tablero nuevo escribe «Financiero» como departamento", () => {
    for (const f of ["components/nuevo/PanelDecisiones.tsx", "components/nuevo/FichaDeDecision.tsx", "lib/ficha-de-decision.ts"]) expect(readFileSync(f, "utf8"), f).not.toMatch(/["'`]Financiero["'`]/)
  })
})

describe("la revisión de estilo los atrapa", () => {
  it("«Financiero» o «Plan de 90 días» en el campo departamento frenan; el nombre oficial, el título del plan y un comentario pasan (modo probar)", () => {
    const fuente = readFileSync("scripts/revisar-estilo.mjs", "utf8")
    expect(fuente).toContain('["{ departamento: \\"Financiero\\" }", 7]')
    expect(fuente).toContain('["DEPARTAMENTO = { plan: \\"Plan de 90 días\\" }", 7]')
    expect(fuente).toContain('"titulo: \\"Plan de 90 días\\""')
    expect(execFileSync(process.execPath, ["scripts/revisar-estilo.mjs", "probar"], { encoding: "utf8" })).toMatch(/^ok · /)
  })
  it("el nombre en minúscula («Departamento de finanzas») lo frena la regla de nombres propios", () => {
    expect(readFileSync("scripts/revisar-estilo.mjs", "utf8")).toContain('["del departamento de finanzas: \\"Departamento de finanzas\\"", 6]')
  })
})

describe("la escena", () => {
  it("«Dept. Marketing» pasa a «Departamento de Marketing» en el rótulo y en el nombre (cabe: imagen del 10-nov)", () => {
    expect(readFileSync("components/nuevo/EscenaNuevo.tsx", "utf8")).toContain('texto: "DEPARTAMENTO DE MARKETING"')
    for (const f of ["components/nuevo/EscenaNuevo.tsx", "components/nuevo/EscenaViva.tsx", "lib/direccion-decisiones.ts"]) expect(readFileSync(f, "utf8"), f).not.toMatch(/["'](Dept|Dpto)\. Marketing["']/)
  })
})
