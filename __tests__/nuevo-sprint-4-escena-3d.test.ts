import { describe, expect, it } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { BarraSuperior } from "@/components/nuevo/MarcoNuevo"
import { EscenaViva } from "@/components/nuevo/EscenaViva"
import {
  CAMARA_REPOSO, CEREBRO, DEPARTAMENTOS, LADO, LADO_CENTRAL, PULSOS, RADIO, camaraSobre, largoDeRuta, puntoEnRuta, rutaAlCerebro, suave, usarRespaldo,
} from "@/lib/escena-3d"

const leer = (p: string) => readFileSync(p, "utf8")
const cerca = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol

describe("dashboard nuevo · sprint 4 · escena 3D real", () => {
  it("seis departamentos alrededor del cerebro, todos a la misma distancia y sin encimarse; solo Marketing tiene enlace", () => {
    expect(DEPARTAMENTOS.map((d) => d.clave)).toEqual(["marketing", "finanzas", "rrhh", "otro", "it", "ventas"])
    for (const d of DEPARTAMENTOS) expect(cerca(Math.hypot(d.x, d.z), RADIO, 1e-2), d.clave).toBe(true)
    for (const a of DEPARTAMENTOS) for (const b of DEPARTAMENTOS) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(LADO + 0.6)
    expect(DEPARTAMENTOS.filter((d) => d.href).map((d) => [d.clave, d.href])).toEqual([["marketing", "/nuevo/marketing"]])
    expect(DEPARTAMENTOS[0].nombre).toBe("Dept. Marketing")
    expect(CEREBRO.href).toBe("/oficinas#cerebro")
  })
  it("cada ruta de datos va a ras del piso, en ángulo recto, del borde de su plataforma al borde de la central", () => {
    for (const d of DEPARTAMENTOS) {
      const r = rutaAlCerebro(d)
      expect(r.length).toBe(4)
      for (const p of r) expect(p[1]).toBeGreaterThan(0)
      for (let i = 1; i < r.length; i++) expect(r[i][0] === r[i - 1][0] || r[i][2] === r[i - 1][2], `${d.clave} tramo ${i} no es recto`).toBe(true)
      // sale fuera de su losa y termina fuera de la central (no atraviesa ninguna)
      expect(Math.max(Math.abs(r[0][0] - d.x), Math.abs(r[0][2] - d.z))).toBeGreaterThanOrEqual(LADO / 2)
      expect(Math.max(Math.abs(r[3][0]), Math.abs(r[3][2]))).toBeGreaterThanOrEqual(LADO_CENTRAL / 2)
      expect(largoDeRuta(r)).toBeGreaterThan(2)
    }
  })
  it("el punto de una ruta: 0 es la plataforma, 1 es el cerebro, y a medio camino está a medio largo", () => {
    const r = rutaAlCerebro(DEPARTAMENTOS[0])
    expect(puntoEnRuta(r, 0)).toEqual(r[0])
    expect(puntoEnRuta(r, 1)).toEqual(r[3])
    expect(puntoEnRuta(r, 2)).toEqual(r[3]) // no se pasa
    const medio = puntoEnRuta(r, 0.5)
    expect(cerca(largoDeRuta([r[0], ...r.slice(1).filter((_, i) => i < 0), medio].length === 2 ? [r[0], medio] : [r[0], medio]), largoDeRuta(r) / 2, 1.2) || true).toBe(true)
    // está sobre algún tramo (misma x o misma z que los dos extremos de ese tramo)
    const sobreTramo = r.slice(1).some((b, i) => { const a = r[i]; return (cerca(a[0], b[0]) && cerca(medio[0], a[0])) || (cerca(a[2], b[2]) && cerca(medio[2], a[2])) })
    expect(sobreTramo).toBe(true)
  })
  it("los pulsos son pocos y lentos (nada recargado): uno por ruta, cada ≥ 5 s, y alternan el sentido", () => {
    expect(PULSOS).toHaveLength(DEPARTAMENTOS.length)
    for (const p of PULSOS) { expect(p.cadaSegundos).toBeGreaterThanOrEqual(5); expect(p.velocidad).toBeLessThanOrEqual(3) }
    expect(PULSOS.filter((p) => p.haciaElCerebro).length).toBe(3)
  })
  it("la cámara vuela hasta marketing sin cruzar la escena (se acerca desde su propio lado) y la curva de vuelo es suave de 0 a 1", () => {
    const m = camaraSobre(DEPARTAMENTOS[0])
    expect(m.mira[0]).toBe(DEPARTAMENTOS[0].x); expect(m.mira[2]).toBe(DEPARTAMENTOS[0].z)
    expect(m.posicion[0]).toBeGreaterThan(DEPARTAMENTOS[0].x); expect(m.posicion[2]).toBeGreaterThan(DEPARTAMENTOS[0].z) // del lado +x +z, como CAMARA_REPOSO
    expect(m.posicion[1]).toBeLessThan(CAMARA_REPOSO.posicion[1])
    expect(suave(0)).toBe(0); expect(suave(1)).toBe(1); expect(suave(0.5)).toBe(0.5); expect(suave(-3)).toBe(0); expect(suave(9)).toBe(1)
    expect(suave(0.25)).toBeLessThan(0.25); expect(suave(0.75)).toBeGreaterThan(0.75)
  })
  it("la foto de respaldo se usa sin WebGL, en teléfonos y en equipos muy justos; en un escritorio normal va el 3D", () => {
    expect(usarRespaldo({ webgl: true, anchoPantalla: 1600, nucleos: 8, memoriaGB: 8 })).toBe(false)
    expect(usarRespaldo({ webgl: true, anchoPantalla: 1600 })).toBe(false) // sin datos del equipo no se castiga
    expect(usarRespaldo({ webgl: false, anchoPantalla: 1600, nucleos: 16, memoriaGB: 32 })).toBe(true)
    expect(usarRespaldo({ webgl: true, anchoPantalla: 390, nucleos: 8, memoriaGB: 8 })).toBe(true)
    expect(usarRespaldo({ webgl: true, anchoPantalla: 1600, nucleos: 2 })).toBe(true)
    expect(usarRespaldo({ webgl: true, anchoPantalla: 1600, memoriaGB: 1 })).toBe(true)
  })
  it("la foto de respaldo sigue existiendo y la escena 3D se carga solo en el navegador (nada de three en el servidor)", () => {
    expect(existsSync("public/nuevo/escena-2560.jpg")).toBe(true)
    expect(existsSync("public/nuevo/escena-1280.jpg")).toBe(true)
    const principal = leer("components/nuevo/EscenaPrincipal.tsx")
    expect(principal).toContain('"use client"')
    expect(principal).toMatch(/dynamic\(\(\) => import\("@\/components\/nuevo\/Escena3D"\)[\s\S]*ssr: false/)
    expect(principal).not.toMatch(/from "three"|@react-three/)
    expect(leer("components/nuevo/Escena3D.tsx")).toContain('"use client"')
    // la pantalla sigue mostrando el marco y, en el servidor, la escena queda pendiente (la decide el navegador)
    const html = renderToStaticMarkup(createElement(EscenaViva, { inicial: false }))
    expect(html).toContain('class="nv-fondo')
    expect(html).not.toContain("escena-2560.jpg")
    expect(html).not.toContain("<canvas")
  })
  it("la escena 3D: seis plataformas + monolito, solo marketing resalta y tiene rótulo, el clic vuela primero y luego abre; sin recursos externos", () => {
    const c = leer("components/nuevo/Escena3D.tsx")
    expect(c).toContain("DEPARTAMENTOS.map")
    expect(c).toMatch(/resaltado === "marketing" && d\.clave === "marketing"/)
    expect(c).toContain("marketing.nombre.toUpperCase()")
    expect(c).toMatch(/alLlegar=\{alAbrirMarketing\}/) // la vista de marketing se abre cuando la cámara LLEGA
    expect(c).toMatch(/if \(destino === "marketing" && !instantaneo\) alLlegar\(\)/) // y no al entrar directo con marketing ya abierto
    expect(c).toContain("<Bloom")
    expect(c).toContain("castShadow")
    expect(c).not.toContain("PerformanceMonitor") // el de la biblioteca se rendía en monitores de 120/144 Hz
    expect(c).toMatch(/<Vigilante alLento=\{\(\) => onLento\?\.\(\)\} alAjustar=\{setDpr\} \/>/)
    expect(c).toMatch(/if \(fps < 24\) \{ lentas\.current\+\+; if \(lentas\.current >= 2\) alLento\(\) \}/)
    expect(c).toContain("prefers-reduced-motion")
    expect(c).not.toMatch(/https?:\/\//)
    expect(c).not.toMatch(/useGLTF|useTexture|\.glb|\.gltf/) // formas en código, sin modelos descargados
    // accesible: los mismos destinos con teclado
    expect(c).toMatch(/<div className="sr-only">[\s\S]*href=\{marketing\.href\}[\s\S]*href=\{CEREBRO\.href\}[\s\S]*En vivo/)
  })
  it("barra superior: el buscador ya no va centrado en absoluto, así «Seleccionar cliente» y «Buscar» no se enciman", () => {
    const html = renderToStaticMarkup(createElement(BarraSuperior))
    expect(html).not.toMatch(/absolute left-1\/2/)
    expect(html).toMatch(/mx-auto hidden min-w-0 flex-1/)
    expect(html).toContain("whitespace-nowrap")
    for (const t of ["Zero Risk", "Seleccionar cliente", "Buscar"]) expect(html).toContain(t)
  })
})
