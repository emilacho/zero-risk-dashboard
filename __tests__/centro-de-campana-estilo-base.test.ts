/** CENTRO DE CAMPAÑA EN ESTILO BASE (Lenovo 06-nov, boceto 2): tarjetas más pequeñas, ícono un poco más grande, colores solo de tokens. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const c = readFileSync("components/nuevo/PanelAplicaciones.tsx", "utf8")

describe("Centro de campaña en estilo base", () => {
  it("🔴 el ícono crece a 44 px y toma el ámbar del token", () => {
    expect(c.match(/className="ap-icono h-11 w-11 text-ambar"/g)?.length).toBe(9); expect(c).not.toMatch(/ap-icono h-(?!11)/)
    expect(c).toContain('stroke: "currentColor"')
    expect(c).not.toMatch(/#e8731a|#f5a524|#171717/i)
    expect(c).not.toMatch(/text-\[\d|text-zinc-|text-rose-|font-semibold|font-bold/) // tamaños y colores solo del estilo base
  })
  it("🔴 la tarjeta es más chica: sin proporción fija, sin sombra, centrada, con tokens", () => {
    const clase = c.match(/const CLASE_DEL_CUADRO = "([^"]+)"/)?.[1] ?? ""
    expect(clase).toContain("rounded-tarjeta"); expect(clase).toContain("bg-grafito-2"); expect(clase).toContain("text-center")
    expect(clase).not.toMatch(/aspect-|shadow|white\/|amber-/)
    expect(c).toContain('<ul className="grid grid-cols-3 gap-3"')
  })
  it("🔴 el punto de aviso solo existe cuando hay aviso, y es oro", () => {
    expect(c).toContain("{d.aviso && <span data-punto-aviso")
    expect(c).toMatch(/data-punto-aviso[^>]*bg-oro/)
  })
  it("🔴 usa el panel base y el revisor de estilo lo vigila entero", () => {
    expect(c).toContain('<PanelBase titulo="Centro de campaña"')
    expect(readFileSync("scripts/revisar-estilo.mjs", "utf8")).toContain('"components/nuevo/PanelAplicaciones.tsx"')
  })
})
