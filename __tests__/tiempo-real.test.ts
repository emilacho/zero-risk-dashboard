import { describe, expect, it } from "vitest"
import { INTERVALO_DE_ACTUALIZACION_MS, debeRefrescar, rutaSeRefresca } from "@/lib/tiempo-real"
import { estadoDeLaPieza } from "@/lib/piezas"
import { listarPiezas } from "@/lib/piezas-datos"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const leer = (p: string) => readFileSync(join(process.cwd(), p), "utf8")

describe("tiempo real · cuándo se vuelve a leer", () => {
  it("el intervalo no pasa de 10 s", () => {
    expect(INTERVALO_DE_ACTUALIZACION_MS).toBeLessThanOrEqual(10_000)
    expect(INTERVALO_DE_ACTUALIZACION_MS).toBeGreaterThanOrEqual(2_000)
  })
  it("no refresca el acceso ni lo que no tiene ruta", () => {
    expect(rutaSeRefresca("/login")).toBe(false)
    expect(rutaSeRefresca("/auth/verify")).toBe(false)
    expect(rutaSeRefresca(null)).toBe(false)
    for (const r of ["/", "/piezas", "/alertas", "/oficinas", "/gasto", "/mapa", "/clientes/abc"]) expect(rutaSeRefresca(r)).toBe(true)
  })
  it("refresca viendo la pantalla; nunca escribiendo, enviando, oculta o sin red", () => {
    const base = { ruta: "/piezas", oculta: false, escribiendo: false }
    expect(debeRefrescar(base)).toBe(true)
    expect(debeRefrescar({ ...base, oculta: true })).toBe(false)
    expect(debeRefrescar({ ...base, escribiendo: true })).toBe(false)
    expect(debeRefrescar({ ...base, enviando: true })).toBe(false)
    expect(debeRefrescar({ ...base, sinRed: true })).toBe(false)
    expect(debeRefrescar({ ...base, ruta: "/login" })).toBe(false)
  })
  it("el componente está montado en el diseño general y los paneles abiertos se marcan para no pisarlos", () => {
    expect(leer("app/layout.tsx")).toContain("<ActualizarSolo />")
    expect(leer("components/AccionBoton.tsx")).toContain("data-editando")
    const c = leer("components/ActualizarSolo.tsx")
    expect(c).toContain("router.refresh()")
    expect(c).toContain("data-editando")
  })
})

describe("estado de una pieza · superada no es rechazada", () => {
  it("una rechazada marcada superada o archivada lo dice", () => {
    expect(estadoDeLaPieza("rejected", { superada: true, superada_por: "x" })).toBe("superada")
    expect(estadoDeLaPieza("rejected", { archivada: true })).toBe("archivada")
    expect(estadoDeLaPieza("rejected", {})).toBe("rechazada")
    expect(estadoDeLaPieza("rejected")).toBe("rechazada")
    expect(estadoDeLaPieza("rejected", null)).toBe("rechazada")
  })
  it("solo reinterpreta las rechazadas", () => {
    expect(estadoDeLaPieza("pending", { superada: true })).toBe("pendiente")
    expect(estadoDeLaPieza("approved", { archivada: true })).toBe("aprobada")
    expect(estadoDeLaPieza("edited", {})).toBe("con_cambios")
  })
})

function baseConPiezas(filas: Array<Record<string, unknown>>, clientes: Array<Record<string, unknown>>) {
  const q = (data: unknown) => {
    const o: Record<string, unknown> = {}
    for (const m of ["select", "eq", "neq", "in", "order", "limit"]) o[m] = () => o
    o.then = (res: (v: unknown) => unknown) => res({ data, error: null })
    return o
  }
  return { from: (t: string) => q(t === "hitl_queue" ? filas : clientes) } as never
}

describe("las listas no muestran clientes de práctica", () => {
  it("«zz prueba puerta» y rubro «prueba» no aparecen; los reales sí y la rechazada superada se rotula", async () => {
    const filas = [
      { id: "1", status: "pending", type: "content_piece_review", client_id: "real", created_at: "2026-10-30T10:00:00Z", title: "t", metadata: {}, decision: null },
      { id: "2", status: "rejected", type: "content_piece_review", client_id: "zz", created_at: "2026-10-30T09:00:00Z", title: "t", metadata: {}, decision: {} },
      { id: "3", status: "rejected", type: "content_piece_review", client_id: "ind", created_at: "2026-10-30T08:00:00Z", title: "t", metadata: {}, decision: {} },
      { id: "4", status: "rejected", type: "content_piece_review", client_id: "real", created_at: "2026-10-30T07:00:00Z", title: "t", metadata: {}, decision: { superada: true } },
    ]
    const clientes = [
      { id: "real", name: "Zero Risk Seguridad Industrial", industry: "seguridad" },
      { id: "zz", name: "zz prueba puerta 21:22", industry: "prueba" },
      { id: "ind", name: "Otra", industry: "prueba" },
    ]
    const r = await listarPiezas(baseConPiezas(filas, clientes), { estado: "todas" })
    expect(r.map((x) => x.id)).toEqual(["1", "4"])
    expect(r.find((x) => x.id === "4")?.estado).toBe("superada")
  })
})
