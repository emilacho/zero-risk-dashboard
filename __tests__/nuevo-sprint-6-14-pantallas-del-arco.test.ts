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
import { ARCO_ANIMADO, ESCRITORIO_VIVO, GRUPOS_DE_PANTALLAS, LUZ_DE_LA_INTERFAZ, PANTALLAS_DEL_ARCO, PANTALLAS_DEL_ESCRITORIO, PANTALLAS_VIVAS, alaFoto, cajaDeLaForma, lienzoDeLaForma, lienzoDelMarco, marcoDeLaForma, matizDe, matizYSaturacion } from "@/lib/pantallas-de-la-oficina"
import { PANTALLA_MUSICA } from "@/lib/musica"
import { PantallasDelArco } from "@/components/nuevo/PantallasDelArco"
import { EscenaViva } from "@/components/nuevo/EscenaViva"

describe("6.19 · el arco = 9 tableros de dirección + la 10 libre (capa 1 de la oficina del humano, aprobada «tal como se ve en el boceto»)", () => {
  it("10 vidrios de izquierda a derecha; del 1 al 9 los tableros del boceto con su título, la 10 conserva el mapa dorado; todos en el tono durazno sobre velo oscuro", () => {
    expect(PANTALLAS_DEL_ARCO.map((p) => p.indice)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(PANTALLAS_DEL_ARCO.map((p) => p.animacion)).toEqual(["gobierno", "proyectos", "portafolio", "dinero", "decisiones", "riesgos", "organizacion", "agenda-ejecutiva", "observabilidad", "mapa"])
    expect(PANTALLAS_DEL_ARCO.map((p) => p.titulo?.join(" ") ?? null)).toEqual(["GOBIERNO", "IDEAS Y PROYECTOS", "PORTAFOLIO", "DINERO", "DECISIONES", "RIESGOS", "ORGANIZACIÓN", "AGENDA", "OBSERVABILIDAD", null])
    expect(PANTALLAS_VIVAS.map((p) => p.indice)).toEqual([1, 3, 4, 7, 9, 10]) // lo encendido en la foto no cambia
    expect(ARCO_ANIMADO.map((p) => p.indice)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    for (const p of PANTALLAS_DEL_ARCO) expect([p.tono, p.nombreDelTono]).toEqual(["#ff9a2e", "durazno"])
    let xAnterior = 0
    for (const p of PANTALLAS_DEL_ARCO) {
      const c = cajaDeLaForma(p.forma)
      expect(c.x).toBeGreaterThan(xAnterior); xAnterior = c.x // de izquierda a derecha, sin solaparse
      expect(c.x).toBeGreaterThan(900); expect(c.x + c.w).toBeLessThan(1680); expect(c.y).toBeGreaterThan(246); expect(c.y + c.h).toBeLessThan(480)
      expect(c.h).toBeGreaterThan(c.w) // pantallas verticales
    }
  })
  it("el escritorio queda reservado a Emilio: ningún tablero de dirección ni título en sus 5 pantallas", () => {
    for (const p of PANTALLAS_DEL_ESCRITORIO) { expect(p.titulo).toBeUndefined(); expect(["cotizaciones", "pista", "agenda", "participacion", "tareas"]).toContain(p.animacion) }
    expect(matizDe("#e8731a")).toBeCloseTo(25.7, 0); expect(matizDe("#00ff00")).toBe(120); expect(matizYSaturacion("#ff9a2e").saturacion).toBe(1) // (la función)
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
    expect(new Set([...escritorio, ...arco].map((m) => m.toFixed(1))).size).toBe(6) // 6.19: el arco entero en durazno; el escritorio no lo repite
    expect(GRUPOS_DE_PANTALLAS.map((g) => g.grupo)).toEqual(["arco", "escritorio"])
  })
})

describe("6.14/6.15/6.16 · las pantallas dentro de tu oficina", () => {
  it("15 grupos (10 del arco + 5 del escritorio) con tinte, sombra e interfaz CLARA; el arco con velo oscuro y sus 9 tableros animados; sin botones ni clics", () => {
    const html = renderToStaticMarkup(createElement(PantallasDelArco))
    const grupos = [...html.matchAll(/<g class="nv-pantalla" data-grupo="(arco|escritorio)" data-pantalla="(\d+)" data-animacion="([a-z-]+)" data-tono="([^"]+)" style="--tono:(#[0-9a-f]{6})" clip-path="url\(#nv-pantalla-\1-\2\)">/g)]
    expect(grupos.filter((g) => g[1] === "arco").map((g) => Number(g[2]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(grupos.filter((g) => g[1] === "escritorio").map((g) => [Number(g[2]), g[3]])).toEqual([[1, "cotizaciones"], [2, "pista"], [3, "agenda"], [4, "participacion"], [5, "tareas"]])
    expect(html).toContain('<svg viewBox="0 0 2560 1440" class="nv-tintes pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true"')
    expect((html.match(/class="nv-tinte"/g) ?? []).length).toBe(15); expect((html.match(/class="nv-sombra"/g) ?? []).length).toBe(15)
    // 6.19 · el velo oscuro solo en los 10 vidrios del arco, como en el boceto
    const velos = html.slice(html.indexOf('class="nv-velos'), html.indexOf("</svg>", html.indexOf('class="nv-velos')))
    expect((velos.match(/<polygon /g) ?? []).length).toBe(10); expect(html).toContain(".nv-velos polygon{fill:rgba(14,9,5,.8)}")
    expect(LUZ_DE_LA_INTERFAZ).toBe("#fff3e2"); expect(html).toContain(`.nv-pantalla .nv-hud{color:${LUZ_DE_LA_INTERFAZ};opacity:.78;filter:drop-shadow(0 0 1px var(--tono)) drop-shadow(0 0 2px var(--tono))}`)
    expect(html).toContain('.nv-pantalla[data-grupo="arco"] .nv-hud{opacity:.86}')
    // los 9 tableros, en el plano 100×160 del boceto, cada uno con su título y su dibujo propio
    expect([...html.matchAll(/data-tablero="([a-z-]+)"/g)].map((m) => m[1])).toEqual(["gobierno", "proyectos", "portafolio", "dinero", "decisiones", "riesgos", "organizacion", "agenda-ejecutiva", "observabilidad"])
    expect([...html.matchAll(/<g class="nv-titulo"[^>]*>(.*?)<\/g>/g)].map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())).toEqual(["GOBIERNO", "IDEAS Y PROYECTOS", "PORTAFOLIO", "DINERO", "DECISIONES", "RIESGOS", "ORGANIZACIÓN", "AGENDA", "OBSERVABILIDAD"])
    const de = (t: string) => { const i = html.indexOf(`data-tablero="${t}"`), j = html.indexOf('data-tablero="', i + 20); return html.slice(i, j > 0 ? j : html.indexOf('data-animacion="mapa"')) }
    expect((de("gobierno").match(/<rect [^>]*rx="6"/g) ?? []).length).toBe(5) // 5 interruptores
    expect((de("proyectos").match(/<text /g) ?? []).length).toBe(2 + 6) // título en 2 líneas + 6 etapas
    for (const e of ["idea", "evaluación", "plan", "aprobado", "construcción", "operando"]) expect(de("proyectos")).toContain(`>${e}</text>`)
    expect((de("portafolio").match(/data-anima="late"/g) ?? []).length).toBe(7) // 7 astros que laten
    expect((de("dinero").match(/data-anima="fluye"/g) ?? []).length).toBe(8) // 5 + 3 cauces con corriente
    expect(de("decisiones")).toContain('data-anima="apila"'); expect((de("decisiones").match(/<rect /g) ?? []).length).toBe(3 + 2 + 2) // 3 detrás + la del frente (velo y borde) + 2 botones
    expect(de("riesgos")).toContain('type="rotate" from="0 50 90" to="360 50 90"'); expect((de("riesgos").match(/data-anima="detecta"/g) ?? []).length).toBe(5)
    expect((de("organizacion").match(/data-anima="planta"/g) ?? []).length).toBeGreaterThan(10) // las plantas que se encienden
    expect(de("agenda-ejecutiva")).toContain(">hoy</text>"); expect(de("agenda-ejecutiva")).toContain('data-anima="recorrido"')
    expect((de("observabilidad").match(/data-anima="despliega"/g) ?? []).length).toBe(10) // la cascada, paso a paso
    expect((html.match(/data-anima="senal"/g) ?? []).length).toBe(3 + 1 + 1) // las señales del mapa de la 10 + «hoy» + la regla del estilo
    expect(html).not.toMatch(/role="button"|tabindex|aria-label|aria-haspopup/) // nada que tocar
    // «menos movimiento»: el CSS se apaga (también el de los tableros) y los SMIL no se montan
    expect(html.split("@media (prefers-reduced-motion:reduce){.nv-pantalla .nv-hud [data-anima]{animation:none}}").length - 1).toBe(2)
    const c = readFileSync("components/nuevo/PantallasDelArco.tsx", "utf8"), t = readFileSync("components/nuevo/TablerosDeDireccion.tsx", "utf8")
    expect(c).toContain("ESTILO + ESTILO_DE_DIRECCION + ESTILO_DEL_BRILLO"); expect(c).toContain('transform={`matrix(${marcoDeLaForma(p.forma).matriz'); expect(c).not.toMatch(/from "framer-motion"/)
    expect(t).toContain("{!quieto && <animateTransform"); expect(t).toContain("{!quieto && (")
  })
  it("no lee nada, no abre nada, no enlaza nada", () => {
    const c = readFileSync("components/nuevo/PantallasDelArco.tsx", "utf8")
    for (const f of [c, readFileSync("components/nuevo/TablerosDeDireccion.tsx", "utf8")]) expect(f).not.toMatch(/fetch\(|createPortal|Panel[A-Z]|href=|onClick|router|supabase|process\.env/) // sin datos todavía (capa 2)
    expect(c).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")')
  })
  it("vive solo dentro de TU OFICINA (no en marketing ni en la sala); el rótulo «MÚSICA» quedó al 30 % (6.15) y pegado a su pantalla", () => {
    const oficina = renderToStaticMarkup(createElement(EscenaViva, { inicial: "oficina" }))
    expect(oficina).toContain('data-animacion="decisiones"'); expect(oficina).toContain('data-grupo="escritorio" data-pantalla="2" data-animacion="pista"')
    expect(renderToStaticMarkup(createElement(EscenaViva, { inicial: "marketing" }))).not.toContain("data-animacion=")
    expect(renderToStaticMarkup(createElement(EscenaViva, { inicial: false }))).not.toContain("data-animacion=")
    expect(readFileSync("components/nuevo/EscenaViva.tsx", "utf8")).toContain('{depto === "oficina" && <PantallasDelArco />}')
    const rotulo = oficina.match(/<text class="nv-rotulo"[^>]*>MÚSICA<\/text>/)![0]
    expect(Number(rotulo.match(/font-size="([\d.]+)"/)![1])).toBe(10) // 32 × 0,3 ≈ 10
    expect(PANTALLA_MUSICA.rotulo.y).toBeGreaterThan(428); expect(PANTALLA_MUSICA.rotulo.y).toBeLessThan(440) // justo encima del borde superior (440)
  })
})
