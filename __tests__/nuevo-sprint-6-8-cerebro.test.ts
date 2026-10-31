/**
 * DASHBOARD NUEVO · SPRINT 6.8 · EL CEREBRO EN EL ESTILO NUEVO (Emilio, 31-oct: «lo que veas en el dashboard anterior lo traes al nuevo mejorado con la misma idea»).
 * El cuadro «Cerebro» del Dept. Marketing abre encima un explorador dentro del cliente enfocado: carpetas por tema de negocio (lo que dijo el dueño · su negocio · sus
 * redes · lo que dicen de él · competidores · mercado · cliente ideal) → fichas como tarjetas → la ficha con su contenido, origen, fuente, vigencia y la decisión del cerebro.
 * Lo ÚNICO que se escribe desde aquí es el dato del dueño (agregar · responder a una oficina · corregir), por la puerta del dueño de la plataforma
 * (`POST /api/brain/alimentar/dueno`, llave interna, `dry_run:false` con flujo `dashboard-cerebro`): US$ 0, reemplaza al anterior del mismo tema. Lo que no existe se dice.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { CANAL_DEL_CEREBRO, CARPETAS_DEL_CEREBRO, FLUJO_DEL_CEREBRO, arbolDelCerebro, carpetaDeLaClase, claseLegible, cuerpoParaLaPuertaDelDueno, errorTrasGuardar, esCompetidorReal, fichaDeCompetidorAnalizado, fichaDesdeFila, ordenarFichas, origenLegible, perfilDesdeFila, porSede, preguntaDesdeFila, textoTrasGuardar, vigenciaLegible, type FichaDelCerebro } from "@/lib/cerebro"
import { guardarDatoDelDueno } from "@/lib/cerebro-dueno"
import type { CerebroDelCliente } from "@/lib/cerebro-datos"
import { APLICACIONES } from "@/lib/aplicaciones-marketing"
import { PanelCerebro } from "@/components/nuevo/PanelCerebro"

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const AHORA = new Date("2026-10-31T20:00:00.000Z")

/** fichas con la forma REAL de `cerebro_fichas` (lectura 31-oct) */
const fila = (x: Record<string, unknown>): Record<string, unknown> => ({
  id: "f1", client_id: NAUFRAGO, clase: "sitio", titulo: "sitio · precio:producto cola grande · sede guayaquil", que_es: "Precio de la cola grande en el sitio", contenido: "Cola grande US$ 2,50",
  origen: "su_fuente", propiedad: "propia", sede: "guayaquil", atributo: "precio:producto cola grande", alcance: "cliente", fuente_url: "https://naufrago.ec/menu", observado_en: "2026-10-20T12:00:00.000Z",
  vigente_hasta: "2026-11-20T12:00:00.000Z", decision: "reemplaza", razon_de_decision: "precio más nuevo", porque: "el sitio es la fuente oficial", creado_en: "2026-10-20T12:00:01.000Z", descartada: false, provenance_tag: { type: "ficha", source: "sitio", trust_level: "untrusted" }, ...x,
})
const FICHAS: FichaDelCerebro[] = [
  fichaDesdeFila(fila({})),
  fichaDesdeFila(fila({ id: "f2", clase: "dato_del_dueno", titulo: "Dueño · presupuesto de pauta", que_es: "Lo que el dueño confirmó", contenido: "US$ 300 al mes, no más", origen: "dueno", sede: null, atributo: "dueno:presupuesto-de-pauta", alcance: null, fuente_url: null, vigente_hasta: null, observado_en: "2026-10-28T15:00:00.000Z", provenance_tag: { type: "dueno", canal: "MD de Slack", datos: { tema: "presupuesto de pauta", pregunta: "¿Cuánto quieres invertir en pauta al mes?", respuesta: "US$ 300 al mes, no más", canal: "MD de Slack", respondido_en: "2026-10-28T15:00:00.000Z", preguntado_por: { oficina: "planeacion", agente: "jefe-marketing" } } } })),
  fichaDesdeFila(fila({ id: "f3", clase: "competidor_vigilado", titulo: "Competidor vigilado · El Encocao de Mitya · sede guayaquil", que_es: "Competidor directo", contenido: "Mariscos · 4,6 estrellas", origen: "tercero", propiedad: "ajena", alcance: "competidor", vigente_hasta: "2026-11-02T12:00:00.000Z", observado_en: "2026-10-25T12:00:00.000Z" })),
  fichaDesdeFila(fila({ id: "f4", clase: "resenas", titulo: "resenas · abc", que_es: "Reseñas de Google", contenido: "«Excelente encebollado»", origen: "tercero", propiedad: "propia", alcance: "cliente", vigente_hasta: "2026-10-29T12:00:00.000Z", observado_en: "2026-10-01T12:00:00.000Z", sede: "olon" })),
  fichaDesdeFila(fila({ id: "f5", clase: "tendencia_del_publico", titulo: "Tendencia · restaurante mariscos · Guayaquil · formato: carrusel", origen: "plataforma", propiedad: "incierta", alcance: "mercado", vigente_hasta: null, sede: null, observado_en: "2026-10-30T12:00:00.000Z" })),
  fichaDesdeFila(fila({ id: "f6", clase: "instagram", titulo: "instagram · instagram:bio", origen: "su_fuente", vigente_hasta: null, observado_en: "2026-10-15T12:00:00.000Z" })),
  fichaDesdeFila(fila({ id: "f7", clase: "cosa_rara", titulo: "algo sin carpeta", origen: null, propiedad: null, vigente_hasta: null, sede: null })),
  fichaDeCompetidorAnalizado({ id: "c1", competitor_name: "Lojeñito", competitor_type: "direct", value_proposition: "Ceviche barato", key_differentiators: ["precio", "delivery"], weaknesses: ["sin redes"], last_analyzed_at: "2026-10-10T12:00:00.000Z", analysis_source: "nexus", created_at: "2026-10-10T12:00:00.000Z" }),
]
const PERFIL = perfilDesdeFila({ id: "p1", audience_segment: "Familias de Olón los fines de semana", segment_priority: 1, geography: "Olón y Montañita", goals: ["comer rico frente al mar"], pain_points: ["esperar mucho"], jobs_to_be_done: [], objections: ["precio"], preferred_channels: ["instagram", "whatsapp"], budget_range: "US$ 10-20 por persona", decision_criteria: ["reseñas"], buying_process: "Deciden en el momento", content_preferences: "Fotos del plato y del mar" })
const PREGUNTA = preguntaDesdeFila({ id: "11111111-2222-4333-8444-555555555555", tema: "horario de Olón", pregunta: "¿Abren los lunes en Olón?", canal: "MD de Slack", preguntado_por_oficina: "planeacion", preguntado_por_agente: "jefe-marketing", creado_en: "2026-10-31T10:00:00.000Z", sede_clave: "olon" })
const DATOS: CerebroDelCliente = {
  clientes: [{ id: NAUFRAGO, nombre: "Náufrago" }], cliente: { id: NAUFRAGO, nombre: "Náufrago" }, fichas: ordenarFichas(FICHAS), perfiles: [PERFIL], preguntas: [PREGUNTA],
  sedes: [{ clave: "guayaquil", ciudad: "Guayaquil" }, { clave: "olon", ciudad: "Olón" }], trozos: 454, retiradas: 441, descartadas: 12, leido_en: AHORA.toISOString(),
}
const fakeFetch = (status: number, body: unknown): typeof fetch => (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch

describe("sprint 6.8 · el cerebro como explorador dentro del cliente", () => {
  it("cada clase de ficha cae en su carpeta de negocio (competidor_* y tendencia* por prefijo; lo desconocido en «Otras fichas»)", () => {
    expect(CARPETAS_DEL_CEREBRO.map((k) => k.nombre)).toEqual(["Lo que dijo el dueño", "Su negocio", "Sus redes", "Lo que dicen de él", "Competidores", "Mercado y tendencias", "Cliente ideal", "Otras fichas"])
    expect(carpetaDeLaClase("dato_del_dueno")).toBe("dueno"); expect(carpetaDeLaClase("sitio")).toBe("negocio"); expect(carpetaDeLaClase("precio")).toBe("negocio"); expect(carpetaDeLaClase("horario")).toBe("negocio"); expect(carpetaDeLaClase("mapas")).toBe("negocio")
    expect(carpetaDeLaClase("instagram")).toBe("redes"); expect(carpetaDeLaClase("videos")).toBe("redes"); expect(carpetaDeLaClase("metrica")).toBe("redes"); expect(carpetaDeLaClase("lo_mas_gustado_propio")).toBe("redes")
    expect(carpetaDeLaClase("resenas")).toBe("dicen"); expect(carpetaDeLaClase("mencion")).toBe("dicen"); expect(carpetaDeLaClase("articulo")).toBe("dicen"); expect(carpetaDeLaClase("lo_mas_gustado")).toBe("dicen")
    expect(carpetaDeLaClase("competidor_evaluacion")).toBe("competidores"); expect(carpetaDeLaClase("competidor_lo_que_sea")).toBe("competidores")
    expect(carpetaDeLaClase("tendencia_del_publico")).toBe("mercado"); expect(carpetaDeLaClase("resumen_vivo")).toBe("mercado"); expect(carpetaDeLaClase("mercado_posicion")).toBe("mercado")
    expect(carpetaDeLaClase("cosa_rara")).toBe("otras"); expect(carpetaDeLaClase(null)).toBe("otras")
    expect(claseLegible("competidor_vigilado")).toBe("Competidor vigilado"); expect(claseLegible("cosa_rara")).toBe("Cosa rara")
  })
  it("la fila real se vuelve ficha: del dato del dueño salen el tema, el canal y la pregunta; el competidor analizado se vuelve ficha de la misma carpeta", () => {
    const d = FICHAS[1]
    expect(d.carpeta).toBe("dueno"); expect(d.tema).toBe("presupuesto de pauta"); expect(d.canal).toBe("MD de Slack"); expect(d.pregunta).toBe("¿Cuánto quieres invertir en pauta al mes?"); expect(d.respuesta).toBe("US$ 300 al mes, no más")
    expect(esCompetidorReal({ competitor_name: "_landscape_summary" })).toBe(false); expect(esCompetidorReal({ competitor_name: "Lojeñito" })).toBe(true); expect(esCompetidorReal({ competitor_name: null })).toBe(false)
    expect(origenLegible("dueno")).toBe("Lo dijo el dueño"); expect(origenLegible("su_fuente")).toBe("De sus propias fuentes"); expect(origenLegible("tercero")).toBe("De terceros"); expect(origenLegible("plataforma")).toBe("Lo dedujo el sistema")
    const c = FICHAS[7]
    expect(c.carpeta).toBe("competidores"); expect(c.titulo).toBe("Análisis · Lojeñito"); expect(c.que_es).toBe("Competidor directo"); expect(c.contenido).toBe("Propuesta: Ceviche barato\nSe diferencia por: precio · delivery\nFlancos: sin redes"); expect(c.propiedad).toBe("ajena")
    expect(PERFIL.segmento).toBe("Familias de Olón los fines de semana"); expect(PERFIL.prioridad).toBe(1); expect(PERFIL.canales).toEqual(["instagram", "whatsapp"])
    expect(PREGUNTA.tema).toBe("horario de Olón"); expect(PREGUNTA.sede_clave).toBe("olon")
  })
  it("la vigencia se dice en palabras: sin vencimiento · vigente N días · vence en ≤7 días (ámbar) · venció (rojo, la oficina la reconfirma)", () => {
    expect(vigenciaLegible({ vigente_hasta: null }, AHORA)).toEqual({ texto: "Sin vencimiento", tono: "neutro" })
    expect(vigenciaLegible({ vigente_hasta: "2026-11-20T12:00:00.000Z" }, AHORA)).toEqual({ texto: "Vigente 20 días más", tono: "verde" })
    expect(vigenciaLegible({ vigente_hasta: "2026-11-02T12:00:00.000Z" }, AHORA)).toEqual({ texto: "Vence en 2 días", tono: "ambar" })
    expect(vigenciaLegible({ vigente_hasta: "2026-10-29T12:00:00.000Z" }, AHORA)).toEqual({ texto: "Venció hace 2 días · la oficina debe reconfirmarla", tono: "rojo" })
  })
  it("el árbol: las carpetas en orden con su cuenta y su detalle (preguntas pendientes en la del dueño · por reconfirmar · segmentos del cliente ideal); «Otras» solo si tiene algo", () => {
    const a = arbolDelCerebro(DATOS.fichas, { perfiles: 1, preguntas: 1, ahora: AHORA })
    expect(a.map((k) => [k.clave, k.total])).toEqual([["dueno", 1], ["negocio", 1], ["redes", 1], ["dicen", 1], ["competidores", 2], ["mercado", 1], ["ideal", 1], ["otras", 1]])
    expect(a[0].detalle).toBe("1 dato · 1 pregunta espera tu respuesta"); expect(arbolDelCerebro(DATOS.fichas, { ahora: AHORA })[0].detalle).toBe("1 dato"); expect(a[3].detalle).toBe("1 ficha · 1 por reconfirmar"); expect(a[4].detalle).toBe("2 fichas · 1 por reconfirmar"); expect(a[6].detalle).toBe("1 segmento")
    expect(arbolDelCerebro(DATOS.fichas.filter((f) => f.carpeta !== "otras"), { ahora: AHORA }).some((k) => k.clave === "otras")).toBe(false)
    // las más nuevas primero; las de la carpeta agrupadas por sede (sin sede primero)
    expect(a[4].fichas.map((f) => f.id)).toEqual(["f3", "competidor-analizado:c1"])
    expect(porSede([FICHAS[0], FICHAS[3], FICHAS[4]]).map((g) => [g.sede, g.fichas.length])).toEqual([[null, 1], ["guayaquil", 1], ["olon", 1]])
  })
  it("lo que el dueño escribe se valida y va EXACTO a la puerta del dueño: canal del dashboard, dry_run false con flujo y ejecución, pregunta_id y sede cuando las hay", () => {
    expect(cuerpoParaLaPuertaDelDueno({ client_id: "x", tema: "a", respuesta: "bbb" })).toEqual({ error: "Falta el cliente." })
    expect(cuerpoParaLaPuertaDelDueno({ client_id: NAUFRAGO, tema: "", respuesta: "bbb" })).toHaveProperty("error")
    expect(cuerpoParaLaPuertaDelDueno({ client_id: NAUFRAGO, tema: "x".repeat(81), respuesta: "bbb" })).toHaveProperty("error")
    expect(cuerpoParaLaPuertaDelDueno({ client_id: NAUFRAGO, tema: "manual · voz", respuesta: "bbb" })).toEqual({ error: "Los datos del manual de marca se editan en el Manual, no aquí." })
    expect(cuerpoParaLaPuertaDelDueno({ client_id: NAUFRAGO, tema: "horario", respuesta: "no" })).toEqual({ error: "Escribe el dato (al menos 3 letras)." })
    expect(cuerpoParaLaPuertaDelDueno({ client_id: NAUFRAGO, tema: "horario", respuesta: "bbb", sede_clave: "olón!" })).toEqual({ error: "La sede no es válida." })
    expect(cuerpoParaLaPuertaDelDueno({ client_id: NAUFRAGO, tema: "horario", respuesta: "bbb", pregunta_id: "nope" })).toEqual({ error: "La pregunta pendiente no es válida." })
    const v = cuerpoParaLaPuertaDelDueno({ client_id: NAUFRAGO, tema: "  horario   de Olón ", respuesta: "Lunes cerrado; martes a domingo 11 a 21.", sede_clave: "olon", pregunta_id: PREGUNTA.id, pregunta: "¿Abren los lunes en Olón?" }, AHORA)
    expect("cuerpo" in v && v.cuerpo).toEqual({
      evento: "respuesta", client_id: NAUFRAGO, tema: "horario de Olón", respuesta: "Lunes cerrado; martes a domingo 11 a 21.", pregunta: "¿Abren los lunes en Olón?",
      canal: CANAL_DEL_CEREBRO, respondido_en: AHORA.toISOString(), preguntado_por: { oficina: "dashboard", agente: "emilio" }, sede_clave: "olon", pregunta_id: PREGUNTA.id,
      mensaje_ref: `cerebro:${NAUFRAGO}:${AHORA.toISOString()}`, dry_run: false, workflow_id: FLUJO_DEL_CEREBRO, workflow_execution_id: `dashboard:cerebro:${NAUFRAGO}:${AHORA.toISOString()}`,
    })
    expect(CANAL_DEL_CEREBRO).not.toMatch(/manual/) // ese canal exige tema «manual · <campo>» y no es este
    const sinPregunta = cuerpoParaLaPuertaDelDueno({ client_id: NAUFRAGO, tema: "platos", respuesta: "El encocado no se promociona." }, AHORA)
    expect("cuerpo" in sinPregunta && sinPregunta.cuerpo.pregunta).toBe("El dueño lo escribió en el dashboard (Cerebro) · tema: platos")
    expect("cuerpo" in sinPregunta && sinPregunta.cuerpo).not.toHaveProperty("sede_clave")
  })
  it("la llamada a la plataforma dice la verdad: sin llave 503 · puerta apagada 503 · ruta ausente 501 · 400/404 con el detalle · ok con ficha_id y lo que reemplazó", async () => {
    const dato = { client_id: NAUFRAGO, tema: "horario", respuesta: "Lunes cerrado." }
    expect((await guardarDatoDelDueno({ ...dato, respuesta: "" }, { llave: "k" })).status).toBe(400)
    expect(await guardarDatoDelDueno(dato, { llave: "" })).toMatchObject({ status: 503, cuerpo: { error: "llave_interna_sin_poner" } })
    expect(await guardarDatoDelDueno(dato, { llave: "k", fetchImpl: fakeFetch(200, { apagado: true, detalle: "PORTERO_DUENO está apagado" }) })).toMatchObject({ status: 503, cuerpo: { error: "puerta_apagada" } })
    expect(await guardarDatoDelDueno(dato, { llave: "k", fetchImpl: fakeFetch(404, {}) })).toMatchObject({ status: 501, cuerpo: { error: "puerta_no_disponible" } })
    expect(await guardarDatoDelDueno(dato, { llave: "k", fetchImpl: fakeFetch(404, { error: "cliente_inexistente", detalle: "no existe la ficha del cliente" }) })).toMatchObject({ status: 404, cuerpo: { error: "cliente_inexistente", detalle: "no existe la ficha del cliente" } })
    expect(await guardarDatoDelDueno(dato, { llave: "k", fetchImpl: fakeFetch(400, { error: "sede_inexistente", detalle: "«x» no es una sede" }) })).toMatchObject({ status: 400, cuerpo: { error: "sede_inexistente" } })
    expect(await guardarDatoDelDueno(dato, { llave: "k", fetchImpl: fakeFetch(500, { error: "dueno_error", detalle: "boom" }) })).toMatchObject({ status: 502, cuerpo: { error: "la_plataforma_rechazo", plataforma_status: 500, detalle: "boom" } })
    expect(await guardarDatoDelDueno(dato, { llave: "k", fetchImpl: fakeFetch(502, { ok: false, errores: ["x"] }) })).toMatchObject({ status: 502 })
    let visto: { url: string; init: RequestInit } | null = null
    const espia: typeof fetch = (async (url: string | URL | Request, init?: RequestInit) => { visto = { url: String(url), init: init! }; return new Response(JSON.stringify({ ok: true, guardada: true, ficha_id: "nueva", tema: "horario", sede: null, reemplaza: ["vieja"], errores: [] }), { status: 200 }) }) as unknown as typeof fetch
    const ok = await guardarDatoDelDueno(dato, { llave: "k", plataformaUrl: "https://plataforma.test/", fetchImpl: espia, ahora: AHORA })
    expect(ok).toMatchObject({ status: 200, cuerpo: { ok: true, guardada: true, ficha_id: "nueva", reemplaza: ["vieja"] } })
    expect(visto!.url).toBe("https://plataforma.test/api/brain/alimentar/dueno")
    expect((visto!.init.headers as Record<string, string>)["x-api-key"]).toBe("k")
    expect(JSON.parse(String(visto!.init.body))).toMatchObject({ dry_run: false, workflow_id: "dashboard-cerebro", canal: "dashboard · cerebro" })
    expect(textoTrasGuardar(ok.cuerpo)).toBe("Guardado en el cerebro · reemplazó 1 dato anterior del mismo tema · el siguiente empleado lo lee así")
    expect(textoTrasGuardar({ reemplaza: [], sede: "olon" })).toBe("Guardado en el cerebro · sede olon · dato nuevo · el siguiente empleado lo lee así")
    expect(errorTrasGuardar(503, { error: "puerta_apagada" })).toBe("La puerta del dueño está apagada en la plataforma: no se guardó nada.")
    expect(errorTrasGuardar(501, {})).toBe("La plataforma todavía no tiene la puerta del dueño: no se guardó nada.")
    expect(errorTrasGuardar(400, { detalle: "«x» no es una sede" })).toBe("No se guardó: «x» no es una sede")
  })
  it("las dos rutas exigen administrador en su primera línea y la de escritura NO toca la base: solo llama a la plataforma", () => {
    for (const p of ["app/api/cerebro/route.ts", "app/api/cerebro/dueno/route.ts"]) {
      const s = readFileSync(p, "utf8")
      expect(s).toContain("const puerta = await exigirAdmin()"); expect(s).toContain("no-store")
    }
    const w = readFileSync("app/api/cerebro/dueno/route.ts", "utf8")
    expect(w).not.toMatch(/getServiceRoleClient|\.from\(/); expect(w).toContain("guardarDatoDelDueno")
    expect(readFileSync("lib/cerebro-dueno.ts", "utf8")).not.toMatch(/\.from\(|supabase/i)
    expect(APLICACIONES.find((a) => a.clave === "cerebro")!.enlace(NAUFRAGO)).toBeNull() // el cuadro abre encima
  })
  it("el panel dibuja el explorador dentro del cliente enfocado: ruta, árbol con cuentas, carpetas con detalle; sin nivel de clientes ni selector", () => {
    const html = renderToStaticMarkup(createElement(PanelCerebro, { onCerrar: () => {}, datosIniciales: DATOS, ahora: AHORA }))
    expect(html).toContain('data-seccion="cerebro"'); expect(html).toContain('role="dialog"')
    expect(html).toContain("Lo que el sistema sabe de Náufrago · 8 fichas vigentes · 454 trozos en el índice que consultan las oficinas · 441 archivadas · 2 por reconfirmar")
    expect(html).toMatch(/data-miga="cliente"[^>]*aria-current="page"[^>]*>Náufrago</)
    expect(html).not.toContain("<select"); expect(html).not.toContain("Todos los clientes")
    expect(html.match(/data-nodo-carpeta="/g)?.length).toBe(8); expect(html.match(/data-carpeta="/g)?.length).toBe(8)
    expect(html).toContain('data-vista="carpetas"'); expect(html).toContain("1 dato · 1 pregunta espera tu respuesta"); expect(html).toContain("1 segmento"); expect(html).toContain("2 fichas · 1 por reconfirmar")
    expect(html).toContain("Datos confirmados por ti · mandan sobre lo demás")
  })
  it("dentro de «Lo que dijo el dueño»: el botón grande de agregar, las preguntas pendientes con «Responder» y los datos como tarjetas con su chip", () => {
    const html = renderToStaticMarkup(createElement(PanelCerebro, { onCerrar: () => {}, datosIniciales: DATOS, carpetaInicial: "dueno", ahora: AHORA }))
    expect(html).toContain('data-vista="fichas"'); expect(html).toContain('data-carpeta-abierta="dueno"')
    expect(html).toMatch(/data-accion="dato-nuevo"[^>]*class="[^"]*px-6 py-3 text-\[15px\]/) // grande, como los de las piezas
    expect(html).toContain('data-bloque="preguntas-pendientes"'); expect(html).toContain("1 pregunta espera tu respuesta"); expect(html).toContain("¿Abren los lunes en Olón?"); expect(html).toContain('data-accion="responder-pregunta"')
    expect(html).toContain('data-ficha="f2"'); expect(html).toContain("Dueño · presupuesto de pauta"); expect(html).toContain("Lo dijo el dueño")
    expect(html).toMatch(/data-miga="carpeta"[^>]*aria-current="page"[^>]*>Lo que dijo el dueño</)
  })
  it("dentro de «Competidores» y «Cliente ideal»: fichas por sede con su vigencia y el perfil con sus listas; el competidor analizado se ve como ficha", () => {
    const comp = renderToStaticMarkup(createElement(PanelCerebro, { onCerrar: () => {}, datosIniciales: DATOS, carpetaInicial: "competidores", ahora: AHORA }))
    expect(comp).toContain('data-grupo-sede="sin-sede"'); expect(comp).toContain('data-grupo-sede="guayaquil"'); expect(comp).toContain("Análisis · Lojeñito"); expect(comp).toContain("Vence en 2 días"); expect(comp).toContain("De otro")
    expect(comp).not.toContain('data-accion="dato-nuevo"') // agregar datos solo en la carpeta del dueño
    const ideal = renderToStaticMarkup(createElement(PanelCerebro, { onCerrar: () => {}, datosIniciales: DATOS, carpetaInicial: "ideal", ahora: AHORA }))
    expect(ideal).toContain('data-perfil="p1"'); expect(ideal).toContain("Familias de Olón los fines de semana"); expect(ideal).toContain("Prioridad 1"); expect(ideal).toContain("Qué le duele"); expect(ideal).toContain("esperar mucho")
    const vacia = renderToStaticMarkup(createElement(PanelCerebro, { onCerrar: () => {}, datosIniciales: { ...DATOS, fichas: [], preguntas: [] }, carpetaInicial: "dueno", ahora: AHORA }))
    expect(vacia).toContain("Todavía no hay datos tuyos sobre Náufrago")
  })
})
