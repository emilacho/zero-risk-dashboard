/** EL BRIEF CON EL PATRÓN DEL PLAN Y EL MANUAL (CC6 · 02-nov · boceto aprobado por Emilio). Solo lectura. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PanelBrief } from "@/components/nuevo/PanelBrief"
import { briefDesdeFila, loQueSigueDelBrief } from "@/lib/brief"
import { conQuienesEscribieron } from "@/lib/brief-datos"
import type { SupabaseClient } from "@supabase/supabase-js"

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
  it("la barra fija: estado, de dónde sale con el nombre real del empleado (leído, no fijo), lo que sigue", () => {
    const h = panel([{ ...briefDesdeFila({ id: "b1", version: 1, estado: "validada", texto_md: TEXTO }), quienes_escribieron: ["campaign-brief-agent", "content-strategist"] }])
    expect(h).toContain("data-barra-del-brief"); expect(h).toMatch(/lg:sticky/)
    expect(h).toContain('data-escribio="campaign-brief-agent"'); expect(h).toContain('data-escribio="content-strategist"')
    expect(panel([briefDesdeFila({ id: "b1", version: 1, estado: "validada", texto_md: TEXTO })])).toContain("sin registro de qué empleado lo escribió")
    expect(h).toContain("La sala creativa propone la gran idea")
    expect(h).not.toMatch(/versión 1|v1\b/) // sin números de versión a la vista
  })
  it("con varias versiones, la lista va en la barra (por fecha y estado); con una sola, no", () => {
    const dos = panel([briefDesdeFila({ id: "b2", version: 2, estado: "validada", texto_md: TEXTO, creada_en: "2026-11-02T11:00:00Z" }), briefDesdeFila({ id: "b1", version: 1, estado: "devuelta", texto_md: TEXTO, devolucion_texto: "Falta el tono", creada_en: "2026-11-02T10:00:00Z" })])
    expect(dos).toContain('data-barra="versiones"'); expect((dos.match(/data-nodo-brief=/g) ?? []).length).toBe(2)
    expect(panel([briefDesdeFila({ id: "b1", version: 1, estado: "validada", texto_md: TEXTO })])).not.toContain('data-barra="versiones"')
  })
  it("quién lo escribió: de los aportes de su encargo, sin «sistema» ni repetidos; si la lectura falla, sin nombres", async () => {
    const base = (data: unknown, error: unknown = null) => ({ from: () => { const q: Record<string, unknown> = {}; for (const m of ["select", "in", "order", "limit"]) q[m] = () => q; q.then = (r: (x: unknown) => unknown) => r({ data, error }); return q } }) as unknown as SupabaseClient
    const briefs = [briefDesdeFila({ id: "b1", version: 1, estado: "validada", encargo_id: "e1" }), briefDesdeFila({ id: "b0", version: 0, estado: "devuelta" })]
    const r = await conQuienesEscribieron(base([{ encargo_id: "e1", de: "sistema", n: 1 }, { encargo_id: "e1", de: "campaign-brief-agent", n: 2 }, { encargo_id: "e1", de: "campaign-brief-agent", n: 3 }]), briefs)
    expect(r[0].quienes_escribieron).toEqual(["campaign-brief-agent"]); expect(r[1].quienes_escribieron).toEqual([])
    expect((await conQuienesEscribieron(base(null, { message: "caída" }), briefs))[0].quienes_escribieron).toEqual([])
  })
  it("lo que sigue, según el estado", () => {
    expect(loQueSigueDelBrief("devuelta")).toMatch(/lo rehace/); expect(loQueSigueDelBrief("en_mesa")).toMatch(/está escribiendo/); expect(loQueSigueDelBrief("reemplazada")).toMatch(/más nueva/)
  })
})
