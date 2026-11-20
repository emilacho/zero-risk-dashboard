// @vitest-environment jsdom
/**
 * «CREAR CAMPAÑA» · EL FORMULARIO (20-nov · GO Lenovo 22:05 Zúrich · boceto aprobado por Emilio 22:03, «PERFECTO») · sin red ni base (US$ 0).
 *   · «Crear Campaña» del Centro abre el formulario (sin `onCrear` sigue deshabilitado, como antes)
 *   · una pregunta por pantalla con su rótulo, su pregunta escrita debajo, «N de 5» y «Atrás / Siguiente»; «Siguiente» se apaga sin respuesta
 *   · el tope es obligatorio: sin mínimo leído no se puede seguir; debajo del mínimo, el número del mínimo en rojo y «Siguiente» apagado
 *   · el resumen manda UNA vez a `POST /api/acciones/crear-campana` con la llave del formulario, y de ahí a `POST /api/tablero/crear-campana` (no gasta)
 *   · el servidor del tablero valida igual que la pantalla (la pantalla puede mentir)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { FormularioCrearCampana, motivoDeNoCrear } from "@/components/nuevo/FormularioCrearCampana"
import { LugaresDeCampana } from "@/components/nuevo/LugaresDeCampana"
import { PanelAplicaciones } from "@/components/nuevo/PanelAplicaciones"
import { flujoDeCampana, type CampanaDelFlujo } from "@/lib/flujo-de-campana"
import { ACCIONES, ejecutarAccion } from "@/lib/tablero-acciones"
import { LLAVE, PASOS, VACIAS, cuerpoDeCrear, leerMinimo, minimoDeLaRespuesta, pasosListos, topeEscrito, validarCrear, type RespuestasDeCrear } from "@/lib/crear-campana"
import type { Pizarron } from "@/lib/pizarron-datos"
import { faseActiva } from "@/lib/pizarron"

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
// la campaña viva real de Náufrago (lectura del 20-nov, solo lectura): rojo, «se acabó la bolsa de planificación», sin nombre
const VIVA = "36e66179-3061-4a7d-94db-932a900d9515"
const ROJO = flujoDeCampana({ estado: "necesita_humano", estado_motivo: "el presupuesto de planificación se agotó" })!
const C_VIVA: CampanaDelFlujo = { campana_id: VIVA, nombre: null, flujo: ROJO }
const HOY = "2026-11-20"
const LISTAS: RespuestasDeCrear = {
  nombre: "Lanzamiento del delivery en Guayaquil",
  cambio: "Que en Guayaquil sepan que Náufrago ahora llega a domicilio y hagan su primer pedido.",
  inicio: "2026-12-01", fin: "2027-01-31",
  claves: [{ fecha: "2026-12-05", que: "Abre el delivery" }, { fecha: "", que: "" }],
  tope: "150", brief: "Oferta: envío gratis en el primer pedido.",
}
const LLAVE_X = "crear-11111111-2222-4333-8444-555555555555"

// el día de hoy fijo (20-nov, 15:00 en Ecuador): «el inicio desde hoy» no puede depender del día en que corre la prueba
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-20T20:00:00Z")) })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe("las reglas de las 5 preguntas (lib/crear-campana)", () => {
  it("son 5, con rótulos de 1 o 2 palabras y la pregunta escrita debajo (menos «Tu brief», que es su propia pregunta)", () => {
    expect(PASOS.map((p) => p.rotulo)).toEqual(["Nombre", "Cambio", "Fechas", "Tope", "Tu brief"])
    for (const p of PASOS) expect(p.rotulo.split(" ").length).toBeLessThanOrEqual(2)
    expect(PASOS.map((p) => !!p.pregunta)).toEqual([true, true, true, true, false])
  })
  it("cada paso está listo solo con su respuesta; el tope exige el mínimo leído y no quedar debajo", () => {
    expect(pasosListos(VACIAS, 60, HOY)).toEqual([false, false, false, false, false])
    expect(pasosListos(LISTAS, 60, HOY)).toEqual([true, true, true, true, true])
    expect(pasosListos(LISTAS, null, HOY)[3]).toBe(false) // sin mínimo, no se crea (Lenovo 19:06Z)
    expect(pasosListos({ ...LISTAS, tope: "59.99" }, 60, HOY)[3]).toBe(false)
    expect(pasosListos({ ...LISTAS, tope: "60" }, 60, HOY)[3]).toBe(true)
    expect(pasosListos({ ...LISTAS, tope: "60,5" }, 60, HOY)[3]).toBe(true)
    expect(pasosListos({ ...LISTAS, nombre: "   " }, 60, HOY)[0]).toBe(false)
    expect(pasosListos({ ...LISTAS, nombre: "x".repeat(121) }, 60, HOY)[0]).toBe(false)
    expect(pasosListos({ ...LISTAS, cambio: "x".repeat(4001) }, 60, HOY)[1]).toBe(false)
    expect(pasosListos({ ...LISTAS, cambio: "x".repeat(4000) }, 60, HOY)[1]).toBe(true)
  })
  it("las fechas: las dos, el inicio desde hoy, el fin después y como máximo 366 días (los CHECK de #1255)", () => {
    const f = (inicio: string, fin: string) => pasosListos({ ...LISTAS, inicio, fin }, 60, HOY)[2]
    expect(f("", "2027-01-31")).toBe(false)
    expect(f("2026-11-19", "2027-01-31")).toBe(false)
    expect(f(HOY, "2027-01-31")).toBe(true)
    expect(f("2026-12-01", "2026-12-01")).toBe(false)
    expect(f("2026-12-01", "2027-12-02")).toBe(true) // 366 días
    expect(f("2026-12-01", "2027-12-03")).toBe(false) // 367
    expect(f("2026-02-30", "2027-01-31")).toBe(false)
    expect(pasosListos({ ...LISTAS, claves: Array.from({ length: 21 }, () => ({ fecha: "2026-12-05", que: "x" })) }, 60, HOY)[2]).toBe(false)
  })
  it("el tope escrito: número positivo con hasta 2 decimales, con coma o punto", () => {
    expect(["150", "150,5", "150.25", " 60 "].map(topeEscrito)).toEqual([150, 150.5, 150.25, 60])
    expect(["", "0", "-5", "abc", "1.234", "1e3", "US$ 5"].map(topeEscrito)).toEqual([null, null, null, null, null, null, null])
  })
  it("el cuerpo que se manda: textos recortados, solo las fechas clave llenas y el tope como número", () => {
    expect(cuerpoDeCrear(NAUFRAGO, LLAVE_X, { ...LISTAS, nombre: "  Lanzamiento  " })).toEqual({
      client_id: NAUFRAGO, llave: LLAVE_X, nombre: "Lanzamiento", cambio: LISTAS.cambio, fecha_inicio: "2026-12-01", fecha_fin: "2027-01-31",
      fechas_clave: [{ fecha: "2026-12-05", que: "Abre el delivery" }], tope_usd: 150, brief_libre: LISTAS.brief,
    })
  })
  it("el mínimo de la plataforma: solo un número positivo con `ok: true`", () => {
    expect(minimoDeLaRespuesta({ ok: true, minimo_usd: 60 })).toBe(60)
    expect(minimoDeLaRespuesta({ ok: true, minimo_usd: "60.5" })).toBe(60.5)
    for (const mal of [null, {}, { ok: false, minimo_usd: 60 }, { ok: true }, { ok: true, minimo_usd: 0 }, { ok: true, minimo_usd: -1 }, { ok: true, minimo_usd: null }, { ok: true, minimo_usd: true }, { ok: true, minimo_usd: "x" }])
      expect(minimoDeLaRespuesta(mal)).toBeNull()
  })
})

describe("el servidor del tablero valida igual que la pantalla", () => {
  const bueno = () => cuerpoDeCrear(NAUFRAGO, LLAVE_X, LISTAS) as Record<string, unknown>
  it("acepta el cuerpo del formulario y devuelve el mismo, limpio", () => {
    expect(validarCrear(bueno(), HOY)).toEqual({ ok: true, cuerpo: bueno() })
  })
  it.each([
    ["sin cliente", { client_id: "x" }, "falta el cliente"],
    ["sin llave", { llave: "otra" }, "falta la llave del pedido"],
    ["sin nombre", { nombre: " " }, "el nombre"],
    ["nombre largo", { nombre: "x".repeat(121) }, "el nombre"],
    ["sin cambio", { cambio: "" }, "el cambio"],
    ["sin brief", { brief_libre: "" }, "el brief"],
    ["sin fechas", { fecha_inicio: null }, "faltan las fechas"],
    ["inicio pasado", { fecha_inicio: "2026-11-19" }, "antes de hoy"],
    ["fin antes", { fecha_fin: "2026-11-30" }, "después del inicio"],
    ["más de 366 días", { fecha_fin: "2027-12-03" }, "366 días"],
    ["fechas clave no lista", { fechas_clave: "x" }, "lista de hasta 20"],
    ["fecha clave a medias", { fechas_clave: [{ fecha: "2026-12-05", que: "" }] }, "cada fecha clave"],
    ["sin tope", { tope_usd: null }, "falta el tope"],
    ["tope cero", { tope_usd: 0 }, "falta el tope"],
    ["tope texto", { tope_usd: "150" }, "falta el tope"],
    ["tope con 3 decimales", { tope_usd: 1.234 }, "falta el tope"],
  ])("rechaza %s", (_n, cambio, dice) => {
    const v = validarCrear({ ...bueno(), ...cambio }, HOY)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.detalle).toContain(dice)
  })
  it("la acción `crear-campana` va a `/api/tablero/crear-campana` con el cuerpo limpio, sin gastar ni confirmar gasto", async () => {
    expect(ACCIONES["crear-campana"].gasta).toBeNull()
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true, campana_id: null }), { status: 200 }))
    const r = await ejecutarAccion("crear-campana", { ...bueno(), extra: "no pasa" }, { revisor: "emilio@x", plataformaUrl: "https://p.x/", llave: "k", fetchImpl: f as unknown as typeof fetch })
    expect(r.status).toBe(200)
    expect(f).toHaveBeenCalledTimes(1)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://p.x/api/tablero/crear-campana")
    expect(init.method).toBe("POST")
    expect(JSON.parse(String(init.body))).toEqual({ ...bueno(), reviewer: "emilio@x", origen: "dashboard" })
  })
  it("un pedido inválido no llega a la plataforma", async () => {
    const f = vi.fn()
    const r = await ejecutarAccion("crear-campana", { ...bueno(), tope_usd: 0 }, { revisor: "e", llave: "k", fetchImpl: f as unknown as typeof fetch })
    expect(r.status).toBe(400)
    expect(f).not.toHaveBeenCalled()
  })
})

describe("el mínimo lo lee la plataforma (`GET /api/tablero/crear-campana/minimo`)", () => {
  const dep = (res: () => Promise<Response>) => ({ plataformaUrl: "https://p.x", llave: "k", fetchImpl: vi.fn(res) as unknown as typeof fetch })
  it("con la llave interna y el cliente; devuelve el número", async () => {
    const d = dep(async () => new Response(JSON.stringify({ ok: true, minimo_usd: 61.4 }), { status: 200 }))
    expect(await leerMinimo(NAUFRAGO, d)).toEqual({ status: 200, cuerpo: { ok: true, minimo_usd: 61.4 } })
    const [url, init] = (d.fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`https://p.x/api/tablero/crear-campana/minimo?client_id=${NAUFRAGO}`)
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("k")
  })
  it("sin ruta (404), sin número, con error o sin llave: no hay mínimo (nunca se inventa)", async () => {
    expect((await leerMinimo(NAUFRAGO, dep(async () => new Response("", { status: 404 })))).status).toBe(501)
    expect((await leerMinimo(NAUFRAGO, dep(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })))).cuerpo.ok).toBe(false)
    expect((await leerMinimo(NAUFRAGO, dep(async () => new Response(JSON.stringify({ ok: true, minimo_usd: 60 }), { status: 500 })))).cuerpo.ok).toBe(false)
    expect((await leerMinimo(NAUFRAGO, dep(async () => { throw new Error("red") }))).status).toBe(502)
    expect((await leerMinimo(NAUFRAGO, { llave: "", fetchImpl: vi.fn() as unknown as typeof fetch })).status).toBe(503)
    expect((await leerMinimo("x", dep(async () => new Response("{}")))).status).toBe(400)
  })
})

/** la red de mentira del formulario: el mínimo y la acción de crear */
function red(o: { minimo?: number | null; crear?: () => Response } = {}) {
  const pedidos: Array<{ url: string; metodo: string; cuerpo?: Record<string, unknown> }> = []
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    pedidos.push({ url, metodo: init?.method ?? "GET", cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (url.startsWith("/api/crear-campana/minimo")) return o.minimo == null ? new Response(JSON.stringify({ ok: false, error: "todavia_no_disponible" }), { status: 501 }) : new Response(JSON.stringify({ ok: true, minimo_usd: o.minimo }), { status: 200 })
    if (url === "/api/acciones/crear-campana") return o.crear ? o.crear() : new Response(JSON.stringify({ ok: true, accion: "crear-campana" }), { status: 200 })
    return new Response(JSON.stringify({ ok: false }), { status: 404 })
  })
  vi.stubGlobal("fetch", f)
  return pedidos
}
const boton = (c: HTMLElement, s: string) => c.querySelector(s) as HTMLButtonElement
const formulario = (p: Partial<Parameters<typeof FormularioCrearCampana>[0]> = {}) =>
  render(<FormularioCrearCampana clienteId={NAUFRAGO} clienteNombre="Náufrago" onCerrar={() => {}} onCreada={() => {}} {...p} />)

describe("la pantalla, como el boceto aprobado", () => {
  it("1 de 5: rótulo «Nombre», la pregunta debajo, la barra con 1 tramo dorado, «Atrás» apagado y «Siguiente» apagado sin respuesta", async () => {
    red({ minimo: 60 })
    const { container } = formulario()
    expect(container.querySelector("h2")?.textContent).toBe("Crear Campaña")
    expect(container.querySelector("[data-posicion]")?.textContent).toBe("1 de 5")
    expect(container.querySelector("[data-rotulo-del-paso]")?.textContent).toBe("Nombre")
    expect(container.querySelector("[data-pregunta]")?.textContent).toBe("¿Cómo se llama la campaña?")
    expect([...container.querySelectorAll("[data-tramo]")].map((x) => x.getAttribute("data-tramo"))).toEqual(["hecho", "falta", "falta", "falta", "falta"])
    expect(boton(container, "[data-atras]").disabled).toBe(true)
    expect(boton(container, "[data-siguiente]").disabled).toBe(true)
    fireEvent.change(container.querySelector("[data-campo=nombre]")!, { target: { value: "Lanzamiento" } })
    expect(boton(container, "[data-siguiente]").disabled).toBe(false)
    fireEvent.click(boton(container, "[data-siguiente]"))
    expect(container.querySelector("[data-posicion]")?.textContent).toBe("2 de 5")
    expect(container.querySelector("[data-rotulo-del-paso]")?.textContent).toBe("Cambio")
    fireEvent.click(boton(container, "[data-atras]"))
    expect((container.querySelector("[data-campo=nombre]") as HTMLInputElement).value).toBe("Lanzamiento") // volver no borra
  })
  it("el tope: sin mínimo leído no se sigue (y se ve «—»); debajo del mínimo, el número en rojo y «Siguiente» apagado", async () => {
    red({ minimo: null })
    const sin = formulario({ inicial: LISTAS, pasoInicial: 3 })
    await waitFor(() => expect(sin.container.querySelector("[data-minimo-valor]")?.textContent).toBe("—"))
    expect(boton(sin.container, "[data-siguiente]").disabled).toBe(true)
    cleanup(); vi.unstubAllGlobals()
    const pedidos = red({ minimo: 60 })
    const { container } = formulario({ inicial: { ...LISTAS, tope: "40" }, pasoInicial: 3 })
    await waitFor(() => expect(container.querySelector("[data-minimo-valor]")?.textContent).toBe("US$ 60"))
    expect(pedidos[0].url).toBe(`/api/crear-campana/minimo?cliente=${NAUFRAGO}`)
    expect(container.querySelector("[data-minimo-valor]")?.className).toContain("text-alarma")
    expect(boton(container, "[data-siguiente]").disabled).toBe(true)
    fireEvent.change(container.querySelector("[aria-label=Tope]")!, { target: { value: "150" } })
    expect(container.querySelector("[data-minimo-valor]")?.className).not.toContain("text-alarma")
    expect(boton(container, "[data-siguiente]").disabled).toBe(false)
  })
  it("las fechas: «+ Agregar» suma una fecha clave; la fila a medias no se manda", () => {
    red({ minimo: 60 })
    const { container } = formulario({ inicial: { ...LISTAS, claves: [] }, pasoInicial: 2, minimoInicial: 60 })
    expect(container.querySelector("[data-fecha=inicio]")?.textContent).toBe("1 dic 2026")
    fireEvent.click(boton(container, "[data-agregar-fecha-clave]"))
    expect(container.querySelectorAll("[data-fecha-clave]")).toHaveLength(1)
    expect(boton(container, "[data-siguiente]").disabled).toBe(false)
  })
  it("el resumen: «Crear Campaña» manda UNA vez a la acción, con la llave del formulario, y avisa que se creó", async () => {
    let soltar: (r: Response) => void = () => {}
    const pedidos = red({ minimo: 60, crear: () => new Response(JSON.stringify({ ok: true }), { status: 200 }) })
    const onCreada = vi.fn()
    // la acción tarda: un segundo toque mientras tanto no manda otra
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (url: string) => { pedidos.push({ url, metodo: "GET" }); return new Response(JSON.stringify({ ok: true, minimo_usd: 60 })) })
      .mockImplementationOnce(async (url: string, init?: RequestInit) => { pedidos.push({ url, metodo: init?.method ?? "GET", cuerpo: JSON.parse(String(init?.body)) }); return new Promise<Response>((r) => { soltar = r }) })
    const { container } = formulario({ inicial: LISTAS, pasoInicial: 5, onCreada })
    await waitFor(() => expect(boton(container, "[data-crear]").disabled).toBe(false))
    expect(container.querySelector("[data-posicion]")?.textContent).toBe("Resumen")
    expect(container.querySelector("[data-resumen]")?.textContent).toContain("Lanzamiento del delivery en Guayaquil")
    fireEvent.click(boton(container, "[data-crear]"))
    fireEvent.click(boton(container, "[data-crear]"))
    soltar(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    await waitFor(() => expect(onCreada).toHaveBeenCalledTimes(1))
    const crear = pedidos.filter((p) => p.metodo === "POST")
    expect(crear).toHaveLength(1)
    expect(crear[0].url).toBe("/api/acciones/crear-campana")
    expect(crear[0].cuerpo?.llave).toMatch(LLAVE)
    expect(crear[0].cuerpo).toEqual(cuerpoDeCrear(NAUFRAGO, String(crear[0].cuerpo?.llave), LISTAS))
  })
  it("si la plataforma dice que el tope quedó debajo del mínimo, vuelve a leerlo y vuelve a la pregunta del tope; nada se da por creado", async () => {
    const pedidos = red({ minimo: 60, crear: () => new Response(JSON.stringify({ ok: false, error: "la_plataforma_rechazo", plataforma_error: "tope_bajo_el_minimo" }), { status: 502 }) })
    const onCreada = vi.fn()
    const { container } = formulario({ inicial: LISTAS, pasoInicial: 5, onCreada })
    await waitFor(() => expect(boton(container, "[data-crear]").disabled).toBe(false))
    fireEvent.click(boton(container, "[data-crear]"))
    await waitFor(() => expect(container.querySelector("[data-posicion]")?.textContent).toBe("4 de 5"))
    expect(container.querySelector("[data-problema]")?.textContent).toBe(motivoDeNoCrear({ plataforma_error: "tope_bajo_el_minimo" }))
    expect(pedidos.filter((p) => p.url.startsWith("/api/crear-campana/minimo"))).toHaveLength(2)
    expect(onCreada).not.toHaveBeenCalled()
  })
  it("si la plataforma todavía no tiene la ruta, lo dice y no da nada por creado", async () => {
    red({ minimo: 60, crear: () => new Response(JSON.stringify({ ok: false, error: "todavia_no_disponible" }), { status: 501 }) })
    const onCreada = vi.fn()
    const { container } = formulario({ inicial: LISTAS, pasoInicial: 5, onCreada })
    await waitFor(() => expect(boton(container, "[data-crear]").disabled).toBe(false))
    fireEvent.click(boton(container, "[data-crear]"))
    await waitFor(() => expect(container.querySelector("[data-problema]")?.textContent).toContain("No se creó nada"))
    expect(onCreada).not.toHaveBeenCalled()
  })
  it("Esc cierra el formulario", () => {
    red({ minimo: 60 })
    const onCerrar = vi.fn()
    formulario({ onCerrar })
    fireEvent.keyDown(window, { key: "Escape" })
    expect(onCerrar).toHaveBeenCalledTimes(1)
  })
})

describe("«Crear Campaña» en el Centro", () => {
  it("con `onCrear` se puede tocar (sin `aria-disabled`) y lo llama; sin él sigue deshabilitado", () => {
    const onCrear = vi.fn()
    const con = render(<LugaresDeCampana clienteId={NAUFRAGO} campanas={[C_VIVA]} onCrear={onCrear} />)
    const crear = [...con.container.querySelectorAll("[data-crear-campana]")] as HTMLButtonElement[]
    expect(crear).toHaveLength(2)
    for (const b of crear) { expect(b.getAttribute("aria-disabled")).toBeNull(); expect(b.getAttribute("aria-haspopup")).toBe("dialog"); expect(b.className).toContain("hover:border-linea-oro") }
    fireEvent.click(crear[1])
    expect(onCrear).toHaveBeenCalledTimes(1)
    cleanup()
    const sin = render(<LugaresDeCampana clienteId={NAUFRAGO} campanas={[C_VIVA]} />)
    for (const b of sin.container.querySelectorAll("[data-crear-campana]")) { expect(b.getAttribute("aria-disabled")).toBe("true"); expect(b.className).not.toContain("hover:border-linea-oro") }
  })
  it("en el Centro abre el formulario del cliente; al cerrarlo vuelven los 9 cuadros", async () => {
    red({ minimo: 60 })
    const piz = {
      clientes: [{ id: NAUFRAGO, nombre: "Náufrago", con_campana: true }], cliente: { id: NAUFRAGO, nombre: "Náufrago" },
      campana: { id: VIVA, estado: "necesita_humano", desde: "2026-11-09", hasta: "2027-02-06", version_calendario: null, version_estrategia: 1 },
      fases: [], fase_activa: faseActiva([], null, HOY), gran_idea: { texto: null, nota: "" }, esperas: [], filas: [], semanas: [], totales: {}, manual_aprobado: true, hoy: HOY, leido_en: "x",
    } as unknown as Pizarron
    const { container } = render(<PanelAplicaciones onCerrar={() => {}} datosIniciales={piz} flujoInicial={{ campana_id: VIVA, flujo: ROJO, campanas: [C_VIVA] }} />)
    fireEvent.click(container.querySelector("[data-crear-campana]")!)
    await waitFor(() => expect(container.querySelector("[data-seccion=crear-campana]")).not.toBeNull())
    expect(container.querySelector("[data-cliente-nombre]")?.textContent).toBe("Náufrago")
    fireEvent.click(container.querySelector("[data-cerrar]")!)
    expect(container.querySelectorAll("[data-aplicacion]")).toHaveLength(9)
  })
})
