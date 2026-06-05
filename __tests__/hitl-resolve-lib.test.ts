/**
 * Tests · `lib/hitl-resolve.ts` · Phase 1 wire del HITL Approve/Reject.
 *
 * canon canon-canonical cover ·
 *   - validation · refuses missing/invalid fields
 *   - shadow gate (default) · no fetch · no DB update · still resolves row lookup
 *   - live gate · POSTs to n8n /webhook/hitl-resume with canon payload
 *   - live · retry once on 5xx · canon-canon-spec §2.A
 *   - live · DB row update applies status + ts + reviewer + reason
 *   - already resolved · refuses with hitl_already_resolved
 *   - missing row · refuses with hitl_id_not_found
 *   - pre-lookup canon · /api/clients?name= invoked only when client_id null
 *   - n8n base url unset in live mode · refuses
 */
import { describe, expect, it, vi } from "vitest"
import { resolveHitlApproval, extractWebhookFields } from "@/lib/hitl-resolve"

type Stub = ReturnType<typeof makeStub>

const NAUFRAGO_UUID = "d69100b5-8ad7-4bb0-908c-68b5544065dc"

function makeStub(opts: {
  row?: {
    id: string
    status: string
    client_id: string | null
    context: Record<string, unknown> | null
    payload: Record<string, unknown> | null
  } | null
  lookupError?: { message: string } | null
  updateError?: { message: string } | null
}) {
  const calls: { kind: string; args: unknown[] }[] = []
  // canon · canon canon-mock supabase-js fluent builder
  const fluent = {
    select(_cols: string, _opts?: unknown) {
      calls.push({ kind: "select", args: [_cols] })
      return fluent
    },
    eq(_col: string, _val: unknown) {
      calls.push({ kind: "eq", args: [_col, _val] })
      return fluent
    },
    maybeSingle() {
      calls.push({ kind: "maybeSingle", args: [] })
      return Promise.resolve({ data: opts.row, error: opts.lookupError ?? null })
    },
    update(patch: unknown) {
      calls.push({ kind: "update", args: [patch] })
      return {
        eq(_c: string, _v: unknown) {
          return {
            eq(_c2: string, _v2: unknown) {
              return Promise.resolve({ error: opts.updateError ?? null })
            },
          }
        },
      }
    },
  }
  const supabase = {
    from(_t: string) {
      calls.push({ kind: "from", args: [_t] })
      return fluent
    },
  }
  return {
    supabase: supabase as unknown as Parameters<typeof resolveHitlApproval>[1]["supabase"],
    calls,
  }
}

function baseRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "hitl-123",
    status: "pending",
    client_id: NAUFRAGO_UUID,
    context: { execution_id: "exec-abc", hitl_token: "tok-xyz" },
    payload: { proposal: "draft brief v1" },
    ...over,
  } as never
}

describe("extractWebhookFields", () => {
  it("canon · canon-canonical-extracts execution_id + hitl_token + client_name from context", () => {
    const row = {
      id: "h",
      status: "pending",
      client_id: null,
      payload: null,
      context: {
        execution_id: "e1",
        hitl_token: "t1",
        client_name: "Naufrago",
      },
    }
    expect(extractWebhookFields(row)).toEqual({
      execution_id: "e1",
      hitl_token: "t1",
      client_name: "Naufrago",
    })
  })

  it("canon · canon-canonical-supports camelCase alias", () => {
    const row = {
      id: "h",
      status: "pending",
      client_id: null,
      payload: null,
      context: { executionId: "e2", hitlToken: "t2", clientName: "Naufrago" },
    }
    expect(extractWebhookFields(row)).toEqual({
      execution_id: "e2",
      hitl_token: "t2",
      client_name: "Naufrago",
    })
  })

  it("canon · canon-canonical-null context returns all-null", () => {
    expect(
      extractWebhookFields({
        id: "h",
        status: "pending",
        client_id: null,
        payload: null,
        context: null,
      }),
    ).toEqual({ execution_id: null, hitl_token: null, client_name: null })
  })
})

describe("resolveHitlApproval · validation", () => {
  it("canon · refuses missing hitl_id", async () => {
    const stub = makeStub({ row: null })
    const r = await resolveHitlApproval(
      { hitl_id: "", decision: "approve", reviewer_id: "emilio" },
      { supabase: stub.supabase, wireEnabled: false },
    )
    expect(r.mode).toBe("refused")
    expect(r.refused_reason).toMatch(/hitl_id required/)
  })

  it("canon · refuses invalid decision", async () => {
    const stub = makeStub({ row: null })
    const r = await resolveHitlApproval(
      // @ts-expect-error · canon canon-test invariant
      { hitl_id: "h-1", decision: "weird", reviewer_id: "emilio" },
      { supabase: stub.supabase, wireEnabled: false },
    )
    expect(r.mode).toBe("refused")
    expect(r.refused_reason).toMatch(/decision must be approve\|reject/)
  })

  it("canon · refuses missing reviewer_id", async () => {
    const stub = makeStub({ row: null })
    const r = await resolveHitlApproval(
      { hitl_id: "h-1", decision: "approve", reviewer_id: "" },
      { supabase: stub.supabase, wireEnabled: false },
    )
    expect(r.mode).toBe("refused")
    expect(r.refused_reason).toMatch(/reviewer_id required/)
  })

  it("canon · reject without rejection_reason · refused", async () => {
    const stub = makeStub({ row: null })
    const r = await resolveHitlApproval(
      { hitl_id: "h-1", decision: "reject", reviewer_id: "emilio" },
      { supabase: stub.supabase, wireEnabled: false },
    )
    expect(r.mode).toBe("refused")
    expect(r.refused_reason).toMatch(/rejection_reason required/)
  })
})

describe("resolveHitlApproval · row lookup", () => {
  it("canon · row not found · refused", async () => {
    const stub = makeStub({ row: null })
    const r = await resolveHitlApproval(
      { hitl_id: "h-missing", decision: "approve", reviewer_id: "emilio" },
      { supabase: stub.supabase, wireEnabled: false },
    )
    expect(r.mode).toBe("refused")
    expect(r.refused_reason).toBe("hitl_id_not_found")
  })

  it("canon · row already resolved (status=approved) · refused", async () => {
    const stub = makeStub({ row: baseRow({ status: "approved" }) })
    const r = await resolveHitlApproval(
      { hitl_id: "hitl-123", decision: "approve", reviewer_id: "emilio" },
      { supabase: stub.supabase, wireEnabled: false },
    )
    expect(r.mode).toBe("refused")
    expect(r.refused_reason).toMatch(/hitl_already_resolved/)
  })

  it("canon · DB lookup error · refused with diagnostic", async () => {
    const stub = makeStub({ row: null, lookupError: { message: "boom" } })
    const r = await resolveHitlApproval(
      { hitl_id: "h-1", decision: "approve", reviewer_id: "emilio" },
      { supabase: stub.supabase, wireEnabled: false },
    )
    expect(r.mode).toBe("refused")
    expect(r.refused_reason).toMatch(/db_lookup_error/)
  })
})

describe("resolveHitlApproval · SHADOW mode (default)", () => {
  it("canon · canon-canon-shadow · no fetch · no n8n call · returns mode shadow", async () => {
    const stub: Stub = makeStub({ row: baseRow() })
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const r = await resolveHitlApproval(
      { hitl_id: "hitl-123", decision: "approve", reviewer_id: "emilio" },
      { supabase: stub.supabase, fetchImpl, wireEnabled: false },
    )
    expect(r.mode).toBe("shadow")
    expect(r.ok).toBe(true)
    expect(r.client_id).toBe(NAUFRAGO_UUID)
    expect(r.execution_id).toBe("exec-abc")
    expect(r.hitl_row_updated).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("canon · canon-canon-shadow · reject path · still validates rejection_reason", async () => {
    const stub = makeStub({ row: baseRow() })
    const r = await resolveHitlApproval(
      {
        hitl_id: "hitl-123",
        decision: "reject",
        reviewer_id: "emilio",
        rejection_reason: "not aligned with brand",
      },
      { supabase: stub.supabase, wireEnabled: false },
    )
    expect(r.mode).toBe("shadow")
    expect(r.decision).toBe("reject")
  })
})

describe("resolveHitlApproval · LIVE mode · n8n POST", () => {
  it("canon · live · POSTs canon payload to /webhook/hitl-resume · returns ok", async () => {
    const stub = makeStub({ row: baseRow() })
    let calledUrl = ""
    let calledBody: Record<string, unknown> | null = null
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calledUrl = url
      calledBody = init?.body ? JSON.parse(init.body as string) : null
      return new Response('{"ok":true}', { status: 200 })
    }) as unknown as typeof fetch
    const r = await resolveHitlApproval(
      { hitl_id: "hitl-123", decision: "approve", reviewer_id: "emilio" },
      {
        supabase: stub.supabase,
        fetchImpl,
        wireEnabled: true,
        n8nBaseUrl: "https://n8n.example.com",
        now: () => "2026-06-05T10:00:00Z",
      },
    )
    expect(r.mode).toBe("live")
    expect(r.ok).toBe(true)
    expect(r.n8n_status).toBe(200)
    expect(r.hitl_row_updated).toBe(true)
    expect(calledUrl).toBe("https://n8n.example.com/webhook/hitl-resume")
    expect(calledBody).toMatchObject({
      decision: "approve",
      execution_id: "exec-abc",
      hitl_token: "tok-xyz",
      reviewer_id: "emilio",
      hitl_id: "hitl-123",
      client_id: NAUFRAGO_UUID,
      resolved_at: "2026-06-05T10:00:00Z",
    })
  })

  it("canon · live · n8n_base_url unset · refuses without POST", async () => {
    const stub = makeStub({ row: baseRow() })
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const r = await resolveHitlApproval(
      { hitl_id: "hitl-123", decision: "approve", reviewer_id: "emilio" },
      {
        supabase: stub.supabase,
        fetchImpl,
        wireEnabled: true,
        n8nBaseUrl: "",
      },
    )
    expect(r.mode).toBe("refused")
    expect(r.refused_reason).toBe("n8n_base_url_unset")
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("canon · live · n8n 503 · retries once · second 200 · returns ok", async () => {
    const stub = makeStub({ row: baseRow() })
    let n = 0
    const fetchImpl = vi.fn(async () => {
      n++
      return n === 1
        ? new Response("upstream", { status: 503 })
        : new Response('{"ok":true}', { status: 200 })
    }) as unknown as typeof fetch
    const r = await resolveHitlApproval(
      { hitl_id: "hitl-123", decision: "approve", reviewer_id: "emilio" },
      {
        supabase: stub.supabase,
        fetchImpl,
        wireEnabled: true,
        n8nBaseUrl: "https://n8n.example.com",
      },
    )
    expect(r.mode).toBe("live")
    expect(r.ok).toBe(true)
    expect(r.n8n_status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it("canon · live · n8n 503 twice · returns ok=false + status 503", async () => {
    const stub = makeStub({ row: baseRow() })
    const fetchImpl = vi.fn(
      async () => new Response("upstream", { status: 503 }),
    ) as unknown as typeof fetch
    const r = await resolveHitlApproval(
      { hitl_id: "hitl-123", decision: "approve", reviewer_id: "emilio" },
      {
        supabase: stub.supabase,
        fetchImpl,
        wireEnabled: true,
        n8nBaseUrl: "https://n8n.example.com",
      },
    )
    expect(r.mode).toBe("live")
    expect(r.ok).toBe(false)
    expect(r.n8n_status).toBe(503)
    expect(r.hitl_row_updated).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it("canon · live · DB update failure post-n8n · returns ok=true + hitl_row_updated=false", async () => {
    const stub = makeStub({
      row: baseRow(),
      updateError: { message: "db update boom" },
    })
    const fetchImpl = vi.fn(
      async () => new Response('{"ok":true}', { status: 200 }),
    ) as unknown as typeof fetch
    const r = await resolveHitlApproval(
      { hitl_id: "hitl-123", decision: "approve", reviewer_id: "emilio" },
      {
        supabase: stub.supabase,
        fetchImpl,
        wireEnabled: true,
        n8nBaseUrl: "https://n8n.example.com",
      },
    )
    expect(r.mode).toBe("live")
    expect(r.ok).toBe(true)
    expect(r.n8n_status).toBe(200)
    expect(r.hitl_row_updated).toBe(false)
  })
})

describe("resolveHitlApproval · client_id pre-lookup canon", () => {
  it("canon · row has client_id · lookup is by-id (no platform call)", async () => {
    const stub = makeStub({ row: baseRow() })
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const r = await resolveHitlApproval(
      { hitl_id: "hitl-123", decision: "approve", reviewer_id: "emilio" },
      {
        supabase: stub.supabase,
        fetchImpl,
        wireEnabled: false,
        platformBaseUrl: "https://platform.example.com",
      },
    )
    expect(r.client_lookup).toBe("by-id")
    expect(r.client_id).toBe(NAUFRAGO_UUID)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("canon · row missing client_id · context has client_name · pre-lookup succeeds", async () => {
    const stub = makeStub({
      row: baseRow({
        client_id: null,
        context: {
          execution_id: "exec-abc",
          hitl_token: "tok-xyz",
          client_name: "Naufrago",
        },
      }),
    })
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            client: { id: NAUFRAGO_UUID, name: "Naufrago" },
            lookup: "by-name",
            id: NAUFRAGO_UUID,
            name: "Naufrago",
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch
    const r = await resolveHitlApproval(
      { hitl_id: "hitl-123", decision: "approve", reviewer_id: "emilio" },
      {
        supabase: stub.supabase,
        fetchImpl,
        wireEnabled: false,
        platformBaseUrl: "https://platform.example.com",
      },
    )
    expect(r.client_lookup).toBe("by-name")
    expect(r.client_id).toBe(NAUFRAGO_UUID)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const url = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(url).toMatch(/\/api\/clients\?name=Naufrago$/)
  })

  it("canon · row missing client_id · pre-lookup 404 · client_id stays null · lookup=failed", async () => {
    const stub = makeStub({
      row: baseRow({
        client_id: null,
        context: {
          execution_id: "exec-abc",
          hitl_token: "tok-xyz",
          client_name: "Unknown",
        },
      }),
    })
    const fetchImpl = vi.fn(
      async () => new Response("not found", { status: 404 }),
    ) as unknown as typeof fetch
    const r = await resolveHitlApproval(
      { hitl_id: "hitl-123", decision: "approve", reviewer_id: "emilio" },
      {
        supabase: stub.supabase,
        fetchImpl,
        wireEnabled: false,
        platformBaseUrl: "https://platform.example.com",
      },
    )
    expect(r.client_lookup).toBe("failed")
    expect(r.client_id).toBeNull()
    expect(r.mode).toBe("shadow")
  })

  it("canon · row missing client_id · NO client_name in context · skipped", async () => {
    const stub = makeStub({
      row: baseRow({
        client_id: null,
        context: { execution_id: "exec-abc", hitl_token: "tok-xyz" },
      }),
    })
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const r = await resolveHitlApproval(
      { hitl_id: "hitl-123", decision: "approve", reviewer_id: "emilio" },
      {
        supabase: stub.supabase,
        fetchImpl,
        wireEnabled: false,
        platformBaseUrl: "https://platform.example.com",
      },
    )
    expect(r.client_lookup).toBe("skipped")
    expect(r.client_id).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
