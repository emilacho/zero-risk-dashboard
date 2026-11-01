/**
 * DASHBOARD NUEVO · SPRINT 6.28 (1-nov): Observabilidad · UNA CORRIDA POR PEDIDO (como LangSmith) · nombres por quién y qué hizo · la atascada.
 * Datos con la forma real del «Pedir cambios» de Emilio del 1-nov 19:33–19:49Z (revisión 3dd7d511 · ejecuciones 210596/210597/210600/gpt-…-3/210611).
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { arbolDeNodos, normalizarDetalle, normalizarLista, type DetalleDeCorrida } from "@/lib/direccion-corridas"
import {
  agruparLista, cambioDeLaRevision, leerAgrupacion, leerDatosDelPedido, nombreDelPasoDeJefatura, nombreDelTurno, trazaDelPedido, type BaseDeLectura,
} from "@/lib/direccion-pedidos"

const NAU = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const REV = "3dd7d511-a5f3-4e08-a6ad-cb8098d9087d", PLAN_REV = "c18a5067-22b7-4f77-9486-65201f0d5336"
const GPT = `gpt-jefatura-${REV}-3`
const corrida = (ej: string, wf: string, inicio: string, fin: string | null, extra: Record<string, unknown> = {}) => ({ workflow_id: wf, workflow_execution_id: ej, client_id: NAU, cliente: "Náufrago", inicio, fin, duracion_ms: fin ? Date.parse(fin) - Date.parse(inicio) : null, costo_usd: 0.25, tokens: 1000, pasos: 1, despachos: 1, fallos: 0, ramas: [], estado: "completa", ...extra })
const LISTA = normalizarLista({ total: 7, corridas: [
  corrida("210611", "o8qaF7bI0PKv2XGZ", "2026-11-01T19:42:05Z", "2026-11-01T19:48:04Z"),
  corrida(GPT, "api:revisor-externo", "2026-11-01T19:40:03Z", "2026-11-01T19:42:01Z"),
  corrida("210600", "o8qaF7bI0PKv2XGZ", "2026-11-01T19:34:06Z", "2026-11-01T19:40:00Z"),
  corrida("210597", "o8qaF7bI0PKv2XGZ", "2026-11-01T19:33:11Z", "2026-11-01T19:34:00Z"),
  corrida("210596", "X9F0zp6LQ2xGEYVS", "2026-11-01T19:33:03Z", "2026-11-01T19:33:05Z", { costo_usd: 0, tokens: 0 }),
  corrida("206191", "o8qaF7bI0PKv2XGZ", "2026-10-30T23:14:13Z", null, { estado: "atascada" }),
  corrida("210492", "ogfq56oIEoHufFPM", "2026-11-01T19:36:06Z", "2026-11-01T19:36:10Z"),
] })
const REVISION = { id: REV, client_id: NAU, artifact_type: "plan", artifact_id: "5072a30f-8094-451f-86d7-5fa858782eb8", estado: "cerrada", resultado: "limpia", creado_en: "2026-11-01T19:33:06Z", cerrado_en: "2026-11-01T19:48:07Z" }
const CAMBIO = { id: "3e977563-864e-43fe-9663-0e69a9fb5a74", client_id: NAU, texto: "el principal objetivo es hacer que la gente sepa que estamos en guayaquil", estado: "aplicado", plan_nuevo_id: "6de73a84-1bb3-4992-92f7-911eebf35451", workflow_execution_id: "210596", creado_en: "2026-11-01T19:32:54Z", actualizado_en: "2026-11-01T19:49:21Z" }
const PASOS = [
  { n: 1, paso: "revision_fondo", tipo: "agente", agente: "editor_en_jefe", estado: "hecho", workflow_execution_id: "210597", cost_usd: 0.24, inicio: "2026-11-01T19:33:08Z", fin: "2026-11-01T19:34:01Z", error: null },
  { n: 2, paso: "correccion:jefe-marketing", tipo: "agente", agente: "jefe-marketing", estado: "hecho", workflow_execution_id: "210600", cost_usd: 0.47, inicio: "2026-11-01T19:34:03Z", fin: "2026-11-01T19:40:02Z", error: null },
  { n: 3, paso: "segunda_mirada", tipo: "externo", agente: "GPT", estado: "hecho", workflow_execution_id: null, cost_usd: 0.08, inicio: "2026-11-01T19:42:01Z", fin: "2026-11-01T19:42:01Z", error: null },
  { n: 4, paso: "decision:jefe-marketing", tipo: "agente", agente: "jefe-marketing", estado: "hecho", workflow_execution_id: "210611", cost_usd: 0.55, inicio: "2026-11-01T19:42:02Z", fin: "2026-11-01T19:48:06Z", error: null },
]

/** una base de mentira que solo responde SELECT y anota qué se pidió */
function base(tablas: Record<string, Record<string, unknown>[]>, pedidos: string[] = []): BaseDeLectura {
  return { from: (t: string) => ({ select: (cols: string) => {
    pedidos.push(`${t}:${cols}`)
    let rows = [...(tablas[t] ?? [])]
    const q = {
      in: (k: string, v: string[]) => { rows = rows.filter((r) => v.includes(String(r[k]))); return q },
      eq: (k: string, v: string) => { rows = rows.filter((r) => String(r[k]) === v); return q },
      gte: (k: string, v: string) => { rows = rows.filter((r) => String(r[k]) >= v); return q },
      like: (k: string, v: string) => { const pre = v.replace(/%$/, ""); rows = rows.filter((r) => String(r[k]).startsWith(pre)); return q },
      order: () => q, limit: () => q,
      then: (ok: (x: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(ok),
    }
    return q as never
  } }) }
}
const TABLAS = {
  jefatura_pasos: PASOS.map((p) => ({ ...p, revision_id: REV })),
  oficina_turnos: [],
  jefatura_revisiones: [REVISION],
  plan_cambios: [CAMBIO],
  plan_aprobaciones: [],
  agent_dispatches: [{ workflow_id: "o8qaF7bI0PKv2XGZ", workflow_execution_id: "206191", agent_name: "campaign-brief-agent" }],
  agent_invocations: [{ workflow_execution_id: GPT }],
}

describe("6.28 · 1 · una corrida por pedido", () => {
  it("el «Pedir cambios» de Emilio (5 filas sueltas) queda en UNA fila con todas sus ejecuciones", async () => {
    const pedidos: string[] = []
    const a = await leerAgrupacion(base(TABLAS, pedidos), LISTA.corridas.map((c) => c.workflow_execution_id))
    if (!a) throw new Error("sin agrupación")
    const l = agruparLista(LISTA, a)
    expect(l.corridas).toHaveLength(3)
    const p = l.corridas[0]
    expect(p.workflow_execution_id).toBe(`pedido:${REV}`)
    expect(p.nombre).toBe("Cambios al plan de 90 días · pedido del dueño")
    expect(p.miembros?.sort()).toEqual(["210596", "210597", "210600", "210611", GPT].sort())
    expect(p.inicio).toBe(CAMBIO.creado_en); expect(p.pasos).toBe(6)
    expect(l.total).toBe(3)
    // solo lectura
    expect(pedidos.every((x) => /^[a-z_]+:/.test(x))).toBe(true)
  })
  it("la llave del pedido del dueño: mismo cliente y la revisión se abrió mientras el pedido estaba vivo", () => {
    expect(cambioDeLaRevision(REVISION, [CAMBIO])?.id).toBe(CAMBIO.id)
    expect(cambioDeLaRevision({ ...REVISION, creado_en: "2026-11-01T21:00:00Z" }, [CAMBIO])).toBeNull()
    expect(cambioDeLaRevision({ ...REVISION, client_id: "otro" }, [CAMBIO])).toBeNull()
    expect(cambioDeLaRevision({ ...REVISION, artifact_type: "pieza" }, [CAMBIO])).toBeNull()
  })
  it("un plan nuevo junta planeación y su revisión por la aprobación del plan (llave exacta)", async () => {
    const t = { ...TABLAS, jefatura_pasos: [{ revision_id: PLAN_REV, n: 1, paso: "revision_fondo", tipo: "agente", agente: "editor_en_jefe", estado: "hecho", workflow_execution_id: "210300" }], jefatura_revisiones: [{ ...REVISION, id: PLAN_REV, artifact_id: "cd208273-0232-40ac-8735-c9c0651f427b", creado_en: "2026-11-01T16:47:54Z" }], plan_cambios: [], plan_aprobaciones: [{ plan_id: "cd208273-0232-40ac-8735-c9c0651f427b", planeacion: "210273" }] }
    const l = normalizarLista({ corridas: [corrida("210300", "o8qaF7bI0PKv2XGZ", "2026-11-01T16:47:57Z", "2026-11-01T16:49:09Z"), corrida("210273", "X9F0zp6LQ2xGEYVS", "2026-11-01T16:32:14Z", "2026-11-01T16:47:51Z")] })
    const a = await leerAgrupacion(base(t), ["210300", "210273"])
    const g = agruparLista(l, a!)
    expect(g.corridas).toHaveLength(1); expect(g.corridas[0].nombre).toBe("Plan de 90 días · investigación, redacción y revisión")
  })
  it("si no se puede leer cómo se encadenan, la lista queda suelta (y la ruta lo dice con «agrupado: false»)", async () => {
    const rota: BaseDeLectura = { from: () => ({ select: () => { const q = { in: () => q, eq: () => q, gte: () => q, like: () => q, order: () => q, limit: () => q, then: (ok: (x: unknown) => unknown) => Promise.resolve({ data: null, error: { message: "caída" } }).then(ok) }; return q as never } }) }
    expect(await leerAgrupacion(rota, ["210611"])).toBeNull()
    const src = readFileSync("app/api/direccion/corridas/route.ts", "utf8")
    expect(src).toContain("agrupado: !!agrupacion"); expect(src).toContain("exigirAdmin")
  })
})

describe("6.28 · 2 · cada paso dice quién y qué hizo", () => {
  it("la traza del pedido: dueño → planeación → jefatura → corrección → revisor externo → decisión → cierre → plan nuevo", async () => {
    const det = (ej: string, agente: string): DetalleDeCorrida => normalizarDetalle({ corrida: corrida(ej, "o8qaF7bI0PKv2XGZ", "2026-11-01T19:33:00Z", "2026-11-01T19:49:00Z"), arbol: [{ rama: null, costo_usd: 0.2, pasos: [{ origen: "invocacion", id: `inv-${ej}`, agente, inicio: PASOS.find((p) => p.workflow_execution_id === ej)?.inicio ?? "2026-11-01T19:40:03Z", fin: "2026-11-01T19:48:00Z", costo_usd: 0.2, tokens: {}, estado: "completed" }] }] })!
    const detalles: Record<string, DetalleDeCorrida> = { "210597": det("210597", "editor-en-jefe"), "210600": det("210600", "jefe-marketing"), "210611": det("210611", "jefe-marketing"), [GPT]: det(GPT, "revisor-externo-gpt") }
    const datos = await leerDatosDelPedido(base(TABLAS), `pedido:${REV}`, async (e) => detalles[e] ?? null)
    const traza = trazaDelPedido(datos!)
    const nombres = arbolDeNodos(normalizarDetalle(JSON.parse(JSON.stringify(traza)))!).map((n) => n.nombre)
    expect(nombres).toEqual([
      "Cambios al plan de 90 días · pedido del dueño",
      "Dueño · pide cambios al plan",
      "Editor en jefe · revisa el fondo del plan",
      "Jefe marketing · corrige el plan con lo que marcó la jefatura",
      "Revisor externo · segunda mirada",
      "Jefe marketing · decide qué toma del revisor externo",
      "Jefatura · cierra la revisión (limpia)",
      "Planeación · guarda el plan nuevo",
    ])
    expect(traza.arbol[0].pasos[0].entrada).toContain("guayaquil")
    expect(traza.completo).toBe(false) // 210596 no se pudo leer: la traza lo dice
  })
  it("los nombres de los pasos de la jefatura y de la oficina", () => {
    expect(nombreDelPasoDeJefatura("correccion:jefe-marketing", "jefe-marketing", "pieza")).toBe("Jefe marketing · corrige la pieza con lo que marcó la jefatura")
    expect(nombreDelTurno("mesa:dirigir:creative-director-mesa", "agente", "creative-director-mesa")).toBe("Creative director mesa · dirige la mesa")
    expect(nombreDelTurno("texto", "agente", "content-creator")).toBe("Content creator · escribe el texto")
    expect(nombreDelTurno("asignar_fotos", "codigo", null)).toBe("Asigna las fotos")
    expect(nombreDelTurno("paquete", "portero", null)).toBe("Portero del cerebro · arma el paquete del cerebro")
  })
})

describe("6.28 · 3 · la atascada", () => {
  it("un turno suelto se nombra por el empleado que se le encargó y sigue «atascada»; la traza remite a Riesgos", async () => {
    const a = await leerAgrupacion(base(TABLAS), LISTA.corridas.map((c) => c.workflow_execution_id))
    const s = agruparLista(LISTA, a!).corridas.find((c) => c.workflow_execution_id === "206191")
    expect(s?.nombre).toBe("Campaign brief · encargo de un turno de la jefatura, sin revisión registrada"); expect(s?.estado).toBe("atascada")
    expect(readFileSync("components/nuevo/PanelObservabilidad.tsx", "utf8")).toContain("También aparece en Riesgos")
  })
})
