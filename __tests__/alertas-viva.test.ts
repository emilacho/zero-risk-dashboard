/**
 * LAS ALERTAS · prueba CONTRA LA BASE VIVA (solo lectura, US$ 0). Solo con `ZR_PRUEBA_VIVA=1` y las llaves de Doppler:
 *   doppler run -p zero-risk -c prd -- env ZR_PRUEBA_VIVA=1 npx vitest run __tests__/alertas-viva.test.ts
 * No escribe: la marca «ya lo vi» se probó aparte, a mano, con una clave de prueba que se borró después.
 */
import { describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { leerAlertas } from "@/lib/alertas-datos"

const VIVA = process.env.ZR_PRUEBA_VIVA === "1" && !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL

describe.skipIf(!VIVA)("las alertas contra la base viva (solo lectura)", () => {
  const supa = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  it("la tabla alertas_vistas existe y se puede leer; los problemas reales de la oficina de los últimos 14 días coinciden con una cuenta aparte", async () => {
    const s = supa()
    const ahora = new Date()
    const r = await leerAlertas(s, ahora)
    const desde = new Date(ahora.getTime() - 14 * 86_400_000).toISOString()
    const { data, error } = await s.from("oficina_encargos").select("id, estado, con_desacuerdo, dry_run, prueba").gte("creado_en", desde)
    expect(error).toBeNull()
    const esperadas = (data ?? []).filter((e) => !e.dry_run && !e.prueba && (e.estado === "fallido" || e.estado === "cerrado_por_tope" || e.con_desacuerdo === true)).length
    const deOficina = [...r.nuevas, ...r.vistas].filter((a) => a.fuente === "oficina").length
    expect(deOficina).toBe(esperadas)
    expect(r.nuevas.length + r.vistas.length).toBeGreaterThanOrEqual(deOficina)
  })
})
