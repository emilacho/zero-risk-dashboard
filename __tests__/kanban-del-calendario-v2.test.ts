/**
 * KANBAN DEL CALENDARIO v2 (boceto `3-PROPUESTA-v2-kanban-calendario.png` aprobado por Emilio 11-nov 17:59 · GO Lenovo 18:00):
 * - «En el esquema» al inicio, con las filas en esquema (sale del estado de la fila); Piezas no la lleva;
 * - títulos con jerarquía, con los tokens del estilo base: «Centro de campaña» cifra 24 en oro > «Calendario · Kanban · cliente» titulo 20 > columna cuerpo 15 > tarjeta 12;
 * - sin frases de ayuda bajo las columnas ni la línea de ayuda de la cabecera;
 * - «Publicada» vacía dice «Nada aquí», como las demás.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { COLUMNAS, COLUMNAS_DEL_CALENDARIO, armarKanban, tarjetaDeFila } from "@/lib/kanban"
import type { FilaDelTablero } from "@/lib/pizarron"
import type { Pizarron } from "@/lib/pizarron-datos"
import { Kanban } from "@/components/nuevo/Kanban"
import { PanelPizarron } from "@/components/nuevo/PanelPizarron"

const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const fila = (p: Partial<FilaDelTablero>): FilaDelTablero => ({
  id: "f1", fecha: "2026-12-07", hora: "09:00", red: "instagram", formato: "historia", pilar: null, tema: "", sede: "guayaquil", pieza_fija: false, tanda: 3, semana: 6,
  estado_fila: "esquema", avisos: [], pendientes: [], encargo: null, jefatura: null, pieza: null, tablero: "idea", motivo: "esquema", ...p,
})

describe("Kanban del calendario v2 · «En el esquema»", () => {
  it("el calendario lleva 8 columnas con «En el esquema» primero; Piezas sigue con las 7 de siempre", () => {
    expect(COLUMNAS_DEL_CALENDARIO.map((c) => c.clave)).toEqual(["en_esquema", ...COLUMNAS.map((c) => c.clave)])
    expect(COLUMNAS_DEL_CALENDARIO[0]).toMatchObject({ nombre: "En el esquema", activa: true })
    expect(armarKanban([]).map((c) => c.clave)).not.toContain("en_esquema")
    expect(armarKanban([], COLUMNAS_DEL_CALENDARIO).length).toBe(8)
  })
  it("una fila en esquema va a «En el esquema»; una validada sigue en «Por hacer»", () => {
    const e = tarjetaDeFila(fila({}))
    expect(e).toMatchObject({ columna: "en_esquema", estado: "En el esquema", titulo: "Instagram · Historia" })
    expect(tarjetaDeFila(fila({ id: "f2", estado_fila: "validada", motivo: "validada" })).columna).toBe("por_hacer")
    const cols = armarKanban([e, tarjetaDeFila(fila({ id: "f2", estado_fila: "validada" }))], COLUMNAS_DEL_CALENDARIO)
    expect(cols.find((c) => c.clave === "en_esquema")!.tarjetas.map((t) => t.id)).toEqual(["f1|2026-12-07"])
    expect(cols.find((c) => c.clave === "por_hacer")!.tarjetas.map((t) => t.id)).toEqual(["f2|2026-12-07"])
  })
  it("si la fila en esquema ya tiene algo en curso, manda su estado real (no se esconde en el esquema)", () => {
    expect(tarjetaDeFila(fila({ tablero: "mesa" })).columna).toBe("en_el_estudio")
    expect(tarjetaDeFila(fila({ tablero: "emilio" })).columna).toBe("por_aprobar")
    expect(tarjetaDeFila(fila({ tablero: "vencida" })).columna).toBe("vencida")
  })
})

describe("Kanban del calendario v2 · títulos y sin frases de ayuda", () => {
  it("la columna: solo el nombre (cuerpo 15, peso medio) con su número; sin la frase de ayuda debajo", () => {
    const html = renderToStaticMarkup(createElement(Kanban, { columnas: armarKanban([tarjetaDeFila(fila({}))], COLUMNAS_DEL_CALENDARIO), etiqueta: "prueba" }))
    expect(html.match(/<h4 class="[^"]*text-cuerpo font-medio text-hueso/g)!.length).toBe(8)
    for (const c of COLUMNAS_DEL_CALENDARIO) expect(html).not.toContain(`>${c.descripcion}<`)
    expect(html.match(/Nada aquí/g)!.length).toBe(7) // 8 columnas, una con tarjeta; «Publicada» incluida
    expect(html).not.toContain("Se activa cuando")
  })
  it("la cabecera del calendario: «Centro de campaña» (cifra 24, oro) > «Calendario · Kanban · Náufrago» (titulo 20); sin la línea de ayuda", () => {
    const f = fila({})
    const datos: Pizarron = { clientes: [{ id: NAUFRAGO, nombre: "Náufrago", con_campana: true }], cliente: { id: NAUFRAGO, nombre: "Náufrago" }, campana: { id: "c", estado: "en_curso", desde: "2026-11-02", hasta: "2027-01-30", version_calendario: 1, version_estrategia: 1 }, fases: [], fase_activa: { situacion: "antes", fase: null, dia: -1, dias_para_empezar: 1 }, gran_idea: { texto: null, nota: "sin gran idea" }, esperas: [], filas: [f], semanas: [{ desde: "2026-12-07", hasta: "2026-12-13", dias: [{ fecha: "2026-12-07", publicaciones: [f] }] }], totales: { idea: 1 }, hoy: "2026-11-11", leido_en: "x" }
    const h = renderToStaticMarkup(createElement(PanelPizarron, { onCerrar: () => {}, datosIniciales: datos, vistaInicial: "kanban" }))
    expect(h).toMatch(/<h2 id="pizarron-titulo" class="[^"]*text-cifra font-medio text-oro">Centro de campaña<\/h2>/)
    expect(h).toMatch(/<p data-subtitulo="true" class="[^"]*text-titulo font-medio text-hueso">Calendario · Kanban<span data-cliente-cabecera="true" class="text-apagado"> · Náufrago<\/span><\/p>/)
    expect(h).not.toContain("publicación por publicación")
    expect(h).toContain('data-columna="en_esquema"')
    expect(renderToStaticMarkup(createElement(PanelPizarron, { onCerrar: () => {}, datosIniciales: datos, vistaInicial: "calendario" }))).toContain("Calendario · Mes")
  })
})
