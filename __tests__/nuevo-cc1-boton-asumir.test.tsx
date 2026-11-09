// @vitest-environment jsdom
/**
 * 09-nov · BOTÓN «ASUMIR» EN DECISIONES (GO `2026-11-09-GO-LENOVO-a-CC4-CC6-construir-boton-asumir.md`, reasignado a CC1 · boceto aprobado por Emilio
 * `2026-11-06-BOCETO-CC5-a-CC6-LENOVO-boton-asumir.md` + los 4 ajustes de CC6 `2026-11-06-RESPUESTA-CC6-a-CC5-LENOVO-boceto-asumir.md`).
 * Contrato: la ruta de la plataforma `POST /api/dueno/preguntas` con `accion:"asumir"` (CC1 #939): 200 `asumida:true` · 409 `ya_cerrada` · 422 `sin_supuesto` · 502 `cerebro_no_guardo`.
 * US$ 0, sin red: la plataforma y el servidor del tablero son fetch falsos que anotan cada llamada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { accionesDe, gruposDeDecisiones, normalizarDecisiones, type Decisiones } from "@/lib/direccion-decisiones"
import { contestarDecision, validarContestar, CANAL_DE_TU_OFICINA, FLUJO_DE_TU_OFICINA, type ResultadoDeContestar } from "@/lib/decisiones-contestar"
import { ESPERA_PARA_DESHACER_MS, PanelDecisiones } from "@/components/nuevo/PanelDecisiones"

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const CON = "11111111-1111-4111-8111-111111111111", SIN = "22222222-2222-4222-8222-222222222222", OTRA = "33333333-3333-4333-8333-333333333333"
const base = { fuente: "dueno_preguntas", client_id: NAUFRAGO, cliente: "Náufrago", desde: "2026-11-09T16:12:00Z", vence: null, vencida: false, prioridad: null, decidir: { ruta: null, accion: null }, costo_usd: null, costo_nota: null, pregunta_de: { oficina: "financiera", agente: "jefe-financiero" } }
// la forma exacta que manda la plataforma (`src/lib/direccion/decisiones.ts`, bucle de `dueno_preguntas`)
const CRUDO = {
  ok: true, completo: true, fuentes: [], sin_fuente: [],
  decisiones: [
    { ...base, id: CON, tipo: "pregunta_al_dueno", subtipo: "gastos fijos", titulo: "¿Cuánto pagas al mes en gastos fijos (arriendo, sueldos, servicios)?", permite: ["responder", "asumir", "descartar"], supuesto: "US$ 1.200", detiene: true },
    { ...base, id: SIN, tipo: "pregunta_al_dueno", subtipo: "mesas urdesa", titulo: "¿Cuántas mesas tiene la sede de Urdesa?", permite: ["responder", "descartar"], detiene: false },
    { ...base, id: OTRA, tipo: "pregunta_al_dueno", subtipo: "consumo por mesa", titulo: "¿Cuánto gasta en promedio una mesa en un día normal?", permite: ["responder", "asumir", "descartar"], supuesto: "US$ 18" },
  ],
}
const D = normalizarDecisiones(CRUDO)
const por = (id: string) => D.decisiones.find((x) => x.id === id)!
const sin = (...ids: string[]): Decisiones => ({ ...D, decisiones: D.decisiones.filter((x) => !ids.includes(x.id)) })

describe("qué tarjeta ofrece «Asumir» (solo con el supuesto de la oficina; nunca uno inventado)", () => {
  it("la lectura guarda el supuesto y el permiso; con los dos, la tarjeta ofrece asumir", () => {
    expect(por(CON).supuesto).toBe("US$ 1.200"); expect(por(CON).permite).toEqual(["responder", "asumir", "descartar"])
    expect(accionesDe(por(CON))).toEqual(["responder", "asumir", "descartar"])
  })
  it("sin supuesto no hay asumir, aunque la oficina lo permita; sin permiso tampoco, aunque traiga supuesto", () => {
    expect(accionesDe(por(SIN))).toEqual(["responder", "descartar"])
    expect(accionesDe({ ...por(SIN), permite: ["responder", "asumir", "descartar"] })).toEqual(["responder", "descartar"])
    expect(accionesDe({ ...por(CON), permite: ["responder", "descartar"] })).toEqual(["responder", "descartar"])
    expect(accionesDe({ ...por(CON), supuesto: "   " })).toEqual(["responder", "descartar"])
  })
  it("una fuente que no declara permisos (la de antes) no gana «asumir»", () => {
    expect(accionesDe({ ...por(CON), permite: undefined })).toEqual(["responder", "descartar"])
  })
  it("la pantalla puede pedir «asumir»", () => {
    expect(validarContestar({ id: CON, accion: "asumir" })).toMatchObject({ ok: true, accion: "asumir" })
  })
})

/** la plataforma de mentira: la ruta de las preguntas contesta lo que se le pida, y anota todo */
function plataforma(asumir: [number, Record<string, unknown>] = [200, { ok: true, asumida: true, ficha_ref: "f1", supuesto: "US$ 1.200" }]) {
  const llamadas: Array<{ url: string; metodo: string; cuerpo: Record<string, unknown> | null; llave: string | null }> = []
  const f = vi.fn(async (url: string, init: RequestInit) => {
    const cuerpo = init.body ? JSON.parse(String(init.body)) : null
    llamadas.push({ url, metodo: String(init.method), cuerpo, llave: (init.headers as Record<string, string>)["x-api-key"] ?? null })
    const res = (s: number, j: unknown) => new Response(JSON.stringify(j), { status: s })
    if (url.includes("/api/dueno/preguntas?")) return res(200, { ok: true, pendientes: [{ pregunta_id: CON, tema: "gastos fijos", oficina: "financiera", agente: "jefe-financiero" }] })
    if (url.endsWith("/api/dueno/preguntas")) return res(...asumir)
    return res(404, {})
  })
  return { f: f as unknown as typeof fetch, llamadas }
}
const lecturas = (...ds: Decisiones[]) => { let k = 0; return vi.fn(async () => ({ ok: true as const, datos: ds[Math.min(k++, ds.length - 1)] })) }
const deps = (p: ReturnType<typeof plataforma>, leer = lecturas(D, sin(CON))) => ({ plataformaUrl: "https://plataforma.test", llave: "secreta", fetchImpl: p.f, revisor: "emilacho@hotmail.com", leer, ahora: () => new Date("2026-11-09T19:00:00Z"), id: () => "fijo" })
const posts = (p: ReturnType<typeof plataforma>) => p.llamadas.filter((x) => x.metodo === "POST")

describe("el servidor del tablero · asumir va a la ruta de la plataforma, nunca al cerebro", () => {
  it("200 → la forma exacta de #939 (sin supuesto en el cuerpo: lo lee la ruta de la fila), con la llave; sale", async () => {
    const p = plataforma()
    const r = await contestarDecision({ id: CON, accion: "asumir" }, deps(p))
    expect(r.status).toBe(200); expect(r.cuerpo).toMatchObject({ ok: true, sale: true, texto: "Asumida." })
    expect(posts(p)).toHaveLength(1)
    const [a] = posts(p)
    expect(a.url).toBe("https://plataforma.test/api/dueno/preguntas"); expect(a.llave).toBe("secreta")
    expect(a.cuerpo).toEqual({ accion: "asumir", client_id: NAUFRAGO, pregunta_id: CON, decidido_por: "emilacho@hotmail.com", canal: CANAL_DE_TU_OFICINA, workflow_id: FLUJO_DE_TU_OFICINA, workflow_execution_id: "tablero:fijo" })
    expect(p.llamadas.some((x) => x.url.includes("/api/brain/"))).toBe(false)
    const reg = (r.cuerpo as ResultadoDeContestar).registro
    expect(reg.find((x) => x.estado === "asumiste")).toMatchObject({ quien: "tu", cita: "US$ 1.200" })
  })
  it("409 (otro la cerró) → no es un error: sale, marcado «cerrada antes»", async () => {
    const p = plataforma([409, { ok: false, error: "ya_cerrada", detalle: "…", guardada_en_cerebro: true, ficha_ref: "f1" }])
    const r = await contestarDecision({ id: CON, accion: "asumir" }, deps(p))
    expect(r.cuerpo).toMatchObject({ ok: true, sale: true, cerrada_antes: true })
  })
  it("502 (el cerebro no guardó) → no sale, con el motivo del boceto", async () => {
    const p = plataforma([502, { ok: false, error: "cerebro_no_guardo", detalle: "el cerebro no guardó el supuesto (500: x); la pregunta sigue pendiente" }])
    const r = await contestarDecision({ id: CON, accion: "asumir" }, deps(p, lecturas(D, D)))
    expect(r.cuerpo).toMatchObject({ ok: false, sale: false, motivo: "No se pudo asumir. La pregunta sigue abierta; vuelve a intentarlo." })
  })
  it("un 200 que no dice «asumida» no se toma por hecho", async () => {
    const p = plataforma([200, { ok: true }])
    const r = await contestarDecision({ id: CON, accion: "asumir" }, deps(p, lecturas(D, D)))
    expect(r.cuerpo).toMatchObject({ ok: false, sale: false })
  })
  it("la decisión se busca de nuevo en el servidor: si ya no trae supuesto, no se asume (y no sale ninguna llamada)", async () => {
    const p = plataforma()
    const sinSupuesto = { ...D, decisiones: D.decisiones.map((x) => (x.id === CON ? { ...x, supuesto: null } : x)) }
    const r = await contestarDecision({ id: CON, accion: "asumir" }, deps(p, lecturas(sinSupuesto)))
    expect(r.status).toBe(409); expect(r.cuerpo).toMatchObject({ error: "accion_no_permitida" }); expect(posts(p)).toHaveLength(0)
  })
})

// ───────── la tarjeta y el panel (jsdom) ─────────
/** el servidor del tablero de mentira: GET la lista · POST contestar con lo que se le pida */
function tablero(contestar: (cuerpo: Record<string, unknown>) => [number, Record<string, unknown>] = () => [200, { ok: true, sale: true, texto: "Asumida.", registro: [] }], lista: Decisiones = sin(CON)) {
  const llamadas: Array<{ url: string; metodo: string; cuerpo: Record<string, unknown> | null }> = []
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const cuerpo = init?.body ? JSON.parse(String(init.body)) : null
    llamadas.push({ url, metodo: String(init?.method ?? "GET"), cuerpo })
    if (url === "/api/direccion/decisiones/contestar") { const [s, j] = contestar(cuerpo); return new Response(JSON.stringify(j), { status: s }) }
    return new Response(JSON.stringify({ ok: true, ...lista }), { status: 200 })
  })
  return { f: f as unknown as typeof fetch, llamadas, asumidas: () => llamadas.filter((x) => x.metodo === "POST" && x.cuerpo?.accion === "asumir"), lecturas: () => llamadas.filter((x) => x.metodo === "GET").length }
}
const pintar = (t: ReturnType<typeof tablero>, datos: Decisiones = D) => render(<PanelDecisiones onCerrar={() => undefined} datosIniciales={datos} fetchImpl={t.f} />)
const $ = (s: string) => document.querySelector(s) as HTMLElement | null
const tarjeta = () => $("[data-decision]")?.getAttribute("data-decision")
const pasar = async (ms: number) => { await act(async () => { vi.advanceTimersByTime(ms) }); await act(async () => { await Promise.resolve() }) }

beforeEach(() => { vi.useFakeTimers(); Element.prototype.scrollIntoView = vi.fn() }) // jsdom no tiene scrollIntoView
afterEach(() => { cleanup(); vi.useRealTimers() })

describe("la tarjeta (boceto 1 y 3)", () => {
  it("con supuesto: PREGUNTA → SI ASUMES (el supuesto en su recuadro) → tres botones del mismo ancho, Responder (ámbar) el último", () => {
    pintar(tablero())
    expect(tarjeta()).toBe(CON)
    expect($("[data-supuesto]")?.textContent).toBe("US$ 1.200")
    expect($("[data-si-asumes]")).not.toBeNull(); expect($("[data-sin-supuesto]")).toBeNull()
    const acc = $("[data-decision] [data-acciones]")!
    expect(acc.className).toContain("grid-cols-3")
    expect([...acc.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Descartar", "Asumir", "Responder"])
    for (const b of acc.querySelectorAll("button")) expect(b.className).toContain("whitespace-nowrap") // el texto no se parte
    expect(acc.querySelector("button:last-child")!.className).toContain("bg-ambar")
    expect(acc.querySelectorAll(".bg-ambar")).toHaveLength(1)
  })
  it("sin supuesto: el bloque SIN SUPUESTO dice por qué, sin botón Asumir (dos botones)", () => {
    pintar(tablero(), { ...D, decisiones: [por(SIN)] })
    expect($("[data-sin-supuesto]")?.textContent).toContain("La oficina no propuso un supuesto")
    expect($("[data-asumir]")).toBeNull(); expect($("[data-si-asumes]")).toBeNull()
    const acc = $("[data-decision] [data-acciones]")!
    expect(acc.className).toContain("grid-cols-2"); expect(acc.querySelectorAll("button")).toHaveLength(2)
  })
  it("ajuste 1 · «El plan espera…» solo si la pregunta del frente detiene el plan (señal de la plataforma); nunca fijo", () => {
    pintar(tablero())
    expect($("[data-linea-plan]")?.textContent).toBe("El plan espera hasta que cierres todas las preguntas")
    cleanup()
    pintar(tablero(), { ...D, decisiones: [por(SIN), por(OTRA)] })
    expect($("[data-linea-plan]")).toBeNull()
  })
})

describe("asumir en el panel (boceto 2 y 4 + ajustes 2, 3 y 4 de CC6)", () => {
  it("ajuste 4 · la llamada sale recién a los 5 s: antes, la tarjeta ya pasó a la siguiente, el contador bajó y la constancia ofrece Deshacer", async () => {
    const t = tablero()
    pintar(t)
    const antes = $('[data-recuadro="firma"]')?.textContent ?? document.body.textContent
    fireEvent.click($("[data-asumir]")!)
    expect(t.asumidas()).toHaveLength(0)
    expect(tarjeta()).not.toBe(CON)
    expect($('[data-constancia="asumida"]')?.textContent).toContain("US$ 1.200, como supuesto tuyo")
    expect($("[data-deshacer]")).not.toBeNull()
    expect(document.body.textContent).not.toBe(antes)
    await pasar(ESPERA_PARA_DESHACER_MS - 1)
    expect(t.asumidas()).toHaveLength(0)
    await pasar(1)
    expect(t.asumidas()).toHaveLength(1)
    expect(t.asumidas()[0].cuerpo).toEqual({ id: CON, accion: "asumir" })
    expect($("[data-deshacer]")).toBeNull() // ya salió: no hay nada que deshacer
    expect($('[data-constancia="asumida"]')).not.toBeNull()
  })
  it("Deshacer dentro de los 5 s no manda nada, nunca; la pregunta vuelve al frente y la constancia se va", async () => {
    const t = tablero()
    pintar(t)
    fireEvent.click($("[data-asumir]")!)
    await pasar(2000)
    fireEvent.click($("[data-deshacer]")!)
    await pasar(ESPERA_PARA_DESHACER_MS * 3)
    expect(t.asumidas()).toHaveLength(0)
    expect(tarjeta()).toBe(CON); expect($("[data-constancia]")).toBeNull()
  })
  it("502 · la pregunta vuelve al frente con la línea roja fina «Sin guardar» bajo los botones; sin constancia", async () => {
    const t = tablero(() => [200, { ok: false, sale: false, texto: "No salió: sigue en tu lista.", motivo: "No se pudo asumir. La pregunta sigue abierta; vuelve a intentarlo.", registro: [] }])
    pintar(t)
    fireEvent.click($("[data-asumir]")!)
    await pasar(ESPERA_PARA_DESHACER_MS)
    expect(tarjeta()).toBe(CON)
    expect($("[data-sin-guardar]")?.textContent).toBe("Sin guardarNo se pudo asumir. La pregunta sigue abierta; vuelve a intentarlo.")
    expect($("[data-constancia]")).toBeNull()
    expect($("[data-por-que-volvio]")).toBeNull() // no el aviso grande de arriba
    expect($("[data-asumir]")).not.toBeNull() // se puede volver a intentar
  })
  it("ajuste 3 · 409 → constancia «Ya estaba cerrada» y la lista se vuelve a leer entera (no solo restar 1)", async () => {
    const t = tablero(() => [200, { ok: true, sale: true, cerrada_antes: true, texto: "Ya estaba cerrada.", registro: [] }])
    pintar(t)
    fireEvent.click($("[data-asumir]")!)
    await pasar(ESPERA_PARA_DESHACER_MS)
    expect($('[data-constancia="cerrada"]')?.textContent).toContain("Ya estaba cerrada")
    expect(t.lecturas()).toBeGreaterThanOrEqual(1)
  })
  it("CC6 #303 · si otro la cerró durante los 5 s (el servidor del tablero ya no la encuentra: 409 ya_no_esta), dice «Ya estaba cerrada», no «Asumida», y relee", async () => {
    const t = tablero(() => [409, { ok: false, error: "ya_no_esta", detalle: "Esta decisión ya no está pendiente: se resolvió en otro lugar." }])
    pintar(t)
    fireEvent.click($("[data-asumir]")!)
    await pasar(ESPERA_PARA_DESHACER_MS)
    expect($('[data-constancia="cerrada"]')?.textContent).toContain("Ya estaba cerrada")
    expect($('[data-constancia="asumida"]')).toBeNull()
    expect(t.lecturas()).toBeGreaterThanOrEqual(1)
  })
  it("CC6 #303 menor 1 · si la oficina retiró el supuesto, vuelve sin «Asumir», lo dice y relee la lista (reintentar fallaría siempre)", async () => {
    const t = tablero(() => [409, { ok: false, error: "accion_no_permitida", detalle: "Esta decisión no se contesta así." }], { ...D, decisiones: D.decisiones.map((x) => (x.id === CON ? { ...x, supuesto: null, permite: ["responder", "descartar"] } : x)) })
    pintar(t)
    fireEvent.click($("[data-asumir]")!)
    await pasar(ESPERA_PARA_DESHACER_MS)
    await pasar(0)
    expect(tarjeta()).toBe(CON)
    expect($("[data-sin-guardar]")?.textContent).toContain("La oficina ya no propone un supuesto")
    expect($("[data-asumir]")).toBeNull(); expect($("[data-si-asumes]")).toBeNull()
    expect(t.lecturas()).toBeGreaterThanOrEqual(1)
  })
  it("CC6 #303 menor 1 · aunque la relectura falle, la tarjeta ya vuelve sin el supuesto viejo ni «Asumir»", async () => {
    const f = vi.fn(async (_url: string, init?: RequestInit) => (init?.method === "POST"
      ? new Response(JSON.stringify({ ok: false, error: "accion_no_permitida", detalle: "x" }), { status: 409 })
      : new Response(JSON.stringify({ ok: false, error: "caida" }), { status: 500 }))) as unknown as typeof fetch
    render(<PanelDecisiones onCerrar={() => undefined} datosIniciales={D} fetchImpl={f} />)
    fireEvent.click($("[data-asumir]")!)
    await pasar(ESPERA_PARA_DESHACER_MS)
    await pasar(0)
    expect(tarjeta()).toBe(CON)
    expect($("[data-asumir]")).toBeNull(); expect($("[data-supuesto]")).toBeNull()
  })
  it("CC6 #303 menor 2 · si no se pudo, la pregunta queda al frente aunque el dueño estuviera en otra página", async () => {
    const OTRA2 = "44444444-4444-4444-8444-444444444444"
    const cuatro = { ...D, decisiones: [...D.decisiones, { ...por(OTRA), id: OTRA2, subtipo: "ticket", titulo: "¿Cuál es el ticket promedio?", supuesto: "US$ 9" }] }
    const t = tablero(() => [200, { ok: false, sale: false, texto: "No salió.", motivo: "x", registro: [] }])
    pintar(t, cuatro)
    for (let k = 0; k < 3; k++) fireEvent.keyDown(window, { key: "ArrowRight" })
    expect(tarjeta()).toBe(OTRA2)
    fireEvent.click($("[data-asumir]")!)
    await pasar(ESPERA_PARA_DESHACER_MS)
    expect(tarjeta()).toBe(OTRA2)
    expect($("[data-sin-guardar]")).not.toBeNull()
  })
  it("al asumir con éxito también se vuelve a leer la lista", async () => {
    const t = tablero()
    pintar(t)
    fireEvent.click($("[data-asumir]")!)
    await pasar(ESPERA_PARA_DESHACER_MS)
    expect(t.lecturas()).toBeGreaterThanOrEqual(1)
  })
  it("ajuste 2 · una sola constancia: asumir otra suelta ya la anterior (sale su llamada) y queda solo la nueva", async () => {
    const t = tablero(undefined, sin(CON, OTRA))
    pintar(t, { ...D, decisiones: [por(CON), por(OTRA)] })
    fireEvent.click($("[data-asumir]")!)
    expect(tarjeta()).toBe(OTRA)
    fireEvent.click($("[data-asumir]")!)
    await pasar(0)
    expect(t.asumidas().map((x) => x.cuerpo?.id)).toEqual([CON])
    expect(document.querySelectorAll("[data-constancia]")).toHaveLength(1)
    expect($("[data-constancia-texto]")?.textContent).toContain("US$ 18")
    await pasar(ESPERA_PARA_DESHACER_MS)
    expect(t.asumidas().map((x) => x.cuerpo?.id)).toEqual([CON, OTRA])
  })
  it("ajuste 2 · la constancia se va con tu próxima acción (responder otra), y la asumida que esperaba sale antes", async () => {
    const t = tablero((c) => (c.accion === "asumir" ? [200, { ok: true, sale: true, texto: "Asumida.", registro: [] }] : [200, { ok: true, sale: false, texto: "No salió.", motivo: "x", registro: [] }]))
    pintar(t)
    fireEvent.click($("[data-asumir]")!)
    expect(tarjeta()).toBe(SIN)
    fireEvent.change($("[data-respuesta]")!, { target: { value: "Doce mesas" } })
    fireEvent.click($("[data-enviar]")!)
    await pasar(0)
    expect(t.asumidas()).toHaveLength(1)
    expect($("[data-constancia]")).toBeNull()
  })
  it("cerrar el panel con una asumida esperando la manda ya (solo Deshacer la anula)", async () => {
    const t = tablero()
    const r = pintar(t)
    fireEvent.click($("[data-asumir]")!)
    r.unmount()
    await pasar(0)
    expect(t.asumidas()).toHaveLength(1)
  })
  it("los grupos siguen contando bien: lo asumido sale de «esperan» y de «detenidas»", () => {
    const g = gruposDeDecisiones(D)
    expect(g.detienen.map((x) => x.id)).toEqual([CON])
  })
})
