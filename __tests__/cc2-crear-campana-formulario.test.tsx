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
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { AL_CERRAR, FormularioCrearCampana, SIN_NACER, SIN_PLAN, motivoDeNoCrear } from "@/components/nuevo/FormularioCrearCampana"
import { LugaresDeCampana } from "@/components/nuevo/LugaresDeCampana"
import { ESPERA_ENTRE_VUELTAS_MS, PanelAplicaciones, VUELTAS_HASTA_QUE_NACE } from "@/components/nuevo/PanelAplicaciones"
import { flujoDeCampana, type CampanaDelFlujo } from "@/lib/flujo-de-campana"
import { ACCIONES, ejecutarAccion } from "@/lib/tablero-acciones"
import { LLAVE, PASOS, fechasDelMinimo, hayAlgoEscrito, hoyEnEcuador, minimoDelRechazo, nuevaLlave, VACIAS, cuerpoDeCrear, leerMinimo, minimoDeLaRespuesta, pasosListos, topeEscrito, validarCrear, type RespuestasDeCrear } from "@/lib/crear-campana"
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
const LLAVE_X = "11111111-2222-4333-8444-555555555555"

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
  it("«hoy» es el de Ecuador, no el de UTC: a las 22:00 de Ecuador (03:00 UTC del día siguiente) todavía es hoy", () => {
    expect(hoyEnEcuador(new Date("2026-11-21T03:00:00Z"))).toBe("2026-11-20")
    expect(hoyEnEcuador(new Date("2026-11-21T05:00:00Z"))).toBe("2026-11-21")
    const hoy = hoyEnEcuador(new Date("2026-11-21T03:00:00Z"))
    expect(validarCrear({ ...cuerpoDeCrear(NAUFRAGO, LLAVE_X, { ...LISTAS, inicio: "2026-11-20" }) }, hoy).ok).toBe(true)
    expect(pasosListos({ ...LISTAS, inicio: "2026-11-20" }, 60, hoy)[2]).toBe(true)
  })
  it("una fecha imposible (31 de febrero, 31 de abril) no vale, ni en la pantalla ni en el servidor", () => {
    for (const mala of ["2027-02-31", "2027-04-31", "2026-13-01", "2026-12-00"]) {
      expect(pasosListos({ ...LISTAS, fin: mala }, 60, HOY)[2], mala).toBe(false)
      expect(pasosListos({ ...LISTAS, claves: [{ fecha: mala, que: "x" }] }, 60, HOY)[2], mala).toBe(false)
      expect(validarCrear({ ...cuerpoDeCrear(NAUFRAGO, LLAVE_X, LISTAS), fecha_fin: mala }, HOY).ok, mala).toBe(false)
      expect(validarCrear({ ...cuerpoDeCrear(NAUFRAGO, LLAVE_X, LISTAS), fechas_clave: [{ fecha: mala, que: "x" }] }, HOY).ok, mala).toBe(false)
    }
    expect(validarCrear({ ...cuerpoDeCrear(NAUFRAGO, LLAVE_X, LISTAS), fecha_fin: "2027-02-28" }, HOY).ok).toBe(true)
  })
  it("en la pantalla, una fecha clave con un «qué» de 121 no deja seguir (120 sí); 21 fechas clave tampoco (20 sí)", () => {
    const con = (claves: Array<{ fecha: string; que: string }>) => pasosListos({ ...LISTAS, claves }, 60, HOY)[2]
    expect(con([{ fecha: "2026-12-05", que: "x".repeat(120) }])).toBe(true)
    expect(con([{ fecha: "2026-12-05", que: "x".repeat(121) }])).toBe(false)
    expect(con(Array.from({ length: 20 }, () => ({ fecha: "2026-12-05", que: "x" })))).toBe(true)
    expect(con(Array.from({ length: 21 }, () => ({ fecha: "2026-12-05", que: "x" })))).toBe(false)
  })
  it("el tope escrito: número positivo con hasta 2 decimales, con coma o punto", () => {
    expect(["150", "150,5", "150.25", " 60 "].map(topeEscrito)).toEqual([150, 150.5, 150.25, 60])
    expect(["", "0", "-5", "abc", "1.234", "1e3", "US$ 5"].map(topeEscrito)).toEqual([null, null, null, null, null, null, null])
  })
  it("el cuerpo que se manda: textos recortados, solo las fechas clave llenas y el tope como número", () => {
    expect(cuerpoDeCrear(NAUFRAGO, LLAVE_X, { ...LISTAS, nombre: "  Lanzamiento  " })).toEqual({
      client_id: NAUFRAGO, llave_formulario: LLAVE_X, nombre: "Lanzamiento", cambio: LISTAS.cambio, fecha_inicio: "2026-12-01", fecha_fin: "2027-01-31",
      fechas_clave: [{ fecha: "2026-12-05", que: "Abre el delivery" }], tope_usd: 150, brief_libre: LISTAS.brief,
    })
  })
  it("la llave del formulario: uuid v4 con randomUUID, con getRandomValues si no hay randomUUID, y ninguna sin los dos", () => {
    expect(nuevaLlave({ randomUUID: () => LLAVE_X, getRandomValues: ((a: Uint8Array) => a) as never })).toBe(LLAVE_X)
    const sinUuid = nuevaLlave({ getRandomValues: <T extends ArrayBufferView | null>(a: T) => { (a as unknown as Uint8Array).fill(0xff); return a } })
    expect(sinUuid).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff")
    expect(sinUuid).toMatch(LLAVE)
    expect(nuevaLlave({} as never)).toBeNull()
    const dos = [nuevaLlave(), nuevaLlave()]
    for (const l of dos) expect(l).toMatch(LLAVE)
    expect(dos[0]).not.toBe(dos[1])
  })
  it("el cuerpo lleva las respuestas ENTERAS: un brief de 100 000 caracteres llega completo (y el nombre y el cambio también)", () => {
    const largo = { ...LISTAS, nombre: "n".repeat(120), cambio: "c".repeat(4000), brief: "b".repeat(100_000) }
    const c = cuerpoDeCrear(NAUFRAGO, LLAVE_X, largo)
    expect(c.brief_libre).toHaveLength(100_000)
    expect(c.nombre).toHaveLength(120)
    expect(c.cambio).toHaveLength(4000)
    expect(validarCrear(c as Record<string, unknown>, HOY)).toEqual({ ok: true, cuerpo: c })
  })
  it("leerMinimo manda las fechas a la plataforma solo si vienen las dos", async () => {
    const urls: string[] = []
    const d = { plataformaUrl: "https://p.test", llave: "k", fetchImpl: (async (u: string) => { urls.push(u); return new Response(JSON.stringify({ ok: true, minimo_usd: 52 }), { status: 200 }) }) as unknown as typeof fetch }
    await leerMinimo(NAUFRAGO, d, { inicio: "2026-12-01", fin: "2026-12-15" })
    await leerMinimo(NAUFRAGO, d)
    expect(urls).toEqual([`https://p.test/api/tablero-minimo-de-campana?client_id=${NAUFRAGO}&fecha_inicio=2026-12-01&fecha_fin=2026-12-15`, `https://p.test/api/tablero-minimo-de-campana?client_id=${NAUFRAGO}`])
  })
  it("las fechas del mínimo: las dos bien escritas y el fin después del inicio; si no, ninguna", () => {
    expect(fechasDelMinimo("2026-12-01", "2026-12-15")).toEqual({ inicio: "2026-12-01", fin: "2026-12-15" })
    for (const [i, f] of [["2026-12-01", ""], ["", "2026-12-15"], ["2026-12-15", "2026-12-15"], ["2026-12-15", "2026-12-01"], ["2027-02-31", "2027-03-05"], [null, "2026-12-15"]]) expect(fechasDelMinimo(i, f), `${i}→${f}`).toBeNull()
  })
  it("el mínimo del 409: el de `plataforma.minimo_usd`, solo si es un número positivo", () => {
    expect(minimoDelRechazo({ error: "conflicto", plataforma: { error: "tope_bajo_minimo", minimo_usd: 61 } })).toBe(61)
    expect(minimoDelRechazo({ error: "conflicto", plataforma: { error: "tope_bajo_minimo" } })).toBeNull()
    expect(minimoDelRechazo({ error: "conflicto", plataforma: { error: "tope_bajo_minimo", minimo_usd: 0 } })).toBeNull()
    expect(minimoDelRechazo({ error: "conflicto", minimo_usd: 61 })).toBeNull()
    expect(minimoDelRechazo(null)).toBeNull()
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
    ["sin llave", { llave_formulario: "crear-x" }, "falta la llave del pedido"],
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
  it.each([
    ["el nombre", "nombre", "n".repeat(120), "n".repeat(121)],
    ["el cambio", "cambio", "c".repeat(4000), "c".repeat(4001)],
    ["el brief", "brief_libre", "b".repeat(100_000), "b".repeat(100_001)],
    ["las fechas clave", "fechas_clave", Array.from({ length: 20 }, () => ({ fecha: "2026-12-05", que: "x" })), Array.from({ length: 21 }, () => ({ fecha: "2026-12-05", que: "x" }))],
    ["el «qué» de una fecha clave", "fechas_clave", [{ fecha: "2026-12-05", que: "q".repeat(120) }], [{ fecha: "2026-12-05", que: "q".repeat(121) }]],
    ["el tope", "tope_usd", 99_999_999.99, 100_000_000],
  ])("el servidor: %s acepta su borde y rechaza uno más (los CHECK de #1255)", (_n, campo, bien, mal) => {
    expect(validarCrear({ ...bueno(), [campo]: bien }, HOY).ok).toBe(true)
    expect(validarCrear({ ...bueno(), [campo]: mal }, HOY).ok).toBe(false)
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

describe("el mínimo lo lee la plataforma (`GET /api/tablero-minimo-de-campana`)", () => {
  const dep = (res: () => Promise<Response>) => ({ plataformaUrl: "https://p.x", llave: "k", fetchImpl: vi.fn(res) as unknown as typeof fetch })
  it("con la llave interna y el cliente; devuelve el número", async () => {
    const d = dep(async () => new Response(JSON.stringify({ ok: true, minimo_usd: 61.4 }), { status: 200 }))
    expect(await leerMinimo(NAUFRAGO, d)).toEqual({ status: 200, cuerpo: { ok: true, minimo_usd: 61.4 } })
    const [url, init] = (d.fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`https://p.x/api/tablero-minimo-de-campana?client_id=${NAUFRAGO}`)
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("k")
  })
  it("sin ruta (404), sin número, con error o sin llave: no hay mínimo (nunca se inventa)", async () => {
    expect((await leerMinimo(NAUFRAGO, dep(async () => new Response("", { status: 404 })))).status).toBe(501)
    expect((await leerMinimo(NAUFRAGO, dep(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })))).cuerpo.ok).toBe(false)
    expect((await leerMinimo(NAUFRAGO, dep(async () => new Response(JSON.stringify({ ok: true, minimo_usd: 60 }), { status: 500 })))).cuerpo.ok).toBe(false)
    expect((await leerMinimo(NAUFRAGO, dep(async () => { throw new Error("red") }))).status).toBe(502)
    expect((await leerMinimo(NAUFRAGO, { llave: "", fetchImpl: vi.fn() as unknown as typeof fetch })).status).toBe(503)
    expect((await leerMinimo("x", dep(async () => new Response("{}")))).status).toBe(400)
    expect(await leerMinimo(NAUFRAGO, dep(async () => new Response(JSON.stringify({ ok: false, error: "sin_plan_aprobado" }), { status: 409 })))).toEqual({ status: 409, cuerpo: { ok: false, error: "sin_plan_aprobado" } })
  })
})

/** el pizarrón de Náufrago con su campaña viva real (sin filas: el formulario no las usa) */
const pizDeNaufrago = (): Pizarron => ({
    clientes: [{ id: NAUFRAGO, nombre: "Náufrago", con_campana: true }], cliente: { id: NAUFRAGO, nombre: "Náufrago" },
    campana: { id: VIVA, estado: "necesita_humano", desde: "2026-11-09", hasta: "2027-02-06", version_calendario: null, version_estrategia: 1 },
    fases: [], fase_activa: faseActiva([], null, HOY), gran_idea: { texto: null, nota: "" }, esperas: [], filas: [], semanas: [], totales: {}, manual_aprobado: true, hoy: HOY, leido_en: "x",
}) as unknown as Pizarron

/** la red de mentira del formulario: el mínimo, la acción de crear y las lecturas del Centro */
function red(o: { minimo?: number | null | ((url: string) => number | null); crear?: () => Response; campanas?: (lectura: number) => CampanaDelFlujo[] | "falla" } = {}) {
  let lecturas = 0
  const pedidos: Array<{ url: string; metodo: string; cuerpo?: Record<string, unknown> }> = []
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    pedidos.push({ url, metodo: init?.method ?? "GET", cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined })
    const m = typeof o.minimo === "function" ? o.minimo(url) : o.minimo
    if (url.startsWith("/api/crear-campana/minimo")) return m == null ? new Response(JSON.stringify({ ok: false, error: "todavia_no_disponible" }), { status: 501 }) : new Response(JSON.stringify({ ok: true, minimo_usd: m }), { status: 200 })
    if (url === "/api/acciones/crear-campana") return o.crear ? o.crear() : new Response(JSON.stringify({ ok: true, accion: "crear-campana" }), { status: 200 })
    if (url.startsWith("/api/flujo")) { const cs = o.campanas ? o.campanas(lecturas++) : [C_VIVA]; if (cs === "falla") return new Response(JSON.stringify({ ok: false }), { status: 500 }); return new Response(JSON.stringify({ ok: true, campana_id: cs[0]?.campana_id ?? null, flujo: cs[0]?.flujo ?? null, campanas: cs }), { status: 200 }) }
    if (url.startsWith("/api/pizarron")) { const piz = pizDeNaufrago(); const pedida = new URL(url, "http://x").searchParams.get("campana"); return new Response(JSON.stringify({ ok: true, ...piz, ...(pedida ? { campana: { ...piz.campana, id: pedida } } : {}) }), { status: 200 }) } // la campaña pedida con &campana= es la que se lee
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
    expect(pedidos[0].url).toBe(`/api/crear-campana/minimo?cliente=${NAUFRAGO}&inicio=2026-12-01&fin=2027-01-31`)
    expect(container.querySelector("[data-minimo-valor]")?.className).toContain("text-alarma")
    expect(boton(container, "[data-siguiente]").disabled).toBe(true)
    fireEvent.change(container.querySelector("[aria-label=Tope]")!, { target: { value: "150" } })
    expect(container.querySelector("[data-minimo-valor]")?.className).not.toContain("text-alarma")
    expect(boton(container, "[data-siguiente]").disabled).toBe(false)
  })
  it("en la pantalla de fechas, un «qué» de 121 caracteres apaga «Siguiente» (120 lo deja)", () => {
    red({ minimo: 60 })
    const { container } = formulario({ inicial: { ...LISTAS, claves: [{ fecha: "2026-12-05", que: "x" }] }, pasoInicial: 2, minimoInicial: 60 })
    const que = container.querySelector("[aria-label='Qué pasa en la fecha clave 1']")!
    fireEvent.change(que, { target: { value: "x".repeat(120) } })
    expect(boton(container, "[data-siguiente]").disabled).toBe(false)
    fireEvent.change(que, { target: { value: "x".repeat(121) } })
    expect(boton(container, "[data-siguiente]").disabled).toBe(true)
  })
  it("las fechas: «+ Agregar» suma una fecha clave; la fila a medias no se manda", () => {
    red({ minimo: 60 })
    const { container } = formulario({ inicial: { ...LISTAS, claves: [] }, pasoInicial: 2, minimoInicial: 60 })
    expect((container.querySelector("[aria-label=Inicio]") as HTMLInputElement).value).toBe("01/12/2026")
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
    expect(crear[0].cuerpo?.llave_formulario).toMatch(LLAVE)
    expect(crear[0].cuerpo).toEqual(cuerpoDeCrear(NAUFRAGO, String(crear[0].cuerpo?.llave_formulario), LISTAS))
  })
  it("si la plataforma dice que el tope quedó debajo del mínimo, muestra el mínimo del rechazo y vuelve a la pregunta del tope; nada se da por creado", async () => {
    const pedidos = red({ minimo: 60, crear: () => new Response(JSON.stringify({ ok: false, error: "conflicto", detalle: "tope_bajo_minimo", plataforma: { ok: false, error: "tope_bajo_minimo", minimo_usd: 61 } }), { status: 409 }) })
    const onCreada = vi.fn()
    const { container } = formulario({ inicial: LISTAS, pasoInicial: 5, onCreada })
    await waitFor(() => expect(boton(container, "[data-crear]").disabled).toBe(false))
    fireEvent.click(boton(container, "[data-crear]"))
    await waitFor(() => expect(container.querySelector("[data-posicion]")?.textContent).toBe("4 de 5"))
    expect(container.querySelector("[data-problema]")?.textContent).toBe("El tope quedó debajo del mínimo. Revísalo.")
    // el mínimo que se ve es el del 409 (61, el de las fechas de la campaña), no el que se leyó antes (60)
    expect(container.querySelector("[data-minimo-valor]")?.textContent).toBe("US$ 61")
    expect(pedidos.filter((p) => p.url.startsWith("/api/crear-campana/minimo"))).toHaveLength(1)
    expect(onCreada).not.toHaveBeenCalled()
  })
  it("un 409 por el tope SIN mínimo en la respuesta vuelve a leerlo, con las fechas de la campaña", async () => {
    const pedidos = red({ minimo: 70, crear: () => new Response(JSON.stringify({ ok: false, error: "conflicto", plataforma: { ok: false, error: "tope_bajo_minimo" } }), { status: 409 }) })
    const { container } = formulario({ inicial: LISTAS, pasoInicial: 5, minimoInicial: 60 })
    fireEvent.click(boton(container, "[data-crear]"))
    await waitFor(() => expect(container.querySelector("[data-minimo-valor]")?.textContent).toBe("US$ 70"))
    expect(container.querySelector("[data-posicion]")?.textContent).toBe("4 de 5")
    expect(pedidos.filter((p) => p.url.startsWith("/api/crear-campana/minimo")).map((p) => p.url)).toEqual([`/api/crear-campana/minimo?cliente=${NAUFRAGO}&inicio=2026-12-01&fin=2027-01-31`])
  })
  it("el mínimo se pide con las fechas y SE VUELVE A PEDIR al cambiarlas; la pantalla muestra el de las fechas nuevas", async () => {
    const pedidos = red({ minimo: (u) => (u.includes("fin=2027-01-31") ? 79 : u.includes("fin=2026-12-15") ? 52 : null) })
    const { container } = formulario({ inicial: LISTAS, pasoInicial: 2 })
    await waitFor(() => expect(pedidos.map((p) => p.url)).toEqual([`/api/crear-campana/minimo?cliente=${NAUFRAGO}&inicio=2026-12-01&fin=2027-01-31`]))
    fireEvent.change(container.querySelector("[aria-label=Fin]")!, { target: { value: "2026-12-15" } })
    await waitFor(() => expect(pedidos.at(-1)?.url).toBe(`/api/crear-campana/minimo?cliente=${NAUFRAGO}&inicio=2026-12-01&fin=2026-12-15`))
    fireEvent.click(boton(container, "[data-siguiente]"))
    await waitFor(() => expect(container.querySelector("[data-minimo-valor]")?.textContent).toBe("US$ 52"))
  })
  it("sin fechas completas el mínimo se pide sin fechas (la ventana del plan), nunca con una sola", async () => {
    const pedidos = red({ minimo: 79 })
    formulario({ inicial: { ...LISTAS, fin: "" }, pasoInicial: 2 })
    await waitFor(() => expect(pedidos).toHaveLength(1))
    expect(pedidos[0].url).toBe(`/api/crear-campana/minimo?cliente=${NAUFRAGO}`)
  })
  it("mientras llega el mínimo de las fechas nuevas se ve «—» y «Siguiente» queda apagado (no vale el de las fechas viejas)", async () => {
    const urls: string[] = []
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      urls.push(url)
      if (url.includes("fin=2027-01-31")) return Promise.resolve(new Response(JSON.stringify({ ok: true, minimo_usd: 79 }), { status: 200 }))
      return new Promise<Response>(() => {}) // la lectura de las fechas nuevas todavía no contesta
    }))
    const { container } = formulario({ inicial: LISTAS, pasoInicial: 3 })
    await waitFor(() => expect(container.querySelector("[data-minimo-valor]")?.textContent).toBe("US$ 79"))
    expect(boton(container, "[data-siguiente]").disabled).toBe(false)
    fireEvent.click(boton(container, "[data-atras]"))
    fireEvent.change(container.querySelector("[aria-label=Fin]")!, { target: { value: "2026-12-15" } })
    await waitFor(() => expect(urls).toHaveLength(2))
    fireEvent.click(boton(container, "[data-siguiente]"))
    expect(container.querySelector("[data-posicion]")?.textContent).toBe("4 de 5")
    expect(container.querySelector("[data-minimo-valor]")?.textContent).toBe("—")
    expect(boton(container, "[data-siguiente]").disabled).toBe(true)
  })
  it("una lectura vieja que llega tarde no pisa a la de las fechas nuevas", async () => {
    let soltarVieja: (r: Response) => void = () => {}
    const urls: string[] = []
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      urls.push(url)
      if (url.includes("fin=2027-01-31")) return new Promise<Response>((ok) => { soltarVieja = ok })
      return Promise.resolve(new Response(JSON.stringify({ ok: true, minimo_usd: 52 }), { status: 200 }))
    }))
    const { container } = formulario({ inicial: LISTAS, pasoInicial: 2 })
    await waitFor(() => expect(urls).toHaveLength(1))
    fireEvent.change(container.querySelector("[aria-label=Fin]")!, { target: { value: "2026-12-15" } })
    await waitFor(() => expect(urls).toHaveLength(2))
    fireEvent.click(boton(container, "[data-siguiente]"))
    await waitFor(() => expect(container.querySelector("[data-minimo-valor]")?.textContent).toBe("US$ 52"))
    await act(async () => { soltarVieja(new Response(JSON.stringify({ ok: true, minimo_usd: 79 }), { status: 200 })) })
    expect(container.querySelector("[data-minimo-valor]")?.textContent).toBe("US$ 52")
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
  it("sin Plan de Marketing aprobado (409 del mínimo): lo dice en el tope y no deja seguir", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "sin_plan_aprobado" }), { status: 409 })))
    const { container } = formulario({ inicial: LISTAS, pasoInicial: 3 })
    await waitFor(() => expect(container.querySelector("[data-problema]")?.textContent).toBe(SIN_PLAN))
    expect(boton(container, "[data-siguiente]").disabled).toBe(true)
  })
  it("los códigos del contrato de CC1: cada rechazo dice qué pasó, y nunca «se creó»", () => {
    expect(motivoDeNoCrear({ ok: false, error: "conflicto", plataforma: { error: "sin_plan_aprobado" } })).toBe(SIN_PLAN)
    expect(motivoDeNoCrear({ ok: false, error: "la_plataforma_rechazo", plataforma_error: "entrada_invalida", detalle: "el nombre está en blanco" })).toBe("No se creó: el nombre está en blanco.")
    expect(motivoDeNoCrear({ ok: false, error: "conflicto", plataforma: { error: "otra" } })).toContain("No se creó nada")
    expect(motivoDeNoCrear(null)).toContain("No se creó nada")
    expect(motivoDeNoCrear({ ok: false, error: "conflicto", plataforma: { error: "cadena_no_admite" } })).toBe("Este cliente todavía no puede tener campañas nuevas. No se creó nada.")
    expect(motivoDeNoCrear({ ok: false, error: "la_plataforma_rechazo", plataforma_error: "minimo_ilegible" })).toBe("No se pudo calcular el mínimo. No se creó nada: inténtalo otra vez.")
  })
  it("un reintento después de un rechazo manda la MISMA llave (así la plataforma contesta «ya pedida» y no abre dos)", async () => {
    let n = 0
    const pedidos = red({ minimo: 60, crear: () => (++n === 1 ? new Response(JSON.stringify({ ok: false, error: "plataforma_sin_respuesta" }), { status: 502 }) : new Response(JSON.stringify({ ok: true, resultado: { estado: "ya_pedida" } }), { status: 200 })) })
    const onCreada = vi.fn()
    const { container } = formulario({ inicial: LISTAS, pasoInicial: 5, onCreada })
    await waitFor(() => expect(boton(container, "[data-crear]").disabled).toBe(false))
    fireEvent.click(boton(container, "[data-crear]"))
    await waitFor(() => expect(container.querySelector("[data-problema]")).not.toBeNull())
    expect(onCreada).not.toHaveBeenCalled()
    fireEvent.click(boton(container, "[data-crear]"))
    await waitFor(() => expect(onCreada).toHaveBeenCalledTimes(1))
    const llaves = pedidos.filter((p) => p.metodo === "POST").map((p) => p.cuerpo?.llave_formulario)
    expect(llaves).toHaveLength(2)
    expect(llaves[0]).toBe(llaves[1])
  })
  it("dos toques antes de que la pantalla se repinte mandan UN solo pedido", async () => {
    const pedidos = red({ minimo: 60 })
    const { container } = formulario({ inicial: LISTAS, pasoInicial: 5 })
    await waitFor(() => expect(boton(container, "[data-crear]").disabled).toBe(false))
    const b = boton(container, "[data-crear]")
    act(() => { b.dispatchEvent(new MouseEvent("click", { bubbles: true })); b.dispatchEvent(new MouseEvent("click", { bubbles: true })) })
    await waitFor(() => expect(pedidos.filter((p) => p.metodo === "POST")).toHaveLength(1))
    await new Promise((r) => setTimeout(r, 20))
    expect(pedidos.filter((p) => p.metodo === "POST")).toHaveLength(1)
  })
  it("en el resumen, con una respuesta que no sirve (tope debajo del mínimo), «Crear Campaña» queda apagado", async () => {
    red({ minimo: 60 })
    const { container } = formulario({ inicial: { ...LISTAS, tope: "40" }, pasoInicial: 5 })
    await waitFor(() => expect(container.querySelector("[data-resumen]")?.textContent).toContain("US$ 60"))
    expect(boton(container, "[data-crear]").disabled).toBe(true)
  })
  it("una respuesta 200 sin `ok: true` no se da por creada", async () => {
    red({ minimo: 60, crear: () => new Response(JSON.stringify({ ok: false }), { status: 200 }) })
    const onCreada = vi.fn()
    const { container } = formulario({ inicial: LISTAS, pasoInicial: 5, onCreada })
    await waitFor(() => expect(boton(container, "[data-crear]").disabled).toBe(false))
    fireEvent.click(boton(container, "[data-crear]"))
    await waitFor(() => expect(container.querySelector("[data-problema]")).not.toBeNull())
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

// 21-nov (#54 del barrido · Lenovo 05:01Z) · cerrar con algo escrito pregunta antes de perderlo (el mismo aviso de «¿Retirar esta idea?»)
describe("cerrar el formulario con algo escrito pregunta antes", () => {
  const aviso = (c: HTMLElement) => c.querySelector("[data-aviso-cerrar]")
  it("qué cuenta como escrito: cualquier campo o una fecha clave con algo; una fila vacía de «+ Agregar» no", () => {
    expect(hayAlgoEscrito(VACIAS)).toBe(false)
    expect(hayAlgoEscrito({ ...VACIAS, claves: [{ fecha: "", que: "" }] })).toBe(false)
    expect(hayAlgoEscrito({ ...VACIAS, nombre: "   " })).toBe(false)
    for (const k of ["nombre", "cambio", "inicio", "fin", "tope", "brief"] as const) expect(hayAlgoEscrito({ ...VACIAS, [k]: "x" })).toBe(true)
    expect(hayAlgoEscrito({ ...VACIAS, claves: [{ fecha: "", que: "" }, { fecha: "2026-12-05", que: "" }] })).toBe(true)
    expect(hayAlgoEscrito({ ...VACIAS, claves: [{ fecha: "", que: "Abre" }] })).toBe(true)
  })
  it("Esc con algo escrito: sale la pregunta y no cierra; «Seguir escribiendo» la quita y lo escrito sigue", () => {
    red({ minimo: 60 })
    const onCerrar = vi.fn()
    const { container } = formulario({ onCerrar, inicial: LISTAS, pasoInicial: 4, minimoInicial: 60 })
    fireEvent.keyDown(window, { key: "Escape" })
    expect(onCerrar).not.toHaveBeenCalled()
    expect(aviso(container)?.textContent).toContain(AL_CERRAR)
    expect(AL_CERRAR).toBe("¿Cerrar sin crear? Se pierde lo que escribiste.")
    expect(aviso(container)?.getAttribute("role")).toBe("alertdialog")
    expect(document.activeElement).toBe(boton(container, "[data-accion=seguir-escribiendo]"))
    fireEvent.click(boton(container, "[data-accion=seguir-escribiendo]"))
    expect(aviso(container)).toBeNull()
    expect((container.querySelector("[data-campo=brief]") as HTMLTextAreaElement).value).toBe(LISTAS.brief)
    expect(onCerrar).not.toHaveBeenCalled()
  })
  it("con la pregunta a la vista, Esc es «Seguir escribiendo» (no cierra); «Sí, cerrar» cierra una vez", () => {
    red({ minimo: 60 })
    const onCerrar = vi.fn()
    const { container } = formulario({ onCerrar, inicial: LISTAS, pasoInicial: 0, minimoInicial: 60 })
    fireEvent.keyDown(window, { key: "Escape" })
    expect(aviso(container)).not.toBeNull()
    fireEvent.keyDown(window, { key: "Escape" })
    expect(aviso(container)).toBeNull()
    expect(onCerrar).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: "Escape" })
    fireEvent.click(boton(container, "[data-accion=confirmar-cerrar]"))
    expect(onCerrar).toHaveBeenCalledTimes(1)
  })
  it("la ✕ «Cerrar» y el clic fuera del panel también preguntan", () => {
    red({ minimo: 60 })
    const onCerrar = vi.fn()
    const { container } = formulario({ onCerrar, inicial: LISTAS, pasoInicial: 1, minimoInicial: 60 })
    fireEvent.click(boton(container, "[data-cerrar]"))
    expect(aviso(container)).not.toBeNull()
    fireEvent.click(boton(container, "[data-accion=seguir-escribiendo]"))
    fireEvent.mouseDown(document.querySelector(".nv-panel")!)
    expect(aviso(container)).not.toBeNull()
    expect(onCerrar).not.toHaveBeenCalled()
  })
  it("sin nada escrito (o solo una fila vacía de fecha clave) cierra sin preguntar", () => {
    red({ minimo: 60 })
    const onCerrar = vi.fn()
    const { container } = formulario({ onCerrar, inicial: { ...VACIAS, claves: [{ fecha: "", que: "" }] }, pasoInicial: 2, minimoInicial: 60 })
    fireEvent.click(boton(container, "[data-cerrar]"))
    expect(aviso(container)).toBeNull()
    expect(onCerrar).toHaveBeenCalledTimes(1)
  })
  it("escribir algo con la pregunta a la vista la quita; mientras se pregunta, el motivo anterior no se ve", async () => {
    red({ minimo: 60, crear: () => new Response(JSON.stringify({ ok: false, error: "x" }), { status: 500 }) })
    const { container } = formulario({ inicial: LISTAS, pasoInicial: 5, minimoInicial: 60 })
    fireEvent.click(boton(container, "[data-crear]"))
    await waitFor(() => expect(container.querySelector("[data-problema]")).not.toBeNull())
    fireEvent.keyDown(window, { key: "Escape" })
    expect(aviso(container)).not.toBeNull()
    expect(container.querySelector("[data-problema]")).toBeNull()
    fireEvent.click(boton(container, "[data-atras]"))
    fireEvent.change(container.querySelector("[data-campo=brief]")!, { target: { value: LISTAS.brief + " Más." } })
    expect(aviso(container)).toBeNull()
  })
  it("ya pedida la campaña («Campaña en proceso»), cerrar no pregunta: no se pierde nada", async () => {
    red({ minimo: 60 })
    const onCerrar = vi.fn()
    const { container } = formulario({ onCerrar, inicial: LISTAS, pasoInicial: 5, minimoInicial: 60 })
    fireEvent.click(boton(container, "[data-crear]"))
    await waitFor(() => expect(container.querySelector("[data-crear]")?.textContent).toBe("Campaña en proceso"))
    fireEvent.keyDown(window, { key: "Escape" })
    expect(aviso(container)).toBeNull()
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
    const piz = pizDeNaufrago()
    const { container } = render(<PanelAplicaciones onCerrar={() => {}} datosIniciales={piz} flujoInicial={{ campana_id: VIVA, flujo: ROJO, campanas: [C_VIVA] }} />)
    fireEvent.click(container.querySelector("[data-crear-campana]")!)
    await waitFor(() => expect(container.querySelector("[data-seccion=crear-campana]")).not.toBeNull())
    expect(container.querySelector("[data-cliente-nombre]")?.textContent).toBe("Náufrago")
    fireEvent.click(container.querySelector("[data-cerrar]")!)
    expect(container.querySelectorAll("[data-aplicacion]")).toHaveLength(9)
  })
  it("en el Centro, Esc con el formulario abierto cierra SOLO el formulario (no el Centro)", async () => {
    red({ minimo: 60 })
    const onCerrar = vi.fn()
    const { container } = render(<PanelAplicaciones onCerrar={onCerrar} datosIniciales={pizDeNaufrago()} flujoInicial={{ campana_id: VIVA, flujo: ROJO, campanas: [C_VIVA] }} />)
    fireEvent.click(container.querySelector("[data-crear-campana]")!)
    await waitFor(() => expect(container.querySelector("[data-seccion=crear-campana]")).not.toBeNull())
    fireEvent.keyDown(window, { key: "Escape" })
    await waitFor(() => expect(container.querySelectorAll("[data-aplicacion]")).toHaveLength(9))
    expect(onCerrar).not.toHaveBeenCalled()
  })
  it("después de crear: «Campaña en proceso» hasta que la campaña nace; entonces el Centro vuelve a los cuadros con ella elegida, por su nombre", async () => {
    // 21-nov (GO Lenovo 01:40Z) · la campaña nace en la puerta, después del pedido: las 2 primeras lecturas de los lugares todavía no la traen
    const NUEVA: CampanaDelFlujo = { campana_id: "2fd5f619-0000-4000-8000-000000000001", nombre: "Naufrago llego a Guayaquil", flujo: ROJO }
    let creado = false
    const pedidos = red({ minimo: 60, crear: () => { creado = true; return new Response(JSON.stringify({ ok: true, accion: "crear-campana" }), { status: 200 }) }, campanas: () => (creado && pedidos.filter((p) => p.url.startsWith("/api/flujo")).length >= 4 ? [NUEVA, C_VIVA] : [C_VIVA]) }) // la nueva va PRIMERA: por omisión se elige la última (C_VIVA, sin nombre); solo el toque del Centro la deja elegida
    const { container } = render(<PanelAplicaciones onCerrar={() => {}} datosIniciales={pizDeNaufrago()} flujoInicial={null} />)
    await waitFor(() => expect(container.querySelector("[data-crear-campana]")).not.toBeNull())
    const antes = pedidos.filter((p) => p.url.startsWith("/api/flujo")).length
    fireEvent.click(container.querySelector("[data-crear-campana]")!)
    await waitFor(() => expect(container.querySelector("[data-seccion=crear-campana]")).not.toBeNull())
    // el formulario de verdad: se contesta pantalla por pantalla
    const escribir = (sel: string, v: string) => fireEvent.change(container.querySelector(sel)!, { target: { value: v } })
    const siguiente = () => fireEvent.click(boton(container, "[data-siguiente]"))
    escribir("[data-campo=nombre]", LISTAS.nombre); siguiente()
    escribir("[data-campo=cambio]", LISTAS.cambio); siguiente()
    escribir("[aria-label=Inicio]", LISTAS.inicio); escribir("[aria-label=Fin]", LISTAS.fin); siguiente()
    await waitFor(() => expect(container.querySelector("[data-minimo-valor]")?.textContent).toBe("US$ 60"))
    escribir("[aria-label=Tope]", "150"); siguiente()
    escribir("[data-campo=brief]", LISTAS.brief); siguiente()
    fireEvent.click(boton(container, "[data-crear]"))
    // el clic responde: el botón dice «Campaña en proceso», dorado y encendido, con el indicador que gira; el formulario sigue abierto
    await waitFor(() => expect(container.querySelector("[data-crear]")?.textContent).toBe("Campaña en proceso"))
    const enProceso = boton(container, "[data-crear]")
    expect(enProceso.disabled).toBe(false)
    expect(enProceso.getAttribute("aria-busy")).toBe("true")
    expect(enProceso.className).toContain("bg-oro")
    expect(enProceso.querySelector("[data-girando]")).not.toBeNull()
    expect(boton(container, "[data-atras]").disabled).toBe(true)
    // otro clic no manda otro pedido
    fireEvent.click(enProceso)
    expect(pedidos.filter((p) => p.url === "/api/acciones/crear-campana")).toHaveLength(1)
    // la campaña nace (la lectura de los lugares la trae): el formulario se cierra y el Centro la muestra elegida
    await waitFor(() => expect(container.querySelectorAll("[data-aplicacion]")).toHaveLength(9), { timeout: 12000 })
    expect(container.querySelector("[data-seccion=crear-campana]")).toBeNull()
    expect(pedidos.filter((p) => p.url.startsWith("/api/flujo")).length).toBeGreaterThan(antes + 1)
    await waitFor(() => expect(container.querySelector("[data-campana-nombre]")?.textContent).toBe("Naufrago llego a Guayaquil")) // el subtítulo «CAMPAÑA · <nombre>»
    await waitFor(() => expect(pedidos.some((p) => p.url.startsWith("/api/pizarron") && p.url.includes(NUEVA.campana_id))).toBe(true))
  }, 20000)
  // 21-nov (🔴 de CC5 01:54Z) · una lectura de los lugares que falla durante la espera no la congela: la vuelta siguiente se programa igual
  it("si una lectura de los lugares falla mientras se espera, se vuelve a leer y, al nacer, el formulario se cierra con ella elegida", async () => {
    const NUEVA: CampanaDelFlujo = { campana_id: "2fd5f619-0000-4000-8000-000000000002", nombre: "Naufrago llego a Guayaquil", flujo: ROJO }
    let creado = false, despues = 0
    const pedidos = red({ minimo: 60, crear: () => { creado = true; return new Response(JSON.stringify({ ok: true }), { status: 200 }) },
      campanas: () => (!creado ? [C_VIVA] : ++despues <= 2 ? "falla" : [NUEVA, C_VIVA]) })
    const { container } = render(<PanelAplicaciones onCerrar={() => {}} datosIniciales={pizDeNaufrago()} flujoInicial={null} />)
    await waitFor(() => expect(container.querySelector("[data-crear-campana]")).not.toBeNull())
    fireEvent.click(container.querySelector("[data-crear-campana]")!)
    await waitFor(() => expect(container.querySelector("[data-seccion=crear-campana]")).not.toBeNull())
    // al resumen directo: las respuestas ya listas
    const escribir = (sel: string, v: string) => fireEvent.change(container.querySelector(sel)!, { target: { value: v } })
    const siguiente = () => fireEvent.click(boton(container, "[data-siguiente]"))
    escribir("[data-campo=nombre]", NUEVA.nombre!); siguiente()
    escribir("[data-campo=cambio]", LISTAS.cambio); siguiente()
    escribir("[aria-label=Inicio]", LISTAS.inicio); escribir("[aria-label=Fin]", LISTAS.fin); siguiente()
    await waitFor(() => expect(container.querySelector("[data-minimo-valor]")?.textContent).toBe("US$ 60"))
    escribir("[aria-label=Tope]", "150"); siguiente()
    escribir("[data-campo=brief]", LISTAS.brief); siguiente()
    fireEvent.click(boton(container, "[data-crear]"))
    await waitFor(() => expect(container.querySelector("[data-crear]")?.textContent).toBe("Campaña en proceso"))
    // 2 lecturas fallan (la de enseguida y la de la 1.ª vuelta); la de la 2.ª vuelta trae la nueva
    await waitFor(() => expect(container.querySelector("[data-seccion=crear-campana]")).toBeNull(), { timeout: 15000 })
    expect(despues).toBeGreaterThanOrEqual(3)
    await waitFor(() => expect(container.querySelector("[data-campana-nombre]")?.textContent).toBe(NUEVA.nombre))
    expect(pedidos.filter((p) => p.url === "/api/acciones/crear-campana")).toHaveLength(1)
  }, 25000)
  it("si la campaña no nace en las 30 vueltas, el formulario sigue abierto y avisa; el botón vuelve", async () => {
    const pedidos = red({ minimo: 60 })
    const { container } = render(<PanelAplicaciones onCerrar={() => {}} datosIniciales={pizDeNaufrago()} flujoInicial={null} />)
    await waitFor(() => expect(container.querySelector("[data-crear-campana]")).not.toBeNull())
    fireEvent.click(container.querySelector("[data-crear-campana]")!)
    await waitFor(() => expect(container.querySelector("[data-seccion=crear-campana]")).not.toBeNull())
    const escribir = (sel: string, v: string) => fireEvent.change(container.querySelector(sel)!, { target: { value: v } })
    const siguiente = () => fireEvent.click(boton(container, "[data-siguiente]"))
    escribir("[data-campo=nombre]", LISTAS.nombre); siguiente()
    escribir("[data-campo=cambio]", LISTAS.cambio); siguiente()
    escribir("[aria-label=Inicio]", LISTAS.inicio); escribir("[aria-label=Fin]", LISTAS.fin); siguiente()
    await waitFor(() => expect(container.querySelector("[data-minimo-valor]")?.textContent).toBe("US$ 60"))
    escribir("[aria-label=Tope]", "150"); siguiente()
    escribir("[data-campo=brief]", LISTAS.brief); siguiente()
    // la espera de 4 s entre vueltas se acorta a 5 ms (el resto del reloj es el real)
    const real = globalThis.setTimeout
    vi.stubGlobal("setTimeout", ((fn: () => void, ms?: number) => real(fn, ms === ESPERA_ENTRE_VUELTAS_MS ? 5 : ms)) as typeof setTimeout)
    fireEvent.click(boton(container, "[data-crear]"))
    await waitFor(() => expect(container.querySelector("[data-problema]")?.textContent).toBe(SIN_NACER), { timeout: 10000 })
    expect(container.querySelector("[data-seccion=crear-campana]")).not.toBeNull()
    expect(container.querySelector("[data-crear]")?.textContent).toBe("Crear Campaña")
    const lecturas = pedidos.filter((p) => p.url.startsWith("/api/flujo")).length
    expect(lecturas).toBeGreaterThanOrEqual(VUELTAS_HASTA_QUE_NACE)
    // y ya no se sigue leyendo
    await new Promise((r) => real(r, 100))
    expect(pedidos.filter((p) => p.url.startsWith("/api/flujo")).length).toBeLessThanOrEqual(lecturas + 1)
  }, 20000)
  it("si «ya_pedida» trae el id de una campaña que ya estaba en los lugares, el Centro la elige enseguida (no espera a «una que no estaba»)", async () => {
    const NUEVA: CampanaDelFlujo = { campana_id: "2fd5f619-0000-4000-8000-000000000005", nombre: "Naufrago llego a Guayaquil", flujo: ROJO }
    red({ minimo: 60, crear: () => new Response(JSON.stringify({ ok: true, estado: "ya_pedida", pedido_id: "p", campana_id: NUEVA.campana_id }), { status: 200 }) })
    // los lugares ya leídos (y fijos) traen la campaña: nació antes de este clic (otro «Crear Campaña» tras el aviso)
    const { container } = render(<PanelAplicaciones onCerrar={() => {}} datosIniciales={pizDeNaufrago()} flujoInicial={{ campana_id: VIVA, flujo: ROJO, campanas: [NUEVA, C_VIVA] }} />)
    fireEvent.click(container.querySelector("[data-crear-campana]")!)
    await waitFor(() => expect(container.querySelector("[data-seccion=crear-campana]")).not.toBeNull())
    const escribir = (sel: string, v: string) => fireEvent.change(container.querySelector(sel)!, { target: { value: v } })
    const siguiente = () => fireEvent.click(boton(container, "[data-siguiente]"))
    escribir("[data-campo=nombre]", NUEVA.nombre!); siguiente()
    escribir("[data-campo=cambio]", LISTAS.cambio); siguiente()
    escribir("[aria-label=Inicio]", LISTAS.inicio); escribir("[aria-label=Fin]", LISTAS.fin); siguiente()
    await waitFor(() => expect(container.querySelector("[data-minimo-valor]")?.textContent).toBe("US$ 60"))
    escribir("[aria-label=Tope]", "150"); siguiente()
    escribir("[data-campo=brief]", LISTAS.brief); siguiente()
    fireEvent.click(boton(container, "[data-crear]"))
    await waitFor(() => expect(container.querySelector("[data-seccion=crear-campana]")).toBeNull(), { timeout: 2000 })
    await waitFor(() => expect(container.querySelector("[data-campana-nombre]")?.textContent).toBe(NUEVA.nombre))
  })
  it("la espera tiene tope: 30 vueltas de 4 s (2 minutos)", () => {
    expect(ESPERA_ENTRE_VUELTAS_MS).toBe(4000)
    expect(VUELTAS_HASTA_QUE_NACE).toBe(30)
  })
  it("vencida la espera (sinNacer), el formulario lo dice en el lugar del motivo y el botón vuelve a «Crear Campaña»", async () => {
    red({ minimo: 60 })
    const onCreada = vi.fn()
    const { container, rerender } = formulario({ inicial: LISTAS, pasoInicial: 5, minimoInicial: 60, onCreada })
    fireEvent.click(boton(container, "[data-crear]"))
    await waitFor(() => expect(onCreada).toHaveBeenCalledWith(LISTAS.nombre, null))
    expect(container.querySelector("[data-crear]")?.textContent).toBe("Campaña en proceso")
    rerender(<FormularioCrearCampana clienteId={NAUFRAGO} clienteNombre="Náufrago" onCerrar={() => {}} onCreada={onCreada} inicial={LISTAS} pasoInicial={5} minimoInicial={60} sinNacer />)
    expect(container.querySelector("[data-problema]")?.textContent).toBe(SIN_NACER)
    expect(SIN_NACER).toBe("El pedido salió, pero la campaña todavía no aparece. Revisa en unos minutos.")
    expect(container.querySelector("[data-crear]")?.textContent).toBe("Crear Campaña")
  })
  it("otro clic tras el aviso lleva la MISMA llave; si «ya_pedida» trae el id de la campaña, se pasa al Centro", async () => {
    const pedidos = red({ minimo: 60, crear: () => new Response(JSON.stringify({ ok: true, estado: "ya_pedida", pedido_id: "p", campana_id: "2fd5f619-0000-4000-8000-000000000003" }), { status: 200 }) })
    const onCreada = vi.fn()
    const { container } = formulario({ inicial: LISTAS, pasoInicial: 5, minimoInicial: 60, onCreada })
    fireEvent.click(boton(container, "[data-crear]"))
    await waitFor(() => expect(onCreada).toHaveBeenCalledWith(LISTAS.nombre, "2fd5f619-0000-4000-8000-000000000003"))
    expect(pedidos.filter((p) => p.url === "/api/acciones/crear-campana")).toHaveLength(1)
  })
  it("si el pedido falla, el botón vuelve a «Crear Campaña» y el motivo sale en el mismo lugar", async () => {
    red({ minimo: 60, crear: () => new Response(JSON.stringify({ ok: false, error: "conflicto", plataforma: { error: "cadena_no_admite" } }), { status: 409 }) })
    const { container } = formulario({ inicial: LISTAS, pasoInicial: 5, minimoInicial: 60 })
    fireEvent.click(boton(container, "[data-crear]"))
    await waitFor(() => expect(container.querySelector("[data-problema]")?.textContent).toBe("Este cliente todavía no puede tener campañas nuevas. No se creó nada."))
    expect(container.querySelector("[data-crear]")?.textContent).toBe("Crear Campaña")
    expect(container.querySelector("[data-en-proceso]")).toBeNull()
  })
  it("mientras el pedido viaja, el botón ya dice «Campaña en proceso»", async () => {
    let soltar: (r: Response) => void = () => {}
    vi.stubGlobal("fetch", vi.fn((url: string) => url === "/api/acciones/crear-campana" ? new Promise<Response>((r) => { soltar = r }) : Promise.resolve(new Response(JSON.stringify({ ok: true, minimo_usd: 60 }), { status: 200 }))))
    const onCreada = vi.fn()
    const { container } = formulario({ inicial: LISTAS, pasoInicial: 5, minimoInicial: 60, onCreada })
    expect(container.querySelector("[data-crear]")?.textContent).toBe("Crear Campaña")
    fireEvent.click(boton(container, "[data-crear]"))
    expect(container.querySelector("[data-crear]")?.textContent).toBe("Campaña en proceso")
    await act(async () => { soltar(new Response(JSON.stringify({ ok: true }), { status: 200 })) })
    expect(onCreada).toHaveBeenCalledTimes(1)
    expect(container.querySelector("[data-crear]")?.textContent).toBe("Campaña en proceso") // sigue hasta que el Centro ve nacer la campaña
  })
})
