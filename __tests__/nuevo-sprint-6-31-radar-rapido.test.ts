/**
 * DASHBOARD NUEVO · SPRINT 6.31 (2-nov · Emilio: «cuando entro a ese panel se demora mucho en cargar y empezar la animación»).
 * El radar se dibuja y gira al instante; abre con la última lectura de la oficina y se refresca en silencio; el giro va por CSS y los puntos sin filtro de desenfoque.
 * 06-nov · el radar vuelve a la columna izquierda del panel (Emilio: «el radar a la izquierda, y lo nuevo reemplaza lo de la derecha»).
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const panel = readFileSync("components/nuevo/PanelRiesgos.tsx", "utf8")
const escena = readFileSync("components/nuevo/EscenaViva.tsx", "utf8")

describe("6.31 · el radar abre y gira al instante", () => {
  it("el radar se dibuja siempre, sin esperar la lectura; los recuadros esperan con «…»", () => {
    expect(panel).not.toContain("{datos && <Radar"); expect(panel).not.toContain("{datos && <ColumnaDelRadar")
    expect(panel).toContain('!cargado ? "…" : del.length')
    expect(panel).toContain('const n = (x: number) => (!datos ? "…" : x)')
  })
  it("el haz gira con CSS, no con SMIL; se queda quieto con movimiento reducido", () => {
    expect(panel).not.toContain("<animateTransform")
    expect(panel).toContain("@keyframes riGira")
    expect(panel).toMatch(/\.ri-eco,\.ri-haz\{animation:none\}/)
  })
  it("los puntos llevan un halo barato en vez del filtro de desenfoque", () => {
    expect(panel).not.toMatch(/filter=/)
    expect(panel).toContain("ri-halo")
  })
  it("la oficina le pasa su última lectura y el panel igual se refresca al abrir", () => {
    expect(escena).toContain("datosIniciales={riesgosCrudos}")
    expect(panel).toContain("useEffect(() => { void leer() }, [leer])")
  })
})
