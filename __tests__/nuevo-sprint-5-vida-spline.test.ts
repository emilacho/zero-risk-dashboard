import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { EscenaNuevo, VISTA, ZONAS } from "@/components/nuevo/EscenaNuevo"
import { BarraSuperior } from "@/components/nuevo/MarcoNuevo"
import {
  CAMARA_Z, DESFASES, ESCENA_SPLINE, NOMBRES, PERIODOS, RUTAS, aMundo, conviene, deFoto, distanciaARuta, largoRuta, poseDePulso, puntoEnRuta,
} from "@/lib/vida-spline"

const leer = (p: string) => readFileSync(p, "utf8")
const dentro = (x: number, y: number) => x >= VISTA.x && x <= VISTA.x + VISTA.w && y >= VISTA.y && y <= VISTA.y + VISTA.h

describe("dashboard nuevo · sprint 5 · vida sobre la foto con Spline (la imagen no cambia)", () => {
  it("la foto es la misma de siempre y la escena se agranda un 30 % (58 % → 75 % del ancho), no a pantalla completa", () => {
    const html = renderToStaticMarkup(createElement(EscenaNuevo))
    expect(html).toContain("/nuevo/escena-2560.jpg")
    expect(html).toContain("width:min(100%,75vw,")
    expect(html).not.toContain("58vw")
    expect(Math.round(58 * 1.3)).toBe(75)
  })
  it("5.2 · la iluminación es la de la foto original: sin viñeta que la mezcle con el gris de la página; la escena va sobre negro con un halo negro alrededor", () => {
    const html = renderToStaticMarkup(createElement(EscenaNuevo))
    expect(html).not.toMatch(/mask-image/)
    expect(html).not.toMatch(/<img[^>]*(filter|opacity)/)
    expect(html).toMatch(/\.nv-escena\{[^}]*background:#000;box-shadow:0 0 140px 100px #000/)
  })
  it("5.3 · al pasar por un departamento se ilumina SOLO la superficie de su plataforma: luz suave recortada a la cara, sin campo naranja ni línea dura alrededor", () => {
    const html = renderToStaticMarkup(createElement(EscenaNuevo))
    expect(html).not.toMatch(/drop-shadow/)
    expect(html).not.toMatch(/stroke:rgba\(255,1[67]0/)
    expect(html).toMatch(/\.nv-zona polygon\{[^}]*stroke:none/)
    expect(html).toMatch(/polygon\.nv-luz\{[^}]*mix-blend-mode:screen/)
    for (const z of ZONAS) {
      expect(html).toContain(`<clipPath id="nv-sup-${z.clave}"><polygon points="${z.superficie}"`)
      expect(html).toContain(`<g clip-path="url(#nv-sup-${z.clave})"><polygon class="nv-luz" points="${z.superficie}" filter="url(#nv-luz-suave)"`)
      for (const par of z.superficie.split(" ")) { const [x, y] = par.split(",").map(Number); expect(dentro(x, y)).toBe(true) }
    }
    // la cara superior de la losa de Marketing cabe dentro de su zona del ratón (el hexágono de siempre)
    const mkt = ZONAS.find((z) => z.clave === "marketing")!
    const hit = mkt.formas[0].split(" ").map((p) => p.split(",").map(Number)), sup = mkt.superficie.split(" ").map((p) => p.split(",").map(Number))
    const [hx0, hx1] = [Math.min(...hit.map((p) => p[0])), Math.max(...hit.map((p) => p[0]))], [hy0, hy1] = [Math.min(...hit.map((p) => p[1])), Math.max(...hit.map((p) => p[1]))]
    for (const [x, y] of sup) { expect(x).toBeGreaterThanOrEqual(hx0); expect(x).toBeLessThanOrEqual(hx1); expect(y).toBeGreaterThanOrEqual(hy0); expect(y).toBeLessThanOrEqual(hy1) }
    expect(sup).toHaveLength(4) // un paralelogramo: la cara superior de la losa
  })
  it("la foto va en su propia capa de composición: con un lienzo WebGL encima Chrome la redibujaba distinta (medido 31-oct) · no quitar", () => {
    const html = renderToStaticMarkup(createElement(EscenaNuevo))
    expect(html).toMatch(/<img[^>]*\[transform:translateZ\(0\)\]/)
  })
  it("la capa de vida va ENTRE la foto y las zonas clicables, y no atrapa el ratón", () => {
    const html = renderToStaticMarkup(createElement(EscenaNuevo, { fondo: createElement("i", { "data-prueba": "vida" }) }))
    const foto = html.indexOf("<img"), vida = html.indexOf('data-prueba="vida"'), zonas = html.indexOf("<svg")
    expect(foto).toBeGreaterThan(-1); expect(vida).toBeGreaterThan(foto); expect(zonas).toBeGreaterThan(vida)
    const capa = leer("components/nuevo/VidaSpline.tsx")
    expect(capa).toContain('"use client"')
    expect(capa).toContain("pointer-events-none absolute inset-0")
    expect(capa).toContain('aria-hidden="true"')
    expect(capa).toMatch(/lazy\(\(\) => import\("@splinetool\/react-spline"\)\)/) // la biblioteca solo baja cuando se monta
    expect(capa).toContain("renderOnDemand={false}")
    expect(capa).toContain('setBackgroundColor("rgba(0,0,0,0)")') // el lienzo transparente: la foto está debajo
  })
  it("en pantalla SOLO hay pulsos: el polvo, los discos sobre las ventanas y los halos quedan ocultos al cargar (Emilio 31-oct)", () => {
    const capa = leer("components/nuevo/VidaSpline.tsx")
    expect(capa).toMatch(/for \(const n of NOMBRES\.ocultos\) \{ const o = busca\(n\); if \(o\) o\.visible = false \}/)
    expect(NOMBRES.ocultos).toHaveLength(7 + 36 + 2)
    expect(NOMBRES.ocultos).toContain("Polvo 36"); expect(NOMBRES.ocultos).toContain("Brillo 7"); expect(NOMBRES.ocultos).toContain("Halo Marketing")
    expect(capa).not.toMatch(/poseDePolvo|escalaDeBrillo|escalaDeHalo|HALOS/)
    for (const z of ZONAS) expect(renderToStaticMarkup(createElement(EscenaNuevo))).toContain(`data-zona="${z.clave}"`)
  })
  it("la escena de Spline es una dirección de Spline fija; la foto y las zonas siguen siendo de servidor (sin JavaScript de navegador)", () => {
    expect(ESCENA_SPLINE).toMatch(/^https:\/\/prod\.spline\.design\/[A-Za-z0-9]+\/scene\.splinecode$/)
    expect(leer("components/nuevo/EscenaNuevo.tsx")).not.toContain('"use client"')
    expect(leer("components/nuevo/EscenaNuevo.tsx")).not.toContain("spline.design")
    const pkg = JSON.parse(leer("package.json"))
    expect(pkg.dependencies["@splinetool/react-spline"]).toBeTruthy()
    expect(pkg.dependencies["@splinetool/runtime"]).toBeTruthy()
  })
  it("las rutas son trazos del SUELO de la foto, en las mismas coordenadas que las zonas: 10 rutas, dentro del recorte, de 90 a 320 unidades", () => {
    expect(RUTAS).toHaveLength(10)
    expect(RUTAS).toHaveLength(NOMBRES.pulsos.length)
    for (const r of RUTAS) {
      expect(r.length).toBeGreaterThanOrEqual(2)
      for (const [x, y] of r) expect(dentro(x, y)).toBe(true)
      expect(largoRuta(r)).toBeGreaterThan(90); expect(largoRuta(r)).toBeLessThan(320)
    }
    // la conversión píxel de foto → VISTA es la misma que usan las zonas (la foto 2560×1385 llena el recorte 1700×920 desde 150,40)
    expect(deFoto(0, 0)).toEqual([VISTA.x, VISTA.y]); expect(deFoto(2560, 1385)).toEqual([VISTA.x + VISTA.w, VISTA.y + VISTA.h])
    expect(deFoto(1332, 383)).toEqual(RUTAS[0][0]) // el primer trazo medido en la foto
    expect(aMundo(VISTA.x + VISTA.w / 2, VISTA.y + VISTA.h / 2)).toEqual({ x: 0, y: 0 }) // el centro de la foto es el origen de Spline
    expect(aMundo(VISTA.x, VISTA.y)).toEqual({ x: -VISTA.w / 2, y: VISTA.h / 2 }) // la esquina superior izquierda
    expect(CAMARA_Z).toBeGreaterThan(0)
  })
  it("un pulso sale apagado, se enciende a mitad de camino, llega apagado y vuelve por el mismo tramo; nunca se sale de su trazo", () => {
    const P = PERIODOS[0], d0 = DESFASES[0]
    const ruta = RUTAS[0]
    expect(d0).toBe(0)
    expect(puntoEnRuta(ruta, 0)).toEqual(ruta[0]); expect(puntoEnRuta(ruta, 1)).toEqual(ruta[ruta.length - 1])
    const salida = poseDePulso(0, 0), mitad = poseDePulso(P / 2, 0), llegada = poseDePulso(P - 1e-6, 0), vuelta = poseDePulso(P + P / 2, 0)
    expect(salida.s).toBeLessThan(0.01); expect(llegada.s).toBeLessThan(0.01); expect(mitad.s).toBeCloseTo(1, 3)
    expect([salida.x, salida.y]).toEqual(ruta[0])
    expect(Math.hypot(llegada.x - ruta[1][0], llegada.y - ruta[1][1])).toBeLessThan(0.1)
    expect([mitad.x, mitad.y]).toEqual([(ruta[0][0] + ruta[1][0]) / 2, (ruta[0][1] + ruta[1][1]) / 2])
    expect([vuelta.x, vuelta.y]).toEqual([mitad.x, mitad.y]) // el viaje de vuelta pasa por el mismo punto medio
    // antes de su desfase, el pulso espera apagado en el arranque de su ruta
    const i = 3
    expect(poseDePulso(DESFASES[i] / 2, i).s).toBeLessThan(0.01); expect([poseDePulso(DESFASES[i] / 2, i).x, poseDePulso(DESFASES[i] / 2, i).y]).toEqual(RUTAS[i][0])
    for (let t = 0; t < 60; t += 0.23) for (let k = 0; k < RUTAS.length; k++) {
      const p = poseDePulso(t, k)
      expect(dentro(p.x, p.y)).toBe(true); expect(p.s).toBeGreaterThan(0); expect(p.s).toBeLessThanOrEqual(1)
      expect(distanciaARuta(RUTAS[k], p.x, p.y)).toBeLessThan(1e-6) // SOBRE el trazo, siempre
    }
  })
  it("los ritmos son todos distintos (nada se mueve al unísono) y van a velocidad parecida (≈ 30 unidades/s): vida sentida, no mareo", () => {
    expect(new Set(PERIODOS).size).toBe(PERIODOS.length)
    expect(new Set(DESFASES).size).toBe(DESFASES.length)
    for (let i = 0; i < RUTAS.length; i++) {
      const v = largoRuta(RUTAS[i]) / PERIODOS[i]
      expect(v).toBeGreaterThan(20); expect(v).toBeLessThan(45)
    }
  })
  it("la capa 3D solo se monta en escritorio, con WebGL y sin «reducir movimiento»; si no, queda la foto sola (móvil = foto)", () => {
    expect(conviene(1600, true, false)).toBe(true)
    expect(conviene(699, true, false)).toBe(false)
    expect(conviene(1600, false, false)).toBe(false)
    expect(conviene(1600, true, true)).toBe(false)
    // la escena de Spline está exportada solo para WebGPU: sin adaptador no se monta la capa (la foto queda sola, nunca un lienzo negro encima)
    const capa = leer("components/nuevo/VidaSpline.tsx")
    expect(capa).toMatch(/gpu\.requestAdapter\(\)/)
    expect(capa).toMatch(/if \(!\(await hayWebGPU\(\)\)\) return/)
  })
  it("barra superior: tres grupos en fila (el buscador ya no flota en absoluto), así «Seleccionar cliente» y «Buscar» no se encimán a ningún ancho", () => {
    const html = renderToStaticMarkup(createElement(BarraSuperior))
    expect(html).toContain("Seleccionar cliente"); expect(html).toContain("Buscar")
    expect(html).not.toMatch(/absolute left-1\/2 top-1\/2[^"]*md:block/)
    expect(html).toMatch(/mx-auto hidden w-\[min\(34vw,420px\)\] md:block/)
    expect(html).toContain("whitespace-nowrap")
  })
})
