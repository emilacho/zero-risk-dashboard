/**
 * CONDICIÓN A DE CC7 (#939/#940 · 06-nov): el tablero deja la tabla vieja y la puerta del cerebro para las preguntas al dueño.
 * Lee `dueno_preguntas` (la tabla de la plataforma) y contesta por `POST /api/dueno/preguntas`. US$ 0 · sin red.
 */
import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { guardarDatoDelDueno } from "@/lib/cerebro-dueno"
import { errorTrasGuardar, preguntaDesdeFila } from "@/lib/cerebro"

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
    const ya = await guardarDatoDelDueno({ client_id: C, tema: "t", respuesta: "abc", pregunta_id: P }, deps(plataforma([409, { ok: false, error: "ya_cerrada" }])))
    expect(ya).toMatchObject({ status: 409, cuerpo: { ok: false, error: "ya_cerrada" } })
    expect(errorTrasGuardar(409, ya.cuerpo)).toBe("Esa pregunta ya no estaba pendiente: alguien la cerró antes. Actualiza antes de volver a contestar.")
    expect(await guardarDatoDelDueno({ client_id: C, tema: "t", respuesta: "abc", pregunta_id: P }, deps(plataforma([404, {}])))).toMatchObject({ status: 501 })
    expect(await guardarDatoDelDueno({ client_id: C, tema: "t", respuesta: "abc", pregunta_id: P }, deps(plataforma([404, { error: "pregunta_inexistente" }])))).toMatchObject({ status: 404 })
    expect(await guardarDatoDelDueno({ client_id: C, tema: "t", respuesta: "abc", pregunta_id: P }, deps(plataforma([200, { ok: true }])))).toMatchObject({ status: 502 })
    expect(await guardarDatoDelDueno({ client_id: C, tema: "t", respuesta: "abc", pregunta_id: P }, deps(plataforma([502, { ok: false, error: "cerebro_no_guardo" }])))).toMatchObject({ status: 502, cuerpo: { ok: false } })
  })
  it("la ruta del Cerebro pasa la sesión como quien contestó", () => {
    expect(readFileSync("app/api/cerebro/dueno/route.ts", "utf8")).toContain("guardarDatoDelDueno(cuerpo, { revisor: puerta.email })")
  })
})

describe("las lecturas salen de la tabla de la plataforma", () => {
  it("🔴 el panel del Cerebro y la antena leen `dueno_preguntas`; ningún archivo del tablero nombra la tabla vieja", () => {
    expect(readFileSync("lib/cerebro-datos.ts", "utf8")).toContain(`supa.from("dueno_preguntas").select("id, tema, pregunta, canal, oficina, agente, creado_en, sede_clave")`)
    expect(readFileSync("lib/escena-avatares-datos.ts", "utf8")).toContain(`supa.from("dueno_preguntas").select("id, client_id, pregunta, estado, creado_en").eq("estado", "pendiente")`)
    for (const f of ["lib/cerebro-datos.ts", "lib/escena-avatares-datos.ts", "lib/decisiones-contestar.ts", "lib/cerebro-dueno.ts"]) expect(readFileSync(f, "utf8")).not.toContain('from("cerebro_dueno_preguntas")')
  })
  it("🔴 quién preguntó sale de las columnas nuevas (oficina, agente)", () => {
    expect(preguntaDesdeFila({ id: P, tema: "t", pregunta: "¿?", oficina: "financiera", agente: "jefe-financiero", canal: "x", creado_en: "2026-11-06", sede_clave: null })).toMatchObject({ oficina: "financiera", agente: "jefe-financiero" })
  })
})
