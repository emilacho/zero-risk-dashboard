/** EL PIZARRÓN: TODOS TENUES + UN RECUADRO POR CADA COSA QUE ESPERA LA FIRMA (CC6 · 04-nov · encargo de Lenovo, Emilio 14:05Z). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { avisosDeLaBandeja, leerAvisosDeFirma, ORDEN_DE_LOS_AVISOS, TEXTO_DEL_AVISO } from "@/lib/escena-avisos"
import { cuadrosDelPizarron } from "@/lib/escena-metricas"
import { CUADROS_DEL_PIZARRON } from "@/lib/escena-entregas"
import { BRILLO_TENUE, CuadrosDeMetricas } from "@/components/nuevo/escena/EntregasEnLaFoto"

const N = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const metricas = { cliente: "Náufrago", cuadros: cuadrosDelPizarron(["instagram", "web"], { estado: "sin_datos", motivo: "pronto" } as never), lectura: "sin_datos" } as never
const pinta = (avisos: unknown[]) => renderToStaticMarkup(createElement("svg", null, createElement(CuadrosDeMetricas, { metricas, avisos: avisos as never })))
const q = (i: number) => CUADROS_DEL_PIZARRON[i].map((p) => `${p.x},${p.y}`).join(" ")

describe("1 · todos los recuadros al mismo brillo tenue (Emilio eligió la opción a)", () => {
  it("ninguno brilla por «tiene cuenta»", () => {
    const h = pinta([])
    const op = [...h.matchAll(/data-metrica="[^"]+" data-tiene="(true|false)" opacity="([\d.]+)"/g)]
    expect(op.length).toBeGreaterThan(5); expect(new Set(op.map((m) => m[2]))).toEqual(new Set([String(BRILLO_TENUE)]))
    expect(op.some((m) => m[1] === "true") && op.some((m) => m[1] === "false")).toBe(true) // aunque unos tengan cuenta y otros no
  })
})

describe("2 · Manual · Plan · Piezas, en ese orden, en los primeros recuadros; titila solo el que tiene algo", () => {
  it("el orden fijo y sus nombres", () => {
    expect(ORDEN_DE_LOS_AVISOS).toEqual(["manual", "plan", "piezas"])
    expect(TEXTO_DEL_AVISO).toEqual({ manual: "Manual listo · revísalo", plan: "Plan listo · revísalo", piezas: "Piezas por aprobar · revísalas" })
  })
  it("solo el plan espera: titila el SEGUNDO recuadro (debajo del primero); el primero y el tercero, como todos", () => {
    const h = pinta([{ clave: "plan", texto: TEXTO_DEL_AVISO.plan, abre: "plan" }])
    expect(h).toContain('data-aviso-firma="plan"'); expect(h).not.toContain('data-aviso-firma="manual"'); expect(h).not.toContain('data-aviso-firma="piezas"')
    expect(h).toMatch(new RegExp(`data-aviso-firma="plan"[\\s\\S]*?points="${q(1)}"`))
    expect(h).toContain('data-metrica="general"') // el primero vuelve a ser un recuadro normal
    expect(h).toContain('aria-label="Plan listo · revísalo"'); expect(h).not.toContain(">Plan listo · revísalo<") // sin texto fijo (#266)
  })
  it("los tres a la vez: cada uno en su lugar", () => {
    const h = pinta(ORDEN_DE_LOS_AVISOS.map((k) => ({ clave: k, texto: TEXTO_DEL_AVISO[k], abre: k })))
    for (const [i, k] of ORDEN_DE_LOS_AVISOS.entries()) expect(h).toMatch(new RegExp(`data-aviso-firma="${k}"[\\s\\S]*?points="${q(i)}"`))
  })
})

describe("la señal de cada uno, con datos reales de forma", () => {
  const aprobado = new Map<string, boolean | null>([[N, true]])
  it("plan: una revisión pendiente del plan con el manual ya aprobado; con el manual SIN aprobar, el plan no espera la firma", () => {
    expect(avisosDeLaBandeja([{ type: "plan_con_pendientes", documento: "plan", client_id: N }], aprobado).map((a) => a.clave)).toEqual(["plan"])
    expect(avisosDeLaBandeja([{ type: "plan_con_pendientes", documento: "plan", client_id: N }], new Map([[N, false]]))).toEqual([])
  })
  it("piezas: una pieza de la oficina creativa pendiente", () => {
    expect(avisosDeLaBandeja([{ type: "content_piece_review", documento: "pieza", client_id: N }], aprobado).map((a) => a.clave)).toEqual(["piezas"])
    expect(avisosDeLaBandeja([{ type: "palabra_del_dueno", documento: "manual", client_id: N }], aprobado)).toEqual([])
  })
  it("la lectura completa como hoy en Náufrago (manual aprobado + 2 revisiones del plan pendientes) → titila el Plan; la bandeja caída → no titila", async () => {
    const supa = (bandejaCae = false) => ({ from: (t: string) => {
      const filas = t === "client_brand_books" ? [{ client_id: N, version: 3, human_validated: true, provenance_tag: { validado_por: "dueno" } }]
        : t === "hitl_queue" ? [{ type: "palabra_del_dueno", documento: "plan", client_id: N }, { type: "plan_con_pendientes", documento: "plan", client_id: N }] : []
      const r: Record<string, unknown> = {}
      for (const m of ["select", "eq", "in", "order", "limit", "is"]) r[m] = () => r
      r.maybeSingle = () => Promise.resolve({ data: filas[0] ?? null, error: null })
      r.then = (ok: (x: unknown) => unknown) => Promise.resolve(t === "hitl_queue" && bandejaCae ? { data: null, error: { message: "caída" } } : { data: filas, error: null }).then(ok)
      return r
    } }) as never
    expect((await leerAvisosDeFirma(supa(), N)).map((a) => a.clave)).toEqual(["plan"])
    expect(await leerAvisosDeFirma(supa(true), N)).toEqual([])
  })
})

describe("reservas de CC3 a #271", () => {
  it("con los tres avisos, ninguna zona de toque cubre el centro de otro recuadro (el clic en Manual abre Manual)", async () => {
    const { zonaDelAviso } = await import("@/components/nuevo/escena/EntregasEnLaFoto")
    const centro = (i: number) => { const p = CUADROS_DEL_PIZARRON[i]; return { x: p.reduce((n, v) => n + v.x, 0) / p.length, y: p.reduce((n, v) => n + v.y, 0) / p.length } }
    const dentro = (z: { x: number; y: number; w: number; h: number }, c: { x: number; y: number }) => c.x >= z.x && c.x <= z.x + z.w && c.y >= z.y && c.y <= z.y + z.h
    for (const i of [0, 1, 2]) {
      const z = zonaDelAviso(i)
      expect(dentro(z, centro(i))).toBe(true)
      for (const j of [0, 1, 2]) if (j !== i) expect(dentro(z, centro(j))).toBe(false)
    }
    expect(zonaDelAviso(0).y + zonaDelAviso(0).h).toBeCloseTo(zonaDelAviso(1).y) // se tocan sin pisarse
    expect(pinta(ORDEN_DE_LOS_AVISOS.map((k) => ({ clave: k, texto: TEXTO_DEL_AVISO[k], abre: k })))).toContain(`height="${zonaDelAviso(1).h}"`)
  })
  it("una revisión archivada o ya resuelta NO enciende ningún aviso (la lectura pide solo pendientes y no archivadas)", async () => {
    const filas = [
      { type: "content_piece_review", documento: "pieza", client_id: N, status: "pending", archivada_en: "2026-11-02T16:40:05Z" },
      { type: "plan_con_pendientes", documento: "plan", client_id: N, status: "approved", archivada_en: null },
    ]
    const supa = { from: (t: string) => {
      let d = t === "client_brand_books" ? [{ client_id: N, version: 3, human_validated: true, provenance_tag: { validado_por: "dueno" } }] : t === "hitl_queue" ? [...filas] as Array<Record<string, unknown>> : []
      const r: Record<string, unknown> = {}
      for (const m of ["select", "order", "limit", "in"]) r[m] = () => r
      r.eq = (c: string, v: unknown) => { d = d.filter((f) => (f as Record<string, unknown>)[c] === undefined || (f as Record<string, unknown>)[c] === v); return r }
      r.is = (c: string, v: unknown) => { d = d.filter((f) => ((f as Record<string, unknown>)[c] ?? null) === v); return r }
      r.maybeSingle = () => Promise.resolve({ data: d[0] ?? null, error: null })
      r.then = (ok: (x: unknown) => unknown) => Promise.resolve({ data: d, error: null }).then(ok)
      return r
    } } as never
    expect(await leerAvisosDeFirma(supa, N)).toEqual([])
  })
})
