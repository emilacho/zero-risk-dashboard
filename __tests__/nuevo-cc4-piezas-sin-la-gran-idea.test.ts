/**
 * PIEZAS SIN LAS DECISIONES DE LA GRAN IDEA (CC4 · 11-nov · GO Lenovo). US$ 0 · sin red.
 * Visto en vivo: Piezas › «Otras revisiones» mostraba 3 tarjetas «Gran idea · … · campaña Náufrago» «sin dibujo» y Emilio creía que eran piezas.
 * Causa: «Otras revisiones» excluía solo los documentos manual y plan; la plataforma clasifica la gran idea como `documento = gran_idea`
 * (tipo `concepto_review`), que tiene su propio panel (Centro de campaña › Gran idea). Dos clientes de rubros distintos, base que FILTRA de verdad.
 */
import { describe, expect, it } from "vitest"
import { listarPiezas } from "@/lib/piezas-datos"
import { dondeSeDecide } from "@/lib/direccion-decisiones"

const base = (filas: Array<Record<string, unknown>>) => ({ from: () => {
  let d = [...filas]
  const q: Record<string, unknown> = {}
  for (const m of ["select", "order", "limit"]) q[m] = () => q
  q.eq = (c: string, v: unknown) => { d = d.filter((f) => f[c] === v); return q }
  q.neq = (c: string, v: unknown) => { d = d.filter((f) => f[c] !== v); return q }
  q.in = (c: string, v: unknown[]) => { d = d.filter((f) => v.includes(f[c])); return q }
  q.is = (c: string, v: unknown) => { d = d.filter((f) => (f[c] ?? null) === v); return q }
  q.not = (c: string, op: string, v: unknown) => {
    if (op === "in") { const xs = String(v).replace(/[()]/g, "").split(","); d = d.filter((f) => f[c] !== null && f[c] !== undefined && !xs.includes(String(f[c]))) }
    else if (op === "is") d = d.filter((f) => (f[c] ?? null) !== v)
    return q
  }
  q.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: d, error: null }).then(ok)
  return q
} }) as never

const fila = (id: string, client_id: string, type: string, documento: string, status = "pending") =>
  ({ id, type, documento, status, client_id, created_at: "2026-11-10T12:00:00Z", title: id, agent_name: null, output_preview: null, metadata: {}, decision: null, archivada_en: null })

const RESTAURANTE = "cliente-restaurante"
const B2B = "cliente-practica-b2b"
// lo que hay hoy (lectura 11-nov 03:1xZ): 3 decisiones de gran idea de Náufrago (1 aprobada, 2 rechazadas), piezas y revisiones del editor, competidores
const BANDEJA = [
  fila("gi-aprobada", RESTAURANTE, "concepto_review", "gran_idea", "approved"),
  fila("gi-rechazada-1", RESTAURANTE, "concepto_review", "gran_idea", "rejected"),
  fila("gi-pendiente-b2b", B2B, "concepto_review", "gran_idea"),
  fila("pieza-restaurante", RESTAURANTE, "content_piece_review", "pieza"),
  fila("editor-sobre-pieza-b2b", B2B, "editor_escalation", "pieza"),
  fila("competidores-b2b", B2B, "confirm_competitor_list", "competidores"),
  fila("plan-restaurante", RESTAURANTE, "plan_con_pendientes", "plan"),
]
const ids = async (o: Parameters<typeof listarPiezas>[1]) => (await listarPiezas(base(BANDEJA), o)).map((x: { id: string }) => x.id).sort()

describe("Piezas no muestra las decisiones de la gran idea (dos clientes, dos rubros)", () => {
  it("«Otras revisiones», en todos los estados: sin gran idea; sí la revisión del editor sobre una pieza y los competidores", async () => {
    const otras = await ids({ tipo: "otras", estado: "todas" })
    expect(otras.filter((x) => x.startsWith("gi-"))).toEqual([])
    expect(otras).toEqual(["competidores-b2b", "editor-sobre-pieza-b2b"])
  })
  it("pendientes: la gran idea pendiente del cliente B2B tampoco cae en Piezas", async () => {
    expect(await ids({ tipo: "otras" })).toEqual(["competidores-b2b", "editor-sobre-pieza-b2b"])
    expect(await ids({ tipo: "piezas" })).toEqual(["pieza-restaurante"])
  })
  it("una revisión de la gran idea se decide en su panel, no en Piezas", () => {
    expect(dondeSeDecide({ tipo: "revision", documento: "gran_idea" })).toEqual({ panel: "gran_idea", boton: "Abrir la gran idea para decidir" })
    expect(dondeSeDecide({ tipo: "gran_idea" })).toMatchObject({ panel: "gran_idea" })
    expect(dondeSeDecide({ tipo: "revision", documento: "competidores" })).toMatchObject({ panel: "piezas" }) // sin panel propio: sigue en Piezas
  })
})
