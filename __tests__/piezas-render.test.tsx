/**
 * LA VENTANA DE PIEZAS · el visor se dibuja sin romper con los tres casos que Emilio va a ver: pieza con revisión incompleta (casilla), pieza sin dibujo y fila de otro tipo (solo lectura). US$ 0, sin red.
 */
import { describe, expect, it, vi } from "vitest"
import { renderToString } from "react-dom/server"
import type { DetalleDeLaPieza } from "@/lib/piezas-datos"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }))

const base: DetalleDeLaPieza = {
  id: "11111111-1111-1111-1111-111111111111", estado: "pendiente", status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: "⚠️ REVISIÓN INCOMPLETA · Carrusel BRF-0001", cliente: "Zero Risk",
  creada: "2026-10-28T11:56:00Z", familia: "carrusel_ig_v1", brief_id: "BRF-0001", encargo_id: "enc-1", gasto_usd: 1.84, pie: "Pie de la publicación", version: 3,
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
    expect(html).toMatch(/Sin dibujo\. Esta pieza no tiene láminas dibujadas/)
    expect(html).not.toContain("/lamina/1")
    expect(html).not.toContain("juntas")
  })
  it("fila de otro tipo (competidores): sin botones de aprobar, dice dónde se resuelve", async () => {
    const { VisorDePieza } = await import("@/app/piezas/VisorDePieza")
    const html = dibujar(<VisorDePieza pieza={{ ...base, tipo: "confirm_competitor_list", es_pieza: false, laminas: [], avisos: [] }} siguienteId={null} />)
    expect(html).toMatch(/«confirmar lista de competidores», no una pieza: se resuelve en su propia pantalla/)
    expect(html).not.toContain("confirm_competitor_list")
    expect(html).not.toContain("Pedir cambios")
  })
  it("una pieza ya aprobada no muestra botones", async () => {
    const { VisorDePieza } = await import("@/app/piezas/VisorDePieza")
    const html = dibujar(<VisorDePieza pieza={{ ...base, status: "approved", estado: "aprobada" }} siguienteId={null} />)
    expect(html).toMatch(/ya está «aprobada»/)
    expect(html).not.toContain("Rechazar")
  })
})
