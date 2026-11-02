/**
 * DASHBOARD NUEVO · SPRINT 6.31 (2-nov · Emilio: «cuando entro a ese panel se demora mucho en cargar y empezar la animación»).
 * El radar se dibuja y gira al instante; abre con la última lectura de la oficina y se refresca en silencio; el giro va por CSS y los puntos sin filtro de desenfoque.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const panel = readFileSync("components/nuevo/PanelRiesgos.tsx", "utf8")
const escena = readFileSync("components/nuevo/EscenaViva.tsx", "utf8")

describe("6.31 · el radar abre y gira al instante", () => {
  it("el radar se dibuja siempre, sin esperar la lectura", () => {
    expect(panel).not.toContain("{datos && <Radar")
    // 6.52 · el radar ya no lleva cuentas (salen una vez, en los botones de los sectores); los botones esperan la lectura con «…»
    expect(panel).toContain('!datos ? "…" : del.length')
  })
  it("el haz gira con CSS (tarjeta gráfica), no con SMIL; se queda quieto con movimiento reducido", () => {
    expect(panel).not.toContain("<animateTransform")
    expect(panel).toContain("@keyframes riGira")
    expect(panel).toMatch(/\.ri-eco,\.ri-ficha,\.ri-haz\{animation:none\}/)
  })
  it("los puntos llevan un halo barato en vez del filtro de desenfoque", () => {
    expect(panel).not.toMatch(/className="ri-punto"[^>]*filter=/)
    expect(panel).toContain('className="ri-halo"')
  })
  it("la oficina le pasa su última lectura y el panel igual se refresca al abrir", () => {
    expect(escena).toContain("datosIniciales={riesgosCrudos}")
    expect(panel).toContain("useEffect(() => { void leer() }, [leer])")
  })
})
