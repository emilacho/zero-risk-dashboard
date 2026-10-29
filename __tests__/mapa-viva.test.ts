/**
 * MAPA · prueba CONTRA LA BASE VIVA (solo lectura, US$ 0). Corre únicamente con `ZR_PRUEBA_VIVA=1`:
 *   doppler run -p zero-risk -c prd -- env ZR_PRUEBA_VIVA=1 npx vitest run __tests__/mapa-viva.test.ts
 */
import { describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { leerMapa } from "@/lib/mapa-datos"

const VIVA = process.env.ZR_PRUEBA_VIVA === "1" && !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL

describe.skipIf(!VIVA)("el mapa contra la base viva (solo lectura)", () => {
  const supa = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  it("las cinco estaciones se leen y sus cuentas coinciden con cuentas aparte", async () => {
    const s = supa()
    const m = await leerMapa(s)
    expect(m.pasos.map((p) => p.clave)).toEqual(["brief", "oficina", "mesa", "jefatura", "bandeja"])
    const hace7 = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const rev = (await s.from("jefatura_revisiones").select("dry_run").gte("creado_en", hace7).limit(1000)).data!.filter((r) => r.dry_run !== true)
    expect(m.pasos.find((p) => p.clave === "jefatura")!.cuantos).toBe(rev.length)
    const band = (await s.from("hitl_queue").select("id").eq("type", "content_piece_review").gte("created_at", hace7).limit(1000)).data!
    expect(m.pasos.find((p) => p.clave === "bandeja")!.cuantos).toBe(band.length)
    const enc = (await s.from("oficina_encargos").select("brief_id, dry_run").gte("creado_en", hace7).limit(500)).data!.filter((e) => e.dry_run !== true)
    expect(m.pasos.find((p) => p.clave === "brief")!.cuantos).toBe(new Set(enc.map((e) => e.brief_id)).size)
  })

  it("cada pieza del mapa existe en la base con el mismo estado", async () => {
    const s = supa()
    const m = await leerMapa(s)
    for (const p of m.piezas) {
      const { data } = await s.from("oficina_encargos").select("estado, hitl_queue_id, dry_run").eq("id", p.id).single()
      expect(data!.dry_run).not.toBe(true)
      expect(p.estado).toBe(String(data!.estado).replace(/_/g, " "))
      expect(p.donde === "bandeja").toBe(!!data!.hitl_queue_id)
    }
  })
})
