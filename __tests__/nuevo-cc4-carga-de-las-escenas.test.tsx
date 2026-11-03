import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { PantallaNuevo } from "@/components/nuevo/PantallaNuevo"

describe("CC4 · carga de las escenas · nunca negro", () => {
  it("el primer HTML ya trae la foto de la escena y el esqueleto del marco (marketing, oficina e inicio)", () => {
    for (const [props, foto] of [[{ marketing: true }, "marketing"], [{ oficina: true }, "oficina"], [{}, "escena"]] as const) {
      const html = renderToStaticMarkup(createElement(PantallaNuevo, props))
      expect(html, foto).toContain("data-foto-de-carga")
      expect(html, foto).toContain(`/nuevo/${foto}-1280.webp`); expect(html, foto).toContain(`/nuevo/${foto}-2560.webp`)
      expect(html, foto).toContain("data-esqueleto-barra"); expect(html, foto).toContain("data-esqueleto-chat")
      expect(html, foto).toContain("Preparando la oficina")
    }
  })
  it("la foto de carga ocupa el mismo lugar que la escena de verdad, sin bloquear toques", () => {
    const f = readFileSync("components/nuevo/PantallaNuevo.tsx", "utf8")
    expect(f).toContain("pointer-events-none fixed inset-0 z-[59]")
    expect(f.match(/absolute inset-x-0 bottom-40 top-14 flex items-center justify-center px-4 sm:px-16/g)?.length).toBe(2)
  })
  it("el sello de Spline se oculta por varios caminos (enlace, id con «logo», cualquier ancla del visor)", () => {
    const v = readFileSync("components/nuevo/VidaSpline.tsx", "utf8")
    expect(v).toContain('[id*="logo"]'); expect(v).toContain('a[href*="spline.design"]'); expect(v).toContain("MutationObserver")
  })
})
