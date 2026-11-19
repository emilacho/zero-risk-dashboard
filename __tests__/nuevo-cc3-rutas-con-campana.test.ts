/**
 * 19-nov · varias campañas, parte A · los 🟡 e11 y e12 de CC7 (#358): cada ruta que acepta `?campana=` lo valida y SE LO PASA a su lectura.
 * Antes de que la pantalla conecte la elección (CC5), lo prueba la ruta misma.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const llamadas: Array<{ lector: string; o: Record<string, unknown> }> = []
vi.mock("@/lib/admin-guard", () => ({ exigirAdmin: async () => ({ ok: true }) }))
vi.mock("@/lib/supabase-server", () => ({ getServiceRoleClient: () => ({}) }))
vi.mock("@/lib/centro-datos", () => ({ leerCentro: async (_s: unknown, o: Record<string, unknown>) => { llamadas.push({ lector: "centro", o }); return {} } }))
vi.mock("@/lib/pizarron-datos", () => ({ leerPizarron: async (_s: unknown, o: Record<string, unknown>) => { llamadas.push({ lector: "pizarron", o }); return {} } }))
vi.mock("@/lib/brief-datos", () => ({ leerBrief: async (_s: unknown, o: Record<string, unknown>) => { llamadas.push({ lector: "brief", o }); return {} } }))
vi.mock("@/lib/gran-idea-datos", () => ({ leerGranIdea: async (_s: unknown, o: Record<string, unknown>) => { llamadas.push({ lector: "gran-idea", o }); return {} } }))

const CLI = "00000000-0000-4000-8000-0000000000c1"
const CAMP = "00000000-0000-4000-8000-000000000001"
const RUTAS = [
  { lector: "centro", ruta: "@/app/api/centro/route", url: "/api/centro" },
  { lector: "pizarron", ruta: "@/app/api/pizarron/route", url: "/api/pizarron" },
  { lector: "brief", ruta: "@/app/api/brief/route", url: "/api/brief" },
  { lector: "gran-idea", ruta: "@/app/api/gran-idea/route", url: "/api/gran-idea" },
] as const

beforeEach(() => { llamadas.length = 0 })

describe("las rutas con ?campana=", () => {
  for (const r of RUTAS) {
    it(`🔴 ${r.url} · ?campana= llega a su lectura`, async () => {
      const { GET } = await import(r.ruta)
      const res = await GET(new Request(`http://x${r.url}?cliente=${CLI}&campana=${CAMP}`))
      expect(res.status).toBe(200)
      expect(llamadas).toHaveLength(1)
      expect(llamadas[0]).toMatchObject({ lector: r.lector, o: { cliente: CLI, campana: CAMP } })
    })
    it(`🔴 ${r.url} · un ?campana= sin forma de campaña da 400 y no se lee nada`, async () => {
      const { GET } = await import(r.ruta)
      const res = await GET(new Request(`http://x${r.url}?cliente=${CLI}&campana=no-es-una-campana`))
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ ok: false, error: "campana_invalida" })
      expect(llamadas).toEqual([])
    })
    it(`${r.url} · sin ?campana= se lee igual (la regla elige la campaña)`, async () => {
      const { GET } = await import(r.ruta)
      const res = await GET(new Request(`http://x${r.url}?cliente=${CLI}`))
      expect(res.status).toBe(200)
      expect(llamadas[0].o.campana ?? null).toBeNull()
    })
  }
})
