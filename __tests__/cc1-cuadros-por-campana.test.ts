/**
 * VARIAS CAMPAÑAS · parte C (ajuste de Emilio 22:07 Zúrich · GO de Lenovo a CC1): Piezas, Equipo y Dinero del Centro por la campaña elegida.
 * Lecturas: `lib/campana-datos.ts` · la bandeja con `?campana=` · `/api/centro?campana=` suma `de_la_campana`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

type Fila = Record<string, unknown>
const leerCampo = (f: Fila, k: string): unknown => (k.includes("->>") ? ((f[k.split("->>")[0]] ?? {}) as Fila)[k.split("->>")[1]] : f[k])

/** una base de juguete que SÍ filtra (eq · is · in · gte · not in), limita y registra; `sinColumnas` = la base todavía sin las columnas nuevas */
function base(tablas: Record<string, Fila[]>, o: { sinColumnas?: Record<string, string[]> } = {}) {
  const pedidos: Array<{ tabla: string; select: string; filtros: string[] }> = []
  const supabase = {
    from(tabla: string) {
      let sel = (tablas[tabla] ?? []).map((f) => ({ ...f }))
      const p = { tabla, select: "", filtros: [] as string[] }
      pedidos.push(p)
      let fallo: { message: string } | null = null
      const usa = (k: string) => { for (const c of o.sinColumnas?.[tabla] ?? []) if (k === c || k.startsWith(`${c} `) || k.includes(c)) fallo = { message: `column ${tabla}.${c} does not exist` } }
      const q: Record<string, unknown> = {
        select: (c: string) => { p.select = c; for (const x of c.split(",").map((s) => s.trim())) usa(x); return q },
        eq: (k: string, v: unknown) => { p.filtros.push(`${k}=${String(v)}`); usa(k); sel = sel.filter((f) => leerCampo(f, k) === v); return q },
        is: (k: string, v: unknown) => { p.filtros.push(`${k} is ${String(v)}`); usa(k); sel = sel.filter((f) => (leerCampo(f, k) ?? null) === v); return q },
        in: (k: string, vs: unknown[]) => { p.filtros.push(`${k} in ${vs.length}`); usa(k); sel = sel.filter((f) => vs.includes(leerCampo(f, k))); return q },
        gte: (k: string, v: string) => { p.filtros.push(`${k}>=${v}`); sel = sel.filter((f) => String(leerCampo(f, k) ?? "") >= v); return q },
        not: (k: string, op: string) => { p.filtros.push(`${k} not ${op}`); if (op === "is") sel = sel.filter((f) => leerCampo(f, k) != null); return q },
        neq: (k: string, v: unknown) => { sel = sel.filter((f) => leerCampo(f, k) !== v); return q },
        order: () => q, limit: () => q,
        maybeSingle: async () => ({ data: fallo ? null : sel[0] ?? null, error: fallo }),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve({ data: fallo ? null : sel, error: fallo }).then(res, rej),
      }
      return q
    },
  }
  return { supabase: supabase as never, pedidos }
}

const CLI = "11111111-0000-4000-8000-000000000001"
const OTRO = "22222222-0000-4000-8000-000000000002"
const VIEJA = "aaaaaaaa-0000-4000-8000-000000000001" // la de siempre (sin llave), nació el 01-nov
const NUEVA = "bbbbbbbb-0000-4000-8000-000000000002" // con llave, nació el 19-nov
const ENSAYO = "cccccccc-0000-4000-8000-000000000003"
const campanas = (): Fila[] => [
  { id: VIEJA, client_id: CLI, seco: false, creada_en: "2026-11-01T00:00:00Z", llave_de_campana: null },
  { id: NUEVA, client_id: CLI, seco: false, creada_en: "2026-11-19T20:00:00Z", llave_de_campana: "prueba-conjunta" },
  { id: ENSAYO, client_id: CLI, seco: true, creada_en: "2026-11-19T21:00:00Z", llave_de_campana: null },
]
const enc = (id: string, extra: Fila): Fila => ({ id, client_id: CLI, dry_run: false, gasto_usd: 1, campana_id: null, creado_en: "2026-11-10T00:00:00Z", ...extra })
const encargos = (): Fila[] => [
  enc("e-nueva-1", { campana_id: NUEVA, gasto_usd: 0.5, creado_en: "2026-11-19T21:00:00Z" }),
  enc("e-nueva-2", { campana_id: NUEVA, gasto_usd: 0.25, creado_en: "2026-11-19T21:10:00Z" }),
  enc("e-nueva-ensayo", { campana_id: NUEVA, dry_run: true, gasto_usd: 9 }),
  enc("e-vieja-explicita", { campana_id: VIEJA, gasto_usd: 2 }),
  enc("e-sin-campana-desde", { gasto_usd: 3, creado_en: "2026-11-05T00:00:00Z" }),
  enc("e-sin-campana-antes", { gasto_usd: 100, creado_en: "2026-10-20T00:00:00Z" }),
  enc("e-otro-cliente", { client_id: OTRO, campana_id: null, gasto_usd: 50, creado_en: "2026-11-05T00:00:00Z" }),
]
const corridas = (): Fila[] => [
  { campana_id: NUEVA, seco: false, costo_usd: 0.1 }, { campana_id: NUEVA, seco: false, costo_usd: 0.05 }, { campana_id: NUEVA, seco: true, costo_usd: 7 },
  { campana_id: VIEJA, seco: false, costo_usd: 4 },
]

describe("lo de una campaña: sus encargos y lo gastado", async () => {
  const { loDeLaCampana } = await import("@/lib/campana-datos")
  it("🔴 una campaña con llave: SOLO sus encargos reales; lo gastado = su planificación real + sus piezas", async () => {
    const { supabase } = base({ cadena_campanas: campanas(), oficina_encargos: encargos(), cadena_corridas: corridas() })
    const lo = await loDeLaCampana(supabase, NUEVA)
    expect(lo?.encargos.sort()).toEqual(["e-nueva-1", "e-nueva-2"])
    expect(lo?.gastado_usd).toBe(0.9) // 0.1 + 0.05 + 0.5 + 0.25 (sin el ensayo de 9 ni la corrida seca de 7)
    expect(lo?.client_id).toBe(CLI)
  })
  it("🔴 la de siempre (sin llave): las suyas + las del cliente SIN campaña desde que nació (nunca las de antes ni las de otro cliente)", async () => {
    const { supabase } = base({ cadena_campanas: campanas(), oficina_encargos: encargos(), cadena_corridas: corridas() })
    const lo = await loDeLaCampana(supabase, VIEJA)
    expect(lo?.encargos.sort()).toEqual(["e-sin-campana-desde", "e-vieja-explicita"])
    expect(lo?.gastado_usd).toBe(9) // 4 + 2 + 3
  })
  it("🔴 una campaña con llave nunca se queda con los encargos sin campaña", async () => {
    const { supabase } = base({ cadena_campanas: campanas(), oficina_encargos: [...encargos(), enc("e-sin-campana-reciente", { creado_en: "2026-11-19T22:00:00Z" })], cadena_corridas: corridas() })
    expect((await loDeLaCampana(supabase, NUEVA))?.encargos).not.toContain("e-sin-campana-reciente")
    expect((await loDeLaCampana(supabase, VIEJA))?.encargos).toContain("e-sin-campana-reciente")
  })
  it("🔴 una campaña que no existe o es de ensayo: null", async () => {
    const { supabase } = base({ cadena_campanas: campanas(), oficina_encargos: encargos(), cadena_corridas: corridas() })
    expect(await loDeLaCampana(supabase, ENSAYO)).toBeNull()
    expect(await loDeLaCampana(supabase, "dddddddd-0000-4000-8000-000000000004")).toBeNull()
  })
  it("🔴 la base todavía sin las columnas nuevas: se lee como antes (todo lo del cliente desde que nació la campaña), sin caerse", async () => {
    const sinLlave = campanas().map(({ llave_de_campana: _l, ...c }) => c)
    const sinCampana = encargos().map(({ campana_id: _c, ...e }) => e)
    const { supabase } = base({ cadena_campanas: sinLlave, oficina_encargos: sinCampana, cadena_corridas: corridas() }, { sinColumnas: { cadena_campanas: ['llave_de_campana'], oficina_encargos: ['campana_id'] } })
    const vieja = await loDeLaCampana(supabase, VIEJA)
    expect(vieja?.encargos.sort()).toEqual(['e-nueva-1', 'e-nueva-2', 'e-sin-campana-desde', 'e-vieja-explicita'])
    expect(vieja?.gastado_usd).toBe(9.75) // 4 de su planificación + 0.5 + 0.25 + 2 + 3 (sin el ensayo, sin lo de antes, sin el otro cliente)
  })
  it("🔴 otro error de la base NO se tapa: lanza", async () => {
    const roto = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "caída" } }) }) }) }) }) }
    await expect(loDeLaCampana(roto as never, NUEVA)).rejects.toThrow(/caída/)
  })
})

describe("quiénes trabajan ahora en la campaña", async () => {
  const { trabajandoEnLaCampana } = await import("@/lib/campana-datos")
  const AHORA = new Date("2026-11-19T22:00:00Z")
  const inv = (agent_name: string, trabajo_id: string, extra: Fila = {}): Fila => ({ agent_name, trabajo_id, client_id: CLI, ended_at: null, started_at: "2026-11-19T21:55:00Z", ...extra })
  it("🔴 los empleados con una corrida ABIERTA y reciente sobre un encargo de la campaña, sin repetir", async () => {
    const { supabase } = base({ agent_invocations: [
      inv("content-creator", "e-nueva-1"), inv("content-creator", "e-nueva-2"), inv("whimsy-injector", "e-nueva-2"),
      inv("ya-termino", "e-nueva-1", { ended_at: "2026-11-19T21:58:00Z" }),
      inv("muy-vieja", "e-nueva-1", { started_at: "2026-11-19T20:00:00Z" }),
      inv("otra-campana", "e-vieja-explicita"),
    ] })
    expect(await trabajandoEnLaCampana(supabase, { campana_id: NUEVA, client_id: CLI, encargos: ["e-nueva-1", "e-nueva-2"], gastado_usd: 0 }, AHORA)).toEqual(["content-creator", "whimsy-injector"])
  })
  it("🔴 una campaña sin encargos: nadie, sin preguntarle a la base", async () => {
    const { supabase, pedidos } = base({})
    expect(await trabajandoEnLaCampana(supabase, { campana_id: NUEVA, client_id: CLI, encargos: [], gastado_usd: 0 }, AHORA)).toEqual([])
    expect(pedidos).toEqual([])
  })
})

describe("la bandeja de piezas por campaña", async () => {
  const { listarPiezas } = await import("@/lib/piezas-datos")
  const { TIPO_PIEZA } = await import("@/lib/piezas")
  const pieza = (id: string, encargo: string | null): Fila => ({ id, status: "pending", type: TIPO_PIEZA, client_id: CLI, created_at: "2026-11-19T21:00:00Z", title: "Post Instagram", metadata: encargo ? { oficina_encargo_id: encargo } : {}, archivada_en: null, decision: null })
  it("🔴 con encargos: solo las piezas de esos encargos · con lista vacía: ninguna, sin preguntarle a la base · sin filtro: todas, como siempre", async () => {
    const tablas = { hitl_queue: [pieza("p1", "e-nueva-1"), pieza("p2", "e-vieja-explicita"), pieza("p3", null)], clients: [{ id: CLI, name: "Náufrago", industry: "restaurante" }] }
    const con = base(tablas)
    expect((await listarPiezas(con.supabase, { tipo: "piezas", encargos: ["e-nueva-1"] })).map((f) => f.id)).toEqual(["p1"])
    const vacia = base(tablas)
    expect(await listarPiezas(vacia.supabase, { tipo: "piezas", encargos: [] })).toEqual([])
    expect(vacia.pedidos.filter((p) => p.tabla === "hitl_queue")).toEqual([])
    expect((await listarPiezas(base(tablas).supabase, { tipo: "piezas" })).map((f) => f.id).sort()).toEqual(["p1", "p2", "p3"])
  })
})

describe("leerBandeja con campaña", () => {
  beforeEach(() => { vi.resetModules() })
  it("🔴 filtra piezas, archivo y lo que está en curso por los encargos de la campaña; las «otras» (plan, competidores) siguen siendo de todos", async () => {
    const llamadas: Array<Record<string, unknown>> = []
    vi.doMock("@/lib/piezas-datos", () => ({
      listarPiezas: async (_s: unknown, f: Record<string, unknown>) => { llamadas.push(f); return [] },
      contarPiezasPorAprobar: async () => 0,
      listarEnCurso: async () => [{ encargo_id: "e-nueva-1", cliente_id: CLI }, { encargo_id: "e-vieja-explicita", cliente_id: CLI }],
    }))
    vi.doMock("@/lib/clientes-datos", () => ({ clientesParaElegir: async () => [{ id: CLI, nombre: "Náufrago" }] }))
    vi.doMock("@/lib/campana-datos", () => ({ loDeLaCampana: async (_s: unknown, id: string) => (id === NUEVA ? { campana_id: NUEVA, client_id: CLI, encargos: ["e-nueva-1"], gastado_usd: 0 } : null) }))
    const { leerBandeja } = await import("@/lib/bandeja-datos")
    const b = await leerBandeja({} as never, { estado: "todas", campana: NUEVA })
    const porTipo = (t: string, archivo?: string) => llamadas.find((x) => x.tipo === t && x.archivo === archivo)
    expect(porTipo("piezas")?.encargos).toEqual(["e-nueva-1"])
    expect(porTipo("piezas", "solo")?.encargos).toEqual(["e-nueva-1"])
    expect(porTipo("otras")?.encargos).toBeUndefined()
    expect(b.en_curso?.map((e) => e.encargo_id)).toEqual(["e-nueva-1"])
    expect(b.campana).toBe(NUEVA)
    llamadas.length = 0
    const nada = await leerBandeja({} as never, { estado: "todas", campana: "dddddddd-0000-4000-8000-000000000004" })
    expect(porTipo("piezas")?.encargos).toEqual([]) // una campaña que no existe: bandeja de piezas vacía, nunca la de otra
    expect(nada.en_curso).toEqual([])
    llamadas.length = 0
    const todas = await leerBandeja({} as never, { estado: "todas" })
    expect(porTipo("piezas")?.encargos).toBeUndefined()
    expect(todas.en_curso).toHaveLength(2)
    expect("campana" in todas).toBe(false)
    vi.doUnmock("@/lib/piezas-datos"); vi.doUnmock("@/lib/clientes-datos"); vi.doUnmock("@/lib/campana-datos")
  })
})

describe("las rutas", () => {
  beforeEach(() => { vi.resetModules() })
  const pedidasALaRegla: Array<string | null | undefined> = []
  const preparar = (lo: unknown, o: { clienteDelCentro?: string | null; elegida?: string | null } = {}) => {
    pedidasALaRegla.length = 0
    vi.doMock("@/lib/admin-guard", () => ({ exigirAdmin: async () => ({ ok: true, email: "emilio" }) }))
    vi.doMock("@/lib/supabase-server", () => ({ getServiceRoleClient: () => ({}) }))
    vi.doMock("@/lib/centro-datos", () => ({ leerCentro: async () => ({ cliente: o.clienteDelCentro === undefined ? CLI : o.clienteDelCentro, equipo: { trabajando: 5 } }) }))
    // la regla común de CC3: aquí devuelve la pedida o, sin pedir, la «primera viva» (VIEJA)
    vi.doMock("@/lib/campana-elegida", () => ({ elegirCampana: async (_s: unknown, _c: string, pedida: string | null) => { pedidasALaRegla.push(pedida); const id = o.elegida === undefined ? pedida ?? VIEJA : o.elegida; return id ? { id, estado: "activa" } : null } }))
    vi.doMock("@/lib/campana-datos", () => ({ loDeLaCampana: async (_s: unknown, id: string) => (lo && typeof lo === "object" ? { ...(lo as object), campana_id: id } : lo), trabajandoEnLaCampana: async () => ["content-creator"] }))
    vi.doMock("@/lib/bandeja-datos", () => ({ leerBandeja: async (_s: unknown, o2: unknown) => ({ o: o2 }) }))
  }
  const LO = { client_id: CLI, encargos: ["e-nueva-1"], gastado_usd: 0.9 }
  it("🔴 /api/centro suma `de_la_campana` de la campaña que eligió la regla común (la pedida) y deja igual lo demás", async () => {
    preparar(LO)
    const { GET } = await import("@/app/api/centro/route")
    const r = await (await GET(new Request(`http://x/api/centro?cliente=${CLI}&campana=${NUEVA}`))).json()
    expect(r).toEqual({ ok: true, cliente: CLI, equipo: { trabajando: 5 }, de_la_campana: { campana_id: NUEVA, gastado_usd: 0.9, trabajando: ["content-creator"] } })
    expect(pedidasALaRegla).toEqual([NUEVA])
  })
  it("🔴 sin pedir campaña: la de la regla (la primera viva), la misma que muestran el brief, la gran idea y el calendario", async () => {
    preparar(LO)
    const { GET } = await import("@/app/api/centro/route")
    const r = await (await GET(new Request(`http://x/api/centro?cliente=${CLI}`))).json()
    expect(r.de_la_campana).toEqual({ campana_id: VIEJA, gastado_usd: 0.9, trabajando: ["content-creator"] })
    expect(pedidasALaRegla).toEqual([null])
  })
  it("🔴 null si: no hay cliente, la regla no encuentra campaña, la campaña no existe o es de OTRO cliente (nunca se mezclan)", async () => {
    const casos: Array<[string, unknown, { clienteDelCentro?: string | null; elegida?: string | null }]> = [
      ["sin cliente", LO, { clienteDelCentro: null }], ["sin campaña", LO, { elegida: null }], ["no existe", null, {}], ["otro cliente", { ...LO, client_id: OTRO }, {}],
    ]
    for (const [nombre, lo, o] of casos) {
      vi.resetModules(); preparar(lo, o)
      const { GET } = await import("@/app/api/centro/route")
      const r = await (await GET(new Request(`http://x/api/centro?cliente=${CLI}`))).json()
      expect(r.de_la_campana, nombre).toBeNull()
      expect(r.equipo, nombre).toEqual({ trabajando: 5 })
    }
  })
  it("🔴 una campaña mal escrita: 400 en /api/centro y en /api/bandeja; bien escrita, la bandeja la recibe", async () => {
    preparar(LO)
    const centro = await import("@/app/api/centro/route")
    const bandeja = await import("@/app/api/bandeja/route")
    for (const mala of ["nada", "1; drop", "aaaaaaaa-0000"]) {
      expect((await centro.GET(new Request(`http://x/api/centro?campana=${encodeURIComponent(mala)}`))).status).toBe(400)
      expect((await bandeja.GET(new Request(`http://x/api/bandeja?campana=${encodeURIComponent(mala)}`))).status).toBe(400)
    }
    expect((await (await bandeja.GET(new Request(`http://x/api/bandeja?estado=todas&campana=${NUEVA}`))).json()).o).toEqual({ estado: "todas", campana: NUEVA })
    expect((await (await bandeja.GET(new Request("http://x/api/bandeja"))).json()).o).toEqual({ estado: "pendiente" })
  })
})
