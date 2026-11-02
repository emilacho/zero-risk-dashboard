/**
 * DASHBOARD NUEVO · SPRINT 6.3 · EL MANUAL DE MARCA EN EL ESTILO NUEVO (Emilio, 31-oct: «ya no uses el dashboard viejo»). El cuadro «Manual de marca» abre
 * encima el manual completo: portada (versión · quién validó · qué falta · fidelidad), lo que la marca es, cómo habla, a quién le habla, palabras e identidad
 * visual (colores y letras con procedencia). Solo lectura: nada escribe.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { coloresDelManual, contrasteDelTexto, etiquetaDelHueco, listaDeTextos, separarPropuesta, origenDelManualLegible, politicaDeCompetidoresLegible, procedenciaLegible, tipografiasDelManual } from "@/lib/manual"
import { leerManualDelCliente, type ManualDelCliente } from "@/lib/manual-datos"
import { leerManual } from "@/lib/manual-lector"
import { PanelManual, viñetasDelCampo } from "@/components/nuevo/PanelManual"
import { PanelAplicaciones } from "@/components/nuevo/PanelAplicaciones"

const CLIENTE = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const OTRO = "11111111-1111-4111-8111-111111111111"

/** una fila con la forma real de `client_brand_books` en producción (lectura 31-oct): content_text viene como TEXTO JSON, la paleta como objetos */
const fila = {
  id: "b1", client_id: CLIENTE, version: 1, auto_generated: true, auto_generated_from: "onboarding_collaborative_build", human_validated: false, gate_outcome: "paso_la_vara",
  brand_purpose: "PROPUESTA (no es dato del cliente): Que la costa se pruebe en un plato.", brand_mission: "Servir encebollado fresco.", brand_vision: null, brand_values: null, tagline: null,
  voice_description: "Cercana, costeña, directa.", brand_personality: "Alegre", positioning: "El encebollado de Olón.",
  key_messages: ["Frescura sin duda", "Sabor costeño"], value_propositions: ["Marisco fresco", "Precio justo"],
  primary_colors: [{ hex: "#1a0828", rol: "principal", estado: "declarado", procedencia: "sitio:hoja_de_estilo" }, { hex: "#51d4b4", rol: "acento", estado: "declarado", procedencia: "sitio:hoja_de_estilo" }, { hex: "#663772", rol: null, estado: "declarado", procedencia: "sitio:hoja_de_estilo" }],
  typography: [{ rol: "cuerpo", family: "Inter", procedencia: "sitio:hoja_de_estilo" }, { rol: null, family: "Caveat", procedencia: "sitio:hoja_de_estilo" }],
  forbidden_words: ["gourmet", "premium"], required_terminology: ["encebollado", "ceviche"], competitor_mentions_policy: "never_mention",
  content_text: JSON.stringify({ brand_book_draft: { icp_summary: "Residentes y visitantes de la costa.", tagline_opciones: ["Cuando tengas esa hambre… Náufrago te espera", "PROPUESTA (no es dato del cliente): Fresco del mar"], _field_meta: { icp_summary: { estado: "propuesta" } } }, completitud: { completo: false, huecos: [{ clave: "vision", etiqueta: "Visión" }, { clave: "valores", etiqueta: "Valores" }], visual: {} } }),
  provenance_tag: { type: "evidence", source: "legacy_pre_adr012" }, created_at: "2026-10-30T14:00:00.000Z", updated_at: "2026-10-30T16:00:00.000Z",
}

/** una base falsa: registra qué tablas y filtros se piden y contesta con lo preparado; cualquier escritura rompe la prueba */
function baseFalsa(respuestas: Record<string, unknown>, registro: string[] = []) {
  const consulta = (tabla: string): unknown => {
    const q: Record<string, unknown> = {}
    const enc = (nombre: string) => (...args: unknown[]) => { registro.push(`${tabla}.${nombre}(${args.map((a) => JSON.stringify(a)).join(",")})`); return q }
    for (const n of ["select", "eq", "in", "is", "order", "limit", "gte", "neq"]) q[n] = enc(n)
    q.maybeSingle = () => { registro.push(`${tabla}.maybeSingle()`); return Promise.resolve({ data: Array.isArray(respuestas[tabla]) ? (respuestas[tabla] as unknown[])[0] ?? null : respuestas[tabla] ?? null, error: null }) }
    q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve({ data: respuestas[tabla] ?? [], error: null }).then(res, rej)
    for (const n of ["insert", "update", "upsert", "delete", "rpc"]) q[n] = () => { throw new Error(`escritura prohibida: ${tabla}.${n}`) }
    return q
  }
  return { from: consulta, registro } as unknown as Parameters<typeof leerManualDelCliente>[0] & { registro: string[] }
}

describe("sprint 6.3 · el manual de marca en el estilo nuevo", () => {
  it("la identidad visual se lee de las columnas reales (objetos con hex/rol/procedencia) y, si faltan, del borrador", () => {
    expect(coloresDelManual(fila)).toEqual([{ hex: "#1a0828", rol: "principal", procedencia: "sitio:hoja_de_estilo" }, { hex: "#51d4b4", rol: "acento", procedencia: "sitio:hoja_de_estilo" }, { hex: "#663772", rol: null, procedencia: "sitio:hoja_de_estilo" }])
    expect(tipografiasDelManual(fila)).toEqual([{ familia: "Inter", rol: "cuerpo", procedencia: "sitio:hoja_de_estilo" }, { familia: "Caveat", rol: null, procedencia: "sitio:hoja_de_estilo" }])
    // columnas vacías (otro cliente real: `typography: {}` y `primary_colors: []`) → se mira la capa gráfica del borrador; textos «#abc» también valen
    const sinColumnas = { primary_colors: [], typography: {}, content_text: JSON.stringify({ brand_book_draft: { visual: { capa_grafica: { paleta: [{ color: "#ABC", rol: "principal" }], tipografias: ["Bebas Neue"] } } } }) }
    expect(coloresDelManual(sinColumnas)).toEqual([{ hex: "#aabbcc", rol: "principal", procedencia: null }])
    expect(tipografiasDelManual(sinColumnas)).toEqual([{ familia: "Bebas Neue", rol: null, procedencia: null }])
    expect(coloresDelManual({ primary_colors: ["no es color", { hex: "#12" }] })).toEqual([])
    expect(coloresDelManual(null)).toEqual([])
    expect(contrasteDelTexto("#1a0828")).toBe("#fff"); expect(contrasteDelTexto("#51d4b4")).toBe("#000")
    expect(listaDeTextos(["a", " ", "b"])).toEqual(["a", "b"]); expect(listaDeTextos('["x"]')).toEqual(["x"]); expect(listaDeTextos(null)).toEqual([])
  })
  it("las etiquetas salen en palabras", () => {
    expect(procedenciaLegible("sitio:hoja_de_estilo")).toBe("de la hoja de estilo del sitio"); expect(procedenciaLegible("redes:instagram")).toBe("de las redes"); expect(procedenciaLegible(null)).toBeNull()
    expect(politicaDeCompetidoresLegible("never_mention")).toBe("Nunca se nombra a la competencia"); expect(politicaDeCompetidoresLegible(null)).toBeNull()
    expect(origenDelManualLegible("onboarding_collaborative_build")).toBe("Construido en el alta, con los datos del cliente")
    // lo que falta se dice en palabras, también lo que el lector no muestra (productos · sedes) y la clave de la plataforma (nunca_hace)
    expect(["vision", "nunca_hace", "productos", "sedes", "otra_cosa"].map(etiquetaDelHueco)).toEqual(["Visión", "Lo que la marca nunca dice o hace", "Productos o servicios", "Sedes", "otra cosa"])
    // el prefijo «PROPUESTA (no es dato del cliente):» se separa del valor y marca el campo como propuesta
    expect(separarPropuesta("PROPUESTA (no es dato del cliente): Fresco del mar")).toEqual({ valor: "Fresco del mar", propuesta: true })
    expect(separarPropuesta("Cuando tengas esa hambre")).toEqual({ valor: "Cuando tengas esa hambre", propuesta: false }); expect(separarPropuesta(null)).toEqual({ valor: null, propuesta: false })
    expect(viñetasDelCampo({ clave: "mensajes_clave", valor: "Frescura sin duda · Sabor costeño" })).toEqual(["Frescura sin duda", "Sabor costeño"])
    expect(viñetasDelCampo({ clave: "proposito", valor: "a · b" })).toBeNull() // un texto corrido no se parte aunque traiga el separador
  })
  it("la lectura elige al cliente con manual, toma la versión mayor y no escribe nada", async () => {
    const registro: string[] = []
    const supa = baseFalsa({
      clients: [{ id: OTRO, name: "Aurora", industry: "flores", status: "active", archived_at: null }, { id: CLIENTE, name: "Náufrago", industry: "restaurante", status: "active", archived_at: null }, { id: "22222222-2222-4222-8222-222222222222", name: "zz prueba", industry: "prueba", status: "active", archived_at: null }],
      client_brand_books: [fila],
    }, registro)
    const m = await leerManualDelCliente(supa, { ahora: new Date("2026-10-31T12:00:00Z") })
    expect(m.clientes.map((c) => `${c.nombre}${c.con_manual ? "*" : ""}`)).toEqual(["Aurora", "Náufrago*"]) // la ficha de práctica no entra; el elegido es el que tiene manual
    expect(m.cliente).toEqual({ id: CLIENTE, nombre: "Náufrago" })
    expect(registro).toContain(`client_brand_books.eq("client_id","${CLIENTE}")`); expect(registro).toContain('client_brand_books.order("version",{"ascending":false})')
    expect(m.manual?.version).toBe(1); expect(m.manual?.fidelidad).toBe("Pasó la revisión de fidelidad"); expect(m.manual?.origen).toBe("Construido en el alta, con los datos del cliente")
    expect(m.manual?.lector.rotulo).toBe("Propuesta del sistema · sin validar"); expect(m.manual?.lector.huecos).toEqual(["vision", "valores"])
    expect(m.manual?.opciones_eslogan).toEqual(["Cuando tengas esa hambre… Náufrago te espera", "PROPUESTA (no es dato del cliente): Fresco del mar"])
    expect(m.manual?.colores).toHaveLength(3); expect(m.manual?.palabras_prohibidas).toEqual(["gourmet", "premium"]); expect(m.manual?.politica_competidores).toBe("Nunca se nombra a la competencia")
    // cliente pedido sin manual → se dice, no se inventa
    const sin = await leerManualDelCliente(baseFalsa({ clients: [{ id: OTRO, name: "Aurora", status: "active" }], client_brand_books: [] }), { cliente: OTRO })
    expect(sin.cliente?.nombre).toBe("Aurora"); expect(sin.manual).toBeNull()
    expect(readFileSync("lib/manual-datos.ts", "utf8")).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/)
  })
  it("una base rota lanza (nunca se lee como «sin manual»)", async () => {
    const rota = { from: () => { const q: Record<string, unknown> = {}; for (const n of ["select", "eq", "in", "is", "order", "limit"]) q[n] = () => q; q.maybeSingle = () => Promise.resolve({ data: null, error: { message: "timeout" } }); q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: "timeout" } }).then(res); return q } }
    await expect(leerManualDelCliente(rota as unknown as Parameters<typeof leerManualDelCliente>[0])).rejects.toThrow(/timeout/)
  })
  it("la ruta exige administrador antes de leer, valida el id y no escribe", () => {
    const r = readFileSync("app/api/manual/route.ts", "utf8")
    expect(r.indexOf("exigirAdmin()")).toBeLessThan(r.indexOf("leerManualDelCliente("))
    expect(r).toContain("cliente_invalido"); expect(r).not.toMatch(/\.(insert|update|upsert|delete)\(/)
  })
  it("el panel dibuja la portada, los apartados, las marcas de propuesta/hueco, las palabras y la identidad visual", () => {
    const lector = leerManual(fila)!
    const datos: ManualDelCliente = {
      clientes: [{ id: CLIENTE, nombre: "Náufrago", con_manual: true }, { id: OTRO, nombre: "Aurora", con_manual: false }], cliente: { id: CLIENTE, nombre: "Náufrago" },
      manual: { version: 1, versiones: 1, lector, fidelidad: "Pasó la revisión de fidelidad", origen: "Construido en el alta, con los datos del cliente", colores: coloresDelManual(fila), tipografias: tipografiasDelManual(fila), opciones_eslogan: ["Cuando tengas esa hambre… Náufrago te espera", "PROPUESTA (no es dato del cliente): Fresco del mar"], palabras_prohibidas: ["gourmet", "premium"], terminos_propios: ["encebollado", "ceviche"], politica_competidores: "Nunca se nombra a la competencia", creado_en: fila.created_at, actualizado_en: fila.updated_at },
      leido_en: "x",
    }
    const html = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: datos }))
    expect(html).toContain('role="dialog"'); expect(html).toContain('data-seccion="manual"'); expect(html).toContain("Manual de marca")
    expect(html).toContain("versión 1"); expect(html).toContain("Propuesta del sistema · sin validar"); expect(html).toContain("Incompleto · faltan 2"); expect(html).toContain("Lo que falta · 2"); expect(html).toMatch(/data-ir-campo="vision"[^>]*>Visión</); expect(html).toMatch(/data-ir-campo="valores"[^>]*>Valores</); /* CC6 · 02-nov: la lista de lo que falta, arriba y con enlace a cada campo */ expect(html).toContain("Pasó la revisión de fidelidad")
    expect(html).toContain("Lo que la marca es"); expect(html).toContain("Cómo habla"); expect(html).toContain("A quién le habla"); expect(html).toContain("Que la costa se pruebe en un plato.")
    expect(html).toMatch(/data-campo="proposito" data-estado="propuesta"/); expect(html).not.toContain("no es dato del cliente") // el prefijo del agente no se muestra crudo: se vuelve marca
    expect(html).toMatch(/data-opciones="eslogan"/); expect(html).toContain("«Cuando tengas esa hambre… Náufrago te espera»"); expect(html).toContain("dicho por el cliente"); expect(html).toContain("«Fresco del mar»")
    expect(html).toMatch(/data-campo="vision" data-estado="hueco"/); expect(html).toContain("Sin dato: se buscó en lo raspado del sitio, las redes y los mapas")
    expect(html).toMatch(/data-campo="publico" data-estado="propuesta"/); expect(html).toMatch(/data-campo="publico" data-estado="propuesta"[^>]*data-origen="propuesta" data-validado="false"/); expect(html).toContain(">propuesta del agente<"); expect(html).toContain(">sin validar<") /* CC6 · 02-nov: origen y estado en dos marcas */
    expect(html).toContain("<li>Frescura sin duda</li><li>Sabor costeño</li>") // las listas se leen como viñetas
    expect(html).toContain("encebollado"); expect(html).toContain("gourmet"); expect(html).toContain("Nunca se nombra a la competencia")
    expect(html).toMatch(/data-color="#1a0828"[^>]*title="de la hoja de estilo del sitio"/); expect(html).toContain("#51d4b4"); expect(html).toContain("acento"); expect(html).toContain("Inter"); expect(html).toContain("cuerpo de texto")
    expect(html).toContain("Aurora · sin manual"); expect(html).toMatch(/aria-label="Elegir el cliente"/)
    expect(html).not.toMatch(/\/clientes\//) // nada manda al dashboard viejo
    const c = readFileSync("components/nuevo/PanelManual.tsx", "utf8")
    expect(c).toContain('window.addEventListener("keydown", tecla, true)')
  })
  it("el cuadro «Manual de marca» abre el manual encima (ya no manda a la ficha vieja)", () => {
    const html = renderToStaticMarkup(createElement(PanelAplicaciones, { onCerrar: () => {}, datosIniciales: null }))
    expect(html).toMatch(/<button type="button" data-aplicacion="manual"[^>]*aria-haspopup="dialog"/)
    expect(html).not.toMatch(/href="[^"]*#manual"/)
  })
})
