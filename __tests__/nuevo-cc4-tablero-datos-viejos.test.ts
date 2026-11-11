/**
 * GO Lenovo 10-nov 20:30Z · «el tablero muestra datos viejos o equivocados de la campaña» (CC4 · certifica CC6 · US$ 0 · sin red).
 * Causas en `raw/tasks/2026-11-10-CAUSAS-CC4-a-LENOVO-CC6-tablero-datos-viejos.md`. Aquí 1, 2 y 4 (la sala, la 3, va aparte; la 5 lee bien):
 *  1 · la cabecera del Calendario decía siempre «Todavía no hay gran idea» (texto fijo de cuando no existía la tabla) → lee `cadena_conceptos` de la campaña;
 *  2 · la escena decía «plan aprobado · sigue el brief» con la campaña ya activa → con el plan aprobado y su campaña activa dice «campaña en marcha»;
 *  4 · «112 publicaciones» contaba las filas en esquema → UNA cuenta separa publicaciones y filas en esquema (Calendario, Centro, Aplicaciones, Plan).
 * Dos clientes de rubros distintos: Náufrago (restaurante) y un B2B industrial de práctica.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PanelPizarron } from "@/components/nuevo/PanelPizarron"
import { detalleDelCuadro } from "@/components/nuevo/PanelAplicaciones"
import { tarjetaDelCentro } from "@/lib/centro-tarjetas"
import { estadoDelPlan } from "@/lib/manual-primero"
import { conteoDePublicaciones, faseActiva, GRAN_IDEA_ESPERA, GRAN_IDEA_NO_HAY, granIdeaDelCalendario, semanasDelTablero, textoDePublicaciones, totalesDelTablero, type FilaDelTablero } from "@/lib/pizarron"
import { leerPizarron, type Pizarron } from "@/lib/pizarron-datos"

const CLIENTES = [
  {
    nombre: "Náufrago (restaurante)", id: "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", industria: "restaurante",
    // como lo guarda la base hoy: la v2 con las marcas de formato del agente, la v4 aprobada
    conceptos: [
      { version: 1, estado: "sin_mesa", aprobacion: null, gran_idea: null },
      { version: 2, estado: "lista", aprobacion: "cambios", gran_idea: { nombre: "**El oro que nunca buscaste**", frase: "*Salió buscando oro. Encontró el encebollado.*" } },
      { version: 4, estado: "lista", aprobacion: "aprobado", gran_idea: { nombre: "El oro que nunca buscaste", frase: "Salió buscando oro. Encontró el encebollado. Ahora llega a tu barrio." } },
    ],
    esperado: "El oro que nunca buscaste — Salió buscando oro. Encontró el encebollado. Ahora llega a tu barrio.",
  },
  {
    nombre: "B2B industrial (práctica)", id: "b2b00000-0000-4000-8000-000000000001", industria: "seguridad industrial",
    conceptos: [
      { version: 1, estado: "lista", aprobacion: "aprobado", gran_idea: { nombre: "_Un solo proveedor_", frase: "Toda la planta  protegida,\n con un solo contrato." } },
    ],
    esperado: "Un solo proveedor — Toda la planta protegida, con un solo contrato.",
  },
]

/** la base de práctica de las pruebas del calendario (filtra por eq / in / is) */
const base = (tablas: Record<string, Array<Record<string, unknown>>>) => ({ from: (t: string) => {
  let d = [...(tablas[t] ?? [])]
  const q: Record<string, unknown> = {}
  for (const m of ["select", "order", "limit", "like", "gte", "neq", "not"]) q[m] = () => q
  q.eq = (c: string, v: unknown) => { d = d.filter((f) => f[c] === v); return q }
  q.in = (c: string, v: unknown[]) => { d = d.filter((f) => v.includes(f[c])); return q }
  q.is = (c: string, v: unknown) => { d = d.filter((f) => (f[c] ?? null) === v); return q }
  q.maybeSingle = () => Promise.resolve({ data: d[0] ?? null, error: null })
  q.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: d, error: null }).then(ok)
  return q
} }) as never

const fila = (id: string, estado_fila: string): FilaDelTablero => ({ id, fecha: "2026-11-12", hora: "08:00", red: "instagram", formato: "historia", pilar: null, tema: `Tema ${id}`, sede: null, pieza_fija: false, tanda: estado_fila === "esquema" ? 2 : 1, semana: 1, estado_fila, avisos: [], pendientes: [], encargo: null, jefatura: null, pieza: null, tablero: "idea", motivo: "" })
const pizarron = (c: { id: string; nombre: string }, filas: FilaDelTablero[], gran_idea: Pizarron["gran_idea"] = { texto: null, nota: GRAN_IDEA_NO_HAY }): Pizarron => ({
  clientes: [{ id: c.id, nombre: c.nombre, con_campana: true }], cliente: { id: c.id, nombre: c.nombre }, manual_aprobado: true,
  campana: { id: "k", estado: "activa", desde: "2026-11-09", hasta: "2027-02-06", version_calendario: 1, version_estrategia: 1 },
  fases: [], fase_activa: faseActiva([], "2026-11-09", "2026-11-10"), gran_idea, esperas: [], filas, semanas: semanasDelTablero(filas), totales: totalesDelTablero(filas), hoy: "2026-11-10", leido_en: "x",
} as Pizarron)

describe("1 · la gran idea de la cabecera del Calendario sale de la base", () => {
  for (const c of CLIENTES) {
    it(`${c.nombre}: la última aprobada, sin marcas de formato`, () => {
      expect(granIdeaDelCalendario(c.conceptos)).toEqual({ texto: c.esperado, nota: "" })
    })
    it(`${c.nombre}: la lectura del calendario la trae de SU campaña (no de otra ni de un ensayo en seco)`, async () => {
      const K = `camp-${c.id}`
      const p = await leerPizarron(base({
        clients: [{ id: c.id, name: c.nombre, industry: c.industria, status: "active", archived_at: null }],
        cadena_campanas: [{ id: K, client_id: c.id, estado: "activa", fecha_inicio: "2026-11-09", seco: false, creada_en: "2026-11-09" }],
        cadena_conceptos: [
          ...c.conceptos.map((x) => ({ ...x, campana_id: K, seco: false })),
          { version: 9, estado: "lista", aprobacion: "aprobado", campana_id: "otra-campana", seco: false, gran_idea: { nombre: "AJENA", frase: "de otra campaña" } },
          { version: 8, estado: "lista", aprobacion: "aprobado", campana_id: K, seco: true, gran_idea: { nombre: "ENSAYO", frase: "en seco" } },
        ],
      }), { cliente: c.id, ahora: new Date("2026-11-10T20:30:00Z") })
      expect(p.gran_idea).toEqual({ texto: c.esperado, nota: "" })
    })
    it(`${c.nombre}: la cabecera la muestra`, () => {
      const h = renderToStaticMarkup(createElement(PanelPizarron, { onCerrar: () => {}, datosIniciales: pizarron(c, [fila("a", "validada")], granIdeaDelCalendario(c.conceptos)) }))
      expect(h).toContain(c.esperado.split(" — ")[0]); expect(h).not.toContain(GRAN_IDEA_NO_HAY)
    })
  }
  it("una más nueva sin decidir no tapa la aprobada (la aprobada sigue siendo la vigente)", () => {
    expect(granIdeaDelCalendario([...CLIENTES[0].conceptos, { version: 5, estado: "lista", aprobacion: null, gran_idea: { nombre: "Otra", frase: "x" } }]).texto).toBe(CLIENTES[0].esperado)
    expect(granIdeaDelCalendario([...CLIENTES[0].conceptos, { version: 5, estado: "lista", aprobacion: "pendiente", gran_idea: { nombre: "Otra", frase: "x" } }]).texto).toBe(CLIENTES[0].esperado)
  })
  it("con dos aprobadas, manda la de versión más alta (sin importar el orden en que llegan)", () => {
    const vieja = { version: 2, estado: "lista", aprobacion: "aprobado", gran_idea: { nombre: "Vieja", frase: "de la v2" } }
    const nueva = { version: 7, estado: "lista", aprobacion: "aprobado", gran_idea: { nombre: "Nueva", frase: "de la v7" } }
    expect(granIdeaDelCalendario([vieja, nueva]).texto).toBe("Nueva — de la v7")
    expect(granIdeaDelCalendario([nueva, vieja]).texto).toBe("Nueva — de la v7")
  })
  it("sin aprobada: si hay una lista sin decidir, espera tu decisión; si solo hay con cambios, sin mesa o nada, que no hay", () => {
    // el valor REAL: al entregar, la cadena guarda estado «lista» + aprobacion «pendiente» (plataforma src/lib/cadena/mesas.ts · cert CC6 #327)
    expect(granIdeaDelCalendario([{ version: 1, estado: "sin_mesa", aprobacion: null, gran_idea: null }, { version: 2, estado: "lista", aprobacion: "cambios", gran_idea: { nombre: "N", frase: "F" } }, { version: 3, estado: "lista", aprobacion: "pendiente", gran_idea: { nombre: "N3", frase: "F3" } }])).toEqual({ texto: null, nota: GRAN_IDEA_ESPERA })
    expect(granIdeaDelCalendario([{ version: 1, estado: "lista", aprobacion: null, gran_idea: { nombre: "N", frase: "F" } }])).toEqual({ texto: null, nota: GRAN_IDEA_ESPERA })
    expect(granIdeaDelCalendario([{ version: 1, estado: "lista", aprobacion: "cambios", gran_idea: { nombre: "N", frase: "F" } }, { version: 2, estado: "sin_mesa", aprobacion: null }])).toEqual({ texto: null, nota: GRAN_IDEA_NO_HAY })
    expect(granIdeaDelCalendario([])).toEqual({ texto: null, nota: GRAN_IDEA_NO_HAY })
  })
  it("una aprobada sin nombre ni frase no se inventa: cae a lo que haya", () => {
    expect(granIdeaDelCalendario([{ version: 1, estado: "lista", aprobacion: "aprobado", gran_idea: null }])).toEqual({ texto: null, nota: GRAN_IDEA_NO_HAY })
    expect(granIdeaDelCalendario([{ version: 1, estado: "lista", aprobacion: "aprobado", gran_idea: { nombre: "Solo nombre" } }]).texto).toBe("Solo nombre")
  })
})

describe("2 · la escena: con el plan aprobado, lo que pasa con su campaña", () => {
  const plan = (campana: { estado: string; del_plan_anterior?: boolean } | null) => ({ documento: { status: "approved" }, ciclo: { estado: "aprobado" }, manual_aprobado: true, campana } as never)
  it("plan aprobado + campaña activa del plan vigente → «campaña en marcha»", () => {
    expect(estadoDelPlan(plan({ estado: "activa" }))).toEqual({ clave: "campana_activa", texto: "campaña en marcha" })
  })
  it("control: sin campaña, con campaña en borrador o pausada, o del plan anterior → lo de antes", () => {
    for (const c of [null, { estado: "borrador" }, { estado: "pausada" }, { estado: "activa", del_plan_anterior: true }]) {
      expect(estadoDelPlan(plan(c))).toEqual({ clave: "aprobado", texto: "plan aprobado · sigue el brief" })
    }
  })
  it("control: el manual sin aprobar sigue mandando, con la campaña activa", () => {
    expect(estadoDelPlan({ ...(plan({ estado: "activa" }) as object), manual_aprobado: false } as never).clave).toBe("espera_el_manual")
  })
})

describe("4 · una fila en esquema no es una publicación", () => {
  for (const c of CLIENTES) {
    const filas = [fila("v1", "validada"), fila("v2", "validada"), fila("v3", "en_oficina"), fila("e1", "esquema"), fila("e2", "esquema")]
    it(`${c.nombre}: Calendario, Aplicaciones y Centro dicen «3 publicaciones · 2 próximas» (11-nov, Emilio: «Próximas», no «en esquema»)`, () => {
      const d = pizarron(c, filas)
      expect(conteoDePublicaciones(filas)).toEqual({ publicaciones: 3, en_esquema: 2 })
      const h = renderToStaticMarkup(createElement(PanelPizarron, { onCerrar: () => {}, datosIniciales: d }))
      expect(h).toContain("3 publicaciones · 2 próximas"); expect(h).not.toContain("5 publicaciones")
      // la barra de la semana también (antes: «5 publicaciones · en el esquema ×2 · …»)
      expect(h).toContain("3 publicaciones · 2 próximas · validada ×2 · en la oficina"); expect(h).not.toContain("próxima ×2"); expect(h).not.toContain("esquema")
      expect(detalleDelCuadro("calendario", d).texto).toBe("3 publicaciones · 2 próximas")
      const t = tarjetaDelCentro("calendario", d, {} as never)
      expect(t.cantidad).toBe("3"); expect(t.linea).toBe("3 publicaciones · 2 próximas")
    })
  }
  it("control: sin filas en esquema, el texto de siempre (y el singular)", () => {
    expect(textoDePublicaciones(conteoDePublicaciones([fila("a", "validada"), fila("b", "aprobada")]))).toBe("2 publicaciones")
    expect(textoDePublicaciones(conteoDePublicaciones([fila("a", "validada")]))).toBe("1 publicación")
    expect(textoDePublicaciones(conteoDePublicaciones([]))).toBeNull()
  })
  it("solo filas en esquema: «Sin publicaciones todavía · N próximas» (en singular, «1 próxima»)", () => {
    expect(textoDePublicaciones(conteoDePublicaciones([fila("e1", "esquema")]))).toBe("Sin publicaciones todavía · 1 próxima")
    expect(textoDePublicaciones(conteoDePublicaciones([fila("e1", "esquema"), fila("e2", "esquema")]))).toBe("Sin publicaciones todavía · 2 próximas")
  })
})
