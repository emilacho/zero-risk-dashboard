/**
 * EL GASTO · prueba CONTRA LA BASE VIVA (solo lectura, US$ 0). Solo con `ZR_PRUEBA_VIVA=1` y las llaves de Doppler:
 *   doppler run -p zero-risk -c prd -- env ZR_PRUEBA_VIVA=1 npx vitest run __tests__/gasto-viva.test.ts
 * La cifra de la pantalla se compara con una suma hecha aparte, fila por fila, sin pasar por la lógica de la pantalla.
 */
import { describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { leerGasto, paginar } from "@/lib/gasto-datos"
import { diaEnEcuador, ultimosDias } from "@/lib/gasto"

const VIVA = process.env.ZR_PRUEBA_VIVA === "1" && !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL

describe.skipIf(!VIVA)("el gasto contra la base viva (solo lectura)", () => {
  const supa = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  it("los 30 días de la pantalla = suma aparte de agent_invocations + llamadas de Apify", async () => {
    const s = supa()
    const ahora = new Date()
    const dias = new Set(ultimosDias(30, ahora))
    const { resumen, cortado } = await leerGasto(s, ahora)
    expect(cortado).toBe(false)

    const inv = await paginar((a, b) => s.from("agent_invocations").select("created_at, cost_usd").order("created_at", { ascending: true }).range(a, b), "agent_invocations")
    const agentes = inv.filas.filter((f) => dias.has(diaEnEcuador(String(f.created_at)))).reduce((t, f) => t + Number(f.cost_usd ?? 0), 0)

    const cos = await paginar((a, b) => s.from("costs").select("date, amount_usd, amount_usd_exact, description").order("created_at", { ascending: true }).range(a, b), "costs")
    const dePrueba = (d: unknown) => { try { const j = typeof d === "string" ? JSON.parse(d) : d; return (j as { tipo?: string })?.tipo === "llamada" } catch { return false } }
    const llamadas = cos.filas.filter((f) => dePrueba(f.description) && dias.has(String(f.date).slice(0, 10))).reduce((t, f) => t + Number(f.amount_usd_exact ?? f.amount_usd ?? 0), 0)

    expect(resumen.ultimos.agentes).toBeCloseTo(agentes, 4)
    // las llamadas son la regla de los vigías; los días sin llamadas aportan su fila del día, así que Apify nunca es menos que las llamadas
    expect(resumen.ultimos.apify).toBeGreaterThanOrEqual(llamadas - 1e-6)
    expect(resumen.ultimos.total).toBeCloseTo(resumen.ultimos.agentes + resumen.ultimos.apify, 4)
  })

  it("el reparto por cliente y por proveedor suma lo mismo que el total", async () => {
    const { resumen: r } = await leerGasto(supa())
    expect(r.por_cliente.reduce((t, c) => t + c.total, 0)).toBeCloseTo(r.ultimos.total, 3)
    expect(r.por_proveedor.reduce((t, c) => t + c.total, 0)).toBeCloseTo(r.ultimos.total, 3)
    expect(r.ultimos.dias).toHaveLength(30)
  })
})
