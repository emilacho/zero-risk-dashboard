/** LOS PANELES ABREN EN EL CLIENTE CORRECTO (CC6 · 02-nov · CORRECCIÓN URGENTE de Lenovo, aprobada por Emilio: el pedido de cambios salió a Zero Risk SI). US$ 0 · sin red. */
import { afterEach, describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { clienteRecordadoEn, guardarClienteDeTrabajo, leerClienteDeTrabajo } from "@/lib/cliente-de-trabajo"
import { leerPizarron } from "@/lib/pizarron-datos"
import { leerPlanDelCliente } from "@/lib/plan-datos"
import { readFileSync } from "node:fs"
import { PedirCambiosAlManual } from "@/components/nuevo/manual/PedirCambiosAlManual"
import { PanelPizarron } from "@/components/nuevo/PanelPizarron"
import { faseActiva } from "@/lib/pizarron"

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", ZR = "df7e47cc-bec4-4fa2-bc24-ff97ba5213a5"
const base = (tablas: Record<string, Array<Record<string, unknown>>>) => ({ from: (t: string) => {
  let d = [...(tablas[t] ?? [])]
  const q: Record<string, unknown> = {}
  for (const m of ["select", "limit", "like", "gte", "neq", "not", "is"]) q[m] = () => q
  q.eq = (c: string, v: unknown) => { d = d.filter((f) => f[c] === v); return q }
  q.in = (c: string, v: unknown[]) => { d = d.filter((f) => v.includes(f[c])); return q }
  q.order = (c: string, o?: { ascending?: boolean }) => { d = [...d].sort((a, b) => (String(a[c]) < String(b[c]) ? -1 : 1) * (o?.ascending === false ? -1 : 1)); return q }
  q.maybeSingle = () => Promise.resolve({ data: d[0] ?? null, error: null })
  q.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: d, error: null }).then(ok)
  return q
} }) as never
const clientes = [{ id: ZR, name: "Zero Risk Seguridad Industrial", industry: "seguridad", status: "active", archived_at: null }, { id: NAUFRAGO, name: "Náufrago", industry: "restaurante", status: "active", archived_at: null }]

describe("el cliente por omisión (sin cliente pedido)", () => {
  it("el caso de hoy: Náufrago con su campaña archivada y el plan más reciente; Zero Risk SI con una campaña en pausa → abre en Náufrago", async () => {
    const p = await leerPizarron(base({
      clients: clientes,
      cadena_campanas: [{ id: "c-zr", client_id: ZR, estado: "pausada", seco: false, creada_en: "2026-10-20" }, { id: "c-n", client_id: NAUFRAGO, estado: "reemplazada", seco: false, creada_en: "2026-10-30" }],
      client_historical_outputs: [{ client_id: NAUFRAGO, status: "draft", created_at: "2026-11-01T19:49:20Z", output_type: "campaign_plan_90d" }, { client_id: ZR, status: "draft", created_at: "2026-10-20T20:11:31Z", output_type: "campaign_plan_90d" }],
    }), { ahora: new Date("2026-11-02T19:00:00Z") })
    expect(p.cliente?.id).toBe(NAUFRAGO)
  })
  it("una campaña EN MARCHA manda sobre el plan reciente; con cliente pedido, ese", async () => {
    const t = { clients: clientes, cadena_campanas: [{ id: "c-zr", client_id: ZR, estado: "activa", seco: false, creada_en: "2026-10-20" }], client_historical_outputs: [{ client_id: NAUFRAGO, status: "draft", created_at: "2026-11-01", output_type: "campaign_plan_90d" }] }
    expect((await leerPizarron(base(t), { ahora: new Date("2026-11-02T19:00:00Z") })).cliente?.id).toBe(ZR)
    expect((await leerPizarron(base(t), { cliente: NAUFRAGO, ahora: new Date("2026-11-02T19:00:00Z") })).cliente?.id).toBe(NAUFRAGO)
  })
})

describe("el cliente por omisión · reservas R1-R3 de CC3 (#205)", () => {
  const T = { ahora: new Date("2026-11-02T19:00:00Z") }
  const plan = (client_id: string, created_at: string, status = "draft") => ({ client_id, status, created_at, output_type: "campaign_plan_90d" })
  it("R1 · un plan RECHAZADO no cuenta como el más reciente", async () => {
    const p = await leerPizarron(base({ clients: clientes, cadena_campanas: [], client_historical_outputs: [plan(ZR, "2026-11-02T10:00:00Z", "rejected"), plan(NAUFRAGO, "2026-11-01T10:00:00Z")] }), T)
    expect(p.cliente?.id).toBe(NAUFRAGO)
  })
  it("R2 · manda el plan MÁS RECIENTE, no el más antiguo", async () => {
    const p = await leerPizarron(base({ clients: clientes, cadena_campanas: [], client_historical_outputs: [plan(ZR, "2026-10-01T10:00:00Z"), plan(NAUFRAGO, "2026-11-01T10:00:00Z")] }), T)
    expect(p.cliente?.id).toBe(NAUFRAGO)
  })
  it("R3 · sin campaña en marcha ni plan, la campaña en pausa manda antes que «el primero»", async () => {
    const p = await leerPizarron(base({ clients: clientes, cadena_campanas: [{ id: "c-zr", client_id: ZR, estado: "pausada", seco: false, creada_en: "2026-10-30" }], client_historical_outputs: [] }), T)
    expect(p.clientes[0].id).toBe(NAUFRAGO) // la lista va por nombre: Náufrago es «el primero»…
    expect(p.cliente?.id).toBe(ZR) // …pero manda la campaña en pausa de Zero Risk SI
  })
})

describe("el cliente recordado (este navegador)", () => {
  const g = globalThis as unknown as { window?: unknown }
  afterEach(() => { delete g.window })
  it("guarda y lee el último elegido; sin almacenamiento no rompe nada", () => {
    const mem = new Map<string, string>()
    g.window = { localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) } }
    expect(leerClienteDeTrabajo()).toBeNull()
    guardarClienteDeTrabajo({ id: NAUFRAGO, nombre: "Náufrago" }); expect(leerClienteDeTrabajo()).toEqual({ id: NAUFRAGO, nombre: "Náufrago" })
    g.window = { localStorage: { getItem: () => { throw new Error("bloqueado") }, setItem: () => { throw new Error("bloqueado") } } }
    expect(leerClienteDeTrabajo()).toBeNull(); expect(() => guardarClienteDeTrabajo({ id: ZR })).not.toThrow()
  })
  it("de la lista, el recordado: por id, o por nombre (lo elegido en «Seleccionar cliente» de arriba)", () => {
    const lista = [{ id: ZR, nombre: "Zero Risk Seguridad Industrial" }, { id: NAUFRAGO, nombre: "Náufrago" }]
    expect(clienteRecordadoEn(lista, { id: NAUFRAGO, nombre: null })).toBe(NAUFRAGO)
    expect(clienteRecordadoEn(lista, { id: null, nombre: "náufrago" })).toBe(NAUFRAGO)
    expect(clienteRecordadoEn(lista, { id: "otro", nombre: null })).toBeNull(); expect(clienteRecordadoEn(lista, null)).toBeNull()
  })
})

describe("el cliente a la vista", () => {
  it("la cabecera del panel dice el cliente, grande, junto al título", () => {
    const h = renderToStaticMarkup(createElement(PanelPizarron, { onCerrar: () => {}, datosIniciales: { clientes: [{ id: NAUFRAGO, nombre: "Náufrago", con_campana: true }], cliente: { id: NAUFRAGO, nombre: "Náufrago" }, campana: null, fases: [], fase_activa: faseActiva([], null, "2026-11-02"), gran_idea: { texto: null, nota: "x" }, esperas: [], filas: [], semanas: [], totales: {}, hoy: "2026-11-02", leido_en: "x" } }))
    expect(h).toMatch(/id="pizarron-titulo"[^>]*>Calendario<\/h2><span data-cliente-cabecera[^>]*>Náufrago<\/span>/)
  })
  it("«Pedir cambios al manual» dice para qué cliente, antes de enviar", () => {
    const h = renderToStaticMarkup(createElement(PedirCambiosAlManual, { cliente: NAUFRAGO, clienteNombre: "Náufrago", ciclo: { disponible: true, abierto: null, avance: null, que_cambio: [] }, accion: async () => ({ ok: true, texto: "", detalle: {} }) as never, validadosDelManual: [], onResultado: () => {} }))
    expect(h).toContain(">Pedir cambios al manual de Náufrago</button>")
  })
})

describe("la escena de marketing sigue al mismo cliente (corrección de Lenovo 20:05Z)", () => {
  it("la línea de la escena sale del plan del cliente: con los datos de hoy, Náufrago (no Zero Risk SI)", async () => {
    const p = await leerPlanDelCliente(base({
      clients: clientes,
      cadena_campanas: [{ id: "c-zr", client_id: ZR, estado: "pausada", seco: false, creada_en: "2026-10-20" }, { id: "c-n", client_id: NAUFRAGO, estado: "reemplazada", seco: false, creada_en: "2026-10-30" }],
      client_historical_outputs: [{ client_id: NAUFRAGO, status: "draft", created_at: "2026-11-01T19:49:20Z", output_type: "campaign_plan_90d" }, { client_id: ZR, status: "draft", created_at: "2026-10-20T20:11:31Z", output_type: "campaign_plan_90d" }],
    }), { ahora: new Date("2026-11-02T20:00:00Z") })
    expect(p.cliente?.id).toBe(NAUFRAGO)
  })
  it("el navegador manda el cliente de trabajo a la escena; la ruta solo acepta un id válido; el plan, las métricas y la vitrina de la escena usan ese cliente", () => {
    expect(readFileSync("components/nuevo/escena/Avatares.tsx", "utf8")).toMatch(/leerClienteDeTrabajo\(\)\?\.id[\s\S]{0,120}\/api\/escena-viva\$\{id \? `\?cliente=/)
    const ruta = readFileSync("app/api/escena-viva/route.ts", "utf8")
    expect(ruta).toContain('searchParams.get("cliente")'); expect(ruta).toContain("UUID.test(pedido)")
    const datos = readFileSync("lib/escena-avatares-datos.ts", "utf8")
    expect(datos).toContain("contexto(supa, ahora, cliente)"); expect(datos).toContain("leerElPizarronDeMetricas(supa, ahora, cliente)"); expect(datos).toContain("leerLaVitrinaDeMarketing(supa, ahora, cliente)")
    expect(datos).not.toContain('conCache("escena-viva-contexto"') // la memoria es por cliente
  })
})
