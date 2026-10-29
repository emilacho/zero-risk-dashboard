/**
 * LA VENTANA DE PIEZAS · prueba CONTRA LA BASE VIVA (solo lectura, US$ 0). Corre únicamente con `ZR_PRUEBA_VIVA=1` y las llaves de Doppler:
 *   doppler run -p zero-risk -c prd -- env ZR_PRUEBA_VIVA=1 npx vitest run __tests__/piezas-viva.test.ts
 * Las dos piezas reales del 28-oct (BRF-0001 v3 · 7 láminas, BRF-0002 v3 · 6 láminas) tienen que verse como las vio CC#3 en su galería.
 * No escribe nada: NO llama a decidir.
 */
import { describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { cargarPieza, direccionDeLaLaminaDeUnaPieza, listarPiezas } from "@/lib/piezas-datos"

const VIVA = process.env.ZR_PRUEBA_VIVA === "1" && !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL
const BRF0001 = "9ccb6924-d876-4c8a-8773-a69b0ecdab76"
const BRF0002 = "1604fafd-8b30-494f-a5c0-356f4175d6a3"

describe.skipIf(!VIVA)("la ventana de piezas contra la base viva (solo lectura)", () => {
  const supa = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  it("la lista trae las dos piezas del 28-oct como piezas pendientes, con el cliente por nombre", async () => {
    const l = await listarPiezas(supa(), { estado: "pendiente", limite: 100 })
    for (const id of [BRF0001, BRF0002]) {
      const f = l.find((x) => x.id === id)
      expect(f, id).toBeTruthy()
      expect(f).toMatchObject({ es_pieza: true, estado: "pendiente", incompleta: true, tiene_dibujo: true })
      expect(f!.cliente).toMatch(/Zero Risk/)
    }
    expect(l.some((x) => !x.es_pieza)).toBe(true) // los otros tipos de la bandeja (competidores, escalaciones) vienen marcados como solo lectura
  })

  it("BRF-0001 v3: 7 láminas con su texto, solo tipografía, aviso rojo del resumen falso y el emoji ✔ de la lámina 4", async () => {
    const d = (await cargarPieza(supa(), BRF0001))!
    expect(d.laminas).toHaveLength(7)
    expect(d.laminas.every((l) => l.origen === "tipografia")).toBe(true)
    expect(d.laminas[0].titular).toMatch(/3 cosas que el Cuerpo de Bomberos revisa/)
    expect(d.laminas[3].titular).toBe("2. MANÓMETRO")
    expect(d.laminas[3].glifos_riesgosos).toBe(true)
    expect(d.avisos.find((a) => a.nivel === "rojo")?.texto).toMatch(/6 imágenes generadas.*ninguna/)
    expect(d.exige_casilla).toBe(true)
    expect(d.gasto_usd).toBeCloseTo(1.840811, 5)
    expect(d.pie).toMatch(/Cuerpo de Bomberos/)
    expect(d.jefatura.resultado).toBe("incompleta_por_tope")
    expect(d.jefatura.desacuerdos.length).toBeGreaterThanOrEqual(8)
  })

  it("BRF-0002 v3: 6 láminas y gasto 1,73", async () => {
    const d = (await cargarPieza(supa(), BRF0002))!
    expect(d.laminas).toHaveLength(6)
    expect(d.gasto_usd).toBeCloseTo(1.73134, 5)
    expect(d.exige_casilla).toBe(true)
  })

  it("la lámina que sirve el tablero es un PNG de verdad (firma PNG y 1080×1350) y la 8.ª no existe", async () => {
    const url = await direccionDeLaLaminaDeUnaPieza(supa(), BRF0001, 4)
    expect(url).toBeTruthy()
    const b = Buffer.from(await (await fetch(url!)).arrayBuffer())
    expect([...b.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([1080, 1350])
    expect(await direccionDeLaLaminaDeUnaPieza(supa(), BRF0001, 8)).toBeNull()
  })

  it("una fila de otro tipo se abre en solo lectura, sin láminas", async () => {
    const l = await listarPiezas(supa(), { estado: "pendiente", limite: 100 })
    const otra = l.find((x) => !x.es_pieza)!
    const d = (await cargarPieza(supa(), otra.id))!
    expect(d.es_pieza).toBe(false)
    expect(d.laminas).toEqual([])
  })
})
