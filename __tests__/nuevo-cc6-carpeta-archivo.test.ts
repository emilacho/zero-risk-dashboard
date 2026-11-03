/** LA CARPETA «ARCHIVO · CAMPAÑA ANTERIOR» (CC6 · 03-nov · corrección 3 de Lenovo · marca de CC1 #852: `archivada_en`). Se mira, no se aprueba; las piezas se recuperan. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import { ArchivoDelCalendario, PanelPizarron } from "@/components/nuevo/PanelPizarron"
import { arbolDeLaBandeja, CARPETA_ARCHIVO, CARPETA_OTRAS } from "@/lib/bandeja"
import { ACCIONES } from "@/lib/tablero-acciones"
import { faseActiva, semanasDelTablero, totalesDelTablero, type FilaDelTablero } from "@/lib/pizarron"
import { cargarPieza, type DetalleDeLaPieza, type FilaDeLaLista } from "@/lib/piezas-datos"
import { leerPizarron } from "@/lib/pizarron-datos"

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
  // reservas G4 y G7 de CC3 (#199): la LECTURA (no solo la pantalla) deja lo archivado fuera, y el detalle de la pieza conserva su marca
  const base = (tablas: Record<string, Array<Record<string, unknown>>>) => ({ from: (t: string) => {
    let d = [...(tablas[t] ?? [])]
    const q: Record<string, unknown> = {}
    for (const m of ["select", "order", "limit", "like", "gte", "neq", "not"]) q[m] = () => q
    q.eq = (c: string, v: unknown) => { d = d.filter((f) => f[c] === v); return q }
    q.in = (c: string, v: unknown[]) => { d = d.filter((f) => v.includes(f[c])); return q }
    q.is = (c: string, v: unknown) => { d = d.filter((f) => (f[c] ?? null) === v); return q }
    q.maybeSingle = () => Promise.resolve({ data: d[0] ?? null, error: null })
    q.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: d, error: null }).then(ok)
    return q
  } }) as never
  it("G4 · la lectura del calendario saca lo archivado de las filas, las semanas y las cuentas, y lo entrega aparte", async () => {
    const C = "c1"
    const fl = (id: string, fecha: string, archivada_en: string | null = null) => ({ campana_id: C, calendario_version: 1, id, fecha, hora: "08:00:00", red: "instagram", formato: "historia", tema: id, estado: "validada", seco: false, avisos: [], pendientes: [], archivada_en })
    const p = await leerPizarron(base({
      clients: [{ id: N, name: "Náufrago", industry: "restaurante", status: "active", archived_at: null }],
      cadena_campanas: [{ id: C, client_id: N, estado: "reemplazada", fecha_inicio: "2026-11-02", seco: false, creada_en: "2026-10-30" }],
      cadena_calendario_filas: [fl("viva", "2026-11-02"), fl("arch1", "2026-11-03", "2026-11-02T16:40:05Z"), fl("arch2", "2026-11-04", "2026-11-02T16:40:05Z")],
    }), { cliente: N, ahora: new Date("2026-11-02T12:00:00Z") })
    expect(p.filas.map((f) => f.id)).toEqual(["viva"]); expect(p.archivo?.map((f) => f.id)).toEqual(["arch1", "arch2"])
    expect(p.totales).toEqual({ idea: 1 }); expect(p.semanas.flatMap((s) => s.dias.flatMap((d) => d.publicaciones.map((x) => x.id)))).toEqual(["viva"])
  })
  it("G7 · el detalle de una pieza archivada conserva su marca (y la recuperada, la suya)", async () => {
    const hitl = { id: HITL, status: "rejected", type: "content_piece_review", client_id: null, created_at: "2026-10-31T13:38:01Z", title: "x", output_preview: null, decision: {}, metadata: {}, archivada_en: "2026-11-02T16:40:05Z" }
    expect((await cargarPieza(base({ hitl_queue: [hitl] }), HITL))?.archivada).toBe(true)
    const vuelta = { ...hitl, archivada_en: null, status: "pending", metadata: { recuperada_del_archivo: true } }
    const d = await cargarPieza(base({ hitl_queue: [vuelta] }), HITL)
    expect(d?.archivada).toBe(false); expect(d?.recuperada_del_archivo).toBe(true)
  })
  it("la escena de la oficina no cuenta como pendiente una pieza archivada (reserva de CC3 a #199)", () => {
    expect(readFileSync("lib/escena-avatares-datos.ts", "utf8")).toMatch(/from\("hitl_queue"\)\.select\("id, expires_at, client_id, documento"\)\.eq\("status", "pending"\)\.is\("archivada_en", null\)/) // CC6 · 03-nov: + cliente y documento (manual primero)
  })
})
