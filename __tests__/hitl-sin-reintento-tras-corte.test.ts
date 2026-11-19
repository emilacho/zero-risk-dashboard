/**
 * 19-nov · CC5 · la 🟡 de CC7 en #349 (GO de Lenovo 03:26Z): resolver una revisión ya no REPITE el envío a n8n tras un corte por tiempo.
 *   · corte → un solo envío, y el motivo dice por qué no se repite (n8n pudo haberlo recibido: repetirlo reanudaría dos veces)
 *   · 5xx o falla de red sin corte → reintenta, pero solo con el tiempo que queda (los dos juntos nunca pasan de `timeoutMs`)
 * Reloj falso, sin red, US$ 0.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resolveHitlApproval } from "@/lib/hitl-resolve"

function base() {
  const fila = { id: "hitl-1", status: "pending", client_id: "d69100b5-8ad7-4bb0-908c-68b5544065dc", context: { execution_id: "exec-1", hitl_token: "tok-1" }, payload: {} }
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: () => Promise.resolve({ data: fila, error: null }),
    update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
  }
  return { from: () => q } as never
}

/** cada envío sigue el guion: `nunca` (solo termina si lo cortan) · un número = contesta ese estado tras `ms` · `red` = falla de red al instante */
function fetchConGuion(guion: Array<{ tipo: "nunca" } | { tipo: "estado"; estado: number; ms: number } | { tipo: "red" }>) {
  const senales: AbortSignal[] = []
  const f = vi.fn((_url: string, init?: RequestInit) => {
    const s = init?.signal as AbortSignal
    senales.push(s)
    const paso = guion[senales.length - 1] ?? { tipo: "nunca" as const }
    return new Promise<Response>((resolver, rechazar) => {
      s.addEventListener("abort", () => rechazar(new Error("This operation was aborted")))
      if (paso.tipo === "red") rechazar(new Error("fetch failed"))
      if (paso.tipo === "estado") setTimeout(() => resolver(new Response("x", { status: paso.estado })), paso.ms)
    })
  }) as unknown as typeof fetch
  return { f, senales }
}

const pedir = (f: typeof fetch, extra: Record<string, unknown> = {}) =>
  resolveHitlApproval(
    { hitl_id: "hitl-1", decision: "approve", reviewer_id: "emilio" },
    { supabase: base(), fetchImpl: f, wireEnabled: true, n8nBaseUrl: "https://n8n.example.com", timeoutMs: 1_000, ...extra },
  )

describe("resolver una revisión · el reintento a n8n", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("🔴 tras un CORTE por tiempo no repite el envío (n8n pudo haberlo recibido) y dice por qué", async () => {
    const { f, senales } = fetchConGuion([{ tipo: "nunca" }, { tipo: "estado", estado: 200, ms: 1 }])
    const p = pedir(f)
    await vi.advanceTimersByTimeAsync(1_001)
    const r = await p
    await vi.advanceTimersByTimeAsync(10_000)
    expect(senales.length).toBe(1)
    expect(r.ok).toBe(false)
    expect(r.n8n_status).toBe(0)
    expect(r.hitl_row_updated).toBe(false)
    expect(r.n8n_error).toContain("no se reintenta")
    expect(r.n8n_error).toContain("1000 ms")
  })

  it("🔴 tras un 5xx reintenta con SOLO el tiempo que queda: 503 a los 300 ms → el 2.º se corta a los 700 ms, no a los 1000", async () => {
    const { f, senales } = fetchConGuion([{ tipo: "estado", estado: 503, ms: 300 }, { tipo: "nunca" }])
    const p = pedir(f)
    await vi.advanceTimersByTimeAsync(300)
    expect(senales.length).toBe(2)
    await vi.advanceTimersByTimeAsync(699)
    expect(senales[1].aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    expect(senales[1].aborted).toBe(true)
    const r = await p
    expect(r.ok).toBe(false)
    expect(senales.length).toBe(2)
  })

  it("🔴 tras un 5xx el 2.º envío que contesta 200 resuelve la revisión", async () => {
    const { f, senales } = fetchConGuion([{ tipo: "estado", estado: 502, ms: 100 }, { tipo: "estado", estado: 200, ms: 100 }])
    const p = pedir(f)
    await vi.advanceTimersByTimeAsync(300)
    const r = await p
    expect(senales.length).toBe(2)
    expect(r.ok).toBe(true)
    expect(r.n8n_status).toBe(200)
  })

  it("🔴 una falla de red SIN corte sí reintenta (el pedido no llegó a n8n)", async () => {
    const { f, senales } = fetchConGuion([{ tipo: "red" }, { tipo: "estado", estado: 200, ms: 10 }])
    const p = pedir(f)
    await vi.advanceTimersByTimeAsync(50)
    const r = await p
    expect(senales.length).toBe(2)
    expect(r.ok).toBe(true)
  })

  it("🔴 con retryOnce false, un 5xx no reintenta", async () => {
    const { f, senales } = fetchConGuion([{ tipo: "estado", estado: 503, ms: 10 }, { tipo: "estado", estado: 200, ms: 10 }])
    const p = pedir(f, { retryOnce: false })
    await vi.advanceTimersByTimeAsync(50)
    const r = await p
    expect(senales.length).toBe(1)
    expect(r.n8n_status).toBe(503)
  })

  it("🔴 un 4xx no reintenta", async () => {
    const { f, senales } = fetchConGuion([{ tipo: "estado", estado: 404, ms: 10 }, { tipo: "estado", estado: 200, ms: 10 }])
    const p = pedir(f)
    await vi.advanceTimersByTimeAsync(50)
    const r = await p
    expect(senales.length).toBe(1)
    expect(r.n8n_status).toBe(404)
  })
})
