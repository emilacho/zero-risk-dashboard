/**
 * DASHBOARD NUEVO · SPRINT 6.14 (Emilio, 1-nov): «esta oficina es el centro de HITL. Cada pantalla que tengo al frente debe abrir un centro de comando, con una
 * animación sutil y minimalista; no todo naranja: la variedad de la paleta de los naranjas, para dar a entender que cada una muestra algo diferente».
 *  · lógica pura: 10 pantallas medidas en la foto; 6 encendidas abren un centro distinto (tono y dibujo distintos); 4 apagadas quedan reservadas.
 *  · dentro de tu oficina: zona por pantalla viva con rótulo (letras de la marca, en su tono), dibujo animado y cifra viva donde la hay; el toque abre el centro ENCIMA.
 *  · regla 31-oct: nada enlaza al dashboard viejo.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { CENTROS, PANTALLAS_DEL_ARCO, PANTALLAS_VIVAS, TONOS, cajaDeLaForma, cifraDeLaPantalla, matizDe, pantallaDelCentro } from "@/lib/pantallas-de-la-oficina"
import { PantallasDelArco } from "@/components/nuevo/PantallasDelArco"
import { EscenaViva } from "@/components/nuevo/EscenaViva"
import { BarraSuperior } from "@/components/nuevo/MarcoNuevo"

describe("6.14 · las pantallas del arco (lógica pura)", () => {
  it("10 pantallas de izquierda a derecha dentro del arco de la foto; 6 encendidas con centro propio; 4 apagadas sin centro (reservadas)", () => {
    expect(PANTALLAS_DEL_ARCO.map((p) => p.indice)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(PANTALLAS_DEL_ARCO.filter((p) => p.encendida).length).toBe(6)
    expect(PANTALLAS_DEL_ARCO.every((p) => p.encendida === (p.centro !== null))).toBe(true)
    expect(PANTALLAS_VIVAS.map((p) => p.centro)).toEqual(["informes", "gran_idea", "bandeja", "en_vivo", "equipo", "calendario"])
    let xAnterior = 0
    for (const p of PANTALLAS_DEL_ARCO) {
      const c = cajaDeLaForma(p.forma)
      expect(c.x).toBeGreaterThan(xAnterior); xAnterior = c.x // de izquierda a derecha, sin solaparse
      expect(c.x).toBeGreaterThan(900); expect(c.x + c.w).toBeLessThan(1680); expect(c.y).toBeGreaterThan(246); expect(c.y + c.h).toBeLessThan(480)
      expect(c.h).toBeGreaterThan(c.w) // pantallas verticales
    }
    expect(pantallaDelCentro("bandeja")!.indice).toBe(4); expect(pantallaDelCentro("en_vivo")!.indice).toBe(7) // las del centro, para lo que más se mira
  })
  it("cada centro con un tono DISTINTO de la familia de los naranjas y un dibujo DISTINTO; la bandeja lleva el tono de la marca", () => {
    const claves = Object.keys(CENTROS) as Array<keyof typeof CENTROS>
    const tonos = claves.map((k) => CENTROS[k].tono), glifos = claves.map((k) => CENTROS[k].glifo)
    expect(new Set(tonos).size).toBe(claves.length); expect(new Set(glifos).size).toBe(claves.length)
    for (const t of tonos) { const h = matizDe(t); expect(h).toBeGreaterThanOrEqual(14); expect(h).toBeLessThanOrEqual(36) }
    expect(Object.values(TONOS)).toContain(CENTROS.bandeja.tono); expect(CENTROS.bandeja.tono).toBe("#e8731a")
    expect(matizDe("#e8731a")).toBeCloseTo(25.7, 0); expect(matizDe("#00ff00")).toBe(120)
  })
  it("las cifras vivas: la bandeja muestra las piezas por aprobar y «en vivo» los trabajos de hoy; las demás, nada", () => {
    expect(cifraDeLaPantalla("bandeja", { por_aprobar: 3, hoy: 12 })).toBe("3"); expect(cifraDeLaPantalla("en_vivo", { por_aprobar: 3, hoy: 12 })).toBe("12")
    expect(cifraDeLaPantalla("bandeja", {})).toBeNull(); expect(cifraDeLaPantalla("equipo", { por_aprobar: 3, hoy: 12 })).toBeNull()
  })
})

describe("6.14 · el arco dentro de tu oficina", () => {
  it("una zona por pantalla viva: rótulo con las letras de la marca en su tono, dibujo animado distinto, tono distinto; las apagadas no son zona", () => {
    const html = renderToStaticMarkup(createElement(PantallasDelArco, { cifrasIniciales: { por_aprobar: 3, hoy: 12 } }))
    const zonas = [...html.matchAll(/<g class="nv-arco" data-zona="arco-([a-z_]+)" data-centro="\1" data-glifo="([a-z]+)" data-pantalla="(\d+)" style="--tono:(#[0-9a-f]{6})" role="button" tabindex="0" aria-label="([^"]+)" aria-haspopup="dialog" aria-expanded="false"/g)]
    expect(zonas.map((z) => z[1])).toEqual(["informes", "gran_idea", "bandeja", "en_vivo", "equipo", "calendario"])
    expect(new Set(zonas.map((z) => z[2])).size).toBe(6); expect(new Set(zonas.map((z) => z[4])).size).toBe(6)
    expect(zonas.map((z) => Number(z[3]))).toEqual([1, 3, 4, 7, 9, 10])
    expect(zonas.find((z) => z[1] === "bandeja")![5]).toBe("Bandeja: Las piezas y revisiones que esperan tu aprobación")
    for (const r of ["INFORMES", "GRAN IDEA", "BANDEJA", "EN VIVO", "EQUIPO", "CALENDARIO"]) expect(html).toContain(`>${r}</text>`)
    expect((html.match(/data-pantalla="/g) ?? []).length).toBe(6) // las 4 apagadas no aparecen
    // el rótulo con las letras de la marca (misma proporción letra/espaciado que ZERO RISK), pero en el tono del centro
    const logo = renderToStaticMarkup(createElement(BarraSuperior)).match(/<text[^>]*>ZERO RISK<\/text>/)![0]
    const rotulo = html.match(/<text class="nv-rotulo"[^>]*>GRAN IDEA<\/text>/)![0]
    const num = (s: string, k: string) => Number(s.match(new RegExp(`${k}="([\\d.]+)"`))![1])
    expect(rotulo).toContain('fill="none"'); expect(rotulo).toContain(`stroke="${CENTROS.gran_idea.tono}"`); expect(rotulo).toContain('font-weight="500"')
    expect(num(rotulo, "letter-spacing") / num(rotulo, "font-size")).toBeCloseTo(num(logo, "letter-spacing") / num(logo, "font-size"), 3)
    // animación sutil: cada dibujo lleva su animación; con «menos movimiento» se apaga
    expect(html).toMatch(/data-anima="flota"/); expect(html).toMatch(/data-anima="late"/); expect(html).toMatch(/data-anima="crece"/); expect(html).toMatch(/data-anima="corre"/); expect(html).toMatch(/data-anima="parpadea"/)
    expect(html).toContain("@media (prefers-reduced-motion:reduce){.nv-glifo [data-anima]{animation:none}")
    // la luz de la pantalla y el dibujo toman el tono de la pantalla (variable), no un naranja fijo
    expect(html).toContain(".nv-arco .nv-aviva{fill:var(--tono)"); expect(html).toContain(".nv-arco .nv-glifo{color:var(--tono)")
    // las cifras vivas
    expect(html).toMatch(/data-centro="bandeja"[\s\S]*?<text class="nv-cifra"[^>]*>3<\/text>/); expect(html).toMatch(/data-centro="en_vivo"[\s\S]*?<text class="nv-cifra"[^>]*>12<\/text>/)
    expect(renderToStaticMarkup(createElement(PantallasDelArco, { cifrasIniciales: {} }))).not.toContain('class="nv-cifra"')
  })
  it("cada pantalla abre ENCIMA un centro que ya existe en el estilo nuevo; ninguno enlaza al dashboard viejo; el toque no cierra la oficina", () => {
    const c = readFileSync("components/nuevo/PantallasDelArco.tsx", "utf8")
    for (const panel of ["PanelPiezas", "PanelGranIdea", "PanelInformes", "PanelEnVivo", "PanelEquipo", "PanelPizarron"]) expect(c).toContain(`<${panel} onCerrar={cerrar}`)
    expect(c).toContain('case "calendario": return <PanelPizarron onCerrar={cerrar} onAbrirPieza={abrirPieza} />') // una pieza desde el calendario se abre en la bandeja nueva, no en la ventana vieja
    expect(c).not.toMatch(/href=|router\.push|window\.location/)
    expect(c).toContain("onClick={(e) => { e.stopPropagation(); abrir() }}")
    expect(c).toContain('createPortal(<PanelDelCentro') // sale al <body>, como el Centro de campaña
    expect(c).not.toMatch(/supabase|process\.env/) // solo las dos lecturas por la puerta de administrador
    expect(c).toContain('leer("/api/bandeja?estado=pendiente")'); expect(c).toContain('leer("/api/en-vivo?limite=1")')
  })
  it("vive solo dentro de TU OFICINA (no en marketing ni en la sala)", () => {
    expect(renderToStaticMarkup(createElement(EscenaViva, { inicial: "oficina" }))).toContain('data-zona="arco-bandeja"')
    expect(renderToStaticMarkup(createElement(EscenaViva, { inicial: "marketing" }))).not.toContain('data-zona="arco-')
    expect(renderToStaticMarkup(createElement(EscenaViva, { inicial: false }))).not.toContain('data-zona="arco-')
    expect(readFileSync("components/nuevo/EscenaViva.tsx", "utf8")).toContain('{depto === "oficina" && <PantallasDelArco />}')
  })
})
