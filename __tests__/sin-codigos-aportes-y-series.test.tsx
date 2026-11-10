// @vitest-environment jsdom
/**
 * GO Lenovo 10-nov 14:10Z: «A1», «S1» (aportes y series) también se ocultan al mostrar; los nombres de los empleados se quedan.
 * SOLO los aportes de la mesa del encargo de ese documento y las series de ese concepto: un «A4» o un «S1» que no está en esa lista es del cliente
 * (un papel A4, un modelo A1, una talla S) y se queda. Con un registro REAL (Náufrago: briefs v1-v3 y concepto v3, aportes leídos de producción) y un
 * segundo cliente de otro rubro (industrial B2B), como pide la CORRECCIÓN de Lenovo del 10-nov 13:16Z.
 */
import { describe, expect, it } from "vitest"
import { fireEvent, render } from "@testing-library/react"
import { createElement } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { seriesSinRepetir, sinCodigos } from "@/lib/sin-codigos"
import { aportesPorNumero, conQuienesEscribieron } from "@/lib/brief-datos"
import { PlanEnSecciones } from "@/components/nuevo/PlanEnSecciones"
import { PanelGranIdea } from "@/components/nuevo/PanelGranIdea"
import { PanelBrief } from "@/components/nuevo/PanelBrief"
import { quienesPropusieron } from "@/lib/gran-idea-datos"
import type { Brief } from "@/lib/brief"
import APORTES from "./fixtures/naufrago-aportes-10-nov.json"
import BRIEF from "./fixtures/naufrago-brief-10-nov.json"
import GRAN_IDEA from "./fixtures/naufrago-gran-idea-10-nov.json"

const encargos = APORTES.encargos as Record<string, Array<{ n: number; de: string }>>
const aportesDe = (encargo: string) => aportesPorNumero(encargos[encargo] ?? [])
/** un «A<n>» que el sistema escribe: como palabra entera */
const codigoDeAporte = /(?<![\p{L}\p{N}_-])A\d+(?![\p{L}\p{N}_-])/u

describe("1 · el brief real de Náufrago: los aportes de su mesa en palabras", () => {
  const v3 = BRIEF.briefs.find((b) => b.version === 3)!
  const v2 = BRIEF.briefs.find((b) => b.version === 2)!
  it("la lista sale de la mesa: número → quién (vacío si fue el sistema)", () => {
    const a = aportesDe(v3.encargo_id!)
    expect(a["3"]).toBe("campaign-brief-agent")
    expect(a["2"]).toBe("portero")
    expect(aportesPorNumero([{ n: 7, de: "sistema" }, { n: 8, de: "  " }])).toEqual({ "7": "", "8": "" })
  })
  it("v3: «El aporte A3» y «(A3, el brief v3 propio)» dicen de quién, sin el código", () => {
    const t = sinCodigos(v3.texto_md, { aportes: aportesDe(v3.encargo_id!) })
    expect(t).toContain("El aporte de campaign-brief-agent ya contiene el brief completo")
    expect(t).toContain("(campaign-brief-agent, el brief propio)")
    expect(t).not.toMatch(codigoDeAporte)
  })
  it("v2: las citas «**A1 usé:**» y «**A5 usé parcialmente:**» se leen «Usé el aporte de …»", () => {
    const t = sinCodigos(v2.texto_md, { aportes: aportesDe(v2.encargo_id!) })
    expect(t).toContain("**Usé el aporte de oficina-creativa:**")
    expect(t).toContain("**Usé parcialmente el aporte de competitive-intelligence-agent:**")
    expect(t).not.toMatch(codigoDeAporte)
  })
  it("en pantalla (el brief en secciones, con todo abierto) no queda ningún «A<n>» de su mesa", () => {
    for (const b of BRIEF.briefs) {
      const { container } = render(createElement(PlanEnSecciones, { prosa: b.texto_md!, sinDatosClave: true, aportes: aportesDe(b.encargo_id!), abiertasIniciales: Array.from({ length: 40 }, (_, i) => `s${i}`) }))
      const visible = container.textContent ?? ""
      for (const n of Object.keys(aportesDe(b.encargo_id!))) expect(visible).not.toMatch(new RegExp(`(?<![\\p{L}\\p{N}_-])A${n}(?![\\p{L}\\p{N}_-])`, "u"))
    }
  })
  it("el panel del brief entero (secciones, devolución y motivo, cerrado y abierto) usa los aportes de cada versión", async () => {
    const datos = JSON.parse(JSON.stringify(BRIEF)) as typeof BRIEF & { briefs: Array<Record<string, unknown>> }
    for (const b of datos.briefs) b.aportes = aportesDe(String(b.encargo_id))
    datos.briefs[0].devolucion_texto = "Lo devuelvo. Falta la fuente de A3."
    datos.briefs[0].motivo = "rehecho con el aporte A2"
    const r = render(createElement(PanelBrief, { onCerrar: () => {}, datosIniciales: datos as never, fetchImpl: (async () => new Response("{}", { status: 404 })) as unknown as typeof fetch }))
    await new Promise((x) => setTimeout(x, 30))
    const abrir = () => { for (let k = 0; k < 3; k++) for (const b of r.container.querySelectorAll<HTMLButtonElement>("[data-bloque][data-abierta='false'] > button, [data-seccion][data-abierta='false'] > button")) fireEvent.click(b) }
    expect(r.container.textContent).toContain("rehecho con el aporte de portero")
    expect(r.container.textContent).toContain("Falta la fuente de campaign-brief-agent.")
    abrir()
    expect(r.container.querySelectorAll("[data-seccion][data-abierta='true']").length).toBeGreaterThan(3)
    expect(r.container.textContent).toContain("Usé el aporte de oficina-creativa: material del portero")
    expect(r.container.textContent).not.toMatch(codigoDeAporte)
  })
  it("un aporte del sistema (sin nombre) tras «de» o «a» se contrae: «del aporte 4», «al aporte 4»", () => {
    const a = { "4": "" }
    expect(sinCodigos("el resumen de A4 y lo sumé a A4", { aportes: a })).toBe("el resumen del aporte 4 y lo sumé al aporte 4")
  })
  it("sin la lista de la mesa no se toca nada (no se adivina)", () => {
    expect(sinCodigos("El aporte A3 ya contiene", {})).toBe("El aporte A3 ya contiene")
  })
})

describe("2 · la gran idea real: los aportes de la sala y las series", () => {
  const sala = aportesDe(APORTES.concepto)
  it("«(prompt de A12)», «propuesto en A17», «curaduría de A21», «(A16/A22)» dicen de quién", () => {
    const d = GRAN_IDEA.detalle as unknown as Record<string, string> & { capitulos: Array<{ como_se_ve: string }> }
    expect(sinCodigos(d.capitulos[0].como_se_ve, { aportes: sala })).toContain("(prompt de design-image-prompt-engineer)")
    const c = sinCodigos(d.caminos_descartados, { aportes: sala })
    expect(c).toContain("propuesto en el aporte de video-editor como Camino 2")
    expect(c).not.toMatch(codigoDeAporte)
    expect(c).toContain("El aporte de tiktok-strategist se trasladó") // «(A16/A22)», los dos de tiktok-strategist: el nombre ya está, no se repite
  })
  it("en pantalla, con los aportes que trae el lector, ningún «A<n>» de la sala queda a la vista", () => {
    const { container } = render(createElement(PanelGranIdea, { onCerrar: () => {}, datosIniciales: { ...GRAN_IDEA, aportes: sala } as never, fetchImpl: (async () => new Response("{}", { status: 404 })) as unknown as typeof fetch }))
    for (const b of container.querySelectorAll<HTMLButtonElement>("[data-bloque][data-abierta='false'] > button")) b.click()
    expect(container.textContent ?? "").not.toMatch(/(?:prompt de|propuesto en|curaduría de) A\d+/)
  })
  it("las series: en Náufrago «S1» nombra una serie distinta en cada capítulo → es ambiguo y NO se traduce", () => {
    const series = seriesSinRepetir((GRAN_IDEA.detalle as unknown as { capitulos: Array<{ series: Array<{ id: string; nombre: string }> }> }).capitulos)
    expect(series.S1).toBeUndefined()
    expect(sinCodigos("la serie S1 abre", { series })).toBe("la serie S1 abre")
  })
  it("una serie que el concepto nombra una sola vez se dice por su nombre", () => {
    const series = seriesSinRepetir([{ series: [{ id: "S1", nombre: "La leyenda se confirma" }, { id: "S2", nombre: "El hábito" }] }, { series: [{ id: "S2", nombre: "El hábito" }] }])
    expect(sinCodigos("S1 abre y la serie S2 cierra", { series })).toBe("La serie «La leyenda se confirma» abre y la serie «El hábito» cierra")
  })
})

describe("3 · segundo cliente (industrial B2B): sus «A4», «A1» y «S» se quedan", () => {
  // una mesa con 9 aportes: los números 1-9 SÍ son aportes; el texto del cliente igual nombra papel A4, la norma A1 y tallas S/M
  const mesa = aportesPorNumero(Array.from({ length: 9 }, (_, i) => ({ n: i + 1, de: i % 2 ? "content-creator" : "market-research-analyst" })))
  const texto = "Catálogo impreso en papel A4. Guantes norma A1 (resistencia al corte), talla S y M. Modelo A9 descontinuado. El aporte A3 resume el pedido; A2 usé: la lista de precios."
  it("lo del cliente no cambia; lo de la mesa sí", () => {
    const t = sinCodigos(texto, { aportes: mesa, series: { S1: "Planta" } })
    expect(t).toContain("papel A4")
    expect(t).toContain("norma A1 (resistencia al corte)")
    expect(t).toContain("talla S y M")
    expect(t).toContain("Modelo A9 descontinuado")
    expect(t).toContain("El aporte de market-research-analyst resume el pedido")
    expect(t).toContain("; usé el aporte de content-creator: la lista de precios")
  })
  it("en un documento de VARIAS líneas, lo del cliente sigue intacto (una línea anterior que termina en punto no cuenta como «al empezar»)", () => {
    const doc = "## Ficha del pedido\n\nEl pedido está confirmado.\n\nTamaño: A4. Catálogo en papel A4 y guantes norma A1.\n- talla S y M\n\nEl aporte A3 resume el pedido."
    const t = sinCodigos(doc, { aportes: mesa })
    expect(t).toContain("Tamaño: A4. Catálogo en papel A4 y guantes norma A1.")
    expect(t).toContain("El aporte de market-research-analyst resume el pedido.")
  })
  it("un «A<n>» de la mesa entre paréntesis o tras una barra en una cita sí se dice por su nombre, también en un documento largo", () => {
    const doc = "Primera línea.\n\nEl brief (A3, el borrador) y la cita (A2/A4) se usan."
    expect(sinCodigos(doc, { aportes: mesa })).toBe("Primera línea.\n\nEl brief (market-research-analyst, el borrador) y la cita (content-creator) se usan.")
  })
  it("un «A12» que la mesa no tuvo se queda aunque esté en posición de cita", () => {
    expect(sinCodigos("(A12, la ficha técnica)", { aportes: mesa })).toBe("(A12, la ficha técnica)")
  })
  it("límite declarado: un «de A4» del cliente en un documento cuyo encargo tuvo un aporte 4 se cambia", () => {
    expect(sinCodigos("hojas de A4", { aportes: mesa })).toBe("hojas de content-creator")
  })
})

describe("4b · el lector de la gran idea trae los aportes de la sala de ese concepto", () => {
  it("encargo del concepto → sus aportes por número (con el registro real de la sala de Náufrago)", async () => {
    const tablas: Record<string, unknown> = { cadena_conceptos: { encargo_id: APORTES.concepto }, oficina_mesa_aportes: encargos[APORTES.concepto] }
    const supa = { from: (t: string) => {
      const q: Record<string, unknown> = {}
      for (const m of ["select", "eq", "in", "order", "limit"]) q[m] = () => q
      q.maybeSingle = () => q
      q.then = (ok: (x: unknown) => unknown) => Promise.resolve({ data: tablas[t] ?? null, error: null }).then(ok)
      return q
    } } as unknown as SupabaseClient
    const sala = await quienesPropusieron(supa, "k", 3)
    expect(sala.aportes["12"]).toBe("design-image-prompt-engineer")
    expect(sala.aportes).toEqual(aportesDe(APORTES.concepto))
    expect(sala.quienes).toContain("creative-director-mesa")
  })
})

describe("4 · el lector del brief trae los aportes de cada versión", () => {
  it("cada brief con los de SU encargo (no los de otro)", async () => {
    const filas = [
      { encargo_id: "e1", n: 1, de: "oficina-creativa" }, { encargo_id: "e1", n: 2, de: "portero" },
      { encargo_id: "e2", n: 1, de: "sistema" }, { encargo_id: "e2", n: 2, de: "content-creator" },
    ]
    const q: Record<string, unknown> = {}
    for (const m of ["select", "in", "order", "limit"]) q[m] = () => q
    q.then = (ok: (x: unknown) => unknown) => Promise.resolve({ data: filas, error: null }).then(ok)
    const supa = { from: () => q } as unknown as SupabaseClient
    const b = (id: string, encargo_id: string) => ({ id, version: 1, estado: "borrador", texto_md: null, leido: null, devolucion_texto: null, motivo: null, costo_usd: null, seco: false, creada_en: null, actualizada_en: null, encargo_id }) as Brief
    const [x, y] = await conQuienesEscribieron(supa, [b("1", "e1"), b("2", "e2")])
    expect(x.aportes).toEqual({ "1": "oficina-creativa", "2": "portero" })
    expect(y.aportes).toEqual({ "1": "", "2": "content-creator" })
  })
})
