/** PLAN · FECHAS Y CONTEOS QUE NO CUADRAN (CC6 · 03-nov · auditoría n.º 6, firma de Emilio 17:43Z). Una regla para cualquier cliente. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { fechasDelTexto, periodoDelPlan, textoDelPeriodo, tituloDelPlan } from "@/lib/plan-periodo"
import { avanceDelPedido, planDelTexto } from "@/lib/plan"
import { leerPlanDelCliente, type PlanDelCliente } from "@/lib/plan-datos"
import { PanelPlan } from "@/components/nuevo/PanelPlan"

const CAMP = { id: "k", estado: "pausada", estado_motivo: null, desde: "2026-11-02", hasta: "2027-01-30", sedes: [], tope_planeacion_usd: null, autoproducir: false, publicaciones: 108, version_calendario: 2, creada_en: null, actualizada_en: null }
const FASES = [{ clave: "a", objetivo: "Señal", dia_desde: 1, dia_hasta: 30 }, { clave: "b", objetivo: "Recompra", dia_desde: 31, dia_hasta: 84 }]
const doc = (prosa: string | null, plan: unknown = null) => ({ id: "d", titulo: "", creado_en: null, actualizado_en: null, status: "draft", estado_del_plan: null, marcas: [], aviso_del_chequeo: [], no_se_busco: [], jefatura: null, plan, prosa, caracteres: 0, que_cambio: null }) as never
const est = (fases = FASES) => ({ version: 1, estado: "validada", creada_en: null, costo_usd: null, texto_md: null, fases, redes: [], excluidos: [], pilares: [], hitos: [], dependencias: [], fechas_que_importan: [], patron_semanal: [], piezas_fijas: [], pendientes: [], alertas: [] }) as never
const PROSA = "# PLAN\n**Olón · 2 de noviembre de 2026 – 24 de enero de 2027**\n\n## Resumen\nAlgo.\n"

describe("1 · las fechas salen de UNA fuente: el propio plan", () => {
  it("el documento escribe su periodo: manda sobre la campaña (2 nov → 30 ene en la campaña, 24 ene en el plan → 24 ene)", () => {
    const x = periodoDelPlan({ campana: CAMP as never, estrategia: est(), documento: doc(PROSA) })
    expect(x).toEqual({ desde: "2026-11-02", hasta: "2027-01-24", dias: 84, fuente: "documento" })
    expect(textoDelPeriodo(x!)).toBe("2 nov → 24 ene · 84 días")
  })
  it("sin fechas en el documento: el arranque de la campaña + hasta dónde llegan las fases (no la fecha de fin guardada en la campaña)", () => {
    expect(periodoDelPlan({ campana: CAMP as never, estrategia: est(), documento: doc(null) })).toEqual({ desde: "2026-11-02", hasta: "2027-01-24", dias: 84, fuente: "fases" })
  })
  it("sin fases: el horizonte que declara el plan; sin nada de eso: lo que dura la campaña", () => {
    const conHorizonte = planDelTexto("```json\n" + JSON.stringify({ meta_por_semana: 80, horizonte_dias: 28 }) + "\n```").plan
    expect(conHorizonte?.horizonte_dias).toBe(28)
    expect(conHorizonte?.otras_claves).not.toContain("horizonte_dias") // ahora se lee
    expect(periodoDelPlan({ campana: CAMP as never, estrategia: est([]), documento: doc(null, conHorizonte) })).toEqual({ desde: "2026-11-02", hasta: "2026-11-29", dias: 28, fuente: "horizonte" })
    expect(periodoDelPlan({ campana: CAMP as never, estrategia: null, documento: null })).toEqual({ desde: "2026-11-02", hasta: "2027-01-30", dias: 90, fuente: "campana" })
  })
  it("sin plan ni campaña, no hay periodo (no se inventa un número)", () => {
    expect(periodoDelPlan({ campana: null, estrategia: null, documento: doc("# PLAN\nsin fechas\n") })).toBeNull()
  })
  it("las fechas del texto: con y sin año al inicio, abreviadas, cruzando el año; lo imposible no pasa", () => {
    expect(fechasDelTexto("2 de noviembre de 2026 – 24 de enero de 2027")).toEqual({ desde: "2026-11-02", hasta: "2027-01-24" })
    expect(fechasDelTexto("2 de noviembre – 24 de enero de 2027")).toEqual({ desde: "2026-11-02", hasta: "2027-01-24" })
    expect(fechasDelTexto("2 nov 2026 - 24 ene 2027")).toEqual({ desde: "2026-11-02", hasta: "2027-01-24" })
    expect(fechasDelTexto("1 de marzo de 2027 – 30 de mayo de 2027")).toEqual({ desde: "2027-03-01", hasta: "2027-05-30" })
    expect(fechasDelTexto("31 de febrero de 2027 – 3 de marzo de 2027")).toBeNull()
    expect(fechasDelTexto("2 de noviembre – 24 de enero")).toBeNull() // sin año no se adivina
    expect(fechasDelTexto("24 de enero de 2027 – 2 de noviembre de 2026")).toBeNull() // fin antes del inicio
    expect(fechasDelTexto(null)).toBeNull()
  })
})

describe("2 · un solo número de días, el de las fechas reales", () => {
  it("el título dice los días del periodo; sin periodo, «Plan» a secas (nunca un «90» fijo)", () => {
    expect(tituloDelPlan({ desde: null, hasta: null, dias: 84, fuente: "fases" })).toBe("Plan de 84 días")
    expect(tituloDelPlan(null)).toBe("Plan")
  })
})

// una base falsa de solo lectura que registra los filtros
function base(respuestas: Record<string, unknown>) {
  const registro: string[] = []
  const from = (tabla: string) => {
    const q: Record<string, unknown> = {}, filtros: string[] = []
    const enc = (n: string) => (...a: unknown[]) => { const f = `${tabla}.${n}(${a.map((x) => JSON.stringify(x)).join(",")})`; registro.push(f); filtros.push(f); return q }
    for (const n of ["select", "eq", "in", "is", "order", "limit", "gte", "neq", "not"]) q[n] = enc(n)
    const r = () => { const x = respuestas[tabla]; return typeof x === "function" ? (x as (f: string[]) => unknown)(filtros) : x }
    q.maybeSingle = () => { const x = r(); return Promise.resolve({ data: Array.isArray(x) ? x[0] ?? null : x ?? null, error: null }) }
    q.then = (ok: (v: unknown) => unknown) => { const x = r(); const conteo = filtros.some((f) => f.includes('"head":true')); return Promise.resolve(conteo ? { data: null, count: Array.isArray(x) ? x.length : 0, error: null } : { data: x ?? [], error: null }).then(ok) }
    return q
  }
  return { from, registro } as never as Parameters<typeof leerPlanDelCliente>[0] & { registro: string[] }
}
const C = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", K = "8168f32b-47d9-466a-9350-3dff31700a58"
const comun = (filas: (f: string[]) => unknown) => ({
  clients: [{ id: C, name: "Cliente de prueba", status: "active", archived_at: null }],
  cadena_campanas: [{ id: K, client_id: C, estado: "pausada", seco: false, fecha_inicio: "2026-11-02", fecha_fin: "2027-01-30", sedes: [], autoproducir: false, creada_en: "2026-11-01T00:00:00Z" }],
  client_historical_outputs: [], cadena_estrategias: [], cadena_esperas: [], hitl_queue: [], cadena_calendario_filas: filas,
})

describe("3 · publicaciones: las mismas que el calendario", () => {
  it("se cuentan sobre la versión VIGENTE del calendario y sin las archivadas (antes: todas las versiones → «136» contra «0»)", async () => {
    const b = base(comun((f) => (f.some((x) => x.includes('"head":true')) ? [{ id: "1" }, { id: "2" }, { id: "3" }] : [{ calendario_version: 4 }])))
    const p = await leerPlanDelCliente(b, { cliente: C, ahora: new Date("2026-11-05T15:00:00Z") })
    expect(p.campana).toMatchObject({ publicaciones: 3, version_calendario: 4 })
    const conteo = b.registro.filter((x) => x.startsWith("cadena_calendario_filas."))
    expect(conteo).toContain('cadena_calendario_filas.eq("calendario_version",4)')
    expect(conteo).toContain('cadena_calendario_filas.is("archivada_en",null)')
  })
  it("sin calendario: no se cuenta nada y el panel dice «calendario: aún no armado», no 0", async () => {
    const b = base(comun(() => []))
    const p = await leerPlanDelCliente(b, { cliente: C, ahora: new Date("2026-11-05T15:00:00Z") })
    expect(p.campana).toMatchObject({ publicaciones: 0, version_calendario: null })
    expect(b.registro.some((x) => x.includes('"head":true'))).toBe(false)
    const h = renderToStaticMarkup(createElement(PanelPlan, { onCerrar: () => {}, datosIniciales: p as PlanDelCliente }))
    expect(h).toMatch(/data-publicaciones="true"[^>]*>calendario: aún no armado</)
    const conCal = renderToStaticMarkup(createElement(PanelPlan, { onCerrar: () => {}, datosIniciales: { ...p, campana: { ...p.campana!, publicaciones: 3, version_calendario: 4 } } as PlanDelCliente }))
    expect(conCal).toMatch(/data-publicaciones="true"[^>]*>3</)
  })
  it("el panel: título y cabecera dicen el mismo periodo (una sola fuente)", async () => {
    const p = await leerPlanDelCliente(base(comun(() => [])), { cliente: C, ahora: new Date("2026-11-05T15:00:00Z") })
    const h = renderToStaticMarkup(createElement(PanelPlan, { onCerrar: () => {}, datosIniciales: { ...p, estrategia: est(), documento: doc(PROSA) } as PlanDelCliente }))
    expect(h).toContain(">Plan de 90 días</h2>") // Lenovo 20:37Z: el nombre no cambia…
    expect(h).toContain("Este plan solo cubre 12 semanas (84 de los 90 días).") // …y lo que cubre se dice en palabras
    expect(h).toContain("2 nov → 24 ene · 84 días")
    expect(h.split("2 nov → 24 ene · 84 días").length - 1).toBeGreaterThanOrEqual(2) // la cabecera Y la barra lateral
    expect(h).not.toContain("30 ene"); expect(h).not.toContain("2027-01-30")
  })
})

describe("4 · los pasos terminados, en pasado", () => {
  const pasos = (o: { version_nueva?: boolean; jefatura?: boolean }) => avanceDelPedido({
    pedido: { id: "p", estado: "en_reescritura", creado_en: "2026-11-02T09:00:00Z", actualizado_en: null, despertado: true, despertar_detalle: null },
    despachos: [], invocaciones: [{ status: "completed", creado_en: "2026-11-02T09:05:00Z" }],
    version_nueva: o.version_nueva ? { id: "v2", creado_en: "2026-11-02T09:20:00Z" } : null,
    jefatura: o.jefatura ? { estado: "cerrado", resultado: "ok", creado_en: "2026-11-02T09:21:00Z", cerrado_en: "2026-11-02T09:30:00Z" } : null,
    compuerta_nueva: null,
  }, new Date("2026-11-02T10:00:00Z")).pasos.map((x) => `${x.nombre}|${x.estado}`)
  it("hechos: «reescribió», «Pasó los controles automáticos», «La jefatura revisó»", () => {
    expect(pasos({ version_nueva: true, jefatura: true })).toEqual(expect.arrayContaining(["El jefe de marketing reescribió|hecho", "Pasó los controles automáticos|hecho", "La jefatura revisó|hecho"]))
  })
  it("por hacer o en curso siguen en presente", () => {
    expect(pasos({})).toEqual(expect.arrayContaining(["Controles automáticos|en_curso", "La jefatura revisa|pendiente"]))
  })
})
