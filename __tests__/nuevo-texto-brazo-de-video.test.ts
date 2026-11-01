import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { tipoDeEsperaLegible } from "@/lib/plan"

describe("el brazo de video EXISTE: ningún texto del plan o del pizarrón dice que no está construido", () => {
  it("la espera de video dice su turno, no «aún no construido»", () => {
    expect(tipoDeEsperaLegible("espera_video")).toBe("publicaciones que esperan su turno en el brazo de video")
  })
  it.each(["lib/plan.ts", "lib/pizarron.ts", "components/nuevo/PanelPlan.tsx"])("%s no afirma que el brazo no está construido", (f) => {
    const t = readFileSync(f, "utf8")
    expect(t).not.toMatch(/a[uú]n no construid/i)
    expect(t).not.toMatch(/sin un brazo que la hiciera/i)
  })
})
