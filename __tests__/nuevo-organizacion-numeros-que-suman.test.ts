/** 3-nov · auditoría n.º 18: los totales de Organización suman y cada jefe lleva sus iniciales. */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { armarOrganizacion, inicialesDe, resumenQueSuma, type FilaAgente } from "@/lib/direccion-organizacion"

const ag = (name: string, extra: Partial<FilaAgente> = {}): FilaAgente => ({ id: name, name, display_name: null, role: "empleado", department: "marketing", department_id: null, reports_to: null, is_active: true, status: "active", ...extra })
const org = armarOrganizacion({
  deptos: [{ id: "d1", name: "marketing", display_name: null, description: null, status: "active" }, { id: "d2", name: "contabilidad", display_name: null, description: null, status: "planned" }],
  agentes: [ag("gerente-general", { role: "gerente_general", department: null }), ag("jefe-marketing", { role: "jefe_departamento", display_name: "Jefe de Marketing" }), ag("uno"), ag("dos", { is_active: false, status: "inactive" }), ag("tres", { department: "contabilidad" })],
  equipos: [], directorio: [], invocaciones: [],
}, { ahora: new Date("2026-11-03T20:00:00Z") })

describe("🔴 los números suman", () => {
  it("cada empleado cae en un solo estado: la suma da el total", () => {
    const r = org.resumen
    expect(r.activos + r.por_activar + r.apagados).toBe(r.empleados)
    expect(r.apagados).toBeGreaterThan(0)
  })
  it("los departamentos más el gerente dan el total", () => {
    expect(org.departamentos.reduce((n, d) => n + d.total, 0) + 1).toBe(org.resumen.empleados)
  })
  it("el texto dice una suma que cuadra, con lo real de hoy", () => {
    expect(resumenQueSuma({ empleados: 73, departamentos: 6, trabajando: 0, activos: 41, por_activar: 30, apagados: 2, por_cubrir: 5 })).toBe("73 empleados: 41 activos + 30 por activar + 2 apagados · 6 departamentos · 5 puestos por cubrir")
  })
  it("quien trabaja ahora va aparte: «activos» no lo cuenta dos veces", () => {
    expect(resumenQueSuma({ empleados: 73, departamentos: 6, trabajando: 3, activos: 41, por_activar: 30, apagados: 2, por_cubrir: 5 })).toContain("3 trabajando ahora + 38 activos + 30 por activar + 2 apagados")
  })
  it("sin apagados no los nombra, y la suma sigue dando", () => {
    expect(resumenQueSuma({ empleados: 71, departamentos: 6, trabajando: 0, activos: 41, por_activar: 30, apagados: 0, por_cubrir: 5 })).toContain("71 empleados: 41 activos + 30 por activar ·")
  })
  it("el panel usa ese texto y ofrece el filtro de apagados cuando los hay", () => {
    const panel = readFileSync("components/nuevo/PanelOrganizacion.tsx", "utf8")
    expect(panel).toContain("{resumenQueSuma(org.resumen)}")
    expect(panel).toContain('...(conteo("apagado") > 0 ? ["apagado"] : [])')
  })
})

describe("🔴 las iniciales", () => {
  it("cada jefe lleva las suyas: la partícula «de» no cuenta", () => {
    expect(inicialesDe("Jefe de Marketing")).toBe("JM")
    expect(inicialesDe("Jefe de Client Success")).toBe("JC")
    expect(inicialesDe("Gerente General")).toBe("GG")
  })
})
