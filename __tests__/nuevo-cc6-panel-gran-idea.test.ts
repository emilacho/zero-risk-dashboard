/** LA GRAN IDEA CON EL PATRÓN DEL PLAN Y EL MANUAL (CC6 · 02-nov · boceto aprobado por Emilio). La decisión es la de siempre (no se rehace). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PanelGranIdea } from "@/components/nuevo/PanelGranIdea"
import { avanceDeGranIdea, AL_APROBAR_LA_GRAN_IDEA } from "@/lib/gran-idea"
import type { DetalleDelConcepto } from "@/lib/concepto-datos"

const CLIENTE = { id: "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", nombre: "Náufrago" }
const concepto = (p: Partial<DetalleDelConcepto> = {}): DetalleDelConcepto => ({
  hitl_id: "h1", status: "pending", estado: "pendiente", titulo: "Gran idea v1", cliente: "Náufrago", cliente_id: CLIENTE.id, creada: "2026-11-02T10:00:00Z", campana_id: "c", version: 1, concepto_id: "k",
  seco: false, costo_usd: 0.9, vueltas_restantes: 2, avisos: [], gran_idea: { nombre: "El mar en la mesa", frase: "Cada plato es una marea." }, por_que_funciona: "Porque Olón vive del mar.", como_se_ve: "Azul y dorado", como_suena: "Olas", fotos_citadas: [],
  capitulos: [{ clave: "c1", fase: "senal", nombre: "Recién salido", que_cuenta: "El plato del día", objetivo_cita: "", como_se_ve: "", series: [] }], banco: [], resumen: { total: 0, por_red: {}, por_capitulo: {}, ejemplos: {}, parcial: [] },
  caminos_descartados: "", devolucion_del_brief: null, brief: { version: 1, estado: "validada", texto_md: "## Insight\nx" }, aprobacion: null, nota_de_emilio: null, apunta_a: null, decidido_en: null, sin_concepto: null, ...p,
})
const base = { clientes: [CLIENTE], cliente: CLIENTE, campana: { id: "c", estado: "activa" }, publicado: true, leido_en: "x" }
const tarjeta = (d: DetalleDelConcepto) => ({ hitl_id: d.hitl_id, status: d.status, estado: d.estado, titulo: d.titulo, creada: d.creada, version: d.version })

describe("la gran idea", () => {
  it("la idea y la decisión arriba; el resto en secciones plegables con su resumen; sin número de versión a la vista", () => {
    const d = concepto()
    const h = renderToStaticMarkup(createElement(PanelGranIdea, { onCerrar: () => {}, datosIniciales: { ...base, tarjetas: [tarjeta(d)], detalle: d, quienes_propusieron: ["creative-director-mesa", "content-creator"] } }))
    expect(h.indexOf('data-accion="aprobar-gran-idea"')).toBeLessThan(h.indexOf('data-bloque="por_que_funciona"'))
    expect(h).toContain('data-bloque="por_que_funciona" data-abierta="false"'); expect(h).toContain("Porque Olón vive del mar.") // cerrada, con su resumen
    expect(h).toContain('data-bloque="capitulos"'); expect(h).toContain("Recién salido")
    expect(h).not.toMatch(/Versión \d|v\d ·/)
  })
  it("la barra fija: estado, el brief que leyó la sala, quién la propuso con el nombre real, qué pasa al aprobar", () => {
    const d = concepto()
    const h = renderToStaticMarkup(createElement(PanelGranIdea, { onCerrar: () => {}, datosIniciales: { ...base, tarjetas: [tarjeta(d)], detalle: d, quienes_propusieron: ["creative-director-mesa", "content-creator"] } }))
    expect(h).toContain("data-barra-de-la-gran-idea"); expect(h).toMatch(/lg:sticky/)
    expect(h).toContain("creative-director-mesa"); expect(h).toContain("content-creator")
    expect(h).toContain(AL_APROBAR_LA_GRAN_IDEA); expect(h).toContain(">Validado<")
  })
  it("sin aportes registrados lo dice (no inventa nombres)", () => {
    const d = concepto()
    const h = renderToStaticMarkup(createElement(PanelGranIdea, { onCerrar: () => {}, datosIniciales: { ...base, tarjetas: [tarjeta(d)], detalle: d, quienes_propusieron: [] } }))
    expect(h).toContain("sin aportes registrados")
  })
  it("tras «Pedir cambios», la barra de avance hasta que llega la propuesta nueva", () => {
    const d = concepto({ status: "rejected", estado: "con_cambios", decidido_en: "2026-11-02T10:30:00Z", nota_de_emilio: "Más gente comiendo" })
    const h = renderToStaticMarkup(createElement(PanelGranIdea, { onCerrar: () => {}, datosIniciales: { ...base, tarjetas: [tarjeta(d)], detalle: d } }))
    expect(h).toContain("data-barra-del-pedido"); expect(h).toContain("La sala creativa rehace la gran idea")
    expect(avanceDeGranIdea([{ estado: "pendiente", creada: "x" }, { estado: "con_cambios", creada: "y" }], null, new Date())).toBeNull() // ya llegó la nueva
    expect(avanceDeGranIdea([{ estado: "con_cambios", creada: "y" }], "2026-11-02T10:00:00Z", new Date("2026-11-02T10:12:00Z"))?.estimado).toBe("Van 12 min desde tu pedido")
  })
})
