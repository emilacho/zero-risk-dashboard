/**
 * 10-nov · Lenovo (Emilio aprobó el Centro arreglado con 2 ajustes):
 *  1. la tarjeta «Plan de 90 días» pasa a «Plan de Marketing» (regla de nombres del mismo día);
 *  2. «Equipo · 70 · Nadie trabaja ahora»: el 70 eran TODOS los empleados activos del sistema. Debe contar solo los del Departamento de Marketing
 *     que trabajan para este cliente. Los empleados no se asignan por cliente: el departamento entero trabaja para cada cliente; lo que sí es del cliente
 *     son las corridas abiertas («trabajando»).
 * La base falsa filtra por `eq` de verdad (como Postgres), para que el filtro por cliente se note.
 */
import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { leerCentro } from "@/lib/centro-datos"
import { APLICACIONES } from "@/lib/aplicaciones-marketing"

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const OTRO = "11111111-2222-3333-4444-555555555555"
type Fila = Record<string, unknown>
type Respuesta = { data: unknown; error: { message: string } | null }

function base(tablas: Record<string, Fila[] | Error>): SupabaseClient & { pedidos: string[] } {
  const pedidos: string[] = []
  const from = (tabla: string) => {
    const filtros: Array<[string, unknown]> = []
    let una = false
    const resolver = (): Respuesta => {
      const x = tablas[tabla]
      if (x instanceof Error) return { data: null, error: { message: x.message } }
      const filas = (x ?? []).filter((f) => filtros.every(([c, v]) => f[c] === v))
      return { data: una ? filas[0] ?? null : filas, error: null }
    }
    const cadena: Record<string, unknown> = {}
    for (const m of ["select", "is", "gte", "in", "order", "limit", "not"]) cadena[m] = () => cadena
    cadena.eq = (c: string, v: unknown) => { filtros.push([c, v]); pedidos.push(`${tabla}.${c}=${String(v)}`); return cadena }
    cadena.maybeSingle = () => { una = true; return cadena }
    cadena.then = (ok: (r: Respuesta) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resolver()).then(ok, ko)
    return cadena
  }
  return { from, pedidos } as unknown as SupabaseClient & { pedidos: string[] }
}

const ag = (name: string, department: string, extra: Fila = {}): Fila => ({ id: name, name, display_name: null, role: "empleado", department, department_id: null, reports_to: null, is_active: true, status: "active", ...extra })
const riesgos = async () => ({ ok: true as const, datos: { topes: [] } as never })

/** la forma de producción en miniatura: Marketing activo con un equipo de segunda etapa, Ventas, Éxito del cliente, servicios compartidos, Contabilidad planeada */
const sistema = (invocaciones: Fila[] = []): Record<string, Fila[] | Error> => ({
  departments: [
    { id: "d-mk", name: "marketing", display_name: null, description: null, status: "active" },
    { id: "d-v", name: "sales", display_name: null, description: null, status: "active" },
    { id: "d-cs", name: "client_success", display_name: null, description: null, status: "active" },
    { id: "d-c", name: "contabilidad", display_name: null, description: null, status: "planned" },
  ],
  agents: [
    ag("mk-1", "marketing"), ag("mk-2", "marketing"), ag("mk-3", "marketing"),
    ag("mk-segunda", "marketing"), // en un equipo de segunda etapa → «por activar»
    ag("mk-apagado", "marketing", { is_active: false, status: "inactive" }),
    ag("ventas-1", "sales"), ag("ventas-2", "sales"), ag("cs-1", "client_success"), ag("conta-1", "contabilidad"),
  ],
  oficina_equipos: [
    { clave: "estrategia", nombre: "Estrategia", descripcion: null, etapa: "activo", bloqueo: null, orden: 1 },
    { clave: "video", nombre: "Video", descripcion: null, etapa: "segunda_etapa", bloqueo: null, orden: 2 },
  ],
  oficina_directorio: [
    { agente: "mk-1", equipo: "estrategia", especialidad: null, sabe_hacer: [], activo: true },
    { agente: "mk-2", equipo: "estrategia", especialidad: null, sabe_hacer: [], activo: true },
    { agente: "mk-3", equipo: "estrategia", especialidad: null, sabe_hacer: [], activo: true },
    { agente: "mk-segunda", equipo: "video", especialidad: null, sabe_hacer: [], activo: true },
  ],
  agent_invocations: invocaciones,
})

describe("Centro de campaña · ajustes de Emilio del 10-nov", () => {
  it("🔴 la tarjeta del plan se llama «Plan de Marketing» (nunca «Plan de 90 días»)", () => {
    const plan = APLICACIONES.find((a) => a.clave === "plan")
    expect(plan?.nombre).toBe("Plan de Marketing")
    expect(APLICACIONES.map((a) => a.nombre)).not.toContain("Plan de 90 días")
  })

  it("🔴 «Equipo» cuenta solo los empleados activos del Departamento de Marketing: ni Ventas, ni Éxito del cliente, ni los «por activar», ni los apagados", async () => {
    const c = await leerCentro(base(sistema()), { cliente: NAUFRAGO, riesgos })
    expect(c.equipo.agentes).toBe(3) // mk-1, mk-2, mk-3 (antes: los 8 activos del sistema)
  })

  it("🔴 «trabajando» cuenta solo corridas abiertas de ESTE cliente y de empleados de Marketing", async () => {
    const ahora = new Date("2026-11-10T05:00:00Z")
    const abierta = (agent_name: string, client_id: string): Fila => ({ agent_name, client_id, ended_at: null, started_at: "2026-11-10T04:59:00Z", created_at: "2026-11-10T04:59:00Z" })
    const db = base(sistema([abierta("mk-1", NAUFRAGO), abierta("mk-2", OTRO), abierta("ventas-1", NAUFRAGO), abierta("mk-1", NAUFRAGO)]))
    const c = await leerCentro(db, { cliente: NAUFRAGO, ahora, riesgos })
    expect(c.equipo.trabajando).toBe(1) // solo mk-1: mk-2 trabaja para otro cliente y ventas-1 no es de Marketing
    expect(db.pedidos).toContain(`agent_invocations.client_id=${NAUFRAGO}`)
  })

  it("🔴 un empleado guardado con guion bajo cuenta como trabajando aunque su corrida venga con guion (`editor_en_jefe` ↔ `editor-en-jefe`), y al revés", async () => {
    const ahora = new Date("2026-11-10T05:00:00Z")
    const abierta = (agent_name: string): Fila => ({ agent_name, client_id: NAUFRAGO, ended_at: null, started_at: "2026-11-10T04:59:00Z", created_at: "2026-11-10T04:59:00Z" })
    const t = sistema([abierta("editor-en-jefe"), abierta("Brand_Strategist")])
    t.agents = [...(t.agents as Fila[]), ag("editor_en_jefe", "marketing"), ag("brand-strategist", "marketing")]
    t.oficina_directorio = [...(t.oficina_directorio as Fila[]), { agente: "editor_en_jefe", equipo: "estrategia", especialidad: null, sabe_hacer: [], activo: true }, { agente: "brand-strategist", equipo: "estrategia", especialidad: null, sabe_hacer: [], activo: true }]
    const c = await leerCentro(base(t), { cliente: NAUFRAGO, ahora, riesgos })
    expect(c.equipo.agentes).toBe(5)
    expect(c.equipo.trabajando).toBe(2)
  })

  it("una tarjeta del directorio sin empleado instalado no suma al número de «Equipo»", async () => {
    const t = sistema()
    t.oficina_directorio = [...(t.oficina_directorio as Fila[]), { agente: "fantasma", equipo: "estrategia", especialidad: null, sabe_hacer: [], activo: true }]
    const c = await leerCentro(base(t), { cliente: NAUFRAGO, riesgos })
    expect(c.equipo.agentes).toBe(3)
  })

  it("si el organigrama no se puede leer, el número queda «no se pudo leer» (null), nunca el total del sistema", async () => {
    const c = await leerCentro(base({ ...sistema(), departments: new Error("caída") }), { cliente: NAUFRAGO, riesgos })
    expect(c.equipo.agentes).toBeNull()
  })
})
