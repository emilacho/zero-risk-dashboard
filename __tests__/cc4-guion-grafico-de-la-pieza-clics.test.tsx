// @vitest-environment jsdom
/**
 * 28-nov · «Guion gráfico · la pieza» · lo que pidió CC6 (🟡 #374, `2026-11-28-CERTIFICACION-CC6-1291-374-guion-grafico-de-la-pieza.md`):
 *  c3 · con 2 o más fotos por escena, la escena sin foto dice qué se iba a ver (nunca un cuadro inventado ni un hueco)
 *  c4 · el resumen cuenta las FOTOS (4 escenas × 3 → «12 fotos»)
 *  x2 · «▶ Ver el video terminado» → «‹ Volver al guion gráfico» → vuelve el guion
 *  x4 · tras ver el video de una pieza, otra pieza abre en su guion gráfico
 * US$ 0 · sin red. Dos clientes de rubros distintos.
 */
import { afterEach, describe, expect, it } from "vitest"
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { createElement } from "react"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import type { DetalleDeLaPieza } from "@/lib/piezas-datos"
import type { GuionGraficoDeLaPieza } from "@/lib/guion-grafico-de-la-pieza"

afterEach(cleanup)

const CARPETA = "https://proyecto.supabase.co/storage/v1/object/public/oficina-creativos/oficina/cli/enc"
const ESCENAS = [
  { n: 1, desde: 0, hasta: 11, rol: "captar", se_ve: "el producto en la mesa" },
  { n: 2, desde: 11, hasta: 23, rol: "situar", se_ve: "el local por fuera" },
  { n: 3, desde: 23, hasta: 34, rol: "ambiente", se_ve: "la gente adentro" },
  { n: 4, desde: 34, hasta: 45, rol: "llamado", se_ve: "el cierre con la marca" },
]
const guion = (n: number, sinFotos: number[] = []): GuionGraficoDeLaPieza => ({
  fotos_por_escena: n, segundos: 45,
  escenas: ESCENAS.map((e) => {
    const fotos = sinFotos.includes(e.n) ? [] : Array.from({ length: n }, (_, k) => ({ url: `${CARPETA}/g-${e.n}-${k + 1}.jpg`, segundo: e.desde + k }))
    return { ...e, dice: null, texto_en_pantalla: null, producto: null, foto_propia: null, origen_de_la_foto: null, fotos, imagenes: fotos.map((f) => f.url) }
  }),
})
const pieza = (id: string, cliente: string, g: GuionGraficoDeLaPieza | null): DetalleDeLaPieza => ({
  id, estado: "pendiente", status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: `Video · ${cliente} · ${id.slice(0, 4)}`, cliente, creada: "2026-11-28T09:00:00Z",
  familia: "video_mesa", brief_id: "b", encargo_id: `enc-${id}`, gasto_usd: 1, laminas: [], pie: null,
  video: { nombre: "r.mp4", bytes: 1000, segundos: 45, simulado: false, solo_en_proveedor: false, vence: null, url_proveedor: null },
  guion_grafico: g, guion: null, avisos: [], exige_casilla: false,
  jefatura: { resultado: null, desacuerdos: [], opinion_externa: null, revision_id: null }, aportes: [], version: 1, resumen_de_la_bandeja: null,
  acompana: { fila: null, productores: [], decidida_en: null, rehechura: null } as never,
})
const fila = (d: DetalleDeLaPieza) => ({ id: d.id, estado: "pendiente" as const, status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: "x", titulo_legible: d.titulo, carpeta: "Video Instagram", archivada: false, cliente_id: "c1", cliente: d.cliente, creada: d.creada, gasto_usd: 1, incompleta: false, desacuerdos: 0, tiene_dibujo: true })
const bandeja = (ds: DetalleDeLaPieza[]) => ({ ok: true, estado: "todas" as const, por_aprobar: ds.length, piezas: ds.map(fila), otras: [], clientes: [{ id: "c1", nombre: ds[0].cliente }], leido_en: "x" })

describe.each([["restaurante", "Restaurante de práctica"], ["seguridad industrial", "Seguridad de práctica"]])("el visor · %s", (_r, cliente) => {
  it("🔴 c3 · con 3 por escena, la escena sin fotos dice qué se iba a ver (y las demás traen las suyas)", () => {
    const d = pieza("a1a1a1a1-0000-4000-8000-000000000001", cliente, guion(3, [2]))
    const { container } = render(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: bandeja([d]) as never, piezaInicialDatos: d }))
    const vacia = container.querySelector('[data-escena="2"] [data-cuadro-vacio]')
    expect(vacia?.textContent).toBe("el local por fuera")
    expect(container.querySelectorAll('[data-escena="2"] [data-foto-del-video]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-escena="1"] [data-foto-del-video]')).toHaveLength(3)
  })
  it("🔴 c4 · el resumen cuenta las fotos: 4 escenas × 3 → «12 fotos»; con una escena sin fotos, 9", () => {
    const d = pieza("a1a1a1a1-0000-4000-8000-000000000001", cliente, guion(3))
    const { container } = render(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: bandeja([d]) as never, piezaInicialDatos: d }))
    expect(container.querySelector("[data-resumen-del-guion]")?.textContent).toContain("4 escenas · 12 fotos (3 por escena, pieza de 45 s)")
    cleanup()
    const d2 = pieza("a1a1a1a1-0000-4000-8000-000000000001", cliente, guion(3, [4]))
    const r2 = render(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: bandeja([d2]) as never, piezaInicialDatos: d2 }))
    expect(r2.container.querySelector("[data-resumen-del-guion]")?.textContent).toContain("4 escenas · 9 fotos")
  })
  it("🔴 x2 · «▶ Ver el video terminado» → el reproductor → «‹ Volver al guion gráfico» → vuelve el guion", async () => {
    const d = pieza("a1a1a1a1-0000-4000-8000-000000000001", cliente, guion(1))
    const { container } = render(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: bandeja([d]) as never, piezaInicialDatos: d }))
    expect(container.querySelector("[data-guion-de-la-pieza]")).not.toBeNull()
    expect(container.querySelector("video")).toBeNull()
    await act(async () => { fireEvent.click(container.querySelector("[data-ver-video-terminado]")!) })
    expect(container.querySelector("video")?.getAttribute("src")).toBe(`/api/piezas/${d.id}/video`)
    expect(container.querySelector("[data-guion-de-la-pieza]")).toBeNull()
    await act(async () => { fireEvent.click(container.querySelector("[data-volver-al-guion]")!) })
    expect(container.querySelector("[data-guion-de-la-pieza]")).not.toBeNull()
    expect(container.querySelector("video")).toBeNull()
  })
  it("🔴 x4 · tras ver el video de A, abrir la pieza B la abre en SU guion gráfico (no en el reproductor)", async () => {
    const a = pieza("a1a1a1a1-0000-4000-8000-000000000001", cliente, guion(1))
    const b = pieza("b2b2b2b2-0000-4000-8000-000000000002", cliente, guion(2))
    const fetchImpl = (async (u: string) => {
      const s = String(u)
      const cuerpo = s.includes("/api/piezas/") ? { ok: true, pieza: s.includes(b.id) ? b : a } : s.includes("/api/bandeja") ? bandeja([a, b]) : { ok: true, cliente: null, filas: [] }
      return new Response(JSON.stringify(cuerpo), { status: 200, headers: { "content-type": "application/json" } })
    }) as typeof fetch
    const { container } = render(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: bandeja([a, b]) as never, piezaInicialDatos: a, fetchImpl }))
    await act(async () => { fireEvent.click(container.querySelector("[data-ver-video-terminado]")!) })
    expect(container.querySelector("video")).not.toBeNull()
    await act(async () => { fireEvent.click(container.querySelector('[data-accion="volver-a-la-carpeta"]')!) })
    await waitFor(() => expect(container.querySelector(`[data-pieza="${b.id}"]`)).not.toBeNull())
    await act(async () => { fireEvent.click(container.querySelector(`[data-pieza="${b.id}"]`)!) })
    await waitFor(() => expect(container.querySelector('[data-guion-de-la-pieza][data-fotos-por-escena="2"]')).not.toBeNull())
    expect(container.querySelector("video")).toBeNull()
  })
})
