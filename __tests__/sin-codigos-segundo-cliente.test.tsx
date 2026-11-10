// @vitest-environment jsdom
/**
 * CORRECCIÓN Lenovo a TODOS (10-nov 13:16Z, punto 4): nada se prueba con un solo cliente. Segundo cliente de OTRO rubro: un proveedor industrial B2B
 * de equipos de protección (textos DE PRÁCTICA, escritos para la prueba; no son de un cliente real). Lo que se vigila:
 *  - los códigos DEL SISTEMA se van igual que con Náufrago (documentos, versiones del sistema, ideas, fotos conocidas);
 *  - los DATOS DEL CLIENTE se quedan: normas, referencias de producto entre comillas, lotes, versiones de sus productos, códigos internos, voltajes, RUC.
 * La sonda con este cliente encontró que antes se borraban la referencia `4005678` y «el kit v2 del cliente».
 */
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { createElement } from "react"
import { readFileSync } from "node:fs"
import { sinCodigos } from "@/lib/sin-codigos"
import { PanelGranIdea } from "@/components/nuevo/PanelGranIdea"
import { PlanEnSecciones } from "@/components/nuevo/PlanEnSecciones"

afterEach(cleanup)
const CODIGO = /\b(?:brf|con|pln|man|pie|rev|cam)-[0-9a-f]{6,}|\bC\d+-I\d+\b|foto:|\(revisi[oó]n\)|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/u

/** datos del cliente industrial que NO deben tocarse */
const DATOS = [
  "Casco dieléctrico Clase E según ANSI Z89.1-2014 y NTE INEN 146; arnés de 4 puntos, talla única.",
  "Guantes de nitrilo calibre 8 mil, referencia `4005678`, norma EN 388:2016 (4121X).",
  "Línea de vida retráctil de 6 m con absorbedor, certificación CE 0158; carga máxima 140 kg.",
  "El kit v2 del cliente incluye botas punta de acero (EN ISO 20345:2022 S3) y overol ignífugo.",
  "Tablero 220V, 60 Hz, IP65; tornillo M8; modelo X5-200; versión 3.1 del manual de seguridad.",
  "Lote `aaaaaaaa` y código interno ACD-4412; color de marca #ff6a00; RUC 1791234567001.",
  "Precio por volumen: US$ 12,50 la unidad desde 100 (con IVA); entrega en 48 h.",
]

describe("segundo cliente (industrial B2B): los datos del cliente se quedan", () => {
  it("normas, referencias, lotes, versiones de sus productos, códigos internos, voltajes y RUC no se tocan", () => {
    for (const t of DATOS) expect(sinCodigos(t)).toBe(t)
  })
  it("un número entre comillas solo se va si es una foto conocida del cliente", () => {
    expect(sinCodigos("referencia `4005678`")).toBe("referencia `4005678`")
    expect(sinCodigos("foto del casco: `40056781`.", { fotos: ["40056781"] })).toBe("foto del casco.")
    expect(sinCodigos("en el resumen sin comillas: 40056781 y 12345678", { fotos: ["40056781"] })).toBe("en el resumen sin comillas: y 12345678")
  })
})

describe("segundo cliente (industrial B2B): los códigos del sistema se van igual", () => {
  it("documento, versión del sistema, idea e identificadores", () => {
    expect(sinCodigos("El brief (brf-7c1d22aa90ef v2) pide hablarle al jefe de seguridad de planta.")).toBe("El brief pide hablarle al jefe de seguridad de planta.")
    expect(sinCodigos("Se trasladó intacto desde v3 del brief; el plan v2 manda.")).toBe("Se trasladó intacto desde la versión 3 del brief; el plan manda.")
    expect(sinCodigos("Testimonio en video (propuesto en v1) — descartado; la v2 lo cambió.\nv4 es la que manda")).toBe("Testimonio en video (propuesto en la versión 1) — descartado; la versión 2 lo cambió.\nVersión 4 es la que manda")
    expect(sinCodigos("la idea C2-I05 trae «0 accidentes en 2025», que no está en el brief")).toBe("la idea 5 del capítulo 2 trae «0 accidentes en 2025», que no está en el brief")
    expect(sinCodigos("Concepto con-7c1d22aa90ef-v4 listo; revisión `b7e2f9a1`.")).toBe("Concepto listo; revisión.")
  })
  it("la gran idea de este cliente se ve sin códigos y con sus datos intactos", async () => {
    const g = JSON.parse(readFileSync("__tests__/fixtures/naufrago-gran-idea-10-nov.json", "utf8"))
    g.cliente = { id: "00000000-0000-4000-8000-0000000000b2", nombre: "Proveedor industrial de práctica" }
    g.clientes = [g.cliente]
    const d = g.detalle
    d.titulo = "Gran idea · con-7c1d22aa90ef-v2 · Cero accidentes"
    d.gran_idea = { nombre: "Cero accidentes, cero excusas (con-7c1d22aa90ef-v2)", frase: "El equipo que tu planta necesita, certificado y a tiempo." }
    d.avisos = ["la idea C1-I02 trae «48 h», que no está en el brief: dato sin fuente"]
    d.por_que_funciona = "El brief (brf-7c1d22aa90ef v2) nombra al comprador técnico: " + DATOS[0]
    d.como_se_ve = `Fotos de planta reales (\`foto:40056781\`). ${DATOS[1]} ${DATOS[3]}`
    d.como_suena = "Técnico y directo, de usted. " + DATOS[4]
    d.caminos_descartados = "- Testimonio en video (propuesto en v1) — descartado. " + DATOS[5]
    d.devolucion_del_brief = DATOS[6]
    d.fotos_citadas = ["40056781"]
    for (const c of d.capitulos) { c.nombre = `Capítulo de planta (C${c.clave ?? 1}-I01)`; c.que_cuenta = DATOS[2]; for (const s of c.series) s.nombre = "Serie de normas" }
    g.fotos = { "40056781": "https://x.supabase.co/storage/v1/object/public/fotos/casco.jpg" }
    const r = render(createElement(PanelGranIdea, { onCerrar: () => {}, datosIniciales: g, fetchImpl: (async () => new Response("{}", { status: 404 })) as unknown as typeof fetch }))
    await new Promise((x) => setTimeout(x, 30))
    for (let k = 0; k < 3; k++) for (const b of r.container.querySelectorAll<HTMLButtonElement>("[data-bloque][data-abierta='false'] > button")) fireEvent.click(b)
    const visto = r.container.textContent ?? ""
    expect(visto).toContain("Cero accidentes, cero excusas")
    expect(visto).not.toMatch(CODIGO)
    for (const t of DATOS) expect(visto).toContain(t) // los datos del cliente, enteros
    expect(r.container.querySelectorAll("[data-bloque='como_se_ve'] [data-miniatura]")).toHaveLength(1)
  })
  it("el documento en secciones de este cliente: sin códigos, sus datos enteros, y la foto conocida fuera también del resumen", () => {
    const prosa = `## Brief creativo · Proveedor industrial · brf-7c1d22aa90ef · v2 (revisión)\n\nPara jefes de seguridad de planta.\n\n## Citas\n\nFotos de planta: \`40056781\`. ${DATOS[1]}`
    const r = render(createElement(PlanEnSecciones, { prosa, sinDatosClave: true, fotosConocidas: ["40056781"] }))
    const visto = r.container.textContent ?? ""
    expect(visto).not.toMatch(CODIGO)
    expect(visto).not.toContain("40056781")
    expect(visto).toContain("referencia `4005678`".replace(/`/g, "")) // el número del cliente sigue (el documento quita las comillas de formato)
    expect(visto).toContain("Brief creativo · Proveedor industrial")
  })
  it("un documento sin secciones (texto corrido) también sale sin códigos y con los datos del cliente", () => {
    const r = render(createElement(PlanEnSecciones, { prosa: `Borrador (brf-7c1d22aa90ef v2): foto \`40056781\`. ${DATOS[1]}`, sinDatosClave: true, fotosConocidas: ["40056781"] }))
    const visto = r.container.textContent ?? ""
    expect(visto).not.toMatch(CODIGO)
    expect(visto).not.toContain("40056781")
    expect(visto).toContain(DATOS[1])
  })
})
