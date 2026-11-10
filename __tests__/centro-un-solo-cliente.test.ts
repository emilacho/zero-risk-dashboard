/**
 * GO Lenovo 10-nov 14:37Z (falla 2, hallada por CC2): el Centro SIN cliente elegido mezclaba datos. El brief y la gran idea elegían solos el primer
 * cliente y el manual, el plan, los informes y el dinero leían «ningún cliente» (cuadros vacíos). Ahora el cliente se resuelve UNA vez y todo usa ese.
 * Dos clientes de práctica de rubros distintos, con una base de mentira que SÍ filtra por cliente (si el Centro leyera el de otro, se vería).
 */
import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { leerCentro } from "@/lib/centro-datos"

const FERRETERIA = "00000000-0000-4000-8000-00000000f001"
const CAFETERIA = "00000000-0000-4000-8000-00000000c002"

type Respuesta = { data: unknown; error: { message: string } | null }
/** una base que respeta `.eq(columna, valor)`: cada tabla devuelve solo las filas que cumplen los filtros */
function baseQueFiltra(tablas: Record<string, Array<Record<string, unknown>>>, leidas: Array<{ tabla: string; cliente: unknown }>): SupabaseClient {
  const from = (tabla: string) => {
    let una = false
    const filtros: Array<[string, unknown]> = []
    const resolver = (): Respuesta => {
      const filas = (tablas[tabla] ?? []).filter((f) => filtros.every(([c, v]) => f[c] === undefined || f[c] === v))
      const cli = filtros.find(([c]) => c === "client_id")
      if (cli) leidas.push({ tabla, cliente: cli[1] })
      return { data: una ? filas[0] ?? null : filas, error: null }
    }
    const cadena: Record<string, unknown> = {}
    for (const m of ["select", "is", "gte", "in", "order", "limit", "not", "neq"]) cadena[m] = () => cadena
    cadena.eq = (c: string, v: unknown) => { filtros.push([c, v]); return cadena }
    cadena.maybeSingle = () => { una = true; return cadena }
    cadena.then = (ok: (r: Respuesta) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resolver()).then(ok, ko)
    return cadena
  }
  return { from } as unknown as SupabaseClient
}

const datos = () => ({
  // «Café Brisa» va primero en la lista (orden alfabético), aunque en la tabla venga segundo
  clients: [
    { id: FERRETERIA, name: "Ferretería Andes", industry: "ferretería y construcción", status: "active", archived_at: null },
    { id: CAFETERIA, name: "Café Brisa", industry: "cafetería", status: "active", archived_at: null },
    { id: PRACTICA, name: "Práctica Taller Mecánico", industry: "prueba", status: "active", archived_at: null },
  ],
  client_brand_books: [
    { client_id: CAFETERIA, version: 2, human_validated: true, provenance_tag: {}, created_at: "2026-11-02T10:00:00Z" },
    { client_id: CAFETERIA, version: 1, human_validated: false, provenance_tag: {}, created_at: "2026-11-01T10:00:00Z" },
    { client_id: FERRETERIA, version: 7, human_validated: false, provenance_tag: {}, created_at: "2026-11-09T10:00:00Z" },
  ],
  client_historical_outputs: [
    { client_id: CAFETERIA, output_type: "campaign_plan_90d", status: "approved", provenance_tag: { version: 3 }, created_at: "2026-11-05T00:00:00Z", updated_at: "2026-11-05T01:00:00Z" },
    { client_id: FERRETERIA, output_type: "campaign_plan_90d", status: "pending", provenance_tag: { version: 1 }, created_at: "2026-11-08T00:00:00Z" },
  ],
  cerebro_fichas: [
    { client_id: FERRETERIA, clase: "informe_de_analisis", descartada: false, id: "f1", titulo: "Informe · ventas · semana", contenido: "ventas de la ferretería", creado_en: "2026-11-08T00:00:00Z", provenance_tag: {} },
    { client_id: FERRETERIA, clase: "informe_de_analisis", descartada: false, id: "f2", titulo: "Informe · competencia · semana", contenido: "competencia", creado_en: "2026-11-08T00:00:00Z", provenance_tag: {} },
    { client_id: CAFETERIA, clase: "informe_de_analisis", descartada: false, id: "f3", titulo: "Informe · ventas · semana", contenido: "ventas del café", creado_en: "2026-11-07T00:00:00Z", provenance_tag: {} },
  ],
  // el Departamento de Marketing (el Centro solo cuenta a los suyos)
  departments: [{ id: "d-mk", name: "marketing", display_name: null, description: null, status: "active" }],
  agents: ["content-creator", "market-research-analyst", "growth-hacker"].map((name) => ({ id: name, name, display_name: null, role: "empleado", department: "marketing", department_id: null, reports_to: null, is_active: true, status: "active" })),
  oficina_equipos: [{ clave: "estrategia", nombre: "Estrategia", descripcion: null, etapa: "activo", bloqueo: null, orden: 1 }],
  oficina_directorio: ["content-creator", "market-research-analyst", "growth-hacker"].map((agente) => ({ agente, equipo: "estrategia", especialidad: null, sabe_hacer: [], activo: true })),
  // corridas abiertas: 2 empleados en la ferretería, 1 en el café
  agent_invocations: [
    { client_id: FERRETERIA, agent_name: "content-creator" }, { client_id: FERRETERIA, agent_name: "market-research-analyst" },
    { client_id: CAFETERIA, agent_name: "growth-hacker" },
  ],
  client_reports: [
    { client_id: FERRETERIA, id: "r1", kind: "weekly", status: "awaiting_review", period_start: "2026-11-01", period_end: "2026-11-07", summary: "semana", created_at: "2026-11-08T00:00:00Z" },
    { client_id: CAFETERIA, id: "r2", kind: "weekly", status: "approved", period_start: "2026-11-01", period_end: "2026-11-07", summary: "semana del café", created_at: "2026-11-08T00:00:00Z" },
  ],
})
/** el freno de gasto de los DOS clientes: el Centro tiene que mostrar el del cliente que muestra */
const sinRiesgos = async () => ({ ok: true as const, datos: { topes: [{ client_id: FERRETERIA, gastado_24h_usd: 7, techo_usd: 20 }, { client_id: CAFETERIA, gastado_24h_usd: 1.5, techo_usd: 10 }] } as never })
const BORRADO = "00000000-0000-4000-8000-0000000dead0"
/** un cliente de práctica: existe en `clients` pero no sale en la lista para elegir */
const PRACTICA = "00000000-0000-4000-8000-0000000aa003"

describe("el Centro sin cliente elegido usa UN cliente para todo", () => {
  it("sin ?cliente: el manual, el plan y los informes son del MISMO cliente que muestra el brief (el primero de la lista)", async () => {
    const leidas: Array<{ tabla: string; cliente: unknown }> = []
    const c = await leerCentro(baseQueFiltra(datos(), leidas), { riesgos: sinRiesgos })
    expect(c.cliente).toBe(CAFETERIA)
    expect(c.manual).toEqual({ total: 2, aprobado: true, fecha: "2026-11-02T10:00:00Z" })
    expect(c.plan).toMatchObject({ estado: "approved", version: 3 })
    expect(c.informes.total).toBe(2) // su informe semanal y su ficha de análisis; el informe y las 2 fichas de la ferretería no se mezclan
    expect(c.dinero).toEqual({ gastado_24h_usd: 1.5, techo_usd: 10 })
    expect(c.equipo.trabajando).toBe(1) // solo quien trabaja para el café
    // todas las lecturas por cliente pidieron el mismo
    expect(leidas.length).toBeGreaterThan(3)
    expect(new Set(leidas.map((l) => l.cliente))).toEqual(new Set([CAFETERIA]))
  })
  it("con ?cliente del otro rubro: todo es de ese cliente", async () => {
    const leidas: Array<{ tabla: string; cliente: unknown }> = []
    const c = await leerCentro(baseQueFiltra(datos(), leidas), { cliente: FERRETERIA, riesgos: sinRiesgos })
    expect(c.cliente).toBe(FERRETERIA)
    expect(c.manual).toEqual({ total: 1, aprobado: false, fecha: "2026-11-09T10:00:00Z" })
    expect(c.plan).toMatchObject({ estado: "pending", version: 1 })
    expect(c.informes.total).toBe(3)
    expect(c.dinero).toEqual({ gastado_24h_usd: 7, techo_usd: 20 })
    expect(c.equipo.trabajando).toBe(2)
    expect(new Set(leidas.map((l) => l.cliente))).toEqual(new Set([FERRETERIA]))
  })
  it("un enlace a un cliente que ya no existe (borrado, enlace viejo): todo es del primero de la lista, el brief y la gran idea incluidos (CC6 #325 🟡)", async () => {
    const leidas: Array<{ tabla: string; cliente: unknown }> = []
    const c = await leerCentro(baseQueFiltra(datos(), leidas), { cliente: BORRADO, riesgos: sinRiesgos })
    expect(c.cliente).toBe(CAFETERIA)
    expect(c.manual).toEqual({ total: 2, aprobado: true, fecha: "2026-11-02T10:00:00Z" })
    expect(c.plan).toMatchObject({ estado: "approved", version: 3 })
    expect(c.dinero).toEqual({ gastado_24h_usd: 1.5, techo_usd: 10 })
    // ninguna lectura por cliente pidió el borrado (la ficha de `clients` se consulta por id, no por client_id)
    expect(new Set(leidas.map((l) => l.cliente))).toEqual(new Set([CAFETERIA]))
  })
  it("un cliente de práctica pedido por enlace (fuera de la lista, pero existe): todo es de ese, no del primero", async () => {
    const leidas: Array<{ tabla: string; cliente: unknown }> = []
    const c = await leerCentro(baseQueFiltra(datos(), leidas), { cliente: PRACTICA, riesgos: sinRiesgos })
    expect(c.cliente).toBe(PRACTICA)
    expect(c.manual).toEqual({ total: 0, aprobado: null, fecha: null })
    expect(new Set(leidas.map((l) => l.cliente))).toEqual(new Set([PRACTICA]))
  })
  it("sin ningún cliente en la lista: nada inventado (manual 0, plan null)", async () => {
    const c = await leerCentro(baseQueFiltra({}, []), { riesgos: sinRiesgos })
    expect(c.cliente).toBeNull()
    expect(c.manual).toEqual({ total: 0, aprobado: null, fecha: null })
    expect(c.plan).toBeNull()
  })
})
