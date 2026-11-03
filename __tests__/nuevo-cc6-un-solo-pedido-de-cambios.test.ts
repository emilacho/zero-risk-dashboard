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
      campos: TODO.campos,
      retirar: ["vision"],
      observaciones_por_campo: [{ campo: "voz", texto: "Más cercana, menos formal" }],
      texto: TODO.libre,
      confirmo_gasto: true, tope_usd: 5,
    })
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
    expect(llamadas[0].cuerpo).toMatchObject({ client_id: C, campos: TODO.campos, retirar: ["vision"], observaciones_por_campo: [{ campo: "voz", texto: "Más cercana, menos formal" }], texto: TODO.libre, confirmo_gasto: true, tope_usd: 5 })
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
    expect(p.llamadas[0].cuerpo).toEqual({ client_id: C, campos: { vision: "" }, retirar: ["vision"] })
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
    expect(h).toContain('data-campo-observar="valores"'); expect(h).toContain('data-campo-observar="eslogan"') // y las observaciones en cada campo
    expect(h).toContain('data-campo-editar="valores"'); expect(h).toContain('data-accion="retirar"') // y editar / retirar en otros campos
    expect(h).toContain("Pide tus cambios antes de aprobar.")
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
