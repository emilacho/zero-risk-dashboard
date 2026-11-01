/**
 * DASHBOARD NUEVO · SPRINT 6.14 (Emilio, 1-nov): «cada pantalla … una animación sutil y minimalista; no todo naranja: la variedad de la paleta de los naranjas,
 * para dar a entender que cada una muestra algo diferente». Correcciones (Emilio, 1-nov): 6.14b «no te dije que asignaras uso a cada pantalla: quita eso»;
 * «la paleta está toda en el mismo tono; las animaciones deben ser sutiles, futurísticas» · 6.15 «haz lo mismo con las pequeñas pantallas encima del escritorio;
 * reduce el tamaño de las letras que dicen música en 70 %; las animaciones se pierden porque las hiciste del mismo color: piénsalo como un centro de control futurístico»
 *  · 6.16 «las animaciones no me gustan: una es un átomo, otra un radar, otra un pulso cardíaco, otra un nivel de volumen; las del escritorio están mal ajustadas de tamaño;
 *    debe ser tema tecnología del futuro mezclado con empresa; primero la parte visual, después decidiremos qué función tiene cada una; bibliotecas gratuitas de animación».
 *  · lógica pura: 10 pantallas del arco (6 encendidas) + 5 del escritorio; cada encendida con un matiz de naranja distinto y una animación distinta; sin «usos».
 *  · dentro de tu oficina: solo decoración (sin botones, rótulos, clics, lecturas ni centros); líneas en un color CLARO distinto del tinte.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { ESCRITORIO_VIVO, GRUPOS_DE_PANTALLAS, LUZ_DE_LA_INTERFAZ, PANTALLAS_DEL_ARCO, PANTALLAS_DEL_ESCRITORIO, PANTALLAS_VIVAS, alaFoto, cajaDeLaForma, lienzoDeLaForma, lienzoDelMarco, marcoDeLaForma, matizDe, matizYSaturacion } from "@/lib/pantallas-de-la-oficina"
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
  it("los 6 tonos del arco son naranjas CLARAMENTE distintos (matices separados ≥ 5° entre vecinos, del dorado a la teja) y las 6 animaciones son tableros de empresa distintos (6.16)", () => {
    const tonos = PANTALLAS_VIVAS.map((p) => p.tono), animaciones = PANTALLAS_VIVAS.map((p) => p.animacion)
    expect(new Set(tonos).size).toBe(6); expect(animaciones).toEqual(["ventas", "red", "indicadores", "crecimiento", "embudo", "mapa"]) // 6.16: ni átomo, ni radar, ni pulso cardíaco, ni volumen
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
    expect(PANTALLAS_DEL_ESCRITORIO[1].forma).toBe(PANTALLA_MUSICA.forma); expect(PANTALLAS_DEL_ESCRITORIO[1].animacion).toBe("pista") // la de música: una pista de reproducción
    expect(ESCRITORIO_VIVO.map((p) => p.animacion)).toEqual(["cotizaciones", "pista", "agenda", "participacion", "tareas"]) // 6.16
    const delArco = new Set(PANTALLAS_VIVAS.map((p) => p.animacion))
    for (const p of ESCRITORIO_VIVO) expect(delArco.has(p.animacion)).toBe(false)
    // 6.16 · «las del escritorio están mal ajustadas de tamaño»: cada dibujo se encaja en el LIENZO de su vidrio (10 % de margen a los lados, 12 % arriba/abajo), apaisado
    for (const p of [...PANTALLAS_DEL_ESCRITORIO, ...PANTALLAS_VIVAS]) {
      const c = cajaDeLaForma(p.forma), l = lienzoDeLaForma(p.forma)
      expect(l.x).toBeCloseTo(c.x + c.w * 0.1, 5); expect(l.w).toBeCloseTo(c.w * 0.8, 5); expect(l.y).toBeCloseTo(c.y + c.h * 0.12, 5); expect(l.h).toBeCloseTo(c.h * 0.76, 5)
      expect(l.cx).toBe(c.cx); expect(l.cy).toBe(c.cy)
    }
    // 6.16b · «casi todos están descuadrados»: el dibujo va en el plano propio del vidrio y una matriz lo lleva a la perspectiva de la foto
    const dentro = (pt: [number, number], q: Array<[number, number]>) => q.every((a, i) => { const b = q[(i + 1) % 4]; return (b[0] - a[0]) * (pt[1] - a[1]) - (b[1] - a[1]) * (pt[0] - a[0]) >= 0 })
    for (const p of [...PANTALLAS_DEL_ESCRITORIO, ...PANTALLAS_VIVAS]) {
      const q = p.forma.split(" ").map((s) => s.split(",").map(Number) as [number, number]), m = marcoDeLaForma(p.forma), l = lienzoDelMarco(m)
      const esquinas: Array<[number, number]> = [[0, 0], [m.W, 0], [m.W, m.H], [0, m.H]]
      esquinas.forEach(([u, v], i) => { const [x, y] = alaFoto(m, u, v); expect(Math.hypot(x - q[i][0], y - q[i][1])).toBeLessThan(Math.max(m.W, m.H) * 0.08) }) // cada esquina cae casi en la suya
      const [cx, cy] = alaFoto(m, m.W / 2, m.H / 2); expect(cx).toBeCloseTo(q.reduce((s, v) => s + v[0], 0) / 4, 6); expect(cy).toBeCloseTo(q.reduce((s, v) => s + v[1], 0) / 4, 6) // centro exacto
      for (const [u, v] of [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]]) expect(dentro(alaFoto(m, u, v), q)).toBe(true) // el lienzo entero cae dentro del vidrio
    }
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

describe("6.14/6.15/6.16 · las pantallas dentro de tu oficina", () => {
  it("solo decoración: 11 grupos (6 del arco + 5 del escritorio) con tinte (mezcla «matiz»), sombra e interfaz en color CLARO; sin botones, rótulos, clics ni lecturas", () => {
    const html = renderToStaticMarkup(createElement(PantallasDelArco))
    const grupos = [...html.matchAll(/<g class="nv-pantalla" data-grupo="(arco|escritorio)" data-pantalla="(\d+)" data-animacion="([a-z]+)" data-tono="([^"]+)" style="--tono:(#[0-9a-f]{6})" clip-path="url\(#nv-pantalla-\1-\2\)">/g)]
    expect(grupos.filter((g) => g[1] === "arco").map((g) => Number(g[2]))).toEqual([1, 3, 4, 7, 9, 10])
    expect(grupos.filter((g) => g[1] === "escritorio").map((g) => [Number(g[2]), g[3]])).toEqual([[1, "cotizaciones"], [2, "pista"], [3, "agenda"], [4, "participacion"], [5, "tareas"]])
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
    // 6.16 · tableros de empresa (ni átomos, ni radares, ni giros): barras, nodos y enlaces, tarjetas, curva, etapas del embudo, trama del mapa…
    expect(html).not.toMatch(/animateTransform/)
    const de = (a: string) => html.slice(html.indexOf(`data-animacion="${a}"`), html.indexOf("</g></g>", html.indexOf(`data-animacion="${a}"`)))
    expect((de("ventas").match(/<rect /g) ?? []).length).toBe(6) // 6 barras de ventas
    expect((de("red").match(/<circle /g) ?? []).length).toBeGreaterThanOrEqual(7 * 2) // 7 nodos (anillo + centro) + pulsos
    expect((de("indicadores").match(/<rect /g) ?? []).length).toBe(6) // 3 tarjetas con su bloque de dato
    expect(de("crecimiento")).toMatch(/<path d="M[\d.,]+ L/) // la curva
    expect((de("embudo").match(/<path /g) ?? []).length).toBe(8) // 4 etapas, contorno + relleno
    expect((de("mapa").match(/<circle /g) ?? []).length).toBeGreaterThan(30) // la trama de puntos + 3 señales
    expect((de("tareas").match(/<rect /g) ?? []).length).toBe(3) // 3 casillas
    expect(de("participacion")).toMatch(/stroke-dasharray=/) // el anillo por segmentos
    // movimiento: CSS (crece · llena · traza · marca · respira · aparece · destella · enciende · señal · desfila · recorre · avanza) + SMIL para lo que viaja por un atributo (pulsos de la red · cabezal de la pista); todo quieto con «menos movimiento»
    for (const a of ["crece", "llena", "traza", "marca", "respira", "aparece", "destella", "enciende", "senal", "desfila", "recorre", "avanza", "avanza-y-vuelve"]) expect(html).toContain(`data-anima="${a}"`)
    expect((html.match(/<animate attributeName="(cx|cy|opacity)"/g) ?? []).length).toBe(9 * 3 + 1) // 9 pulsos (cx, cy, opacidad) + el cabezal
    expect(html).toContain("@media (prefers-reduced-motion:reduce){.nv-pantalla .nv-hud [data-anima]{animation:none}}")
    expect((html.match(/pathLength="1" stroke-dashoffset="0"/g) ?? []).length).toBe(3 + 1 + 3) // trazos que se dibujan: 3 curvas, la de crecimiento, 3 marcas; en reposo, dibujados
    // líneas finas de luz: el grosor sale del tamaño de cada vidrio (legible también en las chicas); sin framer-motion (6.16: sus componentes saltan al último cuadro en esta app)
    const c = readFileSync("components/nuevo/PantallasDelArco.tsx", "utf8")
    expect(c).toContain("const g = Math.max(1.3, Math.min(w, h) * 0.035)"); expect(c).toContain("lienzoDelMarco(marcoDeLaForma(p.forma))"); expect(c).toContain('transform={`matrix(${marcoDeLaForma(p.forma).matriz'); expect(c).not.toMatch(/from "framer-motion"/)
  })
  it("no lee nada, no abre nada, no enlaza nada", () => {
    const c = readFileSync("components/nuevo/PantallasDelArco.tsx", "utf8")
    expect(c).not.toMatch(/fetch\(|createPortal|Panel[A-Z]|href=|onClick|router|supabase|process\.env|<text/)
    expect(c).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")')
  })
  it("vive solo dentro de TU OFICINA (no en marketing ni en la sala); el rótulo «MÚSICA» quedó al 30 % (6.15) y pegado a su pantalla", () => {
    const oficina = renderToStaticMarkup(createElement(EscenaViva, { inicial: "oficina" }))
    expect(oficina).toContain('data-animacion="indicadores"'); expect(oficina).toContain('data-grupo="escritorio" data-pantalla="2" data-animacion="pista"')
    expect(renderToStaticMarkup(createElement(EscenaViva, { inicial: "marketing" }))).not.toContain("data-animacion=")
    expect(renderToStaticMarkup(createElement(EscenaViva, { inicial: false }))).not.toContain("data-animacion=")
    expect(readFileSync("components/nuevo/EscenaViva.tsx", "utf8")).toContain('{depto === "oficina" && <PantallasDelArco />}')
    const rotulo = oficina.match(/<text class="nv-rotulo"[^>]*>MÚSICA<\/text>/)![0]
    expect(Number(rotulo.match(/font-size="([\d.]+)"/)![1])).toBe(10) // 32 × 0,3 ≈ 10
    expect(PANTALLA_MUSICA.rotulo.y).toBeGreaterThan(428); expect(PANTALLA_MUSICA.rotulo.y).toBeLessThan(440) // justo encima del borde superior (440)
  })
})
