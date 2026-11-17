/**
 * 17-nov · parada única (DECISION-LENOVO-a-CC1-CC2-CC6-parada-unica): «si la corrección obligaría a cambiar el concepto aprobado,
 * la mesa avisa en la ficha y sigue con la mejor versión fiel al concepto; no vuelve a pedir aprobación».
 * La plataforma (CC1, ADENDA 1 de ENTREGA-CC1-parada-unica) deja las líneas en `metadata.avisos_de_concepto: string[]` (sin el rótulo).
 * La ficha de la pieza las muestra como aviso ámbar con su chip «Toca el concepto», sin pedir la casilla «entiendo».
 * Clientes de dos rubros distintos: una ferretería y Náufrago.
 */
import { describe, expect, it } from "vitest"
import { avisosDeConcepto, avisosDeLaPieza, exigeCasilla, ROTULO_AVISO_DE_CONCEPTO, type VideoDeLaPieza } from "@/lib/piezas"
import { chipDelAviso, chipsDeLosAvisos } from "@/lib/panel-de-la-pieza"

const VIDEO: VideoDeLaPieza = { nombre: "reel-pedidos.mp4", bytes: 4_812_330, segundos: 11, simulado: false, solo_en_proveedor: false, vence: null, url_proveedor: null }
const FERRETERIA = "El cierre pedía el taladro en uso; el concepto aprobado es «la caja de herramientas de la casa», así que queda la caja abierta."
const NAUFRAGO = "La foto del encebollado no existe en el expediente; queda el plato del ceviche, fiel a «del mar a tu mesa»."
const fila = (avisos: unknown) => ({ metadata: { familia: "video_mesa", avisos_de_concepto: avisos } })

describe("1 · la lectura del campo", () => {
  it("solo textos con contenido, recortados y sin repetidas", () => {
    expect(avisosDeConcepto([`  ${FERRETERIA}  `, "", "   ", 7, null, { t: "x" }, FERRETERIA, NAUFRAGO])).toEqual([FERRETERIA, NAUFRAGO])
  })
  it("cualquier otra forma no muestra nada (nunca se inventa un aviso)", () => {
    for (const v of [undefined, null, "un texto suelto", 3, {}, []]) expect(avisosDeConcepto(v)).toEqual([])
  })
  it("con tope: 5 líneas y 500 caracteres cada una", () => {
    expect(avisosDeConcepto(Array.from({ length: 9 }, (_, i) => `aviso ${i}`))).toHaveLength(5)
    expect(avisosDeConcepto(["x".repeat(800)])[0]).toHaveLength(500)
  })
})

describe("2 · en la ficha de la pieza", () => {
  it("cada línea es un aviso ámbar con el rótulo de la mesa, en los dos rubros", () => {
    const a = avisosDeLaPieza(fila([FERRETERIA, NAUFRAGO]), [], VIDEO).filter((x) => x.texto.startsWith(ROTULO_AVISO_DE_CONCEPTO))
    expect(a).toEqual([
      { nivel: "ambar", texto: `${ROTULO_AVISO_DE_CONCEPTO}: ${FERRETERIA}` },
      { nivel: "ambar", texto: `${ROTULO_AVISO_DE_CONCEPTO}: ${NAUFRAGO}` },
    ])
  })
  it("su chip es «Toca el concepto» y conserva el texto entero como detalle", () => {
    const chips = chipsDeLosAvisos(avisosDeLaPieza(fila([NAUFRAGO]), [], VIDEO))
    const c = chips.find((x) => x.corto === "Toca el concepto")
    expect(c).toEqual({ corto: "Toca el concepto", nivel: "ambar", detalle: `${ROTULO_AVISO_DE_CONCEPTO}: ${NAUFRAGO}` })
    expect(chipDelAviso({ nivel: "ambar", texto: "Otro aviso cualquiera" })?.corto).toBe("Aviso")
  })
  it("sin el campo (la pieza de hoy) la ficha no cambia", () => {
    const antes = avisosDeLaPieza({ metadata: { familia: "video_mesa" } }, [], VIDEO)
    expect(avisosDeLaPieza(fila(undefined), [], VIDEO)).toEqual(antes)
    expect(avisosDeLaPieza(fila([]), [], VIDEO)).toEqual(antes)
    expect(antes.some((x) => x.texto.startsWith(ROTULO_AVISO_DE_CONCEPTO))).toBe(false)
  })
  it("no pide la casilla «entiendo»: el encargo no vuelve a pedir aprobación", () => {
    expect(exigeCasilla(fila([FERRETERIA]))).toBe(false)
  })
})
