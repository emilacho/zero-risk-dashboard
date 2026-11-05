/**
 * DASHBOARD NUEVO · SPRINT 6.31 (2-nov · Emilio: «cuando entro a ese panel se demora mucho en cargar y empezar la animación»).
 * El radar se dibuja y gira al instante; abre con la última lectura de la oficina y se refresca en silencio; el giro va por CSS y los puntos sin filtro de desenfoque.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const panel = readFileSync("components/nuevo/PanelRiesgos.tsx", "utf8")
const escena = readFileSync("components/nuevo/EscenaViva.tsx", "utf8")

// estilo base (05-nov): el panel ya no lleva radar (sigue en la pantalla 6 de la escena); se conserva lo de abrir al instante
describe("6.31 · el panel de Riesgos abre al instante", () => {
  it("se dibuja siempre, sin esperar la lectura: los recuadros esperan con «…»", () => {
    expect(panel).toContain('const n = (x: number) => (datos ? x : "…")')
  })
  it("sin animaciones ni filtros de desenfoque que demoren el primer cuadro", () => {
    expect(panel).not.toMatch(/@keyframes|<animateTransform|filter=/)
  })
  it("la oficina le pasa su última lectura y el panel igual se refresca al abrir", () => {
    expect(escena).toContain("datosIniciales={riesgosCrudos}")
    expect(panel).toContain("useEffect(() => { void leer() }, [leer])")
  })
})
