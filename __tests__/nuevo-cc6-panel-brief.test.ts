/** EL BRIEF CON EL PATRÓN DEL PLAN Y EL MANUAL (CC6 · 02-nov · boceto aprobado por Emilio). Solo lectura. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PanelBrief } from "@/components/nuevo/PanelBrief"
import { briefDesdeFila, loQueSigueDelBrief, QUIEN_ESCRIBE_EL_BRIEF } from "@/lib/brief"

const CLIENTE = { id: "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", nombre: "Náufrago" }
const TEXTO = "## Insight\nEn Olón, el encebollado es desayuno de domingo.\n\n## Un solo mensaje\nEl encebollado de la costa, sin salir de casa.\n\n## Presupuesto\n$200 por semana"
const panel = (briefs: ReturnType<typeof briefDesdeFila>[]) => renderToStaticMarkup(createElement(PanelBrief, { onCerrar: () => {}, datosIniciales: { clientes: [CLIENTE], cliente: CLIENTE, campana: { id: "c", estado: "activa" }, publicado: true, briefs, leido_en: "x" } }))

describe("el brief", () => {
  it("en secciones plegables como el plan, sin las tarjetas de datos clave del plan, y sin botones (no se firma)", () => {
    const h = panel([briefDesdeFila({ id: "b1", version: 1, estado: "validada", texto_md: TEXTO, creada_en: "2026-11-02T10:00:00Z" })])
    expect(h).toContain('data-seccion="insight"'); expect(h).toContain('data-seccion="un-solo-mensaje"')
    expect(h).not.toContain("data-dato=") // las tarjetas de fechas/presupuesto/meta son del plan
    expect(h).not.toMatch(/Aprobar|Pedir cambios/)
    expect(h).toContain("no se firma")
  })
  it("la barra fija: estado, de dónde sale con el nombre real del empleado, lo que sigue", () => {
    const h = panel([briefDesdeFila({ id: "b1", version: 1, estado: "validada", texto_md: TEXTO })])
    expect(h).toContain("data-barra-del-brief"); expect(h).toMatch(/lg:sticky/)
    expect(h).toContain(QUIEN_ESCRIBE_EL_BRIEF); expect(QUIEN_ESCRIBE_EL_BRIEF).toBe("campaign-brief-agent")
    expect(h).toContain("La sala creativa propone la gran idea")
    expect(h).not.toMatch(/versión 1|v1\b/) // sin números de versión a la vista
  })
  it("con varias versiones, la lista va en la barra (por fecha y estado); con una sola, no", () => {
    const dos = panel([briefDesdeFila({ id: "b2", version: 2, estado: "validada", texto_md: TEXTO, creada_en: "2026-11-02T11:00:00Z" }), briefDesdeFila({ id: "b1", version: 1, estado: "devuelta", texto_md: TEXTO, devolucion_texto: "Falta el tono", creada_en: "2026-11-02T10:00:00Z" })])
    expect(dos).toContain('data-barra="versiones"'); expect((dos.match(/data-nodo-brief=/g) ?? []).length).toBe(2)
    expect(panel([briefDesdeFila({ id: "b1", version: 1, estado: "validada", texto_md: TEXTO })])).not.toContain('data-barra="versiones"')
  })
  it("lo que sigue, según el estado", () => {
    expect(loQueSigueDelBrief("devuelta")).toMatch(/lo rehace/); expect(loQueSigueDelBrief("en_mesa")).toMatch(/está escribiendo/); expect(loQueSigueDelBrief("reemplazada")).toMatch(/más nueva/)
  })
})
