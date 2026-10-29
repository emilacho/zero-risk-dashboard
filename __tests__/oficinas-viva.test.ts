/**
 * LAS OFICINAS · prueba CONTRA LA BASE VIVA (solo lectura, US$ 0). Corre únicamente con `ZR_PRUEBA_VIVA=1`:
 *   doppler run -p zero-risk -c prd -- env ZR_PRUEBA_VIVA=1 npx vitest run __tests__/oficinas-viva.test.ts
 * Cada número de una tarjeta se coteja con una cuenta INDEPENDIENTE hecha directo contra la base (otra consulta, otro código), para que una tarjeta no pueda decir algo que la base no dice.
 */
import { describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { leerOficinas } from "@/lib/oficinas-datos"
import { desde } from "@/lib/oficinas"

const VIVA = process.env.ZR_PRUEBA_VIVA === "1" && !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL

describe.skipIf(!VIVA)("las oficinas contra la base viva (solo lectura)", () => {
  const supa = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const dato = (t: { datos: Array<{ etiqueta: string; valor: string }> }, e: string) => t.datos.find((d) => d.etiqueta === e)?.valor

  it("las cinco se leen SIN error y en su orden", async () => {
    const t = await leerOficinas(supa())
    expect(t.map((x) => x.clave)).toEqual(["creativa", "financiera", "jefatura", "cerebro", "planeacion"])
    expect(t.filter((x) => x.error).map((x) => `${x.clave}: ${x.error}`)).toEqual([])
  })

  it("creativa: su interruptor, sus familias y sus piezas coinciden con la base (cuenta aparte)", async () => {
    const s = supa()
    const c = (await leerOficinas(s)).find((x) => x.clave === "creativa")!
    const cfg = (await s.from("oficina_config").select("estado, familias_activas").eq("id", 1).single()).data!
    expect(c.estado_texto.toLowerCase()).toContain(String(cfg.estado))
    for (const f of cfg.familias_activas as string[]) expect(c.detalle.join("|")).toContain(f)
    const enc = (await s.from("oficina_encargos").select("estado, dry_run, gasto_usd").gte("creado_en", desde(7)).limit(1000)).data!.filter((e) => e.dry_run !== true)
    expect(dato(c, "Fallidas (7 días)")).toBe(String(enc.filter((e) => e.estado === "fallido").length))
    expect(dato(c, "Piezas entregadas (7 días)")).toBe(String(enc.filter((e) => String(e.estado).startsWith("cerrado")).length))
    const pend = (await s.from("hitl_queue").select("id").eq("status", "pending").eq("type", "content_piece_review").limit(500)).data!.length
    expect(c.espera.join()).toBe(pend > 0 ? `${pend} pieza${pend === 1 ? "" : "s"} por aprobar` : "")
    expect(pend).toBeGreaterThanOrEqual(2) // las dos del 28-oct esperan a Emilio
  })

  it("jefatura y planeación: interruptor y cuentas coinciden", async () => {
    const s = supa()
    const t = await leerOficinas(s)
    const j = t.find((x) => x.clave === "jefatura")!
    const cfg = (await s.from("jefatura_config").select("estado").eq("id", 1).single()).data!
    expect(j.estado_texto.toLowerCase()).toContain(String(cfg.estado))
    const rev = (await s.from("jefatura_revisiones").select("dry_run").gte("creado_en", desde(7)).limit(1000)).data!.filter((r) => r.dry_run !== true)
    expect(dato(j, "Revisiones (7 días)")).toBe(String(rev.length))
    const p = t.find((x) => x.clave === "planeacion")!
    const est = (await s.from("cadena_config").select("valor").eq("clave", "estado_cadena").single()).data!.valor
    expect(p.estado_texto.toLowerCase()).toContain(String(est))
  })

  it("cerebro: los trozos que dice la tarjeta son los de la tabla", async () => {
    const s = supa()
    const c = (await leerOficinas(s)).find((x) => x.clave === "cerebro")!
    const { count } = await s.from("client_brain_chunks").select("*", { count: "exact", head: true })
    expect(dato(c, "Trozos de conocimiento")).toBe(String(count))
    expect(Number(count)).toBeGreaterThan(0)
  })

  it("financiera: interruptor y preguntas sin responder coinciden", async () => {
    const s = supa()
    const f = (await leerOficinas(s)).find((x) => x.clave === "financiera")!
    const cfg = (await s.from("finanzas_config").select("estado").eq("id", 1).single()).data!
    expect(f.estado_texto.toLowerCase()).toContain(String(cfg.estado))
    const { count } = await s.from("finanzas_preguntas").select("*", { count: "exact", head: true }).is("respondida_en", null)
    expect(f.espera.length).toBe((count ?? 0) > 0 ? 1 : 0)
  })
})
