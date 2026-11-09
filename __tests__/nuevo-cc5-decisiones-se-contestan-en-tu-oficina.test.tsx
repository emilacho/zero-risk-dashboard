/**
 * 04-nov · TU OFICINA › DECISIONES SE CONTESTAN AHÍ (encargo `2026-11-04-ENCARGO-LENOVO-a-CC5-decisiones-se-contestan-en-tu-oficina.md` + adendas · boceto aprobado por Emilio 18:08Z).
 * Contratos: CC1 #939 (`POST /api/dueno/preguntas` · responder / descartar · `GET` las pendientes; condición A de CC7 06-nov, antes la puerta del cerebro) · CC1 #897 (`POST /api/finanzas/responder`, primero) · `firmar-tablero`.
 * US$ 0, sin red: la plataforma es un fetch falso que anota cada llamada.
 */
import { describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { accionesDe, gruposDeDecisiones, normalizarDecisiones, nombreDeOficina, type Decision, type Decisiones } from "@/lib/direccion-decisiones"
import { contestarDecision, quienPregunto, CANAL_DE_TU_OFICINA, FLUJO_DE_TU_OFICINA } from "@/lib/decisiones-contestar"
import { PanelDecisiones } from "@/components/nuevo/PanelDecisiones"

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const P1 = "11111111-1111-4111-8111-111111111111", P2 = "22222222-2222-4222-8222-222222222222", T1 = "33333333-3333-4333-8333-333333333333", E1 = "44444444-4444-4444-8444-444444444444"
const base = { subtipo: null, fuente: null, client_id: NAUFRAGO, cliente: "Náufrago", desde: "2026-11-04T16:12:00Z", vence: null, vencida: false, prioridad: null, decidir: { ruta: null, accion: null }, costo_usd: null, costo_nota: null }
const CRUDO = {
  ok: true, completo: true, fuentes: [], sin_fuente: [],
  decisiones: [
    { ...base, id: T1, tipo: "firma_de_finanzas", subtipo: "tablero_sin_firma", fuente: "finanzas_tableros", titulo: "Tablero financiero: espera tu firma", cifras: [{ clave: "total_mes", nombre: "Presupuesto al mes", valor: 1341.27, unidad: "US$", nota: null }], desde: "2026-11-01T10:00:00Z", decidir: { ruta: null, accion: "firmar-tablero" } },
    { ...base, id: E1, tipo: "pregunta_de_finanzas", subtipo: "plan_en_pausa", fuente: "esperas_del_dueno", titulo: "El plan está en pausa: la oficina financiera espera tus respuestas en el buzón de preguntas" },
    { ...base, id: P1, tipo: "pregunta_al_dueno", subtipo: "ticket promedio", fuente: "cerebro_dueno_preguntas", titulo: "¿Cuánto gasta en promedio una mesa?", titulo_interno: "¿Cuánto gasta en promedio una mesa, en un día normal?" },
    { ...base, id: P2, tipo: "pregunta_al_dueno", subtipo: "mesas urdesa", fuente: "cerebro_dueno_preguntas", titulo: "¿Cuántas mesas tiene la sede de Urdesa?", client_id: "55555555-5555-4555-8555-555555555555", cliente: "Otro cliente" },
  ],
}
const D = normalizarDecisiones(CRUDO)
const sin = (...ids: string[]): Decisiones => ({ ...D, decisiones: D.decisiones.filter((x) => !ids.includes(x.id)) })

/** la plataforma de mentira: responde según ruta y método, y anota todo */
function plataforma(r: { pausa?: [number, Record<string, unknown>]; dueno?: [number, Record<string, unknown>]; pendientes?: unknown[]; puerta?: [number, Record<string, unknown>] } = {}) {
  const llamadas: Array<{ url: string; metodo: string; cuerpo: Record<string, unknown> | null; llave: string | null }> = []
  const f = vi.fn(async (url: string, init: RequestInit) => {
    const cuerpo = init.body ? JSON.parse(String(init.body)) : null
    llamadas.push({ url, metodo: String(init.method), cuerpo, llave: (init.headers as Record<string, string>)["x-api-key"] ?? null })
    const res = (s: number, j: unknown) => new Response(JSON.stringify(j), { status: s })
    if (url.includes("/api/brain/alimentar/dueno")) { const [s, j] = r.puerta ?? [410, { ok: false, error: "evento_retirado" }]; return res(s, j) } // la puerta del cerebro ya no es para preguntas (solo datos sueltos)
    if (url.includes("/api/dueno/preguntas?")) return res(200, { ok: true, pendientes: r.pendientes ?? [{ pregunta_id: P1, tema: "ticket promedio", oficina: "financiera", agente: "jefe-financiero" }] })
    if (url.endsWith("/api/finanzas/responder")) { const [s, j] = r.pausa ?? [200, { en_pausa: false }]; return res(s, j) }
    if (url.endsWith("/api/dueno/preguntas")) { const [s, j] = r.dueno ?? [200, cuerpo?.accion === "descartar" ? { ok: true, descartada: true, estado: "descartada" } : { ok: true, guardada: true, ficha_ref: "f1", preguntas_cerradas: 1 }]; return res(s, j) }
    return res(404, {})
  })
  return { f: f as unknown as typeof fetch, llamadas }
}
/** las lecturas de la lista: la primera (antes de actuar) y la de después (para confirmar que salió) */
const lecturas = (...ds: Decisiones[]) => { let k = 0; return vi.fn(async () => ({ ok: true as const, datos: ds[Math.min(k++, ds.length - 1)] })) }
const deps = (p: ReturnType<typeof plataforma>, leer = lecturas(D, sin(P1)), extra = {}) => ({ plataformaUrl: "https://plataforma.test", llave: "secreta", fetchImpl: p.f, revisor: "emilacho@hotmail.com", leer, ahora: () => new Date("2026-11-04T16:52:00Z"), id: () => "fijo", ...extra })

describe("las acciones que muestra cada tarjeta (ADENDA 2 · solo las que su oficina permite y el tablero sabe hacer)", () => {
  it("pregunta → responder y descartar · firma → firmar · lo demás abre su panel · la tarjeta de la pausa no se contesta", () => {
    const por = (id: string) => D.decisiones.find((x) => x.id === id)!
    expect(accionesDe(por(P1))).toEqual(["responder", "descartar"]); expect(accionesDe(por(T1))).toEqual(["aceptar"]); expect(accionesDe(por(E1))).toEqual([])
    expect(accionesDe({ tipo: "plan", fuente: "hitl_queue", subtipo: null })).toEqual([])
  })
  it("si la oficina declara lo que permite, manda (sin inventar botones que no tienen ruta: «editar» no aparece)", () => {
    const d = normalizarDecisiones({ ...CRUDO, decisiones: [{ ...CRUDO.decisiones[2], permite: { allow_respond: true, allow_ignore: false, allow_edit: true } }] }).decisiones[0]
    expect(d.permite).toEqual(["editar", "responder"]); expect(accionesDe(d)).toEqual(["responder"])
    expect(accionesDe({ ...d, permite: ["descartar"] })).toEqual(["descartar"])
  })
  it("orden: primero lo que detiene un trabajo; la tarjeta de la pausa no se repite si sus preguntas están; nada queda «fuera»", () => {
    const g = gruposDeDecisiones(D)
    expect(g.firma.map((x) => x.id)).toEqual([P1, T1, P2]); expect(g.detienen.map((x) => x.id)).toEqual([P1]); expect(g.fuera).toEqual([])
    const soloPausa = gruposDeDecisiones({ decisiones: D.decisiones.filter((x) => x.id === E1) })
    expect(soloPausa.fuera.map((x) => x.id)).toEqual([E1]) // sin preguntas a la vista, la pausa no se esconde
  })
  it("nombres reales de las oficinas", () => {
    expect(nombreDeOficina("financiera")).toBe("Oficina financiera"); expect(nombreDeOficina("oficina_planeacion")).toBe("Oficina de planeación"); expect(nombreDeOficina("ventas-locales")).toBe("Ventas locales")
  })
})

describe("responder · primero la pausa de finanzas, después la ruta de las preguntas (nunca las dos)", () => {
  it("no es de la pausa → la ruta de la plataforma recibe la forma exacta de #939; sale porque la fila dejó de estar pendiente", async () => {
    const p = plataforma()
    const r = await contestarDecision({ id: P1, accion: "responder", respuesta: "Unos 28 dólares por mesa" }, deps(p))
    expect(r.status).toBe(200); expect(r.cuerpo).toMatchObject({ ok: true, sale: true, texto: "Contestada." })
    const [pausa, dueno] = p.llamadas.filter((x) => x.metodo === "POST")
    expect(pausa.url).toBe("https://plataforma.test/api/finanzas/responder"); expect(pausa.cuerpo).toEqual({ client_id: NAUFRAGO, tema: "ticket promedio", respuesta: "Unos 28 dólares por mesa", quien: "emilacho@hotmail.com" })
    expect(dueno.url).toBe("https://plataforma.test/api/dueno/preguntas")
    expect(dueno.cuerpo).toEqual({
      accion: "responder", client_id: NAUFRAGO, pregunta_id: P1, respuesta: "Unos 28 dólares por mesa", decidido_por: "emilacho@hotmail.com",
      canal: CANAL_DE_TU_OFICINA, mensaje_ref: `oficina:${P1}`, respondido_en: "2026-11-04T16:52:00.000Z", workflow_id: FLUJO_DE_TU_OFICINA, workflow_execution_id: "tablero:fijo",
    })
    expect(p.llamadas.some((x) => x.url.includes("/api/brain/alimentar/dueno"))).toBe(false) // nunca la puerta del cerebro
    expect(CANAL_DE_TU_OFICINA).toBe("dashboard · Tu oficina")
    expect(p.llamadas.every((x) => x.llave === "secreta")).toBe(true); expect(JSON.stringify(r)).not.toContain("secreta")
    const reg = (r.cuerpo as { registro: Array<{ estado: string; cita?: string }> }).registro
    expect(reg.map((x) => x.estado)).toEqual(["pregunto", "respondiste", "guardado"]); expect(reg[1].cita).toBe("Unos 28 dólares por mesa")
  })
  it("es de la pausa → la pausa ya la guardó en el cerebro: NO se llama a la puerta del dueño; dice cuándo sigue el plan", async () => {
    const p = plataforma({ pausa: [200, { en_pausa: true, es_de_la_pausa: true, aplicada: true, en_el_cerebro: true, faltan: ["mesas"] }] })
    const r = await contestarDecision({ id: P1, accion: "responder", respuesta: "28" }, deps(p))
    expect(r.cuerpo).toMatchObject({ ok: true, sale: true })
    expect(p.llamadas.filter((x) => x.url.endsWith("/api/dueno/preguntas"))).toHaveLength(0)
    expect(JSON.stringify(r.cuerpo)).toContain("15 minutos"); expect(JSON.stringify(r.cuerpo)).toContain("la pregunta que falta")
    const soltada = await contestarDecision({ id: P1, accion: "responder", respuesta: "28" }, deps(plataforma({ pausa: [200, { en_pausa: true, es_de_la_pausa: true, en_el_cerebro: true, faltan: [], soltada: true }] })))
    expect((soltada.cuerpo as { registro: Array<{ estado: string }> }).registro.at(-1)!.estado).toBe("retomado")
  })
  it("si el cerebro no la recibió (en_el_cerebro:false), la tarjeta se queda y lo dice (CC1: la pregunta sigue viva)", async () => {
    const r = await contestarDecision({ id: P1, accion: "responder", respuesta: "28" }, deps(plataforma({ pausa: [200, { en_pausa: true, es_de_la_pausa: true, en_el_cerebro: false, faltan: [] }] })))
    expect(r.cuerpo).toMatchObject({ ok: true, sale: false }); expect((r.cuerpo as { motivo: string }).motivo).toMatch(/El cerebro no la recibió/)
  })
  it("si la ruta de la pausa falla, no se guarda en ningún lado (no se arriesga a guardar dos veces)", async () => {
    const p = plataforma({ pausa: [500, { error: "responder_error" }] })
    const r = await contestarDecision({ id: P1, accion: "responder", respuesta: "28" }, deps(p))
    expect(r.cuerpo).toMatchObject({ ok: false, sale: false }); expect(p.llamadas.filter((x) => x.url.endsWith("/api/dueno/preguntas"))).toHaveLength(0)
  })
  it("si la ruta de la pausa todavía no existe (404), sigue por la ruta de las preguntas", async () => {
    const p = plataforma({ pausa: [404, {}] })
    expect((await contestarDecision({ id: P1, accion: "responder", respuesta: "28" }, deps(p))).cuerpo).toMatchObject({ ok: true, sale: true })
    expect(p.llamadas.filter((x) => x.url.endsWith("/api/dueno/preguntas"))).toHaveLength(1)
  })
  it("sin saber qué oficina preguntó igual se guarda: la ruta lo saca de la fila (la de 72 h no trae las viejas)", async () => {
    const p = plataforma({ pendientes: [] })
    const r = await contestarDecision({ id: P1, accion: "responder", respuesta: "28" }, deps(p))
    expect(r.cuerpo).toMatchObject({ ok: true, sale: true })
    expect((r.cuerpo as { registro: Array<{ texto: string }> }).registro[0].texto).toBe("La pregunta llegó a Tu oficina")
  })
  it("🔴 409 con la respuesta ya en el cerebro (otro cerró la fila entre medio) → contestada, sin repetirla", async () => {
    const p = plataforma({ dueno: [409, { ok: false, error: "ya_cerrada", detalle: "la respuesta quedó en el cerebro, pero otro cerró la pregunta antes" }] })
    const r = await contestarDecision({ id: P1, accion: "responder", respuesta: "28" }, deps(p))
    expect(r.cuerpo).toMatchObject({ ok: true, sale: true }); expect(JSON.stringify(r.cuerpo)).toContain("ya había quedado en el cerebro")
    expect(p.llamadas.some((x) => x.url.includes("/api/brain/alimentar/dueno"))).toBe(false)
  })
  it("🔴 CC7 · 409 antes de guardar (la pregunta ya estaba cerrada) → tu palabra va como dato suelto por la puerta del cerebro; si falla, se dice", async () => {
    const p = plataforma({ dueno: [409, { ok: false, error: "ya_cerrada", detalle: "la pregunta ya está «respondida»" }], puerta: [200, { ok: true, guardada: true, ficha_id: "fs" }] })
    const r = await contestarDecision({ id: P1, accion: "responder", respuesta: "28" }, deps(p))
    expect(r.cuerpo).toMatchObject({ ok: true, sale: true }); expect(JSON.stringify(r.cuerpo)).toContain("La pregunta ya la había cerrado otro")
    const suelto = p.llamadas.find((x) => x.url.endsWith("/api/brain/alimentar/dueno"))!
    expect(suelto.cuerpo).toMatchObject({ evento: "respuesta", client_id: NAUFRAGO, tema: "ticket promedio", respuesta: "28", preguntado_por: { oficina: "financiera", agente: "jefe-financiero" }, dry_run: false })
    expect(suelto.cuerpo).not.toHaveProperty("pregunta_id")
    const falla = await contestarDecision({ id: P1, accion: "responder", respuesta: "28" }, deps(plataforma({ dueno: [409, { ok: false, error: "ya_cerrada", detalle: "la pregunta ya está «respondida»" }], puerta: [502, { ok: false, error: "x" }] })))
    expect(falla.cuerpo).toMatchObject({ ok: false, sale: false }); expect((falla.cuerpo as { motivo: string }).motivo).toMatch(/tampoco se pudo guardar como dato suelto/)
  })
  it("si la puerta rechaza, la tarjeta se queda con el motivo", async () => {
    const r = await contestarDecision({ id: P1, accion: "responder", respuesta: "28" }, deps(plataforma({ dueno: [400, { error: "entrada_invalida", detalle: "`tema` va hasta 80" }] })))
    expect(r.cuerpo).toMatchObject({ ok: false, sale: false }); expect((r.cuerpo as { motivo: string }).motivo).toContain("`tema` va hasta 80")
    const sinGuardar = await contestarDecision({ id: P1, accion: "responder", respuesta: "28" }, deps(plataforma({ dueno: [200, { ok: true, guardada: false }] })))
    expect(sinGuardar.cuerpo).toMatchObject({ ok: false, sale: false })
    const cerebroCaido = await contestarDecision({ id: P1, accion: "responder", respuesta: "28" }, deps(plataforma({ dueno: [502, { ok: false, error: "cerebro_no_guardo", detalle: "la pregunta sigue pendiente" }] })))
    expect(cerebroCaido.cuerpo).toMatchObject({ ok: false, sale: false }); expect((cerebroCaido.cuerpo as { motivo: string }).motivo).toContain("la pregunta sigue pendiente")
  })
  it("se guardó pero la fila sigue pendiente → no se dice «salió» (una sola fuente de verdad)", async () => {
    const r = await contestarDecision({ id: P1, accion: "responder", respuesta: "28" }, deps(plataforma(), lecturas(D, D)))
    expect(r.cuerpo).toMatchObject({ ok: true, sale: false }); expect((r.cuerpo as { motivo: string }).motivo).toMatch(/sigue abierta/)
  })
})

describe("descartar y firmar", () => {
  it("responder manda exactamente la forma de #939: sin texto de pregunta ni tema (la ruta los saca de la fila)", async () => {
    const p = plataforma(); const r = await contestarDecision({ id: P1, accion: "responder", respuesta: "28 dólares" }, deps(p))
    expect(r.status).toBe(200)
    const post = p.llamadas.find((x) => x.metodo === "POST" && x.url.endsWith("/api/dueno/preguntas"))!
    expect(Object.keys(post.cuerpo!).sort()).toEqual(["accion", "canal", "client_id", "decidido_por", "mensaje_ref", "pregunta_id", "respondido_en", "respuesta", "workflow_execution_id", "workflow_id"])
  })
  it("descartar → «descartar» con motivo y quién (queda descartada; nada se borra)", async () => {
    const p = plataforma()
    const r = await contestarDecision({ id: P1, accion: "descartar", motivo: "ya no aplica" }, deps(p))
    expect(r.cuerpo).toMatchObject({ ok: true, sale: true, texto: "Descartada." })
    const post = p.llamadas.find((x) => x.metodo === "POST")!
    expect(post.url).toBe("https://plataforma.test/api/dueno/preguntas")
    expect(post.cuerpo).toEqual({ accion: "descartar", client_id: NAUFRAGO, pregunta_id: P1, motivo: "Emilio la descartó en Tu oficina: ya no aplica", decidido_por: "emilacho@hotmail.com", workflow_id: FLUJO_DE_TU_OFICINA, workflow_execution_id: "tablero:fijo" })
    expect(p.llamadas.some((x) => x.url.endsWith("/api/finanzas/responder"))).toBe(false)
    const ya = await contestarDecision({ id: P1, accion: "descartar" }, deps(plataforma({ dueno: [409, { ok: false, error: "ya_cerrada" }] })))
    expect(ya.cuerpo).toMatchObject({ ok: false, sale: false }); expect((ya.cuerpo as { motivo: string }).motivo).toMatch(/alguien la cerró antes/)
    const raro = await contestarDecision({ id: P1, accion: "descartar" }, deps(plataforma({ dueno: [200, { ok: true }] })))
    expect(raro.cuerpo).toMatchObject({ ok: false, sale: false })
  })
  it("firmar → la acción firmar-tablero con el tablero; si la plataforma no la acepta, se queda", async () => {
    const firmar = vi.fn(async () => ({ status: 200, cuerpo: { ok: true } }))
    const r = await contestarDecision({ id: T1, accion: "aceptar" }, deps(plataforma(), lecturas(D, sin(T1)), { firmar }))
    expect(r.cuerpo).toMatchObject({ ok: true, sale: true, texto: "Firmado." })
    expect(firmar).toHaveBeenCalledWith("firmar-tablero", { tablero_id: T1 }, expect.objectContaining({ revisor: "emilacho@hotmail.com" }))
    const no = vi.fn(async () => ({ status: 409, cuerpo: { ok: false, detalle: "otra decisión se tomó mientras tanto" } }))
    expect((await contestarDecision({ id: T1, accion: "aceptar" }, deps(plataforma(), lecturas(D), { firmar: no }))).cuerpo).toMatchObject({ ok: false, sale: false })
  })
  it("se busca de nuevo en el servidor: lo que ya no está → 409 «ya no está»; una acción que esa decisión no permite → 409; entrada vacía → 400", async () => {
    const p = plataforma()
    expect(await contestarDecision({ id: P1, accion: "responder", respuesta: "x" }, deps(p, lecturas(sin(P1))))).toMatchObject({ status: 409, cuerpo: { error: "ya_no_esta" } })
    expect(await contestarDecision({ id: T1, accion: "responder", respuesta: "x" }, deps(p))).toMatchObject({ status: 409, cuerpo: { error: "accion_no_permitida" } })
    expect(await contestarDecision({ id: P1, accion: "editar", cambio: { clave: "total_mes", firmado: 5 } }, deps(p))).toMatchObject({ status: 409 })
    expect(await contestarDecision({ id: P1, accion: "responder", respuesta: "  " }, deps(p))).toMatchObject({ status: 400 })
    expect(await contestarDecision({ id: P1, accion: "responder", respuesta: "x".repeat(2001) }, deps(p))).toMatchObject({ status: 400 })
    expect(p.llamadas.filter((x) => x.metodo === "POST")).toHaveLength(0)
  })
  it("si no se puede leer la lista de decisiones → 502 «no se hizo nada»: ninguna escritura, ni pausa ni cerebro ni firma (CC3 · mutante D14)", async () => {
    const p = plataforma(); const firmar = vi.fn()
    const caida = vi.fn(async () => ({ ok: false as const, error: "plataforma caída" }))
    for (const c of [{ id: P1, accion: "responder", respuesta: "28 dólares" }, { id: P1, accion: "descartar" }, { id: T1, accion: "aceptar" }]) {
      const r = await contestarDecision(c, deps(p, caida as never, { firmar }))
      expect(r).toMatchObject({ status: 502, cuerpo: { ok: false, error: "sin_lectura" } })
      expect(String((r.cuerpo as { detalle?: string }).detalle)).toContain("no se hizo nada")
    }
    expect(p.llamadas.filter((x) => x.metodo === "POST")).toHaveLength(0); expect(firmar).not.toHaveBeenCalled()
  })
  it("quién preguntó: lo lee del GET de la ruta de las preguntas; caída o sin «ok» = no se sabe (null)", async () => {
    const p = plataforma()
    const m = await quienPregunto({ plataformaUrl: "https://plataforma.test", llave: "k", fetchImpl: p.f }, NAUFRAGO)
    expect(m?.get(P1)).toEqual({ oficina: "financiera", agente: "jefe-financiero" })
    expect(p.llamadas[0].url).toBe(`https://plataforma.test/api/dueno/preguntas?client_id=${NAUFRAGO}`); expect(p.llamadas[0].metodo).toBe("GET")
    const sinOk = vi.fn(async () => new Response(JSON.stringify({ pendientes: [] }), { status: 200 })) as unknown as typeof fetch
    expect(await quienPregunto({ plataformaUrl: "https://p.test", llave: "k", fetchImpl: sinOk }, NAUFRAGO)).toBeNull()
    const caida = vi.fn(async () => new Response("x", { status: 502 })) as unknown as typeof fetch
    expect(await quienPregunto({ plataformaUrl: "https://p.test", llave: "k", fetchImpl: caida }, NAUFRAGO)).toBeNull()
  })
})

describe("nunca se firma a ciegas (CORRECCIÓN Lenovo 5-nov)", () => {
  const cruda = { id: T1, tipo: "firma_de_finanzas", subtipo: "tablero_sin_firma", fuente: "finanzas_tableros", client_id: NAUFRAGO, cliente: "Náufrago", titulo: "Tablero financiero: espera tu firma", desde: "2026-11-01T10:00:00Z", decidir: { ruta: null, accion: "firmar-tablero" } }
  const leida = (extra: Record<string, unknown> = {}) => normalizarDecisiones({ ok: true, completo: true, decisiones: [{ ...cruda, ...extra }], fuentes: [], sin_fuente: [] })
  const pantalla = (d: Decisiones) => renderToStaticMarkup(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: d })).replace(/<!-- -->/g, "")
  const cifra = { clave: "total_mes", nombre: "Presupuesto al mes", valor: 1341.27, unidad: "US$", nota: "Instagram y Facebook" }

  it("sin cifras: sin botón Firmar, dice qué falta y quién la debe, y sigue a la vista en «esperan por ti»", () => {
    const d = leida()
    expect(accionesDe(d.decisiones[0])).toEqual([])
    expect(gruposDeDecisiones(d).firma.map((x) => x.id)).toEqual([T1]); expect(gruposDeDecisiones(d).fuera).toEqual([])
    const html = pantalla(d)
    expect(html).not.toContain("data-firmar"); expect(html).toContain("data-falta-informacion"); expect(html).toContain("Oficina Financiera"); expect(html).toContain("Falta información")
    expect(html).not.toContain("data-sin-panel")
  })
  it("con cifras: se leen y se puede firmar", () => {
    const d = leida({ cifras: [cifra, { clave: "meta", nombre: "Meta", valor: 5, unidad: "ventas por semana" }], criticos: ["Dos hallazgos sin cerrar"] })
    expect(accionesDe(d.decisiones[0])).toEqual(["aceptar"])
    const html = pantalla(d)
    expect(html).toContain("data-firmar"); expect(html).not.toContain("data-falta-informacion")
    expect(html).toMatch(/data-numero-de-cifra[^>]*>1\.341,27<[\s\S]*?>US\$ Presupuesto al mes</); expect(html).toContain("Instagram y Facebook"); expect(html).toMatch(/data-numero-de-cifra[^>]*>5<[\s\S]*?>Meta · ventas por semana</); expect(html).toContain("Dos hallazgos sin cerrar") // 06-nov: el número solo y la unidad en el rótulo (imagen aprobada); la unidad nunca se pierde
    expect(html).not.toMatch(/data-pie="true" class="[^"]*sticky/) // Firmar no va fijo: se llega pasando por las cifras (CC6 · #283)
  })
  it("una cifra que no se puede leer no cuenta: sin ninguna buena, falta información", () => {
    const d = leida({ cifras: [{ clave: "x", nombre: "Sin valor" }, { clave: "y", nombre: "Texto", valor: "450" }, { nombre: "Sin clave", valor: 3 }, null] })
    expect(d.decisiones[0].cifras).toBeUndefined(); expect(accionesDe(d.decisiones[0])).toEqual([])
    expect(leida({ cifras: [] }).decisiones[0].cifras).toBeUndefined()
  })
  it("el servidor tampoco firma a ciegas, aunque le pidan firmar directo", async () => {
    const firmar = vi.fn(); const p = plataforma(); const d = leida()
    const r = await contestarDecision({ id: T1, accion: "aceptar" }, deps(p, lecturas(d), { firmar }))
    expect(r).toMatchObject({ status: 409, cuerpo: { ok: false, error: "falta_informacion" } })
    expect(String((r.cuerpo as { detalle?: string }).detalle)).toContain("No se firmó")
    expect(firmar).not.toHaveBeenCalled(); expect(p.llamadas.filter((x) => x.metodo === "POST")).toHaveLength(0)
  })
  it("una pregunta sin cifras se sigue contestando: la regla es de las firmas", () => {
    expect(accionesDe({ tipo: "pregunta_al_dueno", fuente: "cerebro_dueno_preguntas", subtipo: "tema" })).toEqual(["responder", "descartar"])
  })
})

describe("la pantalla (boceto aprobado)", () => {
  const conQuien: Decisiones = { ...D, decisiones: D.decisiones.map((x): Decision => (x.id === P1 ? { ...x, pregunta_de: { oficina: "financiera", agente: "jefe-financiero" } } : x)) }
  const html = renderToStaticMarkup(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: conQuien })).replace(/<!-- -->/g, "")
  it("la pregunta que detiene el plan va al frente, con quién pregunta, qué se destraba, la caja y sus dos acciones", () => {
    expect(html.match(/data-decision="([^"]+)"/)![1]).toBe(P1)
    expect(html).toContain("3 esperan por ti · 1 tiene un trabajo detenido")
    expect(html).toMatch(/data-recuadro="detienen"[^>]*>.*?>1<\/span>.*?>Detenidas</); expect(html).toContain('data-detiene="true"') // estilo base: el recuadro es el filtro · 09-nov ficha única (v7): «Detiene el plan» en alarma
    expect(html).toMatch(/>Departamento<\/dt><dd[^>]*><span data-departamento="true">Departamento de Finanzas<\/span>/) // estilo base: DEPARTAMENTO / su nombre oficial (Emilio 09-nov 23:29Z), nunca «Financiero»
    // 09-nov · ficha única (v7): sin corto de la oficina, «Desbloquea» se ve entero (nunca se recorta)
    expect(html).toContain('<span data-desbloquea="true"><span>El plan de 90 días de Náufrago sigue en cuanto contestes sus preguntas.</span></span>')
    expect(html).toContain("data-respuesta"); expect(html).toMatch(/data-verbo="responder"[^>]*>Responder</); expect(html).toContain('data-verbo="descartar"')
    expect(html).not.toContain("data-firmar"); expect(html).not.toContain("buzón de preguntas") // la tarjeta vieja de la pausa (Slack) no se repite
  })
  it("sin «se atienden fuera» y sin textos técnicos a la vista", () => {
    expect(html).not.toContain("fuera de este tablero"); expect(html).not.toMatch(/cerebro_dueno_preguntas|finanzas_tableros|tablero-tu-oficina|pregunta_id|workflow/)
  })
  it("la ruta: solo administrador, máximo de tiempo de la plataforma, y no escribe la base", () => {
    const src = readFileSync("app/api/direccion/decisiones/contestar/route.ts", "utf8")
    expect(src).toContain("const puerta = await exigirAdmin()"); expect(src).toContain("export const maxDuration = 800"); expect(src).not.toMatch(/supabase/i)
    const lib = readFileSync("lib/decisiones-contestar.ts", "utf8")
    expect(lib).not.toMatch(/supabase|\.from\(/); expect(lib).not.toMatch(/cerebro_dueno_preguntas/) // el cerebro solo por su puerta (regla de Cerebro)
  })
})
