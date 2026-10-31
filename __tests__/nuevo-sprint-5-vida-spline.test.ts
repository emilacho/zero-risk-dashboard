import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { EscenaNuevo, VISTA, ZONAS } from "@/components/nuevo/EscenaNuevo"
import { BarraSuperior } from "@/components/nuevo/MarcoNuevo"
import {
  CAMARA_Z, ESCENA_SPLINE, HALOS, NOMBRES, PERIODOS, RUTAS, aMundo, conviene, escalaDeBrillo, escalaDeHalo, largoRuta, poseDePolvo, poseDePulso, puntoEnRuta,
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
  })
  it("cada zona clicable declara su `data-zona` y tiene un halo en la escena de Spline", () => {
    const html = renderToStaticMarkup(createElement(EscenaNuevo))
    for (const z of ZONAS) { expect(html).toContain(`data-zona="${z.clave}"`); expect(HALOS[z.clave]).toMatch(/^Halo /) }
  })
  it("la escena de Spline es una dirección de Spline fija; la foto y las zonas siguen siendo de servidor (sin JavaScript de navegador)", () => {
    expect(ESCENA_SPLINE).toMatch(/^https:\/\/prod\.spline\.design\/[A-Za-z0-9]+\/scene\.splinecode$/)
    expect(leer("components/nuevo/EscenaNuevo.tsx")).not.toContain('"use client"')
    expect(leer("components/nuevo/EscenaNuevo.tsx")).not.toContain("spline.design")
    const pkg = JSON.parse(leer("package.json"))
    expect(pkg.dependencies["@splinetool/react-spline"]).toBeTruthy()
    expect(pkg.dependencies["@splinetool/runtime"]).toBeTruthy()
  })
  it("las rutas de los pulsos están dentro del recorte de la foto y en las mismas coordenadas que las zonas", () => {
    expect(RUTAS).toHaveLength(NOMBRES.pulsos.length)
    for (const r of RUTAS) { expect(r.length).toBeGreaterThanOrEqual(2); for (const [x, y] of r) expect(dentro(x, y)).toBe(true); expect(largoRuta(r)).toBeGreaterThan(40) }
    expect(aMundo(VISTA.x + VISTA.w / 2, VISTA.y + VISTA.h / 2)).toEqual({ x: 0, y: 0 }) // el centro de la foto es el origen de Spline
    expect(aMundo(VISTA.x, VISTA.y)).toEqual({ x: -VISTA.w / 2, y: VISTA.h / 2 }) // la esquina superior izquierda
    expect(CAMARA_Z).toBeGreaterThan(0)
  })
  it("un pulso sale apagado, se enciende a mitad de camino, llega apagado y vuelve por el mismo tramo", () => {
    const P = PERIODOS[0]
    const ruta = RUTAS[0]
    expect(puntoEnRuta(ruta, 0)).toEqual(ruta[0]); expect(puntoEnRuta(ruta, 1)).toEqual(ruta[ruta.length - 1])
    const salida = poseDePulso(0, 0), mitad = poseDePulso(P / 2, 0), llegada = poseDePulso(P - 1e-6, 0), vuelta = poseDePulso(P + P / 2, 0)
    expect(salida.s).toBeLessThan(0.01); expect(llegada.s).toBeLessThan(0.01); expect(mitad.s).toBeCloseTo(1, 3)
    expect([salida.x, salida.y]).toEqual(ruta[0])
    expect(Math.hypot(llegada.x - ruta[1][0], llegada.y - ruta[1][1])).toBeLessThan(0.1)
    expect([mitad.x, mitad.y]).toEqual([(ruta[0][0] + ruta[1][0]) / 2, (ruta[0][1] + ruta[1][1]) / 2])
    expect([vuelta.x, vuelta.y]).toEqual([mitad.x, mitad.y]) // el viaje de vuelta pasa por el mismo punto medio
    for (let t = 0; t < 40; t += 0.37) for (let i = 0; i < RUTAS.length; i++) { const p = poseDePulso(t, i); expect(dentro(p.x, p.y)).toBe(true); expect(p.s).toBeGreaterThan(0); expect(p.s).toBeLessThanOrEqual(1) }
  })
  it("los ritmos son todos distintos (nada se mueve al unísono) y las amplitudes son pequeñas: vida sentida, no mareo", () => {
    expect(new Set(PERIODOS).size).toBe(PERIODOS.length)
    const base = { x: 100, y: -50, z: 40 }
    for (let t = 0; t < 60; t += 0.5) for (let i = 0; i < 36; i++) {
      const p = poseDePolvo(t, i, base)
      expect(Math.abs(p.x - base.x)).toBeLessThanOrEqual(8); expect(Math.abs(p.y - base.y)).toBeLessThanOrEqual(16); expect(Math.abs(p.z - base.z)).toBeLessThanOrEqual(13)
    }
    for (let t = 0; t < 60; t += 0.5) for (let i = 0; i < 7; i++) { const s = escalaDeBrillo(t, i); expect(s).toBeGreaterThanOrEqual(0.84); expect(s).toBeLessThanOrEqual(1.16) }
    for (let t = 0; t < 10; t += 0.1) { expect(escalaDeHalo(t)).toBeGreaterThanOrEqual(0.95); expect(escalaDeHalo(t)).toBeLessThanOrEqual(1.05) }
    expect(poseDePolvo(1, 3, base)).not.toEqual(poseDePolvo(1, 4, base)) // cada mota a su ritmo
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
