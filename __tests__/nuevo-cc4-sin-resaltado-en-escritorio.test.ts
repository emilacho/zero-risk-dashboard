import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

describe("02-nov · al pasar el cursor por un escritorio no se pinta nada encima", () => {
  it("la zona del escritorio sigue recibiendo el ratón (relleno transparente) pero ya no tiene relleno naranja al pasar el cursor, enfocar ni abrir", () => {
    const f = readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")
    expect(f).toContain(".nv-av .nv-av-zona polygon{fill:rgba(0,0,0,0);stroke:none}")
    expect(f).not.toMatch(/nv-av-zona:hover polygon|nv-av-zona:focus-visible polygon|aria-expanded="true"\] polygon/)
    expect(f).not.toContain("rgba(255,140,40,.06)")
  })
  it("sigue apareciendo el rótulo del equipo con su estado al pasar el cursor", () => {
    const f = readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")
    expect(f).toMatch(/\.nv-av-zona:hover \.nv-av-rotulo[^}]*opacity:1/)
  })
})
