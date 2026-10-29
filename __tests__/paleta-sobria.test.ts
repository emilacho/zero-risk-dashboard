/** La paleta sobria (ADENDA 2): fondo gris carbón, sin brillos ni animaciones, estados apagados. US$ 0. */
import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

const css = fs.readFileSync(path.join(__dirname, "..", "app", "globals.css"), "utf8")
const dark = css.slice(css.indexOf("  .dark {"), css.indexOf("html { color-scheme: dark; }"))
const token = (n: string): number[] => {
  const m = new RegExp(`--${n}:\\s*(\\d+) (\\d+)% (\\d+)%`).exec(dark)
  if (!m) throw new Error(`falta el color ${n}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

describe("paleta sobria", () => {
  it("el fondo oscuro es gris carbón (poca saturación, no violeta) y el acento no es neón", () => {
    const [h, s] = token("background")
    expect(s).toBeLessThanOrEqual(10)
    expect(h < 250 || h > 290).toBe(true)
    for (const t of ["primary", "accent", "success", "danger"]) expect(token(t)[1], t).toBeLessThanOrEqual(60)
  })
  it("la capa final apaga animaciones, brillos y desenfoque, y deja visibles los bloques que aparecían al desplazar", () => {
    const fin = css.slice(css.indexOf("PALETA SOBRIA"))
    expect(fin).toMatch(/animation: none !important/)
    expect(fin).toMatch(/box-shadow: none !important/)
    expect(fin).toMatch(/backdrop-filter: none !important/)
    expect(fin).toMatch(/\.reveal-on-scroll[^}]*opacity: 1 !important/)
  })
  it("los colores de estado de Tailwind quedan apagados (croma bajo)", () => {
    for (const f of ["emerald", "amber", "rose"]) {
      const m = new RegExp(`--color-${f}-400: oklch\\(([\\d.]+) ([\\d.]+) `).exec(css)
      expect(m, f).not.toBeNull()
      expect(Number(m![2]), f).toBeLessThanOrEqual(0.1)
    }
  })
})
