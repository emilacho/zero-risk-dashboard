// @vitest-environment jsdom
/**
 * 10-nov · #310 AJUSTE 2 (Emilio 09-nov 23:45Z · boceto `raw/evidencia/2026-11-10-alertas/APROBADO-alertas-un-solo-camino.png`):
 * contadores «Nuevas · Revisadas · Resueltas» en lugar de «Esperan · Detenidas», y «✓ Revisar», el único botón nuevo.
 * Nueva → Revisada solo con «✓ Revisar» (abrirla no cuenta) → Resuelta (la cierra el sistema). Plataforma: CC1 #965 (`alerta`), registro `contestadas` (7 días).
 * US$ 0 · sin red (fetch falso).
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { createElement } from "react"
import { claveValida } from "@/lib/alertas"
import { esRevisada, leerAlerta, leerResueltas, normalizarDecisiones } from "@/lib/direccion-decisiones"
import { NO_SE_GUARDO, marcarRevisada } from "@/lib/revisar-alerta"
import { BotonRevisar } from "@/components/nuevo/BotonRevisar"
import { PanelDecisiones } from "@/components/nuevo/PanelDecisiones"

afterEach(cleanup)
const respuesta = (ok: boolean, status = ok ? 200 : 500) => new Response(JSON.stringify({ ok }), { status, headers: { "Content-Type": "application/json" } })
const pregunta = (id: string, alerta?: unknown) => ({ id, tipo: "pregunta_al_dueno", subtipo: null, fuente: "dueno_preguntas", client_id: "c-n", cliente: "Náufrago", titulo: `¿Pregunta ${id}?`,
  desde: "2026-11-05T15:00:00Z", vence: null, vencida: false, prioridad: null, decidir: { ruta: null, accion: null }, costo_usd: null, costo_nota: null, permite: ["responder"], pregunta_de: { oficina: "planeacion", agente: "x" }, ...(alerta ? { alerta } : {}) })
const CLAVE = (id: string) => `decision:dueno_preguntas:${id}`

describe("la clave y la alerta de una decisión", () => {
  it("la marca acepta `decision:<fuente>:<id>`, y sigue rechazando lo raro", () => {
    expect(claveValida("decision:dueno_preguntas:5405751f-0000-4000-8000-000000000001")).toBe(true)
    expect(claveValida("decision:finanzas_tableros:12")).toBe(true)
    for (const mala of ["decision:", "decision:a;drop", "decisiones:x", "Decision:x"]) expect(claveValida(mala), mala).toBe(false)
  })
  it("leerAlerta: solo con clave de decisión válida; estado desconocido = no se sabe (nunca «revisada»); la hora solo si está revisada", () => {
    expect(leerAlerta({ clave: CLAVE("a"), estado: "nueva" })).toEqual({ clave: CLAVE("a"), estado: "nueva" })
    expect(leerAlerta({ clave: CLAVE("a"), estado: "revisada", revisada_en: "2026-11-09T10:00:00Z" })).toEqual({ clave: CLAVE("a"), estado: "revisada", revisada_en: "2026-11-09T10:00:00Z" })
    expect(leerAlerta({ clave: CLAVE("a"), estado: "nueva", revisada_en: "2026-11-09T10:00:00Z" })).toEqual({ clave: CLAVE("a"), estado: "nueva" })
    expect(leerAlerta({ clave: CLAVE("a"), estado: "vista" })).toEqual({ clave: CLAVE("a"), estado: null })
    expect(leerAlerta({ clave: CLAVE("a"), estado: null })).toEqual({ clave: CLAVE("a"), estado: null })
    for (const malo of [null, "x", { estado: "nueva" }, { clave: "riesgo:x", estado: "nueva" }, { clave: "decision:<x>", estado: "nueva" }]) expect(leerAlerta(malo)).toBeNull()
  })
  it("la lectura conserva la alerta; Revisada solo si la alerta lo dice o la marcaste aquí; sin dato de la libreta cuenta como Nueva", () => {
    const d = normalizarDecisiones({ decisiones: [pregunta("a", { clave: CLAVE("a"), estado: "revisada" }), pregunta("b", { clave: CLAVE("b"), estado: null }), pregunta("c")], completo: true }).decisiones
    expect(d.map((x) => (x.alerta ? x.alerta.estado : "sin"))).toEqual(["revisada", null, "sin"])
    expect(d.map((x) => esRevisada(x))).toEqual([true, false, false])
    expect(esRevisada(d[1], { [CLAVE("b")]: "2026-11-10T00:00:00Z" })).toBe(true)
    expect(esRevisada(d[2], { [CLAVE("c")]: "2026-11-10T00:00:00Z" })).toBe(false) // sin alerta no hay qué revisar
  })
  it("Resueltas: sin `contestadas`, null (el contador dice «sin dato», nunca 0); con él, cada fila con id y título; el registro dice si vino entero", () => {
    expect(leerResueltas(undefined)).toBeNull()
    expect(leerResueltas([{ id: "r1", titulo: "¿Ya?", tipo: "pregunta_al_dueno", cliente: "Náufrago", resuelta_en: "2026-11-09T10:00:00Z", resultado: "guardada" }, { id: "", titulo: "x" }, { id: "r3" }]))
      .toEqual([{ id: "r1", titulo: "¿Ya?", tipo: "pregunta_al_dueno", cliente: "Náufrago", resuelta_en: "2026-11-09T10:00:00Z", resultado: "guardada" }])
    const sin = normalizarDecisiones({ decisiones: [], completo: true }); expect(sin.resueltas).toBeUndefined()
    const con = normalizarDecisiones({ decisiones: [], completo: true, contestadas: [{ id: "r1", titulo: "¿Ya?" }], registro_completo: false })
    expect(con.resueltas?.length).toBe(1); expect(con.resueltas_completo).toBe(false)
  })
})

describe("«✓ Revisar» guarda en la libreta de siempre", () => {
  it("manda la clave a /api/alertas/visto; solo con ok cuenta", async () => {
    const f = vi.fn(async () => respuesta(true))
    expect(await marcarRevisada(f as unknown as typeof fetch, CLAVE("a"), () => new Date("2026-11-10T01:00:00Z"))).toEqual({ ok: true, en: "2026-11-10T01:00:00.000Z" })
    expect(f).toHaveBeenCalledWith("/api/alertas/visto", expect.objectContaining({ method: "POST", body: JSON.stringify({ clave: CLAVE("a") }) }))
    expect(await marcarRevisada((async () => respuesta(false)) as unknown as typeof fetch, CLAVE("a"))).toEqual({ ok: false, error: NO_SE_GUARDO })
    expect(await marcarRevisada((async () => new Response("{}", { status: 200 })) as unknown as typeof fetch, CLAVE("a"))).toEqual({ ok: false, error: NO_SE_GUARDO }) // 200 sin ok:true no cuenta
    expect(await marcarRevisada((async () => { throw new Error("red") }) as unknown as typeof fetch, CLAVE("a"))).toEqual({ ok: false, error: NO_SE_GUARDO })
    const nunca = vi.fn(); expect(await marcarRevisada(nunca as unknown as typeof fetch, "decision:<x>")).toEqual({ ok: false, error: NO_SE_GUARDO }); expect(nunca).not.toHaveBeenCalled()
  })
  it("el botón: dice «Guardando…» mientras sale; con ok pasa a «✓ Revisada» y avisa; si falla, lo dice y el botón sigue", async () => {
    let soltar: (r: Response) => void = () => {}
    const f = vi.fn(() => new Promise<Response>((r) => { soltar = r }))
    const alRevisar = vi.fn()
    const r = render(createElement(BotonRevisar, { clave: CLAVE("a"), alRevisar, fetchImpl: f as unknown as typeof fetch }))
    const b = r.container.querySelector<HTMLButtonElement>("[data-revisar]")!
    expect(b.textContent).toBe("✓Revisar")
    fireEvent.click(b); expect(b.textContent).toBe("✓Guardando…"); expect(b.disabled).toBe(true)
    await act(async () => { soltar(respuesta(true)) })
    await waitFor(() => expect(r.container.querySelector("[data-revisada]")?.textContent).toBe("✓Revisada"))
    expect(alRevisar).toHaveBeenCalledWith(CLAVE("a"), expect.any(String)); expect(r.container.querySelector("[data-revisar]")).toBeNull()

    cleanup()
    const mal = render(createElement(BotonRevisar, { clave: CLAVE("b"), fetchImpl: (async () => respuesta(false)) as unknown as typeof fetch }))
    fireEvent.click(mal.container.querySelector("[data-revisar]")!)
    await waitFor(() => expect(mal.container.querySelector("[data-revisar-fallo]")?.textContent).toBe(NO_SE_GUARDO))
    expect(mal.container.querySelector("[data-revisar]")).not.toBeNull(); expect(mal.container.querySelector("[data-revisada]")).toBeNull()
  })
  it("si ya viene revisada, el sello sin botón (y sin llamada)", () => {
    const f = vi.fn()
    const r = render(createElement(BotonRevisar, { clave: CLAVE("a"), revisadaEn: "2026-11-09T10:00:00Z", fetchImpl: f as unknown as typeof fetch }))
    expect(r.container.querySelector("[data-revisada]")).not.toBeNull(); expect(r.container.querySelector("[data-revisar]")).toBeNull(); expect(f).not.toHaveBeenCalled()
  })
})

describe("el panel: Nuevas · Revisadas · Resueltas", () => {
  const datos = () => normalizarDecisiones({ completo: true, decisiones: [pregunta("a", { clave: CLAVE("a"), estado: "nueva" }), pregunta("b", { clave: CLAVE("b"), estado: "nueva" }), pregunta("c", { clave: CLAVE("c"), estado: "revisada", revisada_en: "2026-11-08T10:00:00Z" })],
    contestadas: [{ id: "r1", titulo: "¿Cuántas sedes?", tipo: "pregunta_al_dueno", cliente: "Náufrago", resuelta_en: "2026-11-09T10:00:00Z", resultado: "guardada" }], registro_completo: true })
  const numero = (c: HTMLElement, k: string) => c.querySelector(`[data-recuadro="${k}"] span`)?.textContent
  const pinta = (f: typeof fetch = vi.fn() as unknown as typeof fetch) => render(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: datos(), fetchImpl: f }))

  it("los tres recuadros, en ese orden, con sus números; ya no hay «Esperan» ni «Detenidas»", () => {
    const { container: c } = pinta()
    expect([...c.querySelectorAll("[data-recuadro]")].map((x) => x.getAttribute("data-recuadro"))).toEqual(["nuevas", "revisadas", "resueltas"])
    expect([numero(c, "nuevas"), numero(c, "revisadas"), numero(c, "resueltas")]).toEqual(["2", "1", "1"])
    expect(c.textContent).not.toMatch(/Esperan|Detenidas/)
    expect(c.querySelector("[data-resumen]")?.textContent).toBe("2 nuevas · 1 revisada · 1 resuelta en 7 días")
  })
  it("Nuevas muestra solo las nuevas, cada una con su «✓ Revisar»; Revisadas, la revisada con su sello", () => {
    const { container: c } = pinta()
    expect(c.querySelector("[data-decision]")?.getAttribute("data-decision")).toBe("a"); expect(c.querySelector(`[data-revisar="${CLAVE("a")}"]`)).not.toBeNull()
    expect(c.querySelector("[data-posicion]")?.textContent).toBe("1 de 2")
    fireEvent.click(c.querySelector('[data-recuadro="revisadas"]')!)
    expect(c.querySelector("[data-decision]")?.getAttribute("data-decision")).toBe("c"); expect(c.querySelector(`[data-revisada="${CLAVE("c")}"]`)).not.toBeNull()
  })
  it("«✓ Revisar» mueve los números en el acto (Nuevas −1, Revisadas +1) y lo dice; abrir o pasar de tarjeta NO marca nada", async () => {
    const f = vi.fn(async () => respuesta(true))
    const { container: c } = pinta(f as unknown as typeof fetch)
    fireEvent.click(c.querySelector("[data-siguiente]")!); fireEvent.click(c.querySelector("[data-anterior]")!)
    expect(f).not.toHaveBeenCalled(); expect(numero(c, "nuevas")).toBe("2")
    fireEvent.click(c.querySelector(`[data-revisar="${CLAVE("a")}"]`)!)
    await waitFor(() => expect(numero(c, "nuevas")).toBe("1"))
    expect(numero(c, "revisadas")).toBe("2"); expect(f).toHaveBeenCalledTimes(1)
    expect(c.querySelector("[data-aviso]")?.textContent).toBe("La marcaste como revisada: ahora está en «Revisadas».")
    expect(c.querySelector("[data-decision]")?.getAttribute("data-decision")).toBe("b")
  })
  it("si no se guarda, la decisión sigue Nueva y el panel lo dice", async () => {
    const { container: c } = pinta((async () => respuesta(false)) as unknown as typeof fetch)
    fireEvent.click(c.querySelector(`[data-revisar="${CLAVE("a")}"]`)!)
    await waitFor(() => expect(c.querySelector("[data-revisar-fallo]")).not.toBeNull())
    expect(numero(c, "nuevas")).toBe("2"); expect(numero(c, "revisadas")).toBe("1")
  })
  it("Resueltas: la lista de lo decidido en 7 días, solo lectura (sin botones de decidir)", () => {
    const { container: c } = pinta()
    fireEvent.click(c.querySelector('[data-recuadro="resueltas"]')!)
    expect(c.querySelector("[data-resuelta=r1]")?.textContent).toContain("¿Cuántas sedes?")
    expect(c.querySelector("[data-resuelta=r1]")?.textContent).toContain("Náufrago · resuelta")
    expect(c.querySelector("[data-resueltas]")?.textContent).toContain("Lo que se decidió en los últimos 7 días.")
    expect(c.querySelector("[data-verbo]")).toBeNull(); expect(c.querySelector("[data-revisar]")).toBeNull()
  })
  it("CC6 #316 menor 1 · lo que contestas en esta visita se suma a «Resueltas» en el acto (sin esperar la próxima lectura)", async () => {
    // la relectura (después de contestar) ya no trae la contestada, y el registro de la plataforma todavía no la tiene
    const despues = { ok: true, ...datos(), decisiones: datos().decisiones.filter((d) => d.id !== "a") }
    const f = vi.fn(async (url: string) => (String(url).includes("/api/alertas/visto") ? respuesta(true)
      : String(url) === "/api/direccion/decisiones" ? new Response(JSON.stringify(despues), { status: 200, headers: { "Content-Type": "application/json" } })
      : new Response(JSON.stringify({ ok: true, sale: true, texto: "Contestada.", registro: [{ cuando: "2026-11-10T01:00:00Z", quien: "tu", estado: "respondiste", texto: "Respondiste" }] }), { status: 200, headers: { "Content-Type": "application/json" } })))
    const { container: c } = pinta(f as unknown as typeof fetch)
    expect(numero(c, "resueltas")).toBe("1")
    fireEvent.change(c.querySelector("[data-respuesta]")!, { target: { value: "En dos meses" } })
    fireEvent.click(c.querySelector("[data-verbo=responder]")!)
    await waitFor(() => expect(numero(c, "resueltas")).toBe("2"))
    fireEvent.click(c.querySelector('[data-recuadro="resueltas"]')!)
    expect(c.querySelector("[data-resuelta=a]")?.textContent).toContain("¿Pregunta a?")
  })
  it("CC6 #316 menor 2 · si el registro de lo resuelto vino incompleto, lo dice (no se oculta)", () => {
    const inc = normalizarDecisiones({ completo: true, decisiones: [], contestadas: [{ id: "r1", titulo: "¿Ya?" }], registro_completo: false })
    const { container: c } = render(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: inc }))
    fireEvent.click(c.querySelector('[data-recuadro="resueltas"]')!)
    expect(c.querySelector("[data-resueltas]")?.textContent).toContain("Puede faltar alguna: el registro vino incompleto.")
    cleanup()
    const { container: e } = pinta(); fireEvent.click(e.querySelector('[data-recuadro="resueltas"]')!)
    expect(e.querySelector("[data-resueltas]")?.textContent).not.toContain("Puede faltar")
  })
  it("CC7 · alerta sin estado (la libreta no se leyó): la tarjeta sigue en Nuevas con su «✓ Revisar», pero el número dice «—» (solo el guion, sin texto: Lenovo 00:30Z)", () => {
    const caida = normalizarDecisiones({ completo: true, decisiones: [pregunta("a", { clave: CLAVE("a"), estado: null }), pregunta("b", { clave: CLAVE("b"), estado: "nueva" })] })
    const { container: c } = render(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: caida }))
    expect(numero(c, "nuevas")).toBe("—"); expect(numero(c, "revisadas")).toBe("0")
    expect(c.querySelector("[data-sin-libreta]")).toBeNull(); expect(c.textContent).not.toMatch(/No pude leer/) // a la vista, solo el guion (el resumen para lectores de pantalla sí lo dice)
    expect(c.querySelector("[data-posicion]")?.textContent).toBe("1 de 2"); expect(c.querySelector(`[data-revisar="${CLAVE("a")}"]`)).not.toBeNull()
    expect(c.querySelector("[data-resumen]")?.textContent).toMatch(/^nuevas sin dato · 0 revisadas/)
    cleanup()
    const { container: e } = pinta(); expect(numero(e, "nuevas")).toBe("2")
  })
  it("sin registro de lo resuelto: «—» en el recuadro y «sin dato» en la lista (nunca 0)", () => {
    const sin = normalizarDecisiones({ completo: true, decisiones: [pregunta("a", { clave: CLAVE("a"), estado: "nueva" })] })
    const { container: c } = render(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: sin }))
    expect(numero(c, "resueltas")).toBe("—")
    fireEvent.click(c.querySelector('[data-recuadro="resueltas"]')!)
    expect(c.querySelector("[data-resueltas-sin-dato]")?.textContent).toBe("Sin dato: todavía no llega el registro de lo resuelto.")
  })
  it("una decisión sin alerta (plataforma vieja) cuenta como Nueva y no ofrece un «✓ Revisar» que fallaría", () => {
    const vieja = normalizarDecisiones({ completo: true, decisiones: [pregunta("a")] })
    const { container: c } = render(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: vieja }))
    expect(numero(c, "nuevas")).toBe("1"); expect(c.querySelector("[data-revisar]")).toBeNull(); expect(c.querySelector("[data-fila-revisar]")).toBeNull()
  })
})
