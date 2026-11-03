/**
 * PEDIR CAMBIOS AL MANUAL (CC6 · 02-nov · encargo de Lenovo pedido por Emilio; contrato CC1 PLAN-CC1-pedir-cambios-al-manual-puerta-y-datos; condiciones de CC3).
 * El manual usa las MISMAS piezas del plan; el pedido va a la puerta `manual-cambios`; «Qué cambió» se calcula por campo sobre las dos versiones completas.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { avisoDelPedidoSinCambio, avisoDeLoValidado, cuerpoDePedirCambiosAlManual, palabrasDelPedidoDelManual, queCambioEnElManual, rotuloMientrasSeReescribe, TOPE_PEDIR_CAMBIOS_AL_MANUAL_USD, type CicloDelManual } from "@/lib/manual-ciclo"
import { avanceDelPedido } from "@/lib/plan"
import { ACCIONES, ejecutarAccion, TOPE_PEDIR_CAMBIOS_AL_MANUAL_USD as TOPE_DEL_SERVIDOR } from "@/lib/tablero-acciones"
import { etiquetaDelCampo, leerManualDelCliente } from "@/lib/manual-datos"
import { PanelManual } from "@/components/nuevo/PanelManual"
import type { CampoLeido } from "@/lib/manual-lector"
import type { ManualDelCliente } from "@/lib/manual-datos"
import type { SupabaseClient } from "@supabase/supabase-js"

const CLIENTE = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const AHORA = new Date("2026-11-02T10:00:00Z")
const campo = (clave: string, etiqueta: string, valor: string | null, origen: CampoLeido["origen"] = null): CampoLeido => ({ clave, etiqueta, valor, estado: valor ? "lleno" : "hueco", nota: null, explicacion: null, origen })

describe("la lógica del pedido (pura)", () => {
  it("el cuerpo lleva la confirmación y el tope por código (sin aviso de gasto); con sección, sus campos", () => {
    expect(cuerpoDePedirCambiosAlManual(CLIENTE, "  Más cercano  ")).toEqual({ client_id: CLIENTE, texto: "Más cercano", confirmo_gasto: true, tope_usd: TOPE_PEDIR_CAMBIOS_AL_MANUAL_USD })
    expect(cuerpoDePedirCambiosAlManual(CLIENTE, "Sección «Cómo habla»: más cercano", { titulo: "Cómo habla", campos: ["voz", "nunca"] })).toMatchObject({ seccion: "Cómo habla", campos: ["voz", "nunca"] })
    expect(cuerpoDePedirCambiosAlManual(CLIENTE, "hey")).toEqual({ error: "Cuenta qué debe cambiar (al menos 5 letras)." })
    expect(cuerpoDePedirCambiosAlManual(null, "algo largo")).toEqual({ error: "Falta el cliente." })
    expect(TOPE_PEDIR_CAMBIOS_AL_MANUAL_USD).toBe(TOPE_DEL_SERVIDOR) // panel y servidor con el mismo tope
  })
  it("«Qué cambió» compara las dos versiones completas: también lo que cambió fuera de la sección pedida", () => {
    const antes = [campo("mision", "Misión", "Servir encebollado"), campo("voz", "Voz de la marca", "Formal"), campo("vision", "Visión", null), campo("valores", "Valores", "Frescura")]
    const ahora = [campo("mision", "Misión", "Servir encebollado"), campo("voz", "Voz de la marca", "Cercana"), campo("vision", "Visión", "Ser el refugio"), campo("valores", "Valores", null)]
    expect(queCambioEnElManual(antes, ahora)).toEqual(["Voz de la marca: «Formal» → «Cercana»", "Visión: se escribió «Ser el refugio»", "Valores: se quitó (decía «Frescura»)"])
    expect(queCambioEnElManual(antes, antes)).toEqual([])
    // P06 (CC3): un campo que estaba y la versión nueva ni lo trae también se nombra
    expect(queCambioEnElManual([campo("eslogan", "Eslogan", "Del mar a tu mesa"), campo("voz", "Voz de la marca", "Formal")], [campo("voz", "Voz de la marca", "Formal")])).toEqual(["Eslogan: se quitó (decía «Del mar a tu mesa»)"])
  })
  it("la línea de lo validado (regla que recomienda CC1): en la sección se pierde si cambia; en lo general no se toca salvo que se nombre", () => {
    expect(avisoDeLoValidado(["Misión", "Visión"], true)).toBe("Validaste Misión y Visión: si el equipo cambia esos campos, se pierde tu validación.")
    expect(avisoDeLoValidado(["Voz de la marca"], true)).toBe("Validaste Voz de la marca: si el equipo cambia ese campo, se pierde tu validación.")
    expect(avisoDeLoValidado(["Voz de la marca"], false)).toBe("No se toca lo que validaste (Voz de la marca), salvo que lo nombres.")
    expect(avisoDeLoValidado([], true)).toBeNull()
  })
  it("el avance usa la cuenta del plan con las palabras del manual; el rótulo se apaga si falla o se pasa de la hora y media", () => {
    const base = { despachos: [], invocaciones: [], version_nueva: null, jefatura: null, compuerta_nueva: null }
    const vivo = avanceDelPedido({ ...base, pedido: { id: "p", estado: "en_reescritura", creado_en: "2026-11-02T09:50:00Z", actualizado_en: "2026-11-02T09:51:00Z", despertado: true, despertar_detalle: null }, trabajando: [{ agente: "brand-strategist", desde: "2026-11-02T09:55:00Z" }] }, AHORA, "manual")
    expect(vivo.pasos.map((p) => p.nombre)).toEqual(["Recibido", "El equipo del manual está reescribiendo", "Controles automáticos", "Listo: ya es el manual vigente"]) // sin jefatura (CC1 02-nov)
    expect(vivo.ahora?.texto).toBe("El equipo del manual está trabajando: brand strategist")
    const abierto = { id: "p", estado: "en_reescritura", texto: "x", seccion: null, creado_en: null, actualizado_en: null, despertado: true, despertar_detalle: null, manual_id: null, manual_nuevo_id: null }
    expect(rotuloMientrasSeReescribe({ abierto, avance: vivo })).toMatch(/El equipo está reescribiendo el manual/)
    const fallo = avanceDelPedido({ ...base, pedido: { id: "p", estado: "fallido", creado_en: "2026-11-02T09:00:00Z", actualizado_en: "2026-11-02T09:30:00Z", despertado: true, despertar_detalle: "sin cambios reales" } }, AHORA, "manual")
    // «sin cambios reales» (CC1 ANEXO 2): se dice como lo que es, no como una corrida rota
    expect(fallo.fallo?.texto).toBe("El equipo revisó tu pedido y el manual quedó igual: no se guardó una versión nueva.")
    expect(fallo.pasos.find((p) => p.estado === "fallo")?.detalle).toBe("Lo reescrito quedó igual a lo que había.")
    const roto = avanceDelPedido({ ...base, pedido: { id: "p", estado: "fallido", creado_en: "2026-11-02T09:00:00Z", actualizado_en: "2026-11-02T09:30:00Z", despertado: true, despertar_detalle: "tope de gasto" } }, AHORA, "manual")
    expect(roto.fallo?.texto).toBe("La reescritura no terminó: el manual sigue como estaba (la versión actual no cambió).")
    expect(roto.pasos.find((p) => p.estado === "fallo")?.detalle).toMatch(/tope de gasto/)
    expect(rotuloMientrasSeReescribe({ abierto, avance: fallo })).toBeNull()
    expect(rotuloMientrasSeReescribe({ abierto, avance: { ...vivo, minutos: 120 } })).toBeNull()
    // el plan no cambia: sus nombres siguen como estaban
    const delPlan = avanceDelPedido({ ...base, pedido: { id: "p", estado: "pendiente", creado_en: null, actualizado_en: null, despertado: true, despertar_detalle: null } }, AHORA)
    expect(delPlan.pasos[1].nombre).toBe("El jefe de marketing está reescribiendo"); expect(delPlan.pasos.map((x) => x.clave)).toContain("jefatura")
  })
  it("la respuesta en palabras: enviado, sin despertar (reintentar), en curso", () => {
    expect(palabrasDelPedidoDelManual({ ok: true, detalle: { manual_cambio_id: "x", estado: "pendiente" } }).texto).toMatch(/^Pedido enviado/)
    expect(palabrasDelPedidoDelManual({ ok: true, detalle: { despertado: false } })).toEqual({ ok: false, texto: "Tu pedido quedó guardado, pero no se pudo avisar al equipo del manual. Usa «Reintentar»." })
    expect(palabrasDelPedidoDelManual({ ok: false, texto: "Otra decisión se adelantó: recarga. reescritura_en_curso" }).texto).toBe("Ya hay un pedido de cambios en curso: espera la versión nueva.")
  })
})

describe("la puerta del tablero `manual-cambios`", () => {
  it("valida y llega a POST /api/tablero/manual-cambios con el cuerpo del contrato de CC1", async () => {
    const llamadas: Array<{ url: string; cuerpo: Record<string, unknown> }> = []
    const fetchImpl = (async (url: string, init?: RequestInit) => { llamadas.push({ url, cuerpo: JSON.parse(String(init?.body ?? "{}")) }); return new Response(JSON.stringify({ ok: true, manual_cambio_id: "pc1", estado: "pendiente" }), { status: 200 }) }) as unknown as typeof fetch
    const cuerpo = cuerpoDePedirCambiosAlManual(CLIENTE, "Sección «Cómo habla»: más cercano", { titulo: "Cómo habla", campos: ["voz"] }) as Record<string, unknown>
    const r = await ejecutarAccion("manual-cambios", cuerpo, { revisor: "emilio", plataformaUrl: "https://p.test", llave: "k", fetchImpl })
    expect(r.status).toBe(200)
    expect(llamadas[0].url).toBe("https://p.test/api/tablero/manual-cambios")
    expect(llamadas[0].cuerpo).toMatchObject({ client_id: CLIENTE, texto: "Sección «Cómo habla»: más cercano", seccion: "Cómo habla", campos: ["voz"], confirmo_gasto: true, tope_usd: 5 })
  })
  it("P13 (CC3): sin la confirmación del gasto el servidor del tablero NO llama a la plataforma (esta capa lo para sola)", async () => {
    let llamadas = 0
    const fetchImpl = (async () => { llamadas++; return new Response("{}", { status: 200 }) }) as unknown as typeof fetch
    for (const confirmo of [undefined, false, "true", 1, null]) {
      const r = await ejecutarAccion("manual-cambios", { client_id: CLIENTE, texto: "Más cercano", tope_usd: 5, ...(confirmo === undefined ? {} : { confirmo_gasto: confirmo }) }, { revisor: "emilio", plataformaUrl: "https://p.test", llave: "k", fetchImpl })
      expect(r.status, String(confirmo)).toBeGreaterThanOrEqual(400)
      expect(JSON.stringify(r.cuerpo)).toContain("falta_confirmar_gasto")
    }
    expect(llamadas).toBe(0)
  })
  it("rechaza sin llamar a la plataforma: sin confirmación, tope alto, campos raros, texto corto", async () => {
    const v = ACCIONES["manual-cambios"].validar
    expect(v({ client_id: CLIENTE, texto: "más cercano", tope_usd: 5 })).toMatchObject({ ok: false, error: "falta_confirmar_gasto" })
    expect(v({ client_id: CLIENTE, texto: "más cercano", confirmo_gasto: true, tope_usd: 9 })).toMatchObject({ ok: false })
    expect(v({ client_id: CLIENTE, texto: "más cercano", confirmo_gasto: true, tope_usd: 5, seccion: "X", campos: ["DROP TABLE"] })).toMatchObject({ ok: false })
    expect(v({ client_id: CLIENTE, texto: "ok", confirmo_gasto: true, tope_usd: 5 })).toMatchObject({ ok: false })
    expect(ACCIONES["manual-cambios"].gasta).toBeNull() // el aviso de gasto no va en /nuevo: lo cuida la plataforma con el tope
  })
})

/** base falsa por tabla y filtros: cualquier escritura rompe la prueba */
function baseFalsa(responder: (tabla: string, filtros: string[]) => { data: unknown; error: { message: string; code?: string } | null }) {
  const consulta = (tabla: string): unknown => {
    const filtros: string[] = []
    const q: Record<string, unknown> = {}
    for (const n of ["select", "eq", "in", "is", "order", "limit", "gte", "neq"]) q[n] = (...args: unknown[]) => { filtros.push(`${n}(${args.map((a) => JSON.stringify(a)).join(",")})`); return q }
    q.maybeSingle = () => { const r = responder(tabla, filtros); return Promise.resolve({ data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }) }
    q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(responder(tabla, filtros)).then(res, rej)
    for (const n of ["insert", "update", "upsert", "delete", "rpc"]) q[n] = () => { throw new Error(`escritura prohibida: ${tabla}.${n}`) }
    return q
  }
  return { from: consulta } as unknown as SupabaseClient
}
const libro = (id: string, version: number, extra: Record<string, unknown> = {}) => ({ id, client_id: CLIENTE, version, brand_mission: "Servir encebollado.", voice_description: "Formal.", content_text: JSON.stringify({ brand_book_draft: {} }), created_at: "2026-11-01T10:00:00Z", updated_at: "2026-11-01T10:00:00Z", ...extra })
const ok = (data: unknown) => ({ data, error: null })

describe("la lectura del ciclo del manual (solo lectura)", () => {
  const comun = (tabla: string, filtros: string[], pedido: unknown, pedidoError: { message: string; code?: string } | null = null) => {
    if (tabla === "clients") return ok([{ id: CLIENTE, name: "Náufrago", status: "active" }])
    if (tabla === "client_brand_books") return filtros.some((f) => f.startsWith('eq("id","b1")')) ? ok(libro("b1", 1)) : ok([libro("b2", 2, { voice_description: "Cercana." })])
    if (tabla === "plan_cambios") return pedidoError ? { data: null, error: pedidoError } : ok(pedido)
    return ok([])
  }
  it("antes de la migración de CC1 (columna `documento` inexistente) el pedido no se ofrece: no es un error", async () => {
    const m = await leerManualDelCliente(baseFalsa((t, f) => comun(t, f, null, { message: 'column plan_cambios.documento does not exist', code: "42703" })), { cliente: CLIENTE, ahora: AHORA })
    expect(m.manual?.ciclo).toEqual({ disponible: false, abierto: null, avance: null, que_cambio: [] })
  })
  it("P18 (CC3): un error real de la base lanza (nunca se lee como «aún no existe»); solo tabla o columna inexistente cierran el ciclo", async () => {
    for (const error of [{ message: "connection refused" }, { message: "permission denied for table plan_cambios", code: "42501" }, { message: "canceling statement due to statement timeout", code: "57014" }, { message: "JWT expired", code: "PGRST301" }])
      await expect(leerManualDelCliente(baseFalsa((t, f) => comun(t, f, null, error)), { cliente: CLIENTE, ahora: AHORA }), error.message).rejects.toThrow(/plan_cambios/)
    for (const error of [{ message: 'column plan_cambios.documento does not exist', code: "42703" }, { message: 'relation "public.plan_cambios" does not exist', code: "42P01" }])
      expect((await leerManualDelCliente(baseFalsa((t, f) => comun(t, f, null, error)), { cliente: CLIENTE, ahora: AHORA })).manual?.ciclo?.disponible, error.code).toBe(false)
    // el error al leer la versión base tampoco se traga
    const pedido = { id: "pc1", estado: "aplicado", texto: "x", creado_en: "2026-11-02T09:00:00Z", actualizado_en: "2026-11-02T09:20:00Z", despertado: true, manual_id: "b1", manual_nuevo_id: "b2" }
    await expect(leerManualDelCliente(baseFalsa((t, f) => (t === "client_brand_books" && f.some((x) => x.startsWith('eq("id","b1")')) ? { data: null, error: { message: "connection reset" } } : comun(t, f, pedido))), { cliente: CLIENTE, ahora: AHORA })).rejects.toThrow(/client_brand_books/)
  })
  it("P20 (CC3): un pedido aplicado que produjo OTRA versión (no la vigente) no muestra avance ni «Qué cambió»", async () => {
    const pedido = { id: "pc0", estado: "aplicado", texto: "x", creado_en: "2026-11-02T09:00:00Z", actualizado_en: "2026-11-02T09:20:00Z", despertado: true, manual_id: "b0", manual_nuevo_id: "b1" }
    const m = await leerManualDelCliente(baseFalsa((t, f) => comun(t, f, pedido)), { cliente: CLIENTE, ahora: AHORA })
    expect(m.manual?.ciclo).toEqual({ disponible: true, abierto: null, avance: null, que_cambio: [] })
  })
  it("pide por cliente y documento='manual'; un pedido aplicado que creó la vigente trae «Qué cambió» contra la versión base", async () => {
    const vistos: string[] = []
    const pedido = { id: "pc1", documento: "manual", client_id: CLIENTE, estado: "aplicado", texto: "más cercano", creado_en: "2026-11-02T09:00:00Z", actualizado_en: "2026-11-02T09:20:00Z", despertado: true, manual_id: "b1", manual_nuevo_id: "b2" }
    const tablas: string[] = []
    const m = await leerManualDelCliente(baseFalsa((t, f) => { tablas.push(t); if (t === "plan_cambios") vistos.push(f.join(" ")); return comun(t, f, pedido) }), { cliente: CLIENTE, ahora: AHORA })
    expect(tablas).not.toContain("jefatura_revisiones") // el manual no pasa por la jefatura
    expect(vistos[0]).toContain('eq("documento","manual")'); expect(vistos[0]).toContain(`eq("client_id","${CLIENTE}")`)
    expect(m.manual?.ciclo?.disponible).toBe(true)
    expect(m.manual?.ciclo?.abierto).toBeNull()
    expect(m.manual?.ciclo?.que_cambio).toEqual(["Voz de la marca: «Formal.» → «Cercana.»"])
    expect(m.manual?.ciclo?.avance?.listo).toBe(true)
  })
})

const manualCon = (ciclo: CicloDelManual, campos: CampoLeido[] = [campo("mision", "Misión", "Servir", "aceptado"), campo("voz", "Voz de la marca", "Cercana")]): ManualDelCliente => ({
  clientes: [{ id: CLIENTE, nombre: "Náufrago", con_manual: true }], cliente: { id: CLIENTE, nombre: "Náufrago" }, leido_en: AHORA.toISOString(),
  manual: { version: 2, versiones: 2, lector: { campos, huecos: [], completo: true, validadoPor: "propuesta", rotulo: "Propuesta", rotuloVisual: null } as never, fidelidad: "—", origen: null, colores: [], tipografias: [], opciones_eslogan: [], palabras_prohibidas: [], palabras: [], terminos_propios: [], politica_competidores: null, creado_en: null, actualizado_en: null, ciclo },
})

describe("el panel del manual", () => {
  const html = (ciclo: CicloDelManual) => renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: manualCon(ciclo) }))
  it("sin la plataforma lista no aparece ningún botón de pedir cambios (la puerta daría 404)", () => {
    const h = html({ disponible: false, abierto: null, avance: null, que_cambio: [] })
    expect(h).not.toContain("Pedir cambios"); expect(h).not.toContain("data-pedir-cambios-manual")
  })
  it("con la plataforma lista: el cuadro de observaciones SIEMPRE a la vista en la portada (sin botón propio) y «Pedir cambios en esta sección» en cada apartado, sin aviso de gasto", () => {
    const h = html({ disponible: true, abierto: null, avance: null, que_cambio: ["Voz de la marca: «Formal» → «Cercana»"] })
    expect(h).toContain('data-accion="manual-texto-libre"'); expect(h).not.toContain('data-accion="manual-pedir-cambios"'); expect(h).not.toContain('data-accion="manual-enviar-pedido"')
    expect([...h.matchAll(/data-seccion-pedir="([^"]+)"/g)].map((x) => x[1])).toEqual(["Lo que la marca es", "Cómo habla", "A quién le habla", "Palabras"])
    expect(h).toContain("Qué cambió en el manual · 1 cambio")
    expect(h).not.toMatch(/US\$|gasta|costo/i)
  })
  it("con un pedido abierto: rótulo, barra con su animación y lo pedido; sin botones para un segundo pedido", () => {
    const avance = avanceDelPedido({ pedido: { id: "p", estado: "en_reescritura", creado_en: "2026-11-02T09:50:00Z", actualizado_en: null, despertado: true, despertar_detalle: null }, despachos: [], invocaciones: [], version_nueva: null, jefatura: null, compuerta_nueva: null }, AHORA, "manual")
    const h = html({ disponible: true, abierto: { id: "p", estado: "en_reescritura", texto: "Más cercano", seccion: null, creado_en: null, actualizado_en: null, despertado: true, despertar_detalle: null, manual_id: null, manual_nuevo_id: null }, avance, que_cambio: [] })
    expect(h).toContain("data-rotulo-reescribiendo"); expect(h).toContain("data-barra-del-pedido"); expect(h).toContain("nv-pl-paso-vivo"); expect(h).toContain("Lo que pediste: Más cercano")
    expect(h).not.toContain('data-accion="manual-texto-libre"'); expect(h).not.toContain("data-seccion-pedir"); expect(h).not.toContain('data-accion="observacion-campo"')
  })
  it("el panel deja la puerta a la vista del barrido de acciones y usa las piezas comunes del plan", () => {
    const fuente = readFileSync("components/nuevo/PanelManual.tsx", "utf8")
    expect(fuente).toContain('data-tablero-accion="manual-cambios"')
    expect(readFileSync("components/nuevo/manual/PedirCambiosAlManual.tsx", "utf8")).toContain('from "@/components/nuevo/pedido/PiezasDelPedido"')
  })
})

describe("el aviso del pedido que no cambió (CC6 · 02-nov · SEÑAL «desbloquear el manual» punto 3 · forma final de CC1 #856)", () => {
  const comun = (tabla: string, _f: string[], pedido: unknown) => {
    if (tabla === "clients") return ok([{ id: CLIENTE, name: "Náufrago", status: "active" }])
    if (tabla === "client_brand_books") return ok([libro("b2", 2)])
    if (tabla === "plan_cambios") return ok(pedido)
    return ok([])
  }
  const pedido = (estado: string, resultado: unknown) => ({ id: "pc9", documento: "manual", client_id: CLIENTE, estado, texto: "cambia el tono de WhatsApp a formal", creado_en: "2026-11-02T09:00:00Z", actualizado_en: "2026-11-02T09:20:00Z", despertado: true, despertar_detalle: "sin cambios reales", manual_id: "b2", manual_nuevo_id: null, resultado })
  const leer = async (p: unknown) => (await leerManualDelCliente(baseFalsa((t, f) => comun(t, f, p)), { cliente: CLIENTE, ahora: AHORA })).manual?.ciclo
  it("los cuatro casos de CC1: con `tocados_validados` nombra el campo; solo `protegidos`, general; nada, «no cambió nada»; con cambios, avisa solo de lo tocado", () => {
    const a = (r: unknown) => avisoDelPedidoSinCambio(r, etiquetaDelCampo)
    const t = a({ sin_cambios: true, protegidos: ["tono_por_canal", "reglas_de_escritura", "valores"], tocados_validados: ["tono_por_canal"], declarado: ["conserva lo validado"] })!
    expect(t.campos).toEqual([{ clave: "tono_por_canal", etiqueta: "Por canal (Tono según el canal)" }]); expect(t.texto).toMatch(/^El pedido no cambió nada: «Por canal \(Tono según el canal\)» está validado/); expect(t.texto).toMatch(/Libéralo/)
    expect(t.texto).not.toMatch(/Reglas|valores/i) // nunca nombra lo de `protegidos`
    const g = a({ sin_cambios: true, protegidos: ["valores"], tocados_validados: [] })!
    expect(g.campos).toEqual([]); expect(g.texto).toMatch(/puede ser por algo que validaste/); expect(g.texto).not.toMatch(/valores/i)
    expect(a({ sin_cambios: true, protegidos: [], tocados_validados: [] })).toEqual({ texto: "Este pedido no cambió nada.", campos: [] })
    const m = a({ sin_cambios: false, protegidos: ["tono_por_canal"], tocados_validados: ["voice_description"] })!
    expect(m.campos).toEqual([{ clave: "voz", etiqueta: "Voz de la marca" }]); expect(m.texto).toMatch(/^Se cambió lo demás; «Voz de la marca» está validado y no se tocó/)
    for (const r of [null, undefined, [], "x", { sin_cambios: false, protegidos: ["x"], tocados_validados: [] }, {}]) expect(a(r), JSON.stringify(r)).toBeNull()
    expect(etiquetaDelCampo("clave_desconocida")).toEqual({ clave: "clave_desconocida", etiqueta: "Clave desconocida" })
  })
  it("en la lectura: solo en un pedido ya terminado; nulo (pedido viejo) o abierto, nada", async () => {
    expect((await leer(pedido("fallido", { sin_cambios: true, protegidos: ["tono_por_canal"], tocados_validados: ["tono_por_canal"] })))?.aviso_del_pedido?.campos.map((c) => c.clave)).toEqual(["tono_por_canal"])
    expect((await leer(pedido("fallido", null)))?.aviso_del_pedido).toBeUndefined()
    expect((await leer(pedido("en_reescritura", { sin_cambios: true, tocados_validados: ["tono_por_canal"] })))?.aviso_del_pedido).toBeUndefined()
  })
  it("el panel muestra el texto y un botón por campo validado nombrado; sin aviso, nada", () => {
    const aviso = avisoDelPedidoSinCambio({ sin_cambios: true, tocados_validados: ["tono_por_canal"] }, etiquetaDelCampo)!
    const con = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: manualCon({ disponible: true, abierto: null, avance: null, que_cambio: [], aviso_del_pedido: aviso }) }))
    expect(con).toContain("data-aviso-campo-validado"); expect(con).toContain('data-campo-ir="tono_por_canal"'); expect(con).toContain("Ir a «Por canal (Tono según el canal)»")
    const general = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: manualCon({ disponible: true, abierto: null, avance: null, que_cambio: [], aviso_del_pedido: { texto: "Este pedido no cambió nada.", campos: [] } }) }))
    expect(general).toContain("Este pedido no cambió nada."); expect(general).not.toContain('data-accion="ir-al-campo-validado"')
    const sin = renderToStaticMarkup(createElement(PanelManual, { onCerrar: () => {}, datosIniciales: manualCon({ disponible: true, abierto: null, avance: null, que_cambio: [] }) }))
    expect(sin).not.toContain("data-aviso-campo-validado")
  })
})

describe("la pausa del manual: el tablero lee la espera (solo lectura · reserva de CC3 a #227)", () => {
  const con = (espera: { data: unknown; error: { message: string; code?: string } | null }) => baseFalsa((tabla, filtros) => {
    if (tabla === "clients") return ok([{ id: CLIENTE, name: "Náufrago", status: "active" }])
    if (tabla === "client_brand_books") return ok([libro("b2", 2)])
    if (tabla === "esperas_del_dueno") return ["eq(\"client_id\",\"" + CLIENTE + "\")", 'eq("tipo","manual")', 'eq("estado","soltada")', 'eq("despertado",false)', 'eq("manual_id","b2")'].every((f) => filtros.includes(f)) && !filtros.some((f) => f.startsWith("order(")) ? espera : ok([])
    return ok([])
  })
  it("espera de este manual soltada sin plan pedido → plan_sin_pedir; con plan pedido o de otro manual → no", async () => {
    expect((await leerManualDelCliente(con(ok([{ estado: "soltada", despertado: false, manual_id: "b2" }])), { cliente: CLIENTE })).manual?.plan_sin_pedir).toBe(true)
    expect((await leerManualDelCliente(con(ok([{ estado: "soltada", despertado: true, manual_id: "b2" }])), { cliente: CLIENTE })).manual?.plan_sin_pedir).toBe(false)
    expect((await leerManualDelCliente(con(ok([{ estado: "soltada", despertado: false, manual_id: "b1" }])), { cliente: CLIENTE })).manual?.plan_sin_pedir).toBe(false)
  })
  it("tabla aún no publicada o error de lectura: el manual se lee igual y no aparece el reintento", async () => {
    const falta = await leerManualDelCliente(con({ data: null, error: { message: 'relation "public.esperas_del_dueno" does not exist', code: "42P01" } }), { cliente: CLIENTE })
    expect(falta.manual?.version).toBe(2); expect(falta.manual?.plan_sin_pedir).toBe(false)
    const caida = await leerManualDelCliente(con({ data: null, error: { message: "timeout" } }), { cliente: CLIENTE })
    expect(caida.manual?.version).toBe(2); expect(caida.manual?.plan_sin_pedir).toBe(false)
  })
})
