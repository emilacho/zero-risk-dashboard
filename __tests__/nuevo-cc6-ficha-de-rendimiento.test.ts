/** LA FICHA DE RENDIMIENTO (CC6 · 02-nov · diseño de Lenovo aprobado por Emilio + sus respuestas). US$ 0 · sin red · solo lectura. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { formaDe, rendimientoDe, UMBRALES, type RevisionCruda, type TrabajoCrudo } from "@/lib/rendimiento"
import { leerRendimiento } from "@/lib/rendimiento-datos"
import { FichaDeRendimiento } from "@/components/nuevo/escena/FichaDeRendimiento"
import { FlechasDeForma } from "@/components/nuevo/escena/FlechasDeForma"
import type { SupabaseClient } from "@supabase/supabase-js"

const dia = (n: number) => `2026-10-${String(n).padStart(2, "0")}T12:00:00Z`
const rev = (n: number, resultado: string, bloqueos = 0): RevisionCruda => ({ creado_en: dia(n), resultado, bloqueos })
const trabajo = (n: number, o: Partial<TrabajoCrudo> = {}): TrabajoCrudo => ({ creado_en: dia(n), status: "completed", stop_reason: "end_turn", num_turns: 1, brain_hit: true, cost_usd: 0.1, duration_ms: 15000, ...o })

describe("la forma (flecha tipo FIFA)", () => {
  it("cinco estados; rojo desde 20 puntos de caída (Emilio) y umbrales simétricos", () => {
    expect([25, 20, 10, 7, 0, -6, -7, -19, -20, -40].map(formaDe)).toEqual(["arriba", "arriba", "sube", "sube", "estable", "estable", "baja", "baja", "cae", "cae"])
    expect(UMBRALES).toEqual({ arriba: 20, sube: 7, baja: -7, cae: -20 })
  })
})

describe("el rendimiento de un empleado", () => {
  it("una tarea = una entrega revisada; con menos de 5, «pocas tareas todavía» y sin flecha", () => {
    const r = rendimientoDe("x", [rev(1, "limpia"), rev(2, "limpia")], [trabajo(1)], [])
    expect(r).toMatchObject({ revisadas: 2, forma: null, motivo_sin_flecha: "pocas tareas todavía", puntaje: null })
    expect(r.dimensiones.map((d) => d.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
  it("con 5+ ahora pero menos de 5 antes: sin flecha (no hay con qué comparar)", () => {
    const r = rendimientoDe("x", [1, 2, 3, 4, 5, 6].map((n) => rev(n, "limpia")), [trabajo(3)], [])
    expect(r.forma).toBeNull(); expect(r.motivo_sin_flecha).toBe("pocas tareas anteriores para comparar"); expect(r.puntaje).not.toBeNull()
  })
  it("aprobado a la primera: limpia o con desacuerdo SIN observaciones que bloqueen; por tope o fallida no cuentan (Lenovo)", () => {
    const r = rendimientoDe("x", [rev(10, "limpia"), rev(11, "con_desacuerdo"), rev(12, "limpia", 2), rev(13, "incompleta_por_tope"), rev(14, "fallida")], [trabajo(12)], [])
    expect(r.dimensiones[0]).toMatchObject({ valor: "2 de 3", puntaje: 67 })
    expect(r.dimensiones[0].detalle).toMatch(/2 no cuentan/)
  })
  it("la flecha compara las 10 últimas con las anteriores; «aprobado a la primera» pesa el doble; 6 y 10 no cuentan", () => {
    const antes = [1, 2, 3, 4, 5].map((n) => rev(n, "limpia"))
    const ahora = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((n) => rev(n, "limpia", 1))
    const r = rendimientoDe("x", [...antes, ...ahora], [1, 2, 3, 11, 12, 13].map((n) => trabajo(n)), [])
    // antes: todo 100 · ahora: aprobado 0 (pesa 2), lo demás 100 → (0*2 + 100*4) / 6 = 67 → cae
    expect(r.puntaje_previo).toBe(100); expect(r.puntaje).toBe(67); expect(r.forma).toBe("cae")
    expect(r.dimensiones.filter((d) => !d.cuenta).map((d) => d.n)).toEqual([6, 10])
  })
  it("lo que no tiene dato dice «sin dato todavía» (sin número): veracidad, info que faltó, preguntó, aporte en reuniones", () => {
    const r = rendimientoDe("x", [rev(1, "limpia")], [], [])
    expect(r.dimensiones.filter((d) => d.valor == null).map((d) => d.n)).toEqual(expect.arrayContaining([3, 6, 7, 9]))
  })
  it("escalado a Emilio cuenta todo lo que llegó a la bandeja en el periodo, aunque haya vencido", () => {
    const r = rendimientoDe("x", [1, 2, 3, 4, 5].map((n) => rev(n, "limpia")), [], [{ creado_en: dia(3) }, { creado_en: dia(4) }])
    expect(r.dimensiones[7]).toMatchObject({ valor: "2 veces", puntaje: 60 })
  })
  it("costo y tiempo: solo dato, frente a su propio promedio", () => {
    const r = rendimientoDe("x", [rev(5, "limpia")], [trabajo(1, { cost_usd: 0.05, duration_ms: 5000 }), trabajo(6, { cost_usd: 0.2, duration_ms: 20000 })], [])
    expect(r.dimensiones[9]).toMatchObject({ valor: "20 s · US$ 0,20", puntaje: null, cuenta: false })
  })
})

function baseFalsa(t: Record<string, unknown[]>) {
  const consulta = (tabla: string): unknown => {
    const q: Record<string, unknown> = {}
    for (const n of ["select", "eq", "in", "order", "limit"]) q[n] = () => q
    q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: t[tabla] ?? [], error: null }).then(res)
    for (const n of ["insert", "update", "upsert", "delete", "rpc"]) q[n] = () => { throw new Error(`escritura prohibida: ${tabla}.${n}`) }
    return q
  }
  return { from: consulta } as unknown as SupabaseClient
}

describe("la lectura (solo lectura, nombres canónicos)", () => {
  it("toma al empleado de `productores`, cuenta los bloqueos de sus fichas y une los nombres con guion o guion bajo", async () => {
    const r = await leerRendimiento(baseFalsa({
      jefatura_revisiones: [{ id: "r1", resultado: "limpia", productores: [{ donde: "texto", agente: "content-creator" }, { donde: "imagen", agente: "marketing_instagram_curator" }], creado_en: dia(5) }],
      jefatura_fichas: [{ revision_id: "r1", gravedad: "bloquea" }],
      agent_invocations: [{ agent_name: "marketing_instagram_curator", created_at: dia(6), status: "completed", num_turns: 1, cost_usd: 0.1, duration_ms: 1000, metadata: { brain_hit: true } }],
      hitl_queue: [],
    }), new Date("2026-11-02T12:00:00Z"))
    expect(Object.keys(r.empleados).sort()).toEqual(["content-creator", "marketing-instagram-curator"])
    expect(r.empleados["content-creator"].dimensiones[0].valor).toBe("0 de 1") // tuvo una observación que bloquea: se la devolvieron
    expect(r.empleados["marketing-instagram-curator"].dimensiones[1].valor).toBe("1 de 1")
  })
})

describe("en pantalla", () => {
  const r = rendimientoDe("content-creator", [...[1, 2, 3, 4, 5].map((n) => rev(n, "limpia")), ...[11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((n) => rev(n, "limpia", 1))], [], [])
  it("la flecha sobre el empleado (capa propia) y el punto tenue con pocas tareas", () => {
    const pocas = rendimientoDe("otro", [rev(1, "limpia")], [], [])
    const h = renderToStaticMarkup(createElement("svg", null, createElement(FlechasDeForma, { datosIniciales: { "content-creator": r, otro: pocas }, puestosIniciales: [{ agente: "content-creator", nombre: "Redactor", color: "#f5a524", x: 100, y: 200, sentado: false }, { agente: "otro", nombre: "Otro", color: "#f5a524", x: 300, y: 200, sentado: true }] })))
    expect(h).toContain('data-forma-de="content-creator" data-forma="cae"'); expect(h).toContain("↓"); expect(h).toContain('data-forma-de="otro" data-forma="sin"')
    expect(h).toContain("Toca para ver su rendimiento")
  })
  it("la ficha: las 10 dimensiones en orden, la forma en palabras y que solo informa; es un panel que deja ver el chat", () => {
    const h = renderToStaticMarkup(createElement(FichaDeRendimiento, { r, nombre: "Redactor de contenido", color: "#f5a524", onCerrar: () => {} }))
    expect([...h.matchAll(/data-dimension="(\d+)"/g)].map((x) => x[1])).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"])
    expect(h).toContain("cayó de golpe"); expect(h).toContain("no bloquea ni decide nada"); expect(h).toContain("sin dato todavía"); expect(h).toMatch(/class="nv-panel /)
  })
  it("la escena la monta sin tocar la animación de CC4 (solo una línea en Avatares)", () => {
    expect(readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")).toContain("<FlechasDeForma />")
    expect(readFileSync("components/nuevo/escena/Siluetas.tsx", "utf8")).not.toContain("FlechasDeForma")
  })
})
