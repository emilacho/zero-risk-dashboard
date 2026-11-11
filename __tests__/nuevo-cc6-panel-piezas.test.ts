/** LA PIEZA CON EL PATRÓN DEL PLAN Y EL MANUAL (CC6 · 02-nov · boceto aprobado por Emilio): barra con la fila del calendario, la jefatura y quién la hizo; avance tras pedir cambios. La decisión es la de siempre. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import { avanceDeLaPieza, leerLoQueAcompana, productoresDe, quienLaHizo } from "@/lib/pieza-acompana"
import type { DetalleDeLaPieza } from "@/lib/piezas-datos"
import type { SupabaseClient } from "@supabase/supabase-js"

const PIEZA = "70b922a5-e9f8-4f48-9134-24f3418d9a0b"
const DETALLE: DetalleDeLaPieza = {
  id: PIEZA, estado: "pendiente", status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: "Historias Instagram · Náufrago · 2 nov", cliente: "Náufrago", creada: "2026-11-02T13:38:01.926Z",
  familia: "kit_historias", brief_id: null, encargo_id: "e1", gasto_usd: 1, laminas: [{ n: 1, nombre: "01.png", ancho: 1080, alto: 1920, origen: "con_imagen", eyebrow: null, titular: "¿Qué lleva el encebollado?", cuerpo: null, pie: null, glifos_riesgosos: false }],
  pie: "x", video: null, guion: null, avisos: [], exige_casilla: false, jefatura: { resultado: "limpia", desacuerdos: [], opinion_externa: null, revision_id: "r1" }, aportes: [], version: 1, resumen_de_la_bandeja: null,
  acompana: {
    fila: { fecha: "2026-11-02", hora: "11:00", semana: 1, red: "instagram", formato: "historia", pilar: "producto", sede: "olon", tema: "Quiz: ¿qué lleva un encebollado?", fase: "senal", idea_ref: "C1-I03" },
    productores: productoresDe([{ donde: "texto", agente: "content-creator" }, { donde: "hashtags", agente: "content-creator" }, { donde: "imagen", agente: "marketing_instagram_curator" }, { donde: "imagen", agente: "marketing_instagram_curator" }]),
    decidida_en: null, rehechura: null,
  },
}
const BANDEJA = { estado: "todas" as const, por_aprobar: 1, piezas: [{ id: PIEZA, estado: "pendiente" as const, status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: "x", titulo_legible: "Historias Instagram · Náufrago · 2 nov", carpeta: "Historias Instagram", cliente_id: "n", cliente: "Náufrago", creada: "2026-11-02T13:38:01.926Z", gasto_usd: 1, incompleta: false, desacuerdos: 0, tiene_dibujo: true }], otras: [], clientes: [{ id: "n", nombre: "Náufrago" }], leido_en: "x" }
const dibujar = (d: DetalleDeLaPieza) => renderToStaticMarkup(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: BANDEJA, piezaInicialDatos: d }))

describe("la pieza con su barra", () => {
  it("la barra: primero la fila del calendario, luego la jefatura y quién la hizo con el nombre real; los botones grandes de siempre", () => {
    const h = dibujar(DETALLE)
    const i = (x: string) => h.indexOf(x)
    // 11-nov (panel derecho aprobado por Emilio): los recuadros de la fila arriba; Revisión, Equipo y Detalle plegados abajo, en ese orden
    expect(i('data-recuadro="Cuándo"')).toBeGreaterThan(-1); expect(i('data-recuadro="Cuándo"')).toBeLessThan(i('data-plegado="Revisión"')); expect(i('data-plegado="Revisión"')).toBeLessThan(i('data-plegado="Equipo"')); expect(i('data-plegado="Equipo"')).toBeLessThan(i('data-plegado="Detalle"'))
    expect(h).toContain("Lun 2 nov · 11:00"); expect(h).toContain("Señal"); expect(h).not.toContain("C1-I03")
    expect(h).toContain("Redactor"); expect(h).toContain("texto · hashtags"); expect(h).toContain("Especialista"); expect(h).not.toContain("content-creator"); expect(h).not.toContain("marketing_instagram_curator")
    expect(h).toContain('data-accion="pieza-aprobar"'); expect(h).not.toContain("data-barra-del-pedido")
  })
  it("sin fila ni productores lo dice (no inventa)", () => {
    const h = dibujar({ ...DETALLE, acompana: { fila: null, productores: [], decidida_en: null, rehechura: null } })
    expect(h).toContain("no está atada a una fila del calendario"); expect(h).toContain("La jefatura no guardó quién hizo cada parte")
  })
  it("tras «pedir cambios», la barra de avance hasta que la pieza nueva llega a la bandeja", () => {
    const h = dibujar({ ...DETALLE, estado: "con_cambios", status: "edited", acompana: { ...DETALLE.acompana!, rehechura: { estado: "en_paso", creado_en: "2026-11-02T14:00:00Z", nueva_en_bandeja: false } } })
    expect(h).toContain("data-barra-del-pedido"); expect(h).toContain("La oficina creativa rehace la pieza")
    expect(avanceDeLaPieza("con_cambios", { decidida_en: null, rehechura: { estado: "en_paso", creado_en: "2026-11-02T14:00:00Z", nueva_en_bandeja: true } }, new Date())).toBeNull()
    expect(avanceDeLaPieza("con_cambios", { decidida_en: null, rehechura: { estado: "en_paso", creado_en: "2026-11-02T14:00:00Z", nueva_en_bandeja: false } }, new Date("2026-11-02T14:09:00Z"))?.estimado).toBe("Van 9 min desde que la oficina lo tomó")
    expect(avanceDeLaPieza("con_cambios", { decidida_en: null, rehechura: null }, new Date())?.pasos[1].detalle).toMatch(/no tomó el pedido/)
    expect(avanceDeLaPieza("con_cambios", { decidida_en: null, rehechura: { estado: "fallido", creado_en: null, nueva_en_bandeja: false } }, new Date())?.fallo?.que_hacer).toMatch(/Rehacer esta pieza/)
    expect(avanceDeLaPieza("aprobada", { decidida_en: null, rehechura: null }, new Date())).toBeNull()
  })
  it("quién la hizo, agrupado por empleado y sin repetir", () => {
    expect(quienLaHizo(DETALLE.acompana!.productores)).toEqual([{ agente: "content-creator", que: ["texto", "hashtags"] }, { agente: "marketing_instagram_curator", que: ["imagen"] }])
    expect(productoresDe(null)).toEqual([]); expect(productoresDe([{ donde: "x" }])).toEqual([])
  })
  it("la lectura: fila por el encargo, productores por la revisión, la rehechura por el encargo nuevo; una lectura que falla deja el bloque vacío", async () => {
    const pedidos: string[] = []
    const filtros: string[] = []
    const respuestas: Record<string, unknown[]> = {
      oficina_encargos: [{ sala_ref: { fila: { id: "s1-d1", fecha: "2026-11-02", hora: "11:00" } } }],
      cadena_calendario_filas: [{ fecha: "2026-11-02", hora: "11:00:00", semana: 1, red: "instagram", formato: "historia", fase: "senal", idea_ref: null }],
      jefatura_revisiones: [{ productores: [{ donde: "texto", agente: "content-creator" }] }],
    }
    const supa = { from: (t: string) => { pedidos.push(t); const q: Record<string, unknown> = {}; for (const m of ["select", "order", "limit"]) q[m] = () => q; q.eq = (c: string, v: unknown) => { filtros.push(`${t}.${c}=${String(v)}`); return q }; q.then = (r: (x: unknown) => unknown) => r(t === "hitl_queue" ? { data: null, error: { message: "caída" } } : { data: respuestas[t] ?? [], error: null }); return q } } as unknown as SupabaseClient
    const a = await leerLoQueAcompana(supa, { hitl_id: PIEZA, encargo_id: "e1", revision_id: "r1", decision: { pidio_cambios: true } })
    expect(a.fila).toMatchObject({ fecha: "2026-11-02", hora: "11:00", fase: "senal" }); expect(a.productores).toEqual([{ donde: "texto", agente: "content-creator" }])
    expect(a.rehechura).toMatchObject({ nueva_en_bandeja: false }) // la bandeja falló: no se da por llegada
    expect(pedidos).toContain("cadena_calendario_filas")
    // reserva P16 de CC3: la fila se busca por su id Y su fecha (el mismo id se repite en otras semanas)
    expect(filtros).toContain("cadena_calendario_filas.id=s1-d1"); expect(filtros).toContain("cadena_calendario_filas.fecha=2026-11-02")
  })
})
