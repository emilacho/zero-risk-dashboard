import { describe, expect, it } from "vitest"
import { CAMPOS_DEL_LECTOR, leerManual, quienValido, rotuloDeQuienValido, separarNota } from "../lib/manual-lector"

const fila = (extra: Record<string, unknown> = {}) => ({ human_validated: false, content_text: JSON.stringify({}), provenance_tag: {}, ...extra })

describe("lector del manual (E2)", () => {
  it("lee la columna y, si está vacía, el borrador (igual que el PDF a Drive)", () => {
    const m = leerManual(fila({ brand_purpose: "Propósito de columna", content_text: JSON.stringify({ brand_book_draft: { proposito: "del borrador", mision: "Misión del borrador", valores: ["a", "b"] } }) }))!
    const v = (k: string) => m.campos.find((c) => c.clave === k)?.valor
    expect(v("proposito")).toBe("Propósito de columna")
    expect(v("mision")).toBe("Misión del borrador")
    expect(v("valores")).toBe("a · b")
  })
  it("un obligatorio vacío es un hueco declarado y el manual no está completo; lo opcional vacío no se muestra", () => {
    const m = leerManual(fila({ brand_purpose: "p" }))!
    expect(m.completo).toBe(false)
    expect(m.campos.find((c) => c.clave === "mision")).toMatchObject({ estado: "hueco" })
    expect(m.campos.find((c) => c.clave === "personalidad")).toBeUndefined()
    expect(m.campos.find((c) => c.clave === "mision")?.nota).toMatch(/Sin dato/)
  })
  it("«PENDIENTE» es hueco y la propuesta del agente se rotula", () => {
    const m = leerManual(fila({ brand_vision: "PENDIENTE", brand_mission: "[propuesta del agente — busqué en el sitio] Llevar el mar a la mesa" }))!
    expect(m.campos.find((c) => c.clave === "vision")?.estado).toBe("hueco")
    expect(m.campos.find((c) => c.clave === "mision")?.estado).toBe("propuesta")
  })
  it("quién validó: jefatura, dueño (también los viejos sin marca) o nadie", () => {
    expect(quienValido(fila())).toBe("propuesta")
    expect(quienValido(fila({ human_validated: true }))).toBe("dueno")
    expect(quienValido(fila({ human_validated: true, provenance_tag: { validado_por: "jefatura" } }))).toBe("jefatura")
    expect(rotuloDeQuienValido("jefatura", "2026-10-30T12:00:00Z")).toBe("Validado por la jefatura · 2026-10-30")
    expect(rotuloDeQuienValido("propuesta", null)).toMatch(/sin validar/)
  })
  it("usa la completitud que dejó la plataforma y dice «completo · sin letra observada»", () => {
    const m = leerManual(fila({ content_text: JSON.stringify({ completitud: { completo: true, huecos: [], visual: { estado: "completo", tipografia: "sin_letra_observada" } } }) }))!
    expect(m.completo).toBe(true)
    expect(m.rotuloVisual).toBe("Completo · sin letra observada")
    const abierto = leerManual(fila({ content_text: JSON.stringify({ completitud: { completo: false, huecos: [{ clave: "sedes" }], visual: {} } }) }))!
    expect(abierto.huecos).toEqual(["sedes"])
    expect(abierto.rotuloVisual).toBeNull()
  })
  it("la nota de procedencia no se queda pegada al valor: sale como explicación aparte (ADENDA 4 a)", () => {
    const m = leerManual(fila({ brand_mission: "Náufrago prepara encebollado y ceviche con producto del día. [propuesta del agente — Integra las correcciones del dueño (restaurante + domicilio en Olón), sin atribuir cifras ni premios.]" }))!
    const c = m.campos.find((x) => x.clave === "mision")!
    expect(c.valor).toBe("Náufrago prepara encebollado y ceviche con producto del día.")
    expect(c.valor).not.toMatch(/\[|propuesta del agente/)
    expect(c.estado).toBe("propuesta")
    expect(c.explicacion).toBe("Integra las correcciones del dueño (restaurante + domicilio en Olón), sin atribuir cifras ni premios.")
  })
  it("separarNota: al principio, en medio, en listas, sin razón y sin nota", () => {
    expect(separarNota("[propuesta del agente — razón uno] Texto del campo")).toMatchObject({ valor: "Texto del campo", explicacion: "razón uno", propuesta: true })
    expect(separarNota("Uno [propuesta del agente — a] dos")).toMatchObject({ valor: "Uno dos", explicacion: "a" })
    expect(separarNota("a [propuesta del agente — x] · b [propuesta del agente — y]")).toMatchObject({ valor: "a · b", explicacion: "x · y" })
    expect(separarNota("Valor [propuesta del agente]")).toMatchObject({ valor: "Valor", explicacion: null, propuesta: true })
    expect(separarNota("Valor normal [con corchetes]")).toMatchObject({ valor: "Valor normal [con corchetes]", propuesta: false })
    expect(separarNota(null)).toMatchObject({ valor: null })
  })
  it("sin fila no hay manual", () => { expect(leerManual(null)).toBeNull() })
  it("las claves del lector son únicas y cada una apunta a una columna del manual", () => {
    expect(new Set(CAMPOS_DEL_LECTOR.map((c) => c.clave)).size).toBe(CAMPOS_DEL_LECTOR.length)
    expect(CAMPOS_DEL_LECTOR.map((c) => c.columna)).toContain("tagline")
  })
})

describe("anotaciones internas pegadas a un elemento de lista", () => {
  it("«… [canal preferido S1-S4 + diferenciador …]» sale del valor y queda como explicación", () => {
    const m = leerManual({ human_validated: false, content_text: "{}", provenance_tag: {}, key_messages: ["Pídenos por WhatsApp y te llevamos el sabor a donde estés [canal preferido S1-S4 + diferenciador delivery frente a los competidores]", "Mariscos frescos sin salir del alojamiento"] })!
    const c = m.campos.find((x) => x.clave === "mensajes_clave")!
    expect(c.valor).toBe("Pídenos por WhatsApp y te llevamos el sabor a donde estés · Mariscos frescos sin salir del alojamiento")
    expect(c.explicacion).toMatch(/^canal preferido S1-S4/)
  })
  it("un corchete corto del contenido real no se toca", () => {
    expect(separarNota("Abrimos [24h]")).toMatchObject({ valor: "Abrimos [24h]", explicacion: null })
  })
})

describe("lo que escribió el dueño desde el tablero", () => {
  const meta = { proposito: { fuente: "dueno", por: "emilio", en: "2026-10-30T16:00:00Z", valor_anterior: "Viejo", cita: null }, mision: { estado: "confirmado", fuente: "sitio", aceptado_por_el_dueno: { por: "emilio", en: "x" } }, tagline_opciones: { fuente: "dueno" }, nunca_hace: { fuente: "dueno" } }
  const f = leerManual({ human_validated: false, provenance_tag: {}, brand_purpose: "Que todos coman rico", brand_mission: "Misión del sitio", tagline: "Del mar a tu mesa",
    content_text: JSON.stringify({ brand_book_draft: { _field_meta: meta, nunca_hace: ["prometer entregas imposibles", "usar cifras sin respaldo"], icp_summary: "Familias de la costa" } }) })!
  const c = (k: string) => f.campos.find((x) => x.clave === k)!
  it("el campo que escribió el dueño se rotula «escrito por el dueño»; lo que acepta al validar, «aceptado»; lo demás, nada", () => {
    expect(c("proposito")).toMatchObject({ valor: "Que todos coman rico", origen: "dueno" })
    expect(c("eslogan")).toMatchObject({ valor: "Del mar a tu mesa", origen: "dueno" }) // la procedencia del eslogan vive bajo tagline_opciones
    expect(c("mision").origen).toBe("aceptado")
    expect(c("voz").origen).toBeNull()
  })
  it("muestra también el público y lo que la marca nunca dice o hace (los lee del borrador)", () => {
    expect(c("publico")).toMatchObject({ valor: "Familias de la costa", estado: "lleno" })
    expect(c("nunca")).toMatchObject({ valor: "prometer entregas imposibles · usar cifras sin respaldo", origen: "dueno" })
  })
  it("un hueco no lleva origen", () => { expect(c("vision").origen).toBeNull() })
})
