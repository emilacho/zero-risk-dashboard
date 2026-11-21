// @vitest-environment jsdom
/**
 * CENTRO DE CAMPAÑA · LAS 4 DECISIONES DE LENOVO (20-nov 23:53, sobre los 🟡 de diseño de CC7 a #357) · sin red ni base (US$ 0).
 *   1 · los 3 lugares muestran las 3 campañas vivas MÁS NUEVAS: la elegida por omisión siempre tiene su lugar
 *   2 · si la tocada deja de estar viva, se olvida y todo vuelve a la más nueva (subtítulo y cuadros, la misma campaña)
 *   3 · brief y gran idea abiertos leen la campaña elegida (`&campana=`), como sus cuadros
 *   4 · «Crear Campaña» lleva `aria-disabled` (el 🟡 menor c3 de CC7)
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { flujoDeCampana, type CampanaDelFlujo } from "@/lib/flujo-de-campana"
import { PanelAplicaciones } from "@/components/nuevo/PanelAplicaciones"
import { LugaresDeCampana, campanaElegida, campanaElegidaConToque, campanasConLugar } from "@/components/nuevo/LugaresDeCampana"
import type { Centro } from "@/lib/centro-datos"
import type { Pizarron } from "@/lib/pizarron-datos"
import { faseActiva } from "@/lib/pizarron"

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const ID = (n: number) => `${n}${n}${n}${n}${n}${n}${n}${n}-1111-4111-8111-11111111111${n}`
const VERDE = flujoDeCampana({ estado: "activa" })!
const ROJO = flujoDeCampana({ estado: "necesita_humano", estado_motivo: "el presupuesto de planificación se agotó (US$ 5 de 6)" })!
const C = (n: number, flujo = VERDE): CampanaDelFlujo => ({ campana_id: ID(n), nombre: `Campaña número ${n}`, flujo })
const [C1, C2, C3, C4] = [C(1, ROJO), C(2), C(3), C(4)]

type Camp = NonNullable<Pizarron["campana"]>
const camp = (id: string): Camp => ({ id, estado: "activa", desde: "2026-11-09", hasta: "2027-02-06", version_calendario: null, version_estrategia: 1 })
const piz = (campana: string): Pizarron => ({
  clientes: [{ id: NAUFRAGO, nombre: "Náufrago", con_campana: true }], cliente: { id: NAUFRAGO, nombre: "Náufrago" }, campana: camp(campana),
  fases: [], fase_activa: faseActiva([], null, "2026-11-20"), gran_idea: { texto: null, nota: "" }, esperas: [], filas: [], semanas: [], totales: {}, manual_aprobado: true,
  hoy: "2026-11-20", leido_en: "x",
} as Pizarron)
const cen = (campana: string): Centro => ({
  cliente: NAUFRAGO,
  informes: { texto: "", aviso: false, total: 0, esperan: 0, ultimo: null },
  brief: { texto: "", aviso: false, publicado: true, versiones: 0, estado: null, fecha: null },
  gran_idea: { texto: "", aviso: false, publicado: true, versiones: 0, estado: null, fecha: null },
  equipo: { texto: "", aviso: false, trabajando: 0, agentes: 24 },
  manual: { total: 1, aprobado: true, fecha: null }, plan: null, dinero: { gastado_24h_usd: 0, techo_usd: 60 },
  de_la_campana: { campana_id: campana, gastado_usd: 1, trabajando: [] }, leido_en: "x",
})

/** la red de mentira · `muertas`: las campañas que el servidor ya no puede mostrar (devuelve la más nueva, la regla de #358) */
function red(o: { muertas?: string[]; masNueva?: string } = {}) {
  const pedidos: Array<{ url: string; metodo: string }> = []
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    pedidos.push({ url, metodo: init?.method ?? "GET" })
    const u = new URL(url, "http://x"), pedida = u.searchParams.get("campana")
    const vale = pedida && !(o.muertas ?? []).includes(pedida) ? pedida : (o.masNueva ?? C3.campana_id)
    if (init?.method === "POST") return new Response(JSON.stringify({ ok: true, flujo: VERDE }), { status: 200 })
    if (u.pathname === "/api/pizarron") return new Response(JSON.stringify({ ok: true, ...piz(vale) }), { status: 200 })
    if (u.pathname === "/api/centro") return new Response(JSON.stringify({ ok: true, ...cen(vale) }), { status: 200 })
    return new Response(JSON.stringify({ ok: false, error: "sin datos en la prueba" }), { status: 404 })
  }))
  return pedidos
}
const pintar = (campanas: CampanaDelFlujo[], masNueva: string) =>
  render(<PanelAplicaciones onCerrar={() => {}} datosIniciales={piz(masNueva)} flujoInicial={{ campana_id: masNueva, flujo: VERDE, campanas }} />)
const botones = (c: HTMLElement) => [...c.querySelectorAll("[data-lugares-de-campana] [data-flujo]")] as HTMLButtonElement[]
const subtitulo = (c: HTMLElement) => c.querySelector("[data-campana-nombre]")?.textContent ?? null
const cuadro = (c: HTMLElement, clave: string) => c.querySelector(`[data-aplicacion="${clave}"]`) as HTMLElement
/** 21-nov · la campaña se elige con la flecha ▾ del subtítulo (ya no tocando su botón de abajo) */
const elegirConLaFlecha = (c: HTMLElement, id: string) => { fireEvent.click(c.querySelector("[data-flecha-de-campanas]") as HTMLElement); fireEvent.click(c.querySelector(`[data-campana-de-la-lista="${id}"]`) as HTMLElement) }
/** la marcada en la lista de la flecha (la abre, la lee y la cierra) */
const marcadaEnLaLista = (c: HTMLElement) => { const f = c.querySelector("[data-flecha-de-campanas]") as HTMLElement; fireEvent.click(f); const id = (c.querySelector('[data-lista-de-campanas] [aria-checked="true"]') as HTMLElement | null)?.dataset.campanaDeLaLista ?? null; fireEvent.click(f); return id }

afterEach(() => { cleanup(); vi.unstubAllGlobals(); try { localStorage.clear() } catch { /* sin almacenamiento */ } })

describe("1 · los 3 lugares son de las 3 vivas MÁS NUEVAS", () => {
  it("con 4 vivas quedan la 2.ª, la 3.ª y la 4.ª (en su orden); con menos, todas; las sin botón no cuentan", () => {
    expect(campanasConLugar([C1, C2, C3, C4]).map((c) => c.campana_id)).toEqual([C2, C3, C4].map((c) => c.campana_id))
    expect(campanasConLugar([C1, C2]).map((c) => c.campana_id)).toEqual([C1, C2].map((c) => c.campana_id))
    expect(campanasConLugar([C1, C2, C3, { ...C4, flujo: null }]).map((c) => c.campana_id)).toEqual([C1, C2, C3].map((c) => c.campana_id))
  })
  it("🔴 la elegida por omisión (la más nueva) siempre tiene su lugar: está en los botones y es la marcada en la lista de la flecha", () => {
    red({ masNueva: C4.campana_id })
    const { container } = pintar([C1, C2, C3, C4], C4.campana_id)
    const bs = botones(container)
    expect(bs).toHaveLength(3)
    expect(bs.map((b) => b.getAttribute("aria-label"))).not.toContain(expect.stringContaining("Campaña número 1"))
    expect(marcadaEnLaLista(container)).toBe(C4.campana_id)
    // 21-nov · la lista de la flecha son las mismas 3 de los lugares, en su orden: la 1.ª (sin lugar) no se puede elegir
    fireEvent.click(container.querySelector("[data-flecha-de-campanas]") as HTMLElement)
    expect([...container.querySelectorAll("[data-campana-de-la-lista]")].map((x) => (x as HTMLElement).dataset.campanaDeLaLista)).toEqual([C2, C3, C4].map((c) => c.campana_id))
    expect(bs[2].getAttribute("aria-label")).toContain("Campaña número 4")
    expect(subtitulo(container)).toBe("Campaña número 4")
    expect(campanasConLugar([C1, C2, C3, C4])).toContain(campanaElegida([C1, C2, C3, C4]))
  })
  it("una tocada sin lugar no cuenta como elegida: vuelve la de por omisión", () => {
    expect(campanaElegidaConToque([C1, C2, C3, C4], C1.campana_id)?.campana_id).toBe(C4.campana_id)
    expect(campanaElegidaConToque([C1, C2, C3, C4], C2.campana_id)?.campana_id).toBe(C2.campana_id)
  })
})

describe("2 · la tocada que deja de estar viva se olvida", () => {
  it("🔴 el servidor ya no puede mostrar la tocada (devuelve la más nueva): el subtítulo vuelve a la más nueva y el centro se lee SIN `campana`", async () => {
    const pedidos = red({ muertas: [C1.campana_id], masNueva: C3.campana_id })
    const { container } = pintar([C1, C2, C3], C3.campana_id)
    elegirConLaFlecha(container, C1.campana_id)
    await waitFor(() => expect(pedidos.some((p) => p.url === `/api/pizarron?cliente=${NAUFRAGO}&campana=${C1.campana_id}`)).toBe(true))
    await waitFor(() => expect(marcadaEnLaLista(container)).toBe(C3.campana_id))
    expect(subtitulo(container)).toBe("Campaña número 3")
    const despues = pedidos.slice(pedidos.findIndex((p) => p.url.includes(`campana=${C1.campana_id}`)) + 1)
    await waitFor(() => expect(despues.concat(pedidos.slice(-1)).some((p) => p.url.startsWith("/api/centro"))).toBe(true))
    const centros = pedidos.slice(pedidos.findIndex((p) => p.url.includes(`campana=${C1.campana_id}`)) + 1).filter((p) => p.url.startsWith("/api/centro"))
    expect(centros.length).toBeGreaterThan(0)
    expect(centros.every((p) => !p.url.includes("campana="))).toBe(true)
    // olvidada de verdad: elegirla otra vez con la flecha la vuelve a pedir (ningún POST)
    elegirConLaFlecha(container, C1.campana_id)
    await waitFor(() => expect(pedidos.filter((p) => p.url.includes(`campana=${C1.campana_id}`)).length).toBe(2))
    expect(pedidos.filter((p) => p.metodo === "POST")).toEqual([])
  })
  it("si la tocada sigue viva, se queda (el pizarrón la devuelve y el centro se lee con ella)", async () => {
    const pedidos = red({ masNueva: C3.campana_id })
    const { container } = pintar([C1, C2, C3], C3.campana_id)
    elegirConLaFlecha(container, C1.campana_id)
    await waitFor(() => expect(pedidos.some((p) => p.url === `/api/centro?cliente=${NAUFRAGO}&campana=${C1.campana_id}`)).toBe(true))
    expect(marcadaEnLaLista(container)).toBe(C1.campana_id)
    expect(subtitulo(container)).toBe("Campaña número 1")
  })
})

describe("3 · brief y gran idea abiertos leen la campaña elegida", () => {
  it("🔴 tras elegir otra campaña con la flecha, el brief abierto pide `&campana=` de ESA campaña", async () => {
    const pedidos = red({ masNueva: C3.campana_id })
    const { container } = pintar([C1, C2, C3], C3.campana_id)
    elegirConLaFlecha(container, C1.campana_id)
    await waitFor(() => expect(marcadaEnLaLista(container)).toBe(C1.campana_id))
    fireEvent.click(cuadro(container, "brief"))
    await waitFor(() => expect(pedidos.some((p) => p.url.startsWith("/api/brief"))).toBe(true))
    expect(pedidos.filter((p) => p.url.startsWith("/api/brief")).map((p) => p.url)).toEqual([`/api/brief?cliente=${NAUFRAGO}&campana=${C1.campana_id}`])
  })
  it("🔴 tras elegir otra campaña con la flecha, la gran idea abierta pide `&campana=` de ESA campaña", async () => {
    const pedidos = red({ masNueva: C3.campana_id })
    const { container } = pintar([C1, C2, C3], C3.campana_id)
    elegirConLaFlecha(container, C2.campana_id)
    await waitFor(() => expect(marcadaEnLaLista(container)).toBe(C2.campana_id))
    fireEvent.click(cuadro(container, "gran_idea"))
    await waitFor(() => expect(pedidos.some((p) => p.url.startsWith("/api/gran-idea"))).toBe(true))
    expect(pedidos.filter((p) => p.url.startsWith("/api/gran-idea")).map((p) => p.url)).toEqual([`/api/gran-idea?cliente=${NAUFRAGO}&campana=${C2.campana_id}`])
  })
  it("sin tocar, brief y gran idea se piden SIN `campana` (el servidor muestra la viva más nueva, como antes)", async () => {
    const pedidos = red({ masNueva: C3.campana_id })
    const { container } = pintar([C1, C2, C3], C3.campana_id)
    fireEvent.click(cuadro(container, "brief"))
    await waitFor(() => expect(pedidos.some((p) => p.url.startsWith("/api/brief"))).toBe(true))
    expect(pedidos.filter((p) => p.url.startsWith("/api/brief")).map((p) => p.url)).toEqual([`/api/brief?cliente=${NAUFRAGO}`])
  })
})

describe("4 · «Crear Campaña» lleva `aria-disabled`", () => {
  it("🔴 cada lugar libre dice «Crear Campaña» y está marcado como deshabilitado para quien usa lector", () => {
    red()
    const { container } = render(<LugaresDeCampana clienteId={NAUFRAGO} campanas={[C1]} />)
    const crear = [...container.querySelectorAll("[data-crear-campana]")]
    expect(crear).toHaveLength(2)
    for (const b of crear) { expect(b.getAttribute("aria-disabled")).toBe("true"); expect(b.textContent).toContain("Crear Campaña") }
  })
})
