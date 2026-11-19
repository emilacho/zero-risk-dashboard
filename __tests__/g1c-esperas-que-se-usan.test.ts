/**
 * 19-nov · G1c (CC5) · lo que pidió CC7 para firmar #349 (CERTIFICACION-CC7-349, n1 · n2 · n4): pruebas de CONDUCTA, no del texto del archivo.
 *   · resolver una revisión: el pedido a n8n y el de la plataforma se cortan EXACTAMENTE con el `timeoutMs` que llega (chico corta, grande no),
 *     y sin `timeoutMs` esperan 790 s (bajo los 800 de la ruta), no 30
 *   · el asistente: el pedido al modelo lleva la señal del pedido de Emilio (si cierra la pestaña, el modelo deja de escribir y de cobrar)
 * Reloj falso, sin red, US$ 0.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resolveHitlApproval } from "@/lib/hitl-resolve"

/** una base de juguete: la fila de la revisión y un update que no falla */
function base(context: Record<string, unknown>) {
  const fila = { id: "hitl-1", status: "pending", client_id: "d69100b5-8ad7-4bb0-908c-68b5544065dc", context, payload: {} }
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: () => Promise.resolve({ data: fila, error: null }),
    update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
  }
  return { from: () => q } as never
}

/** un fetch que no contesta nunca: solo termina si lo cortan (registra cada señal que recibe) */
function fetchQueNoContesta() {
  const senales: AbortSignal[] = []
  const f = vi.fn((_url: string, init?: RequestInit) => {
    const s = init?.signal as AbortSignal
    senales.push(s)
    return new Promise<Response>((_, rechazar) => s.addEventListener("abort", () => rechazar(new Error("cortado"))))
  }) as unknown as typeof fetch
  return { f, senales }
}

const N8N = { execution_id: "exec-1", hitl_token: "tok-1" }
const SIN_N8N = {} // sin ejecución: se resuelve por la plataforma

describe("G1c · las esperas al resolver una revisión son las que llegan", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  for (const [nombre, context, extra] of [
    ["n8n (sendOnce)", N8N, { n8nBaseUrl: "https://n8n.example.com", retryOnce: false }],
    ["la plataforma (resolverPorLaPlataforma)", SIN_N8N, { platformApiUrl: "https://plataforma.example.com", internalKey: "llave" }],
  ] as const) {
    it(`🔴 ${nombre} · un timeoutMs chico corta a tiempo`, async () => {
      const { f, senales } = fetchQueNoContesta()
      const p = resolveHitlApproval({ hitl_id: "hitl-1", decision: "approve", reviewer_id: "emilio" }, { supabase: base(context), fetchImpl: f, wireEnabled: true, timeoutMs: 50, ...extra })
      await vi.advanceTimersByTimeAsync(49)
      expect(senales.at(-1)?.aborted).toBe(false)
      await vi.advanceTimersByTimeAsync(2)
      expect(senales.at(-1)?.aborted).toBe(true)
      await p
    })
    it(`🔴 ${nombre} · un timeoutMs grande no corta a los 30 s`, async () => {
      const { f, senales } = fetchQueNoContesta()
      const p = resolveHitlApproval({ hitl_id: "hitl-1", decision: "approve", reviewer_id: "emilio" }, { supabase: base(context), fetchImpl: f, wireEnabled: true, timeoutMs: 120_000, ...extra })
      await vi.advanceTimersByTimeAsync(119_000)
      expect(senales.at(-1)?.aborted).toBe(false)
      await vi.advanceTimersByTimeAsync(2_000)
      expect(senales.at(-1)?.aborted).toBe(true)
      await p
    })
    it(`🔴 ${nombre} · sin timeoutMs espera 790 s (no 30), bajo los 800 de la ruta`, async () => {
      const { f, senales } = fetchQueNoContesta()
      const p = resolveHitlApproval({ hitl_id: "hitl-1", decision: "approve", reviewer_id: "emilio" }, { supabase: base(context), fetchImpl: f, wireEnabled: true, ...extra })
      await vi.advanceTimersByTimeAsync(789_000)
      expect(senales.at(-1)?.aborted).toBe(false)
      await vi.advanceTimersByTimeAsync(2_000)
      expect(senales.at(-1)?.aborted).toBe(true)
      await p
    })
  }
})

// ── el asistente: la señal del pedido de Emilio llega al pedido al modelo ──
vi.mock("@/lib/supabase-session", () => ({
  getSessionClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "admin" } }) }) }) }),
  }),
}))
vi.mock("@/lib/supabase-server", () => ({ getServiceRoleClient: () => ({ from: () => { throw new Error("sin client_id no se lee la base") } }) }))

describe("G1c · el asistente corta al modelo si Emilio se va", () => {
  const original = globalThis.fetch
  afterEach(() => { globalThis.fetch = original; vi.unstubAllEnvs() })

  it("🔴 el pedido a la API del modelo lleva la señal del pedido del tablero (cerrar la pestaña lo corta)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "llave-de-prueba")
    let alModelo: RequestInit | undefined
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).startsWith("https://api.anthropic.com/")) alModelo = init
      return new Response("no", { status: 500 })
    }) as unknown as typeof fetch
    const { POST } = await import("@/app/api/cowork/prompt/route")
    const ctrl = new AbortController()
    const req = new Request("http://localhost/api/cowork/prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "hola", session_id: "s1" }), signal: ctrl.signal })
    const res = await POST(req)
    await res.text()
    expect(alModelo, "no llegó a pedir al modelo").toBeDefined()
    const s = alModelo!.signal as AbortSignal
    expect(s).toBeDefined()
    expect(s.aborted).toBe(false)
    ctrl.abort()
    expect(s.aborted).toBe(true)
  })
})
