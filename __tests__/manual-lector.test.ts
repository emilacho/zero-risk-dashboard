import { describe, expect, it } from "vitest"
import { CAMPOS_DEL_LECTOR, leerManual, quienValido, rotuloDeQuienValido } from "../lib/manual-lector"

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
  it("sin fila no hay manual", () => { expect(leerManual(null)).toBeNull() })
  it("las claves del lector son únicas y cada una apunta a una columna del manual", () => {
    expect(new Set(CAMPOS_DEL_LECTOR.map((c) => c.clave)).size).toBe(CAMPOS_DEL_LECTOR.length)
    expect(CAMPOS_DEL_LECTOR.map((c) => c.columna)).toContain("tagline")
  })
})
