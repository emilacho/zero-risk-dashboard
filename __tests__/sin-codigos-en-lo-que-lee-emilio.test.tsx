// @vitest-environment jsdom
/**
 * GO Lenovo 10-nov ~10:38Z · ocultar códigos del sistema en todo lo que lee Emilio. Una sola función (`lib/sin-codigos.ts`), solo al MOSTRAR.
 * Textos reales de Náufrago (brief v2, gran idea v3 y sus avisos), bajados de producción el 10-nov: `fixtures/naufrago-con-codigos-10-nov.json`.
 */
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { createElement } from "react"
import { readFileSync } from "node:fs"
import { fotosCitadas, sinCodigos, trozosSinCodigos } from "@/lib/sin-codigos"
import { TextoSinCodigos } from "@/components/nuevo/TextoSinCodigos"
import { PlanEnSecciones } from "@/components/nuevo/PlanEnSecciones"
import { tituloLimpio } from "@/lib/direccion-decisiones"
import { codigosDeFotos, direccionesDeFotos } from "@/lib/gran-idea-datos"

afterEach(cleanup)
const R = JSON.parse(readFileSync("__tests__/fixtures/naufrago-con-codigos-10-nov.json", "utf8")) as { avisos: string[]; por_que_funciona: string; como_se_ve: string; fotos_citadas: string[]; brief_v2_cabeza: string; brief_v3_inicio: string; brief_citas: string; idea_c107: string; fotos_del_cliente: string[] }
/** los códigos de las fotos propias de Náufrago que cita el brief (producción, 10-nov): solo esos se quitan cuando son solo números */
const CTX = { fotos: R.fotos_del_cliente }
/** ningún código del sistema queda a la vista */
const CODIGO = /\b(?:brf|con|pln|man|pie|rev|cam)-[0-9a-f]{6,}|\bC\d+-I\d+\b|foto:|(?<![\p{L}\p{N}_-])v\d+(?![\p{L}\p{N}_-])|\(revisi[oó]n\)|`[0-9a-f]{7,12}`|\b[0-9a-f]{8}-[0-9a-f]{4}-/u

describe("1 · los textos reales de Náufrago salen sin códigos", () => {
  it("la cabeza del brief v2: sin «brf-… · v2 (revisión)» y el título sigue entero", () => {
    expect(sinCodigos(R.brief_v2_cabeza).split("\n")[0]).toBe("## Brief creativo de campaña · Náufrago")
    expect(sinCodigos(R.brief_v2_cabeza)).toContain("## De qué parte del plan sale") // el resto del markdown no se toca
  })
  it("«El brief (brf-28de888eb3f2 v2) nombra el insight» → «El brief nombra el insight»", () => {
    expect(sinCodigos(R.por_que_funciona)).toMatch(/^El brief nombra el insight: «el guayaquileño/)
  })
  it("el brief v3: «el brief v3 completo» → «el brief completo»", () => {
    expect(sinCodigos(R.brief_v3_inicio)).toContain("ya contiene el brief completo con los cambios")
  })
  it("los 4 avisos de la gran idea v3 nombran la idea en palabras («la idea 8 del capítulo 1»), una sola vez", () => {
    expect(R.avisos.map((a) => sinCodigos(a))).toEqual([
      "la idea 8 del capítulo 1 trae un dato con valor (precio, hora, cifra): el estratega lo pone con su referencia",
      "la idea 3 del capítulo 3 trae un dato con valor (precio, hora, cifra): el estratega lo pone con su referencia",
      "la idea 8 del capítulo 1 trae «80 %», que no está en el brief: dato sin fuente",
      "la idea 3 del capítulo 3 trae «4.9», que no está en el brief: dato sin fuente",
    ])
  })
  it("una idea citada entre paréntesis («(C1-I03)») y, si se sabe, por su título", () => {
    expect(sinCodigos(R.idea_c107)).toBe("réplica del feed de producto de instagram (la idea 3 del capítulo 1) con llamado «Pide en naufrago.ec» ajustado al canal.")
    expect(sinCodigos("la idea C1-I08 trae «80 %»", { nombreDeIdea: (id) => (id === "C1-I08" ? "El bowl dorado" : null) })).toBe("la idea «El bowl dorado» trae «80 %»")
  })
  it("«Cómo se ve»: sin `foto:<id>`, sin paréntesis vacíos ni rayas sueltas; los colores (#1a0828) quedan", () => {
    const t = sinCodigos(R.como_se_ve)
    expect(t).toContain("caldo hirviendo, bowl cenital, pescado crudo. Fachada de Olón como prueba de origen.")
    expect(t).toContain("El personaje del náufrago (el esqueleto surfer")
    expect(t).toContain("(#1a0828)")
    expect(t).not.toMatch(/\(\s*\)|\(\s*[—–-]/)
  })
  it("las citas del brief: los códigos de foto sueltos (`19671014`) no se ven", () => {
    const t = sinCodigos(R.brief_citas, CTX)
    expect(t).toContain("fotos de producto (encebollado cenital), fachada del local (con el personaje del náufrago), y foto del caldo en cocina —")
  })
  it("ningún texto real deja un código a la vista", () => {
    for (const t of [...R.avisos, R.por_que_funciona, R.como_se_ve, R.brief_v2_cabeza, R.brief_v3_inicio, R.brief_citas, R.idea_c107]) expect(sinCodigos(t, CTX)).not.toMatch(CODIGO)
  })
  it("un identificador largo (uuid) suelto no se ve", () => {
    expect(sinCodigos("Revisión de la pieza 2d3c4da1-d3d5-40e0-b18e-d90e8652e001 lista")).toBe("Revisión de la pieza lista")
  })
})

describe("2 · lo que NO se toca", () => {
  it("palabras normales con v y números, horas, precios, colores y siglas se quedan", () => {
    const t = "Servicio 24/7 en la av. 9 de Octubre; nivel 2; Revolución, la v de victoria; US$ 4.50; #51d4b4; COVID-19; 3v3; vía rápida; abre 10:30; el café 1a2b3c4 sin comillas"
    expect(sinCodigos(t)).toBe(t)
  })
  it("el texto vacío o nulo sale vacío", () => { expect(sinCodigos(null)).toBe(""); expect(trozosSinCodigos(undefined)).toEqual([]) })
  it("el texto guardado no cambia: la función devuelve otro texto y deja el original igual", () => {
    const original = R.como_se_ve
    sinCodigos(original)
    expect(original).toContain("foto:6275c0ba")
  })
})

describe("3 · las fotos citadas: miniatura o nada", () => {
  const FOTOS = { "6275c0ba": "https://x.supabase.co/storage/v1/object/public/fotos/caldo.jpg", "19671014": "https://x.supabase.co/storage/v1/object/public/fotos/bowl.jpg" }
  it("los trozos separan cada grupo de fotos con sus códigos", () => {
    const t = trozosSinCodigos("caldo hirviendo (`foto:6275c0ba`), bowl cenital (`foto:19671014`, `foto:c0355f3d`).")
    expect(t).toEqual([{ texto: "caldo hirviendo" }, { fotos: ["6275c0ba"] }, { texto: ", bowl cenital" }, { fotos: ["19671014", "c0355f3d"] }, { texto: "." }])
  })
  it("con dirección conocida sale la miniatura (pedida chica); sin dirección, nada; nunca el código", () => {
    const r = render(createElement(TextoSinCodigos, { texto: "caldo hirviendo (`foto:6275c0ba`), bowl cenital (`foto:19671014`, `foto:c0355f3d`).", fotos: FOTOS }))
    const imgs = [...r.container.querySelectorAll<HTMLImageElement>("[data-miniatura]")]
    expect(imgs.map((i) => i.getAttribute("src"))).toEqual(["https://x.supabase.co/storage/v1/render/image/public/fotos/caldo.jpg?width=120&quality=70", "https://x.supabase.co/storage/v1/render/image/public/fotos/bowl.jpg?width=120&quality=70"])
    expect(r.container.textContent).toBe("caldo hirviendo, bowl cenital.")
    const sola = render(createElement(TextoSinCodigos, { texto: "pescado crudo (`foto:c0355f3d`).", fotos: FOTOS }))
    expect(sola.container.querySelectorAll("[data-fotos-citadas]")).toHaveLength(0)
    expect(sola.container.textContent).toBe("pescado crudo.")
  })
  it("un código suelto entre comillas que es una foto conocida también pone su miniatura", () => {
    const r = render(createElement(TextoSinCodigos, { texto: "encebollado cenital: `19671014`.", fotos: FOTOS }))
    expect(r.container.querySelectorAll("[data-miniatura]")).toHaveLength(1)
    expect(r.container.textContent).toBe("encebollado cenital.")
  })
  it("los códigos citados se juntan sin repetir para pedir sus direcciones", () => {
    expect(fotosCitadas(R.como_se_ve)).toEqual(["4f09cef2", "6275c0ba", "19671014", "c0355f3d", "e8da814f", "f5d887ec", "fe452b8f", "9f71b0e9", "4c41cd56"])
    expect(fotosCitadas("a `foto:6275c0ba` b `foto:6275C0BA`")).toEqual(["6275c0ba"])
    expect(codigosDeFotos({ fotos_citadas: ["4F09CEF2-aaaa"], como_se_ve: "x `foto:6275c0ba`", por_que_funciona: "", como_suena: "", caminos_descartados: "" })).toEqual(["4f09cef2", "6275c0ba"])
  })
  it("la dirección sale de las fotos propias del cliente por su código de 8; si la lectura falla, ninguna (la página no se rompe)", async () => {
    const supa = (data: unknown, error: unknown = null) => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ limit: async () => ({ data, error }) }) }) }) }) }) as never
    expect(await direccionesDeFotos(supa([{ id: "6275c0ba-1111-4000-8000-000000000000", url: "u1" }, { id: "ffffffff-0000-4000-8000-000000000000", url: "u2" }]), "c", ["6275c0ba"])).toEqual({ "6275c0ba": "u1" })
    expect(await direccionesDeFotos(supa(null, { message: "x" }), "c", ["6275c0ba"])).toEqual({})
    expect(await direccionesDeFotos(supa([{ id: "6275c0ba-1111-4000-8000-000000000000", url: "u1" }], { message: "a medias" }), "c", ["6275c0ba"])).toEqual({})
    expect(await direccionesDeFotos(supa([]), "c", [])).toEqual({})
  })
})

describe("4 · en todo el tablero: una sola función", () => {
  it("el documento en secciones (brief y plan) muestra los títulos y el texto sin códigos", () => {
    const r = render(createElement(PlanEnSecciones, { prosa: "## De qué parte del plan sale (brf-28de888eb3f2 v2)\n\nEl brief (brf-28de888eb3f2 v2) nombra la idea C1-I08 y el caldo (`foto:6275c0ba`).", sinDatosClave: true, abiertasIniciales: [] }))
    expect(r.container.textContent).not.toMatch(CODIGO)
    expect(r.container.textContent).toContain("De qué parte del plan sale")
  })
  it("pedir cambios en una sección manda el título tal cual está guardado (la plataforma lo busca así)", () => {
    const pedidos: string[] = []
    const r = render(createElement(PlanEnSecciones, { prosa: "## Metas (pln-28de888eb3f2 v2)\n\nVender más.", onPedirCambios: (s: string) => { pedidos.push(s) }, sinDatosClave: true }))
    if (!r.container.querySelector("[data-pedir-en]")) fireEvent.click(r.container.querySelector<HTMLButtonElement>("[data-seccion] button")!)
    fireEvent.click(r.container.querySelector<HTMLButtonElement>("[data-pedir-en]")!)
    expect(pedidos).toEqual(["Metas (pln-28de888eb3f2 v2)"])
    expect(r.container.querySelector("[data-seccion]")!.textContent).not.toMatch(CODIGO)
  })
  it("los títulos de las decisiones salen sin códigos («Gran idea · con-…-v3»)", () => {
    expect(tituloLimpio("Gran idea · con-28de888eb3f2-v3 · campaña Náufrago")).toBe("Gran idea · campaña Náufrago")
    expect(tituloLimpio("Brief creativo · brf-28de888eb3f2 v2 (revisión): espera")).toBe("Brief creativo: espera")
  })
  it("las pantallas que muestran texto de la cadena usan la misma función (gran idea, brief, documento en secciones, decisiones)", () => {
    for (const f of ["components/nuevo/PanelGranIdea.tsx", "components/nuevo/PanelBrief.tsx", "components/nuevo/PlanEnSecciones.tsx", "lib/direccion-decisiones.ts"]) expect(readFileSync(f, "utf8")).toMatch(/from "@\/lib\/sin-codigos"/)
    const gi = readFileSync("components/nuevo/PanelGranIdea.tsx", "utf8")
    for (const campo of ["por_que_funciona", "como_se_ve", "como_suena", "caminos_descartados", "devolucion_del_brief"]) expect(gi).toContain(`<TextoSinCodigos texto={d.${campo}} fotos={fotos}`)
    expect(gi).toContain("{sinCodigos(a)}")
  })
})
