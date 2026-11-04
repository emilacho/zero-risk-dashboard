/** CADA REVISIÓN A SU DOCUMENTO (CC6 · 03-nov · auditoría n.º 5 · contrato CC1 #871 `hitl_queue.documento`). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { cargarPieza, listarPiezas } from "@/lib/piezas-datos"

// una base falsa que FILTRA de verdad (eq / neq / not in / is), para ver qué filas entran en cada panel
const base = (filas: Array<Record<string, unknown>>) => ({ from: () => {
  let d = [...filas]
  const q: Record<string, unknown> = {}
  for (const m of ["select", "order", "limit"]) q[m] = () => q
  q.eq = (c: string, v: unknown) => { d = d.filter((f) => f[c] === v); return q }
  q.neq = (c: string, v: unknown) => { d = d.filter((f) => f[c] !== v); return q }
  q.in = (c: string, v: unknown[]) => { d = d.filter((f) => v.includes(f[c])); return q }
  q.is = (c: string, v: unknown) => { d = d.filter((f) => (f[c] ?? null) === v); return q }
  q.not = (c: string, op: string, v: unknown) => { if (op === "in") { const xs = String(v).replace(/[()]/g, "").split(","); d = d.filter((f) => !xs.includes(String(f[c]))) } else if (op === "is") d = d.filter((f) => (f[c] ?? null) !== v); return q }
  q.maybeSingle = () => Promise.resolve({ data: d[0] ?? null, error: null })
  q.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: d, error: null }).then(ok)
  return q
} }) as never

const fila = (id: string, type: string, documento: string, o: Record<string, unknown> = {}) => ({ id, type, documento, status: "pending", client_id: null, created_at: "2026-11-03T12:00:00Z", title: id, agent_name: null, output_preview: null, metadata: {}, decision: null, archivada_en: null, ...o })
// lo que hay hoy en la base (lectura del 03-nov 18:05Z): 6 del manual, 8 del editor sobre piezas, 14 piezas, 6 de competidores, 2 de plan
const BANDEJA = [
  fila("pieza-1", "content_piece_review", "pieza"),
  fila("editor-pieza", "editor_escalation", "pieza"),
  fila("editor-manual", "editor_escalation", "manual"),
  fila("plan-1", "plan_con_pendientes", "plan"),
  fila("competidores-1", "confirm_competitor_list", "competidores"),
  fila("otro-1", "algo_nuevo", "otro"),
]

describe("Piezas: cada revisión en el panel de su documento (lo decide la plataforma, no el tipo)", () => {
  it("«Piezas» muestra solo piezas para aprobar", async () => {
    expect((await listarPiezas(base(BANDEJA), { tipo: "piezas" })).map((x: { id: string }) => x.id)).toEqual(["pieza-1"])
  })
  it("«Otras revisiones»: ni lo del manual ni lo del plan; SÍ la revisión del editor sobre una pieza (en ningún otro panel se vería), competidores y lo no reconocido", async () => {
    const ids = (await listarPiezas(base(BANDEJA), { tipo: "otras" })).map((x: { id: string }) => x.id)
    expect(ids).not.toContain("editor-manual"); expect(ids).not.toContain("plan-1"); expect(ids).not.toContain("pieza-1")
    expect(ids.sort()).toEqual(["competidores-1", "editor-pieza", "otro-1"])
  })
  it("el panel del Manual lee por documento: la revisión del editor sobre una pieza no entra", () => {
    const fuente = readFileSync("lib/revisiones-del-manual.ts", "utf8")
    expect(fuente).toContain('.eq("documento", "manual")'); expect(fuente).not.toContain('.eq("type", "editor_escalation")')
  })
})

describe("la revisión del editor que ahora se ve en «Otras revisiones», legible (auditoría 5: monólogo y markdown crudo)", () => {
  const CRUDO = "Voy a revisar la pieza con cuidado. Tengo el contexto.\n\n---\n\n## Cambios\n- **Titular**: más corto (S2).\n- El content-creator lo dejó largo."
  it("el detalle llega sin el monólogo del agente ni nombres técnicos; las otras revisiones, tal cual", async () => {
    const d = await cargarPieza(base([fila("editor-pieza", "editor_escalation", "pieza", { output_preview: CRUDO })]), "editor-pieza")
    expect(d?.resumen_de_la_bandeja).not.toMatch(/Voy a revisar|Tengo el contexto|content-creator|\(S2\)/)
    expect(d?.resumen_de_la_bandeja).toContain("**Titular**: más corto")
    const otra = await cargarPieza(base([fila("comp", "confirm_competitor_list", "competidores", { output_preview: "Voy a listar 3 competidores." })]), "comp")
    expect(otra?.resumen_de_la_bandeja).toBe("Voy a listar 3 competidores.")
  })
  it("el panel la pinta con el visor legible (markdown interpretado), no como texto plano", () => {
    const fuente = readFileSync("components/nuevo/PanelPiezas.tsx", "utf8")
    expect(fuente).toMatch(/pieza\.tipo === "editor_escalation" \? <DocumentoLegible texto=\{pieza\.resumen_de_la_bandeja\}/)
    expect(fuente).toContain('"Lo que revisó el editor"')
  })
})
