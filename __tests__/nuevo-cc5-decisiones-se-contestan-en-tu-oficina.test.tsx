/**
 * 04-nov · TU OFICINA › DECISIONES SE CONTESTAN AHÍ (encargo `2026-11-04-ENCARGO-LENOVO-a-CC5-decisiones-se-contestan-en-tu-oficina.md` + adendas · boceto aprobado por Emilio 18:08Z).
 * Contratos: Cerebro (`POST /api/brain/alimentar/dueno` · respuesta / descartar) · CC1 #897 (`POST /api/finanzas/responder`, primero) · `firmar-tablero`.
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
    { ...base, id: T1, tipo: "firma_de_finanzas", subtipo: "tablero_sin_firma", fuente: "finanzas_tableros", titulo: "Tablero financiero: espera tu firma", desde: "2026-11-01T10:00:00Z", decidir: { ruta: null, accion: "firmar-tablero" } },
    { ...base, id: E1, tipo: "pregunta_de_finanzas", subtipo: "plan_en_pausa", fuente: "esperas_del_dueno", titulo: "El plan está en pausa: la oficina financiera espera tus respuestas en el buzón de preguntas" },
    { ...base, id: P1, tipo: "pregunta_al_dueno", subtipo: "ticket promedio", fuente: "cerebro_dueno_preguntas", titulo: "¿Cuánto gasta en promedio una mesa?", titulo_interno: "¿Cuánto gasta en promedio una mesa, en un día normal?" },
    { ...base, id: P2, tipo: "pregunta_al_dueno", subtipo: "mesas urdesa", fuente: "cerebro_dueno_preguntas", titulo: "¿Cuántas mesas tiene la sede de Urdesa?", client_id: "55555555-5555-4555-8555-555555555555", cliente: "Otro cliente" },
  ],
}
const D = normalizarDecisiones(CRUDO)
const sin = (...ids: string[]): Decisiones => ({ ...D, decisiones: D.decisiones.filter((x) => !ids.includes(x.id)) })

/** la plataforma de mentira: responde según ruta y método, y anota todo */
function plataforma(r: { pausa?: [number, Record<string, unknown>]; dueno?: [number, Record<string, unknown>]; pendientes?: unknown[] } = {}) {
  const llamadas: Array<{ url: string; metodo: string; cuerpo: Record<string, unknown> | null; llave: string | null }> = []
  const f = vi.fn(async (url: string, init: RequestInit) => {
    const cuerpo = init.body ? JSON.parse(String(init.body)) : null
    llamadas.push({ url, metodo: String(init.method), cuerpo, llave: (init.headers as Record<string, string>)["x-api-key"] ?? null })
    const res = (s: number, j: unknown) => new Response(JSON.stringify(j), { status: s })
    if (url.includes("/api/brain/alimentar/dueno?")) return res(200, { ok: true, pendientes: r.pendientes ?? [{ pregunta_id: P1, tema: "ticket promedio", oficina: "financiera", agente: "jefe-financiero" }] })
    if (url.endsWith("/api/finanzas/responder")) { const [s, j] = r.pausa ?? [200, { en_pausa: false }]; return res(s, j) }
    if (url.endsWith("/api/brain/alimentar/dueno")) { const [s, j] = r.dueno ?? [200, { ok: true, guardada: true }]; return res(s, j) }
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

describe("responder · primero la pausa de finanzas, después la puerta del dueño (nunca las dos)", () => {
  it("no es de la pausa → la puerta del dueño recibe la forma exacta de Cerebro; sale porque la fila dejó de estar pendiente", async () => {
    const p = plataforma()
    const r = await contestarDecision({ id: P1, accion: "responder", respuesta: "Unos 28 dólares por mesa" }, deps(p))
    expect(r.status).toBe(200); expect(r.cuerpo).toMatchObject({ ok: true, sale: true, texto: "Contestada." })
    const [pausa, dueno] = p.llamadas.filter((x) => x.metodo === "POST")
    expect(pausa.url).toBe("https://plataforma.test/api/finanzas/responder"); expect(pausa.cuerpo).toEqual({ client_id: NAUFRAGO, tema: "ticket promedio", respuesta: "Unos 28 dólares por mesa", quien: "emilacho@hotmail.com" })
    expect(dueno.url).toBe("https://plataforma.test/api/brain/alimentar/dueno")
    expect(dueno.cuerpo).toEqual({
      evento: "respuesta", client_id: NAUFRAGO, pregunta_id: P1, tema: "ticket promedio", pregunta: "¿Cuánto gasta en promedio una mesa, en un día normal?", respuesta: "Unos 28 dólares por mesa",
      canal: CANAL_DE_TU_OFICINA, mensaje_ref: `oficina:${P1}`, respondido_en: "2026-11-04T16:52:00.000Z", preguntado_por: { oficina: "financiera", agente: "jefe-financiero" },
      dry_run: false, workflow_id: FLUJO_DE_TU_OFICINA, workflow_execution_id: "tablero:fijo",
    })
    expect(CANAL_DE_TU_OFICINA).toBe("dashboard · Tu oficina")
    expect(p.llamadas.every((x) => x.llave === "secreta")).toBe(true); expect(JSON.stringify(r)).not.toContain("secreta")
    const reg = (r.cuerpo as { registro: Array<{ estado: string; cita?: string }> }).registro
    expect(reg.map((x) => x.estado)).toEqual(["pregunto", "respondiste", "guardado"]); expect(reg[1].cita).toBe("Unos 28 dólares por mesa")
  })
  it("es de la pausa → la pausa ya la guardó en el cerebro: NO se llama a la puerta del dueño; dice cuándo sigue el plan", async () => {
    const p = plataforma({ pausa: [200, { en_pausa: true, es_de_la_pausa: true, aplicada: true, en_el_cerebro: true, faltan: ["mesas"] }] })
    const r = await contestarDecision({ id: P1, accion: "responder", respuesta: "28" }, deps(p))
    expect(r.cuerpo).toMatchObject({ ok: true, sale: true })
    expect(p.llamadas.filter((x) => x.url.endsWith("/api/brain/alimentar/dueno"))).toHaveLength(0)
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
    expect(r.cuerpo).toMatchObject({ ok: false, sale: false }); expect(p.llamadas.filter((x) => x.url.endsWith("/api/brain/alimentar/dueno"))).toHaveLength(0)
  })
  it("si la ruta de la pausa todavía no existe (404), sigue por la puerta del dueño", async () => {
    const p = plataforma({ pausa: [404, {}] })
    expect((await contestarDecision({ id: P1, accion: "responder", respuesta: "28" }, deps(p))).cuerpo).toMatchObject({ ok: true, sale: true })
    expect(p.llamadas.filter((x) => x.url.endsWith("/api/brain/alimentar/dueno"))).toHaveLength(1)
  })
  it("sin saber qué oficina preguntó no se guarda (el cerebro lo exige): falla visible, ninguna escritura", async () => {
    const p = plataforma({ pendientes: [] })
    const r = await contestarDecision({ id: P1, accion: "responder", respuesta: "28" }, deps(p))
    expect(r.cuerpo).toMatchObject({ ok: false, sale: false }); expect((r.cuerpo as { motivo: string }).motivo).toMatch(/qué oficina/)
    expect(p.llamadas.filter((x) => x.url.endsWith("/api/brain/alimentar/dueno"))).toHaveLength(0)
  })
  it("si la puerta rechaza, la tarjeta se queda con el motivo", async () => {
    const r = await contestarDecision({ id: P1, accion: "responder", respuesta: "28" }, deps(plataforma({ dueno: [400, { error: "entrada_invalida", detalle: "`tema` va hasta 80" }] })))
    expect(r.cuerpo).toMatchObject({ ok: false, sale: false }); expect((r.cuerpo as { motivo: string }).motivo).toContain("`tema` va hasta 80")
    const apagada = await contestarDecision({ id: P1, accion: "responder", respuesta: "28" }, deps(plataforma({ dueno: [200, { apagado: true }] })))
    expect(apagada.cuerpo).toMatchObject({ ok: false, sale: false })
  })
  it("se guardó pero la fila sigue pendiente → no se dice «salió» (una sola fuente de verdad)", async () => {
    const r = await contestarDecision({ id: P1, accion: "responder", respuesta: "28" }, deps(plataforma(), lecturas(D, D)))
    expect(r.cuerpo).toMatchObject({ ok: true, sale: false }); expect((r.cuerpo as { motivo: string }).motivo).toMatch(/sigue abierta/)
  })
})

describe("descartar y firmar", () => {
  it("descartar → evento «descartar» con motivo (queda obsoleta; nada se borra)", async () => {
    const p = plataforma({ dueno: [200, { ok: true, descartadas: 1 }] })
    const r = await contestarDecision({ id: P1, accion: "descartar", motivo: "ya no aplica" }, deps(p))
    expect(r.cuerpo).toMatchObject({ ok: true, sale: true, texto: "Descartada." })
    const post = p.llamadas.find((x) => x.metodo === "POST")!
    expect(post.cuerpo).toEqual({ evento: "descartar", client_id: NAUFRAGO, pregunta_id: P1, motivo: "Emilio la descartó en Tu oficina: ya no aplica", dry_run: false, workflow_id: FLUJO_DE_TU_OFICINA, workflow_execution_id: "tablero:fijo" })
    expect(p.llamadas.some((x) => x.url.endsWith("/api/finanzas/responder"))).toBe(false)
    const nada = await contestarDecision({ id: P1, accion: "descartar" }, deps(plataforma({ dueno: [200, { ok: true, descartadas: 0 }] })))
    expect(nada.cuerpo).toMatchObject({ ok: false, sale: false })
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
    expect(await contestarDecision({ id: P1, accion: "editar", respuesta: "x" }, deps(p))).toMatchObject({ status: 409 })
    expect(await contestarDecision({ id: P1, accion: "responder", respuesta: "  " }, deps(p))).toMatchObject({ status: 400 })
    expect(await contestarDecision({ id: P1, accion: "responder", respuesta: "x".repeat(2001) }, deps(p))).toMatchObject({ status: 400 })
    expect(p.llamadas.filter((x) => x.metodo === "POST")).toHaveLength(0)
  })
  it("quién preguntó: lo lee de la puerta del dueño; apagada o caída = no se sabe (null)", async () => {
    const m = await quienPregunto({ plataformaUrl: "https://plataforma.test", llave: "k", fetchImpl: plataforma().f }, NAUFRAGO)
    expect(m?.get(P1)).toEqual({ oficina: "financiera", agente: "jefe-financiero" })
    const apagada = vi.fn(async () => new Response(JSON.stringify({ apagado: true }), { status: 200 })) as unknown as typeof fetch
    expect(await quienPregunto({ plataformaUrl: "https://p.test", llave: "k", fetchImpl: apagada }, NAUFRAGO)).toBeNull()
  })
})

describe("la pantalla (boceto aprobado)", () => {
  const conQuien: Decisiones = { ...D, decisiones: D.decisiones.map((x): Decision => (x.id === P1 ? { ...x, pregunta_de: { oficina: "financiera", agente: "jefe-financiero" } } : x)) }
  const html = renderToStaticMarkup(createElement(PanelDecisiones, { onCerrar: () => {}, datosIniciales: conQuien })).replace(/<!-- -->/g, "")
  it("la pregunta que detiene el plan va al frente, con quién pregunta, qué se destraba, la caja y sus dos acciones", () => {
    expect(html.match(/data-decision="([^"]+)"/)![1]).toBe(P1)
    expect(html).toContain("3 esperan por ti · 1 tiene un trabajo detenido")
    expect(html).toContain("data-detienen"); expect(html).toContain("Detienen un trabajo"); expect(html).toContain('data-chip="detiene"')
    expect(html).toContain("Pregunta la <b"); expect(html).toContain("Oficina financiera</b>")
    expect(html).toContain("El plan de 90 días de Náufrago sigue en cuanto contestes sus preguntas.")
    expect(html).toContain("data-respuesta"); expect(html).toContain("Enviar respuesta"); expect(html).toContain("data-descartar-abrir")
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
