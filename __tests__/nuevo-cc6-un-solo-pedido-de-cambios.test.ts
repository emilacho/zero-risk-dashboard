/** UN SOLO PEDIDO DE CAMBIOS AL MANUAL (CC6 · 03-nov · corrección de Lenovo 16:40Z · opción B, contrato CC1 #869). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PanelManual, llamarAccion } from "@/components/nuevo/PanelManual"
import { leerManual } from "@/lib/manual-lector"
import { seccionesNuevasDelBorrador } from "@/lib/manual-secciones"
import { cuerpoDelPedidoUnico, enviarTusCambios, quitarDeTusCambios, renglonesDeTusCambios, SIN_CAMBIOS, type TusCambios } from "@/lib/pedido-del-manual"
import { ejecutarAccion } from "@/lib/tablero-acciones"
import type { ManualDelCliente } from "@/lib/manual-datos"

const C = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const ETQ: Record<string, string> = { eslogan: "Eslogan", valores: "Valores", vision: "Visión", voz: "Voz de la marca" }
const etiqueta = (k: string) => ETQ[k] ?? k
const ORDEN = ["vision", "valores", "eslogan", "voz"]
const TODO: TusCambios = {
  campos: { eslogan: "Del mar a tu puerta", valores: "Frescura\nHonestidad", vision: "" },
  como: { eslogan: "elegir", valores: "retirar", vision: "retirar" },
  notas: { voz: "Más cercana, menos formal" },
  libre: "En Guayaquil el público es otro: habla de delivery rápido.",
}
const SOLO_OBS: TusCambios = { campos: {}, como: {}, notas: TODO.notas, libre: TODO.libre }
const CON_VALOR = { eslogan: "Del mar a tu puerta", valores: "Frescura\nHonestidad" }
/** la regla de #869 (`leerDirectos`, CC3 🔴 17:15Z): un campo en `campos` Y en `retirar` → 400 «viene dos veces» */
const sinRepetidos = (c: Record<string, unknown>) => { const k = new Set(Object.keys((c.campos ?? {}) as object)); return ((c.retirar ?? []) as string[]).every((x) => !k.has(x)) }

describe("«Tus cambios»: la lista corta, en el orden del manual", () => {
  it("cada acción se dice en palabras: elegir, retirar el campo, retirar un elemento, observación y el texto libre al final", () => {
    expect(renglonesDeTusCambios(TODO, etiqueta, ORDEN)).toEqual([
      { id: "campo:vision", texto: "Retirar «Visión»" },
      { id: "campo:valores", texto: "Valores: retiraste un elemento" },
      { id: "campo:eslogan", texto: "Eslogan: elegiste «Del mar a tu puerta»" },
      { id: "nota:voz", texto: "Voz de la marca: «Más cercana, menos formal»" },
      { id: "libre", texto: "Para todo el manual: «En Guayaquil el público es otro: habla de delivery rápido.»" },
    ])
    expect(renglonesDeTusCambios({ ...SIN_CAMBIOS, campos: { voz: "Cercana" } }, etiqueta)).toEqual([{ id: "campo:voz", texto: "Voz de la marca: lo cambiaste" }])
  })
  it("quitar uno = un toque, y solo ese", () => {
    expect(quitarDeTusCambios(TODO, "campo:eslogan").campos).not.toHaveProperty("eslogan")
    expect(quitarDeTusCambios(TODO, "campo:eslogan").como).not.toHaveProperty("eslogan")
    expect(quitarDeTusCambios(TODO, "campo:eslogan").campos).toHaveProperty("valores")
    expect(quitarDeTusCambios(TODO, "nota:voz").notas).toEqual({})
    expect(quitarDeTusCambios(TODO, "libre").libre).toBe("")
    expect(quitarDeTusCambios(TODO, "libre").notas).toEqual(TODO.notas)
  })
})

describe("el cuerpo del pedido único (contrato CC1 #869)", () => {
  it("lo directo, lo que se retira, las observaciones por campo y el texto libre, con el gasto confirmado por código", () => {
    expect(cuerpoDelPedidoUnico(C, TODO)).toEqual({
      client_id: C,
      campos: CON_VALOR, // lo retirado NO va aquí: solo en `retirar`
      retirar: ["vision"],
      observaciones_por_campo: [{ campo: "voz", texto: "Más cercana, menos formal" }],
      texto: TODO.libre,
      confirmo_gasto: true, tope_usd: 5,
    })
  })
  it("CC3 🔴: un campo retirado va SOLO en `retirar`, nunca también en `campos` (en ningún pedido)", () => {
    expect(sinRepetidos(cuerpoDelPedidoUnico(C, TODO))).toBe(true)
    expect(cuerpoDelPedidoUnico(C, { ...SIN_CAMBIOS, campos: { vision: "" }, como: { vision: "retirar" } })).toEqual({ client_id: C, retirar: ["vision"] })
  })
  it("CC3 🔴: la puerta del tablero tampoco reenvía un campo en los dos lugares, y rechaza un campo con valor que además se pide retirar", async () => {
    const llamadas: Array<Record<string, unknown>> = []
    const dep = { revisor: "e", plataformaUrl: "https://p.test", llave: "k", fetchImpl: (async (_u: unknown, i?: RequestInit) => { llamadas.push(JSON.parse(String(i?.body))); return new Response("{}") }) as typeof fetch }
    expect((await ejecutarAccion("manual-cambios", { client_id: C, campos: { vision: "", eslogan: "Del mar" }, retirar: ["vision"] }, dep)).status).toBe(200)
    expect(llamadas[0]).toMatchObject({ campos: { eslogan: "Del mar" }, retirar: ["vision"] }); expect(sinRepetidos(llamadas[0])).toBe(true)
    expect((await ejecutarAccion("manual-cambios", { client_id: C, retirar: ["vision"] }, dep)).status).toBe(200) // solo retirar: vale
    expect(llamadas[1]).not.toHaveProperty("campos")
    expect((await ejecutarAccion("manual-cambios", { client_id: C, campos: { vision: "Algo" }, retirar: ["vision"] }, dep)).status).toBe(400)
  })
  it("solo lo directo: sin gasto (no se reescribe)", () => {
    expect(cuerpoDelPedidoUnico(C, { ...SIN_CAMBIOS, campos: { eslogan: "Del mar" }, como: { eslogan: "elegir" } })).toEqual({ client_id: C, campos: { eslogan: "Del mar" } })
  })
  it("la puerta del tablero lo acepta y lo pasa tal cual a la plataforma; lo directo solo no pide confirmar gasto", async () => {
    const llamadas: Array<{ url: string; cuerpo: Record<string, unknown> }> = []
    const f: typeof fetch = async (u, i) => { llamadas.push({ url: String(u), cuerpo: JSON.parse(String(i?.body)) }); return new Response(JSON.stringify({ ok: true }), { status: 200 }) }
    const dep = { revisor: "emilio", plataformaUrl: "https://p.test", llave: "k", fetchImpl: f }
    expect((await ejecutarAccion("manual-cambios", cuerpoDelPedidoUnico(C, TODO), dep)).status).toBe(200)
    expect(llamadas[0].url).toBe("https://p.test/api/tablero/manual-cambios")
    expect(sinRepetidos(llamadas[0].cuerpo)).toBe(true)
    expect(llamadas[0].cuerpo).toMatchObject({ client_id: C, campos: CON_VALOR, retirar: ["vision"], observaciones_por_campo: [{ campo: "voz", texto: "Más cercana, menos formal" }], texto: TODO.libre, confirmo_gasto: true, tope_usd: 5 })
    expect((await ejecutarAccion("manual-cambios", { client_id: C, campos: { eslogan: "Del mar" } }, dep)).status).toBe(200)
    expect(llamadas[1].cuerpo).not.toHaveProperty("confirmo_gasto")
  })
  it("la puerta rechaza sin llamar: observaciones sin confirmar gasto, un campo vacío sin pedir retirarlo, un campo desconocido, nada que pedir, más de 100.000", async () => {
    let llamo = false
    const dep = { revisor: "e", plataformaUrl: "https://p.test", llave: "k", fetchImpl: (async () => { llamo = true; return new Response("{}") }) as typeof fetch }
    expect((await ejecutarAccion("manual-cambios", { client_id: C, texto: "Más cercana, por favor", tope_usd: 5 }, dep)).cuerpo).toMatchObject({ ok: false, error: "falta_confirmar_gasto" })
    expect((await ejecutarAccion("manual-cambios", { client_id: C, observaciones_por_campo: [{ campo: "voz", texto: "más cercana" }], tope_usd: 5 }, dep)).cuerpo).toMatchObject({ ok: false, error: "falta_confirmar_gasto" })
    expect((await ejecutarAccion("manual-cambios", { client_id: C, campos: { vision: "" } }, dep)).status).toBe(400)
    expect((await ejecutarAccion("manual-cambios", { client_id: C, campos: { inventado: "x" } }, dep)).status).toBe(400)
    expect((await ejecutarAccion("manual-cambios", { client_id: C }, dep)).status).toBe(400)
    expect((await ejecutarAccion("manual-cambios", { client_id: C, texto: "x".repeat(100_001), confirmo_gasto: true, tope_usd: 5 }, dep)).status).toBe(400)
    expect(llamo).toBe(false)
    expect((await ejecutarAccion("manual-cambios", { client_id: C, texto: "x".repeat(100_000), confirmo_gasto: true, tope_usd: 5 }, dep)).status).toBe(200) // el tope es 100.000, no 4.000
  })
  it("la puerta lee la respuesta ENTERA: una respuesta larga con `despertado: false` no se pierde; un error con `directo` se pasa", async () => {
    const larga = JSON.stringify({ ok: true, reescribe: true, despertado: false, directo: { cambios: "x".repeat(2000) } })
    const dep = (cuerpo: string, status = 200) => ({ revisor: "e", plataformaUrl: "https://p.test", llave: "k", fetchImpl: (async () => new Response(cuerpo, { status })) as typeof fetch })
    const r = await ejecutarAccion("manual-cambios", cuerpoDelPedidoUnico(C, TODO), dep(larga))
    expect((r.cuerpo as { resultado: Record<string, unknown> }).resultado.despertado).toBe(false)
    const e = await ejecutarAccion("manual-cambios", cuerpoDelPedidoUnico(C, TODO), dep(JSON.stringify({ ok: false, error: "no_se_pudo_guardar", detalle: "base", directo: { version_nueva: 3 } }), 500))
    expect(e.cuerpo).toMatchObject({ ok: false, directo: true })
    const sin = await ejecutarAccion("manual-cambios", cuerpoDelPedidoUnico(C, TODO), dep(JSON.stringify({ ok: false, error: "x" }), 500))
    expect(sin.cuerpo).not.toHaveProperty("directo")
  })
  it("el panel recibe `directo` del tablero", async () => {
    const r = await llamarAccion("manual-cambios", {}, async () => new Response(JSON.stringify({ ok: false, error: "la_plataforma_rechazo", detalle: "base", directo: true }), { status: 502 }))
    expect(r).toMatchObject({ ok: false, directo: true })
  })
})

type Llamada = { nombre: string; cuerpo: Record<string, unknown> }
type Resp = { ok: boolean; texto?: string; detalle?: Record<string, unknown>; directo?: boolean }
const puerta = (resp: Resp = { ok: true }) => {
  const llamadas: Llamada[] = []
  const accion = async (nombre: string, cuerpo: Record<string, unknown>) => {
    llamadas.push({ nombre, cuerpo })
    return resp.ok ? { ok: true as const, texto: "Guardado", detalle: resp.detalle ?? {} } : { ok: false as const, texto: resp.texto ?? "falló", ...(resp.directo ? { directo: true } : {}) }
  }
  return { llamadas, accion }
}
const O = { puedeReescribir: true }

describe("«Pedir los cambios» manda todo en UNA llamada (opción B)", () => {
  it("todo junto: una sola llamada a `manual-cambios`, y nada queda pendiente", async () => {
    const p = puerta()
    const r = await enviarTusCambios(p.accion, C, TODO, O)
    expect(p.llamadas.map((l) => l.nombre)).toEqual(["manual-cambios"])
    expect(p.llamadas[0].cuerpo).toEqual(cuerpoDelPedidoUnico(C, TODO))
    expect(r).toMatchObject({ ok: true, reescribe: true, quedan: SIN_CAMBIOS })
  })
  it("solo lo directo: la misma llamada, sin gasto, y dice «guardados»", async () => {
    const p = puerta()
    const r = await enviarTusCambios(p.accion, C, { ...SIN_CAMBIOS, campos: { vision: "" }, como: { vision: "retirar" } }, O)
    expect(p.llamadas[0].cuerpo).toEqual({ client_id: C, retirar: ["vision"] }) // solo en `retirar` (#869 rechaza «viene dos veces»)
    expect(r).toMatchObject({ ok: true, texto: "✓ Cambios guardados", reescribe: false })
  })
  it("caso 2 de CC1: 200 pero `despertado: false` → NO dice «listo»: lo directo quedó y solo las observaciones siguen pendientes", async () => {
    const p = puerta({ ok: true, detalle: { ok: true, reescribe: true, despertado: false, directo: {} } })
    const r = await enviarTusCambios(p.accion, C, TODO, O)
    expect(r.ok).toBe(false); expect(r.quedan).toEqual(SOLO_OBS)
    expect(r.texto).toBe("Lo que elegiste, retiraste o editaste quedó guardado; falta pedir las observaciones: el equipo del manual no recibió el aviso. Toca «Pedir los cambios» otra vez.")
  })
  it("caso 1 de CC1: error CON `directo` → lo directo quedó; el reintento manda SOLO observaciones y texto (sin `campos` ni `retirar`)", async () => {
    const p = puerta({ ok: false, texto: "No se pudo guardar el pedido.", directo: true })
    const r = await enviarTusCambios(p.accion, C, TODO, O)
    expect(r.quedan).toEqual(SOLO_OBS)
    expect(r.texto).toBe("Lo que elegiste, retiraste o editaste quedó guardado; falta pedir las observaciones: No se pudo guardar el pedido.")
    const p2 = puerta()
    await enviarTusCambios(p2.accion, C, r.quedan, O)
    expect(p2.llamadas[0].cuerpo).not.toHaveProperty("campos"); expect(p2.llamadas[0].cuerpo).not.toHaveProperty("retirar")
    expect(p2.llamadas[0].cuerpo).toMatchObject({ observaciones_por_campo: [{ campo: "voz", texto: "Más cercana, menos formal" }], texto: TODO.libre })
  })
  it("error SIN `directo`: nada se guardó y TODO sigue pendiente", async () => {
    const p = puerta({ ok: false, texto: "Tu sesión venció: entra de nuevo." })
    const r = await enviarTusCambios(p.accion, C, TODO, O)
    expect(r).toMatchObject({ ok: false, texto: "Tu sesión venció: entra de nuevo.", quedan: TODO })
  })
  it("con una reescritura en curso no se manda nada si hay observaciones", async () => {
    const p = puerta()
    const r = await enviarTusCambios(p.accion, C, TODO, { puedeReescribir: false })
    expect(p.llamadas).toEqual([]); expect(r).toMatchObject({ ok: false, quedan: TODO })
  })
  it("lo que la plataforma rechazaría se dice sin llamar: texto libre de menos de 5 letras, o más de 100.000 en total", async () => {
    const p = puerta()
    expect(await enviarTusCambios(p.accion, C, { ...TODO, notas: {}, libre: "hey" }, O)).toMatchObject({ ok: false, texto: "Cuenta qué debe cambiar (al menos 5 letras)." })
    expect((await enviarTusCambios(p.accion, C, { ...TODO, libre: "x".repeat(100_000) }, O)).ok).toBe(false)
    expect(p.llamadas).toEqual([])
  })
  it("#869 rechaza retirar un campo y observarlo a la vez: el panel lo dice antes, sin llamar", async () => {
    const p = puerta()
    const r = await enviarTusCambios(p.accion, C, { ...SIN_CAMBIOS, campos: { vision: "" }, como: { vision: "retirar" }, notas: { vision: "más corta" } }, { ...O, etiqueta })
    expect(p.llamadas).toEqual([]); expect(r.texto).toBe("«Visión» está para retirar y tiene una observación: quita una de las dos en «Tus cambios».")
    expect((await enviarTusCambios(p.accion, C, { ...SIN_CAMBIOS, campos: { valores: "Frescura" }, como: { valores: "retirar" }, notas: { valores: "más cortos" } }, O)).ok).toBe(true) // retirar UN elemento (el campo queda con valor) sí convive
  })
  it("sin cliente o sin cambios no se llama a nadie", async () => {
    const p = puerta()
    expect((await enviarTusCambios(p.accion, null, TODO, O)).ok).toBe(false)
    expect((await enviarTusCambios(p.accion, C, SIN_CAMBIOS, O)).ok).toBe(false)
    expect(p.llamadas).toEqual([])
  })
})

const CICLO = { disponible: true, abierto: null, avance: null, que_cambio: [] }
const manual = (o: { ciclo?: unknown; opciones?: string[] } = {}): ManualDelCliente => ({ clientes: [{ id: C, nombre: "Náufrago", con_manual: true }], cliente: { id: C, nombre: "Náufrago" }, manual: { version: 1, versiones: 1, lector: leerManual({ client_id: C, version: 1, brand_purpose: "Servir el mar.", brand_vision: "Ser la marca costera.", brand_values: ["Frescura", "Honestidad"], content_text: "{}" })!, fidelidad: "", origen: null, colores: [], tipografias: [], opciones_eslogan: o.opciones ?? ["Del mar a tu puerta", "Hambre de mar"], palabras_prohibidas: [], palabras: [], terminos_propios: [], politica_competidores: null, creado_en: null, actualizado_en: null, secciones_nuevas: seccionesNuevasDelBorrador({}), ciclo: o.ciclo ?? CICLO } as never, leido_en: "x" })
const panel = (p: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: manual(), ...p }))
const deEslogan = (h: string) => h.slice(h.indexOf('data-campo="eslogan"'), h.indexOf("</div>", h.indexOf('data-opciones="eslogan"')) + 400)

describe("el panel: después de «Elegir» todo sigue a la mano (lo que vio Emilio 16:40Z)", () => {
  it("elegido un eslogan: las OTRAS opciones siguen para cambiar de idea, la elegida dice «✓ Elegida» y nada se manda solo", () => {
    const h = panel({ cambiosIniciales: { eslogan: "Del mar a tu puerta" } })
    const e = deEslogan(h)
    expect(e).toContain("data-elegida"); expect(e).toContain("✓ Elegida")
    expect(e).not.toContain('data-accion="retirar"') // lo recién elegido no se «retira»: se quita con su ✕ en «Tus cambios»
    expect((e.match(/data-accion="elegir-opcion"/g) ?? []).length).toBe(1) // la otra opción sigue
    expect(h).toContain('data-accion="manual-texto-libre"') // el cuadro de texto libre sigue a la vista
    expect(h).not.toContain("data-campo-observar"); expect(h).not.toContain(">Observación<") // 03-nov 19:53Z (Emilio): el botón «Observación» se quitó; «Editar» basta
    expect(h).toContain('data-campo-editar="valores"'); expect(h).toContain('data-accion="retirar"') // y editar / retirar en otros campos
    expect(h).toContain("Guarda tus cambios antes de aprobar.") // 04-nov: solo un eslogan elegido → «Guardar cambios»
  })
  it("el pie: «Tus cambios · N» con cada uno y su ✕ grande (44 px), y UN botón «Pedir los cambios»", () => {
    const h = panel({ cambiosIniciales: { eslogan: "Del mar a tu puerta" }, notasIniciales: { voz: "Más cercana" }, libreInicial: "Pensar en Guayaquil." })
    expect(h).toContain("Tus cambios · 3")
    expect((h.match(/data-accion="quitar-cambio"/g) ?? []).length).toBe(3)
    expect(h).toMatch(/data-accion="quitar-cambio"[^>]*class="flex h-11 w-11/)
    expect(h).toMatch(/data-accion="guardar-cambios"[^>]*>Pedir los cambios</)
    expect(h).not.toMatch(/data-accion="guardar-cambios"[^>]*disabled=""/)
    expect(h).not.toContain(">Guardar cambios<"); expect(h).not.toContain("data-accion=\"manual-enviar-pedido\"")
    expect(h).toContain("Tu observación: </span>Más cercana") // la nota se ve debajo de su campo
  })
  it("sin cambios: no hay lista y «Pedir los cambios» está apagado", () => {
    const h = panel()
    expect(h).not.toContain("data-tus-cambios")
    expect(h).toMatch(/data-accion="guardar-cambios"[^>]*disabled=""/)
  })
  it("sin la plataforma del pedido (o con una reescritura en curso) no se ofrecen observaciones: no habría cómo mandarlas", () => {
    const h = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: manual({ ciclo: { disponible: false, abierto: null, avance: null, que_cambio: [] } }) }))
    expect(h).not.toContain('data-accion="observacion-campo"'); expect(h).not.toContain('data-accion="manual-texto-libre"')
    expect(h).toContain('data-campo-editar="valores"') // editar sigue
  })
})

describe("caso 3 de CC1: la reescritura no terminó (o el aviso no llegó) → «Reintentar» manda solo lo escrito", () => {
  it("el panel muestra «Reintentar» (44 px) cuando el ciclo lo trae; sin eso, no", () => {
    const con = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: manual({ ciclo: { ...CICLO, reintentar: "Campo «Voz de la marca»: más cercana" } }) }))
    expect(con).toMatch(/data-accion="manual-reintentar"[^>]*class="mt-2 min-h-11[^"]*"[^>]*>Reintentar</)
    expect(panel()).not.toContain('data-accion="manual-reintentar"')
  })
  it("reintentar manda SOLO el texto del pedido que falló: sin `campos` ni `retirar` (eso ya quedó guardado)", async () => {
    const p = puerta()
    await enviarTusCambios(p.accion, C, { ...SIN_CAMBIOS, libre: "Campo «Voz de la marca»: más cercana" }, O)
    expect(p.llamadas[0].cuerpo).toEqual({ client_id: C, texto: "Campo «Voz de la marca»: más cercana", confirmo_gasto: true, tope_usd: 5 })
  })
})

describe("el botón del pie dice lo que hace y «Aprobar» está a su lado (Emilio 04-nov 10:45Z / 10:46Z / 10:47Z)", () => {
  it("solo ediciones directas o retiros → «Guardar cambios», SIN nota debajo; con texto en la caja (o una observación) → «Pedir los cambios»", async () => {
    const { botonDelPie } = await import("@/lib/pedido-del-manual")
    expect(botonDelPie({ campos: { eslogan: "Del mar" }, como: {}, notas: {}, libre: "" }).boton).toBe("Guardar cambios")
    expect(botonDelPie({ campos: { valores: "" }, como: {}, notas: {}, libre: "" }).boton).toBe("Guardar cambios") // retirar
    expect(botonDelPie({ campos: { eslogan: "Del mar" }, como: {}, notas: {}, libre: "Pensar en Guayaquil." }).boton).toBe("Pedir los cambios")
    expect(botonDelPie({ campos: {}, como: {}, notas: { voz: "Más cercana" }, libre: "" }).boton).toBe("Pedir los cambios")
    const g = panel({ cambiosIniciales: { eslogan: "Del mar a tu puerta" } })
    expect(g).toMatch(/data-accion="guardar-cambios"[^>]*>Guardar cambios</); expect(g).not.toContain("sin reescribir ni gastar")
    expect(g).toContain("Guarda tus cambios antes de aprobar.")
    const p = panel({ cambiosIniciales: { eslogan: "Del mar a tu puerta" }, libreInicial: "Pensar en Guayaquil." })
    expect(p).toMatch(/data-accion="guardar-cambios"[^>]*>Pedir los cambios</); expect(p).toContain("Pide tus cambios antes de aprobar.")
  })
  it("«Aprobar» está en el PIE (junto al botón, a la derecha) y ya no arriba en la portada", () => {
    const h = panel({ cambiosIniciales: { eslogan: "Del mar a tu puerta" } })
    const pie = h.slice(h.indexOf("data-guardar-cambios"))
    expect(pie).toContain("data-pie-derecha"); expect(pie).toContain('data-accion="validar-manual"')
    expect((h.match(/data-accion="validar-manual"/g) ?? []).length).toBe(1) // uno solo
    const portada = h.slice(h.indexOf('aria-label="La portada del manual"'), h.indexOf("<footer"))
    expect(portada.length).toBeGreaterThan(0); expect(portada).not.toContain('data-accion="validar-manual"') // reserva de CC3: fija la POSICIÓN
    expect(h.slice(h.indexOf("<footer"))).toContain('data-accion="validar-manual"')
    expect(pie.indexOf('data-accion="guardar-cambios"')).toBeLessThan(pie.indexOf('data-accion="validar-manual"')) // al lado, después del de guardar
    expect(h).toMatch(/data-accion="validar-manual"[^>]*disabled=""/) // con cambios sin guardar, apagado
  })
})
