/**
 * CC6 · 01-nov · los botones del ciclo del plan (ENCARGO Lenovo firmado por Emilio · contrato certificado de CC1 §2 + ADENDA 1).
 * «Aprobar el plan así» → `plan-aprobar` (US$ 0) · «Pedir cambios al plan» → `plan-cambios` (GASTA: confirmo_gasto + tope ≤ 8). Botones grandes para TODO plan,
 * estados a la vista, respuestas de la puerta en palabras, solo la versión vigente con su historial, y «aún no disponible» dicho mientras el ciclo no exista.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import {
  TOPE_REESCRITURA_USD, avanceDelPedido, inicioSujetoAReanudar, nombreDelTramo, separarEsperas, queCambioDelTexto, type AvanceCrudo, cuerpoDeAprobar, cuerpoDePedirCambios, leerElCiclo, palabrasDeLaRespuesta, versionDelTag, type CicloDelPlan,
} from "@/lib/plan"
import { leerPlanDelCliente, type PlanDelCliente } from "@/lib/plan-datos"
import { enviarAlCiclo } from "@/lib/plan-ciclo"
import { ACCIONES, ejecutarAccion } from "@/lib/tablero-acciones"
import { PanelPlan } from "@/components/nuevo/PanelPlan"
import { faseActiva } from "@/lib/pizarron"

const PLAN = "3dfcc12f-993e-478a-b884-f7df45ceaf77"
const PLAN_V2 = "6b1d2a40-1111-4c22-8d33-5e6f7a8b9c0d"
const CLIENTE = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const CAMPANA = "c0c0c0c0-1111-4222-8333-444455556666"
const base: CicloDelPlan = { disponible: true, version: 1, historial: [], con_compuerta: false, compuerta: null, pedido: null, avance: null }

describe("CC6 · el estado del ciclo del plan", () => {
  it("cada estado sale de lo real: aprobado · reescribiendo · en revisión · esperando tu decisión (con sus botones)", () => {
    expect(leerElCiclo("approved", base)).toMatchObject({ estado: "aprobado", titulo: "Aprobado → pasa al brief", puede_aprobar: false, puede_pedir_cambios: false, reintentar: null })
    expect(leerElCiclo("draft", { ...base, compuerta: { estado: "aprobado", decidido_por: "emilio", decidido_en: "2026-11-01T15:00:00Z", despertado: true, despertar_detalle: null } }).detalle).toContain("aprobado por emilio")
    const re = leerElCiclo("draft", { ...base, version: 2, con_compuerta: true, compuerta: { estado: "cambios_pedidos", decidido_por: null, decidido_en: null, despertado: true, despertar_detalle: null }, pedido: { id: "p", estado: "en_reescritura", texto: "Sube la meta a 130", vuelta: 2, despertado: true, despertar_detalle: null } })
    expect(re).toMatchObject({ estado: "reescribiendo", titulo: "Reescribiendo", puede_aprobar: false, puede_pedir_cambios: false }); expect(re.detalle).toContain("vuelta 2 de 3")
    expect(leerElCiclo("draft", { ...base, con_compuerta: true })).toMatchObject({ estado: "en_revision", titulo: "En revisión", puede_aprobar: false, puede_pedir_cambios: false }) // la jefatura sigue: sin botones
    const espera = leerElCiclo("draft", { ...base, con_compuerta: true, compuerta: { estado: "pendiente", decidido_por: null, decidido_en: null, despertado: null, despertar_detalle: null } })
    expect(espera).toMatchObject({ estado: "esperando_decision", titulo: "Esperando tu decisión", puede_aprobar: true, puede_pedir_cambios: true, avisos: [] })
  })
  it("plan de antes del ciclo, versión 4 (3 reescrituras), ciclo aún no abierto y llamadas que no despertaron: todo se dice", () => {
    expect(leerElCiclo("draft", base).avisos.join(" ")).toContain("de antes del ciclo")
    const tope = leerElCiclo("draft", { ...base, version: 4, con_compuerta: true, compuerta: { estado: "pendiente", decidido_por: null, decidido_en: null, despertado: null, despertar_detalle: null } })
    expect(tope).toMatchObject({ puede_aprobar: true, puede_pedir_cambios: false }); expect(tope.avisos.join(" ")).toContain("Ya van 3 reescrituras")
    expect(leerElCiclo("draft", { ...base, disponible: false }).avisos[0]).toContain("El ciclo del plan se abre pronto")
    expect(leerElCiclo("draft", { ...base, pedido: { id: "p", estado: "pendiente", texto: "x", vuelta: 1, despertado: false, despertar_detalle: "sin llave de despacho" } })).toMatchObject({ reintentar: "plan-cambios" })
    expect(leerElCiclo("draft", { ...base, compuerta: { estado: "aprobado", decidido_por: null, decidido_en: null, despertado: false, despertar_detalle: null } })).toMatchObject({ estado: "aprobado", reintentar: "plan-aprobar" })
  })
  it("la versión y la vigencia salen del provenance_tag (contrato: versión ausente = 1)", () => {
    expect(versionDelTag({})).toEqual({ version: 1, vigente: true, reemplaza_a: null, superseded_por: null, con_compuerta: false })
    expect(versionDelTag({ version: 3, vigente: true, reemplaza_a: PLAN, compuerta: true })).toMatchObject({ version: 3, vigente: true, reemplaza_a: PLAN, con_compuerta: true })
    expect(versionDelTag({ version: 2, vigente: false })).toMatchObject({ vigente: false })
    expect(versionDelTag({ superseded_por: PLAN_V2 })).toMatchObject({ vigente: false, superseded_por: PLAN_V2 })
  })
})

describe("CC6 · los cuerpos de las dos puertas y su validación en el servidor del tablero", () => {
  it("pedir cambios lleva el texto (5–4.000), la confirmación del gasto y el tope ≤ 8; aprobar, el comentario opcional", () => {
    expect(cuerpoDePedirCambios(PLAN, "  Sube la meta a 130 visitas  ")).toEqual({ plan_id: PLAN, texto: "Sube la meta a 130 visitas", confirmo_gasto: true, tope_usd: TOPE_REESCRITURA_USD })
    expect(TOPE_REESCRITURA_USD).toBeLessThanOrEqual(8)
    expect(cuerpoDePedirCambios(PLAN, "no")).toEqual({ error: "Cuenta qué debe cambiar (al menos 5 caracteres)" })
    expect(cuerpoDePedirCambios(PLAN, "x".repeat(4001))).toEqual({ error: "Máximo 4.000 caracteres" })
    expect(cuerpoDePedirCambios("no-es-uuid", "Sube la meta")).toHaveProperty("error")
    expect(cuerpoDeAprobar(PLAN, "")).toEqual({ plan_id: PLAN }); expect(cuerpoDeAprobar(PLAN, " ok ")).toEqual({ plan_id: PLAN, comentario: "ok" }); expect(cuerpoDeAprobar(PLAN, "x".repeat(1001))).toEqual({ error: "Máximo 1.000 caracteres" })
  })
  it("el servidor del tablero acepta la forma nueva (plan_id) y exige confirmación y tope; la vieja (campana_id) queda igual que antes", () => {
    const ok = ACCIONES["plan-cambios"].validar(cuerpoDePedirCambios(PLAN, "Sube la meta a 130") as Record<string, unknown>)
    expect(ok).toEqual({ ok: true, cuerpo: { plan_id: PLAN, texto: "Sube la meta a 130", confirmo_gasto: true, tope_usd: 8 } })
    expect(ACCIONES["plan-cambios"].validar({ plan_id: PLAN, texto: "Sube la meta a 130", tope_usd: 8 })).toMatchObject({ ok: false, error: "falta_confirmar_gasto" }) // sin confirmar no gasta
    expect(ACCIONES["plan-cambios"].validar({ plan_id: PLAN, texto: "Sube la meta a 130", confirmo_gasto: true, tope_usd: 9 })).toMatchObject({ ok: false })
    expect(ACCIONES["plan-cambios"].validar({ plan_id: PLAN, texto: "Sube la meta a 130", confirmo_gasto: true })).toMatchObject({ ok: false })
    expect(ACCIONES["plan-aprobar"].validar({ plan_id: PLAN, comentario: "va" })).toEqual({ ok: true, cuerpo: { plan_id: PLAN, comentario: "va" } })
    // la ficha del cliente del tablero de siempre (app/clientes) sigue mandando campana_id y se valida como antes
    expect(ACCIONES["plan-aprobar"].validar({ campana_id: CAMPANA })).toEqual({ ok: true, cuerpo: { campana_id: CAMPANA } })
    expect(ACCIONES["plan-cambios"].validar({ campana_id: CAMPANA, comentario: "cambia esto" })).toEqual({ ok: true, cuerpo: { campana_id: CAMPANA, comentario: "cambia esto" } })
  })
  it("la puerta llama a la plataforma con el contrato exacto (plan_id, texto, confirmo_gasto, tope_usd, reviewer, origen) y la llave interna", async () => {
    const llamadas: Array<{ url: string; cuerpo: Record<string, unknown>; llave: string | null }> = []
    const fetchFalso = (async (url: string, init: RequestInit) => {
      llamadas.push({ url, cuerpo: JSON.parse(String(init.body)), llave: new Headers(init.headers).get("x-api-key") })
      return new Response(JSON.stringify({ ok: true, plan_cambio_id: "pc", plan_id: PLAN, vuelta: 1, version_nueva: 2, vueltas_restantes: 2, tope_usd: 8, estado: "pendiente", despertado: true }), { status: 200 })
    }) as unknown as typeof fetch
    const r = await ejecutarAccion("plan-cambios", cuerpoDePedirCambios(PLAN, "Sube la meta a 130"), { revisor: "emilio", plataformaUrl: "https://plataforma.test", llave: "llave-de-prueba", fetchImpl: fetchFalso })
    expect(r.status).toBe(200)
    expect(llamadas).toEqual([{ url: "https://plataforma.test/api/tablero/plan-cambios", cuerpo: { plan_id: PLAN, texto: "Sube la meta a 130", confirmo_gasto: true, tope_usd: 8, reviewer: "emilio", origen: "dashboard" }, llave: "llave-de-prueba" }])
    expect(palabrasDeLaRespuesta("plan-cambios", r.status, r.cuerpo).texto).toBe("Pedido enviado (vuelta 1 de 3): el jefe de marketing reescribe la versión 2 y la jefatura la revisa.")
    // la plataforma responde 409 plan_en_revision → en palabras, sin código crudo
    const conflicto = (async () => new Response(JSON.stringify({ ok: false, error: "plan_en_revision" }), { status: 409 })) as unknown as typeof fetch
    const r2 = await ejecutarAccion("plan-aprobar", cuerpoDeAprobar(PLAN, ""), { revisor: "emilio", plataformaUrl: "https://p.test", llave: "k", fetchImpl: conflicto })
    expect(r2.status).toBe(409)
    expect(palabrasDeLaRespuesta("plan-aprobar", r2.status, r2.cuerpo)).toMatchObject({ ok: false, texto: "La jefatura todavía revisa este plan: decides cuando termine. No se cambió nada.", releer: true })
    // 409 `campana_detenida` (CC1/CC3 01-nov): el detalle de la plataforma tal cual y SIN reintento
    const detenida = (async () => new Response(JSON.stringify({ ok: false, error: "campana_detenida", detalle: "campaña pausada: pausa de pruebas por decisión del dueño 31-oct" }), { status: 409 })) as unknown as typeof fetch
    const r409 = await ejecutarAccion("plan-cambios", cuerpoDePedirCambios(PLAN, "Sube la meta a 130"), { revisor: "emilio", plataformaUrl: "https://p.test", llave: "k", fetchImpl: detenida })
    expect(r409.status).toBe(409)
    expect(palabrasDeLaRespuesta("plan-cambios", r409.status, r409.cuerpo)).toEqual({ ok: false, texto: "La campaña de este plan está detenida: campaña pausada: pausa de pruebas por decisión del dueño 31-oct. No se cambió nada.", reintentar: false, releer: false })
    // con la ventana abierta, un 404 CON motivo (`plan_inexistente`) se dice como tal, no como «aún no disponible» (sonda de CC6 en producción, 01-nov 15:44Z)
    const inexistente = (async () => new Response(JSON.stringify({ ok: false, error: "plan_inexistente" }), { status: 404 })) as unknown as typeof fetch
    const r404 = await ejecutarAccion("plan-aprobar", cuerpoDeAprobar(PLAN, ""), { revisor: "emilio", plataformaUrl: "https://p.test", llave: "k", fetchImpl: inexistente })
    expect(r404.status).toBe(404); expect(palabrasDeLaRespuesta("plan-aprobar", r404.status, r404.cuerpo).texto).toBe("La plataforma no encuentra este plan. Vuelvo a leer.")
    // la plataforma aún sin la puerta (antes de la ventana) → 501 → «aún no disponible»
    const sinPuerta = (async () => new Response("not found", { status: 404 })) as unknown as typeof fetch
    const r3 = await ejecutarAccion("plan-cambios", cuerpoDePedirCambios(PLAN, "Sube la meta a 130"), { revisor: "emilio", plataformaUrl: "https://p.test", llave: "k", fetchImpl: sinPuerta })
    expect(r3.status).toBe(501); expect(palabrasDeLaRespuesta("plan-cambios", r3.status, r3.cuerpo).texto).toMatch(/^Aún no disponible/)
    // NOTA de CC1: antes de la ventana las puertas responden 500 `planes_error` con un detalle técnico de la base → un texto que sirve antes y después, sin el detalle
    const planesError = (async () => new Response(JSON.stringify({ ok: false, error: "planes_error", detalle: "relation \"public.plan_cambios\" does not exist" }), { status: 500 })) as unknown as typeof fetch
    const r4 = await ejecutarAccion("plan-cambios", cuerpoDePedirCambios(PLAN, "Sube la meta a 130"), { revisor: "emilio", plataformaUrl: "https://p.test", llave: "k", fetchImpl: planesError })
    expect(r4.status).toBe(502); expect(r4.cuerpo).toMatchObject({ plataforma_error: "planes_error", plataforma_status: 500 })
    const palabras = palabrasDeLaRespuesta("plan-cambios", r4.status, r4.cuerpo).texto
    expect(palabras).toBe("No se pudo completar. El ciclo del plan puede no estar disponible todavía. No se cambió nada."); expect(palabras).not.toMatch(/relation|plan_cambios|planes_error/)
  })
})

describe("CC6 · las respuestas de la puerta en palabras", () => {
  const ok = (resultado: Record<string, unknown>) => ({ ok: true, accion: "x", plataforma_status: 200, resultado })
  it("éxitos, «no se pudo despertar» (reintentar) y aprobar sin reanudar", () => {
    expect(palabrasDeLaRespuesta("plan-cambios", 200, ok({ vuelta: 1, version_nueva: 2, tope_usd: 8, despertado: false, motivo_sin_despertar: "sin llave de despacho" }))).toMatchObject({ ok: false, reintentar: true, texto: expect.stringContaining("sin llave de despacho") })
    expect(palabrasDeLaRespuesta("plan-aprobar", 200, ok({ version: 2, reanuda: true, despertado: true })).texto).toBe("Plan aprobado (versión 2): pasa al PDF, a la sala y al brief.")
    expect(palabrasDeLaRespuesta("plan-aprobar", 200, ok({ version: 1, reanuda: false, motivo: "el plan salió antes de la compuerta" })).texto).toBe("Plan aprobado (versión 1). No se reanudó nada: el plan salió antes de la compuerta.")
    expect(palabrasDeLaRespuesta("plan-aprobar", 200, ok({ version: 2, despertado: false, reintento: true })).texto).toMatch(/^Reintento: Plan aprobado/)
  })
  it("cada rechazo del contrato tiene su frase; tablas que faltan = «aún no disponible»; nunca un código crudo", () => {
    for (const codigo of ["plan_en_revision", "no_es_el_vigente", "plan_ya_aprobado", "plan_rechazado", "reescritura_en_curso", "tope_de_vueltas", "plan_inexistente"]) {
      const r = palabrasDeLaRespuesta("plan-cambios", 409, { ok: false, error: "conflicto", detalle: codigo, plataforma: { ok: false, error: codigo } })
      expect(r.ok).toBe(false); expect(r.texto).not.toContain(codigo); expect(r.texto.length).toBeGreaterThan(20)
    }
    for (const codigo of ["entrada_invalida", "falta_confirmar_el_gasto", "falta_el_tope", "tope_demasiado_alto"]) {
      const r = palabrasDeLaRespuesta("plan-cambios", 502, { ok: false, error: "la_plataforma_rechazo", plataforma_status: 400, detalle: codigo })
      expect(r.texto).not.toContain(codigo); expect(r.texto).toContain("No se cambió nada"); expect(r.texto).not.toMatch(/gast|US\$/) // Emilio: sin avisos de gasto
    }
    expect(palabrasDeLaRespuesta("plan-cambios", 502, { ok: false, error: "la_plataforma_rechazo", detalle: "Could not find the table 'public.plan_cambios' in the schema cache" }).texto).toBe("No se pudo completar. El ciclo del plan puede no estar disponible todavía. No se cambió nada.")
    expect(palabrasDeLaRespuesta("plan-aprobar", 502, { ok: false, error: "la_plataforma_rechazo", plataforma_status: 500, detalle: "timeout de la base" }).texto).not.toContain("timeout") // un 5xx no se cuenta con su texto técnico
    expect(palabrasDeLaRespuesta("plan-aprobar", 401, {}).texto).toContain("sesión venció")
  })
  it("el panel envía por la puerta del tablero y no por su cuenta", async () => {
    const urls: string[] = []
    const r = await enviarAlCiclo("plan-aprobar", { plan_id: PLAN }, (async (url: string) => { urls.push(url); return new Response(JSON.stringify({ ok: false, error: "todavia_no_disponible" }), { status: 501 }) }) as unknown as typeof fetch)
    expect(urls).toEqual(["/api/acciones/plan-aprobar"]); expect(r.texto).toMatch(/^Aún no disponible/)
  })
})

/** una base falsa: contesta por tabla; `errores` simula una tabla que aún no existe; cualquier escritura rompe la prueba */
function baseFalsa(respuestas: Record<string, unknown | ((f: string[]) => unknown)>, errores: Record<string, { message: string; code?: string }> = {}, registro: string[] = []) {
  const consulta = (tabla: string): unknown => {
    const q: Record<string, unknown> = {}
    const filtros: string[] = []
    const enc = (n: string) => (...a: unknown[]) => { const f = `${tabla}.${n}(${a.map((x) => JSON.stringify(x)).join(",")})`; registro.push(f); filtros.push(f); return q }
    for (const n of ["select", "eq", "in", "is", "order", "limit", "gte", "neq"]) q[n] = enc(n)
    const resolver = () => { const r = respuestas[tabla]; return typeof r === "function" ? (r as (f: string[]) => unknown)(filtros) : r }
    const err = errores[tabla] ?? null
    q.maybeSingle = () => { const r = resolver(); return Promise.resolve({ data: err ? null : Array.isArray(r) ? r[0] ?? null : r ?? null, error: err }) }
    q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => { const r = resolver(); const conteo = filtros.some((f) => f.includes('"head":true')); return Promise.resolve(err ? { data: null, error: err } : conteo ? { data: null, count: Array.isArray(r) ? r.length : 0, error: null } : { data: r ?? [], error: null }).then(res, rej) }
    for (const n of ["insert", "update", "upsert", "delete", "rpc"]) q[n] = () => { throw new Error(`escritura prohibida: ${tabla}.${n}`) }
    return q
  }
  return { from: consulta, registro } as unknown as Parameters<typeof leerPlanDelCliente>[0] & { registro: string[] }
}
const CLIENTES = [{ id: CLIENTE, name: "Náufrago", industry: "restaurante", status: "active", archived_at: null }]
const V1 = { id: PLAN, title: "Plan v1", status: "draft", content_text: "Prosa v1", content: null, provenance_tag: { vigente: false, superseded_por: PLAN_V2 }, created_at: "2026-10-30T23:13:22Z", updated_at: null }
const V2 = { id: PLAN_V2, title: "Plan v2", status: "draft", content_text: "Prosa v2", content: null, provenance_tag: { version: 2, vigente: true, reemplaza_a: PLAN, compuerta: true }, created_at: "2026-11-01T15:00:00Z", updated_at: null }

describe("CC6 · la lectura del ciclo (solo lectura)", () => {
  it("muestra la VIGENTE (no la reemplazada), su versión, el historial, la compuerta y el pedido abierto", async () => {
    const b = baseFalsa({
      clients: CLIENTES, cadena_campanas: [], hitl_queue: [],
      client_historical_outputs: (f: string[]) => (f.some((x) => x.includes('"id"')) ? [f.some((x) => x.includes(PLAN_V2)) ? V2 : V1] : [V2, V1]),
      plan_aprobaciones: [{ plan_id: PLAN_V2, estado: "pendiente", decidido_por: null, decidido_en: null, despertado: null, despertar_detalle: null }],
      plan_cambios: [],
    })
    const p = await leerPlanDelCliente(b, { cliente: CLIENTE })
    expect(p.documento).toMatchObject({ id: PLAN_V2, prosa: "Prosa v2" })
    expect(p.ciclo).toMatchObject({ disponible: true, version: 2, con_compuerta: true, compuerta: { estado: "pendiente" }, pedido: null })
    expect(p.ciclo!.historial).toEqual([{ id: PLAN, version: 1, creado_en: "2026-10-30T23:13:22Z", status: "draft", reemplaza_a: null, superseded_por: PLAN_V2 }])
    const r = b.registro.join("\n")
    expect(r).toContain(`plan_aprobaciones.eq("plan_id","${PLAN_V2}")`); expect(r).toContain('plan_cambios.order("creado_en",{"ascending":false})') // el último pedido sobre la versión
    expect(leerElCiclo(p.documento!.status, p.ciclo!)).toMatchObject({ estado: "esperando_decision", puede_aprobar: true, puede_pedir_cambios: true })
  })
  it("si las tablas del ciclo aún no existen, el plan se lee igual y el ciclo dice «no disponible»; cualquier otro error lanza", async () => {
    const falta = { message: "Could not find the table 'public.plan_aprobaciones' in the schema cache", code: "PGRST205" }
    const p = await leerPlanDelCliente(baseFalsa({ clients: CLIENTES, cadena_campanas: [], hitl_queue: [], client_historical_outputs: [V2] }, { plan_aprobaciones: falta, plan_cambios: { ...falta, message: "relation \"public.plan_cambios\" does not exist", code: "42P01" } }), { cliente: CLIENTE })
    expect(p.documento).toMatchObject({ id: PLAN_V2 }); expect(p.ciclo).toMatchObject({ disponible: false, compuerta: null, pedido: null })
    await expect(leerPlanDelCliente(baseFalsa({ clients: CLIENTES, cadena_campanas: [], hitl_queue: [], client_historical_outputs: [V2] }, { plan_cambios: { message: "se cayó la base" } }), { cliente: CLIENTE })).rejects.toThrow(/se cayó la base/)
  })
})

describe("CC6 · el panel: botones grandes para todo plan, estados a la vista, historial", () => {
  const datos = (ciclo: CicloDelPlan, status = "draft"): PlanDelCliente => ({
    clientes: [{ id: CLIENTE, nombre: "Náufrago", con_campana: false }], cliente: { id: CLIENTE, nombre: "Náufrago" }, hoy: "2026-11-01",
    campana: null, estrategia: null, fase_activa: faseActiva([], null, "2026-11-01"), revision: null, esperas: { vivas: 0, grupos: [], vencidas: { n: 0, grupos: [] } }, topes: [], leido_en: "x",
    documento: { id: PLAN_V2, titulo: "Plan v2", creado_en: "2026-11-01T15:00:00Z", actualizado_en: null, status, estado_del_plan: null, marcas: [], aviso_del_chequeo: [], no_se_busco: [], jefatura: null, plan: null, prosa: "Prosa", caracteres: 5, que_cambio: null },
    ciclo,
  })
  const pinta = (d: PlanDelCliente) => renderToStaticMarkup(createElement(PanelPlan, { onCerrar: () => {}, datosIniciales: d }))
  it("esperando tu decisión: los dos botones grandes salen aunque el plan no tenga «puntos por resolver»; versión, «corregido» e historial", () => {
    const html = pinta(datos({ ...base, version: 2, con_compuerta: true, compuerta: { estado: "pendiente", decidido_por: null, decidido_en: null, despertado: null, despertar_detalle: null }, historial: [{ id: PLAN, version: 1, creado_en: "2026-10-30T23:13:22Z", status: "draft", reemplaza_a: null, superseded_por: PLAN_V2 }] }))
    expect(html).toContain('data-ciclo="esperando_decision"'); expect(html).toContain("Esperando tu decisión")
    expect(html).toContain('data-accion="plan-aprobar-asi"'); expect(html).toContain('data-accion="plan-pedir-cambios"'); expect(html).toMatch(/min-h-\[56px\][^"]*text-\[16px\]/) // grandes
    expect(html).toContain("Corregido 1 vez"); expect(html).not.toContain("Versión"); expect(html).toContain('data-accion="ver-historial"')
    expect(html).not.toContain("el plan en sí no cambia"); expect(html).not.toContain("data-confirmar") // sin confirmaciones de gasto
  })
  it("en revisión y reescribiendo no ofrecen botones; un pedido que no despertó ofrece «Reintentar» con su tope; aprobado lo dice; ciclo cerrado lo avisa", () => {
    const rev = pinta(datos({ ...base, con_compuerta: true }))
    expect(rev).toContain("En revisión"); expect(rev).not.toContain('data-accion="plan-aprobar-asi"')
    const re = pinta(datos({ ...base, version: 2, pedido: { id: "p", estado: "en_reescritura", texto: "Sube la meta a 130", vuelta: 1, despertado: true, despertar_detalle: null } }))
    expect(re).toContain("Reescribiendo"); expect(re).toContain("Lo que pediste: Sube la meta a 130"); expect(re).not.toContain('data-accion="plan-pedir-cambios"')
    const sin = pinta(datos({ ...base, pedido: { id: "p", estado: "pendiente", texto: "Sube la meta a 130", vuelta: 1, despertado: false, despertar_detalle: "sin llave" } }))
    expect(sin).toContain('data-accion="reintentar"'); expect(sin).toContain("Reintentar el pedido"); expect(sin).not.toContain("US$")
    const ap = pinta(datos(base, "approved"))
    expect(ap).toContain("Aprobado → pasa al brief"); expect(ap).not.toContain('data-accion="plan-aprobar-asi"')
    const cerrado = pinta(datos({ ...base, disponible: false }))
    expect(cerrado).toContain("El ciclo del plan se abre pronto"); expect(cerrado).toContain('data-accion="plan-aprobar-asi"') // se ofrece y responde «aún no disponible»
  })
  it("Emilio 01-nov 16:27Z: sin avisos de gasto · Aprobar = un clic · Pedir cambios = escribir y enviar", () => {
    const c = readFileSync("components/nuevo/PanelPlan.tsx", "utf8")
    expect(c).not.toMatch(/data-confirmar|costo-estimado|COSTO_ESTIMADO|TOPE_REESCRITURA|hasta US\$|Antes de enviar/)
    expect(c).toContain('onClick={() => void mandar("plan-aprobar", cuerpoDeAprobar(planId, ""))}') // un clic
    expect(c).toContain('void mandar("plan-cambios", cuerpoDePedirCambios(planId, observaciones))') // escribir y enviar
    expect(cuerpoDePedirCambios(PLAN, "Sube la meta a 130")).toMatchObject({ confirmo_gasto: true, tope_usd: 8 }) // el cuerpo sigue con lo que la puerta exige
    expect(c).not.toMatch(/supabase|service_role|method: "POST"/)
  })
})

describe("CC6 · ADENDA 1 · la barra de progreso del pedido de cambios", () => {
  const AHORA = new Date("2026-11-01T16:30:00Z")
  const ped = (x: Partial<AvanceCrudo["pedido"]> = {}): AvanceCrudo["pedido"] => ({ id: "pc", estado: "pendiente", creado_en: "2026-11-01T16:20:00Z", actualizado_en: "2026-11-01T16:20:00Z", despertado: true, despertar_detalle: null, ...x })
  const vacio = (x: Partial<AvanceCrudo> = {}): AvanceCrudo => ({ pedido: ped(), despachos: [], invocaciones: [], version_nueva: null, jefatura: null, compuerta_nueva: null, ...x })
  const estados = (a: AvanceCrudo) => avanceDelPedido(a, AHORA).pasos.map((p) => `${p.clave}:${p.estado}`).join(" ")
  it("cada paso se enciende con lo real: recibido → reescribiendo → controles → jefatura → listo", () => {
    expect(estados(vacio())).toBe("recibido:hecho reescribiendo:pendiente controles:pendiente jefatura:pendiente listo:pendiente")
    const corriendo = vacio({ pedido: ped({ estado: "en_reescritura" }), despachos: [{ status: "running", creado_en: "2026-11-01T16:21:00Z", empezo_en: "2026-11-01T16:21:10Z", termino_en: null }] })
    expect(estados(corriendo)).toBe("recibido:hecho reescribiendo:en_curso controles:pendiente jefatura:pendiente listo:pendiente")
    expect(avanceDelPedido(corriendo, AHORA).pasos[1].hora).toBe("2026-11-01T16:21:10Z")
    expect(estados({ ...corriendo, invocaciones: [{ status: "completed", creado_en: "2026-11-01T16:33:00Z" }] })).toBe("recibido:hecho reescribiendo:hecho controles:en_curso jefatura:pendiente listo:pendiente")
    const guardado = { ...corriendo, version_nueva: { id: "v2", creado_en: "2026-11-01T16:35:00Z" } }
    expect(estados(guardado)).toBe("recibido:hecho reescribiendo:hecho controles:hecho jefatura:en_curso listo:pendiente")
    const listo = { ...guardado, pedido: ped({ estado: "aplicado" }), jefatura: { estado: "cerrada", resultado: "limpia", creado_en: "2026-11-01T16:36:00Z", cerrado_en: "2026-11-01T16:40:00Z" }, compuerta_nueva: { estado: "pendiente", creado_en: "2026-11-01T16:41:00Z" } }
    expect(estados(listo)).toBe("recibido:hecho reescribiendo:hecho controles:hecho jefatura:hecho listo:hecho")
    expect(avanceDelPedido(listo, AHORA).estimado).toBe("Terminó")
    expect(avanceDelPedido(corriendo, AHORA).estimado).toBe("Suele tardar ≈ 15–30 min · van 10 min")
  })
  it("si falla: el paso en rojo con el motivo en palabras y qué hacer; sin despertar → reintentar sin gasto; muy largo → nota", () => {
    const fallo = avanceDelPedido(vacio({ pedido: ped({ estado: "fallido", actualizado_en: "2026-11-01T16:29:00Z" }), invocaciones: [{ status: "completed", creado_en: "2026-11-01T16:33:00Z" }] }), AHORA)
    expect(fallo.pasos.map((p) => p.estado)).toEqual(["hecho", "hecho", "fallo", "pendiente", "pendiente"])
    expect(fallo.fallo!.texto).toContain("el plan sigue como estaba"); expect(fallo.fallo!.que_hacer).toContain("pedir cambios otra vez")
    const dormido = avanceDelPedido(vacio({ pedido: ped({ despertado: false, despertar_detalle: "sin llave de despacho" }) }), AHORA)
    expect(dormido.pasos[1]).toMatchObject({ estado: "fallo", detalle: "No se pudo avisar a la oficina de planeación (sin llave de despacho)." }); expect(dormido.fallo!.que_hacer).toContain("Reintentar")
    expect(avanceDelPedido(vacio({ pedido: ped({ estado: "en_reescritura", creado_en: "2026-11-01T15:30:00Z" }) }), AHORA).nota).toContain("Lleva 60 min")
  })
  it("«QUÉ CAMBIÓ EN ESTA VERSIÓN» sale del texto del plan; sin el apartado, nada", () => {
    expect(queCambioDelTexto("## QUÉ CAMBIÓ EN ESTA VERSIÓN\n- La meta sube a 130.\n- Guayaquil pasa a la fase 2.\n\n## La meta\n...")).toBe("- La meta sube a 130.\n- Guayaquil pasa a la fase 2.")
    expect(queCambioDelTexto("**QUE CAMBIO EN ESTA VERSION**\nSe quitó TikTok.\n```json\n{}\n```")).toBe("Se quitó TikTok.")
    expect(queCambioDelTexto("Un plan sin ese apartado.")).toBeNull()
  })
  it("el panel dibuja la barra y, en la versión nueva, «qué cambió» arriba", () => {
    const corriendo = avanceDelPedido(vacio({ pedido: ped({ estado: "en_reescritura" }), despachos: [{ status: "running", creado_en: "2026-11-01T16:21:00Z", empezo_en: "2026-11-01T16:21:10Z", termino_en: null }] }), AHORA)
    const d: PlanDelCliente = {
      clientes: [{ id: CLIENTE, nombre: "Náufrago", con_campana: false }], cliente: { id: CLIENTE, nombre: "Náufrago" }, hoy: "2026-11-01",
      campana: null, estrategia: null, fase_activa: faseActiva([], null, "2026-11-01"), revision: null, esperas: { vivas: 0, grupos: [], vencidas: { n: 0, grupos: [] } }, topes: [], leido_en: "x",
      documento: { id: PLAN_V2, titulo: "Plan v2", creado_en: null, actualizado_en: null, status: "draft", estado_del_plan: null, marcas: [], aviso_del_chequeo: [], no_se_busco: [], jefatura: null, plan: null, prosa: "Prosa", caracteres: 5, que_cambio: "- La meta sube a 130." },
      ciclo: { ...base, version: 2, pedido: { id: "pc", estado: "en_reescritura", texto: "Sube la meta", vuelta: 2, despertado: true, despertar_detalle: null }, avance: corriendo },
    }
    const html = renderToStaticMarkup(createElement(PanelPlan, { onCerrar: () => {}, datosIniciales: d }))
    expect(html).toContain("data-barra-del-pedido"); expect(html).toContain('data-paso="reescribiendo" data-estado="en_curso"'); expect(html).toContain("El jefe de marketing está reescribiendo"); expect(html).toContain("Suele tardar ≈ 15–30 min")
    expect(html).toContain("data-que-cambio"); expect(html).toContain("Qué cambió en el plan"); expect(html).toContain("La meta sube a 130.")
    const c = readFileSync("components/nuevo/PanelPlan.tsx", "utf8")
    expect(c).toContain("15_000"); expect(c).toContain('document.visibilityState === "visible"') // se actualiza solo, sin recargar
  })
  it("sin la ventana abierta el aviso es informativo, sin rojo", () => {
    expect(palabrasDeLaRespuesta("plan-aprobar", 501, { ok: false, error: "todavia_no_disponible" })).toMatchObject({ tono: "info", texto: "Aún no disponible: el ciclo del plan se abre pronto. No se cambió nada." })
    expect(readFileSync("components/nuevo/PanelPlan.tsx", "utf8")).toContain('aviso.tono === "info" ? "info"')
  })
})

describe("CC6 · errores 3–5 del panel del plan (ENCARGO Lenovo 01-nov)", () => {
  it("3 · los topes se leen del catálogo y se dicen en palabras", () => {
    expect(nombreDelTramo("oficina")).toBe("Mesa de análisis"); expect(nombreDelTramo("redaccion")).toBe("Redactor del plan"); expect(nombreDelTramo("jefatura")).toBe("Jefatura"); expect(nombreDelTramo("algo_nuevo")).toBe("Algo nuevo")
  })
  it("4 · vencidas aparte: marcadas por el reloj o con el plazo pasado", () => {
    const r = separarEsperas([
      { objeto_tipo: "espera_video", motivo: null, vence_en: "2026-10-31T13:30:00Z", estado: "viva" },
      { objeto_tipo: "fecha_inicio_propuesta", motivo: null, vence_en: "2026-11-01T05:00:00Z", estado: "vencida" },
      { objeto_tipo: "aprobacion_bandeja", motivo: null, vence_en: null, estado: "viva" },
      { objeto_tipo: "necesita_humano", motivo: null, vence_en: "2026-12-01T00:00:00Z", estado: "viva" },
      { objeto_tipo: "x", motivo: null, vence_en: null, estado: "resuelta" },
    ], "2026-11-01T16:00:00Z")
    expect(r.vigentes.map((e) => e.objeto_tipo)).toEqual(["aprobacion_bandeja", "necesita_humano"])
    expect(r.vencidas.map((e) => e.objeto_tipo)).toEqual(["espera_video", "fecha_inicio_propuesta"])
  })
  it("5 · campaña en pausa: el inicio no se muestra firme", () => {
    expect(inicioSujetoAReanudar("pausada", { situacion: "antes" }, "2026-11-02")).toMatch(/^Inicio sujeto a reanudar \(previsto /)
    expect(inicioSujetoAReanudar("necesita_humano", { situacion: "sin_fecha" }, null)).toBe("Inicio sujeto a reanudar")
    expect(inicioSujetoAReanudar("activa", { situacion: "antes" }, "2026-11-02")).toBeNull()
    expect(inicioSujetoAReanudar("pausada", { situacion: "en_curso" }, "2026-11-02")).toBeNull() // ya empezó: se dice el día como siempre
  })
})


describe("lo que espera la campaña · el brazo de video existe (Emilio 01-nov)", () => {
  it("la espera de video nunca dice «aún no construido»", async () => {
    const { tipoDeEsperaLegible } = await import("@/lib/plan")
    expect(tipoDeEsperaLegible("espera_video")).toBe("publicaciones que esperan su turno en el brazo de video")
    expect(tipoDeEsperaLegible("espera_video")).not.toMatch(/no construido/)
  })
})
