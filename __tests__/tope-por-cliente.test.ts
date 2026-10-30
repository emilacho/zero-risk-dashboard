import { describe, expect, it } from "vitest"
import { gastado24h, moverTope, topeDeLaFicha, TOPE_MAXIMO_USD } from "@/lib/clientes"
import { ejecutarAccion } from "@/lib/tablero-acciones"

const ID = "a0000000-0000-4000-8000-0000000000e1"
const AHORA = new Date("2026-10-30T20:00:00Z")

describe("tope de 24 h del cliente", () => {
  it("lee el tope de la ficha solo si es un número mayor que cero", () => {
    expect(topeDeLaFicha({ spend_cap_usd: 25 })).toBe(25)
    expect(topeDeLaFicha({ spend_cap_usd: "12.5" })).toBe(12.5)
    for (const malo of [null, undefined, [], {}, { spend_cap_usd: 0 }, { spend_cap_usd: -3 }, { spend_cap_usd: "x" }]) expect(topeDeLaFicha(malo)).toBeNull()
  })

  it("suma lo gastado solo en las últimas 24 horas y sin ensayos", () => {
    const filas = [
      { created_at: "2026-10-30T19:00:00Z", cost_usd: 1.5 },
      { created_at: "2026-10-29T20:30:00Z", cost_usd: 2 },
      { created_at: "2026-10-29T19:59:00Z", cost_usd: 99 }, // fuera de la ventana
      { created_at: "2026-10-30T10:00:00Z", cost_usd: 7, dry_run: true },
      { created_at: "basura", cost_usd: 50 },
    ]
    expect(gastado24h(filas, AHORA)).toBe(3.5)
  })

  it("− y + mueven de a 5, sin bajar de 0,01 ni pasar del máximo", () => {
    expect(moverTope(8, 1)).toBe(13)
    expect(moverTope(13, -1)).toBe(8)
    expect(moverTope(3, -1)).toBe(0.01)
    expect(moverTope(TOPE_MAXIMO_USD - 2, 1)).toBe(TOPE_MAXIMO_USD)
  })

  it("el botón manda cliente-tope a la plataforma con el cliente y el valor, y ya no se edita desde «Editar datos»", async () => {
    const llamadas: Array<{ url: string; cuerpo: Record<string, unknown> }> = []
    const fetchImpl = (async (url: string, init: { body: string }) => { llamadas.push({ url, cuerpo: JSON.parse(init.body) }); return new Response("{}", { status: 200 }) }) as unknown as typeof fetch
    const d = { revisor: "emilio", plataformaUrl: "https://p.test", llave: "k", fetchImpl }
    const ok = await ejecutarAccion("cliente-tope", { client_id: ID, tope_usd: 25 }, d)
    expect(ok.status).toBe(200)
    expect(llamadas[0].url).toBe("https://p.test/api/tablero/cliente-tope")
    expect(llamadas[0].cuerpo).toMatchObject({ client_id: ID, tope_usd: 25, origen: "dashboard" })
    expect((await ejecutarAccion("cliente-tope", { client_id: ID, tope_usd: 0 }, d)).status).toBe(400)
    expect((await ejecutarAccion("cliente-editar", { client_id: ID, campos: { presupuesto: 40 } }, d)).status).toBe(400)
    expect(llamadas).toHaveLength(1)
  })

  it("si la plataforma todavía no tiene la acción, lo dice y no finge", async () => {
    const fetchImpl = (async () => new Response("", { status: 404 })) as unknown as typeof fetch
    const r = await ejecutarAccion("cliente-tope", { client_id: ID, tope_usd: 25 }, { revisor: "emilio", plataformaUrl: "https://p.test", llave: "k", fetchImpl })
    expect(r.status).toBe(501)
  })
})
