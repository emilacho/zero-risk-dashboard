/**
 * CENTRO DE CAMPAÑA · ESTADO Y CANTIDAD EN CADA TARJETA (boceto aprobado por Emilio 09-nov 15:15Z · GO de Lenovo, reasignado a CC2).
 * Qué dice cada tarjeta con datos reales, qué dice cuando el dato no viene («—», nunca un cero inventado), y que las lecturas nuevas del servidor
 * no inventan un cero cuando la base falla. Todo sin red ni base real: US$ 0.
 */
import { describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { PanelAplicaciones } from "@/components/nuevo/PanelAplicaciones"
import { diaCorto, SIN_DATO, tarjetaDelCentro } from "@/lib/centro-tarjetas"
import { ESPERA_DEL_DINERO_MS, leerCentro, type Centro } from "@/lib/centro-datos"
import type { Pizarron } from "@/lib/pizarron-datos"
import { faseActiva } from "@/lib/pizarron"
import type { SupabaseClient } from "@supabase/supabase-js"

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
type Camp = NonNullable<Pizarron["campana"]>
const camp = (estado: string, extra: Partial<Camp> = {}): Camp => ({ id: "c", estado, desde: "2026-11-09", hasta: "2027-02-06", version_calendario: null, version_estrategia: 1, ...extra })
const fila = (id: string) => ({ id } as unknown as Pizarron["filas"][number])
const piz = (o: Partial<Pizarron> = {}): Pizarron => ({
  clientes: [{ id: NAUFRAGO, nombre: "Náufrago", con_campana: true }], cliente: { id: NAUFRAGO, nombre: "Náufrago" }, campana: camp("necesita_humano"),
  fases: [], fase_activa: faseActiva([], null, "2026-11-09"), gran_idea: { texto: null, nota: "" }, esperas: [], filas: [], semanas: [], totales: {}, manual_aprobado: true,
  hoy: "2026-11-09", leido_en: "x", ...o,
})
const cen = (o: Partial<Centro> = {}): Centro => ({
  cliente: NAUFRAGO,
  informes: { texto: "", aviso: false, total: 4, esperan: 0, ultimo: "2026-11-06T15:00:00Z" },
  brief: { texto: "", aviso: false, publicado: true, versiones: 0, estado: null, fecha: null },
  gran_idea: { texto: "", aviso: false, publicado: true, versiones: 0, estado: null, fecha: null },
  equipo: { texto: "", aviso: false, trabajando: 2, agentes: 7 },
  manual: { total: 5, aprobado: true, fecha: "2026-11-04T12:07:41Z" },
  plan: { estado: "approved", version: 2, fecha: "2026-11-06T11:20:56Z" },
  dinero: { gastado_24h_usd: 9, techo_usd: 60 },
  leido_en: "x", ...o,
})
const t = (clave: Parameters<typeof tarjetaDelCentro>[0], d: Pizarron | null, c: Centro | null, cargando = false) => tarjetaDelCentro(clave, d, c, cargando)

describe("las tarjetas de la campaña siguen a cadena_campanas (brief → gran idea → calendario)", () => {
  it("🔴 Náufrago hoy (necesita_humano, sin brief): el brief está DETENIDO en rojo; la gran idea y el calendario esperan al anterior, en gris", () => {
    expect(t("brief", piz(), cen())).toEqual({ estado: "Detenido", tono: "alarma", cantidad: "0", linea: "Espera arreglo" })
    expect(t("gran_idea", piz(), cen())).toEqual({ estado: "En espera", tono: "gris", cantidad: "0", linea: "Tras el brief" })
    expect(t("calendario", piz(), cen())).toEqual({ estado: "En espera", tono: "gris", cantidad: "0", linea: "Tras la gran idea" })
  })
  it("pausada: el paso que falta dice EN PAUSA (alarma)", () => {
    expect(t("brief", piz({ campana: camp("pausada") }), cen())).toMatchObject({ estado: "En pausa", tono: "alarma" })
  })
  it("en estrategia y sin brief todavía: el brief espera la estrategia (gris), no está detenido", () => {
    expect(t("brief", piz({ campana: camp("estrategia") }), cen())).toEqual({ estado: "En espera", tono: "gris", cantidad: "0", linea: "Tras la estrategia" })
  })
  it("con el brief validado y la gran idea pendiente: brief LISTO (oro, con su fecha) y gran idea POR APROBAR (oro, espera tu decisión)", () => {
    const c = cen({ brief: { texto: "", aviso: false, publicado: true, versiones: 2, estado: "validada", fecha: "2026-11-10T15:00:00Z" }, gran_idea: { texto: "", aviso: true, publicado: true, versiones: 1, estado: "pendiente", fecha: "2026-11-11T15:00:00Z" } })
    const d = piz({ campana: camp("calendario") })
    expect(t("brief", d, c)).toEqual({ estado: "Listo", tono: "oro", cantidad: "2", linea: "Act. 10-nov" })
    expect(t("gran_idea", d, c)).toEqual({ estado: "Por aprobar", tono: "oro", cantidad: "1", linea: "Espera tu decisión" })
    expect(t("calendario", d, c)).toMatchObject({ estado: "En espera", linea: "Tras la gran idea" })
  })
  it("todo hecho y la campaña activa: brief LISTO · gran idea APROBADA · calendario ARMADO con sus publicaciones", () => {
    const c = cen({ brief: { texto: "", aviso: false, publicado: true, versiones: 1, estado: "validada", fecha: null }, gran_idea: { texto: "", aviso: false, publicado: true, versiones: 1, estado: "aprobada", fecha: "2026-11-12T15:00:00Z" } })
    const d = piz({ campana: camp("activa"), filas: [fila("a"), fila("b")] })
    expect(t("gran_idea", d, c)).toEqual({ estado: "Aprobada", tono: "oro", cantidad: "1", linea: "Act. 12-nov" })
    expect(t("calendario", d, c)).toEqual({ estado: "Armado", tono: "oro", cantidad: "2", linea: "2 publicaciones" })
  })
  it("una campaña detenida después de aprobar la gran idea: el CALENDARIO es el detenido, no el brief", () => {
    const c = cen({ brief: { texto: "", aviso: false, publicado: true, versiones: 1, estado: "validada", fecha: null }, gran_idea: { texto: "", aviso: false, publicado: true, versiones: 1, estado: "aprobada", fecha: null } })
    const d = piz({ campana: camp("necesita_humano"), filas: [fila("a")] })
    expect(t("brief", d, c).estado).toBe("Listo"); expect(t("gran_idea", d, c).estado).toBe("Aprobada")
    expect(t("calendario", d, c)).toEqual({ estado: "Detenido", tono: "alarma", cantidad: "1", linea: "Espera arreglo" })
  })
  it("sin campaña: dicen SIN CAMPAÑA; con la tabla del brief sin publicar: «—»", () => {
    expect(t("calendario", piz({ campana: null }), cen())).toEqual({ estado: "Sin campaña", tono: "gris", cantidad: "0", linea: "Sin campaña todavía" })
    expect(t("brief", piz(), cen({ brief: { texto: "", aviso: false, publicado: false } }))).toMatchObject({ estado: SIN_DATO, cantidad: SIN_DATO })
  })
})

describe("las demás tarjetas", () => {
  it("manual: APROBADO con el número de versiones y su fecha · por aprobar · sin manual · «—» si no se pudo leer", () => {
    expect(t("manual", piz(), cen())).toEqual({ estado: "Aprobado", tono: "oro", cantidad: "5", linea: "Act. 04-nov" })
    expect(t("manual", piz(), cen({ manual: { total: 2, aprobado: false, fecha: null } }))).toMatchObject({ estado: "Por aprobar", tono: "gris", cantidad: "2" })
    expect(t("manual", piz(), cen({ manual: { total: 0, aprobado: null, fecha: null } }))).toMatchObject({ estado: "Sin manual", cantidad: "0" })
    expect(t("manual", piz(), cen({ manual: null }))).toMatchObject({ estado: SIN_DATO, cantidad: SIN_DATO })
  })
  it("plan: APROBADO con su versión y fecha · espera el manual si el manual no está aprobado · «—» si no se pudo leer", () => {
    expect(t("plan", piz(), cen())).toEqual({ estado: "Aprobado", tono: "oro", cantidad: "1", linea: "Act. 06-nov · v2" })
    expect(t("plan", piz({ manual_aprobado: false }), cen())).toEqual({ estado: "En espera", tono: "gris", cantidad: "1", linea: "Espera el manual · v2" })
    expect(t("plan", piz(), cen({ plan: { estado: "draft", version: 3, fecha: null } }))).toEqual({ estado: "Por aprobar", tono: "gris", cantidad: "1", linea: "Sin fecha · v3" })
    expect(t("plan", piz(), cen({ plan: null }))).toMatchObject({ estado: "Sin plan", cantidad: "0" })
    expect(t("plan", piz(), cen({ plan: undefined }))).toMatchObject({ estado: SIN_DATO })
  })
  it("09-nov 18:10Z (Emilio): ningún recuadro muestra una versión · la cantidad va en el recuadro, la versión en la línea gris", () => {
    for (const k of ["piezas", "manual", "informes", "plan", "brief", "gran_idea", "calendario", "equipo", "gasto"] as const) {
      for (const d of [piz(), piz({ manual_aprobado: false })]) expect(t(k, d, cen()).cantidad, k).not.toMatch(/^v\d/)
    }
  })
  it("informes: al día con el total y la fecha del último · por revisar si alguno espera", () => {
    expect(t("informes", piz(), cen())).toEqual({ estado: "Al día", tono: "oro", cantidad: "4", linea: "Act. 06-nov" })
    expect(t("informes", piz(), cen({ informes: { texto: "", aviso: true, total: 4, esperan: 1, ultimo: null } }))).toMatchObject({ estado: "Por revisar", linea: "1 espera tu revisión" })
  })
  it("piezas: cuántas esperan tu aprobación (sale del pizarrón, aunque el centro no haya llegado)", () => {
    expect(t("piezas", piz({ totales: { emilio: 3 } as Pizarron["totales"], filas: [fila("a")] }), null)).toEqual({ estado: "Por aprobar", tono: "oro", cantidad: "3", linea: "Esperan tu aprobación" })
    expect(t("piezas", piz(), cen())).toEqual({ estado: "Sin piezas", tono: "gris", cantidad: "0", linea: "Nada por aprobar" })
  })
  it("equipo: cuántos agentes hay y cuántos trabajan ahora", () => {
    expect(t("equipo", piz(), cen())).toEqual({ estado: "Activos", tono: "oro", cantidad: "7", linea: "2 trabajando" })
    expect(t("equipo", piz(), cen({ equipo: { texto: "", aviso: false, trabajando: 0, agentes: null } }))).toEqual({ estado: "Sin tareas", tono: "gris", cantidad: SIN_DATO, linea: "Nadie trabaja ahora" })
  })
  it("dinero: lo gastado en 24 h y el tope por día · EN EL TOPE en rojo · «—» sin la lectura del freno", () => {
    expect(t("gasto", piz(), cen())).toEqual({ estado: "Gastado 24 h", tono: "gris", cantidad: "US$ 9", linea: "Tope US$ 60/día" })
    expect(t("gasto", piz(), cen({ dinero: { gastado_24h_usd: 61, techo_usd: 60 } }))).toMatchObject({ estado: "En el tope", tono: "alarma" })
    expect(t("gasto", piz(), cen({ dinero: null }))).toMatchObject({ estado: SIN_DATO, cantidad: SIN_DATO })
  })
  it("🔴 sin la lectura del centro, todo lo que sale de ella dice «—» (nunca un cero); mientras lee, «Leyendo…»", () => {
    for (const k of ["manual", "informes", "plan", "brief", "gran_idea", "calendario", "equipo", "gasto"] as const) expect(t(k, piz(), null), k).toMatchObject({ estado: SIN_DATO, cantidad: SIN_DATO })
    expect(t("manual", null, null, true)).toMatchObject({ linea: "Leyendo…" })
  })
  it("la fecha corta es la de Ecuador (03:00Z del 4 de noviembre todavía es el 3)", () => {
    expect(diaCorto("2026-11-04T03:00:00Z")).toBe("03-nov"); expect(diaCorto("2026-11-06")).toBe("06-nov"); expect(diaCorto("x")).toBeNull(); expect(diaCorto(null)).toBeNull()
  })
})

describe("la pantalla", () => {
  it("🔴 sin panel de fondo: el Centro va directo sobre la escena, con la tarjeta de hoy, el estado con su punto y la cantidad", () => {
    const html = renderToStaticMarkup(createElement(PanelAplicaciones, { onCerrar: () => {}, datosIniciales: piz() }))
    expect(html).toContain('data-fondo="escena"'); expect(html).not.toContain("zr-hilo-oro"); expect(html).not.toContain("bg-grafito ")
    expect(html.match(/bg-tarjeta-escena/g)).toHaveLength(9)
    expect(html.match(/data-estado=/g)).toHaveLength(9); expect(html.match(/data-cantidad=/g)).toHaveLength(9); expect(html.match(/data-linea=/g)).toHaveLength(9)
    expect(html).not.toMatch(/data-paso=/)
    expect(html).toContain("data-cliente-como-texto"); expect(html).not.toContain("<select")
  })
  it("el panel base sigue igual para todos los demás (fondo por omisión)", () => {
    const c = readFileSync("components/nuevo/EstiloBase.tsx", "utf8")
    expect(c).toContain("fondo = true"); expect(c).toContain('fondo ? "zr-hilo-oro rounded-panel border border-linea bg-grafito" : ""')
  })
})

// ───────────────────────────── la lectura del servidor: lo que falla dice «no se pudo leer», no «cero»
type Respuesta = { data: unknown; error: { message: string } | null }
function baseFalsa(tablas: Record<string, unknown[] | Error>): SupabaseClient {
  const from = (tabla: string) => {
    let una = false
    const resolver = (): Respuesta => { const x = tablas[tabla]; if (x instanceof Error) return { data: null, error: { message: x.message } }; const filas = x ?? []; return { data: una ? filas[0] ?? null : filas, error: null } }
    const cadena: Record<string, unknown> = {}
    for (const m of ["select", "eq", "is", "gte", "in", "order", "limit", "not"]) cadena[m] = () => cadena
    cadena.maybeSingle = () => { una = true; return cadena }
    cadena.then = (ok: (r: Respuesta) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resolver()).then(ok, ko)
    return cadena
  }
  return { from } as unknown as SupabaseClient
}
const riesgosCon = (topes: Array<{ client_id: string; gastado_24h_usd: number; techo_usd: number }>) => async () => ({ ok: true as const, datos: { topes } as never })

describe("leerCentro · las lecturas nuevas", () => {
  it("trae manuales, plan vigente, agentes activos y el freno de gasto del cliente", async () => {
    const db = baseFalsa({
      client_brand_books: [{ version: 5, human_validated: true, provenance_tag: {}, created_at: "2026-11-04T12:07:41Z" }, { version: 4, human_validated: false, provenance_tag: {}, created_at: "2026-11-04T11:55:36Z" }],
      client_historical_outputs: [{ status: "rejected", provenance_tag: { version: 3 }, created_at: "2026-11-07T00:00:00Z" }, { status: "approved", provenance_tag: { version: 2 }, created_at: "2026-11-06T11:17:01Z", updated_at: "2026-11-06T11:20:56Z" }],
      agents: [{ name: "a", department: "marketing", is_active: true }, { name: "b", department: "marketing", is_active: true }, { name: "c", department: "marketing", is_active: true }, { name: "v", department: "sales", is_active: true }],
    })
    const c = await leerCentro(db, { cliente: NAUFRAGO, riesgos: riesgosCon([{ client_id: "otro", gastado_24h_usd: 1, techo_usd: 5 }, { client_id: NAUFRAGO, gastado_24h_usd: 9.12, techo_usd: 60 }]) })
    expect(c.manual).toEqual({ total: 2, aprobado: true, fecha: "2026-11-04T12:07:41Z" })
    expect(c.plan).toEqual({ estado: "approved", version: 2, fecha: "2026-11-06T11:20:56Z" }) // el rechazado no cuenta
    expect(c.equipo.agentes).toBe(3)
    expect(c.dinero).toEqual({ gastado_24h_usd: 9.12, techo_usd: 60 })
  })
  it("🔴 si una lectura de apoyo falla, su dato queda «no se pudo leer» (null/undefined), nunca 0; el resto del centro sigue", async () => {
    const db = baseFalsa({ client_brand_books: new Error("caída"), client_historical_outputs: new Error("caída"), agents: new Error("caída") })
    const c = await leerCentro(db, { cliente: NAUFRAGO, riesgos: async () => { throw new Error("sin red") } })
    expect(c.manual).toBeNull(); expect(c.plan).toBeUndefined(); expect(c.equipo.agentes).toBeNull(); expect(c.dinero).toBeNull()
    expect(c.informes.total).toBe(0) // las lecturas de siempre siguen
  })
  it("el cliente sin tope en la lista de riesgos: dinero null («—»), no un cero", async () => {
    const c = await leerCentro(baseFalsa({}), { cliente: NAUFRAGO, riesgos: riesgosCon([]) })
    expect(c.dinero).toBeNull(); expect(c.plan).toBeNull(); expect(c.manual).toEqual({ total: 0, aprobado: null, fecha: null })
  })
  it("🔴 una lectura de Riesgos que nunca termina no cuelga el Centro: a los 6 s vuelve con dinero null («—»)", async () => {
    vi.useFakeTimers()
    try {
      let listo = false
      const p = leerCentro(baseFalsa({}), { cliente: NAUFRAGO, riesgos: () => new Promise<never>(() => {}) }).then((c) => { listo = true; return c })
      await vi.advanceTimersByTimeAsync(ESPERA_DEL_DINERO_MS - 1)
      expect(listo).toBe(false) // espera de verdad a Riesgos hasta el plazo
      await vi.advanceTimersByTimeAsync(1)
      expect(listo).toBe(true)
      const c = await p
      expect(c.dinero).toBeNull()
      expect(ESPERA_DEL_DINERO_MS).toBe(6000)
    } finally { vi.useRealTimers() }
  })
})
