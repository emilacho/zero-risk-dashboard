/** MAPA · lógica pura, lectura con base falsa y puertas. US$ 0, sin red. La prueba contra la base viva está en mapa-viva.test.ts. */
import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { ESTACIONES, contarCosas, dondeEstaElEncargo, humanizar } from "@/lib/mapa"
import { leerMapa } from "@/lib/mapa-datos"

describe("dónde está cada pieza", () => {
  it("con fila de revisión → bandeja; fallido → fallo; si no, sigue en la oficina", () => {
    expect(dondeEstaElEncargo({ estado: "cerrado", hitl_queue_id: "h1" })).toBe("bandeja")
    expect(dondeEstaElEncargo({ estado: "fallido", hitl_queue_id: null })).toBe("fallo")
    expect(dondeEstaElEncargo({ estado: "en_paso", hitl_queue_id: null })).toBe("oficina")
    expect(dondeEstaElEncargo({ estado: "fallido", hitl_queue_id: "h1" })).toBe("bandeja")
    expect(dondeEstaElEncargo({})).toBe("oficina")
  })
  it("las cinco estaciones van en el orden del recorrido", () => {
    expect(ESTACIONES.map((e) => e.clave)).toEqual(["brief", "oficina", "mesa", "jefatura", "bandeja"])
  })
  it("textos: plural y guiones bajos", () => {
    expect(contarCosas(1, "turno", "turnos")).toBe("1 turno")
    expect(contarCosas(3, "turno", "turnos")).toBe("3 turnos")
    expect(humanizar("incompleta_por_tope")).toBe("incompleta por tope")
    expect(humanizar(null)).toBe("—")
  })
})

function baseFalsa(tablas: Record<string, Array<Record<string, unknown>>>, falla?: string) {
  const from = (t: string) => {
    let filas = [...(tablas[t] ?? [])]
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.eq = (c: string, v: unknown) => { filas = filas.filter((f) => f[c] === v); return b }
    b.in = (c: string, vs: unknown[]) => { filas = filas.filter((f) => vs.includes(f[c])); return b }
    b.gte = () => b
    b.order = () => b
    b.limit = (n: number) => { filas = filas.slice(0, n); return b }
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve(t === falla ? { data: null, error: { message: "boom" } } : { data: filas, error: null }).then(ok)
    return b
  }
  return { from } as unknown as SupabaseClient
}
const TABLAS = () => ({
  oficina_encargos: [
    { id: "e1", brief_id: "BRF-0002", familia: "carrusel_mesa", estado: "cerrado", hitl_queue_id: "h1", dry_run: false, gasto_usd: 1.7, creado_en: "2026-10-29T10:00:00Z" },
    { id: "e2", brief_id: "BRF-0004", familia: "kit_historias", estado: "fallido", hitl_queue_id: null, dry_run: false, gasto_usd: 0.3, creado_en: "2026-10-28T10:00:00Z" },
    { id: "e3", brief_id: "BRF-0002", familia: "carrusel_mesa", estado: "cerrado", hitl_queue_id: "h9", dry_run: true, gasto_usd: 9, creado_en: "2026-10-27T10:00:00Z" },
  ],
  oficina_turnos: [{ encargo_id: "e1", tipo: "agente", estado: "hecho", fin: "2026-10-29T10:05:00Z" }, { encargo_id: "e1", tipo: "codigo", estado: "hecho", fin: "2026-10-29T10:06:00Z" }, { encargo_id: "e2", tipo: "agente", estado: "fallo", fin: "2026-10-28T10:05:00Z" }, { encargo_id: "e3", tipo: "agente", estado: "hecho", fin: "2026-10-27T10:05:00Z" }],
  oficina_mesa_aportes: [{ encargo_id: "e1", creado_en: "2026-10-29T10:02:00Z" }, { encargo_id: "e1", creado_en: "2026-10-29T10:03:00Z" }, { encargo_id: "e3", creado_en: "2026-10-27T10:02:00Z" }],
  jefatura_revisiones: [{ resultado: "incompleta_por_tope", dry_run: false, cerrado_en: "2026-10-29T10:10:00Z" }, { resultado: "limpia", dry_run: true, cerrado_en: "2026-10-28T10:10:00Z" }],
  hitl_queue: [{ status: "pending", created_at: "2026-10-29T10:11:00Z", type: "content_piece_review" }],
})

describe("leerMapa", () => {
  it("cada estación cuenta solo trabajo real: el ensayo (dry_run) no entra", async () => {
    const m = await leerMapa(baseFalsa(TABLAS()), new Date("2026-10-29T12:00:00Z"))
    const p = Object.fromEntries(m.pasos.map((x) => [x.clave, x]))
    expect(p.brief.cuantos).toBe(2) // BRF-0002 y BRF-0004 reales; el ensayo repetido no suma
    expect(p.oficina.cuantos).toBe(1) // un encargo cerrado real
    expect(p.oficina.detalle).toContain("1 encargos fallidos")
    expect(p.mesa.cuantos).toBe(2) // los 2 aportes del encargo real; el del ensayo no
    expect(p.jefatura.cuantos).toBe(1)
    expect(p.jefatura.detalle).toEqual(["1 incompleta por tope"])
    expect(p.bandeja.cuantos).toBe(1)
    expect(p.bandeja.detalle).toEqual(["1 pendiente"])
    expect(p.mesa.ultimo).toBe("2026-10-29T10:03:00Z")
  })
  it("las piezas se colocan donde la base dice, sin ensayos", async () => {
    const m = await leerMapa(baseFalsa(TABLAS()), new Date("2026-10-29T12:00:00Z"))
    expect(m.piezas.map((x) => [x.brief, x.donde])).toEqual([["BRF-0002", "bandeja"], ["BRF-0004", "fallo"]])
  })
  it("sin piezas reales no inventa nada", async () => {
    const m = await leerMapa(baseFalsa({ ...TABLAS(), oficina_encargos: [] }), new Date("2026-10-29T12:00:00Z"))
    expect(m.piezas).toEqual([])
    expect(m.pasos.find((x) => x.clave === "mesa")!.cuantos).toBe(0)
  })
  it("un error de la base NO se lee como cero: lanza", async () => {
    for (const t of ["oficina_encargos", "oficina_turnos", "oficina_mesa_aportes", "jefatura_revisiones", "hitl_queue"]) {
      await expect(leerMapa(baseFalsa(TABLAS(), t), new Date("2026-10-29T12:00:00Z")), t).rejects.toThrow(new RegExp(`${t}: boom`))
    }
  })
})

describe("puerta del Mapa", () => {
  const leer = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8")
  it("la página llama a exigirAdmin antes de leer y /mapa es solo de administrador", () => {
    const t = leer("app/mapa/page.tsx")
    expect(t.indexOf("exigirAdmin()")).toBeGreaterThan(-1)
    expect(t.indexOf("exigirAdmin()")).toBeLessThan(t.indexOf("getServiceRoleClient()"))
    expect(leer("middleware.ts")).toMatch(/ADMIN_ONLY_PREFIXES = \[[^\]]*"\/mapa"/)
  })
})
