/** TEXTOS DE LOS PANELES DE CAMPAÑA QUE NO SE LEÍAN BIEN (CC6 · 03-nov · sprint dashboard · ENCARGO-LENOVO-a-CC6-textos-de-los-paneles-de-campana). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { sinCodigosDeFicha, textoDelInforme } from "@/lib/informe-legible"
import { DocumentoLegible } from "@/components/nuevo/DocumentoLegible"
import { estadoDeCampanaLegible, estadoDelClienteEnElSelector } from "@/lib/lenguaje"
import { GRAN_IDEA_SIN_TABLA } from "@/lib/pizarron-datos"
import { textoDeLaFase } from "@/components/nuevo/PanelPizarron"

// la forma del informe que vio la auditoría: ** a la vista y códigos de ficha
const INFORME = "[informe de análisis semanal · 2026-11-01]\n## Lo que pasó esta semana\n**Frescura** sigue siendo lo más comentado [6a0f94b0…]. Las reseñas suben (ficha 9b1c22de).\n- Encebollado: 409 ventas [ficha 6a0f94b0, 3e4d5c6b]\n- WhatsApp: 12 pedidos según la ficha 7f7f7f70\n\nLlamar al (593123) para confirmar."

describe("1 · Informes: se leen como un documento", () => {
  it("sin códigos de ficha ni la palabra «ficha»; un teléfono entre paréntesis se queda", () => {
    const t = textoDelInforme(INFORME)
    expect(t).not.toMatch(/[0-9a-f]{8}|ficha|\[informe de an/i)
    expect(t).toContain("**Frescura** sigue siendo lo más comentado. Las reseñas suben.")
    expect(t).toContain("- Encebollado: 409 ventas")
    expect(t).toContain("- WhatsApp: 12 pedidos\n") // sin «según la» colgando
    expect(t).toContain("(593123)") // solo números: no es un código
    expect(sinCodigosDeFicha("Una década (decade) de sabor")).toBe("Una década (decade) de sabor") // solo letras: tampoco
  })
  it("reservas de CC3: entre paréntesis solo se quita con «ficha» o «…»; un código mide 8 o más; «Ver [ficha …].» se va entero", () => {
    expect(sinCodigosDeFicha("El combo (ab1234) se vende bien")).toBe("El combo (ab1234) se vende bien") // código de producto: se queda
    expect(sinCodigosDeFicha("El lote (ab12cd34) llegó")).toBe("El lote (ab12cd34) llegó") // 8, pero sin «ficha» ni «…» entre paréntesis
    expect(sinCodigosDeFicha("Sube la venta (ab12cd34…).")).toBe("Sube la venta.")
    expect(sinCodigosDeFicha("Dato [6a0f94b]")).toBe("Dato [6a0f94b]") // 7: no es el principio de una ficha
    expect(sinCodigosDeFicha("Dato [6a0f94b0]")).toBe("Dato")
    expect(sinCodigosDeFicha("Las reseñas suben. Ver [ficha 6a0f94b0…]. Sigue el plan.")).toBe("Las reseñas suben. Sigue el plan.")
    expect(sinCodigosDeFicha("Las reseñas suben (véase [6a0f94b0…]).")).toBe("Las reseñas suben.")
    // anexo 1 de CC3: si la cita era toda la oración, se va con su punto; el verbo no queda colgado
    expect(sinCodigosDeFicha("Ver [ficha 6a0f94b0…].")).toBe("")
    expect(sinCodigosDeFicha("Fuente: [6a0f94b0]. Luego sigue.")).toBe("Luego sigue.")
    expect(sinCodigosDeFicha("Sube la venta. Según [6a0f94b0, 9b1c22de]. Luego sigue.")).toBe("Sube la venta. Luego sigue.")
    expect(sinCodigosDeFicha("Sube mucho, véase (ficha 6a0f94b0…), en Olón.")).toBe("Sube mucho, en Olón.")
  })
  it("en pantalla: títulos de verdad, viñetas, negritas reales; sin ** a la vista", () => {
    const h = renderToStaticMarkup(createElement(DocumentoLegible, { texto: INFORME }))
    expect(h).toMatch(/<h4[^>]*>Lo que pasó esta semana<\/h4>/)
    expect(h).toMatch(/<strong[^>]*>Frescura<\/strong>/)
    expect(h).toMatch(/<ul[^>]*>\s*<li>Encebollado: 409 ventas<\/li>/)
    expect(h).not.toMatch(/\*\*|ficha|6a0f94b0/i)
  })
  it("el panel usa la vista de documento para el informe de la mesa y para el resumen; sin «fichas citadas» ni la nota interna", () => {
    const p = readFileSync("components/nuevo/PanelInformes.tsx", "utf8")
    expect(p).toContain("<DocumentoLegible texto={textoDeLaMesa(a.texto)} />"); expect(p).toContain("{b.parrafo && <DocumentoLegible texto={b.parrafo} />}")
    expect(p).not.toMatch(/ficha citada|fichas citadas|whitespace-pre-wrap rounded-lg|lo que el cerebro tiene/)
  })
})

describe("2 · Centro de campaña: el selector y el paso 3 dicen lo mismo", () => {
  it("una campaña reemplazada es la anterior, archivada (nunca «en preparación»); sin campaña dice «sin campaña»; en marcha, nada", () => {
    expect(estadoDeCampanaLegible("reemplazada")).toBe("archivada")
    expect(estadoDeCampanaLegible("necesita_humano")).toBe("esperando tu decisión")
    expect(estadoDelClienteEnElSelector({ con_campana: false, estado_campana: "reemplazada" })).toBe(" · campaña archivada")
    expect(estadoDelClienteEnElSelector({ con_campana: false, estado_campana: "borrador" })).toBe(" · campaña en borrador")
    expect(estadoDelClienteEnElSelector({ con_campana: false, estado_campana: null })).toBe(" · sin campaña")
    expect(estadoDelClienteEnElSelector({ con_campana: false })).toBe(" · sin campaña")
    expect(estadoDelClienteEnElSelector({ con_campana: true, estado_campana: "activa" })).toBe("")
  })
  it("el paso 3 y el selector salen de la MISMA campaña: con la última reemplazada, los dos dicen «archivada»", () => {
    const paso3 = textoDeLaFase({ campana: { id: "c", estado: "reemplazada", desde: null, hasta: null, del_plan_anterior: false, momento_del_plan: null } as never, fase_activa: { situacion: "sin_fecha" } as never })
    expect(paso3).toBe("Campaña archivada")
    expect(estadoDelClienteEnElSelector({ con_campana: false, estado_campana: "reemplazada" })).toContain("campaña archivada")
  })
  it("06-nov · selector único: la etiqueta del estado vive solo en el selector de arriba (Centro, Calendario y Plan sin selector propio), y las dos lecturas guardan el estado de la última campaña", () => {
    expect(readFileSync("components/nuevo/SelectorDeCliente.tsx", "utf8")).toContain("estadoDeCampanaLegible(c.estado_campana)") // 09-nov: siempre el estado real de la última
    for (const f of ["components/nuevo/PanelAplicaciones.tsx", "components/nuevo/PanelPizarron.tsx", "components/nuevo/PanelPlan.tsx"]) {
      const s = readFileSync(f, "utf8")
      expect(s, f).not.toContain("<select"); expect(s, f).not.toContain('" · sin campaña"'); expect(s, f).toContain("useAlCambiarElCliente(")
    }
    for (const f of ["lib/pizarron-datos.ts", "lib/plan-datos.ts"]) expect(readFileSync(f, "utf8"), f).toContain("estado_campana: ultima.get(c.id) ?? null")
  })
})

describe("3 · Calendario: sin frases internas", () => {
  it("la nota de la gran idea ya no habla de la mesa «diseñada (31-oct) pero no construida»", () => {
    expect(GRAN_IDEA_SIN_TABLA.nota).toBe("Todavía no hay gran idea para esta campaña.")
    expect(readFileSync("lib/pizarron-datos.ts", "utf8")).not.toMatch(/nota: "[^"]*(diseñada|construida|31-oct)/)
  })
})
