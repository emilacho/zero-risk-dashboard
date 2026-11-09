/**
 * CC4 · 06-nov · encargo de Lenovo «panel del plan · errores», punto 1: el panel ofrecía «Aprobar el plan así» sobre el plan r3 rechazado el 4-nov.
 * El panel lee la vigencia con la MISMA regla que el cerebro (#930/#931) y el alta (#928 `d46bf35`): `lib/plan-vigencia.ts`.
 * Un plan rechazado, reemplazado o vencido nunca se ofrece para aprobar; mientras se escribe uno nuevo, «En preparación».
 * Las filas de Náufrago son las reales (lectura de la base del 06-nov), recortadas a las columnas que lee la regla.
 */
import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { estadoDeLaSalida, vigenciaDeLosPlanes, decisionesDeLaCola, vencimientosDeLaCola, aprobacionesPorPlan } from "@/lib/plan-vigencia"
import { leerElCiclo, type CicloDelPlan } from "@/lib/plan"
import { leerPlanDelCliente, type PlanDelCliente } from "@/lib/plan-datos"
import { estadoDelPlan } from "@/lib/manual-primero"
import { barraDelPlan } from "@/lib/plan-barra"
import { PanelPlan } from "@/components/nuevo/PanelPlan"
import { faseActiva } from "@/lib/pizarron"

const CLIENTE = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const R3 = "7554b590-f13b-4d4f-9892-e056b7a62aa2", R3_PREVIO = "85d5bb1c-f96f-4c9b-b6a6-142de16ab17a", R1 = "0b8e7c16-2961-473c-9430-f11674440b65"
const NUEVO = "11111111-2222-4333-8444-555566667777"
// las tres versiones reales de Náufrago, de la más nueva a la más vieja
const PLANES = [
  { id: R3, status: "rejected", created_at: "2026-11-04T13:49:27.679526+00:00", provenance_tag: { orden: "2026-11-05-GO-LENOVO-a-CC1-cerrar-el-plan-r3-como-rechazado.md", fuente: "planeacion", version: 1, vigente: true, compuerta: true } },
  { id: R3_PREVIO, status: "draft", created_at: "2026-11-04T13:39:14.286858+00:00", provenance_tag: { fuente: "planeacion", version: 1, vigente: false, compuerta: true } },
  { id: R1, status: "draft", created_at: "2026-11-03T13:18:47.285613+00:00", provenance_tag: { fuente: "planeacion", version: 1, vigente: false, compuerta: true } },
]
const COLA = [
  { output_id: R1, type: "plan_con_pendientes", status: "rejected", resolved_by: "cc1", reviewer: null, decision: { por: "cc1", cuando: "2026-11-03T20:40:06.795297+00:00", motivo: "reemplazado_al_aprobar_el_manual", vencida: true, decision: "rejected" } },
  { output_id: R3_PREVIO, type: "palabra_del_dueno", status: "rejected", resolved_by: "dueño · ejecuta CC1", reviewer: "emilio", decision: { por: "dueño · ejecuta CC1", cuando: "2026-11-05T10:11:54.545Z" } },
  { output_id: R3, type: "plan_con_pendientes", status: "rejected", resolved_by: "dueño · ejecuta CC1", reviewer: "emilio", decision: { por: "dueño · ejecuta CC1", cuando: "2026-11-05T10:11:54.545Z" } },
]
const APROBACIONES = [
  { plan_id: R1, estado: "reemplazado", version: 1, creado_en: "2026-11-03T13:26:58.787422+00:00" },
  { plan_id: R3, estado: "reemplazado", version: 1, creado_en: "2026-11-04T13:49:29.317338+00:00" },
]

describe("la regla de vigencia es la de la plataforma (copia fiel de estado-en-plataforma.ts)", () => {
  it("las tres versiones reales de Náufrago están cerradas: ninguna es vigente", () => {
    const v = vigenciaDeLosPlanes(PLANES, COLA, APROBACIONES)
    expect(v.get(R3)).toMatchObject({ estado: "rechazado", cerrada: true, motivo: "rechazado en la plataforma" })
    expect(v.get(R3_PREVIO)).toMatchObject({ estado: "reemplazado", cerrada: true })
    expect(v.get(R1)).toMatchObject({ estado: "reemplazado", cerrada: true })
  })
  it("cada salida de la regla, caso por caso", () => {
    expect(estadoDeLaSalida({ status: "rejected", provenance_tag: { rechazado_por: "el dueño", nota_de_rechazo: "flojo" } })).toMatchObject({ estado: "rechazado", motivo: "rechazado en la plataforma por el dueño: flojo" })
    expect(estadoDeLaSalida({ status: "rejected", provenance_tag: { superada: true } }).estado).toBe("abierto") // una fila superada no es una decisión
    expect(estadoDeLaSalida({ status: "draft", provenance_tag: { superseded_por: "x" } }).estado).toBe("reemplazado")
    expect(estadoDeLaSalida({ status: "draft" }, { aprobacion: "reemplazado" }).estado).toBe("reemplazado")
    expect(estadoDeLaSalida({ status: "draft" }, { decision: "rechazada", decision_en: "2026-11-05T00:00:00.000Z", decision_por: "emilio" })).toMatchObject({ estado: "rechazado", motivo: "rechazado en la revisión por emilio" })
    expect(estadoDeLaSalida({ status: "draft" }, { vencida_en: "2026-11-05T00:00:00.000Z" }).estado).toBe("vencido")
    expect(estadoDeLaSalida({ status: "approved" }, { vencida_en: "2026-11-05T00:00:00.000Z" }).estado).toBe("aprobado") // aprobado por estado no vence
    expect(estadoDeLaSalida({ status: "draft" }, { decision: "rechazada", decision_en: "2026-11-01T00:00:00.000Z", vencida_en: "2026-11-05T00:00:00.000Z" }).estado).toBe("vencido") // venció DESPUÉS
    expect(estadoDeLaSalida({ status: "draft" }, { aprobacion: "cambios_pedidos" }).estado).toBe("abierto")
    expect(estadoDeLaSalida({ status: "draft" }, { aprobacion: "aprobado" }).estado).toBe("aprobado")
    expect(estadoDeLaSalida({ status: "draft" }, { decision: "aprobada", aprobacion: "pendiente" }).estado).toBe("aprobado")
    expect(estadoDeLaSalida({ status: "draft" }, { aprobacion: "pendiente" })).toMatchObject({ estado: "abierto", cerrada: false })
  })
  it("la cola: una limpieza, lo vencido y la decisión sobre una sola parte no son decisiones; gana la última", () => {
    const d = decisionesDeLaCola([
      { output_id: "a", type: "plan_con_pendientes", status: "rejected", resolved_by: "limpieza de cc1", resolved_at: "2026-11-05T00:00:00Z" },
      { output_id: "b", type: "palabra_del_dueno", status: "rejected", resolved_at: "2026-11-05T00:00:00Z" },
      { output_id: "c", type: "plan_con_pendientes", status: "rejected", decision: { vencida: true }, resolved_at: "2026-11-05T00:00:00Z" },
      { output_id: "e", type: "plan_con_pendientes", status: "approved", decision: { no_es_decision_real: true }, resolved_at: "2026-11-05T00:00:00Z" },
      { output_id: "f", type: "plan_con_pendientes", status: "rejected", resolved_at: "2026-11-01T00:00:00Z" },
      { output_id: "f", type: "plan_con_pendientes", status: "approved", resolved_at: "2026-11-02T00:00:00Z", reviewer: "emilio" },
    ])
    expect([...d.keys()]).toEqual(["f"]); expect(d.get("f")).toMatchObject({ decision: "aprobada", por: "emilio" })
    const v = vencimientosDeLaCola([{ output_id: "c", type: "plan_con_pendientes", status: "rejected", decision: { vencida: true, por: "cc1" }, resolved_at: "2026-11-05T00:00:00Z" }, { output_id: "b", type: "palabra_del_dueno", decision: { vencida: true } }])
    expect([...v.keys()]).toEqual(["c"]); expect(v.get("c")?.por).toBe("cc1")
    // la aprobación más reciente por versión y luego por fecha
    expect(aprobacionesPorPlan([{ plan_id: "p", estado: "aprobado", version: 2, creado_en: "2026-11-01" }, { plan_id: "p", estado: "pendiente", version: 1, creado_en: "2026-11-05" }]).get("p")).toBe("aprobado")
    expect(aprobacionesPorPlan([{ plan_id: "p", estado: "pendiente", version: 1, creado_en: "2026-11-01" }, { plan_id: "p", estado: "reemplazado", version: 1, creado_en: "2026-11-05" }]).get("p")).toBe("reemplazado")
  })
})

const base: CicloDelPlan = { disponible: true, version: 1, historial: [], con_compuerta: true, compuerta: { estado: "pendiente", decidido_por: null, decidido_en: null, despertado: null, despertar_detalle: null }, pedido: null, avance: null }
describe("el ciclo: lo cerrado nunca se ofrece para aprobar", () => {
  it("cerrado y con el plan nuevo escribiéndose: «En preparación», sin botones", () => {
    const l = leerElCiclo("rejected", { ...base, cerrado: { estado: "rechazado", motivo: "rechazado en la plataforma" }, preparando: { desde: "2026-11-05T22:40:19Z", vence_en: null } })
    expect(l).toMatchObject({ estado: "en_preparacion", titulo: "En preparación", puede_aprobar: false, puede_pedir_cambios: false, reintentar: null })
    expect(l.detalle).toContain("fue rechazado"); expect(l.detalle).not.toMatch(/CC\d|plataforma|cc1/i) // sin nombres internos
  })
  it("cerrado y sin nada escribiéndose: el estado en una palabra (Rechazado, Reemplazado, Vencido), sin botones; vale para rechazado, reemplazado y vencido", () => {
    for (const [estado, paso] of [["rechazado", "Rechazado"], ["reemplazado", "Reemplazado"], ["vencido", "Vencido"]] as const) {
      const l = leerElCiclo("draft", { ...base, cerrado: { estado, motivo: null } })
      expect(l).toMatchObject({ estado: "sin_plan_vigente", titulo: paso, puede_aprobar: false, puede_pedir_cambios: false }) // el estado en una palabra (Emilio, 06-nov)
      expect(l.detalle).toContain("solo para consulta")
    }
  })
  it("lo cerrado manda aunque la fila diga aprobado o la compuerta esté aprobada o haya un pedido abierto", () => {
    const cerrado = { estado: "reemplazado" as const, motivo: null }
    expect(leerElCiclo("approved", { ...base, cerrado }).estado).toBe("sin_plan_vigente")
    expect(leerElCiclo("draft", { ...base, cerrado, compuerta: { estado: "aprobado", decidido_por: null, decidido_en: null, despertado: false, despertar_detalle: null } })).toMatchObject({ estado: "sin_plan_vigente", reintentar: null })
    expect(leerElCiclo("draft", { ...base, cerrado, pedido: { id: "p", estado: "pendiente", texto: "x", vuelta: 1, despertado: true, despertar_detalle: null } }).puede_pedir_cambios).toBe(false)
  })
  it("control: sin cierre, la misma versión sigue esperando tu decisión", () => {
    expect(leerElCiclo("draft", { ...base, cerrado: null })).toMatchObject({ estado: "esperando_decision", puede_aprobar: true })
  })
})

/** base falsa: contesta por tabla; cualquier escritura rompe la prueba */
function baseFalsa(respuestas: Record<string, unknown | ((f: string[]) => unknown)>, registro: string[] = [], errores: Record<string, { message: string; code?: string }> = {}) {
  const consulta = (tabla: string): unknown => {
    const q: Record<string, unknown> = {}
    const filtros: string[] = []
    const enc = (n: string) => (...a: unknown[]) => { const f = `${tabla}.${n}(${a.map((x) => JSON.stringify(x)).join(",")})`; registro.push(f); filtros.push(f); return q }
    for (const n of ["select", "eq", "in", "is", "order", "limit", "gte", "neq"]) q[n] = enc(n)
    const resolver = () => { const r = respuestas[tabla]; return typeof r === "function" ? (r as (f: string[]) => unknown)(filtros) : r }
    const err = errores[tabla] ?? null
    q.maybeSingle = () => { const r = resolver(); return Promise.resolve({ data: err ? null : Array.isArray(r) ? r[0] ?? null : r ?? null, error: err }) }
    q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => { const r = resolver(); return Promise.resolve(err ? { data: null, error: err } : { data: r ?? [], error: null }).then(res, rej) }
    for (const n of ["insert", "update", "upsert", "delete", "rpc"]) q[n] = () => { throw new Error(`escritura prohibida: ${tabla}.${n}`) }
    return q
  }
  return { from: consulta } as unknown as Parameters<typeof leerPlanDelCliente>[0]
}
const CLIENTES = [{ id: CLIENTE, name: "Náufrago", industry: "restaurante", status: "active", archived_at: null }]
const conTexto = (p: (typeof PLANES)[number]) => ({ ...p, title: `Plan ${p.id.slice(0, 4)}`, content_text: `Prosa ${p.id.slice(0, 4)}`, content: null, updated_at: null })
/** el documento pedido por id, o la lista; la cola de revisión del plan (la del tablero) va vacía salvo la de vigencia (filtrada por output_id) */
const salidas = (planes: typeof PLANES) => (f: string[]) => { const porId = f.find((x) => x.includes('.eq("id"')); return porId ? planes.filter((p) => porId.includes(p.id)).map(conTexto) : planes.map(conTexto) }
const cola = (f: string[]) => (f.some((x) => x.includes('.in("output_id"')) ? COLA : [])

describe("la lectura del panel con los datos reales de Náufrago", () => {
  it("todo cerrado y la corrida r4 en curso: muestra r3 como «En preparación», sin «Aprobar el plan así»", async () => {
    const registro: string[] = []
    const b = baseFalsa({
      clients: CLIENTES, cadena_campanas: [], hitl_queue: cola, client_historical_outputs: salidas(PLANES), plan_cambios: [],
      plan_aprobaciones: (f: string[]) => (f.some((x) => x.includes('.eq("client_id"')) ? APROBACIONES : APROBACIONES.filter((a) => f.some((x) => x.includes(a.plan_id)))),
      plan_corridas: (f: string[]) => (f.some((x) => x.includes('"estado","corriendo"')) && f.some((x) => x.includes('"dry_run",false')) ? [{ estado: "corriendo", creado_en: "2026-11-05T22:40:19.578665+00:00", vence_en: "2026-11-06T02:09:46.635+00:00", dry_run: false }] : []),
    }, registro)
    const p = await leerPlanDelCliente(b, { cliente: CLIENTE })
    expect(p.documento?.id).toBe(R3)
    expect(p.ciclo).toMatchObject({ cerrado: { estado: "rechazado" }, preparando: { desde: "2026-11-05T22:40:19.578665+00:00" } })
    expect(leerElCiclo(p.documento!.status, p.ciclo!)).toMatchObject({ estado: "en_preparacion", puede_aprobar: false })
    expect(registro.join("\n")).toContain(`hitl_queue.eq("client_id","${CLIENTE}")`)
    const html = renderToStaticMarkup(createElement(PanelPlan, { onCerrar: () => {}, datosIniciales: p }))
    expect(html).toContain('data-ciclo="en_preparacion"'); expect(html).toContain("En preparación")
    expect(html).not.toContain('data-accion="plan-aprobar-asi"'); expect(html).not.toContain('data-accion="plan-pedir-cambios"'); expect(html).not.toContain("Espera tu decisión")
    expect(estadoDelPlan({ ...p, manual_aprobado: true }).texto).toBe("plan en preparación")
    expect(barraDelPlan({ ...p, manual_aprobado: true }).te_toca).not.toContain("Aprobar el plan o pedir cambios")
  })
  it("todo cerrado y sin corrida: «Sin plan vigente»", async () => {
    const p = await leerPlanDelCliente(baseFalsa({ clients: CLIENTES, cadena_campanas: [], hitl_queue: cola, client_historical_outputs: salidas(PLANES), plan_cambios: [], plan_aprobaciones: APROBACIONES, plan_corridas: [] }), { cliente: CLIENTE })
    expect(p.ciclo?.preparando).toBeNull()
    expect(leerElCiclo(p.documento!.status, p.ciclo!)).toMatchObject({ estado: "sin_plan_vigente", puede_aprobar: false, puede_pedir_cambios: false })
  })
  it("cuando llega el plan nuevo, ESE es el que se muestra y se puede decidir (control)", async () => {
    const nuevo = { id: NUEVO, status: "draft", created_at: "2026-11-06T09:00:00Z", provenance_tag: { fuente: "planeacion", version: 1, vigente: true, compuerta: true } }
    const todos = [nuevo, ...PLANES] as typeof PLANES
    const p = await leerPlanDelCliente(baseFalsa({
      clients: CLIENTES, cadena_campanas: [], hitl_queue: cola, client_historical_outputs: salidas(todos), plan_cambios: [], plan_corridas: [],
      plan_aprobaciones: (f: string[]) => (f.some((x) => x.includes('.eq("client_id"')) ? [...APROBACIONES, { plan_id: NUEVO, estado: "pendiente", version: 1, creado_en: "2026-11-06T09:00:01Z" }] : f.some((x) => x.includes(NUEVO)) ? [{ plan_id: NUEVO, estado: "pendiente", decidido_por: null, decidido_en: null, despertado: null, despertar_detalle: null }] : []),
    }), { cliente: CLIENTE })
    expect(p.documento?.id).toBe(NUEVO); expect(p.ciclo?.cerrado).toBeNull()
    expect(leerElCiclo(p.documento!.status, p.ciclo!)).toMatchObject({ estado: "esperando_decision", puede_aprobar: true })
  })
  it("un plan nuevo pero que ya rechazaste en la revisión no gana sobre nada: la cola manda aunque la fila siga en borrador", async () => {
    const nuevo = { id: NUEVO, status: "draft", created_at: "2026-11-06T09:00:00Z", provenance_tag: { fuente: "planeacion", version: 1, vigente: true, compuerta: true } }
    const p = await leerPlanDelCliente(baseFalsa({
      clients: CLIENTES, cadena_campanas: [], client_historical_outputs: salidas([nuevo, ...PLANES] as typeof PLANES), plan_cambios: [], plan_corridas: [], plan_aprobaciones: APROBACIONES,
      hitl_queue: (f: string[]) => (f.some((x) => x.includes('.in("output_id"')) ? [...COLA, { output_id: NUEVO, type: "plan_con_pendientes", status: "rejected", reviewer: "emilio", resolved_at: "2026-11-06T10:00:00Z" }] : []),
    }), { cliente: CLIENTE })
    expect(p.documento?.id).toBe(NUEVO)
    expect(p.ciclo?.cerrado).toMatchObject({ estado: "rechazado", motivo: "rechazado en la revisión por emilio" })
    expect(leerElCiclo(p.documento!.status, p.ciclo!).puede_aprobar).toBe(false)
  })
  it("si la más nueva está cerrada pero una anterior sigue abierta, se muestra la abierta (no la más nueva)", async () => {
    const vieja = { id: NUEVO, status: "approved", created_at: "2026-11-01T09:00:00Z", provenance_tag: { fuente: "planeacion", version: 1, vigente: true } }
    const p = await leerPlanDelCliente(baseFalsa({ clients: CLIENTES, cadena_campanas: [], hitl_queue: cola, client_historical_outputs: salidas([...PLANES, vieja] as typeof PLANES), plan_cambios: [], plan_corridas: [], plan_aprobaciones: APROBACIONES }), { cliente: CLIENTE })
    expect(p.documento?.id).toBe(NUEVO); expect(p.ciclo?.cerrado).toBeNull()
  })
  it("la aprobación «reemplazado» sola ya cierra la versión, aunque la fila siga vigente y en borrador", async () => {
    const nuevo = { id: NUEVO, status: "draft", created_at: "2026-11-06T09:00:00Z", provenance_tag: { fuente: "planeacion", version: 1, vigente: true } }
    const p = await leerPlanDelCliente(baseFalsa({
      clients: CLIENTES, cadena_campanas: [], hitl_queue: cola, client_historical_outputs: salidas([nuevo, ...PLANES] as typeof PLANES), plan_cambios: [], plan_corridas: [],
      plan_aprobaciones: [...APROBACIONES, { plan_id: NUEVO, estado: "reemplazado", version: 1, creado_en: "2026-11-06T09:30:00Z" }],
    }), { cliente: CLIENTE })
    expect(p.documento?.id).toBe(NUEVO); expect(p.ciclo?.cerrado).toMatchObject({ estado: "reemplazado" })
  })
  it("con campaña que apunta a una versión vieja y todo cerrado, se muestra la más nueva (no la de la campaña)", async () => {
    const camp = [{ id: "c0c0c0c0-1111-4222-8333-444455556666", plan_id: R1, estado: "pausada", client_id: CLIENTE, seco: false, creada_en: "2026-11-03T00:00:00Z" }]
    const p = await leerPlanDelCliente(baseFalsa({ clients: CLIENTES, cadena_campanas: camp, cadena_calendario_filas: [], cadena_estrategias: [], cadena_esperas: [], plan_catalogo_topes: [], hitl_queue: cola, client_historical_outputs: salidas(PLANES), plan_cambios: [], plan_corridas: [], plan_aprobaciones: APROBACIONES }), { cliente: CLIENTE })
    expect(p.documento?.id).toBe(R3)
  })
  it("la cola de vigencia se lee SOLO del cliente (nunca la de otro cliente con el mismo plan)", async () => {
    const registro: string[] = []
    await leerPlanDelCliente(baseFalsa({ clients: CLIENTES, cadena_campanas: [], hitl_queue: cola, client_historical_outputs: salidas(PLANES), plan_cambios: [], plan_corridas: [], plan_aprobaciones: APROBACIONES }, registro), { cliente: CLIENTE })
    const i = registro.findIndex((x) => x.startsWith('hitl_queue.in("output_id"'))
    expect(i).toBeGreaterThan(0); expect(registro[i - 1]).toBe(`hitl_queue.eq("client_id","${CLIENTE}")`)
    expect(registro).toContain(`plan_aprobaciones.eq("client_id","${CLIENTE}")`)
  })
  it("una corrida de OTRO cliente en curso no hace decir «En preparación» (pedido de CC6 en la certificación de #291)", async () => {
    const OTRO = "99999999-8888-4777-8666-555544443333"
    const corridas = [{ client_id: OTRO, estado: "corriendo", creado_en: "2026-11-06T00:00:00Z", vence_en: null, dry_run: false }]
    const p = await leerPlanDelCliente(baseFalsa({
      clients: CLIENTES, cadena_campanas: [], hitl_queue: cola, client_historical_outputs: salidas(PLANES), plan_cambios: [], plan_aprobaciones: APROBACIONES,
      // la base falsa respeta el filtro por cliente: sin él, devolvería la corrida del otro cliente
      plan_corridas: (f: string[]) => { const id = f.map((x) => x.match(/plan_corridas\.eq\("client_id","([^"]+)"\)/)?.[1]).find(Boolean); return id ? corridas.filter((c) => c.client_id === id) : corridas },
    }), { cliente: CLIENTE })
    expect(p.ciclo?.preparando).toBeNull()
    expect(leerElCiclo(p.documento!.status, p.ciclo!).estado).toBe("sin_plan_vigente")
  })
  it("si la cola no se puede leer, lanza: no se adivina que un plan está abierto", async () => {
    await expect(leerPlanDelCliente(baseFalsa({ clients: CLIENTES, cadena_campanas: [], client_historical_outputs: salidas(PLANES), plan_cambios: [], plan_aprobaciones: APROBACIONES, plan_corridas: [] }, [], { hitl_queue: { message: "se cayó la base" } }), { cliente: CLIENTE })).rejects.toThrow(/se cayó la base/)
  })
})

// el panel pinta los dos estados nuevos con su color, sin botones
describe("el panel", () => {
  const datos = (ciclo: CicloDelPlan): PlanDelCliente => ({
    clientes: [{ id: CLIENTE, nombre: "Náufrago", con_campana: false }], cliente: { id: CLIENTE, nombre: "Náufrago" }, hoy: "2026-11-06",
    campana: null, estrategia: null, fase_activa: faseActiva([], null, "2026-11-06"), revision: null, esperas: { vivas: 0, grupos: [], vencidas: { n: 0, grupos: [] } }, topes: [], leido_en: "x", manual_aprobado: true,
    documento: { id: R3, titulo: "Plan", creado_en: null, actualizado_en: null, status: "rejected", estado_del_plan: null, marcas: [], aviso_del_chequeo: [], no_se_busco: [], jefatura: null, plan: null, prosa: "Prosa", caracteres: 5, que_cambio: null },
    ciclo,
  })
  it("«Sin plan vigente» con su color gris y el aviso de que lo de abajo es solo consulta", () => {
    const html = renderToStaticMarkup(createElement(PanelPlan, { onCerrar: () => {}, datosIniciales: datos({ ...base, cerrado: { estado: "rechazado", motivo: null } }) }))
    expect(html).toContain('data-estado-ciclo="sin_plan_vigente"'); expect(html).toMatch(/data-estado-ciclo="sin_plan_vigente" class="[^"]*border-zinc-400/)
    expect(html).toContain("solo para consulta"); expect(html).not.toContain('data-accion="plan-aprobar-asi"')
  })
})
