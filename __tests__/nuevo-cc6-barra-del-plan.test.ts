/** LA BARRA LATERAL DEL PLAN (CC6 · 02-nov · boceto aprobado por Emilio): datos reales; sin cifras de gasto (viven en Dinero). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { barraDelPlan } from "@/lib/plan-barra"
import { BarraDelPlan } from "@/components/nuevo/plan/BarraDelPlan"
import type { PlanDelCliente } from "@/lib/plan-datos"

const PROSA = "# PLAN\n**Olón · 2 de noviembre de 2026 – 24 de enero de 2027**\n\n## Resumen\nEl número que persigue el plan: 130 tickets semanales.\n\n## Presupuesto\n- Pauta: $200 por semana\n"
const base = (o: Partial<PlanDelCliente> = {}): PlanDelCliente => ({
  clientes: [], cliente: { id: "c", nombre: "Náufrago" }, hoy: "2026-11-02", leido_en: "",
  campana: { id: "k", estado: "pausada", estado_motivo: "pausa de pruebas", desde: "2026-11-02", hasta: "2027-01-30", sedes: ["guayaquil", "olon"], tope_planeacion_usd: 6, autoproducir: true, publicaciones: 1, version_calendario: 1, creada_en: null, actualizada_en: null },
  estrategia: { version: 1, estado: "validada", creada_en: null, costo_usd: null, texto_md: null, fases: [{ clave: "b", objetivo: "Recompra", dia_desde: 31, dia_hasta: 60 }, { clave: "a", objetivo: "Señal", dia_desde: 1, dia_hasta: 30 }], redes: [{ red: "instagram", rol: "principal", motivo: "", formatos: [], feed_semana: 1, historias_semana: 0, anuncios_semana: 0 }, { red: "linkedin", rol: "no", motivo: "", formatos: [], feed_semana: 0, historias_semana: 0, anuncios_semana: 0 }], excluidos: [], pilares: [], hitos: [], dependencias: [], fechas_que_importan: [], patron_semanal: [], piezas_fijas: [], pendientes: [], alertas: [] },
  fase_activa: { situacion: "en_curso", fase: null, dia: 1, dias_para_empezar: null },
  documento: { id: "d", titulo: "", creado_en: null, actualizado_en: null, status: "draft", estado_del_plan: null, marcas: [], aviso_del_chequeo: [], no_se_busco: [], jefatura: null, plan: null, prosa: PROSA, caracteres: 0, que_cambio: null },
  revision: null, palabra_del_dueno: [], esperas: { vivas: 2, grupos: [{ tipo: "aprobacion_bandeja", etiqueta: "", n: 2, vence_primero: null }], vencidas: { n: 0, grupos: [] } }, topes: [],
  ciclo: { disponible: true, version: 2, con_compuerta: true, historial: [], compuerta: { estado: "pendiente", decidido_por: null, decidido_en: null, despertado: null, despertar_detalle: null }, pedido: null, avance: null, avance_de: null, comparacion_fallo: false } as never,
  ...o,
})

describe("la barra del plan (pura)", () => {
  it("datos reales: fechas de la campaña, meta y presupuesto del documento, sedes, canales que se usan, fases ordenadas con la de hoy", () => {
    const b = barraDelPlan(base())
    expect(b.fechas).toEqual({ texto: "2 nov → 30 ene · 13 semanas", detalle: null })
    expect(b.meta).toMatch(/130 tickets semanales/)
    expect(b.presupuesto).toMatch(/\$200 por semana/)
    expect(b.sedes).toEqual(["Guayaquil", "Olón"])
    expect(b.canales).toEqual(["Instagram"]) // la red con rol «no» no entra
    expect(b.fases.map((f) => `${f.clave}:${f.estado}`)).toEqual(["a:en_curso", "b:por_venir"])
    expect(b.dia).toBe(1); expect(b.total_dias).toBe(90)
  })
  it("lo que te toca: decidir el plan, la bandeja y la campaña pausada; nunca un dato que no le corresponde pedir al dueño", () => {
    const t = barraDelPlan(base()).te_toca
    expect(t[0]).toBe("Aprobar el plan o pedir cambios")
    expect(t).toContain("2 aprobaciones en tu bandeja")
    expect(t.some((x) => /pausada \(pausa de pruebas\)/.test(x))).toBe(true)
  })
  it("sin campaña: las fechas del documento, rotuladas; sin plan: se dice que falta", () => {
    expect(barraDelPlan(base({ campana: null })).fechas).toEqual({ texto: "2 de noviembre de 2026 – 24 de enero de 2027", detalle: "según el documento (todavía sin campaña)" })
    const vacia = barraDelPlan(base({ campana: null, estrategia: null, documento: null, ciclo: null, esperas: { vivas: 0, grupos: [], vencidas: { n: 0, grupos: [] } } }))
    expect(vacia).toMatchObject({ decision: null, meta: null, fechas: null, presupuesto: null, fases: [], te_toca: [] })
  })
})

describe("la meta entera (Lenovo 02-nov: no se corta en la parte importante)", () => {
  const LARGA = "El número que persigue el plan: 130 tickets semanales promedio los jueves a lunes al cierre de la semana 12 (24 de enero de 2027), frente a los ~103 semanales estimados del período de octubre. Es una meta provisional: se recalcula con la base propia real y con la señal de las primeras cuatro semanas."
  const conMetaLarga = () => base({ documento: { ...base().documento!, prosa: `# PLAN\n**Olón · 2 de noviembre de 2026 – 24 de enero de 2027**\n\n## Resumen\n${LARGA}\n` } })
  it("la barra trae la línea completa, no el resumen recortado", () => {
    expect(barraDelPlan(conMetaLarga()).meta).toBe(LARGA)
  })
  it("en pantalla: completa en el texto, con «Ver más» si es larga", () => {
    const h = renderToStaticMarkup(createElement(BarraDelPlan, { b: barraDelPlan(conMetaLarga()) }))
    expect(h).toContain("se recalcula con la base propia real"); expect(h).toContain('data-accion="ver-meta"'); expect(h).toContain("Ver más"); expect(h).not.toMatch(/provisional:…/)
  })
})

describe("la barra del plan en pantalla", () => {
  it("los siete bloques del boceto, sin cifras de gasto, y fija al bajar en el panel", () => {
    const h = renderToStaticMarkup(createElement(BarraDelPlan, { b: barraDelPlan(base()) }))
    expect([...h.matchAll(/data-barra="([a-z-]+)"/g)].map((x) => x[1])).toEqual(["decision", "meta", "fechas", "presupuesto", "sedes-y-canales", "fases", "te-toca"])
    expect(h).toContain("Hoy es el día 1 de 90."); expect(h).toContain("Tomado de la sección «Presupuesto» del plan. Lo gastado está en Dinero.")
    expect(h).not.toContain("Lo que propone el plan") // un solo rótulo, verdadero (Lenovo 02-nov)
    expect(h).not.toMatch(/gastado:|US\$ \d/)
    const panel = readFileSync("components/nuevo/PanelPlan.tsx", "utf8")
    expect(panel).toContain("<BarraDelPlan b={barraDelPlan(datos)} />"); expect(panel).toMatch(/aria-label="Lo esencial del plan" className="[^"]*lg:sticky/)
  })
  it("sin datos dice qué falta", () => {
    const h = renderToStaticMarkup(createElement(BarraDelPlan, { b: barraDelPlan(base({ campana: null, estrategia: null, documento: null, ciclo: null, esperas: { vivas: 0, grupos: [], vencidas: { n: 0, grupos: [] } } })) }))
    expect(h).toContain("Todavía no hay plan escrito."); expect(h).toContain("La estrategia todavía no tiene fases."); expect(h).toContain("Nada pendiente de tu lado.")
  })
})
