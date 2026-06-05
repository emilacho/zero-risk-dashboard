/**
 * Tests · `app/api/hitl/resolve/route.ts` POST + GET.
 *
 * Strategy · canon canon-canon-import the route handler · feed a constructed
 * `Request` · canon-canon-mock the supabase service-role client via env
 * lookup + a custom getServiceRoleClient stub. Since the route uses
 * `getServiceRoleClient()` lazily, we mock it via vi.mock at module level.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// canon · canon-canonical-shared mutable state for the mocked supabase client
type RowShape = {
  id: string
  status: string
  client_id: string | null
  context: Record<string, unknown> | null
  payload: Record<string, unknown> | null
} | null

let mockRow: RowShape = null
let updateCount = 0

function buildFluent() {
  const fluent: Record<string, unknown> = {}
  fluent.select = () => fluent
  fluent.eq = () => fluent
  fluent.maybeSingle = () => Promise.resolve({ data: mockRow, error: null })
  fluent.update = () => ({
    eq: () => ({
      eq: () => {
        updateCount++
        return Promise.resolve({ error: null })
      },
    }),
  })
  return fluent
}

vi.mock("@/lib/supabase-server", () => ({
  getServiceRoleClient: () => ({
    from: () => buildFluent(),
  }),
}))

// canon · canon-canon-import route AFTER mock setup
import { POST, GET } from "@/app/api/hitl/resolve/route"

const NAUFRAGO_UUID = "d69100b5-8ad7-4bb0-908c-68b5544065dc"

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/hitl/resolve", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockRow = {
    id: "hitl-1",
    status: "pending",
    client_id: NAUFRAGO_UUID,
    context: { execution_id: "exec-1", hitl_token: "tok-1" },
    payload: { proposal: "x" },
  }
  updateCount = 0
  delete process.env.MC_HITL_RESOLVE_WIRE_ENABLED
  delete process.env.INTERNAL_API_KEY
  delete process.env.N8N_BASE_URL
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("POST /api/hitl/resolve · validation", () => {
  it("canon · invalid decision · 400", async () => {
    const res = await POST(makeRequest({ hitl_id: "h", decision: "weird" }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.ok).toBe(false)
    expect(body.refused_reason).toMatch(/decision must be approve\|reject/)
  })

  it("canon · missing decision · 400", async () => {
    const res = await POST(makeRequest({ hitl_id: "h" }))
    expect(res.status).toBe(400)
  })

  it("canon · missing hitl_id · routes through lib, returns refused", async () => {
    const res = await POST(makeRequest({ decision: "approve" }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.refused_reason).toMatch(/hitl_id required/)
  })
})

describe("POST /api/hitl/resolve · happy path (shadow default)", () => {
  it("canon · shadow mode · 200 ok · mode=shadow · no DB update", async () => {
    const res = await POST(
      makeRequest({
        hitl_id: "hitl-1",
        decision: "approve",
        reviewer_id: "emilio",
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.mode).toBe("shadow")
    expect(body.client_id).toBe(NAUFRAGO_UUID)
    expect(body.execution_id).toBe("exec-1")
    expect(updateCount).toBe(0)
  })

  it("canon · row already resolved · 400 refused", async () => {
    mockRow = { ...mockRow!, status: "approved" }
    const res = await POST(
      makeRequest({
        hitl_id: "hitl-1",
        decision: "approve",
        reviewer_id: "emilio",
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.refused_reason).toMatch(/hitl_already_resolved/)
  })

  it("canon · row not found · 400 refused", async () => {
    mockRow = null
    const res = await POST(
      makeRequest({
        hitl_id: "hitl-missing",
        decision: "approve",
        reviewer_id: "emilio",
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.refused_reason).toBe("hitl_id_not_found")
  })
})

describe("POST /api/hitl/resolve · INTERNAL_API_KEY guard", () => {
  it("canon · key set + header missing · 401", async () => {
    process.env.INTERNAL_API_KEY = "secret-key-x"
    const res = await POST(
      makeRequest({
        hitl_id: "hitl-1",
        decision: "approve",
        reviewer_id: "emilio",
      }),
    )
    expect(res.status).toBe(401)
  })

  it("canon · key set + header correct · 200", async () => {
    process.env.INTERNAL_API_KEY = "secret-key-x"
    const res = await POST(
      makeRequest(
        { hitl_id: "hitl-1", decision: "approve", reviewer_id: "emilio" },
        { "x-internal-key": "secret-key-x" },
      ),
    )
    expect(res.status).toBe(200)
  })

  it("canon · key unset · auth open · 200", async () => {
    const res = await POST(
      makeRequest({
        hitl_id: "hitl-1",
        decision: "approve",
        reviewer_id: "emilio",
      }),
    )
    expect(res.status).toBe(200)
  })
})

describe("GET /api/hitl/resolve · health probe", () => {
  it("canon · returns flag echo · canon-canon-no DB hit", async () => {
    const res = GET()
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.canon).toBe("mc-hitl-resolve")
    expect(body.flags).toBeDefined()
    expect(body.flags.MC_HITL_RESOLVE_WIRE_ENABLED).toBe("unset")
  })
})
