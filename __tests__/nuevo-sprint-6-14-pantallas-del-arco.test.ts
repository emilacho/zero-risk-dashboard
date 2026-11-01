/**
 * DASHBOARD NUEVO · SPRINT 6.14 (Emilio, 1-nov): «cada pantalla … una animación sutil y minimalista; no todo naranja: la variedad de la paleta de los naranjas,
 * para dar a entender que cada una muestra algo diferente». Correcciones (Emilio, 1-nov): 6.14b «no te dije que asignaras uso a cada pantalla: quita eso»;
 * «la paleta está toda en el mismo tono; las animaciones deben ser sutiles, futurísticas» · 6.15 «haz lo mismo con las pequeñas pantallas encima del escritorio;
 * reduce el tamaño de las letras que dicen música en 70 %; las animaciones se pierden porque las hiciste del mismo color: piénsalo como un centro de control futurístico».
 *  · lógica pura: 10 pantallas del arco (6 encendidas) + 5 del escritorio; cada encendida con un matiz de naranja distinto y una animación distinta; sin «usos».
 *  · dentro de tu oficina: solo decoración (sin botones, rótulos, clics, lecturas ni centros); líneas en un color CLARO distinto del tinte.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { ESCRITORIO_VIVO, GRUPOS_DE_PANTALLAS, LUZ_DE_LA_INTERFAZ, PANTALLAS_DEL_ARCO, PANTALLAS_DEL_ESCRITORIO, PANTALLAS_VIVAS, cajaDeLaForma, matizDe, matizYSaturacion } from "@/lib/pantallas-de-la-oficina"
import { PANTALLA_MUSICA } from "@/lib/musica"
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
  it("los 6 tonos del arco son naranjas CLARAMENTE distintos (matices separados ≥ 5° entre vecinos, del dorado a la teja) y las 6 animaciones son distintas", () => {
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

describe("6.15 · las 5 pantallas chicas del escritorio (lógica pura)", () => {
  it("5 pantallas sobre la consola, de izquierda a derecha, apaisadas, todas encendidas; la 2 es la de música (misma forma); 5 animaciones propias, distintas de las del arco", () => {
    expect(PANTALLAS_DEL_ESCRITORIO.map((p) => p.indice)).toEqual([1, 2, 3, 4, 5]); expect(ESCRITORIO_VIVO.length).toBe(5)
    let xAnterior = 0
    for (const p of PANTALLAS_DEL_ESCRITORIO) {
      const c = cajaDeLaForma(p.forma)
      expect(c.x).toBeGreaterThan(xAnterior); xAnterior = c.x + c.w // sin solaparse
      expect(c.y).toBeGreaterThan(420); expect(c.y + c.h).toBeLessThan(500); expect(c.x).toBeGreaterThan(1050); expect(c.x + c.w).toBeLessThan(1500) // sobre la consola
      expect(c.w).toBeGreaterThan(c.h) // apaisadas
    }
    expect(PANTALLAS_DEL_ESCRITORIO[1].forma).toBe(PANTALLA_MUSICA.forma); expect(PANTALLAS_DEL_ESCRITORIO[1].animacion).toBe("espectro")
    const delArco = new Set(PANTALLAS_VIVAS.map((p) => p.animacion))
    for (const p of ESCRITORIO_VIVO) expect(delArco.has(p.animacion)).toBe(false)
    expect(new Set(ESCRITORIO_VIVO.map((p) => p.animacion)).size).toBe(5)
  })
  it("sus 5 tonos son naranjas distintos entre sí (≥ 5° entre vecinos) y repartidos por la familia", () => {
    const escritorio = ESCRITORIO_VIVO.map((p) => matizDe(p.tono)), arco = PANTALLAS_VIVAS.map((p) => matizDe(p.tono))
    for (const m of escritorio) { expect(m).toBeGreaterThanOrEqual(8); expect(m).toBeLessThanOrEqual(48) }
    const orden = [...escritorio].sort((a, b) => a - b)
    for (let i = 1; i < orden.length; i++) expect(orden[i] - orden[i - 1]).toBeGreaterThanOrEqual(5)
    expect(orden[orden.length - 1] - orden[0]).toBeGreaterThanOrEqual(25)
    expect(new Set([...escritorio, ...arco].map((m) => m.toFixed(1))).size).toBe(11) // ninguno repite exactamente uno del arco
    expect(GRUPOS_DE_PANTALLAS.map((g) => g.grupo)).toEqual(["arco", "escritorio"])
  })
})

describe("6.14/6.15 · las pantallas dentro de tu oficina", () => {
  it("solo decoración: 11 grupos (6 del arco + 5 del escritorio) con tinte (mezcla «matiz»), sombra e interfaz en color CLARO; sin botones, rótulos, clics ni lecturas", () => {
    const html = renderToStaticMarkup(createElement(PantallasDelArco))
    const grupos = [...html.matchAll(/<g class="nv-pantalla" data-grupo="(arco|escritorio)" data-pantalla="(\d+)" data-animacion="([a-z]+)" data-tono="([^"]+)" style="--tono:(#[0-9a-f]{6})" clip-path="url\(#nv-pantalla-\1-\2\)">/g)]
    expect(grupos.filter((g) => g[1] === "arco").map((g) => Number(g[2]))).toEqual([1, 3, 4, 7, 9, 10])
    expect(grupos.filter((g) => g[1] === "escritorio").map((g) => [Number(g[2]), g[3]])).toEqual([[1, "telemetria"], [2, "espectro"], [3, "reticula"], [4, "anillo"], [5, "cadena"]])
    expect(new Set(grupos.map((g) => g[5])).size).toBe(11)
    expect(html).toContain('<svg viewBox="0 0 2560 1440" class="nv-tintes pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true"') // el tinte en su propio svg: la mezcla actúa contra la foto
    expect(html).toContain('<svg viewBox="0 0 2560 1440" class="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true"')
    expect(html).not.toMatch(/role="button"|tabindex|aria-label|<text|nv-rotulo|aria-haspopup/) // nada que tocar, nada escrito
    expect(html).toContain(".nv-tintes{mix-blend-mode:hue;opacity:.92}"); expect(html).toContain(".nv-sombras{mix-blend-mode:multiply;opacity:.34}") // la luz de la foto se conserva: solo cambia el matiz
    expect((html.match(/class="nv-tinte"/g) ?? []).length).toBe(11); expect((html.match(/class="nv-sombra"/g) ?? []).length).toBe(11)
    // 6.15 · las líneas NO van en el tono del vidrio: van en una luz clara, con el tono solo como resplandor
    expect(LUZ_DE_LA_INTERFAZ).toBe("#fff3e2"); expect(matizYSaturacion(LUZ_DE_LA_INTERFAZ).saturacion).toBeGreaterThan(0.5) // cálida…
    expect(html).toContain(`.nv-pantalla .nv-hud{color:${LUZ_DE_LA_INTERFAZ};filter:drop-shadow(0 0 1.2px var(--tono)) drop-shadow(0 0 3px var(--tono))}`)
    expect(html).not.toMatch(/\.nv-hud\{color:var\(--tono\)/)
    // movimiento: CSS (columnas, pulso, escáner, malla, telemetría, retícula, cadena) + giros SMIL (órbita ×2, radar, anillo); todo quieto con «menos movimiento»
    for (const a of ["columna", "corre", "escanea", "onda", "respira", "teclea", "barre", "desfila"]) expect(html).toContain(`data-anima="${a}"`)
    expect((html.match(/<animateTransform attributeName="transform" type="rotate"/g) ?? []).length).toBe(4)
    expect(html).toContain("@media (prefers-reduced-motion:reduce){.nv-pantalla .nv-hud [data-anima]{animation:none}}")
    expect(readFileSync("components/nuevo/PantallasDelArco.tsx", "utf8")).toContain("fino = u * 0.14") // líneas finas (interfaz, no manchas)
  })
  it("no lee nada, no abre nada, no enlaza nada", () => {
    const c = readFileSync("components/nuevo/PantallasDelArco.tsx", "utf8")
    expect(c).not.toMatch(/fetch\(|createPortal|Panel[A-Z]|href=|onClick|router|supabase|process\.env/)
    expect(c).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")')
  })
  it("vive solo dentro de TU OFICINA (no en marketing ni en la sala); el rótulo «MÚSICA» quedó al 30 % (6.15) y pegado a su pantalla", () => {
    const oficina = renderToStaticMarkup(createElement(EscenaViva, { inicial: "oficina" }))
    expect(oficina).toContain('data-animacion="radar"'); expect(oficina).toContain('data-grupo="escritorio" data-pantalla="2" data-animacion="espectro"')
    expect(renderToStaticMarkup(createElement(EscenaViva, { inicial: "marketing" }))).not.toContain("data-animacion=")
    expect(renderToStaticMarkup(createElement(EscenaViva, { inicial: false }))).not.toContain("data-animacion=")
    expect(readFileSync("components/nuevo/EscenaViva.tsx", "utf8")).toContain('{depto === "oficina" && <PantallasDelArco />}')
    const rotulo = oficina.match(/<text class="nv-rotulo"[^>]*>MÚSICA<\/text>/)![0]
    expect(Number(rotulo.match(/font-size="([\d.]+)"/)![1])).toBe(10) // 32 × 0,3 ≈ 10
    expect(PANTALLA_MUSICA.rotulo.y).toBeGreaterThan(428); expect(PANTALLA_MUSICA.rotulo.y).toBeLessThan(440) // justo encima del borde superior (440)
  })
})
