/** CLIENTES · lógica pura + lectura con base falsa. US$ 0, sin red. La prueba contra la base viva está en clientes-viva.test.ts. */
import { describe, expect, it, vi } from "vitest"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { etiquetaDelCliente, fasesDelPlan, gastoReal, ordenarClientes, origenDelManual, type ResumenDeCliente } from "@/lib/clientes"
import { cargarFicha, listarClientes } from "@/lib/clientes-datos"

// el gasto por cliente sale de la MISMA lectura que la pantalla Gasto: aquí se sustituye por una cifra conocida
vi.mock("@/lib/gasto-datos", () => ({ leerGasto: async () => ({ resumen: { por_cliente: [{ clave: "11111111-1111-1111-1111-111111111111", nombre: "Náufrago", total: 0.9, llamadas: 3 }, { clave: "2", nombre: "Otro", total: 9, llamadas: 1 }] } }) }))

describe("gasto por cliente", () => {
  it("suma sin los ensayos (dry_run) y tolera basura", () => {
    expect(gastoReal([{ cost_usd: 1.5 }, { cost_usd: "2.25" }, { cost_usd: 9, dry_run: true }, { cost_usd: null }, { cost_usd: "x" }], "cost_usd")).toBe(3.75)
    expect(gastoReal([{ gasto_usd: 0.1 }, { gasto_usd: 0.2 }], "gasto_usd")).toBe(0.3)
    expect(gastoReal([], "cost_usd")).toBe(0)
  })
})

describe("etiquetas y manual", () => {
  it("el estado del cliente se dice en español y lo desconocido se muestra tal cual", () => {
    expect(etiquetaDelCliente("active")).toBe("Cliente activo")
    expect(etiquetaDelCliente("onboarding")).toBe("Cliente nuevo, en preparación")
    expect(etiquetaDelCliente("raro")).toBe("Sin estado definido")
    expect(etiquetaDelCliente(null)).toBe("Sin estado definido")
  })
  it("el manual: validado por persona gana; generado sin validar es PROPUESTA; sin manual lo dice", () => {
    expect(origenDelManual(null)).toEqual({ texto: "Sin manual de marca", propuesta: false })
    expect(origenDelManual({ auto_generated: true, human_validated: true })).toMatchObject({ propuesta: false, texto: "Validado por una persona" })
    expect(origenDelManual({ auto_generated: true, human_validated: false })).toMatchObject({ propuesta: true })
    expect(origenDelManual({ auto_generated: false, human_validated: false })).toMatchObject({ propuesta: false, texto: "Escrito a mano · sin validar" })
  })
  it("las fases del plan salen del contenido o quedan vacías", () => {
    expect(fasesDelPlan({ fases: [{ clave: "f1", objetivo: "armado", cita_plan: "Arreglar la base", dia_desde: 1, dia_hasta: 7 }, null, 5] })).toEqual([{ clave: "f1", objetivo: "armado", cita_plan: "Arreglar la base", dia_desde: 1, dia_hasta: 7 }])
    expect(fasesDelPlan(null)).toEqual([])
    expect(fasesDelPlan({ fases: "no" })).toEqual([])
  })
})

describe("orden de la lista", () => {
  const c = (nombre: string, p: number, g: number): ResumenDeCliente => ({ id: nombre, nombre, rubro: null, estado: "active", piezas_por_aprobar: p, gasto_30d: g, trozos_del_cerebro: 0, campana: null, de_baja: false, de_practica: false })
  it("primero los que tienen piezas por aprobar, luego por gasto, luego por nombre", () => {
    expect(ordenarClientes([c("B", 0, 5), c("A", 0, 5), c("C", 2, 0), c("D", 0, 9)]).map((x) => x.nombre)).toEqual(["C", "D", "A", "B"])
  })
})

/** base falsa mínima: cada tabla devuelve sus filas; `.eq/.is/.not/.gte` filtran por igualdad simple; guarda las lecturas fallidas */
function baseFalsa(tablas: Record<string, Array<Record<string, unknown>>>, fallan: string[] = []) {
  const from = (t: string) => {
    let filas = [...(tablas[t] ?? [])]
    const b: Record<string, unknown> = {}
    b.select = (_c?: string, o?: { head?: boolean }) => { (b as { head?: boolean }).head = o?.head; return b }
    b.eq = (c: string, v: unknown) => { filas = filas.filter((f) => f[c] === v); return b }
    b.is = (c: string, v: unknown) => { filas = filas.filter((f) => (f[c] ?? null) === v); return b }
    b.not = (c: string, _op: string, v: unknown) => { filas = filas.filter((f) => (f[c] ?? null) !== v); return b }
    b.gte = () => b
    b.ilike = () => b
    b.order = () => b
    b.limit = (n: number) => { filas = filas.slice(0, n); return b }
    b.maybeSingle = () => Promise.resolve(fallan.includes(t) ? { data: null, error: { message: "boom" } } : { data: filas[0] ?? null, error: null })
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve(fallan.includes(t) ? { data: null, count: null, error: { message: "boom" } } : { data: filas, count: filas.length, error: null }).then(ok)
    return b
  }
  return { from } as unknown as SupabaseClient
}
const ID = "11111111-1111-1111-1111-111111111111"
const TABLAS = () => ({
  clients: [{ id: ID, name: "Náufrago", industry: "restaurante", status: "active", market: "EC", website_url: "https://x.ec", created_at: "2026-06-01T00:00:00Z", archived_at: null }, { id: "2", name: "Otro", industry: null, status: "paused", archived_at: null }],
  hitl_queue: [{ id: "h1", client_id: ID, type: "content_piece_review", status: "pending", title: "⚠️ Pieza A", created_at: "2026-10-28T00:00:00Z" }, { id: "h2", client_id: ID, type: "content_piece_review", status: "approved", title: "Pieza B", created_at: "2026-10-27T00:00:00Z" }],
  agent_invocations: [{ client_id: ID, cost_usd: 0.5 }, { client_id: ID, cost_usd: 0.25 }, { client_id: "2", cost_usd: 9 }],
  oficina_encargos: [{ client_id: ID, gasto_usd: 1.5, dry_run: false }, { client_id: ID, gasto_usd: 7, dry_run: true }],
  cerebro_fichas: [{ client_id: ID, retirada_en: null }, { client_id: ID, retirada_en: "2026-10-01" }],
  client_brain_chunks: [{ client_id: ID }, { client_id: ID }, { client_id: ID }],
  cadena_campanas: [{ id: "c1", client_id: ID, estado: "activa", seco: false, fecha_inicio: "2026-10-01", fecha_fin: "2026-12-30", presupuesto_planificacion_usd: 500 }],
  cadena_estrategias: [{ campana_id: "c1", version: 1, seco: false, contenido: { fases: [{ clave: "f1", objetivo: "armado", dia_desde: 1, dia_hasta: 7 }] } }],
  cadena_calendario_filas: [{ campana_id: "c1", seco: false }, { campana_id: "c1", seco: false }],
  client_brand_books: [{ client_id: ID, version: 2, brand_purpose: "Propósito", tagline: "Lema", voice_description: "cercana", auto_generated: true, human_validated: false, gate_outcome: null }],
  client_icp_documents: [{ client_id: ID }],
})

describe("la lista y la ficha leen lo que dice la base", () => {
  it("lista: piezas por aprobar, gasto y fichas por cliente; ensayo no cuenta", async () => {
    const l = await listarClientes(baseFalsa(TABLAS()))
    expect(l.map((x) => x.nombre)).toEqual(["Náufrago", "Otro"])
    expect(l[0]).toMatchObject({ piezas_por_aprobar: 1, gasto_30d: 0.9, trozos_del_cerebro: 1, campana: "activa" }) // el estado crudo; la pantalla lo traduce
    expect(l[1]).toMatchObject({ piezas_por_aprobar: 0, gasto_30d: 9, campana: null })
  })
  it("ficha: piezas, plan con fases, gasto sin ensayos, cerebro, manual propuesta", async () => {
    const f = (await cargarFicha(baseFalsa(TABLAS()), ID))!
    expect(f.cliente.nombre).toBe("Náufrago")
    expect(f.piezas.map((p) => [p.titulo, p.estado])).toEqual([["Pieza · 27 oct", "por aprobar"], ["Pieza · 26 oct", "aprobada"]])
    expect(f.plan).toMatchObject({ campana_estado: "activa", presupuesto: 500, version_estrategia: 1, filas_del_calendario: 2 })
    expect(f.plan!.fases).toHaveLength(1)
    expect(f.gasto).toMatchObject({ tope_24h: null, total_30d: 0.9, agentes_30d: 0.75, piezas_30d: 1.5, llamadas_30d: 2 })
    expect(f.cerebro).toEqual({ fichas_vigentes: 1, trozos: 3 })
    expect(f.manual).toMatchObject({ version: 2, auto_generated: true, human_validated: false })
    expect(f.perfiles_de_cliente_ideal).toBe(1)
  })
  it("cliente que no existe → null; cliente sin plan ni manual lo dice con null, no inventa", async () => {
    expect(await cargarFicha(baseFalsa(TABLAS()), "99999999-9999-9999-9999-999999999999")).toBeNull()
    const f = (await cargarFicha(baseFalsa({ ...TABLAS(), cadena_campanas: [], client_brand_books: [] }), ID))!
    expect(f.plan).toBeNull()
    expect(f.manual).toBeNull()
  })
  it("un error de la base NO se lee como cero: la lectura lanza", async () => {
    await expect(listarClientes(baseFalsa(TABLAS(), ["hitl_queue"]))).rejects.toThrow(/hitl_queue: boom/)
    await expect(cargarFicha(baseFalsa(TABLAS(), ["hitl_queue"]), ID)).rejects.toThrow(/hitl_queue: boom/)
  })
})

describe("las puertas de Clientes", () => {
  const leer = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8")
  it("las dos páginas llaman a exigirAdmin antes de leer y /clientes es solo de administrador en el middleware", () => {
    for (const p of ["app/clientes/page.tsx", "app/clientes/[id]/page.tsx"]) {
      const t = leer(p)
      expect(t.indexOf("exigirAdmin()"), p).toBeGreaterThan(-1)
      expect(t.indexOf("exigirAdmin()"), p).toBeLessThan(t.indexOf("getServiceRoleClient()"))
    }
    expect(leer("middleware.ts")).toMatch(/ADMIN_ONLY_PREFIXES = \[[^\]]*"\/clientes"/)
  })
})
