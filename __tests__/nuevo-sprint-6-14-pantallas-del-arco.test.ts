/**
 * DASHBOARD NUEVO · SPRINT 6.14 (Emilio, 1-nov): «cada pantalla … una animación sutil y minimalista; no todo naranja: la variedad de la paleta de los naranjas,
 * para dar a entender que cada una muestra algo diferente». Corrección 6.14b (Emilio, 1-nov): «no te dije que asignaras uso a cada pantalla: quita eso»;
 * «la paleta está toda en el mismo tono; las animaciones deben ser sutiles, futurísticas».
 *  · lógica pura: 10 pantallas medidas en la foto; 6 encendidas, cada una con un matiz de naranja CLARAMENTE distinto y una animación distinta; 4 apagadas sin nada.
 *  · dentro de tu oficina: solo decoración (sin botones, sin rótulos, sin clics, sin lecturas, sin centros).
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { PANTALLAS_DEL_ARCO, PANTALLAS_VIVAS, cajaDeLaForma, matizDe, matizYSaturacion } from "@/lib/pantallas-de-la-oficina"
import { PantallasDelArco } from "@/components/nuevo/PantallasDelArco"
import { EscenaViva } from "@/components/nuevo/EscenaViva"

describe("6.14 · las pantallas del arco (lógica pura)", () => {
  it("10 pantallas de izquierda a derecha dentro del arco de la foto; 6 encendidas con tono y animación; 4 apagadas sin nada; ningún «uso» asignado", () => {
    expect(PANTALLAS_DEL_ARCO.map((p) => p.indice)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(PANTALLAS_VIVAS.map((p) => p.indice)).toEqual([1, 3, 4, 7, 9, 10])
    expect(PANTALLAS_DEL_ARCO.every((p) => p.encendida === (p.tono !== null && p.animacion !== null))).toBe(true)
    let xAnterior = 0
    for (const p of PANTALLAS_DEL_ARCO) {
      const c = cajaDeLaForma(p.forma)
      expect(c.x).toBeGreaterThan(xAnterior); xAnterior = c.x // de izquierda a derecha, sin solaparse
      expect(c.x).toBeGreaterThan(900); expect(c.x + c.w).toBeLessThan(1680); expect(c.y).toBeGreaterThan(246); expect(c.y + c.h).toBeLessThan(480)
      expect(c.h).toBeGreaterThan(c.w) // pantallas verticales
      expect(Object.keys(p).sort()).toEqual(["animacion", "encendida", "forma", "indice", "nombreDelTono", "tono"]) // sin centro, sin ruta, sin rótulo
    }
  })
  it("los 6 tonos son naranjas CLARAMENTE distintos (matices separados ≥ 5° entre vecinos, del dorado a la teja) y las 6 animaciones son distintas", () => {
    const tonos = PANTALLAS_VIVAS.map((p) => p.tono), animaciones = PANTALLAS_VIVAS.map((p) => p.animacion)
    expect(new Set(tonos).size).toBe(6); expect(new Set(animaciones).size).toBe(6)
    const matices = tonos.map(matizDe).sort((a, b) => a - b)
    for (const m of matices) { expect(m).toBeGreaterThanOrEqual(8); expect(m).toBeLessThanOrEqual(48) } // familia de los naranjas: nada rojo, nada amarillo limón
    expect(matices[matices.length - 1] - matices[0]).toBeGreaterThanOrEqual(25) // recorrido amplio, no «todo el mismo tono»
    for (let i = 1; i < matices.length; i++) expect(matices[i] - matices[i - 1]).toBeGreaterThanOrEqual(5) // y vecinos que se distinguen
    expect(matizYSaturacion("#c9a06b").saturacion).toBeLessThan(0.5); expect(matizYSaturacion("#ff9a2e").saturacion).toBe(1) // (la función: un tono apagado y uno pleno)
    expect(PANTALLAS_VIVAS.find((p) => p.indice === 4)!.tono).toBe("#e8731a") // la del centro, el naranja de la marca
    expect(matizDe("#e8731a")).toBeCloseTo(25.7, 0); expect(matizDe("#00ff00")).toBe(120)
  })
})

describe("6.14 · el arco dentro de tu oficina", () => {
  it("solo decoración: un grupo por pantalla encendida con su tinte (mezcla «matiz»), su sombra y su animación; sin botones, rótulos, clics ni lecturas", () => {
    const html = renderToStaticMarkup(createElement(PantallasDelArco))
    const grupos = [...html.matchAll(/<g class="nv-arco" data-pantalla="(\d+)" data-animacion="([a-z]+)" data-tono="([^"]+)" style="--tono:(#[0-9a-f]{6})" clip-path="url\(#nv-arco-\1\)">/g)]
    expect(grupos.map((g) => Number(g[1]))).toEqual([1, 3, 4, 7, 9, 10])
    expect(grupos.map((g) => g[2])).toEqual(["columnas", "orbita", "radar", "pulso", "escaner", "malla"])
    expect(new Set(grupos.map((g) => g[4])).size).toBe(6)
    expect(html).toContain('<svg viewBox="0 0 2560 1440" class="nv-tintes pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true"') // el tinte en su propio svg: la mezcla actúa contra la foto
    expect(html).toContain('<svg viewBox="0 0 2560 1440" class="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true"')
    expect(html).not.toMatch(/role="button"|tabindex|aria-label|<text|nv-rotulo|aria-haspopup/) // nada que tocar, nada escrito
    expect(html).toContain(".nv-tintes{mix-blend-mode:hue;opacity:.92}"); expect(html).toContain(".nv-sombras{mix-blend-mode:multiply;opacity:.22}") // la luz de la foto se conserva: solo cambia el matiz
    expect((html.match(/class="nv-tinte"/g) ?? []).length).toBe(6)
    // movimiento: columnas (CSS), órbita y radar (giro SMIL), pulso (trazo que corre), escáner (línea que baja), malla (onda); y todo quieto con «menos movimiento»
    expect(html).toMatch(/data-anima="columna"/); expect(html).toMatch(/data-anima="corre"/); expect(html).toMatch(/data-anima="escanea"/); expect(html).toMatch(/data-anima="onda"/); expect(html).toMatch(/data-anima="respira"/)
    expect((html.match(/<animateTransform attributeName="transform" type="rotate"/g) ?? []).length).toBe(3) // 2 satélites + 1 barrido del radar
    expect(html).toContain("@media (prefers-reduced-motion:reduce){.nv-arco .nv-hud [data-anima]{animation:none}}")
    // líneas finas (interfaz, no manchas): el grosor base es un 14 % de la unidad
    expect(readFileSync("components/nuevo/PantallasDelArco.tsx", "utf8")).toContain("fino = u * 0.14")
  })
  it("no lee nada, no abre nada, no enlaza nada", () => {
    const c = readFileSync("components/nuevo/PantallasDelArco.tsx", "utf8")
    expect(c).not.toMatch(/fetch\(|createPortal|Panel[A-Z]|href=|onClick|router|supabase|process\.env/)
    expect(c).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")')
  })
  it("vive solo dentro de TU OFICINA (no en marketing ni en la sala)", () => {
    expect(renderToStaticMarkup(createElement(EscenaViva, { inicial: "oficina" }))).toContain('data-animacion="radar"')
    expect(renderToStaticMarkup(createElement(EscenaViva, { inicial: "marketing" }))).not.toContain("data-animacion=")
    expect(renderToStaticMarkup(createElement(EscenaViva, { inicial: false }))).not.toContain("data-animacion=")
    expect(readFileSync("components/nuevo/EscenaViva.tsx", "utf8")).toContain('{depto === "oficina" && <PantallasDelArco />}')
  })
})
