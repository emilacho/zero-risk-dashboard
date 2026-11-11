// @vitest-environment jsdom
/**
 * PIEZAS v2 · la portada del video PASA de «cargando» a «con cuadro» (CC6, 🟡 sobre eef19e0, 11-nov).
 * Emilio (20:26): «tiene que verse el thumbnail o la imagen». La primera vista ya no es negra (fondo que late); esta prueba asegura que
 * después SÍ aparece el cuadro: al saber la duración el video salta al 20 % (máx. 2 s, no al segundo 0 del fundido) y, cuando el
 * navegador tiene ese cuadro (`seeked`), se va el fondo y el video queda visible. Dos clientes de rubros distintos; nada depende de uno.
 */
import { afterEach, describe, expect, it } from "vitest"
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { createElement } from "react"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import type { Bandeja } from "@/lib/bandeja-datos"
import type { FilaDeLaLista } from "@/lib/piezas-datos"

afterEach(cleanup)

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", ZR = "d0f5e6a7-1111-4222-8333-944455556666"
const fila = (p: Partial<FilaDeLaLista> & { id: string; cliente_id: string; cliente: string; carpeta: string }): FilaDeLaLista => ({
  estado: "pendiente", status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: "x", titulo_legible: `${p.carpeta} · ${p.cliente}`,
  creada: "2026-11-11T04:32:25Z", gasto_usd: null, incompleta: false, desacuerdos: 0, tiene_dibujo: true, miniatura: "video", archivada: false, ...p,
})
const CASOS = [
  { cliente_id: NAUFRAGO, cliente: "Náufrago", carpeta: "Video corto Instagram", id: "c3292641-5dae-4934-9142-3edcfaa159bf" },
  { cliente_id: ZR, cliente: "Zero Risk Seguridad Industrial", carpeta: "Video corto TikTok", id: "9b1c0f2e-1111-4222-8333-944455556666" },
]
const bandeja = (c: (typeof CASOS)[number]): Bandeja => ({
  estado: "pendiente", por_aprobar: 1, piezas: [fila(c)], otras: [], en_curso: [], leido_en: "x",
  clientes: CASOS.map((x) => ({ id: x.cliente_id, nombre: x.cliente })),
})
/** el navegador de prueba no lee videos: se le dice la duración, como lo haría el archivo al cargar sus datos */
const conDuracion = (v: HTMLVideoElement, s: number) => Object.defineProperty(v, "duration", { configurable: true, get: () => s })

describe("Piezas v2 · la portada del video llega (CC6 11-nov)", () => {
  for (const c of CASOS) {
    it(`${c.cliente}: gris mientras carga → salta al 20 % (8 s → 1,6 s, no al 0) → con el cuadro, el fondo se va y el video se ve`, async () => {
      const { container } = render(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: bandeja(c), clienteInicial: c.cliente_id, carpetaInicial: c.carpeta }))
      const video = container.querySelector<HTMLVideoElement>(`video[data-miniatura="video"][src^="/api/piezas/${c.id}/video"]`)
      expect(video).not.toBeNull()
      // 1 · al entrar: fondo que late y video oculto (nunca una tarjeta negra)
      expect(container.querySelector('[data-portada="cargando"]')).not.toBeNull()
      expect(video!.className).toContain("opacity-0")
      // 2 · el archivo dice su duración: el video salta al cuadro del 20 % (los videos suelen empezar con un fundido a negro)
      conDuracion(video!, 8)
      await act(async () => { fireEvent.loadedMetadata(video!) })
      expect(video!.currentTime).toBeCloseTo(1.6)
      expect(container.querySelector('[data-portada="cargando"]')).not.toBeNull() // todavía no tiene el cuadro
      // y el sello ya dice la duración
      expect(container.querySelector("[data-sello-video]")?.textContent).toBe("▶ 8 s")
      // 3 · el navegador ya tiene ese cuadro: se va el fondo y el video queda a la vista
      await act(async () => { fireEvent.seeked(video!) })
      expect(container.querySelector('[data-portada="cargando"]')).toBeNull()
      expect(video!.className).toContain("opacity-100")
      expect(video!.className).not.toContain("opacity-0")
    })
  }
  it("un video largo toma su portada a los 2 s, nunca más tarde", async () => {
    const { container } = render(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: bandeja(CASOS[0]), clienteInicial: CASOS[0].cliente_id, carpetaInicial: CASOS[0].carpeta }))
    const video = container.querySelector<HTMLVideoElement>('video[data-miniatura="video"]')!
    conDuracion(video, 45)
    await act(async () => { fireEvent.loadedMetadata(video) })
    expect(video.currentTime).toBeCloseTo(2)
  })
})
