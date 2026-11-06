/**
 * CC4 · 06-nov · encargo de Lenovo «panel del plan · errores», punto 2 (acordado con CC1 en `2026-11-06-RESPUESTA-CC1-a-CC4-LENOVO-CC6-panel-del-plan-puntos-2-y-3.md`):
 * las fases, las redes, los pilares y la semana tipo salen de la ESTRATEGIA de la campaña, que se arma después de aprobar el plan. Sin estrategia no se muestran
 * como campos que faltan: una sola línea con el paso en que va. Nada se lee de la prosa del plan para llenarlos (eso llega con la ficha estructurada del redactor).
 * El presupuesto sí se lee de su sección (ya era así): el plan real la titula «El presupuesto» y no se encontraba.
 */
import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { estrategiaDelContenido, lineaSinEstrategia, type CicloDelPlan } from "@/lib/plan"
import { datosClave, seccionesDelPlan } from "@/lib/plan-documento"
import { barraDelPlan } from "@/lib/plan-barra"
import type { PlanDelCliente } from "@/lib/plan-datos"
import { PanelPlan } from "@/components/nuevo/PanelPlan"
import { BarraDelPlan } from "@/components/nuevo/plan/BarraDelPlan"
import { faseActiva } from "@/lib/pizarron"

const CLIENTE = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
// el comienzo real del plan r3 de Náufrago (títulos y la sección del presupuesto, tal cual)
const PROSA = "# Plan de campaña · Náufrago · 90 días\n**4 de noviembre de 2026 – 1 de febrero de 2027**\n\n## Resumen ejecutivo\n\nLlegar a 130 tickets por semana.\n\n## El presupuesto\n\n**Moneda de trabajo:** los datos vienen en USD. Ecuador opera con dólar.\n\n**Presupuesto declarado:** $200/semana en pauta [D123].\n\n---\n\n### Cómo se calcula desde la meta\n\nCon ticket promedio de $10,63 [D142].\n\n## Hoja de ruta · 90 días por semanas con fechas\n\n### DESBLOQUEAR · Semanas 1–2\n"
const ciclo: CicloDelPlan = { disponible: true, version: 1, historial: [], con_compuerta: true, compuerta: { estado: "pendiente", decidido_por: null, decidido_en: null, despertado: null, despertar_detalle: null }, pedido: null, avance: null }
const datos = (o: Partial<PlanDelCliente> = {}): PlanDelCliente => ({
  clientes: [{ id: CLIENTE, nombre: "Náufrago", con_campana: false }], cliente: { id: CLIENTE, nombre: "Náufrago" }, hoy: "2026-11-06",
  campana: null, estrategia: null, fase_activa: faseActiva([], null, "2026-11-06"), revision: null, esperas: { vivas: 0, grupos: [], vencidas: { n: 0, grupos: [] } }, topes: [], leido_en: "x", manual_aprobado: true,
  documento: { id: "p1", titulo: "Plan de campaña · Náufrago · 90 días", creado_en: null, actualizado_en: null, status: "draft", estado_del_plan: null, marcas: [], aviso_del_chequeo: [], no_se_busco: [], jefatura: null, plan: null, prosa: PROSA, caracteres: PROSA.length, que_cambio: null },
  ciclo, ...o,
})
const pinta = (d: PlanDelCliente) => renderToStaticMarkup(createElement(PanelPlan, { onCerrar: () => {}, datosIniciales: d }))
const VACIOS_DE_LA_ESTRATEGIA = ["La estrategia todavía no trae fases.", "La estrategia todavía no reparte las redes.", "Sin pilares en la estrategia.", "La estrategia todavía no fija una semana tipo.", "Sin estrategia todavía."]

describe("sin estrategia: una sola línea con el paso en que va, nunca campos vacíos", () => {
  it("la línea según el paso del plan", () => {
    expect(lineaSinEstrategia({ hay_documento: true, estado_del_ciclo: "esperando_decision" })).toBe("Las fases, las redes, los pilares y la semana tipo se arman cuando apruebes el plan.")
    expect(lineaSinEstrategia({ hay_documento: true, estado_del_ciclo: "aprobado" })).toBe("Las fases, las redes, los pilares y la semana tipo se están armando con el plan que aprobaste.")
    expect(lineaSinEstrategia({ hay_documento: true, estado_del_ciclo: "en_preparacion" })).toContain("cuando llegue el plan nuevo")
    expect(lineaSinEstrategia({ hay_documento: true, estado_del_ciclo: "sin_plan_vigente" })).toContain("cuando llegue el plan nuevo")
    expect(lineaSinEstrategia({ hay_documento: false, estado_del_ciclo: null })).toContain("cuando el plan esté escrito")
  })
  it("el panel sin estrategia: la línea una vez y ninguno de los vacíos de la estrategia", () => {
    const html = pinta(datos())
    expect(html.match(/data-sin-estrategia/g)?.length).toBe(1)
    expect(html).toContain("se arman cuando apruebes el plan.")
    for (const v of VACIOS_DE_LA_ESTRATEGIA) expect(html).not.toContain(v)
    expect(html).not.toContain(">Redes y ritmo<"); expect(html).not.toContain(">Pilares de contenido<"); expect(html).not.toContain(">Las fases<")
  })
  it("con el plan cerrado y el nuevo escribiéndose, la línea lo dice", () => {
    const d = datos({ ciclo: { ...ciclo, cerrado: { estado: "rechazado", motivo: null }, preparando: { desde: null, vence_en: null } } })
    // la línea del cuerpo del panel (la barra del costado lleva la suya aparte)
    expect(pinta(d).match(/data-sin-estrategia[^>]*>([^<]*)/)?.[1]).toBe("Las fases, las redes, los pilares y la semana tipo se arman cuando llegue el plan nuevo y lo apruebes.")
    expect(barraDelPlan(d).sin_estrategia).toContain("cuando llegue el plan nuevo")
  })
  it("control: con estrategia (aunque esté vacía) vuelven las secciones con sus propios avisos y no sale la línea", () => {
    const html = pinta(datos({ estrategia: { version: 1, estado: "lista", creada_en: null, costo_usd: null, texto_md: null, ...estrategiaDelContenido({}) } }))
    expect(html).not.toContain("data-sin-estrategia")
    expect(html).toContain("La estrategia todavía no trae fases."); expect(html).toContain("Sin pilares en la estrategia.")
  })
  it("la barra: fases y sedes dicen el paso, no «todavía no tiene fases»; con estrategia, vuelve lo de siempre", () => {
    const b = barraDelPlan(datos())
    expect(b.sin_estrategia).toBe("Las fases, las redes, los pilares y la semana tipo se arman cuando apruebes el plan.")
    const html = renderToStaticMarkup(createElement(BarraDelPlan, { b }))
    expect(html).not.toContain("La estrategia todavía no tiene fases."); expect(html).not.toContain("Sin sedes ni canales todavía.")
    expect(html).toContain("Se definen con la estrategia, después de aprobar el plan.")
    const con = barraDelPlan(datos({ estrategia: { version: 1, estado: "lista", creada_en: null, costo_usd: null, texto_md: null, ...estrategiaDelContenido({}) } }))
    expect(con.sin_estrategia).toBeNull()
    const htmlCon = renderToStaticMarkup(createElement(BarraDelPlan, { b: con }))
    expect(htmlCon).toContain("La estrategia todavía no tiene fases."); expect(htmlCon).toContain("Sin sedes ni canales todavía.")
  })
})

describe("el presupuesto se lee de su sección aunque el título diga «El presupuesto»", () => {
  it("con el texto real: «$200/semana en pauta», sin la cita", () => {
    const pres = datosClave(seccionesDelPlan(PROSA)).find((x) => x.clave === "presupuesto")
    expect(pres?.valor).toContain("$200/semana en pauta"); expect(pres?.valor).not.toMatch(/\[D|USD\. Ecuador/)
    expect(barraDelPlan(datos()).presupuesto).toContain("$200/semana")
  })
  it("no confunde otra sección que solo menciona el presupuesto", () => {
    const doc = seccionesDelPlan("# P\n\n## Lo que cambia el presupuesto\n\nUn gasto de $50 extra.\n")
    expect(datosClave(doc).find((x) => x.clave === "presupuesto")?.valor).toBeNull()
  })
})
