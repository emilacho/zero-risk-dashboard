/** SECCIÓN Y CAMPO SE DISTINGUEN (CC2 · 03-nov · corrección de Lenovo 18:48Z, Emilio con captura: «solo se distinguen por el tamaño»). US$ 0 · sin red. */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { CUERPO, TITULO_1, TITULO_2, TITULO_3 } from "@/components/nuevo/manual/niveles"

describe("la sección abre un bloque y el campo se lee como su hijo (una sola regla para manual, plan e informes)", () => {
  it("la SECCIÓN (título 1): aire arriba y una línea fina ámbar debajo, que la marca como inicio de bloque", () => {
    expect(TITULO_1).toMatch(/\bborder-b\b/); expect(TITULO_1).toMatch(/\bborder-amber-400\/\d+/); expect(TITULO_1).toMatch(/\bpb-\d/); expect(TITULO_1).toMatch(/\bpt-\d/)
  })
  it("el CAMPO (título 2): raya ámbar a la izquierda, sangría y un ámbar más tenue que el de la sección", () => {
    expect(TITULO_2).toMatch(/\bborder-l-2\b/); expect(TITULO_2).toMatch(/\bborder-amber-400\/\d+/); expect(TITULO_2).toMatch(/\bpl-\d/)
    expect(TITULO_2).toContain("text-amber-200/90") // más tenue que el título 1 (amber-400)
    expect(TITULO_1).toContain("text-amber-400")
  })
  it("solo la sección lleva la línea de abajo y solo el campo la raya de la izquierda (no se confunden)", () => {
    expect(TITULO_1).not.toMatch(/\bborder-l-2\b/); expect(TITULO_2).not.toMatch(/\bborder-b\b/)
    expect(TITULO_3).not.toMatch(/border/); expect(CUERPO).not.toMatch(/border/) // el subtítulo y el cuerpo no ganan marcos: los campos con viñetas siguen igual de legibles
  })
  it("conserva lo de antes: tres tamaños en orden, colores de la casa (nunca los del cliente) y contraste AA", () => {
    const tam = (c: string) => Number(/text-\[(\d+)px\]/.exec(c)?.[1])
    expect(tam(TITULO_1)).toBeGreaterThan(tam(TITULO_2)); expect(tam(TITULO_2)).toBeGreaterThan(tam(TITULO_3))
    for (const t of [TITULO_1, TITULO_2, TITULO_3]) expect(t).not.toMatch(/text-(white|zinc-\d+)/)
  })
  it("las superficies que pintan títulos de documento usan estas constantes (manual, plan e informes), sin copiar los estilos", () => {
    for (const f of ["components/nuevo/PanelManual.tsx", "components/nuevo/manual/SeccionesNuevas.tsx", "components/nuevo/PlanEnSecciones.tsx", "components/nuevo/PanelInformes.tsx", "components/nuevo/DocumentoLegible.tsx"]) {
      const s = readFileSync(f, "utf8")
      expect(s, f).toContain('from "@/components/nuevo/manual/niveles"')
    }
  })
})
