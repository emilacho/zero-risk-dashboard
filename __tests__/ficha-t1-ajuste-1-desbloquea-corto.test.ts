/**
 * 10-nov · #310 AJUSTE 1 (Emilio 09-nov 23:45Z · RESPUESTA de Lenovo): «Desbloquea» y «Uso» cortos (2 o 3 palabras), escritos por la oficina
 * con `destraba_corto`, nunca la frase entera; los nombres propios con su forma oficial («Sigue el Plan de Marketing»).
 * Si la oficina no manda el corto, la primera frase (y la oficina se corrige: CC1). US$ 0 · sin red.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { DESBLOQUEA_EL_PLAN_CORTO, desbloqueaElPlan, queSeDestraba, type Decision } from "@/lib/direccion-decisiones"
import { NOMBRES_PROPIOS, conNombresPropios, fichaDeLaPregunta } from "@/lib/ficha-de-decision"

const P = (x: Partial<Decision> = {}) => ({ id: "p1", tipo: "pregunta_al_dueno", fuente: "dueno_preguntas", titulo: "¿Cuántas sedes?", cliente: "Náufrago", client_id: "c1", desde: null, pregunta_de: null, ...x }) as unknown as Decision
const X = { departamento: "Departamento de Marketing", detiene: true, conAsumir: false, responder: true, descartar: false }

describe("lo que arma el tablero cuando el plan espera", () => {
  it("al frente, corto (2-3 palabras de contenido) y con el nombre propio oficial: «Sigue el Plan de Marketing»", () => {
    expect(DESBLOQUEA_EL_PLAN_CORTO).toBe("Sigue el Plan de Marketing")
    expect(NOMBRES_PROPIOS).toContain("Plan de Marketing")
    expect(conNombresPropios(DESBLOQUEA_EL_PLAN_CORTO).filter((p) => p.propio).map((p) => p.texto)).toEqual(["Plan de Marketing"])
  })
  it("el entero también lleva el nombre oficial; nunca «plan de 90 días»", () => {
    expect(desbloqueaElPlan("Náufrago")).toBe("El Plan de Marketing de Náufrago sigue en cuanto contestes sus preguntas.")
    expect(desbloqueaElPlan(null)).toBe("El Plan de Marketing sigue en cuanto contestes sus preguntas.")
    expect(queSeDestraba(P(), new Set(["p1"]))).toBe(desbloqueaElPlan("Náufrago"))
    for (const f of ["lib/direccion-decisiones.ts", "components/nuevo/PanelDecisiones.tsx"]) expect(readFileSync(f, "utf8"), f).not.toMatch(/`El plan de 90 días/)
  })
})

describe("la ficha: el corto que va al frente", () => {
  it("el del tablero, cuando lo armó el tablero", () => {
    const f = fichaDeLaPregunta(P(), { ...X, destraba: desbloqueaElPlan("Náufrago"), destrabaCorto: DESBLOQUEA_EL_PLAN_CORTO })
    expect(f.desbloquea).toEqual({ largo: desbloqueaElPlan("Náufrago"), corto: "Sigue el Plan de Marketing" })
  })
  it("el de la oficina, cuando la oficina lo mandó", () => {
    const d = P({ destraba: "La pauta de diciembre arranca en cuanto contestes. Y algo más.", destraba_corto: "Arranca la pauta" })
    expect(fichaDeLaPregunta(d, { ...X, destraba: d.destraba!, destrabaCorto: "Arranca la pauta" }).desbloquea?.corto).toBe("Arranca la pauta")
    expect(fichaDeLaPregunta(d, { ...X, destraba: d.destraba! }).desbloquea?.corto).toBe("Arranca la pauta") // sin el del panel, el de la fila
  })
  it("sin corto de la oficina, la ficha no inventa uno (el panel pone la primera frase)", () => {
    const d = P({ destraba: "La pauta arranca. Y algo más." })
    expect(fichaDeLaPregunta(d, { ...X, destraba: d.destraba!, destrabaCorto: null }).desbloquea).toEqual({ largo: d.destraba })
  })
})

describe("el panel", () => {
  const c = readFileSync("components/nuevo/PanelDecisiones.tsx", "utf8")
  it("el corto del tablero solo cuando el texto es del tablero; un corto ajeno nunca se cuela", () => {
    expect(c).toContain("const destrabaCorto = d.destraba ? (d.destraba_corto ?? null) : destraba ? DESBLOQUEA_EL_PLAN_CORTO : null")
    // 10-nov · T2: la tarjeta vieja ya no existe; el mismo corto va a la ficha de la pregunta y a la de todas las demás
    expect(c).toContain("destraba, destrabaCorto, conAsumir")
    expect(c).toContain("detiene, destraba, destrabaCorto, acciones, panel: donde.panel")
  })
})
