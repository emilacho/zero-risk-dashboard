/** UN SOLO PEDIDO DE CAMBIOS AL MANUAL (CC6 · 03-nov · corrección de Lenovo 16:40Z: «Elegir» no debe dejar solo «Pedir cambios»). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PanelManual } from "@/components/nuevo/PanelManual"
import { leerManual } from "@/lib/manual-lector"
import { seccionesNuevasDelBorrador } from "@/lib/manual-secciones"
import { enviarTusCambios, quitarDeTusCambios, renglonesDeTusCambios, SIN_CAMBIOS, textoDeLasObservaciones, type TusCambios } from "@/lib/pedido-del-manual"
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
  it("lo que lee el equipo del manual: una línea por observación de campo y después el texto libre", () => {
    expect(textoDeLasObservaciones(TODO, etiqueta, ORDEN)).toBe("Campo «Voz de la marca»: Más cercana, menos formal\n\nEn Guayaquil el público es otro: habla de delivery rápido.")
  })
})

type Llamada = { nombre: string; cuerpo: Record<string, unknown> }
const puerta = (respuestas: Record<string, { ok: boolean; texto?: string; detalle?: Record<string, unknown> }> = {}) => {
  const llamadas: Llamada[] = []
  const accion = async (nombre: string, cuerpo: Record<string, unknown>) => {
    llamadas.push({ nombre, cuerpo })
    const r = respuestas[nombre] ?? { ok: true }
    return r.ok ? { ok: true as const, texto: "Guardado", detalle: r.detalle ?? {} } : { ok: false as const, texto: r.texto ?? "falló" }
  }
  return { llamadas, accion }
}
const O = { etiqueta, orden: ORDEN, puedeReescribir: true }

describe("«Pedir los cambios» manda todo junto (opción A, sin tocar la plataforma)", () => {
  it("solo lo directo (elegir, retirar, editar): UNA llamada a la puerta de siempre, sin reescritura ni gasto", async () => {
    const p = puerta()
    const r = await enviarTusCambios(p.accion, C, { ...SIN_CAMBIOS, campos: { eslogan: "Del mar a tu puerta", vision: "" }, como: { eslogan: "elegir", vision: "retirar" } }, O)
    expect(p.llamadas.map((l) => l.nombre)).toEqual(["manual-campos"])
    expect(p.llamadas[0].cuerpo).toEqual({ client_id: C, campos: { eslogan: "Del mar a tu puerta", vision: "" }, retirar: ["vision"] })
    expect(r).toMatchObject({ ok: true, reescribe: false, quedan: SIN_CAMBIOS })
  })
  it("todo junto: primero lo directo y después UN pedido al equipo del manual con las observaciones y el texto libre", async () => {
    const p = puerta()
    const r = await enviarTusCambios(p.accion, C, TODO, O)
    expect(p.llamadas.map((l) => l.nombre)).toEqual(["manual-campos", "manual-cambios"])
    expect(p.llamadas[1].cuerpo).toMatchObject({ client_id: C, texto: textoDeLasObservaciones(TODO, etiqueta, ORDEN), confirmo_gasto: true })
    expect(r).toMatchObject({ ok: true, reescribe: true, quedan: SIN_CAMBIOS })
  })
  it("solo observaciones: solo el pedido al equipo del manual", async () => {
    const p = puerta()
    await enviarTusCambios(p.accion, C, { ...SIN_CAMBIOS, libre: "Que hable más de la playa." }, O)
    expect(p.llamadas.map((l) => l.nombre)).toEqual(["manual-cambios"])
  })
  it("si falla lo directo, no se manda nada más y TODO queda pendiente", async () => {
    const p = puerta({ "manual-campos": { ok: false, texto: "Tu sesión venció: entra de nuevo." } })
    const r = await enviarTusCambios(p.accion, C, TODO, O)
    expect(p.llamadas.map((l) => l.nombre)).toEqual(["manual-campos"])
    expect(r).toMatchObject({ ok: false, texto: "Tu sesión venció: entra de nuevo.", quedan: TODO })
  })
  it("si falla el pedido, lo directo YA quedó guardado y solo las observaciones siguen pendientes (y se dice)", async () => {
    const p = puerta({ "manual-cambios": { ok: false, texto: "reescritura_en_curso" } })
    const r = await enviarTusCambios(p.accion, C, TODO, O)
    expect(r.ok).toBe(false)
    expect(r.quedan).toEqual({ campos: {}, como: {}, notas: TODO.notas, libre: TODO.libre })
    expect(r.texto).toBe("Lo que elegiste, retiraste o editaste quedó guardado. Las observaciones no se pudieron mandar: Ya hay un pedido de cambios en curso: espera la versión nueva.")
  })
  it("pedido guardado pero el equipo no se enteró: las observaciones siguen pendientes para volver a pedir", async () => {
    const p = puerta({ "manual-cambios": { ok: true, detalle: { despertado: false } } })
    const r = await enviarTusCambios(p.accion, C, { ...SIN_CAMBIOS, libre: "Que hable más de la playa." }, O)
    expect(r.ok).toBe(false); expect(r.quedan.libre).toBe("Que hable más de la playa.")
  })
  it("con una reescritura en curso las observaciones no se mandan (ni lo directo): se dice y nada sale", async () => {
    const p = puerta()
    const r = await enviarTusCambios(p.accion, C, TODO, { ...O, puedeReescribir: false })
    expect(p.llamadas).toEqual([]); expect(r).toMatchObject({ ok: false, quedan: TODO })
  })
  it("un texto que el pedido rechazaría (muy corto) se avisa ANTES de guardar lo directo: no queda nada a medias", async () => {
    const p = puerta()
    const r = await enviarTusCambios(p.accion, C, { ...TODO, notas: {}, libre: "hey" }, O)
    expect(p.llamadas).toEqual([]); expect(r).toMatchObject({ ok: false, texto: "Cuenta qué debe cambiar (al menos 5 letras)." })
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
