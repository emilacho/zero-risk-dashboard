// @vitest-environment jsdom
/**
 * 09-nov · CERTIFICACIÓN CC6 #310 · menores 1 y 2 de la ficha única (T1). US$ 0 · sin red.
 * Menor 1: los tres rechazos de `revisarFicha` que serán la guarda del T2 (la ficha llegará armada por la plataforma).
 * Menor 2: lo que hace el dueño en la ficha: «Responder» no sale vacío, «Descartar» pide dos toques y se puede VOLVER, el botón dice qué está saliendo,
 * y una ficha sin acciones dice que solo avisa.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { createElement } from "react"
import { FichaDeDecision } from "@/components/nuevo/FichaDeDecision"
import { NOMBRE_MIENTRAS_SALE, revisarFicha, type FichaDeDecision as Ficha, type Verbo } from "@/lib/ficha-de-decision"

afterEach(cleanup)
const A = (verbo: string, extra = {}) => ({ verbo, destino: "dueno-preguntas", ...extra }) as Ficha["acciones"][number]
const base: Ficha = { version: 1, id: "x", cuenta: null, departamento: { oficina: "financiera", nombre: "Financiero" }, que_se_decide: "¿Cuándo arrancan las entregas?", espera: { desde: null }, origen: { fuente: "f", ref: "x" }, acciones: [] }
const pregunta: Ficha = { ...base, acciones: [A("descartar", { pide: { que: "motivo", obligatorio: false } }), A("responder", { principal: true, pide: { que: "texto", obligatorio: true } })] }
const pintar = (f: Ficha, enviando: Verbo | null = null) => {
  const alVerbo = vi.fn()
  const r = render(createElement(FichaDeDecision, { ficha: f, enviando, alVerbo, alIr: () => {} }))
  const $ = (s: string) => r.container.querySelector<HTMLElement>(s)
  return { alVerbo, $, r }
}

describe("menor 1 · los rechazos de revisarFicha (la guarda del T2)", () => {
  it("un verbo repetido se rechaza entera", () => {
    expect(revisarFicha({ ...base, acciones: [A("descartar"), A("descartar")] })).toEqual({ ok: false, motivo: "un verbo repetido" })
  })
  it("una pantalla desconocida se rechaza entera", () => {
    expect(revisarFicha({ ...base, donde_se_hace: { pantalla: "pizarron-viejo" } } as unknown as Ficha)).toEqual({ ok: false, motivo: "una pantalla desconocida" })
  })
  it("sin qué se decide (vacío o solo espacios) se rechaza entera, y se dibuja como «Mal armada»", () => {
    expect(revisarFicha({ ...base, que_se_decide: "" })).toEqual({ ok: false, motivo: "falta qué se decide" })
    expect(revisarFicha({ ...base, que_se_decide: "   " })).toEqual({ ok: false, motivo: "falta qué se decide" })
    const { $ } = pintar({ ...base, que_se_decide: " " })
    expect($("[data-mal-armada]")?.textContent).toContain("falta qué se decide"); expect($("[data-verbo]")).toBeNull()
  })
})

describe("menor 2 · lo que hace el dueño en la ficha", () => {
  it("«Responder» no sale con el texto vacío (ni con solo espacios); con texto, sale con ese texto", () => {
    const { $, alVerbo } = pintar(pregunta)
    expect($("[data-verbo=responder]")!.hasAttribute("disabled")).toBe(true)
    fireEvent.change($("[data-respuesta]")!, { target: { value: "   " } })
    expect($("[data-verbo=responder]")!.hasAttribute("disabled")).toBe(true)
    fireEvent.click($("[data-verbo=responder]")!); expect(alVerbo).not.toHaveBeenCalled()
    fireEvent.change($("[data-respuesta]")!, { target: { value: "En dos meses" } })
    fireEvent.click($("[data-verbo=responder]")!)
    expect(alVerbo).toHaveBeenCalledWith("responder", { texto: "En dos meses" })
  })
  it("«Descartar» pide DOS toques: el primero abre el «Por qué» y deja solo «Volver» y «Descartar»; el segundo descarta con el motivo", () => {
    const { $, alVerbo, r } = pintar(pregunta)
    expect($("[data-volver]")).toBeNull(); expect($("[data-motivo]")).toBeNull()
    fireEvent.click($("[data-verbo=descartar]")!)
    expect(alVerbo).not.toHaveBeenCalled()
    expect($("[data-motivo]")).not.toBeNull()
    expect([...r.container.querySelectorAll("[data-pie] button")].map((b) => b.textContent)).toEqual(["Volver", "Descartar"])
    fireEvent.change($("[data-motivo]")!, { target: { value: "ya lo hablé" } })
    fireEvent.click($("[data-verbo=descartar]")!)
    expect(alVerbo).toHaveBeenCalledTimes(1); expect(alVerbo).toHaveBeenCalledWith("descartar", { motivo: "ya lo hablé" })
  })
  it("«Volver» cancela: no descarta, cierra el «Por qué», olvida el motivo y devuelve los botones de siempre", () => {
    const { $, alVerbo, r } = pintar(pregunta)
    fireEvent.click($("[data-verbo=descartar]")!)
    fireEvent.change($("[data-motivo]")!, { target: { value: "no sé" } })
    fireEvent.click($("[data-volver]")!)
    expect(alVerbo).not.toHaveBeenCalled(); expect($("[data-motivo]")).toBeNull(); expect($("[data-volver]")).toBeNull()
    expect([...r.container.querySelectorAll("[data-pie] button[data-verbo]")].map((b) => b.getAttribute("data-verbo"))).toEqual(["descartar", "responder"])
    fireEvent.click($("[data-verbo=descartar]")!) // vuelve a pedir los dos toques, con el motivo vacío
    expect(alVerbo).not.toHaveBeenCalled(); expect(($("[data-motivo]") as HTMLInputElement).value).toBe("")
  })
  it("mientras sale, el botón dice qué está saliendo (no solo aria-busy) y todo queda quieto", () => {
    const { $ } = pintar(pregunta, "responder")
    expect($("[data-verbo=responder]")!.textContent).toBe("Enviando…"); expect($("[data-verbo=responder]")!.getAttribute("aria-busy")).toBe("true")
    expect($("[data-verbo=descartar]")!.textContent).toBe("Descartar"); expect($("[data-verbo=descartar]")!.hasAttribute("disabled")).toBe(true)
    const d = pintar({ ...base, acciones: [A("descartar")] }, "descartar")
    expect(d.$("[data-verbo=descartar]")!.textContent).toBe("Descartando…")
    expect(NOMBRE_MIENTRAS_SALE).toEqual({ aprobar: "Aprobando…", pedir_cambios: "Enviando…", responder: "Enviando…", asumir: "Asumiendo…", descartar: "Descartando…" })
  })
  it("sin acciones dice que solo avisa; con acciones, no", () => {
    expect(pintar(base).$("[data-solo-avisa]")?.textContent).toBe("Esta ficha solo avisa: no hay nada que decidir aquí.")
    expect(pintar(pregunta).$("[data-solo-avisa]")).toBeNull()
  })
})
