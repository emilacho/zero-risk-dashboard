/** Lumen con el neón bajado (D7, ADENDA 3): colores de categoría, dos niveles de neón y nada de animaciones de escaneo. US$ 0. */
import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

const css = fs.readFileSync(path.join(__dirname, "..", "app", "globals.css"), "utf8")
const dark = css.slice(css.indexOf("  .dark {"), css.indexOf("html { color-scheme: dark; }"))

describe("Lumen con el neón bajado", () => {
  it("una sola perilla de neón: A = 0,5 y B = 0,3 (más sobrio)", () => {
    expect(dark).toMatch(/--neon:\s*0\.5/)
    expect(dark).toMatch(/data-neon="b"[^}]*--neon:\s*0\.3/)
  })
  it("las diez categorías de Lumen siguen y su saturación depende de la perilla (no están fijas)", () => {
    for (const h of ["violet", "cyan", "amber", "emerald", "rose", "orange", "purple", "teal", "sky", "lime"]) expect(dark, h).toMatch(new RegExp("--hue-" + h + ":[^;]*var\\(--neon\\)"))
  })
  it("fondo con leve tinte violeta (no gris muerto)", () => {
    expect(dark).toMatch(/--background:\s*264 calc\(/)
  })
  it("sin respiración ni escaneo; al pasar el cursor solo un borde de color suave", () => {
    expect(css).toMatch(/\.animate-breathing[^}]*animation: none !important/)
    expect(css).toMatch(/\.animate-scanning[^}]*animation: none !important/)
    expect(css).toMatch(/\.surface-card:hover \{ border-color: hsl\(var\(--hue\) \/ 0\.45\); \}/)
    expect(css).not.toMatch(/\.surface-card, \.rim-instr[^}]*box-shadow: none !important/)
  })
  it("los colores de estado de Tailwind siguen a la perilla de neón", () => {
    const m = /--color-emerald-400: oklch\(([\d.]+) calc\([^)]*var\(--neon[^)]*\)[^)]*\) /.exec(css)
    expect(m).not.toBeNull()
  })
})
