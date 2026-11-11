/**
 * LA FECHA DEL VIDEO EN PALABRAS (CC5 · 11-nov · boceto aprobado por Emilio 20:30 Zúrich vía Lenovo). US$ 0 · sin red.
 * Antes el aviso decía «El archivo del video vence 2026-11-18T04:28:33Z» (el valor crudo de la base). Ahora: «vence el 17 nov a las 23:28 (hora de Ecuador)».
 * Vale para los 4 lugares donde sale la fecha: los dos avisos de la pieza y los dos textos de la pestaña Video. Una fecha que no se puede leer no se muestra.
 * Dos clientes de rubros distintos (restaurante y seguridad industrial): nada depende de un cliente.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import type { DetalleDeLaPieza } from "@/lib/piezas-datos"
import { avisosDeLaPieza, type VideoDeLaPieza } from "@/lib/piezas"
import { fechaYHoraEnPalabras } from "@/lib/lenguaje"

const CRUDO = /\d{4}-\d{2}-\d{2}T|undefined|NaN/

// reel real de Náufrago (hitl 319e8a8a): vence 2026-11-18T04:28:33Z = 17 nov 23:28 en Ecuador
const VIDEO_A: VideoDeLaPieza = { nombre: "2026-11-16_1000_instagram_reel_s2_01-de-01.mp4", bytes: 11_758_598, segundos: 12, simulado: false, solo_en_proveedor: false, vence: "2026-11-18T04:28:33Z", url_proveedor: "https://proveedor.test/a.mp4" }
// segundo cliente, otro rubro, otra red y otra fecha
const VIDEO_B: VideoDeLaPieza = { nombre: "2026-12-03_0900_tiktok_video_x_01-de-01.mp4", bytes: 4_000_000, segundos: 20, simulado: false, solo_en_proveedor: false, vence: "2026-12-03T14:05:00Z", url_proveedor: "https://proveedor.test/b.mp4" }
const CASOS: Array<[string, VideoDeLaPieza, string]> = [["Náufrago", VIDEO_A, "17 nov a las 23:28"], ["Zero Risk Seguridad Industrial", VIDEO_B, "3 dic a las 09:05"]]

const detalle = (cliente: string, video: VideoDeLaPieza): DetalleDeLaPieza => ({
  id: "319e8a8a-812e-4573-bbdd-d1a8566f3024", estado: "pendiente", status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: `Video · ${cliente}`, cliente, creada: "2026-11-11T04:32:25Z",
  familia: "video_mesa", brief_id: "b", encargo_id: "86ae3cd3-3490-4225-9dc6-1e8e8029a615", gasto_usd: 1, laminas: [], pie: null, video, guion: null, avisos: [], exige_casilla: false,
  jefatura: { resultado: "limpia", desacuerdos: [], opinion_externa: null, revision_id: null }, aportes: [], version: 1, resumen_de_la_bandeja: null,
  acompana: { fila: null, productores: [], decidida_en: null, rehechura: null },
} as unknown as DetalleDeLaPieza)
const BANDEJA = (d: DetalleDeLaPieza) => ({ estado: "todas" as const, por_aprobar: 1, piezas: [{ id: d.id, estado: "pendiente" as const, status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: "x", titulo_legible: d.titulo, carpeta: "Video", archivada: false, cliente_id: "c1", cliente: d.cliente, creada: d.creada, gasto_usd: 1, incompleta: false, desacuerdos: 0, tiene_dibujo: true }], otras: [], clientes: [{ id: "c1", nombre: d.cliente }], leido_en: "x" })
const dibujar = (d: DetalleDeLaPieza) => renderToStaticMarkup(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: BANDEJA(d) as never, piezaInicialDatos: d }))
const textos = (v: VideoDeLaPieza) => avisosDeLaPieza({ metadata: { familia: "video_mesa" } }, [], v).map((a) => a.texto).join(" | ")

describe("fechaYHoraEnPalabras", () => {
  it("día, mes corto y hora de Ecuador (UTC−5), con minutos de dos cifras", () => {
    expect(fechaYHoraEnPalabras("2026-11-18T04:28:33Z")).toBe("17 nov a las 23:28")
    expect(fechaYHoraEnPalabras("2026-12-03T14:05:00Z")).toBe("3 dic a las 09:05")
    // cambia de año al pasar a la hora de Ecuador
    expect(fechaYHoraEnPalabras("2027-01-01T03:00:00Z")).toBe("31 dic a las 22:00")
    expect(fechaYHoraEnPalabras("2026-11-18T04:28:33+00:00")).toBe("17 nov a las 23:28")
  })
  it("lo que no es fecha no se muestra (null), nunca el valor crudo", () => {
    for (const x of [null, undefined, "", "mañana", "x2026", {}]) expect(fechaYHoraEnPalabras(x)).toBeNull()
  })
})

describe("los avisos de la pieza dicen la fecha en palabras", () => {
  it("con el archivo guardado: «El archivo del video vence el 17 nov a las 23:28 (hora de Ecuador).»", () => {
    for (const [, v, legible] of CASOS) {
      const t = textos(v)
      expect(t).toContain(`El archivo del video vence el ${legible} (hora de Ecuador).`)
      expect(t).not.toContain(v.vence!); expect(t).not.toMatch(CRUDO)
    }
  })
  it("solo en el proveedor: «y vence el … (hora de Ecuador)»", () => {
    for (const [, v, legible] of CASOS) {
      const t = textos({ ...v, nombre: null, bytes: null, solo_en_proveedor: true })
      expect(t).toContain(`El video quedó solo en el proveedor y vence el ${legible} (hora de Ecuador): no se puede mostrar aquí.`)
      expect(t).not.toMatch(CRUDO)
    }
  })
  it("fecha ilegible o ausente: ni aviso de vencimiento ni valor crudo", () => {
    expect(textos({ ...VIDEO_A, vence: "basura" })).not.toMatch(/vence|basura/)
    expect(textos({ ...VIDEO_A, vence: null })).not.toMatch(/vence/)
    const prov = textos({ ...VIDEO_A, vence: "basura", solo_en_proveedor: true })
    expect(prov).toContain("El video quedó solo en el proveedor: no se puede mostrar aquí."); expect(prov).not.toContain("basura")
  })
})

describe("la pestaña Video dice la fecha en palabras", () => {
  it("solo en el proveedor: el texto y el enlace «Bajarlo del proveedor antes del …»", () => {
    for (const [cliente, v, legible] of CASOS) {
      const h = dibujar(detalle(cliente, { ...v, nombre: null, bytes: null, solo_en_proveedor: true }))
      expect(h).toContain(`(vence el ${legible}, hora de Ecuador)`)
      expect(h).toContain(`antes del ${legible} (hora de Ecuador)`)
      expect(h).not.toContain(v.vence!)
    }
  })
  it("fecha ilegible: el texto sin fecha, sin el valor crudo", () => {
    const h = dibujar(detalle("Náufrago", { ...VIDEO_A, vence: "basura", nombre: null, bytes: null, solo_en_proveedor: true }))
    expect(h).toContain("El video quedó solo en el proveedor: no se puede mostrar aquí."); expect(h).not.toContain("basura")
  })
})
