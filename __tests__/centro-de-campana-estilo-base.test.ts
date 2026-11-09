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
    expect(clase).toContain("rounded-tarjeta"); expect(clase).toContain("bg-tarjeta-escena") /* 09-nov · sin panel de fondo: el color de hoy */; expect(clase).toContain("text-center")
    expect(clase).not.toMatch(/aspect-|shadow|white\/|amber-/)
    expect(c).toContain('<ul className="grid grid-cols-3 gap-3"')
  })
  it("🔴 09-nov (boceto aprobado): el punto vive junto al estado y su color sale del tono (oro · alarma · gris); el punto de la esquina y el número de paso se fueron", () => {
    expect(c).not.toContain("data-punto-aviso"); expect(c).not.toContain("data-paso=")
    expect(c).toContain('const PUNTO_DEL_TONO: Record<TonoDeEstado, string> = { oro: "bg-oro", alarma: "bg-alarma", gris: "bg-gris" }')
    expect(c).toContain("PUNTO_DEL_TONO[t.tono]")
  })
  it("🔴 usa el panel base y el revisor de estilo lo vigila entero", () => {
    expect(c).toContain('<PanelBase titulo="Centro de campaña"')
    expect(readFileSync("scripts/revisar-estilo.mjs", "utf8")).toContain('"components/nuevo/PanelAplicaciones.tsx"')
  })
})
