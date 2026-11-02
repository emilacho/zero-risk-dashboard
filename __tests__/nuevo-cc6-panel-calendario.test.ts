/** EL CALENDARIO POR DÍA CON EL PATRÓN DEL PLAN Y EL MANUAL (CC6 · 02-nov · boceto aprobado por Emilio). Solo lectura. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PanelPizarron } from "@/components/nuevo/PanelPizarron"
import { estadoCortoDeLaPublicacion, loQueTeTocaEnElCalendario, origenDeLaPublicacion, resumenDeLaSemana, semanaInicial, diaConNombre } from "@/lib/calendario"
import { faseActiva, semanasDelTablero, totalesDelTablero, type FilaDelTablero } from "@/lib/pizarron"
import type { Pizarron } from "@/lib/pizarron-datos"

const CLIENTE = { id: "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", nombre: "Náufrago" }
const fila = (id: string, fecha: string, estado_fila: string, p: Partial<FilaDelTablero> = {}): FilaDelTablero => ({ id, fecha, hora: "08:00", red: "instagram", formato: "historia", pilar: null, tema: `Tema ${id}`, sede: null, pieza_fija: false, tanda: 1, semana: 1, estado_fila, avisos: [], pendientes: [], encargo: null, jefatura: null, pieza: null, tablero: "idea", motivo: "", ...p })
const FASES = [{ clave: "senal", objetivo: "Juntar señal en Olón", dia_desde: 1, dia_hasta: 30 }]
const datos = (filas: FilaDelTablero[], hoy = "2026-11-02"): Pizarron => ({
  clientes: [{ ...CLIENTE, con_campana: true }], cliente: CLIENTE, campana: { id: "c", estado: "activa", desde: "2026-11-02", hasta: "2027-01-30", version_calendario: 1, version_estrategia: 1 },
  fases: FASES, fase_activa: faseActiva(FASES, "2026-11-02", hoy), gran_idea: { texto: null, nota: "sin gran idea" }, esperas: [], filas, semanas: semanasDelTablero(filas), totales: totalesDelTablero(filas), hoy, leido_en: "x",
})
const FILAS = [
  fila("a", "2026-11-02", "en_investigacion", { fase: "senal", idea_ref: "C1-I03", origen: "agente" }),
  fila("b", "2026-11-02", "briefeada", { hora: "11:00" }),
  fila("c", "2026-11-05", "descartada_sin_fuente", { tablero: "descartada" }),
  fila("d", "2026-11-10", "validada"),
]

describe("el calendario por día", () => {
  it("abre por día: la semana de hoy, solo los días con publicaciones, cada una con su estado en palabras; la cuadrícula del mes y el Kanban siguen", () => {
    const h = renderToStaticMarkup(createElement(PanelPizarron, { onCerrar: () => {}, datosIniciales: datos(FILAS) }))
    expect(h).toContain('data-vista-tablero="dias" aria-pressed="true"'); expect(h).toContain('data-vista-tablero="calendario"'); expect(h).toContain('data-vista-tablero="kanban"')
    expect(h).toContain('data-vista="por-dia"'); expect(h).not.toContain('role="grid"')
    expect(h).toContain('data-dia="2026-11-02"'); expect(h).toContain('data-dia="2026-11-05"'); expect(h).not.toContain('data-dia="2026-11-03"'); expect(h).not.toContain('data-dia="2026-11-10"') // otra semana
    expect(h).toContain("lun 2 nov · hoy"); expect(h).toContain(">se investiga un dato<"); expect(h).toContain(">con brief<"); expect(h).toContain(">descartada: sin fuente<")
    expect(h).toContain("Señal · idea C1-I03") // la fase y la idea de la gran idea de la que sale
    expect(h).toContain('data-semana="2" aria-pressed="false"')
  })
  it("la barra fija: el resumen de la semana, la fase y el día, y «nada que firmar»", () => {
    const h = renderToStaticMarkup(createElement(PanelPizarron, { onCerrar: () => {}, datosIniciales: datos(FILAS) }))
    expect(h).toContain("data-barra-del-calendario"); expect(h).toContain("Semana 1 · 2 nov – 8 nov")
    expect(h).toContain("3 publicaciones · ")
    expect(h).toContain("Día 1 · fase Señal"); expect(h).toContain("Nada: el calendario no se firma.")
    expect(h).not.toMatch(/aprobar\b|Firmar/i)
  })
  it("a pantalla completa, como Dinero (corrección 1 de Lenovo · reserva D7 de CC3)", () => {
    const h = renderToStaticMarkup(createElement(PanelPizarron, { onCerrar: () => {}, datosIniciales: datos(FILAS) }))
    expect(h).toMatch(/<div class="nv-panel fixed inset-0[^"]*p-1\.5[^"]*sm:p-2"/)
    expect(h).toMatch(/data-seccion="pizarron"[^>]*data-pantalla-completa[^>]*class="relative flex h-full max-h-full w-full flex-col/)
    expect(h).not.toMatch(/data-seccion="pizarron"[^>]*max-w-\[/)
  })
  it("con piezas en tu bandeja, la barra lo dice", () => {
    expect(loQueTeTocaEnElCalendario(2)).toBe("2 piezas esperan tu aprobación: ábrelas desde su publicación (en ámbar).")
    expect(loQueTeTocaEnElCalendario(1)).toMatch(/^1 pieza espera tu aprobación: ábrela /)
  })
  it("las palabras de cada estado, el origen sin inventar nombres y la semana de entrada", () => {
    expect(estadoCortoDeLaPublicacion(fila("x", "2026-11-02", "espera_video"))).toBe("espera video")
    expect(estadoCortoDeLaPublicacion(fila("x", "2026-11-02", "briefeada", { pieza: { id: "p", status: "pending", estado: "pendiente", expires_at: null, created_at: "x" }, tablero: "emilio" }))).toBe("esperando tu aprobación")
    expect(origenDeLaPublicacion("patron")).toBe("el patrón de publicación del plan"); expect(origenDeLaPublicacion("agente")).toMatch(/un empleado/); expect(origenDeLaPublicacion(null)).toBeNull()
    const s = semanasDelTablero(FILAS)
    expect(semanaInicial(s, "2026-11-11")).toBe(1); expect(semanaInicial(s, "2026-10-01")).toBe(0); expect(semanaInicial(s, "2027-03-01")).toBe(1)
    expect(resumenDeLaSemana(s[0]).total).toBe(3); expect(diaConNombre("2026-11-05")).toBe("jue 5 nov")
    // reserva P3 de CC3: el resumen va de más a menos publicaciones
    const muchas = semanasDelTablero([fila("e1", "2026-11-02", "espera_video"), fila("v1", "2026-11-03", "validada"), fila("i1", "2026-11-04", "en_investigacion"), fila("i2", "2026-11-05", "en_investigacion"), fila("v2", "2026-11-05", "validada"), fila("i3", "2026-11-06", "en_investigacion")])
    expect(resumenDeLaSemana(muchas[0]).partes).toEqual(["se investiga un dato ×3", "validada ×2", "espera video"])
  })
})
