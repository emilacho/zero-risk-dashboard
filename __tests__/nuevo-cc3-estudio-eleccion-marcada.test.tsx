// @vitest-environment jsdom
/**
 * LA ELECCIÓN SE PINTA DE NARANJA EN TODO EL ESTUDIO (CC3 · GO de Lenovo 10-nov, Emilio 14:56Z: «al elegir Meshy no se pintaba la elección»).
 * Sin red ni base: la plataforma es falsa. La regla del naranja es UNA sola para los chips («Formato», «Pose», «Calidad»…) y para las
 * opciones con precio («Modelo» del 3D); en cada pestaña, toda opción elegida lleva esa regla y ninguna otra cosa la pisa.
 */
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { PanelEstudio } from "@/components/nuevo/PanelEstudio"
import type { Catalogo } from "@/lib/estudio"

const CLIENTE = "a0000000-0000-4000-8000-0000000000e1"
const OTRO = "b0000000-0000-4000-8000-0000000000e2"
const catalogo = {
  listos: { imagen: true, video: true, "3d": true, almacen: true, varias: true },
  imagen: { modelo: "m", formatos: ["1:1", "9:16"], precio: {} },
  video: { modelos: [{ id: "bytedance/seedance-2.5", nombre: "Seedance 2.5" }, { id: "otro/video", nombre: "Otro video" }], formatos: ["9:16", "16:9"], resoluciones: ["720p", "1080p"], segundos: { min: 4, max: 15 } },
  "3d": { modelos: [{ id: "tripo-h3.1", nombre: "Tripo H3.1", nota: "rápido", precio: { normal: 0.3, alta: 0.4 } }, { id: "meshy-6", nombre: "Meshy 6", nota: "el más detallado", precio: { normal: 0.8, alta: 0.8 } }], imagen_previa_usd: 0.0138 },
} satisfies Catalogo
const falsa = (async (u: RequestInfo | URL) => {
  if (String(u).startsWith("/api/estudio/cotizar")) return new Response(JSON.stringify({ ok: true, total_usd: 0.8, partes: [{ que: "3D", usd: 0.8 }] }), { status: 200 })
  return new Response(JSON.stringify({ ok: true, piezas: [] }), { status: 200 })
}) as typeof fetch
const abrir = (cliente = CLIENTE) => render(<PanelEstudio onCerrar={() => undefined} fetchImpl={falsa} catalogoInicial={catalogo} clientesIniciales={[{ id: cliente, nombre: cliente === CLIENTE ? "Náufrago" : "Cliente B" }]} piezasIniciales={[]} textoInicial="Una taza" />)

const AMBAR = "rgb(232, 115, 26)", LETRA = "rgb(240, 160, 75)", FONDO = "rgb(42, 32, 22)"
/** las elecciones del panel de pedido (no la galería), con lo que el navegador pinta */
function elecciones() {
  const panel = document.querySelector("[data-crear]")!.parentElement!
  return [...panel.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")].map((b) => {
    const c = getComputedStyle(b)
    return { texto: (b.textContent ?? "").trim(), elegida: b.getAttribute("aria-pressed") === "true", pintada: c.borderColor === AMBAR && c.color === LETRA && c.backgroundColor === FONDO }
  })
}
const boton = (t: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.startsWith(t))!

afterEach(cleanup)

describe("toda elección del Estudio se pinta igual que «Formato»", () => {
  for (const cliente of [CLIENTE, OTRO]) {
    it(`3D · el Modelo elegido (Meshy o Tripo) se pinta, y lo no elegido no · cliente ${cliente.slice(0, 1)}`, () => {
      abrir(cliente)
      fireEvent.click(document.querySelector('[data-tab="3d"]')!)
      for (const m of ["Meshy 6", "Tripo H3.1"]) {
        fireEvent.click(boton(m))
        fireEvent.click(boton("Alta"))
        const e = elecciones()
        expect(e.find((x) => x.texto.startsWith(m))).toMatchObject({ elegida: true, pintada: true })
        const otro = m === "Meshy 6" ? "Tripo H3.1" : "Meshy 6"
        expect(e.find((x) => x.texto.startsWith(otro))).toMatchObject({ elegida: false, pintada: false })
        expect(e.find((x) => x.texto === "Alta")).toMatchObject({ elegida: true, pintada: true })
        // exactamente lo elegido se pinta: nada más, nada menos
        expect(e.filter((x) => x.elegida).every((x) => x.pintada)).toBe(true)
        expect(e.filter((x) => !x.elegida).some((x) => x.pintada)).toBe(false)
      }
    })
  }
  it("imagen y video: Modelo, Formato, Duración y Resolución elegidos se pintan; los demás no", () => {
    abrir()
    for (const t of ["imagen", "video"]) {
      fireEvent.click(document.querySelector(`[data-tab="${t}"]`)!)
      const e = elecciones()
      expect(e.filter((x) => x.elegida).length).toBeGreaterThan(t === "video" ? 3 : 0)
      expect(e.filter((x) => x.elegida).every((x) => x.pintada)).toBe(true)
      expect(e.filter((x) => !x.elegida).some((x) => x.pintada)).toBe(false)
    }
    fireEvent.click(boton("Otro video"))
    expect(elecciones().find((x) => x.texto === "Otro video")).toMatchObject({ elegida: true, pintada: true })
  })
})
