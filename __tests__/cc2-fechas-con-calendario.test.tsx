// @vitest-environment jsdom
/**
 * LAS FECHAS DE «CREAR CAMPAÑA» SE ESCRIBEN Y SE ELIGEN EN UN CALENDARIO (21-nov · GO Lenovo 00:57Z · Emilio: «inicio» y «fin» no dejaban escribir).
 * La causa: el selector del navegador iba invisible encima del texto; tocarlo no abría el calendario y lo escrito no se veía.
 * Ahora: la casilla se escribe (dd/mm/aaaa, las barras se ponen solas) y al tocarla se abre el calendario del estilo base. Sin red ni base (US$ 0).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { useState } from "react"
import { SelectorDeFecha } from "@/components/nuevo/SelectorDeFecha"
import { FormularioCrearCampana } from "@/components/nuevo/FormularioCrearCampana"
import { escribirFecha, fechaDelTexto, semanasDelMes, textoDeFecha, type RespuestasDeCrear } from "@/lib/crear-campana"

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const HOY = "2026-11-21"
const LISTAS: RespuestasDeCrear = {
  nombre: "Fin de semana largo", cambio: "Que reserven mesa para el feriado.", inicio: "2026-12-06", fin: "2026-12-19",
  claves: [{ fecha: "", que: "" }], tope: "52", brief: "Brief de Emilio.",
}
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-21T15:00:00Z")) })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

function Casilla({ inicial = "", rango, desde }: { inicial?: string; rango?: { inicio: string; fin: string }; desde?: string }) {
  const [v, setV] = useState(inicial)
  return <div><SelectorDeFecha valor={v} onCambio={setV} etiqueta="Inicio" hoy={HOY} rango={rango} desde={desde} clase="text-hueso" /><output data-valor>{v}</output><span data-afuera>afuera</span></div>
}
const casilla = (c: HTMLElement) => c.querySelector("[aria-label=Inicio]") as HTMLInputElement
const valor = (c: HTMLElement) => c.querySelector("[data-valor]")?.textContent

describe("las reglas de la fecha escrita (lib/crear-campana)", () => {
  it("dd/mm/aaaa ↔ aaaa-mm-dd; una fecha que no existe no vale; aaaa-mm-dd pegada vale", () => {
    expect(textoDeFecha("2026-12-06")).toBe("06/12/2026")
    expect(textoDeFecha("")).toBe("")
    expect(fechaDelTexto("06/12/2026")).toBe("2026-12-06")
    expect(fechaDelTexto("6/12/2026")).toBe("2026-12-06")
    expect(fechaDelTexto("2026-12-06")).toBe("2026-12-06")
    for (const mala of ["31/02/2027", "06/13/2026", "06/12/26", "06/12", "", "abc"]) expect(fechaDelTexto(mala), mala).toBeNull()
  })
  it("al escribir, solo cifras y las barras se ponen solas; borrar no deja barras colgando", () => {
    expect(escribirFecha("0612")).toBe("06/12")
    expect(escribirFecha("06122026")).toBe("06/12/2026")
    expect(escribirFecha("06/12/20269")).toBe("06/12/2026")
    expect(escribirFecha("06/1")).toBe("06/1")
    expect(escribirFecha("06")).toBe("06")
    expect(escribirFecha("06a")).toBe("06")
    expect(escribirFecha("2026-12-06")).toBe("2026-12-06")
  })
  it("las semanas del mes empiezan en lunes: diciembre 2026 empieza martes y tiene 31 días", () => {
    const s = semanasDelMes(2026, 11)
    expect(s[0]).toEqual([null, "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06"])
    expect(s.flat().filter(Boolean)).toHaveLength(31)
    expect(s.every((w) => w.length === 7)).toBe(true)
    expect(semanasDelMes(2027, 1).flat().filter(Boolean)).toHaveLength(28)
  })
})

describe("la casilla con calendario", () => {
  it("se puede ESCRIBIR la fecha: la casilla muestra lo que se escribe y la fecha vale al completarla", () => {
    const { container } = render(<Casilla />)
    fireEvent.change(casilla(container), { target: { value: "0612" } })
    expect(casilla(container).value).toBe("06/12")
    expect(valor(container)).toBe("")
    fireEvent.change(casilla(container), { target: { value: "06/12/2026" } })
    expect(casilla(container).value).toBe("06/12/2026")
    expect(valor(container)).toBe("2026-12-06")
    // borrar una cifra deja la casilla como está y la fecha sin valer
    fireEvent.change(casilla(container), { target: { value: "06/12/202" } })
    expect(casilla(container).value).toBe("06/12/202")
    expect(valor(container)).toBe("")
  })
  it("al tocar la casilla se abre el calendario en el mes de hoy, con hoy marcado", () => {
    const { container } = render(<Casilla />)
    expect(container.querySelector("[data-calendario]")).toBeNull()
    fireEvent.focus(casilla(container))
    expect(container.querySelector("[data-calendario]")).not.toBeNull()
    expect(container.querySelector("[data-mes]")?.textContent).toBe("noviembre 2026")
    expect(container.querySelector("[data-hoy]")?.getAttribute("data-dia")).toBe(HOY)
    expect(container.querySelector("[data-hoy] span")?.className).toContain("border-oro")
  })
  it("las flechas cambian de mes (y de año) y elegir un día llena la casilla y cierra el calendario", () => {
    const { container } = render(<Casilla />)
    fireEvent.click(casilla(container))
    fireEvent.click(container.querySelector("[aria-label='Mes siguiente']")!)
    expect(container.querySelector("[data-mes]")?.textContent).toBe("diciembre 2026")
    fireEvent.click(container.querySelector("[aria-label='Mes siguiente']")!)
    expect(container.querySelector("[data-mes]")?.textContent).toBe("enero 2027")
    fireEvent.click(container.querySelector("[aria-label='Mes anterior']")!)
    fireEvent.click(container.querySelector("[data-dia='2026-12-06']")!)
    expect(valor(container)).toBe("2026-12-06")
    expect(casilla(container).value).toBe("06/12/2026")
    expect(container.querySelector("[data-calendario]")).toBeNull()
  })
  it("el día elegido va en dorado y el rango de inicio a fin queda pintado; antes de «desde» no se puede elegir", () => {
    const { container } = render(<Casilla inicial="2026-12-06" rango={{ inicio: "2026-12-06", fin: "2026-12-19" }} desde={HOY} />)
    fireEvent.focus(casilla(container))
    expect(container.querySelector("[data-mes]")?.textContent).toBe("diciembre 2026")
    const dia = (d: string) => container.querySelector(`[data-dia='${d}']`) as HTMLButtonElement
    expect(dia("2026-12-06").getAttribute("aria-pressed")).toBe("true")
    expect(dia("2026-12-06").className).toContain("bg-oro")
    expect(dia("2026-12-19").className).toContain("bg-oro")
    expect(dia("2026-12-12").hasAttribute("data-en-rango")).toBe(true)
    expect(dia("2026-12-12").className).toContain("bg-linea-oro")
    expect(dia("2026-12-20").hasAttribute("data-en-rango")).toBe(false)
    fireEvent.click(container.querySelector("[aria-label='Mes anterior']")!)
    expect(dia("2026-11-20").disabled).toBe(true)
    expect(dia("2026-11-21").disabled).toBe(false)
  })
  it("abierto con una fecha ya puesta, muestra el mes de esa fecha", () => {
    const { container } = render(<Casilla inicial="2027-03-02" />)
    fireEvent.focus(casilla(container))
    expect(container.querySelector("[data-mes]")?.textContent).toBe("marzo 2027")
  })
  it("Esc y un clic afuera cierran el calendario", () => {
    const { container } = render(<Casilla />)
    fireEvent.focus(casilla(container))
    fireEvent.keyDown(casilla(container), { key: "Escape" })
    expect(container.querySelector("[data-calendario]")).toBeNull()
    fireEvent.click(casilla(container))
    fireEvent.mouseDown(container.querySelector("[data-afuera]")!)
    expect(container.querySelector("[data-calendario]")).toBeNull()
  })
  it("el foco no deja el halo violeta: la casilla lleva «focus-visible:shadow-none»", () => {
    const { container } = render(<Casilla />)
    expect(casilla(container).className).toContain("focus-visible:shadow-none")
  })
})

describe("en el formulario «Crear Campaña»", () => {
  function red() {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.startsWith("/api/crear-campana/minimo")
      ? new Response(JSON.stringify({ ok: true, minimo_usd: 52 }), { status: 200 })
      : new Response(JSON.stringify({ ok: false }), { status: 404 })))
  }
  const formulario = (inicial: RespuestasDeCrear, paso: number, onCerrar = vi.fn()) =>
    ({ onCerrar, ...render(<FormularioCrearCampana clienteId={NAUFRAGO} clienteNombre="Náufrago" onCerrar={onCerrar} onCreada={vi.fn()} inicial={inicial} pasoInicial={paso} minimoInicial={52} />) })
  it("inicio y fin se escriben y se eligen: con las dos, «Siguiente» se enciende", () => {
    red()
    const { container } = formulario({ ...LISTAS, inicio: "", fin: "" }, 2)
    const siguiente = container.querySelector("[data-siguiente]") as HTMLButtonElement
    expect(siguiente.disabled).toBe(true)
    fireEvent.change(container.querySelector("[aria-label=Inicio]")!, { target: { value: "06122026" } })
    expect((container.querySelector("[aria-label=Inicio]") as HTMLInputElement).value).toBe("06/12/2026")
    fireEvent.focus(container.querySelector("[aria-label=Fin]")!)
    expect(container.querySelector("[data-mes]")?.textContent).toBe("diciembre 2026") // el calendario del fin abre en el mes del inicio
    fireEvent.click(container.querySelector("[data-dia='2026-12-19']")!)
    expect((container.querySelector("[aria-label=Fin]") as HTMLInputElement).value).toBe("19/12/2026")
    expect(siguiente.disabled).toBe(false)
  })
  it("las fechas clave también: se escriben o se eligen en su calendario", () => {
    red()
    const { container } = formulario(LISTAS, 2)
    fireEvent.click(container.querySelector("[aria-label='Fecha clave 1']")!)
    expect(container.querySelector("[data-calendario]")).not.toBeNull()
    fireEvent.click(container.querySelector("[data-dia='2026-12-12']")!)
    expect((container.querySelector("[aria-label='Fecha clave 1']") as HTMLInputElement).value).toBe("12/12/2026")
  })
  it("Esc con el calendario abierto cierra SOLO el calendario; con el calendario cerrado, cierra el formulario", () => {
    red()
    const { container, onCerrar } = formulario(LISTAS, 2)
    fireEvent.focus(container.querySelector("[aria-label=Inicio]")!)
    fireEvent.keyDown(container.querySelector("[aria-label=Inicio]")!, { key: "Escape" })
    expect(onCerrar).not.toHaveBeenCalled()
    expect(container.querySelector("[data-calendario]")).toBeNull()
    fireEvent.keyDown(container.querySelector("[aria-label=Inicio]")!, { key: "Escape" })
    expect(onCerrar).toHaveBeenCalledTimes(1)
  })
  it("el tope tiene el foco en dorado, sin el halo violeta", () => {
    red()
    const { container } = formulario(LISTAS, 3)
    const tope = container.querySelector("[aria-label=Tope]") as HTMLInputElement
    expect(tope.className).toContain("focus:border-oro")
    expect(tope.className).toContain("focus-visible:shadow-none")
  })
})
