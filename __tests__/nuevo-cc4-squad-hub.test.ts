/** EL SQUAD HUB · plantel del equipo como el de EA FC (CC4 · 02-nov · boceto y 3 reglas aprobados por Emilio 18:23Z). US$ 0 · sin red · solo lectura. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import type { SupabaseClient } from "@supabase/supabase-js"
import { armarEscena } from "@/lib/escena-avatares"
import { costoFrenteASuPromedio, mediaDelEquipo, moralDe, rolDe } from "@/lib/plantel"
import { leerPlantel } from "@/lib/plantel-datos"
import { rendimientoDe, type RevisionCruda, type TrabajoCrudo } from "@/lib/rendimiento"
import { PlantelDelEquipo, puestoEnElEquipo } from "@/components/nuevo/escena/PlantelDelEquipo"

const ahora = new Date("2026-11-02T18:00:00Z")
const hace = (dias: number) => new Date(ahora.getTime() - dias * 86_400_000).toISOString()

describe("regla 1 · el ROL (aprobada)", () => {
  it("Crucial ≥20 · Importante 5–19 · Ocasional 1–4 · Sin estrenar 0 (trabajos en 30 días)", () => {
    const rol = (n: number) => rolDe({ trabajos30d: n, desde: hace(60), ahora })
    expect([30, 20, 19, 5, 4, 1, 0].map(rol)).toEqual(["Crucial", "Crucial", "Importante", "Importante", "Ocasional", "Ocasional", "Sin estrenar"])
  })
  it("«En prueba» (entró hace menos de 14 días) manda sobre las demás; a los 14 días ya no", () => {
    expect(rolDe({ trabajos30d: 30, desde: hace(4), ahora })).toBe("En prueba")
    expect(rolDe({ trabajos30d: 0, desde: hace(13.9), ahora })).toBe("En prueba")
    expect(rolDe({ trabajos30d: 30, desde: hace(14), ahora })).toBe("Crucial")
    expect(rolDe({ trabajos30d: 3, desde: null, ahora })).toBe("Ocasional") // sin fecha de entrada no se inventa «en prueba»
  })
})

describe("regla 2 · la MORAL (aprobada)", () => {
  it("verde sin devoluciones · amarilla hasta la mitad · roja más de la mitad; con menos de 3 entregas, sin carita", () => {
    expect(moralDe(0, 7)).toBe("verde")
    expect(moralDe(3, 7)).toBe("amarilla")
    expect(moralDe(2, 4)).toBe("amarilla") // exactamente la mitad: todavía amarilla
    expect(moralDe(5, 5)).toBe("roja")
    expect(moralDe(3, 5)).toBe("roja")
    expect(moralDe(1, 2)).toBeNull(); expect(moralDe(0, 0)).toBeNull()
  })
  it("sale del rendimiento: devueltas y contables de sus últimas 10 entregas revisadas (las cortadas por tope no cuentan)", () => {
    const dia = (n: number) => `2026-10-${String(n).padStart(2, "0")}T12:00:00Z`
    const revs: RevisionCruda[] = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ creado_en: dia(n), resultado: "limpia", devuelta: n <= 3 })).concat([{ creado_en: dia(8), resultado: "incompleta_por_tope", devuelta: false }])
    const t: TrabajoCrudo = { creado_en: dia(3), status: "completed", stop_reason: "end_turn", num_turns: 1, brain_hit: true, cost_usd: 0.1, duration_ms: 1000 }
    const r = rendimientoDe("content-creator", revs, [t], [])
    expect(r).toMatchObject({ devueltas: 3, contables: 7 })
    expect(moralDe(r.devueltas, r.contables)).toBe("amarilla") // como el redactor del boceto: «3 devueltas de 7»
  })
})

describe("datos del plantel", () => {
  it("la media del equipo cuenta solo a quienes tienen valoración; sin ninguna, «–»", () => {
    expect(mediaDelEquipo([69, 64, null, 83, undefined])).toBe(72)
    expect(mediaDelEquipo([null, null])).toBeNull()
  })
  it("el costo frente a su promedio va en %, con 3+ trabajos en el mes y costo; sin eso, nada", () => {
    expect(costoFrenteASuPromedio([0.113, 0.113, 0.113], [0.1, 0.1, 0.1, 0.113, 0.113, 0.113])).toBe(Math.round(((0.113 - 0.1065) / 0.1065) * 100))
    expect(costoFrenteASuPromedio([0.1, 0.1], [0.1, 0.1, 0.1])).toBeNull()
    expect(costoFrenteASuPromedio([null, null, null], [0.1])).toBeNull()
  })
  it("el puesto sale del mapa del equipo («Texto», «Imagen»…); quien no está en el mapa no lleva puesto inventado", () => {
    expect(puestoEnElEquipo("content-creator", "creativo").puesto).not.toBe("—")
    expect(puestoEnElEquipo("nadie-conocido", "creativo")).toEqual({ puesto: "—", orden: 99, todos: [] })
  })
  it("la lectura cuenta los trabajos de 30 días paginando (la base corta en 1.000) y un error de la base lanza", async () => {
    const filas = Array.from({ length: 1500 }, (_, i) => ({ agent_name: i < 1200 ? "content-creator" : "otro", created_at: hace(i < 1100 ? 5 : 45), cost_usd: 0.1 }))
    const supa = { from: (t: string) => t === "agents"
      ? { select: () => ({ limit: async () => ({ data: [{ name: "content-creator", model: "claude-sonnet", created_at: hace(60), is_active: true }, { name: "otro", model: null, created_at: null, is_active: null }], error: null }) }) }
      : { select: () => ({ gte: () => ({ order: () => ({ range: async (a: number, b: number) => ({ data: filas.slice(a, b + 1), error: null }) }) }) }) } } as unknown as SupabaseClient
    const r = await leerPlantel(supa, ahora)
    expect(r.empleados["content-creator"]).toMatchObject({ trabajos_30d: 1100, modelo: "claude-sonnet", activo: true })
    expect(r.empleados["otro"]).toMatchObject({ trabajos_30d: 0, modelo: null, desde: null, activo: null })
    const roto = { from: (t: string) => (t === "agents" ? { select: () => ({ limit: async () => ({ data: [], error: { message: "caída" } }) }) } : {}) } as unknown as SupabaseClient
    await expect(leerPlantel(roto, ahora)).rejects.toThrow("agents: caída")
  })
})

describe("el plantel en pantalla", () => {
  const e = armarEscena({ despachos: [], invocaciones: [], directorio: [], agentes: [], clientes: [], equipos: null, ahora })
  const mesa = structuredClone(e.mesas.find((m) => m.clave === "creativo")!)
  mesa.equipo = [
    { agente: "content-creator", nombre: "Content Creator", estado: "quieto", ultima: hace(2), hace: "hace 2 d", nota: null, origen_de_la_mesa: "directorio" },
    { agente: "carousel-designer", nombre: "Carousel Designer", estado: "trabajando", ultima: hace(0), hace: "hace 1 min", nota: null, origen_de_la_mesa: "directorio" },
    { agente: "video-editor", nombre: "Video Editor", estado: "quieto", ultima: null, hace: "sin trabajo en la ventana leída", nota: null, origen_de_la_mesa: "directorio" },
  ]
  const dia = (n: number) => `2026-10-${String(n).padStart(2, "0")}T12:00:00Z`
  const t: TrabajoCrudo = { creado_en: dia(3), status: "completed", stop_reason: "end_turno", num_turns: 1, brain_hit: true, cost_usd: 0.1, duration_ms: 1000 }
  const rend = {
    "content-creator": rendimientoDe("content-creator", [1, 2, 3, 4, 5, 6, 7].map((n) => ({ creado_en: dia(n), resultado: "limpia", devuelta: n <= 3 })), [t], []),
    "carousel-designer": rendimientoDe("carousel-designer", [{ creado_en: dia(1), resultado: "limpia", devuelta: false }], [t], []),
  }
  const plantel = { "content-creator": { trabajos_30d: 30, desde: hace(60), modelo: "claude-sonnet", activo: true, costo_vs_promedio_pct: 13 }, "carousel-designer": { trabajos_30d: 10, desde: hace(5), modelo: "claude-opus-4-6", activo: true, costo_vs_promedio_pct: null }, "video-editor": { trabajos_30d: 0, desde: hace(80), modelo: "claude-opus-4-6", activo: false, costo_vs_promedio_pct: null } }
  const html = renderToStaticMarkup(createElement(PlantelDelEquipo, { mesa, mesas: e.mesas, agenteInicial: "content-creator", onCerrar: () => {}, onFicha: () => {}, onTrabajo: () => {}, rendimientoInicial: rend, plantelInicial: plantel, ahora, abrirTodo: true }))

  it("copia la estructura del Squad Hub: lista (N.º · puesto · nombre · VAL · Rol · Forma · Moral), detalle, holograma y resumen arriba a la derecha", () => {
    for (const c of ["N.º", "Puesto", "Nombre", "VAL", "Rol", "Forma", "Moral"]) expect(html).toContain(c)
    expect(html).toContain('data-plantel="creativo"')
    expect(html).toContain("Plantel · ")
    expect(html).toContain("data-resumen-de-equipos"); expect(html).toContain('data-equipo-resumen="creativo"')
    expect(html).toContain('aria-label="Su holograma"'); expect(html).toContain('data-detalle="content-creator"')
    expect(html).toContain("nv-panel") // no tapa el chat de abajo
  })
  it("datos reales: valoración, rol por trabajos, moral por devoluciones y la fila elegida con sus acciones", () => {
    expect(html).toMatch(/data-fila="content-creator"[^>]*data-elegida/)
    expect(html).toContain("Crucial"); expect(html).toContain("30 trabajos en 30 días")
    expect(html).toContain("En prueba") // carousel-designer entró hace 5 días: manda sobre Importante
    expect(html).toContain("Sin estrenar") // video-editor: 0 trabajos
    expect(html).toContain('data-moral-detalle="amarilla"'); expect(html).toContain("3 devueltas de 7")
    expect(html).toContain("+13 %"); expect(html).not.toMatch(/US\$|\$ ?\d/) // el costo va en %, el gasto se ve solo en Dinero
    expect(html).toContain("Ver su ficha"); expect(html).toContain("Ver su última entrega"); expect(html).toContain("Ver su corrida en Observabilidad"); expect(html).toContain("Preguntarle · pronto")
  })
  it("sin dato no inventa: valoración «–», sin carita y «sin dato todavía»; las 10 dimensiones en 4 bloques", () => {
    for (const b of ["Calidad", "Trabajo", "Equipo", "Datos"]) expect(html).toContain(b)
    expect(html.match(/data-dimension="\d+"/g)).toHaveLength(10)
    expect(html).toContain("sin dato todavía") // veracidad, pregunta… sin datos
    expect(html).toMatch(/data-fila="video-editor"[\s\S]*?<span[^>]*data-val[^>]*>–<\/span>/)
    const solo = renderToStaticMarkup(createElement(PlantelDelEquipo, { mesa, mesas: e.mesas, agenteInicial: "video-editor", onCerrar: () => {}, onFicha: () => {}, onTrabajo: () => {}, rendimientoInicial: rend, plantelInicial: plantel, ahora }))
    expect(solo).toContain('data-moral-detalle="sin"'); expect(solo).toContain("En espera") // inactivo
  })
  it("equipo vacío: lo dice, sin inventar empleados", () => {
    const vacio = renderToStaticMarkup(createElement(PlantelDelEquipo, { mesa: { ...mesa, equipo: [] }, mesas: e.mesas, onCerrar: () => {}, onFicha: () => {}, onTrabajo: () => {}, rendimientoInicial: {}, plantelInicial: {}, ahora }))
    expect(vacio).toContain("Todavía no hay nadie asignado a este equipo."); expect(vacio).toContain("Sin empleados que mostrar.")
  })
  it("dónde vive: «Ver el equipo» abre el plantel; la flecha abre su detalle; reutiliza la ficha de CC6 (lib y ruta) sin tocarla; solo lectura", () => {
    const av = readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")
    expect(av).toContain("<PlantelDelEquipo mesa={abierta}"); expect(av).toContain("abrirPlantelDe")
    const fl = readFileSync("components/nuevo/escena/FlechasDeForma.tsx", "utf8")
    expect(fl).toContain("onAbrir?.(p.agente)"); expect(fl).toContain("FichaDeRendimiento") // sin plantel, la ficha de siempre
    const pl = readFileSync("components/nuevo/escena/PlantelDelEquipo.tsx", "utf8")
    expect(pl).toContain('"/api/rendimiento"'); expect(pl).toContain('"/api/plantel"')
    expect(readFileSync("lib/plantel-datos.ts", "utf8")).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(/)
    const ruta = readFileSync("app/api/plantel/route.ts", "utf8"); expect(ruta).toContain("exigirAdmin()"); expect(ruta).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/)
  })
  it("la flecha es la de eFootball: sola, chica, sin recuadro, pegada a la cabeza (rama de CC6)", () => {
    const fl = readFileSync("components/nuevo/escena/FlechasDeForma.tsx", "utf8")
    expect(fl).toContain("TAM_FLECHA = 17"); expect(fl).toContain("ALTO = { de_pie: 85, sentado: 57 }")
    expect(fl).not.toMatch(/<rect[^>]*stroke=/) // sin recuadro: solo el área de toque transparente
  })
})
