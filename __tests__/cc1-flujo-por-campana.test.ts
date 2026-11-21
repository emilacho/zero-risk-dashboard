/**
 * VARIAS CAMPAÑAS (GO de Lenovo a CC1 · pedido 20:46Z · botón aprobado por Emilio 21:45 Zúrich: 3 lugares, uno por campaña, con su nombre)
 * `/api/flujo` SUMA `campanas: [{ campana_id, nombre, flujo }]` (las vivas del cliente, de la más vieja a la más nueva) y deja igual
 * `campana_id` + `flujo` (el botón de hoy los lee).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { campanasVivas, ESTADOS_MUERTOS, PREFIJO_DE_PAUSA_DEL_TABLERO } from "@/lib/flujo-de-campana"
import { nombreGenericoDelPlan, NOMBRE_GENERICO_SIN_PLAN } from "@/lib/nombre-generico-del-plan"

const CLIENTE = "11111111-2222-3333-4444-555555555555"
const OTRO_CLIENTE = "99999999-2222-3333-4444-555555555555"
const PAUSA = `${PREFIJO_DE_PAUSA_DEL_TABLERO} · vuelve a: activa · en la semana 4 del calendario`

type Fila = Record<string, unknown>
/** una base de juguete que SÍ filtra (eq · not in · is null · in), ordena y limita; `sinColumna` = la base aún sin `nombre_de_campana`
 *  21-nov · `planes` = las filas de `client_historical_outputs` (el plan de cada campaña) · `errorPlanes` = esa lectura falla */
function baseConFilas(filas: Fila[], opc: { sinColumna?: boolean; error?: string; planes?: Fila[]; errorPlanes?: string } = {}) {
  const pedidos: string[] = []
  const supabase = {
    from(tabla: string) {
      const deLosPlanes = tabla === "client_historical_outputs"
      let sel = (deLosPlanes ? opc.planes ?? [] : filas).map((f) => ({ ...f }))
      let columnas = ""
      let fallo: { message: string } | null = null
      const q: Record<string, unknown> = {
        select: (c: string) => {
          columnas = c; pedidos.push(`${tabla}:${c}`)
          if (deLosPlanes) { if (opc.errorPlanes) fallo = { message: opc.errorPlanes } }
          else if (opc.error) fallo = { message: opc.error }
          else if (opc.sinColumna && c.includes("nombre_de_campana")) fallo = { message: "column cadena_campanas.nombre_de_campana does not exist" }
          return q
        },
        eq: (k: string, v: unknown) => { sel = sel.filter((f) => f[k] === v); return q },
        in: (k: string, lista: unknown[]) => { sel = sel.filter((f) => lista.includes(f[k])); return q },
        not: (k: string, op: string, lista: string) => {
          expect(op).toBe("in")
          const fuera = lista.replace(/[()]/g, "").split(",")
          sel = sel.filter((f) => !fuera.includes(String(f[k]))); return q
        },
        is: (k: string, v: unknown) => { expect(v).toBeNull(); sel = sel.filter((f) => f[k] === null || f[k] === undefined); return q },
        order: (k: string, o: { ascending: boolean }) => { sel.sort((a, b) => (String(a[k]) < String(b[k]) ? -1 : 1) * (o.ascending ? 1 : -1)); return q },
        limit: (n: number) => { sel = sel.slice(0, n); return q },
        maybeSingle: async () => ({ data: fallo ? null : sel[0] ?? null, error: fallo }),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
          const cols = columnas.split(",").map((x) => x.trim())
          const data = fallo ? null : sel.map((f) => Object.fromEntries(cols.map((k) => [k, f[k] ?? null])))
          return Promise.resolve({ data, error: fallo }).then(res, rej)
        },
      }
      return q
    },
  }
  return { supabase: supabase as never, pedidos }
}

const A = "aaaaaaaa-0000-0000-0000-000000000001"
const B = "bbbbbbbb-0000-0000-0000-000000000002"
const C = "cccccccc-0000-0000-0000-000000000003"
const fila = (id: string, extra: Fila): Fila => ({ id, client_id: CLIENTE, seco: false, archivada_en: null, estado_motivo: null, nombre_de_campana: null, ...extra })

describe("las campañas vivas del cliente, cada una con su nombre y su botón", () => {
  it("🔴 de la más vieja a la más nueva, con nombre y color propios", async () => {
    const { supabase } = baseConFilas([
      fila(C, { creada_en: "2026-11-19T03:00:00Z", estado: "necesita_humano", estado_motivo: "presupuesto de planificación se agotó (x)", nombre_de_campana: "Lanzamiento del ceviche" }),
      fila(A, { creada_en: "2026-11-19T01:00:00Z", estado: "activa", nombre_de_campana: "  Impulso del encebollado  " }),
      fila(B, { creada_en: "2026-11-19T02:00:00Z", estado: "pausada", estado_motivo: PAUSA, nombre_de_campana: "Firmas para la playa" }),
    ])
    expect(await campanasVivas(supabase, CLIENTE)).toEqual([
      { campana_id: A, nombre: "Impulso del encebollado", flujo: { color: "verde", linea: "EN MARCHA", estado: "activa" } },
      { campana_id: B, nombre: "Firmas para la playa", flujo: { color: "dorado", linea: "PARADO POR TI · en la semana 4 del calendario", estado: "pausada" } },
      { campana_id: C, nombre: "Lanzamiento del ceviche", flujo: { color: "rojo", linea: "DETENIDO · se acabó la bolsa de planificación", estado: "necesita_humano" } },
    ])
  })
  it("🔴 no cuentan: cerradas, reemplazadas, archivadas, de ensayo (seco) ni de otro cliente", async () => {
    expect([...ESTADOS_MUERTOS]).toEqual(["cerrada", "reemplazada"])
    const { supabase } = baseConFilas([
      fila(A, { creada_en: "1", estado: "activa" }),
      fila("x1", { creada_en: "2", estado: "cerrada" }),
      fila("x2", { creada_en: "3", estado: "reemplazada" }),
      fila("x3", { creada_en: "4", estado: "activa", archivada_en: "2026-11-01T00:00:00Z" }),
      fila("x4", { creada_en: "5", estado: "activa", seco: true }),
      fila("x5", { creada_en: "6", estado: "activa", client_id: OTRO_CLIENTE }),
    ])
    expect((await campanasVivas(supabase, CLIENTE)).map((c) => c.campana_id)).toEqual([A])
  })
  it("🔴 sin nombre (o solo espacios) y sin plan legible → el genérico fijo, nunca null (21-nov · Emilio 10:30Z); sin campañas → lista vacía", async () => {
    const { supabase } = baseConFilas([fila(A, { creada_en: "1", estado: "activa", nombre_de_campana: "   " }), fila(B, { creada_en: "2", estado: "activa" })])
    expect((await campanasVivas(supabase, CLIENTE)).map((c) => c.nombre)).toEqual([NOMBRE_GENERICO_SIN_PLAN, NOMBRE_GENERICO_SIN_PLAN])
    expect(await campanasVivas(baseConFilas([]).supabase, CLIENTE)).toEqual([])
  })
  it("🔴 la base todavía sin la columna del nombre: se lee sin ella y el nombre va con el genérico (el botón no se cae)", async () => {
    const { supabase, pedidos } = baseConFilas([fila(A, { creada_en: "1", estado: "activa" })], { sinColumna: true })
    expect(await campanasVivas(supabase, CLIENTE)).toEqual([{ campana_id: A, nombre: NOMBRE_GENERICO_SIN_PLAN, flujo: { color: "verde", linea: "EN MARCHA", estado: "activa" } }])
    expect(pedidos).toEqual(["cadena_campanas:id, estado, estado_motivo, nombre_de_campana, plan_id", "cadena_campanas:id, estado, estado_motivo, plan_id"])
  })
  it("🔴 otro error de la base NO se tapa: se lanza", async () => {
    await expect(campanasVivas(baseConFilas([], { error: "caída" }).supabase, CLIENTE)).rejects.toThrow(/caída/)
  })
  const PLAN_REAL = "# Plan de campaña · 90 días · Náufrago · Versión 3\n**6 de noviembre de 2026 – 28 de enero de 2027**\n"
  it("🔴 21-nov · la campaña SIN nombre se lee con el genérico de SU plan (sin versión ni fecha); la que tiene nombre, con el suyo; el plan solo se pide para las sin nombre", async () => {
    const { supabase, pedidos } = baseConFilas([
      fila(A, { creada_en: "1", estado: "necesita_humano", plan_id: "plan-1" }),
      fila(B, { creada_en: "2", estado: "pausada", estado_motivo: PAUSA, nombre_de_campana: "Naufrago llego a Guayaquil", plan_id: "plan-2" }),
    ], { planes: [{ id: "plan-1", content_text: PLAN_REAL, content: null }, { id: "plan-2", content_text: "# Otro plan", content: null }] })
    expect((await campanasVivas(supabase, CLIENTE)).map((c) => c.nombre)).toEqual(["Plan de campaña · 90 días · Náufrago", "Naufrago llego a Guayaquil"])
    // el caso real de Náufrago: las dos campañas comparten plan; la que tiene nombre lo conserva aunque su plan sí se haya leído
    const mismoPlan = baseConFilas([
      fila(A, { creada_en: "1", estado: "necesita_humano", plan_id: "plan-1" }),
      fila(B, { creada_en: "2", estado: "pausada", estado_motivo: PAUSA, nombre_de_campana: "Naufrago llego a Guayaquil", plan_id: "plan-1" }),
    ], { planes: [{ id: "plan-1", content_text: PLAN_REAL, content: null }] })
    expect((await campanasVivas(mismoPlan.supabase, CLIENTE)).map((c) => c.nombre)).toEqual(["Plan de campaña · 90 días · Náufrago", "Naufrago llego a Guayaquil"])
    expect(pedidos).toEqual(["cadena_campanas:id, estado, estado_motivo, nombre_de_campana, plan_id", "client_historical_outputs:id, content_text, content"])
  })
  it("🔴 21-nov · sin content_text se usa content; si el plan no se puede leer, el genérico fijo y la lectura NO se cae; con todas nombradas no se lee ningún plan", async () => {
    const filas = [fila(A, { creada_en: "1", estado: "activa", plan_id: "plan-1" })]
    expect((await campanasVivas(baseConFilas(filas, { planes: [{ id: "plan-1", content_text: null, content: PLAN_REAL }] }).supabase, CLIENTE))[0].nombre).toBe("Plan de campaña · 90 días · Náufrago")
    expect((await campanasVivas(baseConFilas(filas, { planes: [{ id: "plan-1", content_text: PLAN_REAL }], errorPlanes: "caída" }).supabase, CLIENTE))[0].nombre).toBe(NOMBRE_GENERICO_SIN_PLAN)
    const conNombre = baseConFilas([fila(A, { creada_en: "1", estado: "activa", nombre_de_campana: "Mía", plan_id: "plan-1" })], { planes: [{ id: "plan-1", content_text: PLAN_REAL }] })
    expect((await campanasVivas(conNombre.supabase, CLIENTE))[0].nombre).toBe("Mía")
    expect(conNombre.pedidos).toEqual(["cadena_campanas:id, estado, estado_motivo, nombre_de_campana, plan_id"])
  })
})

const puerta = vi.hoisted(() => ({ valor: { ok: true, email: "emilio" } as { ok: boolean; status?: number; email?: string } }))
const sb = vi.hoisted(() => ({ valor: null as unknown }))
vi.mock("@/lib/admin-guard", () => ({ exigirAdmin: async () => puerta.valor }))
vi.mock("@/lib/supabase-server", () => ({ getServiceRoleClient: () => sb.valor }))

describe("GET /api/flujo suma `campanas` y deja igual lo de siempre", () => {
  beforeEach(() => { puerta.valor = { ok: true, email: "emilio" } })
  it("🔴 `campana_id` + `flujo` siguen siendo la MÁS NUEVA; `campanas` trae todas las vivas", async () => {
    sb.valor = baseConFilas([
      fila(A, { creada_en: "2026-11-19T01:00:00Z", estado: "activa", nombre_de_campana: "Primera" }),
      fila(B, { creada_en: "2026-11-19T02:00:00Z", estado: "pausada", estado_motivo: PAUSA, nombre_de_campana: "Segunda" }),
    ]).supabase
    const { GET } = await import("@/app/api/flujo/route")
    const r = await GET(new Request(`http://x/api/flujo?cliente=${CLIENTE}`))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({
      ok: true,
      campana_id: B,
      flujo: { color: "dorado", linea: "PARADO POR TI · en la semana 4 del calendario", estado: "pausada" },
      campanas: [
        { campana_id: A, nombre: "Primera", flujo: { color: "verde", linea: "EN MARCHA", estado: "activa" } },
        { campana_id: B, nombre: "Segunda", flujo: { color: "dorado", linea: "PARADO POR TI · en la semana 4 del calendario", estado: "pausada" } },
      ],
    })
  })
  it("🔴 un client_viewer sigue recibiendo 403 sin campañas", async () => {
    puerta.valor = { ok: false, status: 403 }
    const { GET } = await import("@/app/api/flujo/route")
    const r = await GET(new Request(`http://x/api/flujo?cliente=${CLIENTE}`))
    expect(r.status).toBe(403); expect(await r.json()).toEqual({ ok: false, error: "sin_permiso" })
  })
  it("🔴 si la base cae al leer las campañas: 502, sin respuesta a medias", async () => {
    sb.valor = baseConFilas([], { error: "caída" }).supabase
    const { GET } = await import("@/app/api/flujo/route")
    const r = await GET(new Request(`http://x/api/flujo?cliente=${CLIENTE}`))
    expect(r.status).toBe(502); expect((await r.json()).ok).toBe(false)
  })
})

describe("el nombre genérico del plan · la MISMA regla y las mismas cifras que la plataforma (`crear-campana-sin-vuelta.test.ts`)", () => {
  it("🔴 el título real de Náufrago: sin la versión y sin la línea de fechas", () => {
    expect(nombreGenericoDelPlan("# Plan de campaña · 90 días · Náufrago · Versión 3\n**6 de noviembre de 2026 – 28 de enero de 2027**\n---\n")).toBe("Plan de campaña · 90 días · Náufrago")
  })
  it("🔴 sin título «# …» (o sin plan), el genérico fijo", () => {
    expect(nombreGenericoDelPlan("Plan de 90 días de una cafetería de barrio.\n## Canales")).toBe(NOMBRE_GENERICO_SIN_PLAN)
    expect(nombreGenericoDelPlan("")).toBe(NOMBRE_GENERICO_SIN_PLAN)
    expect(nombreGenericoDelPlan(null)).toBe(NOMBRE_GENERICO_SIN_PLAN)
  })
  it("🔴 las partes con fecha (ISO o escrita) se van, las negritas también; un título que solo era fecha y versión da el genérico fijo", () => {
    expect(nombreGenericoDelPlan("# **Plan de 90 dias** · 2026-11-06 · versión B")).toBe("Plan de 90 dias")
    expect(nombreGenericoDelPlan("# Campaña de verano · 6 de noviembre · Quito")).toBe("Campaña de verano · Quito")
    expect(nombreGenericoDelPlan("# Plan · noviembre de 2026")).toBe("Plan")
    expect(nombreGenericoDelPlan("# 2026-11-06 · Versión 2")).toBe(NOMBRE_GENERICO_SIN_PLAN)
  })
  it("🔴 un título que no cabe en un nombre (más de 120) da el genérico fijo, nunca un nombre cortado", () => {
    expect(nombreGenericoDelPlan(`# ${"x".repeat(121)}`)).toBe(NOMBRE_GENERICO_SIN_PLAN)
    expect(nombreGenericoDelPlan(`# ${"x".repeat(120)}`)).toBe("x".repeat(120))
  })
  it("🔴 el genérico fijo es el mismo texto que el de la plataforma", () => {
    expect(NOMBRE_GENERICO_SIN_PLAN).toBe("Campaña del plan de marketing")
  })
})
