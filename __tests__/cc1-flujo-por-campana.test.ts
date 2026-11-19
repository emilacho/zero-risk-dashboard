/**
 * VARIAS CAMPAÑAS (GO de Lenovo a CC1 · pedido 20:46Z · botón aprobado por Emilio 21:45 Zúrich: 3 lugares, uno por campaña, con su nombre)
 * `/api/flujo` SUMA `campanas: [{ campana_id, nombre, flujo }]` (las vivas del cliente, de la más vieja a la más nueva) y deja igual
 * `campana_id` + `flujo` (el botón de hoy los lee).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { campanasVivas, ESTADOS_MUERTOS, PREFIJO_DE_PAUSA_DEL_TABLERO } from "@/lib/flujo-de-campana"

const CLIENTE = "11111111-2222-3333-4444-555555555555"
const OTRO_CLIENTE = "99999999-2222-3333-4444-555555555555"
const PAUSA = `${PREFIJO_DE_PAUSA_DEL_TABLERO} · vuelve a: activa · en la semana 4 del calendario`

type Fila = Record<string, unknown>
/** una base de juguete que SÍ filtra (eq · not in · is null), ordena y limita; `sinColumna` = la base aún sin `nombre_de_campana` */
function baseConFilas(filas: Fila[], opc: { sinColumna?: boolean; error?: string } = {}) {
  const pedidos: string[] = []
  const supabase = {
    from(tabla: string) {
      let sel = filas.map((f) => ({ ...f }))
      let columnas = ""
      let fallo: { message: string } | null = null
      const q: Record<string, unknown> = {
        select: (c: string) => {
          columnas = c; pedidos.push(`${tabla}:${c}`)
          if (opc.error) fallo = { message: opc.error }
          else if (opc.sinColumna && c.includes("nombre_de_campana")) fallo = { message: "column cadena_campanas.nombre_de_campana does not exist" }
          return q
        },
        eq: (k: string, v: unknown) => { sel = sel.filter((f) => f[k] === v); return q },
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
  it("🔴 sin nombre (o solo espacios) → nombre null; sin campañas → lista vacía", async () => {
    const { supabase } = baseConFilas([fila(A, { creada_en: "1", estado: "activa", nombre_de_campana: "   " }), fila(B, { creada_en: "2", estado: "activa" })])
    expect((await campanasVivas(supabase, CLIENTE)).map((c) => c.nombre)).toEqual([null, null])
    expect(await campanasVivas(baseConFilas([]).supabase, CLIENTE)).toEqual([])
  })
  it("🔴 la base todavía sin la columna del nombre: se lee sin ella y el nombre va null (el botón no se cae)", async () => {
    const { supabase, pedidos } = baseConFilas([fila(A, { creada_en: "1", estado: "activa" })], { sinColumna: true })
    expect(await campanasVivas(supabase, CLIENTE)).toEqual([{ campana_id: A, nombre: null, flujo: { color: "verde", linea: "EN MARCHA", estado: "activa" } }])
    expect(pedidos).toEqual(["cadena_campanas:id, estado, estado_motivo, nombre_de_campana", "cadena_campanas:id, estado, estado_motivo"])
  })
  it("🔴 otro error de la base NO se tapa: se lanza", async () => {
    await expect(campanasVivas(baseConFilas([], { error: "caída" }).supabase, CLIENTE)).rejects.toThrow(/caída/)
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
