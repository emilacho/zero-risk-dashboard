/** LA CARPETA «ARCHIVO · CAMPAÑA ANTERIOR» (CC6 · 03-nov · corrección 3 de Lenovo · marca de CC1 #852: `archivada_en`). Se mira, no se aprueba; las piezas se recuperan. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import { ArchivoDelCalendario, PanelPizarron } from "@/components/nuevo/PanelPizarron"
import { arbolDeLaBandeja, CARPETA_ARCHIVO, CARPETA_OTRAS } from "@/lib/bandeja"
import { ACCIONES } from "@/lib/tablero-acciones"
import { faseActiva, semanasDelTablero, totalesDelTablero, type FilaDelTablero } from "@/lib/pizarron"
import type { DetalleDeLaPieza, FilaDeLaLista } from "@/lib/piezas-datos"

const N = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const HITL = "70b922a5-e9f8-4f48-9134-24f3418d9a0b"
const fila = (id: string, carpeta: string, x: Partial<FilaDeLaLista> = {}): FilaDeLaLista => ({ id, estado: "pendiente", status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: "x", titulo_legible: "Historias Instagram · Náufrago", carpeta, cliente_id: N, cliente: "Náufrago", creada: "2026-11-02T10:00:00Z", gasto_usd: 1, incompleta: false, desacuerdos: 0, tiene_dibujo: true, ...x })

describe("el archivo de una campaña anterior", () => {
  it("Piezas: la carpeta va al final (después de «Otras revisiones») y lo archivado no cuenta como por aprobar", () => {
    const [c] = arbolDeLaBandeja([fila("a", "Historias Instagram")], [fila("o", CARPETA_OTRAS, { es_pieza: false, tipo: "plan_con_pendientes" })], [fila(HITL, CARPETA_ARCHIVO, { archivada: true }), fila("b2", CARPETA_ARCHIVO, { archivada: true, estado: "rechazada", status: "rejected" })])
    expect(c.carpetas.map((k) => k.nombre)).toEqual(["Historias Instagram", CARPETA_OTRAS, CARPETA_ARCHIVO])
    expect(c.carpetas[2].filas.length).toBe(2); expect(c.carpetas[2].por_aprobar).toBe(0); expect(c.por_aprobar).toBe(2) // la de Historias + la otra revisión; nada del archivo
  })
  it("Piezas: una pieza archivada se ve sin botones de decidir; solo «Recuperar»", () => {
    const d: DetalleDeLaPieza = { id: HITL, estado: "pendiente", status: "pending", tipo: "content_piece_review", es_pieza: true, titulo: "Historias Instagram · Náufrago · 31 oct", cliente: "Náufrago", creada: "2026-10-31T13:38:01Z", familia: "kit_historias", brief_id: null, encargo_id: "db7c2d8b-773b-4a49-82d0-602e39da8706", gasto_usd: 1, laminas: [], pie: null, video: null, guion: null, avisos: [], exige_casilla: false, jefatura: { resultado: null, desacuerdos: [], opinion_externa: null, revision_id: null }, aportes: [], version: 1, resumen_de_la_bandeja: null, archivada: true }
    const bandeja = { estado: "todas" as const, por_aprobar: 0, piezas: [], otras: [], archivo: [fila(HITL, CARPETA_ARCHIVO, { archivada: true })], clientes: [{ id: N, nombre: "Náufrago" }], leido_en: "x" }
    const h = renderToStaticMarkup(createElement(PanelPiezas, { onCerrar: () => {}, bandejaInicial: bandeja, piezaInicialDatos: d, clienteInicial: N, piezaInicial: HITL }))
    expect(h).toContain("data-archivada"); expect(h).toContain('data-accion="archivo-recuperar-pieza"'); expect(h).toContain(">Recuperar<")
    expect(h).not.toContain('data-accion="pieza-aprobar"'); expect(h).not.toContain('data-accion="pieza-rechazar"'); expect(h).not.toContain('data-accion="pieza-rehacer"')
    expect(h).toContain('data-chip="archivada"')
  })
  it("«Recuperar» va a la ruta de CC1 con el id de la pieza y no gasta", () => {
    expect(ACCIONES["archivo-recuperar-pieza"].gasta).toBeNull()
    expect(ACCIONES["archivo-recuperar-pieza"].ruta!({})).toBe("/api/cadena/archivo/recuperar-pieza")
    const v = ACCIONES["archivo-recuperar-pieza"].validar({ hitl_id: HITL, otra: "cosa" })
    expect(v).toEqual({ ok: true, cuerpo: { hitl_id: HITL } }); expect(ACCIONES["archivo-recuperar-pieza"].validar({ hitl_id: "no" }).ok).toBe(false)
  })
  it("Calendario: lo archivado sale de las semanas y de las cuentas, y va plegado al final con su cantidad (solo se mira)", () => {
    const f = (id: string, fecha: string, archivada = false): FilaDelTablero => ({ id, fecha, hora: "08:00", red: "instagram", formato: "historia", pilar: null, tema: `Tema ${id}`, sede: null, pieza_fija: false, tanda: 1, semana: 1, estado_fila: "validada", avisos: [], pendientes: [], encargo: null, jefatura: null, pieza: null, tablero: "idea", motivo: "", archivada })
    const vivas = [f("v1", "2026-11-02")], archivo = [f("x1", "2026-11-03", true), f("x2", "2026-11-04", true)]
    const h = renderToStaticMarkup(createElement(PanelPizarron, { onCerrar: () => {}, datosIniciales: { clientes: [{ id: N, nombre: "Náufrago", con_campana: true }], cliente: { id: N, nombre: "Náufrago" }, campana: { id: "c", estado: "pausada", desde: "2026-11-02", hasta: null, version_calendario: 1, version_estrategia: 1 }, fases: [], fase_activa: faseActiva([], "2026-11-02", "2026-11-02"), gran_idea: { texto: null, nota: "x" }, esperas: [], filas: vivas, semanas: semanasDelTablero(vivas), totales: totalesDelTablero(vivas), archivo, hoy: "2026-11-02", leido_en: "x" } }))
    expect(h).toContain("data-carpeta-archivo"); expect(h).toContain("Archivo · campaña anterior"); expect(h).toContain("· 2 publicaciones")
    expect(h).toMatch(/<details data-carpeta-archivo/); expect(h).not.toMatch(/<details data-carpeta-archivo[^>]* open/) // plegada
    expect(h).toContain('data-dia="2026-11-02"'); expect(h).not.toContain('data-dia="2026-11-03"') // lo archivado no entra a las semanas
    expect(renderToStaticMarkup(createElement(ArchivoDelCalendario, { filas: archivo }))).not.toMatch(/<button/) // solo se mira
  })
})
