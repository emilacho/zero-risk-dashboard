/** LA ANTENA CON SU NÚMERO (Emilio 06-nov 01:51 local: «el número no necesita fondo… el resto aprobado»). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { AntenaDeAlertas, PanelDeLasAlertas } from "@/components/nuevo/escena/AntenaDeAlertas"
import { ANTENA, type AlertaDeLaAntena } from "@/lib/escena-alertas"

const AHORA = Date.parse("2026-11-06T10:00:00Z")
const A = (clave: string, abre: AlertaDeLaAntena["abre"], horas: number): AlertaDeLaAntena => ({ clave, tipo: "fallida", texto: `aviso ${clave}`, cuando: new Date(AHORA - horas * 3_600_000).toISOString(), abre })
const antena = (alertas: AlertaDeLaAntena[] | undefined) => renderToStaticMarkup(createElement("svg", null, createElement(AntenaDeAlertas, { alertas, onAbrir: () => {} })))

describe("el número de la antena", () => {
  it("🔴 con avisos: el número rojo, solo, sin círculo ni fondo detrás, arriba a la derecha de la luz", () => {
    const h = antena([A("a", "envivo", 1), A("b", null, 2), A("c", "decisiones", 3)])
    const t = h.match(/<text data-numero-antena[^>]*>([^<]*)<\/text>/)
    expect(t?.[1]).toBe("3")
    expect(t?.[0]).toContain('class="fill-alarma font-medio"')
    expect(t?.[0]).toContain(`x="${ANTENA.punta2.x + 30}"`); expect(t?.[0]).toContain(`y="${ANTENA.punta2.y - 26}"`)
    const c = readFileSync("components/nuevo/escena/AntenaDeAlertas.tsx", "utf8")
    const cerca = c.split("data-numero-antena")[0].split("\n").slice(-3).join("\n") + c.split("data-numero-antena")[1].split("\n")[0]
    expect(cerca).not.toMatch(/<circle|<rect|<ellipse|paint-order|stroke=/) // nada detrás ni alrededor del número
  })
  it("🔴 sin avisos: ni número ni luz", () => {
    expect(antena([])).toBe("<svg></svg>"); expect(antena(undefined)).toBe("<svg></svg>")
  })
})

describe("la lista al tocarla, en estilo base", () => {
  it("🔴 ALERTAS con la ✕, Dept. Marketing, el número en rojo en su recuadro y cada aviso con su punto, cuándo y qué abre", () => {
    const h = renderToStaticMarkup(createElement(PanelDeLasAlertas, { alertas: [A("a", "envivo", 1), A("b", "observabilidad", 48), A("c", null, 5)], onAbrir: () => {}, onCerrar: () => {}, ahora: AHORA }))
    expect(h).toMatch(/data-estilo="base"[\s\S]*>Alertas<\/h2>[\s\S]*data-cerrar/)
    expect(h).toContain("Dept. <span")
    expect(h).toMatch(/data-recuadro-alertas[^>]*border-linea-alarma[\s\S]*data-numero[^>]*text-alarma[^>]*>3</); expect(h).toContain("Avisos abiertos")
    expect(h).toContain(">hace una hora · abre En vivo<"); expect(h).toContain(">hace 2 días · abre Observabilidad<")
    expect(h).toContain(">hace 5 horas<") // sin lugar: no dice «abre» y el botón queda quieto
    expect((h.match(/rounded-full bg-alarma/g) ?? []).length).toBe(3)
    expect((h.match(/<button type="button" disabled=""/g) ?? []).length).toBe(1)
  })
  it("🔴 sin avisos: «Todo en orden», número sin rojo", () => {
    const h = renderToStaticMarkup(createElement(PanelDeLasAlertas, { alertas: [], onAbrir: () => {}, onCerrar: () => {} }))
    expect(h).toContain("Todo en orden"); expect(h).not.toContain("text-alarma"); expect(h).not.toContain("border-linea-alarma")
  })
  it("🔴 se abre encima con su propio panel y sigues en Dept. Marketing (no en el marco viejo del pizarrón); Esc lo cierra", () => {
    const av = readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")
    expect(av).toContain('{panelTablero?.tipo === "antena" && <PanelDeLasAlertas')
    expect(av).toContain('{panelTablero && panelTablero.tipo !== "antena" && (')
    const c = readFileSync("components/nuevo/escena/AntenaDeAlertas.tsx", "utf8")
    expect(c).toContain('if (e.key !== "Escape") return; e.stopPropagation(); e.preventDefault(); onCerrar()')
  })
  it("sin avisos de dinero en la antena (firmado)", () => {
    expect(readFileSync("lib/escena-alertas.ts", "utf8")).toContain("export const GASTO_RARO_EN_LA_ANTENA = false")
  })
})
