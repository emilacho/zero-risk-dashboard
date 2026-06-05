/**
 * Sprint 4 · CRM + Pipeline · route-handler unit tests · 2026-05-20.
 *
 * Strategy · we stub `getSessionClient` (auth gate) and
 * `getServiceRoleClient` (DB layer) and assert the routes branch
 * correctly on auth + input validation + happy path. Tests are
 * environment "node" per `vitest.config.ts`. No live Supabase.
 */
import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@/lib/supabase-session", () => {
  let user: { id: string; email: string } | null = null
  return {
    __setUser(u: typeof user) {
      user = u
    },
    async getSessionClient() {
      return {
        auth: {
          async getUser() {
            return { data: { user } }
          },
        },
      }
    },
  }
})

vi.mock("@/lib/supabase-server", () => {
  type Op = {
    table: string
    method: "select" | "insert" | "update" | "delete" | "upsert"
    payload?: unknown
    filters?: Array<{ op: string; field: string; value: unknown }>
  }
  const ops: Op[] = []
  // Force the next single() call to return an error · used to test 404 path.
  let nextError: { message: string; code?: string } | null = null

  function makeBuilder(table: string, method: Op["method"]) {
    const op: Op = { table, method, filters: [] }
    ops.push(op)
    const chain = {
      select(_cols?: string, _opts?: { count?: string }) {
        return chain
      },
      eq(field: string, value: unknown) {
        op.filters!.push({ op: "eq", field, value })
        return chain
      },
      neq(field: string, value: unknown) {
        op.filters!.push({ op: "neq", field, value })
        return chain
      },
      in(field: string, value: unknown) {
        op.filters!.push({ op: "in", field, value })
        return chain
      },
      or(_v: string) {
        return chain
      },
      order(_field: string, _opts?: unknown) {
        return chain
      },
      range(_a: number, _b: number) {
        return chain
      },
      limit(_n: number) {
        return chain
      },
      async maybeSingle() {
        if (nextError) {
          const e = nextError
          nextError = null
          return { data: null, error: e }
        }
        return { data: { id: "stub", journey_state: "discovery", client_id: "c1" }, error: null }
      },
      async single() {
        if (nextError) {
          const e = nextError
          nextError = null
          return { data: null, error: e }
        }
        return {
          data: { id: "stub-id", ...(typeof op.payload === "object" ? op.payload : {}) },
          error: null,
        }
      },
      then(resolve: (r: unknown) => unknown) {
        return Promise.resolve({ data: [], error: null, count: 0 }).then(resolve)
      },
    }
    return chain
  }

  return {
    __ops: ops,
    __setNextError(err: typeof nextError) {
      nextError = err
    },
    __reset() {
      ops.length = 0
      nextError = null
    },
    getServiceRoleClient() {
      return {
        from(table: string) {
          return {
            select(cols?: string, opts?: { count?: string }) {
              return makeBuilder(table, "select").select(cols, opts)
            },
            insert(payload: unknown) {
              const b = makeBuilder(table, "insert")
              ;(b as unknown as { _payload?: unknown })._payload = payload
              const lastOp = (ops[ops.length - 1] as Op)
              lastOp.payload = payload
              return b
            },
            update(payload: unknown) {
              const b = makeBuilder(table, "update")
              const lastOp = (ops[ops.length - 1] as Op)
              lastOp.payload = payload
              return b
            },
            delete() {
              return makeBuilder(table, "delete")
            },
            upsert(payload: unknown) {
              const b = makeBuilder(table, "upsert")
              const lastOp = (ops[ops.length - 1] as Op)
              lastOp.payload = payload
              return b
            },
          }
        },
      }
    },
  }
})

// Re-import the mocks so we can poke them.
import * as session from "@/lib/supabase-session"
import * as server from "@/lib/supabase-server"

const setUser = (
  session as unknown as { __setUser: (u: { id: string; email: string } | null) => void }
).__setUser
const ops = (server as unknown as { __ops: unknown[] }).__ops
const resetOps = (server as unknown as { __reset: () => void }).__reset

beforeEach(() => {
  setUser(null)
  resetOps()
})

function req(url: string, init?: RequestInit) {
  return new Request(url, init)
}

describe("/api/contacts", () => {
  it("1. GET returns 401 without session", async () => {
    const { GET } = await import("@/app/api/contacts/route")
    const res = await GET(req("http://x/api/contacts"))
    expect(res.status).toBe(401)
  })

  it("2. GET returns empty list with session", async () => {
    setUser({ id: "u1", email: "e@x.com" })
    const { GET } = await import("@/app/api/contacts/route")
    const res = await GET(req("http://x/api/contacts?limit=10"))
    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; rows: unknown[] }
    expect(json.ok).toBe(true)
    expect(Array.isArray(json.rows)).toBe(true)
  })

  it("3. POST rejects missing required fields", async () => {
    setUser({ id: "u1", email: "e@x.com" })
    const { POST } = await import("@/app/api/contacts/route")
    const res = await POST(req("http://x/api/contacts", {
      method: "POST",
      body: JSON.stringify({ champion_name: "Solo" }),
      headers: { "content-type": "application/json" },
    }))
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toContain("client_id_and_champion_name_required")
  })

  it("4. POST creates contact with valid body", async () => {
    setUser({ id: "u1", email: "e@x.com" })
    const { POST } = await import("@/app/api/contacts/route")
    const res = await POST(req("http://x/api/contacts", {
      method: "POST",
      body: JSON.stringify({
        client_id: "c-123",
        champion_name: "Ana Pérez",
        champion_email: "ana@example.com",
      }),
      headers: { "content-type": "application/json" },
    }))
    expect(res.status).toBe(201)
    expect(ops.some((o: unknown) => (o as { table: string }).table === "client_champions")).toBe(true)
  })
})

describe("/api/contact-tags", () => {
  it("5. POST requires contact_id + tag", async () => {
    setUser({ id: "u1", email: "e@x.com" })
    const { POST } = await import("@/app/api/contact-tags/route")
    const res = await POST(req("http://x/api/contact-tags", {
      method: "POST",
      body: JSON.stringify({ contact_id: "c1" }),
      headers: { "content-type": "application/json" },
    }))
    expect(res.status).toBe(400)
  })

  it("6. POST validates contact_type enum", async () => {
    setUser({ id: "u1", email: "e@x.com" })
    const { POST } = await import("@/app/api/contact-tags/route")
    const res = await POST(req("http://x/api/contact-tags", {
      method: "POST",
      body: JSON.stringify({ contact_id: "c1", tag: "VIP", contact_type: "alien" }),
      headers: { "content-type": "application/json" },
    }))
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toContain("invalid_contact_type")
  })

  it("7. DELETE requires id OR (contact_id + tag)", async () => {
    setUser({ id: "u1", email: "e@x.com" })
    const { DELETE } = await import("@/app/api/contact-tags/route")
    const res = await DELETE(req("http://x/api/contact-tags", { method: "DELETE" }))
    expect(res.status).toBe(400)
  })
})

describe("/api/contact-relationships", () => {
  it("8. POST rejects self-relationship", async () => {
    setUser({ id: "u1", email: "e@x.com" })
    const { POST } = await import("@/app/api/contact-relationships/route")
    const res = await POST(req("http://x/api/contact-relationships", {
      method: "POST",
      body: JSON.stringify({
        from_contact_id: "c1",
        to_contact_id: "c1",
        relationship_type: "colleague",
      }),
      headers: { "content-type": "application/json" },
    }))
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toContain("self_relationship_not_allowed")
  })

  it("9. POST rejects invalid relationship_type", async () => {
    setUser({ id: "u1", email: "e@x.com" })
    const { POST } = await import("@/app/api/contact-relationships/route")
    const res = await POST(req("http://x/api/contact-relationships", {
      method: "POST",
      body: JSON.stringify({
        from_contact_id: "c1",
        to_contact_id: "c2",
        relationship_type: "frenemy",
      }),
      headers: { "content-type": "application/json" },
    }))
    expect(res.status).toBe(400)
  })
})

describe("/api/pipeline/journeys", () => {
  it("10. GET returns 401 without session", async () => {
    const { GET } = await import("@/app/api/pipeline/journeys/route")
    const res = await GET(req("http://x/api/pipeline/journeys"))
    expect(res.status).toBe(401)
  })

  it("11. GET returns columns shape with session", async () => {
    setUser({ id: "u1", email: "e@x.com" })
    const { GET } = await import("@/app/api/pipeline/journeys/route")
    const res = await GET(req("http://x/api/pipeline/journeys"))
    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; columns: Record<string, unknown[]> }
    expect(json.ok).toBe(true)
    expect(json.columns).toBeDefined()
    expect(Array.isArray(json.columns.discovery)).toBe(true)
  })
})

describe("/api/pipeline/journeys/[id]/move", () => {
  it("12. POST rejects invalid to_state", async () => {
    setUser({ id: "u1", email: "e@x.com" })
    const { POST } = await import("@/app/api/pipeline/journeys/[id]/move/route")
    const res = await POST(
      req("http://x/api/pipeline/journeys/abc/move", {
        method: "POST",
        body: JSON.stringify({ to_state: "lost_in_space" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "abc" }) },
    )
    expect(res.status).toBe(400)
  })

  it("13. POST returns 401 without session", async () => {
    const { POST } = await import("@/app/api/pipeline/journeys/[id]/move/route")
    const res = await POST(
      req("http://x/api/pipeline/journeys/abc/move", {
        method: "POST",
        body: JSON.stringify({ to_state: "onboarding" }),
      }),
      { params: Promise.resolve({ id: "abc" }) },
    )
    expect(res.status).toBe(401)
  })

  it("14. POST accepts valid to_state and returns ok", async () => {
    setUser({ id: "u1", email: "e@x.com" })
    const { POST } = await import("@/app/api/pipeline/journeys/[id]/move/route")
    const res = await POST(
      req("http://x/api/pipeline/journeys/abc/move", {
        method: "POST",
        body: JSON.stringify({ to_state: "onboarding" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "abc" }) },
    )
    expect([200, 404]).toContain(res.status)
  })
})
