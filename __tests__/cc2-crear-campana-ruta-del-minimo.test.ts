/**
 * «CREAR CAMPAÑA» · LA RUTA DEL MÍNIMO DEL TABLERO (20-nov · 🟡 c23 de CC5 a #364) · sin red ni base (US$ 0).
 * `GET /api/crear-campana/minimo` llama a la plataforma con la llave interna: solo un administrador con sesión.
 * Sin sesión → 401, sin permiso → 403, y en ninguno de los dos se llama a la plataforma.
 */
import { afterEach, describe, expect, it, vi } from "vitest"

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"

async function ruta(puerta: { ok: true; email: string | null } | { ok: false; status: 401 | 403 }) {
  vi.resetModules()
  vi.doMock("@/lib/admin-guard", () => ({ exigirAdmin: async () => puerta }))
  const plataforma = vi.fn(async () => new Response(JSON.stringify({ ok: true, minimo_usd: 61 }), { status: 200 }))
  vi.stubGlobal("fetch", plataforma)
  const { GET } = await import("@/app/api/crear-campana/minimo/route")
  const pedir = () => GET(new Request(`https://t.test/api/crear-campana/minimo?cliente=${NAUFRAGO}`))
  return { pedir, plataforma }
}

describe("la ruta del mínimo: solo administrador con sesión", () => {
  const antes = process.env.PLATFORM_INTERNAL_KEY
  afterEach(() => { vi.unstubAllGlobals(); vi.doUnmock("@/lib/admin-guard"); vi.resetModules(); if (antes === undefined) delete process.env.PLATFORM_INTERNAL_KEY; else process.env.PLATFORM_INTERNAL_KEY = antes })

  it("sin sesión → 401, sin permiso → 403, y en ninguno se llama a la plataforma", async () => {
    process.env.PLATFORM_INTERNAL_KEY = "k"
    for (const st of [401, 403] as const) {
      const { pedir, plataforma } = await ruta({ ok: false, status: st })
      const r = await pedir()
      expect(r.status).toBe(st)
      expect(await r.json()).toEqual({ ok: false, error: st === 401 ? "sin_sesion" : "sin_permiso" })
      expect(plataforma).not.toHaveBeenCalled()
    }
  })
  it("con sesión de administrador lee el mínimo de la plataforma, con la llave interna y sin caché", async () => {
    process.env.PLATFORM_INTERNAL_KEY = "k"
    const { pedir, plataforma } = await ruta({ ok: true, email: "emilio@x.com" })
    const r = await pedir()
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true, minimo_usd: 61 })
    expect(r.headers.get("cache-control")).toBe("no-store")
    expect(plataforma).toHaveBeenCalledTimes(1)
    const [url, init] = plataforma.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain(`/api/tablero-minimo-de-campana?client_id=${NAUFRAGO}`)
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("k")
  })
})
