/**
 * 19-nov · VARIAS CAMPAÑAS POR CLIENTE (parte A de CC3) · LA regla común de la campaña que muestra una pantalla, y que el brief, la gran idea,
 * el pizarrón y el Centro la usen con `?campana=`.
 */
import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { elegirCampana, esCampanaValida, sePuedeMostrar } from "@/lib/campana-elegida"
import { esDeLaCampana, leerGranIdea } from "@/lib/gran-idea-datos"
import { leerBrief } from "@/lib/brief-datos"
import { leerPizarron } from "@/lib/pizarron-datos"
import { leerCentro } from "@/lib/centro-datos"

type Fila = Record<string, unknown>
/** una base de mentira que SÍ filtra (eq · in · is null) y ordena: la regla depende de esos filtros */
function base(tablas: Record<string, Fila[]>): SupabaseClient {
  const consulta = (t: string) => {
    let datos = [...(tablas[t] ?? [])]
    let cols: string[] | null = null
    // la tabla de campañas devuelve SOLO las columnas pedidas, como la base real (si una lectura olvida una columna, la prueba lo ve)
    const salida = (fs: Fila[]) => (t === "cadena_campanas" && cols ? fs.map((f) => Object.fromEntries(Object.entries(f).filter(([k]) => cols!.includes(k)))) : fs)
    const b: Record<string, unknown> = {}
    b.select = (c?: string) => { if (c && c !== "*") cols = c.split(",").map((x) => x.trim()); return b }
    b.eq = (c: string, v: unknown) => { datos = datos.filter((f) => leer(f, c) === v); return b }
    b.in = (c: string, v: unknown[]) => { datos = datos.filter((f) => v.includes(leer(f, c))); return b }
    b.is = (c: string, v: unknown) => { datos = datos.filter((f) => (v === null ? f[c] == null : f[c] === v)); return b }
    for (const m of ["neq", "gte", "lte", "lt", "gt", "not", "or", "ilike", "contains", "range"]) b[m] = () => b
    b.order = (c: string, o?: { ascending?: boolean }) => { datos.sort((a, z) => (String(a[c]) < String(z[c]) ? -1 : 1) * (o?.ascending === false ? -1 : 1)); return b }
    b.limit = (n: number) => { datos = datos.slice(0, n); return b }
    b.maybeSingle = async () => ({ data: salida(datos)[0] ?? null, error: null })
    b.single = b.maybeSingle
    b.then = (ok: (x: unknown) => unknown, mal: (e: unknown) => unknown) => Promise.resolve({ data: salida(datos), error: null }).then(ok, mal)
    return b
  }
  return { from: consulta } as unknown as SupabaseClient
}
const leer = (f: Fila, c: string): unknown => (c.includes("->>") ? (f[c.split("->>")[0]] as Fila | undefined)?.[c.split("->>")[1]] : f[c])

const CLI = "00000000-0000-4000-8000-0000000000c1"
const OTRO = "00000000-0000-4000-8000-0000000000c2"
const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`
const camp = (n: number, o: Fila = {}): Fila => ({ id: id(n), client_id: CLI, estado: "activa", seco: false, archivada_en: null, creada_en: `2026-11-1${n}T00:00:00Z`, ...o })

describe("elegirCampana · la regla común", () => {
  const c1 = camp(1), c2 = camp(2), c3 = camp(3, { estado: "cerrada" })
  it("🔴 la pedida, si es de ese cliente y está viva (aunque no sea la más nueva)", async () => {
    expect((await elegirCampana(base({ cadena_campanas: [c1, c2, c3] }), CLI, id(1)))?.id).toBe(id(1))
  })
  it("🔴 sin pedida: la primera VIVA, no la más nueva si esa está cerrada", async () => {
    expect((await elegirCampana(base({ cadena_campanas: [c1, c2, c3] }), CLI, null))?.id).toBe(id(2))
  })
  it("🔴 la pedida no se muestra si es de OTRO cliente, de ensayo, cerrada, reemplazada o archivada: cae a la primera viva", async () => {
    for (const mala of [camp(4, { client_id: OTRO }), camp(4, { seco: true }), camp(4, { estado: "cerrada" }), camp(4, { estado: "reemplazada" }), camp(4, { archivada_en: "2026-11-15T00:00:00Z" })]) {
      expect((await elegirCampana(base({ cadena_campanas: [c1, c2, mala] }), CLI, id(4)))?.id, JSON.stringify(mala)).toBe(id(2))
    }
  })
  it("🔴 la pedida en un estado vivo que no es «activa» (pausada, necesita_humano) sí se muestra", async () => {
    for (const estado of ["pausada", "necesita_humano", "abierta"]) expect((await elegirCampana(base({ cadena_campanas: [c2, camp(1, { estado })] }), CLI, id(1)))?.id, estado).toBe(id(1))
  })
  it("🔴 la viva archivada o de ensayo no cuenta como «primera viva»", async () => {
    const s = base({ cadena_campanas: [c1, camp(2, { archivada_en: "2026-11-15T00:00:00Z" }), camp(3, { seco: true })] })
    expect((await elegirCampana(s, CLI, null))?.id).toBe(id(1))
  })
  it("🔴 sin ninguna viva: la última que no es de ensayo, en cualquier estado (lo de antes: una campaña cerrada se sigue viendo)", async () => {
    const s = base({ cadena_campanas: [camp(1, { estado: "cerrada" }), camp(2, { estado: "reemplazada" }), camp(3, { estado: "cerrada", seco: true })] })
    expect((await elegirCampana(s, CLI, null))?.id).toBe(id(2))
  })
  it("🔴 nunca devuelve la de otro cliente", async () => {
    expect(await elegirCampana(base({ cadena_campanas: [camp(1, { client_id: OTRO })] }), CLI, id(1))).toBeNull()
  })
  it("una pedida que no tiene forma de campaña se ignora; las rutas la rechazan con esCampanaValida", async () => {
    expect((await elegirCampana(base({ cadena_campanas: [c1, c2] }), CLI, "no-es-uuid"))?.id).toBe(id(2))
    expect(esCampanaValida("no-es-uuid")).toBe(false)
    expect(esCampanaValida(id(1))).toBe(true)
    expect(esCampanaValida(null)).toBe(true)
  })
  it("sePuedeMostrar · sin campaña, no", () => {
    expect(sePuedeMostrar(null, CLI)).toBe(false)
    expect(sePuedeMostrar(c1, CLI)).toBe(true)
  })
  it("las columnas pedidas llegan (el pizarrón pide plan y fechas)", async () => {
    const r = await elegirCampana(base({ cadena_campanas: [camp(1, { plan_id: "p-1", fecha_inicio: "2026-11-20" })] }), CLI, id(1), "id, plan_id, estado, fecha_inicio, fecha_fin")
    expect(r).toMatchObject({ id: id(1), plan_id: "p-1", fecha_inicio: "2026-11-20" })
  })
})

const CLIENTE = { id: CLI, name: "Cliente de prueba", industry: "x", status: "active", archived_at: null }

describe("las pantallas leen la campaña elegida", () => {
  const tablas = () => ({
    clients: [CLIENTE] as Fila[],
    cadena_campanas: [camp(1), camp(2)],
    cadena_brief_creativo: [
      { id: "b1", campana_id: id(1), version: 1, estado: "aprobado", texto_md: "brief de la campaña 1", leido: true, seco: false, creada_en: "2026-11-11T00:00:00Z", encargo_id: null },
      { id: "b2", campana_id: id(2), version: 1, estado: "aprobado", texto_md: "brief de la campaña 2", leido: true, seco: false, creada_en: "2026-11-12T00:00:00Z", encargo_id: null },
    ] as Fila[],
    oficina_mesa_aportes: [] as Fila[],
    client_social_images: [] as Fila[],
    hitl_queue: [
      { id: id(7), client_id: CLI, type: "concepto_review", status: "pending", title: "Idea de la 1", created_at: "2026-11-11T00:00:00Z", metadata: { campana_id: id(1), version: 1 } },
      { id: id(8), client_id: CLI, type: "concepto_review", status: "pending", title: "Idea de la 2", created_at: "2026-11-12T00:00:00Z", metadata: { campana_id: id(2), version: 1 } },
      { id: id(9), client_id: CLI, type: "concepto_review", status: "pending", title: "Idea de antes", created_at: "2026-11-01T00:00:00Z", metadata: { version: 1 } },
    ] as Fila[],
    cadena_conceptos: [] as Fila[],
  })
  it("🔴 brief · con ?campana= la 1, el brief de la 1; sin pedirla, el de la viva más nueva (la 2)", async () => {
    const a = await leerBrief(base(tablas()), { cliente: CLI, campana: id(1) })
    expect(a.campana?.id).toBe(id(1))
    expect(a.briefs.map((b) => b.texto_md)).toEqual(["brief de la campaña 1"])
    const b = await leerBrief(base(tablas()), { cliente: CLI })
    expect(b.campana?.id).toBe(id(2))
    expect(b.briefs.map((x) => x.texto_md)).toEqual(["brief de la campaña 2"])
  })
  it("🔴 gran idea · las tarjetas de la campaña elegida, más las de antes que no dicen de cuál son; nunca las de otra campaña", async () => {
    const tipos = { ...tablas() }
    const g = await leerGranIdea(base(tipos), { cliente: CLI, campana: id(1) })
    expect(g.campana?.id).toBe(id(1))
    expect(g.tarjetas.map((t) => t.titulo).sort()).toEqual(["Idea de antes", "Idea de la 1"])
    const h = await leerGranIdea(base(tablas()), { cliente: CLI, campana: id(2) })
    expect(h.tarjetas.map((t) => t.titulo).sort()).toEqual(["Idea de antes", "Idea de la 2"])
  })
  it("esDeLaCampana · sin campaña elegida, todas; sin campaña en la tarjeta, sí; otra campaña, no", () => {
    expect(esDeLaCampana({ metadata: { campana_id: "x" } }, null)).toBe(true)
    expect(esDeLaCampana({ metadata: {} }, "a")).toBe(true)
    expect(esDeLaCampana({ metadata: null }, "a")).toBe(true)
    expect(esDeLaCampana({ metadata: { campana_id: "a" } }, "a")).toBe(true)
    expect(esDeLaCampana({ metadata: { campana_id: "b" } }, "a")).toBe(false)
  })
})

describe("el pizarrón (calendario) y el Centro leen la campaña elegida", () => {
  const conPlan = () => ({
    clients: [CLIENTE] as Fila[],
    cadena_campanas: [camp(1, { estado: "pausada", plan_id: "p-1", fecha_inicio: "2026-11-02", fecha_fin: "2027-01-30" }), camp(2, { plan_id: "p-1", fecha_inicio: "2026-12-01", fecha_fin: "2027-02-28" })],
    cadena_brief_creativo: [
      { id: "b1", campana_id: id(1), version: 1, estado: "aprobado", texto_md: "uno", leido: true, seco: false, creada_en: "2026-11-11T00:00:00Z", encargo_id: null },
      { id: "b2", campana_id: id(2), version: 1, estado: "aprobado", texto_md: "dos", leido: true, seco: false, creada_en: "2026-11-12T00:00:00Z", encargo_id: null },
      { id: "b3", campana_id: id(2), version: 2, estado: "aprobado", texto_md: "dos bis", leido: true, seco: false, creada_en: "2026-11-13T00:00:00Z", encargo_id: null },
    ] as Fila[],
    hitl_queue: [
      { id: id(7), client_id: CLI, type: "concepto_review", status: "pending", title: "Idea de la 1", created_at: "2026-11-11T00:00:00Z", metadata: { campana_id: id(1), version: 1 } },
      { id: id(6), client_id: CLI, type: "concepto_review", status: "pending", title: "Otra de la 1", created_at: "2026-11-10T00:00:00Z", metadata: { campana_id: id(1), version: 2 } },
      { id: id(8), client_id: CLI, type: "concepto_review", status: "pending", title: "Idea de la 2", created_at: "2026-11-12T00:00:00Z", metadata: { campana_id: id(2), version: 1 } },
    ] as Fila[],
  })
  it("🔴 pizarrón · con ?campana= la 1: esa campaña, con su plan y sus fechas; sin pedirla, la viva más nueva (la 2)", async () => {
    const a = await leerPizarron(base(conPlan()), { cliente: CLI, campana: id(1), ahora: new Date("2026-11-19T12:00:00Z") })
    expect(a.campana).toMatchObject({ id: id(1), desde: "2026-11-02", hasta: "2027-01-30" })
    const b = await leerPizarron(base(conPlan()), { cliente: CLI, ahora: new Date("2026-11-19T12:00:00Z") })
    expect(b.campana).toMatchObject({ id: id(2), desde: "2026-12-01" })
  })
  it("🔴 Centro · ?campana= llega al brief y a la gran idea (las versiones son las de esa campaña)", async () => {
    const riesgos = (async () => ({ ok: false })) as never
    const a = await leerCentro(base(conPlan()), { cliente: CLI, campana: id(1), riesgos, ahora: new Date("2026-11-19T12:00:00Z") })
    expect(a.brief.versiones).toBe(1)
    expect(a.gran_idea.versiones).toBe(2)
    const b = await leerCentro(base(conPlan()), { cliente: CLI, campana: id(2), riesgos, ahora: new Date("2026-11-19T12:00:00Z") })
    expect(b.brief.versiones).toBe(2)
    expect(b.gran_idea.versiones).toBe(1)
  })
})
