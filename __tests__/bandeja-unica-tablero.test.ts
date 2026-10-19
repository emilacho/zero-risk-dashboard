/**
 * LA BANDEJA ÚNICA en el tablero de Emilio (CC#3 · 19-oct · arreglo 3). US$ 0, sin red.
 * El tablero lee y resuelve en `hitl_queue` (donde escriben la oficina, la revisión y las compuertas). Antes leía `hitl_approvals`, que nadie escribía.
 */
import { describe, expect, it, vi } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { resolveHitlApproval } from "@/lib/hitl-resolve"
import { COLUMNAS_DE_LA_BANDEJA, filaParaLaTarjeta, type HitlQueueRow } from "@/lib/bandeja-tarjeta"

type Llamada = [string, ...unknown[]]
/** una base falsa que anota cada llamada (tabla, filtros, parche) */
function grabadora(fila: Record<string, unknown> | null) {
  const llamadas: Llamada[] = []
  const consulta = {
    select(c: string) { llamadas.push(["select", c]); return consulta },
    eq(c: string, v: unknown) { llamadas.push(["eq", c, v]); return consulta },
    maybeSingle() { return Promise.resolve({ data: fila, error: null }) },
    update(p: unknown) {
      llamadas.push(["update", p])
      return { eq(c: string, v: unknown) { llamadas.push(["eq", c, v]); return { eq(c2: string, v2: unknown) { llamadas.push(["eq", c2, v2]); return Promise.resolve({ error: null }) } } } }
    },
  }
  const supabase = { from(t: string) { llamadas.push(["from", t]); return consulta } } as unknown as Parameters<typeof resolveHitlApproval>[1]["supabase"]
  return { supabase, llamadas }
}
const CLIENTE = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const AHORA = () => "2026-10-19T12:00:00Z"
/** una compuerta de n8n: trae la ejecución pausada (execution_id + token) en metadata */
const conEjecucion = { id: "h-1", status: "pending", client_id: CLIENTE, metadata: { origen: "workflow", execution_id: "exec-1", hitl_token: "tok-1" }, payload: { x: 1 } }
/** una pieza que deja la oficina: no hay ninguna ejecución de n8n esperando */
const pieza = { id: "p-1", status: "pending", client_id: CLIENTE, metadata: { origen: "oficina" }, payload: {} }
const fetchOk = () => vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch
const tablasUsadas = (l: Llamada[]) => l.filter((x) => x[0] === "from").map((x) => x[1])

describe("la tarjeta de la bandeja única", () => {
  const fila: HitlQueueRow = { id: "p-1", status: "pending", priority: "medium", client_id: CLIENTE, created_at: "2026-10-19T10:00:00Z", payload: { extra: 1 }, metadata: { origen: "oficina" }, title: "Pieza BRF-0001 · instagram", agent_name: "oficina", type: "pieza", output_preview: "Texto de la pieza", resolution_notes: null }
  it("antepone lo que dice la bandeja (título, quién, tipo, vista previa) a la carga y deja la carga propia", () => {
    const t = filaParaLaTarjeta(fila)
    expect(t.payload).toEqual({ titulo: "Pieza BRF-0001 · instagram", empleado: "oficina", tipo: "pieza", vista_previa: "Texto de la pieza", extra: 1 })
    expect(t.context).toEqual({ origen: "oficina" })
    expect(t).toMatchObject({ id: "p-1", status: "pending", client_id: CLIENTE, rejection_reason: null })
    expect(filaParaLaTarjeta({ ...fila, status: "rejected", resolution_notes: "no va con la marca" }).rejection_reason).toBe("no va con la marca")
  })
  it("una fila sin título ni vista previa no inventa claves, y la carga propia gana si choca", () => {
    const t = filaParaLaTarjeta({ ...fila, title: null, agent_name: null, type: null, output_preview: null, payload: { titulo: "propio" } })
    expect(t.payload).toEqual({ titulo: "propio" })
    expect(filaParaLaTarjeta({ ...fila, title: "de la bandeja", payload: { titulo: "propio" } }).payload).toMatchObject({ titulo: "propio" })
  })
  it("pide a la base justo las columnas que la tarjeta necesita (todas existen en hitl_queue)", () => {
    for (const c of ["id", "status", "priority", "client_id", "created_at", "payload", "metadata", "title", "agent_name", "type", "output_preview", "resolution_notes"]) expect(COLUMNAS_DE_LA_BANDEJA).toContain(c)
    expect(COLUMNAS_DE_LA_BANDEJA).not.toMatch(/\b(context|rejection_reason|approved_by)\b/)
  })
})

describe("resolver desde el tablero, sobre la bandeja única", () => {
  it("🔴 lee y actualiza SOLO hitl_queue, y el contexto de n8n sale de metadata", async () => {
    const g = grabadora(conEjecucion)
    const f = fetchOk()
    const r = await resolveHitlApproval({ hitl_id: "h-1", decision: "approve", reviewer_id: "emilio" }, { supabase: g.supabase, fetchImpl: f, wireEnabled: true, n8nBaseUrl: "https://n8n.test", now: AHORA })
    expect(tablasUsadas(g.llamadas)).toEqual(["hitl_queue", "hitl_queue"])
    expect(g.llamadas).toContainEqual(["select", "id, status, client_id, metadata, payload"])
    expect(r).toMatchObject({ mode: "live", ok: true, execution_id: "exec-1", n8n_status: 200, hitl_row_updated: true })
    const cuerpo = JSON.parse(String((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body))
    expect(cuerpo).toMatchObject({ execution_id: "exec-1", hitl_token: "tok-1", decision: "approve", hitl_id: "h-1" })
  })
  it("aprobar escribe las columnas REALES de la bandeja (y ninguna de la tabla vieja), solo si sigue pendiente", async () => {
    const g = grabadora(conEjecucion)
    await resolveHitlApproval({ hitl_id: "h-1", decision: "approve", reviewer_id: "emilio" }, { supabase: g.supabase, fetchImpl: fetchOk(), wireEnabled: true, n8nBaseUrl: "https://n8n.test", now: AHORA })
    const parche = g.llamadas.find((x) => x[0] === "update")![1] as Record<string, unknown>
    expect(parche).toEqual({ status: "approved", resolved_by: "emilio", reviewer: "emilio", resolved_at: AHORA(), decided_at: AHORA(), decision: { decision: "approved", por: "emilio", cuando: AHORA() } })
    expect(parche).not.toHaveProperty("approved_by")
    expect(g.llamadas.filter((x) => x[0] === "eq").slice(-2)).toEqual([["eq", "id", "h-1"], ["eq", "status", "pending"]])
  })
  it("rechazar guarda el motivo en resolution_notes y en la decisión", async () => {
    const g = grabadora(conEjecucion)
    await resolveHitlApproval({ hitl_id: "h-1", decision: "reject", reviewer_id: "emilio", rejection_reason: "no va con la marca" }, { supabase: g.supabase, fetchImpl: fetchOk(), wireEnabled: true, n8nBaseUrl: "https://n8n.test", now: AHORA })
    const parche = g.llamadas.find((x) => x[0] === "update")![1] as Record<string, unknown>
    expect(parche).toMatchObject({ status: "rejected", resolution_notes: "no va con la marca", decision: { decision: "rejected", motivo: "no va con la marca" } })
    expect(parche).not.toHaveProperty("rejection_reason")
    expect(parche).not.toHaveProperty("rejected_at")
  })
  it("🔴 una pieza de la oficina (sin ejecución de n8n) se resuelve POR LA PLATAFORMA: PATCH /api/hitl/{id} con la llave; ni webhook de n8n ni escritura directa del tablero", async () => {
    const g = grabadora(pieza)
    const f = fetchOk()
    const r = await resolveHitlApproval({ hitl_id: "p-1", decision: "approve", reviewer_id: "emilio" }, { supabase: g.supabase, fetchImpl: f, wireEnabled: true, n8nBaseUrl: "", platformApiUrl: "https://plataforma.test/", internalKey: "llave-interna", now: AHORA })
    expect(r).toMatchObject({ mode: "live", ok: true, hitl_row_updated: true, execution_id: null, platform_status: 200 })
    expect(r.n8n_status).toBeUndefined()
    const llamadas = (f as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(llamadas).toHaveLength(1)
    expect(llamadas[0][0]).toBe("https://plataforma.test/api/hitl/p-1")
    expect(llamadas[0][1]).toMatchObject({ method: "PATCH", headers: { "x-api-key": "llave-interna", "Content-Type": "application/json" } })
    expect(JSON.parse(String(llamadas[0][1].body))).toEqual({ status: "approved", reviewer: "emilio", decision: { decision: "approved", por: "emilio", cuando: AHORA() } })
    expect(g.llamadas.some((x) => x[0] === "update")).toBe(false) // el tablero NO toca la fila: los efectos de aprobar viven en la plataforma
  })
  it("rechazar por la plataforma: el motivo viaja como frase del aprobador (la plataforma lo guarda como nota del borrador) y dentro de la decisión", async () => {
    const g = grabadora(pieza)
    const f = fetchOk()
    await resolveHitlApproval({ hitl_id: "p-1", decision: "reject", reviewer_id: "emilio", rejection_reason: "no va con la marca" }, { supabase: g.supabase, fetchImpl: f, wireEnabled: true, platformApiUrl: "https://plataforma.test", internalKey: "k", now: AHORA })
    const cuerpo = JSON.parse(String((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body))
    expect(cuerpo).toEqual({ status: "rejected", reviewer: "emilio", decision: { decision: "rejected", por: "emilio", cuando: AHORA(), motivo: "no va con la marca" }, frase_del_aprobador: "no va con la marca" })
  })
  it("el id va codificado en la dirección (una fila con caracteres raros no cambia la ruta)", async () => {
    const g = grabadora({ ...pieza, id: "a/b?c" })
    const f = fetchOk()
    await resolveHitlApproval({ hitl_id: "a/b?c", decision: "approve", reviewer_id: "emilio" }, { supabase: g.supabase, fetchImpl: f, wireEnabled: true, platformApiUrl: "https://plataforma.test", internalKey: "k", now: AHORA })
    expect((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("https://plataforma.test/api/hitl/a%2Fb%3Fc")
  })
  it("un 207 de la plataforma (decisión tomada, efecto parcial) cuenta como resuelta y lo dice en platform_status", async () => {
    const g = grabadora(pieza)
    const f = vi.fn(async () => new Response("{}", { status: 207 })) as unknown as typeof fetch
    const r = await resolveHitlApproval({ hitl_id: "p-1", decision: "approve", reviewer_id: "emilio" }, { supabase: g.supabase, fetchImpl: f, wireEnabled: true, platformApiUrl: "https://plataforma.test", internalKey: "k", now: AHORA })
    expect(r).toMatchObject({ ok: true, platform_status: 207, hitl_row_updated: true })
  })
  it("si la plataforma falla (404, 500 o red) NO se da por resuelta y se dice por qué; sin reintento", async () => {
    for (const [respuesta, esperado] of [[new Response('{"error":"not_found"}', { status: 404 }), 404], [new Response("caído", { status: 500 }), 500]] as const) {
      const g = grabadora(pieza)
      const f = vi.fn(async () => respuesta.clone()) as unknown as typeof fetch
      const r = await resolveHitlApproval({ hitl_id: "p-1", decision: "approve", reviewer_id: "emilio" }, { supabase: g.supabase, fetchImpl: f, wireEnabled: true, platformApiUrl: "https://plataforma.test", internalKey: "k", now: AHORA })
      expect(r).toMatchObject({ mode: "live", ok: false, platform_status: esperado, hitl_row_updated: false })
      expect(String(r.platform_error)).not.toBe("")
      expect(f).toHaveBeenCalledTimes(1)
    }
    const g = grabadora(pieza)
    const caida = vi.fn(async () => { throw new Error("ECONNRESET") }) as unknown as typeof fetch
    const r = await resolveHitlApproval({ hitl_id: "p-1", decision: "approve", reviewer_id: "emilio" }, { supabase: g.supabase, fetchImpl: caida, wireEnabled: true, platformApiUrl: "https://plataforma.test", internalKey: "k", now: AHORA })
    expect(r).toMatchObject({ ok: false, platform_status: 0, platform_error: "ECONNRESET", hitl_row_updated: false })
  })
  it("sin la llave interna no hay con qué llamar a la plataforma: se rechaza antes de llamar a nadie", async () => {
    const g = grabadora(pieza)
    const f = fetchOk()
    const r = await resolveHitlApproval({ hitl_id: "p-1", decision: "approve", reviewer_id: "emilio" }, { supabase: g.supabase, fetchImpl: f, wireEnabled: true, platformApiUrl: "https://plataforma.test", internalKey: "", now: AHORA })
    expect(r).toMatchObject({ mode: "refused", ok: false })
    expect(r.refused_reason).toMatch(/internal_key_unset/)
    expect(f).not.toHaveBeenCalled()
  })
  it("con ejecución pausada pero sin dirección de n8n sigue rechazando (nada cambia para las compuertas)", async () => {
    const g = grabadora(conEjecucion)
    const r = await resolveHitlApproval({ hitl_id: "h-1", decision: "approve", reviewer_id: "emilio" }, { supabase: g.supabase, fetchImpl: fetchOk(), wireEnabled: true, n8nBaseUrl: "", now: AHORA })
    expect(r).toMatchObject({ mode: "refused", ok: false })
    expect(g.llamadas.some((x) => x[0] === "update")).toBe(false)
  })
  it("un webhook que falla no actualiza la fila (como antes)", async () => {
    const g = grabadora(conEjecucion)
    const f = vi.fn(async () => new Response("{}", { status: 400 })) as unknown as typeof fetch
    const r = await resolveHitlApproval({ hitl_id: "h-1", decision: "approve", reviewer_id: "emilio" }, { supabase: g.supabase, fetchImpl: f, wireEnabled: true, n8nBaseUrl: "https://n8n.test", now: AHORA })
    expect(r).toMatchObject({ mode: "live", ok: false, n8n_status: 400, hitl_row_updated: false })
    expect(g.llamadas.some((x) => x[0] === "update")).toBe(false)
  })
  it("en modo sombra (interruptor apagado) no cambia nada, ni siquiera para una pieza", async () => {
    const g = grabadora(pieza)
    const f = fetchOk()
    const r = await resolveHitlApproval({ hitl_id: "p-1", decision: "approve", reviewer_id: "emilio" }, { supabase: g.supabase, fetchImpl: f, wireEnabled: false, now: AHORA })
    expect(r).toMatchObject({ mode: "shadow", ok: true, hitl_row_updated: false })
    expect(f).not.toHaveBeenCalled()
    expect(g.llamadas.some((x) => x[0] === "update")).toBe(false)
  })
  it("una fila que ya no está pendiente se rechaza sin tocarla", async () => {
    const g = grabadora({ ...pieza, status: "approved" })
    const r = await resolveHitlApproval({ hitl_id: "p-1", decision: "approve", reviewer_id: "emilio" }, { supabase: g.supabase, fetchImpl: fetchOk(), wireEnabled: true, n8nBaseUrl: "", now: AHORA })
    expect(r).toMatchObject({ mode: "refused", ok: false })
    expect(r.refused_reason).toMatch(/already_resolved/)
  })
})

describe("🔴 una sola bandeja: el tablero no lee la tabla vieja", () => {
  const RAIZ = path.resolve(__dirname, "..")
  const archivos = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (["node_modules", ".next", "__tests__", ".git"].includes(e.name) ? [] : archivos(path.join(d, e.name))) : /\.(ts|tsx)$/.test(e.name) ? [path.join(d, e.name)] : [])
  it("ningún archivo del tablero usa .from(\"hitl_approvals\") ni .from(\"hitl_pending_approvals\")", () => {
    const malos = ["app", "components", "lib"].flatMap((d) => archivos(path.join(RAIZ, d))).filter((f) => /\.from\(\s*["'`](hitl_approvals|hitl_pending_approvals)["'`]\s*\)/.test(fs.readFileSync(f, "utf8")))
    expect(malos.map((f) => path.relative(RAIZ, f))).toEqual([])
  })
})
