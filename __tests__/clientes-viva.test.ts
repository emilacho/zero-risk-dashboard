/**
 * CLIENTES · prueba CONTRA LA BASE VIVA (solo lectura, US$ 0). Corre únicamente con `ZR_PRUEBA_VIVA=1`:
 *   doppler run -p zero-risk -c prd -- env ZR_PRUEBA_VIVA=1 npx vitest run __tests__/clientes-viva.test.ts
 * Cada número se coteja con una cuenta INDEPENDIENTE hecha directo contra la base.
 */
import { describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { cargarFicha, listarClientes } from "@/lib/clientes-datos"

const VIVA = process.env.ZR_PRUEBA_VIVA === "1" && !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL

describe.skipIf(!VIVA)("clientes contra la base viva (solo lectura)", () => {
  const supa = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  it("la lista trae los clientes no archivados y las piezas por aprobar suman las de la bandeja", async () => {
    const s = supa()
    const lista = await listarClientes(s)
    const { count } = await s.from("clients").select("*", { count: "exact", head: true }).is("archived_at", null)
    expect(lista).toHaveLength(count ?? -1)
    const pend = (await s.from("hitl_queue").select("client_id").eq("status", "pending").eq("type", "content_piece_review").limit(1000)).data!
    const conCliente = pend.filter((p) => lista.some((c) => c.id === p.client_id)).length
    expect(lista.reduce((a, c) => a + c.piezas_por_aprobar, 0)).toBe(conCliente)
  })

  it("la ficha del cliente piloto: cerebro, piezas y gasto coinciden con cuentas aparte", async () => {
    const s = supa()
    const id = "df7e47cc-bec4-4fa2-bc24-ff97ba5213a5"
    const f = await cargarFicha(s, id)
    expect(f).not.toBeNull()
    const { count: trozos } = await s.from("client_brain_chunks").select("*", { count: "exact", head: true }).eq("client_id", id)
    expect(f!.cerebro.trozos).toBe(trozos ?? -1)
    const { count: fichas } = await s.from("cerebro_fichas").select("*", { count: "exact", head: true }).eq("client_id", id).is("retirada_en", null)
    expect(f!.cerebro.fichas_vigentes).toBe(fichas ?? -1)
    const piezas = (await s.from("hitl_queue").select("id").eq("client_id", id).eq("type", "content_piece_review").limit(1000)).data!
    expect(f!.piezas.length).toBe(Math.min(piezas.length, 20))
    const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const inv = (await s.from("agent_invocations").select("cost_usd").eq("client_id", id).gte("created_at", hace30).limit(10000)).data!
    expect(f!.gasto.llamadas_30d).toBe(inv.length)
    expect(f!.gasto.agentes_30d).toBeCloseTo(inv.reduce((a, r) => a + Number(r.cost_usd ?? 0), 0), 4)
  })

  it("un id que no existe da null", async () => {
    expect(await cargarFicha(supa(), "00000000-0000-4000-8000-000000000000")).toBeNull()
  })
})
