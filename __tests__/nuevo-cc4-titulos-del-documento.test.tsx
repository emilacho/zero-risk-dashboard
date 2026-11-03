import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { TITULO_1, TITULO_2, TITULO_3, CUERPO } from "@/components/nuevo/manual/niveles"
import { DocumentoLegible } from "@/components/nuevo/DocumentoLegible"

const FONDO = [15, 13, 11] // #0f0d0b, el fondo de los paneles
const lum = ([r, g, b]: number[]) => { const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
const contraste = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const mezcla = (c: number[], alfa: number) => c.map((v, i) => Math.round(v * alfa + FONDO[i] * (1 - alfa)))

describe("CC4 · títulos 1, 2 y 3 del documento · una sola regla (corrección de Emilio 03-nov 16:40Z)", () => {
  it("cada nivel tiene su color: ámbar fuerte, ámbar suave y ámbar tenue en negrita; ninguno es el blanco del texto", () => {
    expect(TITULO_1).toContain("text-amber-400"); expect(TITULO_2).toContain("text-amber-200"); expect(TITULO_3).toContain("text-amber-100/85"); expect(TITULO_3).toContain("font-bold")
    for (const t of [TITULO_1, TITULO_2, TITULO_3]) expect(t).not.toMatch(/text-(white|zinc-\d+)/)
    expect(CUERPO).toContain("text-zinc-200")
    const tam = (c: string) => Number(/text-\[(\d+)px\]/.exec(c)![1])
    expect(tam(TITULO_1)).toBeGreaterThan(tam(TITULO_2)); expect(tam(TITULO_2)).toBeGreaterThan(tam(TITULO_3))
  })
  it("contraste AA (≥ 4,5) de los tres sobre el fondo oscuro", () => {
    expect(contraste([251, 191, 36], FONDO)).toBeGreaterThanOrEqual(4.5)
    expect(contraste([253, 230, 138], FONDO)).toBeGreaterThanOrEqual(4.5)
    expect(contraste(mezcla([254, 243, 199], 0.85), FONDO)).toBeGreaterThanOrEqual(4.5)
  })
  it("un documento con # ## ### pinta los tres niveles con la regla, y el cuerpo queda como está", () => {
    const h = renderToStaticMarkup(createElement(DocumentoLegible, { texto: "# Uno\n\n## Dos\n\n### Tres\n\nTexto normal." }))
    expect(h).toMatch(/data-titulo="1"[^>]*class="[^"]*text-amber-400/); expect(h).toMatch(/data-titulo="2"[^>]*class="[^"]*text-amber-200/); expect(h).toMatch(/data-titulo="3"[^>]*class="[^"]*text-amber-100\/85/)
    expect(h).toContain(">Texto normal.</p>")
  })
  it("el documento no repite colores de títulos: usa las constantes de niveles.ts (una regla, no un arreglo por panel)", () => {
    const f = readFileSync("components/nuevo/DocumentoLegible.tsx", "utf8")
    expect(f).toContain("manual/niveles"); expect(f).not.toMatch(/h[1-4]: .*text-zinc-(50|100|200)/)
    for (const p of ["components/nuevo/PanelManual.tsx", "components/nuevo/manual/SeccionesNuevas.tsx"]) expect(readFileSync(p, "utf8")).toContain("manual/niveles")
  })
})
