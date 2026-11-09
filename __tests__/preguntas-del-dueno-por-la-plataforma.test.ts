/**
 * CONDICIÓN A DE CC7 (#939/#940 · 06-nov): el tablero deja la tabla vieja y la puerta del cerebro para las preguntas al dueño.
 * Lee `dueno_preguntas` (la tabla de la plataforma) y contesta por `POST /api/dueno/preguntas`. US$ 0 · sin red.
 */
import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { guardarDatoDelDueno } from "@/lib/cerebro-dueno"
import { errorTrasGuardar, preguntaDesdeFila, textoTrasGuardar } from "@/lib/cerebro"

const C = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", P = "11111111-1111-4111-8111-111111111111"
const AHORA = new Date("2026-11-06T15:00:00Z")
function plataforma(ruta: [number, unknown] = [200, { ok: true, guardada: true, ficha_ref: "f1", preguntas_cerradas: 1 }]) {
  const llamadas: Array<{ url: string; cuerpo: Record<string, unknown> }> = []
  const f = vi.fn(async (url: string, init: RequestInit) => {
    llamadas.push({ url, cuerpo: JSON.parse(String(init.body)) })
    if (url.endsWith("/api/dueno/preguntas")) return new Response(JSON.stringify(ruta[1]), { status: ruta[0] })
    return new Response(JSON.stringify({ ok: true, guardada: true, ficha_id: "fp" }), { status: 200 })
  })
  return { f: f as unknown as typeof fetch, llamadas }
}
const deps = (p: ReturnType<typeof plataforma>) => ({ plataformaUrl: "https://p.test", llave: "k", fetchImpl: p.f, ahora: AHORA, revisor: "emilacho@hotmail.com" })

describe("el Cerebro contesta una pregunta pendiente por la ruta de la plataforma", () => {
  it("🔴 con pregunta_id → POST /api/dueno/preguntas «responder» con quién contestó; nunca la puerta del cerebro", async () => {
    const p = plataforma()
    const r = await guardarDatoDelDueno({ client_id: C, tema: "ticket promedio", respuesta: "28 dólares", pregunta_id: P }, deps(p))
    expect(r.status).toBe(200); expect(r.cuerpo).toMatchObject({ ok: true, guardada: true, ficha_id: "f1", preguntas_cerradas: 1 })
    expect(p.llamadas).toHaveLength(1); expect(p.llamadas[0].url).toBe("https://p.test/api/dueno/preguntas")
    expect(p.llamadas[0].cuerpo).toMatchObject({ accion: "responder", client_id: C, pregunta_id: P, respuesta: "28 dólares", decidido_por: "emilacho@hotmail.com", canal: "dashboard · cerebro", workflow_id: "dashboard-cerebro" })
    expect(String(p.llamadas[0].cuerpo.workflow_execution_id)).toMatch(/^dashboard:cerebro:/)
    expect(p.llamadas[0].cuerpo).not.toHaveProperty("evento")
  })
  it("🔴 sin pregunta (un dato suelto del dueño) → sigue por la puerta del cerebro, como siempre", async () => {
    const p = plataforma()
    const r = await guardarDatoDelDueno({ client_id: C, tema: "horario", respuesta: "abre a las 12" }, deps(p))
    expect(r.cuerpo).toMatchObject({ ok: true, ficha_id: "fp" })
    expect(p.llamadas.map((x) => x.url)).toEqual(["https://p.test/api/brain/alimentar/dueno"])
  })
  it("🔴 409 (otro la cerró antes) se dice tal cual; 404 sin error = la ruta todavía no existe; ok sin «guardada» no es éxito", async () => {
    // CC7 · 409 antes de guardar: la palabra de Emilio va como dato suelto (sin pregunta) por la puerta del cerebro
    const p1 = plataforma([409, { ok: false, error: "ya_cerrada", detalle: "la pregunta ya está «respondida»" }])
    const suelto = await guardarDatoDelDueno({ client_id: C, tema: "t", respuesta: "abc", pregunta_id: P }, deps(p1))
    expect(suelto).toMatchObject({ status: 200, cuerpo: { ok: true, ficha_id: "fp", pregunta_ya_cerrada: true } })
    expect(p1.llamadas.map((x) => x.url)).toEqual(["https://p.test/api/dueno/preguntas", "https://p.test/api/brain/alimentar/dueno"])
    expect(p1.llamadas[1].cuerpo).not.toHaveProperty("pregunta_id"); expect(p1.llamadas[1].cuerpo).toMatchObject({ evento: "respuesta", tema: "t", respuesta: "abc" })
    expect(textoTrasGuardar(suelto.cuerpo)).toBe("La pregunta ya la había cerrado otro, pero tu dato quedó guardado en el cerebro")
    // 409 con la respuesta ya en el cerebro: no se repite
    const p2 = plataforma([409, { ok: false, error: "ya_cerrada", detalle: "la respuesta quedó en el cerebro, pero otro cerró la pregunta antes" }])
    expect(await guardarDatoDelDueno({ client_id: C, tema: "t", respuesta: "abc", pregunta_id: P }, deps(p2))).toMatchObject({ status: 200, cuerpo: { ok: true, pregunta_ya_cerrada: true } })
    expect(p2.llamadas).toHaveLength(1)
    // 409 y la puerta también falla: se dice
    const f3 = (async (url: string) => new Response(JSON.stringify(url.endsWith("/api/dueno/preguntas") ? { ok: false, error: "ya_cerrada", detalle: "ya está" } : { ok: false, error: "x" }), { status: url.endsWith("/api/dueno/preguntas") ? 409 : 500 })) as unknown as typeof fetch
    const ya = await guardarDatoDelDueno({ client_id: C, tema: "t", respuesta: "abc", pregunta_id: P }, { ...deps(p2), fetchImpl: f3 })
    expect(ya).toMatchObject({ status: 409, cuerpo: { ok: false, error: "ya_cerrada" } })
    expect(errorTrasGuardar(409, ya.cuerpo)).toBe("Esa pregunta ya no estaba pendiente: alguien la cerró antes. Actualiza antes de volver a contestar.")
    // CC6 · un 404 de la ruta nueva dice que la pregunta ya no existe (no «ese cliente»)
    expect(errorTrasGuardar(404, { error: "pregunta_inexistente" })).toBe("Esa pregunta ya no existe: actualiza para ver lo que esperan del dueño.")
    expect(errorTrasGuardar(404, {})).toBe("Ese cliente no existe en la plataforma: no se guardó nada.")
    expect(await guardarDatoDelDueno({ client_id: C, tema: "t", respuesta: "abc", pregunta_id: P }, deps(plataforma([404, {}])))).toMatchObject({ status: 501 })
    expect(await guardarDatoDelDueno({ client_id: C, tema: "t", respuesta: "abc", pregunta_id: P }, deps(plataforma([404, { error: "pregunta_inexistente" }])))).toMatchObject({ status: 404 })
    expect(await guardarDatoDelDueno({ client_id: C, tema: "t", respuesta: "abc", pregunta_id: P }, deps(plataforma([200, { ok: true }])))).toMatchObject({ status: 502 })
    expect(await guardarDatoDelDueno({ client_id: C, tema: "t", respuesta: "abc", pregunta_id: P }, deps(plataforma([502, { ok: false, error: "cerebro_no_guardo" }])))).toMatchObject({ status: 502, cuerpo: { ok: false } })
  })
  it("la ruta del Cerebro pasa la sesión como quien contestó", () => {
    expect(readFileSync("app/api/cerebro/dueno/route.ts", "utf8")).toContain("guardarDatoDelDueno(cuerpo, { revisor: puerta.email })")
  })
})

describe("quién contestó nunca va vacío (CC1 06-nov: la ruta da 400 sin «decidido_por»)", () => {
  it("🔴 Decisiones y Cerebro ponen «emilio» si la sesión no trae correo", async () => {
    const { contestarDecision } = await import("@/lib/decisiones-contestar")
    const { normalizarDecisiones } = await import("@/lib/direccion-decisiones")
    const D = normalizarDecisiones({ ok: true, completo: true, fuentes: [], sin_fuente: [], decisiones: [{ id: P, tipo: "pregunta_al_dueno", subtipo: "t", fuente: "dueno_preguntas", titulo: "¿?", client_id: C, cliente: "N", desde: null, vence: null, vencida: false, prioridad: null, decidir: { ruta: null, accion: null }, costo_usd: null, costo_nota: null }] })
    for (const accion of ["responder", "descartar"]) {
      const cuerpos: Record<string, unknown>[] = []
      const f = (async (url: string, init: RequestInit) => { if (url.endsWith("/api/dueno/preguntas")) cuerpos.push(JSON.parse(String(init.body))); return new Response(JSON.stringify(url.endsWith("/api/finanzas/responder") ? { en_pausa: false } : { ok: true, guardada: true, descartada: true }), { status: 200 }) }) as unknown as typeof fetch
      await contestarDecision({ id: P, accion, respuesta: "abc", motivo: "x" }, { plataformaUrl: "https://p.test", llave: "k", fetchImpl: f, revisor: "", leer: async () => ({ ok: true as const, datos: D }), ahora: () => AHORA, id: () => "i" })
      expect(cuerpos[0]?.decidido_por).toBe("emilio")
    }
    const p = plataforma(); await guardarDatoDelDueno({ client_id: C, tema: "t", respuesta: "abc", pregunta_id: P }, { ...deps(p), revisor: "" })
    expect(p.llamadas[0].cuerpo.decidido_por).toBe("emilio")
    expect(readFileSync("app/api/direccion/decisiones/contestar/route.ts", "utf8")).toContain('{ revisor: puerta.email || "emilio" }')
  })
})

describe("las lecturas salen de la tabla de la plataforma", () => {
  it("🔴 el panel del Cerebro y la antena leen `dueno_preguntas`; ningún archivo del tablero nombra la tabla vieja", () => {
    expect(readFileSync("lib/cerebro-datos.ts", "utf8")).toContain(`supa.from("dueno_preguntas").select("id, tema, pregunta, canal, oficina, agente, creado_en, sede_clave")`)
    expect(readFileSync("lib/escena-avatares-datos.ts", "utf8")).toContain(`supa.from("dueno_preguntas").select("id, client_id, pregunta, estado, creado_en, oficina").eq("estado", "pendiente")`)
    for (const f of ["lib/cerebro-datos.ts", "lib/escena-avatares-datos.ts", "lib/decisiones-contestar.ts", "lib/cerebro-dueno.ts"]) expect(readFileSync(f, "utf8")).not.toContain('from("cerebro_dueno_preguntas")')
  })
  it("🔴 CC6 · el panel del Cerebro muestra solo las pendientes: una respondida o descartada no aparece", async () => {
    const { leerCerebroDelCliente } = await import("@/lib/cerebro-datos")
    const filas = [{ id: P, client_id: C, tema: "t", pregunta: "¿pendiente?", oficina: "o", agente: "a", canal: "c", creado_en: "2026-11-06", sede_clave: null, estado: "pendiente" },
      { id: "22222222-2222-4222-8222-222222222222", client_id: C, tema: "t2", pregunta: "¿respondida?", oficina: "o", agente: "a", canal: "c", creado_en: "2026-11-06", sede_clave: null, estado: "respondida" }]
    const vistas: string[] = []
    // base de mentira que SÍ aplica los filtros .eq, para que quitar el de «pendiente» se note
    const consulta = (tabla: string) => {
      let rs: Record<string, unknown>[] = tabla === "dueno_preguntas" ? filas : tabla === "clients" ? [{ id: C, name: "N", slug: "n" }] : []
      const q: Record<string, unknown> = {}
      for (const m of ["select", "order", "limit", "in", "not", "is", "gte", "lte", "neq", "ilike", "or", "range"]) q[m] = () => q
      q.eq = (col: string, v: unknown) => { rs = rs.filter((r) => !(col in r) || r[col] === v); return q }
      q.maybeSingle = () => Promise.resolve({ data: rs[0] ?? null, error: null }); q.single = q.maybeSingle
      q.then = (ok: (x: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve({ data: rs, error: null, count: rs.length }).then(ok, ko)
      vistas.push(tabla); return q
    }
    const r = await leerCerebroDelCliente({ from: consulta } as never, { cliente: C }).catch((e: unknown) => ({ error: String(e) }))
    expect(vistas).toContain("dueno_preguntas")
    const preguntas = (r as { preguntas?: Array<{ pregunta: string }> }).preguntas ?? (r as { datos?: { preguntas?: Array<{ pregunta: string }> } }).datos?.preguntas
    expect(preguntas?.map((x) => x.pregunta)).toEqual(["¿pendiente?"])
  })
  it("🔴 quién preguntó sale de las columnas nuevas (oficina, agente)", () => {
    expect(preguntaDesdeFila({ id: P, tema: "t", pregunta: "¿?", oficina: "financiera", agente: "jefe-financiero", canal: "x", creado_en: "2026-11-06", sede_clave: null })).toMatchObject({ oficina: "financiera", agente: "jefe-financiero" })
  })
})
