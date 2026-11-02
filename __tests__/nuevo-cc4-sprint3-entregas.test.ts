import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { armarEscena, type Despacho } from "@/lib/escena-avatares"
import { armarEntregas, conRevisiones, CUADROS_DEL_PIZARRON, esDevolucion, MAXIMO_DE_CUADROS, PANEL_DE_FIRMA, PUESTOS_EN_EL_PIZARRON, rotuloDeLaFirma, type EntregasDeLaEscena } from "@/lib/escena-entregas"
import { asignarRanuras } from "@/components/nuevo/escena/EntregasEnLaFoto"
import { Avatares } from "@/components/nuevo/escena/Avatares"

const AHORA = new Date("2026-11-02T17:00:00Z")
const hace = (min: number) => new Date(AHORA.getTime() - min * 60_000).toISOString()
const DIRECTORIO = [
  { agente: "growth-hacker", equipo: "estrategia", rol: "miembro" },
  { agente: "jefe-marketing", equipo: "direccion", rol: "direccion" },
  { agente: "editor_en_jefe", equipo: "direccion", rol: "miembro" },
]
const AGENTES = [{ name: "jefe-marketing", display_name: "Jefe de marketing" }, { name: "growth-hacker", display_name: "Growth hacker" }, { name: "editor_en_jefe", display_name: "Editor en jefe" }]
const desp = (a: string): Despacho => ({ id: "d" + a, agent_name: a, client_id: null, workflow_id: "w", workflow_execution_id: "1", status: "running", running_at: hace(3), completed_at: null, created_at: hace(3) })
const escena = (trabajan: string[] = []) => armarEscena({ despachos: trabajan.map(desp), invocaciones: [], directorio: DIRECTORIO, agentes: AGENTES, clientes: [], equipos: null, ahora: AHORA })
const encargo = (id: string, estado: string, cerrado: string, fila = "f" + id) => ({ id, estado, cerrado_en: cerrado, sala_ref: { fila: { id: fila } } })
const turno = (encargo_id: string, agente: string, fin: string) => ({ encargo_id, agente, tipo: "agente", fin })
const base = { encargos: [], turnos: [], filas: [], revisiones: [], pasos: [], bandeja: [], ahora: AHORA }

describe("sprint 3 · las entregas salen de lo que dicen las tablas", () => {
  it("entrega = encargo cerrado, vigente (24 h), sin «por tope»; la hace el último turno de agente; el título sale de la fila del calendario", () => {
    const r = armarEntregas({
      ...base,
      encargos: [encargo("a", "cerrado_aprobado", hace(30)), encargo("b", "cerrado_por_tope", hace(20)), encargo("c", "fallido", hace(10)), encargo("d", "cerrado_aprobado", hace(60 * 30)), encargo("e", "abierto", hace(5))],
      turnos: [turno("a", "growth-hacker", hace(40)), turno("a", "editor_en_jefe", hace(35))],
      filas: [{ id: "fa", tema: "Cevichería de la costa", red: "instagram" }],
    })
    expect(r.entregas.map((e) => e.id)).toEqual(["a"])
    expect(r.entregas[0]).toMatchObject({ agente: "editor_en_jefe", titulo: "Cevichería de la costa · instagram" })
  })
  it("máximo 12 a la vista y la más nueva primero", () => {
    const encargos = Array.from({ length: 15 }, (_, i) => encargo("e" + i, "cerrado_aprobado", hace(i + 1)))
    const r = armarEntregas({ ...base, encargos })
    expect(r.entregas).toHaveLength(MAXIMO_DE_CUADROS)
    expect(r.entregas[0].id).toBe("e0")
  })
  it("la firma cuenta lo pendiente y vigente: una vencida en la bandeja NO cuenta", () => {
    const r = armarEntregas({ ...base, bandeja: [{ id: "1", expires_at: null }, { id: "2", expires_at: hace(-60) }, { id: "3", expires_at: hace(60) }] })
    expect(r.firma.pendientes).toBe(2)
    expect(rotuloDeLaFirma(1)).toBe("1 espera tu firma")
    expect(rotuloDeLaFirma(3)).toBe("3 esperan tu firma")
  })
  it("revisión viva = sin cerrar y reciente; devuelta = cerrada hace poco con resultado de devolución; el resto no cuenta", () => {
    const r = armarEntregas({
      ...base,
      turnos: [turno("p1", "growth-hacker", hace(50)), turno("p2", "growth-hacker", hace(50))],
      revisiones: [
        { id: "r1", artifact_id: "p1", creado_en: hace(10), cerrado_en: null, resultado: null },
        { id: "r2", artifact_id: "p2", creado_en: hace(20), cerrado_en: hace(4), resultado: "devuelve_con_correcciones" },
        { id: "r3", artifact_id: "p3", creado_en: hace(20), cerrado_en: hace(4), resultado: "aprobada" },
        { id: "r4", artifact_id: "p4", creado_en: hace(600), cerrado_en: null, resultado: null },
        { id: "r5", artifact_id: "p5", creado_en: hace(60), cerrado_en: hace(30), resultado: "devuelve" },
      ],
      pasos: [{ revision_id: "r1", agente: "jefe-marketing", tipo: "agente" }, { revision_id: "r1", agente: "editor_en_jefe", tipo: "agente" }, { revision_id: "r1", agente: "jefe-marketing", tipo: "agente" }],
    })
    expect(r.revisiones.map((x) => [x.id, x.estado])).toEqual([["r1", "viva"], ["r2", "devuelta"]])
    expect(r.revisiones[0]).toMatchObject({ entregador: "growth-hacker", revisores: ["jefe-marketing", "editor_en_jefe"] })
    expect(esDevolucion("aprobada")).toBe(false)
  })
})

describe("sprint 3 · mesa de Dirección: los jefes en su escritorio y quien entregó camina hasta ahí", () => {
  const viva: EntregasDeLaEscena = { entregas: [], firma: { pendientes: 0 }, revisiones: [{ id: "r1", encargo_id: "p1", entregador: "growth-hacker", revisores: ["jefe-marketing", "editor_en_jefe"], estado: "viva", desde: hace(5), cerrado_en: null }] }
  const opciones = { directorio: DIRECTORIO, agentes: AGENTES, ahora: AHORA }
  it("mientras la revisión está viva: los jefes se encienden en Dirección (según el directorio) y el que entregó está ahí, viniendo de su escritorio", () => {
    const { escena: e } = conRevisiones(escena(["growth-hacker"]), viva, opciones)
    const dir = e.mesas.find((m) => m.clave === "direccion")!
    expect(dir.sentados.map((s) => s.agente).sort()).toEqual(["editor_en_jefe", "growth-hacker", "jefe-marketing"])
    expect(dir.sentados.find((s) => s.agente === "growth-hacker")).toMatchObject({ viene_de: "estrategia" })
    expect(e.mesas.find((m) => m.clave === "estrategia")!.sentados).toHaveLength(0) // un empleado, un puesto
    expect(dir.trabajando).toBe(3)
  })
  it("un jefe que el directorio no ubica en ningún escritorio se dice, no se inventa", () => {
    const rara: EntregasDeLaEscena = { ...viva, revisiones: [{ ...viva.revisiones[0], revisores: ["jefe-marketing", "revisor-que-nadie-ubico"] }] }
    const { escena: e, sinEscritorio } = conRevisiones(escena(), rara, opciones)
    expect(sinEscritorio).toContain("revisor-que-nadie-ubico")
    expect(e.mesas.flatMap((m) => m.sentados).some((s) => s.agente === "revisor-que-nadie-ubico")).toBe(false)
  })
  it("si la jefatura devuelve: quien entregó vuelve a SU escritorio con la marca «corrige»", () => {
    const devuelta: EntregasDeLaEscena = { ...viva, revisiones: [{ ...viva.revisiones[0], estado: "devuelta", cerrado_en: hace(2) }] }
    const { escena: e } = conRevisiones(escena(), devuelta, opciones)
    const s = e.mesas.find((m) => m.clave === "estrategia")!.sentados.find((x) => x.agente === "growth-hacker")
    expect(s).toMatchObject({ corrige: true })
    expect(e.mesas.find((m) => m.clave === "direccion")!.sentados).toHaveLength(0)
  })
})

describe("sprint 3 · el pizarrón y la luz de firma", () => {
  it("12 cuadros medidos sobre la foto; los puestos frente al pizarrón son 4 y distintos", () => {
    expect(CUADROS_DEL_PIZARRON).toHaveLength(12)
    expect(new Set(PUESTOS_EN_EL_PIZARRON.map((p) => `${p.x},${p.y}`)).size).toBe(4)
    expect(PANEL_DE_FIRMA).toHaveLength(4)
  })
  it("cada entrega conserva su cuadro; sin lugar libre se apaga la más vieja", () => {
    const e = (id: string, min: number) => ({ id, cerrado_en: hace(min) })
    const a = asignarRanuras([], [e("x", 30), e("y", 20)])
    expect(a.slice(0, 2)).toEqual(["x", "y"])
    expect(asignarRanuras(a, [e("z", 5), e("x", 30), e("y", 20)]).slice(0, 3)).toEqual(["x", "y", "z"])
    const llenas = Array.from({ length: 12 }, (_, i) => e("v" + i, 100 - i)) // v0 es la más vieja
    const l = asignarRanuras([], llenas)
    const nueva = asignarRanuras(l, [...llenas, e("n", 1)])
    expect(nueva).not.toContain("v0")
    expect(nueva).toContain("n")
  })
  it("se dibuja: cuadros encendidos con título al pasar el cursor y la luz de firma que lleva a Tu oficina; sin firmas no hay luz", () => {
    const ent = armarEntregas({ ...base, encargos: [encargo("a", "cerrado_aprobado", hace(30))], turnos: [turno("a", "growth-hacker", hace(31))], filas: [{ id: "fa", tema: "Cevichería", red: "tiktok" }], bandeja: [{ id: "1", expires_at: null }] })
    const e = { ...escena(), entregas: ent }
    const html = renderToStaticMarkup(createElement(Avatares, { datosIniciales: e }))
    expect(html).toContain('data-encendidos="1"')
    expect(html).toContain("Cevichería · tiktok · entregada")
    expect(html).toMatch(/class="nv-firma"[^>]*href="\/nuevo\/oficina"/)
    expect(html).toContain("1 espera tu firma")
    const vacio = renderToStaticMarkup(createElement(Avatares, { datosIniciales: escena() }))
    expect(vacio).not.toContain("nv-firma\"")
    expect(vacio).not.toContain("data-cuadro=")
  })
  it("respeta prefers-reduced-motion y no se mete con la plataforma: solo lectura", () => {
    const css = readFileSync("components/nuevo/escena/EntregasEnLaFoto.tsx", "utf8")
    expect(css).toContain("prefers-reduced-motion")
    const lector = readFileSync("lib/escena-avatares-datos.ts", "utf8").split("export async function leerEntregas")[1]
    expect(lector).not.toMatch(/\.(insert|update|delete|upsert|rpc)\(/)
    expect(lector).toContain('.eq("status", "pending")') // la bandeja se lee de la tabla, no del endpoint que devuelve vencidas como pendientes
  })
})
