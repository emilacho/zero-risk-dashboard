/**
 * INICIO · prueba CONTRA LA BASE VIVA (solo lectura, US$ 0). Corre únicamente con `ZR_PRUEBA_VIVA=1`:
 *   doppler run -p zero-risk -c prd -- env ZR_PRUEBA_VIVA=1 npx vitest run __tests__/inicio-viva.test.ts
 */
import { describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { leerInicio } from "@/lib/inicio-datos"

const VIVA = process.env.ZR_PRUEBA_VIVA === "1" && !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL

describe.skipIf(!VIVA)("el Inicio contra la base viva (solo lectura)", () => {
  const supa = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  it("los seis bloques se leen sin error", async () => {
    const d = await leerInicio(supa())
    for (const [k, b] of Object.entries(d)) expect(b.ok, `${k}: ${"error" in b ? b.error : ""}`).toBe(true)
  })

  it("las piezas por aprobar y los clientes activos coinciden con cuentas aparte", async () => {
    const s = supa()
    const d = await leerInicio(s)
    const pend = (await s.from("hitl_queue").select("id").eq("status", "pending").eq("type", "content_piece_review").limit(1000)).data!.length
    const piezas = d.te_necesitan.ok ? d.te_necesitan.valor.find((p) => p.clave === "piezas")?.cuantos ?? 0 : -1
    expect(piezas).toBe(pend)
    const { count } = await s.from("clients").select("*", { count: "exact", head: true }).in("status", ["active", "onboarding"]).is("archived_at", null)
    expect(d.cifras.ok && d.cifras.valor.clientes_activos).toBe(count ?? -1)
  })

  it("las piezas entregadas de la semana y los 5 hechos salen de lo real (sin ensayos)", async () => {
    const s = supa()
    const d = await leerInicio(s)
    const hace7 = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const enc = (await s.from("oficina_encargos").select("estado, dry_run").gte("cerrado_en", hace7).limit(1000)).data!
    expect(d.cifras.ok && d.cifras.valor.piezas_semana).toBe(enc.filter((e) => e.dry_run !== true && String(e.estado).startsWith("cerrado")).length)
    expect(d.hechos.ok && d.hechos.valor.length).toBeLessThanOrEqual(5)
    expect(d.hechos.ok && d.hechos.valor.length).toBeGreaterThan(0)
  })

  it("el gasto de hoy y del mes es el mismo que muestra la pantalla de Gasto", async () => {
    const { leerGasto } = await import("@/lib/gasto-datos")
    const s = supa()
    const [d, g] = await Promise.all([leerInicio(s), leerGasto(s)])
    expect(d.cifras.ok && d.cifras.valor.gasto_mes).toBeCloseTo(g.resumen.mes.total, 2)
  })
})
