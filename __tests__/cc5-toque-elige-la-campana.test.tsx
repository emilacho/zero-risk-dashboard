// @vitest-environment jsdom
/**
 * EL TOQUE QUE ELIGE LA CAMPAÑA (Emilio 19-nov 23:23 · GO de Lenovo a CC5, al pie) · sin red ni base (US$ 0).
 *   · el 1.er toque sobre una campaña NO elegida solo la elige: no para ni reanuda (ningún POST)
 *   · el toque sobre la YA elegida para o reanuda, como siempre
 *   · al elegir, el subtítulo y los 6 cuadros desde «Brief» siguen a ESA campaña: el pizarrón y el centro se vuelven a leer con `&campana=`
 *   · sin tocar no se manda `campana` (el servidor muestra la viva más nueva, #358); al cambiar de cliente, la tocada se olvida
 *   · Equipo y Dinero (ajuste de Emilio 22:07): quiénes trabajan y lo gastado son de la campaña; el tope diario sigue siendo del cliente
 *   · sin marcas ni textos nuevos a la vista
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { flujoDeCampana, type CampanaDelFlujo } from "@/lib/flujo-de-campana"
import { PanelAplicaciones, conCampana } from "@/components/nuevo/PanelAplicaciones"
import { LugaresDeCampana, campanaElegidaConToque } from "@/components/nuevo/LugaresDeCampana"
import { tarjetaDelCentro } from "@/lib/centro-tarjetas"
import type { Centro } from "@/lib/centro-datos"
import type { Pizarron } from "@/lib/pizarron-datos"
import { faseActiva } from "@/lib/pizarron"
import { guardarClienteDeTrabajo } from "@/lib/cliente-de-trabajo"

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const OTRO_CLIENTE = "99999999-8888-7777-6666-555555555555"
const VIEJA = "36e66179-3061-4a7d-94db-932a900d9515"
const NUEVA = "22222222-3333-4444-5555-666666666666"
const ROJO = flujoDeCampana({ estado: "necesita_humano", estado_motivo: "el presupuesto de planificación se agotó (US$ 5 de 6)" })!
const VERDE = flujoDeCampana({ estado: "activa" })!
const C_VIEJA: CampanaDelFlujo = { campana_id: VIEJA, nombre: "Impulso del encebollado a domicilio", flujo: ROJO }
const C_NUEVA: CampanaDelFlujo = { campana_id: NUEVA, nombre: "Lanzamiento del delivery en Guayaquil", flujo: VERDE }

type Camp = NonNullable<Pizarron["campana"]>
const camp = (id: string, estado: string): Camp => ({ id, estado, desde: "2026-11-09", hasta: "2027-02-06", version_calendario: null, version_estrategia: 1 })
const piz = (cliente = NAUFRAGO, campana = NUEVA): Pizarron => ({
  clientes: [{ id: NAUFRAGO, nombre: "Náufrago", con_campana: true }, { id: OTRO_CLIENTE, nombre: "Otro", con_campana: true }],
  cliente: { id: cliente, nombre: cliente === NAUFRAGO ? "Náufrago" : "Otro" }, campana: camp(campana, campana === VIEJA ? "necesita_humano" : "activa"),
  fases: [], fase_activa: faseActiva([], null, "2026-11-19"), gran_idea: { texto: null, nota: "" }, esperas: [], filas: [], semanas: [], totales: {}, manual_aprobado: true,
  hoy: "2026-11-19", leido_en: "x",
} as Pizarron)
const cen = (de_la_campana: Centro["de_la_campana"] = null, o: Partial<Centro> = {}): Centro => ({
  cliente: NAUFRAGO,
  informes: { texto: "", aviso: false, total: 4, esperan: 0, ultimo: "2026-11-06T15:00:00Z" },
  brief: { texto: "", aviso: false, publicado: true, versiones: 0, estado: null, fecha: null },
  gran_idea: { texto: "", aviso: false, publicado: true, versiones: 0, estado: null, fecha: null },
  equipo: { texto: "", aviso: false, trabajando: 5, agentes: 24 },
  manual: { total: 5, aprobado: true, fecha: "2026-11-04T12:07:41Z" },
  plan: { estado: "approved", version: 2, fecha: "2026-11-06T11:20:56Z" },
  dinero: { gastado_24h_usd: 9, techo_usd: 60 },
  de_la_campana, leido_en: "x", ...o,
})
const DE_LA_VIEJA = { campana_id: VIEJA, gastado_usd: 15.29, trabajando: ["editor_en_jefe"] }
const DE_LA_NUEVA = { campana_id: NUEVA, gastado_usd: 2.5, trabajando: ["brand_strategist", "copywriter", "editor_en_jefe"] }

/** la red de mentira: anota cada pedido y contesta como las rutas reales (pizarrón y centro siguen al `campana`; sin él, la más nueva) */
function red() {
  const pedidos: Array<{ url: string; metodo: string; cuerpo?: unknown }> = []
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    pedidos.push({ url, metodo: init?.method ?? "GET", cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined })
    const u = new URL(url, "http://x")
    const campana = u.searchParams.get("campana"), cliente = u.searchParams.get("cliente") ?? NAUFRAGO
    if (init?.method === "POST") return new Response(JSON.stringify({ ok: true, flujo: VERDE }), { status: 200 })
    if (u.pathname === "/api/pizarron") return new Response(JSON.stringify({ ok: true, ...piz(cliente, campana ?? NUEVA) }), { status: 200 })
    if (u.pathname === "/api/centro") return new Response(JSON.stringify({ ok: true, ...cen(campana === VIEJA ? DE_LA_VIEJA : DE_LA_NUEVA, { cliente }) }), { status: 200 })
    return new Response(JSON.stringify({ ok: false, error: "no esperado" }), { status: 404 })
  })
  vi.stubGlobal("fetch", f)
  return pedidos
}
const pintar = () => render(<PanelAplicaciones onCerrar={() => {}} datosIniciales={piz()} flujoInicial={{ campana_id: NUEVA, flujo: VERDE, campanas: [C_VIEJA, C_NUEVA] }} />)
const botones = (c: HTMLElement) => [...c.querySelectorAll("[data-lugares-de-campana] [data-flujo]")] as HTMLButtonElement[]
const subtitulo = (c: HTMLElement) => c.querySelector("[data-campana-nombre]")?.textContent ?? c.querySelector("[data-cliente-como-texto]")?.textContent ?? null
const cuadro = (c: HTMLElement, clave: string) => c.querySelector(`[data-aplicacion="${clave}"]`) as HTMLElement
const posts = (p: ReturnType<typeof red>) => p.filter((x) => x.metodo === "POST")

describe("19-nov · el toque que elige la campaña (Emilio 23:23)", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); try { localStorage.clear() } catch { /* sin almacenamiento */ } })

  it("sin tocar: la elegida es la viva más nueva, la marca va solo en atributos (sin textos nuevos) y el centro se lee SIN `campana`", async () => {
    const pedidos = red()
    const { container } = pintar()
    const [vieja, nueva] = botones(container)
    expect(vieja.dataset.elegida).toBe("false"); expect(nueva.dataset.elegida).toBe("true")
    expect(nueva.getAttribute("aria-current")).toBe("true"); expect(vieja.getAttribute("aria-current")).toBeNull()
    expect(subtitulo(container)).toBe("Lanzamiento del delivery en Guayaquil")
    await waitFor(() => expect(pedidos.some((p) => p.url.startsWith("/api/centro"))).toBe(true))
    expect(pedidos.filter((p) => p.url.startsWith("/api/centro")).every((p) => !p.url.includes("campana="))).toBe(true)
    // el botón elegido y el no elegido se ven igual: mismas clases salvo el color de su estado
    const sinColor = (k: string) => k.split(" ").filter((x) => !/^(border|text|bg)-(linea|oro|alarma|marcha)$|^zr-flujo-detenido$/.test(x)).join(" ")
    expect(sinColor(vieja.className)).toBe(sinColor(nueva.className))
    expect(vieja.textContent).not.toMatch(/elegid|seleccion/i); expect(nueva.textContent).not.toMatch(/elegid|seleccion/i)
  })

  it("🔴 el 1.er toque sobre una NO elegida solo la elige: ningún POST, cambia el subtítulo y se releen el pizarrón y el centro de ESA campaña", async () => {
    const pedidos = red()
    const { container } = pintar()
    fireEvent.click(botones(container)[0])
    await waitFor(() => expect(subtitulo(container)).toBe("Impulso del encebollado a domicilio"))
    expect(posts(pedidos)).toEqual([])
    await waitFor(() => expect(pedidos.some((p) => p.url === `/api/pizarron?cliente=${NAUFRAGO}&campana=${VIEJA}`)).toBe(true))
    await waitFor(() => expect(pedidos.some((p) => p.url === `/api/centro?cliente=${NAUFRAGO}&campana=${VIEJA}`)).toBe(true))
    const [vieja, nueva] = botones(container)
    expect(vieja.dataset.elegida).toBe("true"); expect(nueva.dataset.elegida).toBe("false")
    // el botón no cambió de color: no se paró ni se reanudó nada
    expect(vieja.dataset.flujo).toBe("rojo")
    // los cuadros de la campaña muestran la elegida: el Dinero dice lo gastado por ESA campaña y el Equipo quiénes trabajan en ella
    await waitFor(() => expect(cuadro(container, "gasto").querySelector("[data-cantidad]")?.textContent).toBe("US$ 15"))
    expect(cuadro(container, "equipo").querySelector("[data-linea]")?.textContent).toBe("1 trabajando")
  })

  it("🔴 el toque sobre la YA elegida para o reanuda, como siempre (un POST de ESA campaña)", async () => {
    const pedidos = red()
    const { container } = pintar()
    fireEvent.click(botones(container)[1])
    await waitFor(() => expect(posts(pedidos)).toHaveLength(1))
    expect(posts(pedidos)[0]).toMatchObject({ url: "/api/flujo", cuerpo: { campana_id: NUEVA, quiero: "parar" } })
    // y después de elegir la vieja, tocarla otra vez la reanuda
    fireEvent.click(botones(container)[0])
    await waitFor(() => expect(botones(container)[0].dataset.elegida).toBe("true"))
    expect(posts(pedidos)).toHaveLength(1)
    fireEvent.click(botones(container)[0])
    await waitFor(() => expect(posts(pedidos)).toHaveLength(2))
    expect(posts(pedidos)[1]).toMatchObject({ cuerpo: { campana_id: VIEJA, quiero: "reanudar" } })
  })

  it("al cambiar de cliente arriba, la campaña tocada se olvida: el pizarrón del otro cliente se lee SIN `campana`", async () => {
    const pedidos = red()
    const { container } = pintar()
    fireEvent.click(botones(container)[0])
    await waitFor(() => expect(pedidos.some((p) => p.url.includes(`campana=${VIEJA}`))).toBe(true))
    guardarClienteDeTrabajo({ id: OTRO_CLIENTE, nombre: "Otro" })
    await waitFor(() => expect(pedidos.some((p) => p.url.startsWith(`/api/pizarron?cliente=${OTRO_CLIENTE}`))).toBe(true))
    const delOtro = pedidos.filter((p) => p.url.includes(OTRO_CLIENTE))
    expect(delOtro.length).toBeGreaterThan(0)
    expect(delOtro.every((p) => !p.url.includes("campana="))).toBe(true)
  })

  it("los lugares sin `onElegir` (el botón suelto de siempre): el toque para o reanuda directo, sin atributos de elegida", async () => {
    const pedidos = red()
    const { container } = render(<LugaresDeCampana clienteId={NAUFRAGO} campanas={[C_VIEJA, C_NUEVA]} />)
    const [vieja] = botones(container)
    expect(vieja.dataset.elegida).toBeUndefined(); expect(vieja.getAttribute("aria-current")).toBeNull()
    fireEvent.click(vieja)
    await waitFor(() => expect(posts(pedidos)).toHaveLength(1))
    expect(posts(pedidos)[0]).toMatchObject({ cuerpo: { campana_id: VIEJA, quiero: "reanudar" } })
  })

  it("la elegida con toque: la tocada si sigue viva con botón; si ya no está (o sin tocar), la viva más nueva", () => {
    expect(campanaElegidaConToque([C_VIEJA, C_NUEVA], VIEJA)?.campana_id).toBe(VIEJA)
    expect(campanaElegidaConToque([C_VIEJA, C_NUEVA], null)?.campana_id).toBe(NUEVA)
    expect(campanaElegidaConToque([C_NUEVA], VIEJA)?.campana_id).toBe(NUEVA)
    expect(campanaElegidaConToque([{ ...C_VIEJA, flujo: null }, C_NUEVA], VIEJA)?.campana_id).toBe(NUEVA)
    expect(campanaElegidaConToque(null, VIEJA)).toBeNull()
  })

  it("`conCampana`: agrega `campana` solo si hay una, con `&` o `?` según la dirección", () => {
    expect(conCampana(`/api/centro?cliente=${NAUFRAGO}`, VIEJA)).toBe(`/api/centro?cliente=${NAUFRAGO}&campana=${VIEJA}`)
    expect(conCampana("/api/centro", VIEJA)).toBe(`/api/centro?campana=${VIEJA}`)
    expect(conCampana(`/api/centro?cliente=${NAUFRAGO}`, null)).toBe(`/api/centro?cliente=${NAUFRAGO}`)
  })
})

describe("19-nov · Equipo y Dinero de la campaña elegida (ajuste de Emilio 22:07)", () => {
  it("Equipo: quiénes trabajan son los de la campaña; la cantidad de empleados sigue siendo del cliente", () => {
    const t = tarjetaDelCentro("equipo", piz(), cen(DE_LA_NUEVA))
    expect(t).toEqual({ estado: "Activos", tono: "oro", cantidad: "24", linea: "3 trabajando" })
    expect(tarjetaDelCentro("equipo", piz(), cen({ ...DE_LA_NUEVA, trabajando: [] }))).toMatchObject({ estado: "Sin tareas", linea: "Nadie trabaja ahora" })
    // sin campaña elegida, como antes: los del cliente
    expect(tarjetaDelCentro("equipo", piz(), cen(null)).linea).toBe("5 trabajando")
  })
  it("Dinero: la cifra es lo gastado por la campaña («Gastado», no «24 h»); el tope y su alarma siguen siendo del cliente", () => {
    expect(tarjetaDelCentro("gasto", piz(), cen(DE_LA_VIEJA))).toEqual({ estado: "Gastado", tono: "gris", cantidad: "US$ 15", linea: "Tope US$ 60/día" })
    // el cliente llegó a su tope en 24 h: alarma, aunque la campaña haya gastado poco
    expect(tarjetaDelCentro("gasto", piz(), cen(DE_LA_NUEVA, { dinero: { gastado_24h_usd: 60, techo_usd: 60 } }))).toEqual({ estado: "En el tope", tono: "alarma", cantidad: "US$ 2,5", linea: "Tope US$ 60/día" })
    // la campaña gastó más que el tope diario pero el cliente no está en el tope hoy: sin alarma (el tope es por día y del cliente)
    expect(tarjetaDelCentro("gasto", piz(), cen({ ...DE_LA_VIEJA, gastado_usd: 80 })).tono).toBe("gris")
    // sin lectura del tope: la cifra de la campaña igual, y la línea lo dice
    expect(tarjetaDelCentro("gasto", piz(), cen(DE_LA_VIEJA, { dinero: null }))).toEqual({ estado: "Gastado", tono: "gris", cantidad: "US$ 15", linea: "Sin dato del tope" })
    // sin campaña elegida, como antes
    expect(tarjetaDelCentro("gasto", piz(), cen(null))).toEqual({ estado: "Gastado 24 h", tono: "gris", cantidad: "US$ 9", linea: "Tope US$ 60/día" })
  })
})
