/**
 * CC4 (temporal en el equipo del dashboard) · 01-nov · limpieza de /nuevo (encargo de Lenovo 21:14Z, firmado por Emilio): Decisiones sin códigos, tarjetas del
 * Centro de campaña al día, sello de Spline, carga lenta y avatares más legibles. US$ 0 · sin red.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync, statSync } from "node:fs"
import { detalleDelCuadro } from "@/components/nuevo/PanelAplicaciones"
import { nombreDeLaFase, textoDeLaFase } from "@/components/nuevo/PanelPizarron"
import { faseActiva } from "@/lib/pizarron"
import type { Pizarron } from "@/lib/pizarron-datos"
import { PantallaNuevo } from "@/components/nuevo/PantallaNuevo"
import { MAXIMO_DE_PUESTOS, PASO_ENTRE_PUESTOS } from "@/lib/escena-avatares"

const fases = [{ clave: "senal", objetivo: "Señal", dia_desde: 1, dia_hasta: 30 }]
const campana = (extra: Record<string, unknown> = {}) => ({ id: "c", estado: "pausada", desde: "2026-11-02", hasta: null, version_calendario: 1, version_estrategia: 1, ...extra })
const datos = (extra: Record<string, unknown> = {}, totales: Record<string, number> = {}) => ({
  clientes: [], cliente: { id: "n", nombre: "Náufrago" }, campana: campana(extra), fases, fase_activa: faseActiva(fases, "2026-11-02", "2026-11-01"),
  gran_idea: { texto: null, nota: "x" }, esperas: [], filas: [], semanas: [], totales, hoy: "2026-11-01", leido_en: "x",
}) as unknown as Pizarron

describe("punto 2 · la tarjeta «Plan de 90 días» dice el estado real", () => {
  it("campaña en pausa y plan esperando tu decisión: nada de «Empieza mañana · primera fase: senal»", () => {
    const t = detalleDelCuadro("plan", datos({ momento_del_plan: "plan esperando tu decisión" })).texto
    expect(t).toBe("Campaña en pausa · plan esperando tu decisión"); expect(t).not.toMatch(/Empieza|senal/)
    expect(detalleDelCuadro("plan", datos({ momento_del_plan: "plan en reescritura" })).texto).toBe("Campaña en pausa · plan en reescritura")
  })
  it("la fase lleva tilde y solo se dice si la campaña corre con su plan vigente", () => {
    expect(nombreDeLaFase("senal")).toBe("Señal"); expect(nombreDeLaFase("recompra")).toBe("Recompra")
    const activa = datos({ estado: "activa" })
    expect(textoDeLaFase(activa)).toBe("Empieza mañana (2 nov) · primera fase: Señal")
    expect(textoDeLaFase(datos({ estado: "activa", del_plan_anterior: true }))).toBe("Sigue el plan anterior") // la fase sería la del plan anterior
  })
})

describe("punto 3 · «Piezas» no cuenta las del plan anterior", () => {
  it("con el calendario del plan anterior no hay nada por aprobar del vigente; con el plan vigente, se cuenta", () => {
    expect(detalleDelCuadro("piezas", datos({ del_plan_anterior: true }, { emilio: 1 }))).toEqual({ texto: "Nada por aprobar del plan vigente", aviso: false })
    expect(detalleDelCuadro("piezas", datos({}, { emilio: 1 }))).toEqual({ texto: "1 pieza espera tu aprobación", aviso: true })
  })
})

describe("punto 4 · el sello «Built with Spline» no se ve", () => {
  const fuente = readFileSync("components/nuevo/VidaSpline.tsx", "utf8")
  it("se esconde por estilo y se quita del DOM cuando el visor lo pone", () => {
    expect(fuente).toContain('a#logo,[data-vida="spline"] a[href*="spline.design"]{display:none!important}')
    expect(fuente).toMatch(/MutationObserver/); expect(fuente).toMatch(/\.remove\(\)/)
  })
})

describe("punto 5 · la carga baja", () => {
  it("las fotos de la escena van en webp y pesan mucho menos que las jpg", () => {
    let jpg = 0, webp = 0
    for (const n of ["escena", "marketing", "oficina"]) for (const s of ["1280", "2560"]) { jpg += statSync(`public/nuevo/${n}-${s}.jpg`).size; webp += statSync(`public/nuevo/${n}-${s}.webp`).size }
    expect(webp).toBeLessThan(jpg * 0.5)
    expect(statSync("public/nuevo/marketing-2560.webp").size).toBeLessThan(150_000)
  })
  it("la pantalla pide las fotos desde la cabecera del HTML (no esperan al JavaScript) y avisa «Preparando la oficina…» mientras llegan", () => {
    const html = renderToStaticMarkup(createElement(PantallaNuevo, { marketing: true }))
    expect(html).toContain("Preparando la oficina"); expect(html).toContain("data-cargando")
    const f = readFileSync("components/nuevo/PantallaNuevo.tsx", "utf8")
    expect(f).toContain('preload(`/nuevo/${depto}-2560.webp`'); expect(f).toContain('fetchPriority: "high"'); expect(f).toContain('preload("/nuevo/escena-2560.webp"')
  })
  it("Spline espera a que las fotos y la pantalla estén listas", () => {
    expect(readFileSync("components/nuevo/VidaSpline.tsx", "utf8")).toMatch(/readyState !== "complete"[\s\S]*setTimeout\(r, 1200\)/)
  })
})

describe("punto 6 · avatares más grandes, sin amontonar", () => {
  it("siguen siendo 4 por mesa con «+N», con el paso suficiente para la figura más grande", () => {
    expect(MAXIMO_DE_PUESTOS).toBe(4); expect(PASO_ENTRE_PUESTOS).toBeGreaterThanOrEqual(50)
    expect(readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")).toContain("scale(1.15)")
  })
})
