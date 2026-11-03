import { describe, expect, it } from "vitest"
import { createElement, type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { cuadrosDelPizarron, REDES_DEL_PIZARRON } from "@/lib/escena-metricas"
import { FranjaDeLasRedes, botonesDeLaFranja, LADO_MINIMO_DEL_BOTON } from "@/components/nuevo/escena/FranjaDeLasRedes"

function buscar(n: ReactNode, ok: (e: ReactElement<Record<string, unknown>>) => boolean, sal: ReactElement<Record<string, unknown>>[] = []) {
  if (Array.isArray(n)) n.forEach((x) => buscar(x, ok, sal))
  else if (n && typeof n === "object" && "props" in n) { const e = n as ReactElement<Record<string, unknown>>; if (ok(e)) sal.push(e); buscar(e.props.children as ReactNode, ok, sal) }
  return sal
}
const metricas = { cliente: "nau", lectura: "sin_datos" as const, cuadros: cuadrosDelPizarron(["instagram"], { estado: "sin_datos", motivo: "métricas pronto" }) }

describe("CC4 · redes del pizarrón · botones de verdad (auditoría 16)", () => {
  it("son 9 botones: General, las 7 redes (todas, tengan cuenta o no) y la vitrina, en ese orden, cada uno con su nombre y su estado", () => {
    const b = botonesDeLaFranja(metricas, null)
    expect(b.map((x) => x.clave)).toEqual(["general", ...REDES_DEL_PIZARRON.map((r) => r.clave), "vitrina"])
    expect(b).toHaveLength(9)
    expect(b.find((x) => x.clave === "instagram")?.estado).toBe("métricas pronto"); expect(b.find((x) => x.clave === "tiktok")?.estado).toBe("sin cuenta todavía")
    expect(b.find((x) => x.clave === "vitrina")?.estado).toBe("mejores piezas"); expect(botonesDeLaFranja(metricas, "Post uno").at(-1)?.estado).toBe("Post uno")
    expect(botonesDeLaFranja(undefined, null).map((x) => x.clave)).toEqual(["vitrina"])
  })
  it("tocar cada botón llama a onAbrir con su clave (se ejecuta el clic, no se lee)", () => {
    const abiertas: string[] = []
    const arbol = FranjaDeLasRedes({ botones: botonesDeLaFranja(metricas, null), onAbrir: (k) => abiertas.push(k) }) as ReactElement
    const botones = buscar(arbol, (e) => e.type === "button")
    expect(botones).toHaveLength(9)
    for (const x of botones) (x.props.onClick as () => void)()
    expect(abiertas).toEqual(["general", "instagram", "facebook", "tiktok", "youtube", "whatsapp", "web", "google_maps", "vitrina"])
  })
  it("cada botón mide al menos 44×44 (estilo mínimo), tiene nombre accesible con su estado y la franja se parte en filas si no cabe", () => {
    expect(LADO_MINIMO_DEL_BOTON).toBeGreaterThanOrEqual(44)
    const h = renderToStaticMarkup(createElement(FranjaDeLasRedes, { botones: botonesDeLaFranja(metricas, null), onAbrir: () => {} }))
    expect(h.match(/min-width:44px;min-height:44px/g)).toHaveLength(9)
    expect(h).toContain('aria-label="TikTok: sin cuenta todavía"'); expect(h).toContain('aria-label="Instagram: métricas pronto"'); expect(h).toContain('aria-label="Vitrina: mejores piezas"')
    expect(h).toContain("flex-wrap"); expect(h).toContain("data-franja-de-redes")
  })
  it("la escena la monta sobre la zona vacía de arriba del pizarrón y la vitrina abre su panel, las redes el del pizarrón con su clave", () => {
    const a = readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")
    expect(a).toContain("<FranjaDeLasRedes"); expect(a).toContain('width: "76%"'); expect(a).toContain("pct(70, FOTO.h)")
    expect(a).toContain('k === "vitrina" ? { tipo: "vitrina" } : { tipo: "pizarron", clave: k }')
  })
})
