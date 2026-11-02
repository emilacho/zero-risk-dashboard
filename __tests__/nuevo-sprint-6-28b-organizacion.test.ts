/**
 * DASHBOARD NUEVO · SPRINT 6.28-B · ORGANIZACIÓN (encargo 01-nov + «dale» de Emilio 2-nov a ChartHop): el organigrama vivo de toda la empresa.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { armarOrganizacion, aSuCargo, coincide, type FilaAgente } from "@/lib/direccion-organizacion"

const ahora = new Date("2026-11-02T12:00:00Z")
const ag = (id: string, name: string, x: Partial<FilaAgente> = {}): FilaAgente => ({ id, name, display_name: null, role: "empleado", department: null, department_id: null, reports_to: null, is_active: true, status: "active", ...x })
const datos = {
  deptos: [
    { id: "mk", name: "marketing", display_name: "Marketing", description: null, status: "active" },
    { id: "sa", name: "sales", display_name: "Sales", description: null, status: "active" },
    { id: "ve", name: "ventas", display_name: "Ventas", description: null, status: "planned" },
    { id: "co", name: "contabilidad", display_name: "Contabilidad", description: null, status: "planned" },
    { id: "pm", name: "paid_media", display_name: "Paid Media", description: null, status: "active" },
  ],
  agentes: [
    ag("g", "gerente-general", { role: "gerente_general", display_name: "Gerente General" }),
    ag("jm", "jefe-marketing", { role: "jefe_departamento", department_id: "mk", reports_to: "g" }),
    ag("cc", "content-creator", { department_id: "mk", reports_to: "jm" }),
    ag("cd", "carousel-designer"),
    ag("x", "x-twitter-intelligence-analyst", { department_id: "mk" }),
    ag("pa", "paid_media_auditor", { department_id: "pm" }),
    ag("s1", "sales_coach", { department_id: "sa" }),
    ag("f1", "chief-financial-officer", { department_id: "co" }),
    ag("r", "ruflo", { role: "transversal" }),
    ag("off", "community_manager", { department_id: "mk", is_active: false, status: "inactive" }),
  ],
  equipos: [
    { clave: "estrategia", nombre: "Estrategia", descripcion: null, etapa: "activo", bloqueo: null, orden: 2 },
    { clave: "creativo", nombre: "Creativo", descripcion: null, etapa: "activo", bloqueo: null, orden: 3 },
    { clave: "medios", nombre: "Medios y Performance", descripcion: null, etapa: "segunda_etapa", bloqueo: "espera las métricas de Meta", orden: 5 },
    { clave: "relaciones", nombre: "Relaciones", descripcion: null, etapa: "segunda_etapa", bloqueo: null, orden: 6 },
  ],
  directorio: [{ agente: "content-creator", equipo: "creativo", especialidad: "texto", sabe_hacer: ["titulares"], activo: true }, { agente: "portero-del-cerebro", equipo: null, especialidad: null, sabe_hacer: [], activo: true }],
  invocaciones: [{ agent_name: "content-creator", command: "pieza", started_at: "2026-11-02T11:55:00Z", ended_at: null, status: "running", client_id: null, cost_usd: null }],
}
const org = armarOrganizacion(datos, { ahora })
const depto = (k: string) => org.departamentos.find((d) => d.clave === k)!

describe("6.28-B · organización · armado desde los datos", () => {
  it("dueño → gerente general → departamentos; Ventas junta «sales» y «ventas»; Pauta va dentro de Marketing", () => {
    expect(org.dueno.nombre).toBe("Emilio Pérez")
    expect(org.gerente).toBe("gerente-general")
    expect(org.departamentos.map((d) => d.clave)).toEqual(["marketing", "ventas", "transversal", "contabilidad"])
    expect(depto("ventas").estado).toBe("activo")
    expect(org.personas["paid_media_auditor"].departamento).toBe("marketing")
    expect(org.notas.join(" ")).toMatch(/Ventas figura dos veces/)
  })
  it("el equipo sale de la tarjeta del directorio y, sin tarjeta, del mapa firmado (y lo dice)", () => {
    expect(org.personas["content-creator"]).toMatchObject({ equipo: "creativo", equipo_segun: "directorio" })
    expect(org.personas["carousel-designer"]).toMatchObject({ departamento: "marketing", equipo: "creativo", equipo_segun: "mapa" })
    expect(org.notas.join(" ")).toMatch(/mapa firmado/)
  })
  it("estados: trabajando ahora, activo, por activar (equipo en segunda etapa o departamento planeado) y apagado", () => {
    expect(org.personas["content-creator"].estado).toBe("trabajando")
    expect(org.personas["paid_media_auditor"].estado).toBe("por_activar")
    expect(org.personas["chief-financial-officer"].estado).toBe("por_activar")
    expect(org.personas["community_manager"].estado).toBe("apagado")
    expect(org.resumen.trabajando).toBe(1)
  })
  it("el jefe encabeza su departamento y a quien no tiene jefe declarado le reporta al jefe; los jefes al gerente", () => {
    expect(depto("marketing").jefe).toBe("jefe-marketing")
    expect(org.personas["carousel-designer"].reporta_a).toBe("jefe-marketing")
    expect(org.personas["jefe-marketing"].reporta_a).toBe("gerente-general")
    expect(aSuCargo(org, "jefe-marketing")).toContain("content-creator")
  })
  it("puestos por cubrir: lo firmado y no instalado, sin duplicar a quien ya está («X/Twitter…» = x-twitter-…)", () => {
    const estr = depto("marketing").equipos.find((e) => e.clave === "estrategia")!
    expect(estr.por_cubrir).toContain("Feedback Synthesizer")
    expect(estr.por_cubrir).not.toContain("X/Twitter Intelligence Analyst")
  })
  it("la tarjeta del directorio sin empleado instalado se lista (portero) y el que no es de marketing va a servicios compartidos", () => {
    expect(org.personas["portero-del-cerebro"]).toMatchObject({ instalado: false, departamento: "transversal" })
    expect(org.personas["ruflo"].departamento).toBe("transversal")
  })
  it("la búsqueda ignora tildes y mayúsculas y mira nombre, puesto y equipo", () => {
    expect(coincide(org.personas["content-creator"], "CREATIVO", org)).toBe(true)
    expect(coincide(org.personas["sales_coach"], "créativo", org)).toBe(false)
  })
})

describe("6.28-B · organización · la pantalla", () => {
  const panel = readFileSync("components/nuevo/PanelOrganizacion.tsx", "utf8")
  const ruta = readFileSync("app/api/direccion/organizacion/route.ts", "utf8")
  it("solo administrador y solo lectura", () => {
    expect(ruta).toContain("await exigirAdmin()")
    expect(ruta).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/)
    expect(readFileSync("lib/direccion-organizacion.ts", "utf8")).not.toMatch(/\.(insert|update|upsert|delete)\(/)
  })
  it("la pantalla 7 del arco la abre y el chat sigue visible (nv-panel)", () => {
    expect(readFileSync("components/nuevo/PantallasDelArco.tsx", "utf8")).toContain('PANTALLA_DE_ORGANIZACION = "arco-7"')
    expect(readFileSync("components/nuevo/EscenaViva.tsx", "utf8")).toContain("alAbrirOrganizacion={() => setOrganigrama(true)}")
    expect(panel).toContain("nv-panel fixed inset-0")
  })
  it("como ChartHop: departamentos que se abren con su conteo, puestos por cubrir punteados, buscador, filtros, zoom y ficha", () => {
    for (const k of ["data-depto", "aria-expanded", "data-total", "data-por-cubrir", "border-dashed", "data-buscar", "data-filtro", "data-zoom", "onWheel", "data-ficha", "Reporta a", "A su cargo"]) expect(panel).toContain(k)
  })
  it("sin avisos de gasto en esta pantalla", () => {
    expect(panel).not.toMatch(/gasto|US\$|cost_usd|costo/i)
  })
})
