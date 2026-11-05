import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { sinCodigosDeFicha, textoDeLaMesa } from "@/lib/informe-legible"
import { analisisDesdeFila, tipoDeAnalisisLegible } from "@/lib/informes"
import { PanelInformes } from "@/components/nuevo/PanelInformes"

/** GO de Lenovo, 05-nov: el informe abierto, sin códigos ni la palabra «ficha». Los textos salen de las 4 fichas reales del 01-nov (`3b0df105`, `41baa190`, `cf0f29d8`, `bdfb6130`) */
describe("el informe de la mesa, sin códigos ni «ficha»", () => {
  it.each([
    ["varios con «ficha:» y punto medio", "todas clasificadas como «Marisquería» [ficha:1c91df08 · ficha:6733fe3e · ficha:100f7be2] · las fichas confirman categoría", "todas clasificadas como «Marisquería» · las fuentes confirman categoría"],
    ["con fecha, unidos por «y»", "se apoya en fichas [6a9f94b0 · 2026-11-02] y [e8f664a3 · 2026-11-03], calendario oficial", "se apoya en fuentes, calendario oficial"],
    ["uno solo con fecha, en singular", "se apoya en ficha [4c6febd8 · 2026-10-30], análisis de las 10", "se apoya en una fuente, análisis de las 10"],
    ["solo números", "la temporada lluviosa costera [79396597] activa en paralelo", "la temporada lluviosa costera activa en paralelo"],
    ["seguidos", "4 comentarios y 1 reseña [41294896] [28b966de] [4697ad5f] [034a97ab]. De las 62", "4 comentarios y 1 reseña. De las 62"],
    ["código completo, detrás de «·»", "sin superlativo · [28b966de-40ad-4b49-88ae-02d49b8f306c] [41294896-e82b-4ec4-b7dc-3068f25e08d6] · Oportunidad: el plan", "sin superlativo · Oportunidad: el plan"],
    ["suelto en la frase", "Las reseñas 113f3e02 y 2cad4b07 son copias de un mismo texto, igual que 1e4e4245 y 46db8383. Cada par cuenta una sola vez.", "Las reseñas son copias de un mismo texto. Cada par cuenta una sola vez."],
    ["dentro de un paréntesis con más texto", "(el material solo trae el parcial de oct 2026 [ficha:e349b28e]). Sigue", "(el material solo trae el parcial de oct 2026). Sigue"],
    ["palabra suelta, concuerda", "Ninguna de las fichas leídas lo elogia. Base: 27 de 50 fichas.", "Ninguna de las fuentes leídas lo elogia. Base: 27 de 50 fuentes."],
    ["con mayúscula", "Fichas revisadas: 9.", "Fuentes revisadas: 9."],
  ])("%s", (_n, entra, sale) => {
    expect(textoDeLaMesa(entra)).toBe(sale)
  })

  it("no recorta palabras con ñ o tilde al limpiar lo que queda colgando", () => {
    expect(textoDeLaMesa("volumen sostenido del año; el plan")).toBe("volumen sostenido del año; el plan")
    expect(textoDeLaMesa("Según el dueño. Ya está. Vino aquí con él.")).toBe("Según el dueño. Ya está. Vino aquí con él.")
  })
  it("la ficha del mundo real se queda", () => {
    expect(textoDeLaMesa("revisar Instagram y ficha de Google Maps de cada rival")).toBe("revisar Instagram y ficha de Google Maps de cada rival")
    expect(textoDeLaMesa("la ficha de Mapas y la ficha técnica")).toBe("la ficha de Mapas y la ficha técnica")
  })
  it("no se lleva cifras, productos ni palabras que parecen códigos", () => {
    for (const t of ["El combo (ab12cd34) se vende bien", "Llama al 09912345 hoy", "Vendió 20261101 unidades", "Una década de sabor", "Dato [6a0f94b]", "[usuario omitido] comentó"]) expect(textoDeLaMesa(t)).toBe(t)
  })
  it("respeta los saltos de línea, para cuando la puerta deje de borrarlos", () => {
    expect(textoDeLaMesa("## Mercado\n\n- Uno [ficha:1c91df08]\n- Dos · [6a9f94b0 · 2026-11-02]\n\nFin")).toBe("## Mercado\n\n- Uno\n- Dos\n\nFin")
  })
  it.each([
    "Mira https://x.com/foto/1a2b3c4d hoy",
    "Mira https://x.com/1a2b3c4d/foto hoy",
    "Mira https://x.com/ficha/9 y https://x.com/ficha-9 hoy",
    "La [nota](https://x.com/1a2b3c4d) sigue",
    "Archivo a1b2c3d4.jpg listo",
    "La etiqueta #1a2b3c4d sigue",
    "La cuenta @ab12cd34 sigue",
    "Escribe a a1b2c3d4@x.com hoy",
  ])("no rompe direcciones, archivos ni cuentas: %s", (t) => {
    expect(textoDeLaMesa(t)).toBe(t)
  })
  it("el código al final de una frase sí se va", () => {
    expect(textoDeLaMesa("Lo dice 1a2b3c4d. Luego sigue.")).toBe("Lo dice. Luego sigue.")
  })
  it("quitar un código no se come el salto de línea, en corchetes ni suelto", () => {
    expect(textoDeLaMesa("Uno [6a9f94b0]\n[e8f664a3] dos")).toMatch(/^Uno\n ?dos$/)
    expect(textoDeLaMesa("Uno 113f3e02\n2cad4b07 dos")).toMatch(/^Uno\n ?dos$/)
  })
  it("una palabra hexadecimal sin número y una cifra de 8 se quedan", () => {
    expect(textoDeLaMesa("La marca deadbeef sigue")).toBe("La marca deadbeef sigue")
    expect(textoDeLaMesa("Vendió 12345678 unidades")).toBe("Vendió 12345678 unidades")
    expect(textoDeLaMesa("Marca [deadbeef] sigue")).toBe("Marca sigue") // entre corchetes y con 8 es una cita
  })
  it("«ficha» con código sin corchetes se va entera, también con solo números", () => {
    expect(textoDeLaMesa("Lo dijo ficha:12345678 ayer")).toBe("Lo dijo ayer")
  })
  it("limpiar dos veces da lo mismo", () => {
    const una = textoDeLaMesa("se apoya en fichas [6a9f94b0 · 2026-11-02] y [e8f664a3 · 2026-11-03], calendario")
    expect(textoDeLaMesa(una)).toBe(una)
  })
  it("no cambia a los otros informes: el limpiador general sigue igual", () => {
    expect(sinCodigosDeFicha("Las fichas del curso")).toBe("Las fichas del curso")
  })
  it("el panel abierto pinta el texto limpio; lo guardado no se toca", () => {
    const contenido = "[informe de análisis · mercado · PROPUESTA: no es dato del cliente] Las fichas dicen esto [6a9f94b0 · 2026-11-02] y [79396597]."
    const a = analisisDesdeFila({ id: "x", titulo: "Informe · mercado · corte 2026-11-01", contenido, creado_en: "2026-11-01T16:34:51Z", provenance_tag: { datos: { tipo: "mercado", agente: "market_research_analyst" } } })
    expect(a.texto).toContain("[79396597]")
    const h = renderToStaticMarkup(createElement(PanelInformes, { onCerrar: () => {}, datosIniciales: { clientes: [{ id: "c", nombre: "Náufrago" }], cliente: { id: "c", nombre: "Náufrago" }, informes: [], analisis: [a], leido_en: "x" } }))
    expect(h).toContain("Las fuentes dicen esto.")
    expect(h).not.toMatch(/6a9f94b0|79396597|[Ff]ichas?\b/)
  })
})

describe("los tipos y los analistas de la mesa se leen bien", () => {
  it("con tilde y sin nombres de sistema", () => {
    expect(tipoDeAnalisisLegible("retencion")).toBe("Retención")
    expect(tipoDeAnalisisLegible("escucha_x")).toBe("Escucha en X")
  })
  it.each([["feedback-synthesizer", "Analista de voz del público"], ["competitive-intelligence-agent", "Analista de competencia"], ["x-twitter-intelligence-analyst", "Analista de escucha en X"], ["growth-hacker", "Analista de crecimiento"]])("%s", (agente, nombre) => {
    expect(analisisDesdeFila({ id: "x", provenance_tag: { datos: { agente } } }).analista).toBe(nombre)
  })
})
