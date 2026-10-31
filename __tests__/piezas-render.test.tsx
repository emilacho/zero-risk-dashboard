/**
 * LA VENTANA DE PIEZAS · el visor se dibuja sin romper con los tres casos que Emilio va a ver: pieza con revisión incompleta (casilla), pieza sin dibujo y fila de otro tipo (con sus botones propios). US$ 0, sin red.
 */
import { describe, expect, it, vi } from "vitest"
import { renderToString } from "react-dom/server"
import type { DetalleDeLaPieza } from "@/lib/piezas-datos"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }))

const base: DetalleDeLaPieza = {
  id: "11111111-1111-1111-1111-111111111111", estado: "pendiente", status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: "⚠️ REVISIÓN INCOMPLETA · Carrusel BRF-0001", cliente: "Zero Risk",
  creada: "2026-10-28T11:56:00Z", familia: "carrusel_ig_v1", brief_id: "BRF-0001", encargo_id: "enc-1", gasto_usd: 1.84, pie: "Pie de la publicación", version: 3, video: null, guion: null,
  laminas: [
    { n: 1, nombre: "a.png", ancho: 1080, alto: 1350, origen: "tipografia", eyebrow: "PARTE 01", titular: "3 cosas", cuerpo: "¿El tuyo las cumple?", pie: "desliza", glifos_riesgosos: false },
    { n: 2, nombre: "b.png", ancho: 1080, alto: 1350, origen: "tipografia", eyebrow: "PARTE 02", titular: "2. MANÓMETRO", cuerpo: "Aguja en zona verde ✔", pie: null, glifos_riesgosos: true },
  ],
  avisos: [{ nivel: "rojo", texto: "La bandeja decía «6 imágenes generadas con IA», pero el manifiesto no trae ninguna." }, { nivel: "ambar", texto: "La revisión de la jefatura no terminó (se cortó por tope)." }],
  exige_casilla: true, jefatura: { resultado: "incompleta_por_tope", desacuerdos: ["x"], opinion_externa: null, revision_id: null }, aportes: [], resumen_de_la_bandeja: "6 imagen generada con IA",
}

/** el servidor de React parte el texto con comentarios <!-- -->: se quitan para leerlo como lo ve la persona */
const dibujar = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, "")

describe("el visor de piezas se dibuja", () => {
  it("pieza con revisión incompleta: lámina, avisos en rojo, casilla «entiendo» y los tres botones (Aprobar dice que no publica)", async () => {
    const { VisorDePieza } = await import("@/app/piezas/VisorDePieza")
    const html = dibujar(<VisorDePieza pieza={base} siguienteId={null} />)
    expect(html).toContain("/api/piezas/11111111-1111-1111-1111-111111111111/lamina/1")
    expect(html).toContain("Ver las 2 juntas")
    expect(html).toMatch(/6 imágenes generadas con IA/)
    expect(html).toMatch(/Entiendo que la revisión de la jefatura no terminó/)
    expect(html).toContain("no publica todavía")
    expect(html).toContain("Pedir cambios")
    expect(html).toContain("Rechazar")
    expect(html).toContain("Solo tipografía de marca")
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Aprobar/) // sin marcar la casilla, Aprobar está bloqueado
  })
  it("pieza sin dibujo: lo dice y no inventa láminas", async () => {
    const { VisorDePieza } = await import("@/app/piezas/VisorDePieza")
    const html = dibujar(<VisorDePieza pieza={{ ...base, laminas: [], avisos: [{ nivel: "rojo", texto: "Sin dibujo: esta pieza no tiene láminas dibujadas" }] }} siguienteId={null} />)
    expect(html).toMatch(/Sin dibujo/)
    expect(html).not.toContain("/lamina/1")
    expect(html).not.toContain("juntas")
  })
  it("fila de otro tipo (competidores): ya no es solo lectura; lleva sus botones propios, sin los de una pieza", async () => {
    const { VisorDePieza } = await import("@/app/piezas/VisorDePieza")
    const html = dibujar(<VisorDePieza pieza={{ ...base, tipo: "confirm_competitor_list", es_pieza: false, laminas: [], avisos: [] }} siguienteId={null} />)
    expect(html).not.toMatch(/solo lectura/)
    expect(html).toContain("Confirmar la lista")
    expect(html).toContain("Rechazar la lista")
    expect(html).not.toContain("confirm_competitor_list")
    expect(html).not.toContain("Pedir cambios")
  })
  it("T8 · pieza de VIDEO: Emilio ve el reproductor (servido por el tablero), el rótulo de generado, el guion y el pie; no dice «Sin dibujo» ni pide láminas", async () => {
    const { VisorDePieza } = await import("@/app/piezas/VisorDePieza")
    const pieza: DetalleDeLaPieza = {
      ...base, titulo: "Video corto Instagram · Zero Risk · 12 nov", familia: "video_mesa", laminas: [], exige_casilla: false, jefatura: { resultado: "aprobada", desacuerdos: [], opinion_externa: null, revision_id: null },
      video: { nombre: "F1-S1-ig-r1_v1.mp4", bytes: 1_200_000, segundos: 12, simulado: false, solo_en_proveedor: false, vence: null, url_proveedor: null },
      guion: "# Guion · F1-S1-ig-r1\n## Plano 1 · 0–3 s\nSe ve: el pan sale del horno",
      avisos: [{ nivel: "info", texto: "Video GENERADO por un modelo (no es una grabación real) · sin voces ni narración. Míralo entero antes de aprobar." }],
    }
    const html = dibujar(<VisorDePieza pieza={pieza} siguienteId={null} />)
    expect(html).toMatch(/<video[^>]*src="\/api\/piezas\/11111111-1111-1111-1111-111111111111\/video"/)
    expect(html).toMatch(/<video[^>]*controls/)
    expect(html).toContain("12 s")
    expect(html).toContain("Guion")
    expect(html).toContain("Se ve: el pan sale del horno")
    expect(html).toContain("Pie de la publicación")
    expect(html).toContain("GENERADO por un modelo")
    expect(html).not.toMatch(/Sin dibujo/)
    expect(html).not.toContain("/lamina/1")
    expect(html).not.toContain("juntas")
    expect(html).toContain("no publica todavía")
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Aprobar/) // sin casilla exigida, Aprobar está libre
    // C10 (certificación CC3): la pestaña se llama «Video», no «Lámina»
    expect(html).toMatch(/<button[^>]*>Video<\/button>/)
    expect(html).not.toMatch(/<button[^>]*>Lámina<\/button>/)
  })
  it("T8 · video que quedó solo en el proveedor: no hay reproductor, se dice, lleva el enlace para bajarlo (nunca se reproduce desde ahí) y se puede decidir igual", async () => {
    const { VisorDePieza } = await import("@/app/piezas/VisorDePieza")
    const html = dibujar(<VisorDePieza pieza={{ ...base, familia: "video_mesa", laminas: [], video: { nombre: null, bytes: null, segundos: 10, simulado: false, solo_en_proveedor: true, vence: "2026-11-02T10:00:00Z", url_proveedor: "https://proveedor.test/v.mp4" }, guion: null, avisos: [{ nivel: "ambar", texto: "El video quedó solo en el proveedor y vence 2026-11-02T10:00:00Z: no se puede mostrar aquí. Hay que bajarlo del proveedor antes de que venza (enlace en la pestaña Video)." }] }} siguienteId={null} />)
    expect(html).not.toContain("<video")
    expect(html).toMatch(/solo en el proveedor/)
    expect(html).toMatch(/Hay que bajarlo/)
    expect(html).not.toMatch(/Se descarga al aprobar/)
    expect(html).toMatch(/<a href="https:\/\/proveedor\.test\/v\.mp4" target="_blank" rel="noopener noreferrer"/)
    expect(html).not.toContain("/api/piezas/11111111-1111-1111-1111-111111111111/video")
    expect(html).toContain("Pedir cambios")
  })
  it("T8 · video SIMULADO (ensayo): no hay reproductor y lo dice en el cuerpo (C09)", async () => {
    const { VisorDePieza } = await import("@/app/piezas/VisorDePieza")
    const html = dibujar(<VisorDePieza pieza={{ ...base, familia: "video_mesa", laminas: [], video: { nombre: "x.mp4", bytes: 10, segundos: 10, simulado: true, solo_en_proveedor: false, vence: null, url_proveedor: null }, guion: null, avisos: [] }} siguienteId={null} />)
    expect(html).not.toContain("<video")
    expect(html).toMatch(/Ensayo: el video es simulado/)
    expect(html).not.toMatch(/Sin dibujo/)
  })
  it("una pieza ya aprobada no muestra botones", async () => {
    const { VisorDePieza } = await import("@/app/piezas/VisorDePieza")
    const html = dibujar(<VisorDePieza pieza={{ ...base, status: "approved", estado: "aprobada" }} siguienteId={null} />)
    expect(html).toMatch(/Aprobada\./)
    expect(html).not.toContain("Rechazar")
  })
})
