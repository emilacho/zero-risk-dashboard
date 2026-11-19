// @vitest-environment jsdom
/**
 * G2b · las 2 ventanas de Piezas (pedido de CC7 00:18Z, k7 y k8): al ABRIR el diálogo, el cuadro de texto deja escribir hasta el tope único
 * (`TOPE_DEL_TEXTO_DEL_DUENO`, 100 000). Con `maxLength={2000}` el navegador cortaba en silencio lo que Emilio escribía o pegaba.
 * Prueba de conducta: se dibuja el visor, se toca «Pedir cambios…» y se lee el `textarea` que aparece.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { DetalleDeLaPieza } from "@/lib/piezas-datos"
import { detalleDelConcepto, TIPO_CONCEPTO } from "@/lib/concepto-datos"
import { TOPE_DEL_TEXTO_DEL_DUENO } from "@/lib/tope-del-texto"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }))
afterEach(cleanup)

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

const CAMP = "36e66179-0000-4000-8000-000000000000"
const hitl = {
  id: "6f1c2a7e-0b1d-4c3e-9a8f-1234567890ab", client_id: "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", agent_name: "cadena · concepto", risk_type: "strategic_decision", type: TIPO_CONCEPTO,
  status: "pending", priority: "high", payload: {}, decision: null, title: "Gran idea · campaña Náufrago", output_preview: "", created_at: "2026-11-18T21:00:00.000Z", expires_at: null,
  metadata: { origen: "cadena", tipo: "concepto", campana_id: CAMP, version: 1, brief_version: 1, seco: true, costo_usd: 0.1, vueltas_restantes: 2, avisos: [], resumen_del_banco: {} },
}
const concepto = {
  campana_id: CAMP, version: 1, estado: "lista", aprobacion: "pendiente", costo_usd: "0.1000", nota_de_emilio: null, apunta_a: null, decidido_en: null, seco: true,
  leido: { contrato: "concepto.v1", gran_idea: { nombre: "La mesa", frase: "Hay mesa" }, capitulos: [], banco: [], ideas_descartadas: [], ideas_que_salen: [], citas: "", fotos_citadas: [], banco_parcial: [], avisos: [], bloqueos: [], estado: "ok" },
}
const brief = { version: 1, estado: "validada", texto_md: "## Insight\nHay mesa" }

const LARGO = "w".repeat(5000)
const cuadro = () => screen.getByRole("dialog").querySelector("textarea") as HTMLTextAreaElement

describe("G2b · las ventanas de Piezas no cortan lo que escribe Emilio", () => {
  it("🔴 k7 · VisorDePieza · «Pedir cambios…» abre un cuadro con maxLength = el tope único; 5000 quedan enteros", async () => {
    expect(TOPE_DEL_TEXTO_DEL_DUENO).toBe(100_000)
    const { VisorDePieza } = await import("@/app/piezas/VisorDePieza")
    render(<VisorDePieza pieza={{ ...base, exige_casilla: false }} siguienteId={null} />)
    fireEvent.click(screen.getByRole("button", { name: /^Pedir cambios/ }))
    const t = cuadro()
    expect(t.maxLength).toBe(TOPE_DEL_TEXTO_DEL_DUENO)
    fireEvent.change(t, { target: { value: LARGO } })
    expect(cuadro().value).toBe(LARGO)
  })
  it("🔴 k7 · VisorDePieza · «Rechazar…» usa el mismo cuadro, con el mismo tope", async () => {
    const { VisorDePieza } = await import("@/app/piezas/VisorDePieza")
    render(<VisorDePieza pieza={{ ...base, exige_casilla: false }} siguienteId={null} />)
    fireEvent.click(screen.getByRole("button", { name: /^Rechazar/ }))
    expect(cuadro().maxLength).toBe(TOPE_DEL_TEXTO_DEL_DUENO)
  })
  it("🔴 k8 · VisorDeConcepto · «Pedir cambios…» abre un cuadro con maxLength = el tope único; 5000 quedan enteros", async () => {
    const { VisorDeConcepto } = await import("@/app/piezas/VisorDeConcepto")
    render(<VisorDeConcepto concepto={detalleDelConcepto({ hitl, concepto, brief, cliente: "Náufrago" })} />)
    fireEvent.click(screen.getByRole("button", { name: /^Pedir cambios/ }))
    const t = cuadro()
    expect(t.maxLength).toBe(TOPE_DEL_TEXTO_DEL_DUENO)
    fireEvent.change(t, { target: { value: LARGO } })
    expect(cuadro().value).toBe(LARGO)
  })
})
