/** UNA SOLA «APROBADA» (CC6 · 03-nov · encargo de Lenovo 22:06Z: la Vitrina decía «Todavía no hay piezas aprobadas» y Dinero «2 aprobadas de 14 revisadas»). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { esPiezaAprobada } from "@/lib/piezas"
import { costoPorResultado } from "@/lib/dinero-completo"
import { leerLaVitrina, textoDeLaVitrinaVacia } from "@/lib/escena-vitrina"
import { PanelDeLaVitrina } from "@/components/nuevo/escena/PanelesDelPizarron"

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", ZRSI = "11111111-2222-4333-8444-555555555555"

describe("una sola definición de «pieza aprobada»", () => {
  it("aprobada = lo que la bandeja muestra como aprobada; «con cambios pedidos» (edited) y rechazada NO", () => {
    expect(esPiezaAprobada("approved")).toBe(true)
    expect(esPiezaAprobada("edited", { pidio_cambios: true })).toBe(false)
    expect(esPiezaAprobada("rejected")).toBe(false); expect(esPiezaAprobada("pending")).toBe(false)
  })
  it("Dinero cuenta con esa función: la devuelta con cambios ya no suma como aprobada (lo real del 30-oct: 1 aprobada + 1 con cambios)", () => {
    const d = { movimientos: [], piezas: [{ d: "2026-10-30", estado: "approved", usd: 1 }, { d: "2026-10-30", estado: "edited", usd: 1 }] } as never
    const p = costoPorResultado(d, { desde: "2026-10-01", hasta: "2026-11-03" }).find((x) => x.clave === "pieza")!
    expect(p.cuantos).toBe(1); expect(p.nota).toBe("1 aprobada de 2 revisadas")
  })
  it("ningún archivo vuelve a contar «approved o edited» como aprobada por su cuenta", () => {
    const archivos = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? archivos(p) : /\.tsx?$/.test(n) ? [p] : [] })
    const con = ["lib", "components", "app"].flatMap(archivos).filter((p) => /"approved"\s*\|\|\s*\w+(\.\w+)*\s*===\s*"edited"/.test(readFileSync(p, "utf8")))
    expect(con).toEqual([])
    expect(readFileSync("lib/escena-vitrina.ts", "utf8")).toContain("esPiezaAprobada")
  })
})

describe("la Vitrina filtra por el cliente elegido y lo dice", () => {
  it("«Náufrago aún sin piezas aprobadas · 2 de otros clientes»; con 1, «de otro cliente»; sin otras, el texto de siempre con el nombre", () => {
    expect(textoDeLaVitrinaVacia({ cliente: "Náufrago", otros_clientes: { cuantos: 2, piezas: [] } })).toBe("Náufrago aún sin piezas aprobadas · 2 de otros clientes")
    expect(textoDeLaVitrinaVacia({ cliente: "Náufrago", otros_clientes: { cuantos: 1, piezas: [] } })).toBe("Náufrago aún sin piezas aprobadas · 1 de otro cliente")
    expect(textoDeLaVitrinaVacia({ cliente: "Náufrago", otros_clientes: { cuantos: 0, piezas: [] } })).toBe("Náufrago aún sin piezas aprobadas. Aparecerán aquí cuando se aprueben.")
    expect(textoDeLaVitrinaVacia(undefined)).toBe("Todavía no hay piezas aprobadas. Aparecerán aquí cuando se aprueben.")
  })
  it("el panel muestra el texto y un botón grande «Verlas» (≥44 px) para ver las de otros clientes", () => {
    const h = renderToStaticMarkup(createElement(PanelDeLaVitrina, { onCerrar: () => {}, vitrina: { modo: "vacia", piezas: [], lectura: "sin_datos", cliente: "Náufrago", otros_clientes: { cuantos: 1, piezas: [{ id: "p1", titulo: "Carrusel Facebook · Zero Risk Seguridad Industrial", cliente: "Zero Risk Seguridad Industrial" }] } } }))
    expect(h).toContain("Náufrago aún sin piezas aprobadas · 1 de otro cliente")
    expect(h).toContain('data-accion="vitrina-ver-otros-clientes"'); expect(h).toMatch(/data-accion="vitrina-ver-otros-clientes"[^>]*min-h-\[52px\]/)
    const sin = renderToStaticMarkup(createElement(PanelDeLaVitrina, { onCerrar: () => {}, vitrina: { modo: "vacia", piezas: [], lectura: "sin_datos", cliente: "Náufrago", otros_clientes: { cuantos: 0, piezas: [] } } }))
    expect(sin).not.toContain("vitrina-ver-otros-clientes")
  })
  it("la lectura: con Náufrago elegido y la única aprobada de Zero Risk SI, la Vitrina queda vacía y cuenta 1 de otro cliente (la devuelta con cambios no cuenta)", async () => {
    const tablas: Record<string, Array<Record<string, unknown>>> = {
      hitl_queue: [
        { id: "a1", status: "approved", type: "content_piece_review", client_id: ZRSI, created_at: "2026-10-30T12:09:00Z", title: "Carrusel facebook", metadata: { familia: "carrusel" }, decision: {}, archivada_en: null },
        { id: "e1", status: "edited", type: "content_piece_review", client_id: ZRSI, created_at: "2026-10-30T10:23:00Z", title: "Carrusel facebook", metadata: {}, decision: { pidio_cambios: true }, archivada_en: null },
      ],
      clients: [{ id: NAUFRAGO, name: "Náufrago", industry: "restaurante" }, { id: ZRSI, name: "Zero Risk Seguridad Industrial", industry: "seguridad industrial" }],
    }
    const supa = { from: (t: string) => {
      let d = [...(tablas[t] ?? [])]
      const q: Record<string, unknown> = {}
      for (const m of ["select", "order", "limit", "not", "neq"]) q[m] = () => q
      q.eq = (c: string, v: unknown) => { d = d.filter((f) => f[c] === v); return q }
      q.in = (c: string, v: unknown[]) => { d = d.filter((f) => v.includes(f[c])); return q }
      q.is = (c: string, v: unknown) => { d = d.filter((f) => (f[c] ?? null) === v); return q }
      q.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: d, error: null }).then(ok)
      return q
    } } as never
    const v = await leerLaVitrina(supa, { cliente: NAUFRAGO, nombre: "Náufrago" })
    expect(v.modo).toBe("vacia"); expect(v.otros_clientes?.cuantos).toBe(1); expect(v.otros_clientes?.piezas.map((p) => p.id)).toEqual(["a1"])
    expect(textoDeLaVitrinaVacia(v)).toBe("Náufrago aún sin piezas aprobadas · 1 de otro cliente")
    const z = await leerLaVitrina(supa, { cliente: ZRSI, nombre: "Zero Risk Seguridad Industrial" })
    expect(z.modo).toBe("ultima"); expect(z.piezas[0].id).toBe("a1"); expect(z.otros_clientes?.cuantos).toBe(0)
  })
})
