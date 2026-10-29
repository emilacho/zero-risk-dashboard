/**
 * COHERENCIA ENTRE PANTALLAS · prueba CONTRA LA BASE VIVA (solo lectura, US$ 0). Corre únicamente con `ZR_PRUEBA_VIVA=1`:
 *   doppler run -p zero-risk -c prd -- env ZR_PRUEBA_VIVA=1 npx vitest run __tests__/coherencia-viva.test.ts
 * Una cifra, un dueño: lo que dice Inicio es lo que dice Piezas, y el gasto de un cliente es el de la pantalla Gasto.
 */
import { describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { leerInicio } from "@/lib/inicio-datos"
import { contarPiezasPorAprobar, listarPiezas } from "@/lib/piezas-datos"
import { leerGasto } from "@/lib/gasto-datos"
import { listarClientes, cargarFicha } from "@/lib/clientes-datos"

const VIVA = process.env.ZR_PRUEBA_VIVA === "1" && !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL

describe.skipIf(!VIVA)("las pantallas dicen lo mismo (solo lectura)", () => {
  const supa = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  it("las piezas por aprobar: Inicio = contador de Piezas = filas de la lista", async () => {
    const s = supa()
    const [n, lista, inicio] = await Promise.all([contarPiezasPorAprobar(s), listarPiezas(s, { estado: "pendiente", tipo: "piezas" }), leerInicio(s)])
    expect(lista.length).toBe(n)
    expect(inicio.te_necesitan.ok && (inicio.te_necesitan.valor.find((x) => x.clave === "piezas")?.cuantos ?? 0)).toBe(n)
  })

  it("el gasto de cada cliente en Clientes es el de la pantalla Gasto, y la ficha coincide con la lista", async () => {
    const s = supa()
    const g = (await leerGasto(s, new Date())).resumen.por_cliente
    const lista = await listarClientes(s)
    for (const c of lista) expect(c.gasto_30d).toBe(g.find((x) => x.clave === c.id)?.total ?? 0)
    const con = lista.find((c) => c.gasto_30d > 0)
    if (con) expect((await cargarFicha(s, con.id))!.gasto.total_30d).toBe(con.gasto_30d)
  })

  it("los clientes en servicio de Inicio cuentan activos y en alta", async () => {
    const s = supa()
    const inicio = await leerInicio(s)
    const { count } = await s.from("clients").select("*", { count: "exact", head: true }).in("status", ["active", "onboarding"]).is("archived_at", null)
    expect(inicio.cifras.ok && inicio.cifras.valor.clientes_activos).toBe(count)
  })
})
