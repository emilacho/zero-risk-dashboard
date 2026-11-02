import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { armarEscena, type Despacho } from "@/lib/escena-avatares"
import { armarCorrecciones, armarEntregas, conRevisiones, CUADROS_DEL_PIZARRON, DUENO_DEL_CAMPO_DEL_MANUAL, devolvioEmilio, MAXIMO_DE_CUADROS, PANEL_DE_FIRMA, PUESTOS_EN_EL_PIZARRON, rotuloDeLaFirma, type EntregasDeLaEscena } from "@/lib/escena-entregas"
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
  it("revisión viva = sin cerrar y reciente; las cerradas no cuentan (lo que devuelven va en las correcciones, no en el resultado de la revisión)", () => {
    const r = armarEntregas({
      ...base,
      turnos: [turno("p1", "growth-hacker", hace(50))],
      revisiones: [
        { id: "r1", artifact_id: "p1", creado_en: hace(10), cerrado_en: null, resultado: null },
        { id: "r2", artifact_id: "p2", creado_en: hace(20), cerrado_en: hace(4), resultado: "devuelve_con_correcciones" },
        { id: "r4", artifact_id: "p4", creado_en: hace(600), cerrado_en: null, resultado: null },
      ],
      pasos: [{ revision_id: "r1", agente: "jefe-marketing", tipo: "agente" }, { revision_id: "r1", agente: "editor_en_jefe", tipo: "agente" }, { revision_id: "r1", agente: "jefe-marketing", tipo: "agente" }],
    })
    expect(r.revisiones.map((x) => [x.id, x.estado])).toEqual([["r1", "viva"]])
    expect(r.revisiones[0]).toMatchObject({ entregador: "growth-hacker", revisores: ["jefe-marketing", "editor_en_jefe"] })
    expect(r.correcciones).toEqual([]) // `resultado` ya no se interpreta: nada de valores adivinados
  })
})

describe("sprint 3 · «corrige» con los datos reales (reglas de CC1)", () => {
  const rev = (id: string, artifact: string, agentes: string[], extra: object = {}) => ({ id, artifact_id: artifact, productores: agentes.map((a) => ({ donde: "x", agente: a })), prueba: false, dry_run: false, ...extra })
  it("la jefatura devolvió: paso correccion:% hecho y reciente, atribuido a quien corrigió; los de prueba o ensayo no cuentan", () => {
    const c = armarCorrecciones({
      ...base,
      pasosDeCorreccion: [
        { revision_id: "r1", paso: "correccion:1", estado: "hecho", agente: "content-creator", inicio: hace(8), fin: hace(6) },
        { revision_id: "r2", paso: "correccion:1", estado: "hecho", agente: "copywriter", inicio: hace(8), fin: hace(6) },
        { revision_id: "r1", paso: "correccion:2", estado: "hecho", agente: "growth-hacker", inicio: hace(80), fin: hace(70) },
      ],
      atribucion: [rev("r1", "p1", ["content-creator"]), rev("r2", "p2", ["copywriter"], { prueba: true })],
    })
    expect(c).toEqual([{ agente: "content-creator", origen: "jefatura", desde: hace(6) }])
  })
  it("Emilio devolvió una pieza: pidió cambios, o la rechazó él de verdad; las limpiezas, superadas, vencidas y pruebas NO", () => {
    const d = (status: string, extra: object) => ({ id: "h" + Math.random(), status, decided_at: hace(3), metadata: { jefatura_revision_id: "r1" }, decision: {}, reviewer: "emilio", ...extra })
    expect(devolvioEmilio(d("edited", { decision: { pidio_cambios: "true" } }))).toBe(true)
    expect(devolvioEmilio(d("edited", { decision: { pidio_cambios: false } }))).toBe(false)
    expect(devolvioEmilio(d("rejected", {}))).toBe(true)
    expect(devolvioEmilio(d("rejected", { decision: { vencida: true } }))).toBe(false)
    expect(devolvioEmilio(d("rejected", { decision: { superada: true } }))).toBe(false)
    expect(devolvioEmilio(d("rejected", { decision: { no_es_decision_del_dueno: true } }))).toBe(false)
    expect(devolvioEmilio(d("rejected", { reviewer: "sistema-limpieza" }))).toBe(false)
    expect(devolvioEmilio(d("rejected", { reviewer: "oficina-vigia" }))).toBe(false)
    expect(devolvioEmilio(d("rejected", { reviewer: "usuario-prueba" }))).toBe(false)
    expect(devolvioEmilio(d("rejected", { reviewer: null }))).toBe(false)
    const c = armarCorrecciones({ ...base, decisiones: [d("edited", { decision: { pidio_cambios: true } })], atribucion: [rev("r1", "p1", ["content-creator", "carousel-designer"])] })
    expect(c.map((x) => x.agente).sort()).toEqual(["carousel-designer", "content-creator"]) // varios autores: a todos
  })
  it("pieza sin revisión: se atribuye a quien hizo el encargo; sin dato, a nadie", () => {
    const d = { id: "h", status: "rejected", reviewer: "emilio", decided_at: hace(2), decision: {}, metadata: { oficina_encargo_id: "enc9" } }
    expect(armarCorrecciones({ ...base, decisiones: [d], turnos: [turno("enc9", "copywriter", hace(30))] })).toMatchObject([{ agente: "copywriter", origen: "emilio_pieza" }])
    expect(armarCorrecciones({ ...base, decisiones: [d] })).toEqual([])
  })
  it("Emilio pidió cambios al plan (a los productores de su revisión) o al manual (al dueño del campo); cuenta al crearse el pedido", () => {
    const c = armarCorrecciones({
      ...base,
      cambios: [{ id: "c1", plan_id: "plan7", documento: "plan", creado_en: hace(4) }, { id: "c2", documento: "manual", campos_liberados: ["mision", "voice_description"], creado_en: hace(5) }, { id: "c3", documento: "plan", plan_id: "plan7", creado_en: hace(300) }],
      atribucion: [rev("r9", "plan7", ["jefe-marketing"])],
    })
    expect(c.map((x) => `${x.agente}:${x.origen}`).sort()).toEqual(["brand-strategist:emilio_manual", "content-creator:emilio_manual", "jefe-marketing:emilio_plan"])
    expect(DUENO_DEL_CAMPO_DEL_MANUAL.mision).toBe("brand-strategist")
  })
  it("un empleado, una marca; y sin datos no hay marca (nunca «cero por defecto» inventado)", () => {
    expect(armarCorrecciones(base)).toEqual([])
    const c = armarCorrecciones({
      ...base,
      pasosDeCorreccion: [{ revision_id: "r1", paso: "correccion:1", estado: "hecho", agente: "content-creator", fin: hace(9) }],
      cambios: [{ id: "c", documento: "manual", campos_liberados: ["voice_description"], creado_en: hace(2) }],
      atribucion: [rev("r1", "p1", ["content-creator"])],
    })
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ agente: "content-creator", desde: hace(2) })
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
  it("«corrige»: quien recibió una devolución vuelve a SU escritorio con la marca, no a Dirección", () => {
    const con: EntregasDeLaEscena = { entregas: [], firma: { pendientes: 0 }, revisiones: [], correcciones: [{ agente: "growth-hacker", origen: "jefatura", desde: hace(2) }] }
    const { escena: e } = conRevisiones(escena(), con, opciones)
    expect(e.mesas.find((m) => m.clave === "estrategia")!.sentados.find((x) => x.agente === "growth-hacker")).toMatchObject({ corrige: true })
    expect(e.mesas.find((m) => m.clave === "direccion")!.sentados).toHaveLength(0)
  })
  it("Dirección no se filtra por «activo»: los jefes con activo=false (no entran a los turnos) igual se encienden", () => {
    const { escena: e } = conRevisiones(escena(), viva, { ...opciones, directorio: DIRECTORIO.map((d) => ({ ...d, activo: false })) })
    expect(e.mesas.find((m) => m.clave === "direccion")!.sentados.map((s) => s.agente)).toContain("editor_en_jefe")
    expect(readFileSync("lib/escena-avatares-datos.ts", "utf8")).not.toMatch(/oficina_directorio[^\n]*\.eq\("activo"/)
  })
})

describe("sprint 3 · el pizarrón y la luz de firma", () => {
  it("18 cuadros medidos sobre la foto; los puestos frente al pizarrón son 4 y distintos", () => {
    expect(CUADROS_DEL_PIZARRON).toHaveLength(18)
    expect(new Set(PUESTOS_EN_EL_PIZARRON.map((p) => `${p.x},${p.y}`)).size).toBe(4)
    expect(PANEL_DE_FIRMA).toHaveLength(4)
  })
  it("se dibuja: la luz de firma que lleva a Tu oficina (sin firmas no hay luz); las entregas ya NO quedan fijas como cuadros del pizarrón", () => {
    const ent = armarEntregas({ ...base, encargos: [encargo("a", "cerrado_aprobado", hace(30))], turnos: [turno("a", "growth-hacker", hace(31))], filas: [{ id: "fa", tema: "Cevichería", red: "tiktok" }], bandeja: [{ id: "1", expires_at: null }] })
    const e = { ...escena(), entregas: ent }
    const html = renderToStaticMarkup(createElement(Avatares, { datosIniciales: e }))
    expect(html).toMatch(/class="nv-firma"[^>]*href="\/nuevo\/oficina"/)
    expect(html).toContain("1 espera tu firma")
    expect(html).not.toContain("data-entrega=")
    expect(html).not.toContain("Cevichería · tiktok · entregada")
    const vacio = renderToStaticMarkup(createElement(Avatares, { datosIniciales: escena() }))
    expect(vacio).not.toContain("nv-firma\"")
  })
  it("respeta prefers-reduced-motion y no se mete con la plataforma: solo lectura", () => {
    const css = readFileSync("components/nuevo/escena/EntregasEnLaFoto.tsx", "utf8")
    expect(css).toContain("prefers-reduced-motion")
    const lector = readFileSync("lib/escena-avatares-datos.ts", "utf8").split("export async function leerEntregas")[1]
    expect(lector).not.toMatch(/\.(insert|update|delete|upsert|rpc)\(/)
    expect(lector).toContain('.eq("status", "pending")') // la bandeja se lee de la tabla, no del endpoint que devuelve vencidas como pendientes
  })
})
