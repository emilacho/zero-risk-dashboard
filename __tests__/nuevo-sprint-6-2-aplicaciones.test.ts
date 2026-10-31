/**
 * DASHBOARD NUEVO · SPRINT 6.2 · LAS APLICACIONES DEL DEPT. MARKETING (Emilio, 31-oct): al abrir el pizarrón aparece una «pantalla de inicio» como la de un
 * celular con un cuadro por cada cosa que marketing ya tiene del cliente (lista cerrada por Emilio: sin oficinas/en vivo ni alertas); cada cuadro es un atajo
 * a una pantalla que ya existe y solo «Calendario» se abre encima. Nada escribe.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { APARTADOS_DE_LA_FICHA, APLICACIONES } from "@/lib/aplicaciones-marketing"
import { PanelAplicaciones, detalleDelCuadro } from "@/components/nuevo/PanelAplicaciones"
import { faseActiva, semanasDelTablero, totalesDelTablero, type FilaDelTablero } from "@/lib/pizarron"
import { GRAN_IDEA_SIN_TABLA, type Pizarron } from "@/lib/pizarron-datos"

const CLIENTE = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"

const filas: FilaDelTablero[] = [
  { id: "s1-d1-lun_historia", fecha: "2026-11-02", hora: "11:00", red: "instagram", formato: "historia", pilar: "producto", tema: "Encebollado", sede: null, pieza_fija: false, tanda: 1, semana: 1, estado_fila: "briefeada", avisos: [], pendientes: [], encargo: { id: "e", familia: "kit_historias", estado: "cerrado", gasto_usd: 0.42, creado_en: "x" }, jefatura: { estado: "cerrada", resultado: "limpia" }, pieza: { id: "70b922a5-e9f8-4f48-9134-24f3418d9a0b", status: "pending", estado: "pendiente", expires_at: null, created_at: "x" }, tablero: "emilio", motivo: "la pieza está en tu bandeja" },
  { id: "s1-d1-lun_foto", fecha: "2026-11-02", hora: "15:00", red: "instagram", formato: "foto", pilar: "lugar", tema: "La terraza", sede: null, pieza_fija: false, tanda: 1, semana: 1, estado_fila: "en_investigacion", avisos: [], pendientes: [], encargo: null, jefatura: null, pieza: null, tablero: "idea", motivo: "en investigación" },
]
const fases = [{ clave: "senal", objetivo: "Juntar señal", dia_desde: 1, dia_hasta: 30 }]
const datos: Pizarron = {
  clientes: [{ id: CLIENTE, nombre: "Náufrago", con_campana: true }, { id: "11111111-1111-4111-8111-111111111111", nombre: "Otro", con_campana: false }], cliente: { id: CLIENTE, nombre: "Náufrago" },
  campana: { id: "c", estado: "pausada", desde: "2026-11-02", hasta: "2027-01-30", version_calendario: 1, version_estrategia: 1 },
  fases, fase_activa: faseActiva(fases, "2026-11-02", "2026-11-05"),
  gran_idea: GRAN_IDEA_SIN_TABLA, esperas: [], filas, semanas: semanasDelTablero(filas), totales: totalesDelTablero(filas), hoy: "2026-11-05", leido_en: "x",
}

describe("sprint 6.2 · las aplicaciones del Dept. Marketing", () => {
  it("la lista es la que cerró Emilio: seis cuadros, sin oficinas/en vivo ni alertas, y cada uno lleva a algo que ya existe", () => {
    expect(APLICACIONES.map((a) => a.nombre)).toEqual(["Manual de marca", "Plan de 90 días", "Calendario", "Piezas", "Cerebro", "Gasto"])
    expect(APLICACIONES.map((a) => a.enlace(CLIENTE))).toEqual([`/clientes/${CLIENTE}#manual`, `/clientes/${CLIENTE}#plan`, null, "/piezas", `/clientes/${CLIENTE}#cerebro`, "/gasto"])
    // sin cliente elegido, los cuadros de la ficha llevan a la lista de clientes (no a una ficha rota)
    expect(APLICACIONES.find((a) => a.clave === "manual")!.enlace(null)).toBe("/clientes")
    for (const a of APLICACIONES) expect(a.nombre).not.toMatch(/oficina|en vivo|alerta/i)
  })
  it("la ficha del cliente tiene los apartados a los que llegan los cuadros (ids reales en la página)", () => {
    const ficha = readFileSync("app/clientes/[id]/page.tsx", "utf8")
    for (const id of APARTADOS_DE_LA_FICHA) expect(ficha).toContain(`id="${id}"`)
    expect(ficha).toContain("scroll-mt-24") // el apartado no queda tapado por la barra al llegar con #ancla
    for (const a of APLICACIONES) { const m = a.enlace(CLIENTE)?.match(/#(\w+)$/); if (m) expect(APARTADOS_DE_LA_FICHA).toContain(m[1]) }
  })
  it("la segunda línea de cada cuadro sale de la lectura real cuando la hay", () => {
    expect(detalleDelCuadro("plan", datos).texto).toBe("Día 4 · fase senal")
    expect(detalleDelCuadro("calendario", datos).texto).toBe("2 publicaciones · calendario v1")
    expect(detalleDelCuadro("piezas", datos)).toEqual({ texto: "1 pieza espera tu aprobación", aviso: true })
    expect(detalleDelCuadro("piezas", { ...datos, filas: [], totales: {} })).toEqual({ texto: "Nada por aprobar ahora", aviso: false })
    expect(detalleDelCuadro("plan", { ...datos, campana: null }).texto).toBe("Sin campaña todavía")
    expect(detalleDelCuadro("manual", null).texto).toBe("Propósito, misión, voz, eslogan y quién lo validó")
    expect(detalleDelCuadro("gasto", datos).texto).toBe("Lo gastado en los últimos 30 días")
  })
  it("el panel dibuja los seis cuadros como enlaces (el calendario como botón que abre encima), el selector de cliente y el aviso en Piezas", () => {
    const html = renderToStaticMarkup(createElement(PanelAplicaciones, { onCerrar: () => {}, datosIniciales: datos }))
    expect(html).toContain('role="dialog"'); expect(html).toContain('data-seccion="aplicaciones"'); expect(html).toContain("Dept. Marketing")
    expect(html.match(/data-aplicacion="/g)?.length).toBe(6)
    expect(html).toMatch(new RegExp(`<a[^>]*href="/clientes/${CLIENTE}#manual"[^>]*data-aplicacion="manual"`))
    expect(html).toMatch(/<a[^>]*href="\/piezas"[^>]*data-aplicacion="piezas" data-aviso="true"/)
    expect(html).toMatch(/<button type="button" data-aplicacion="calendario" data-aviso="false"[^>]*aria-haspopup="dialog"/)
    expect(html).toContain("1 pieza espera tu aprobación"); expect(html).toContain("Día 4 · fase senal"); expect(html).toContain("2 publicaciones · calendario v1")
    expect(html).toMatch(/aria-label="Elegir el cliente"/); expect(html).toContain(`<option value="${CLIENTE}"`); expect(html).toContain("Otro · sin campaña")
    expect(html).not.toContain('data-seccion="pizarron"') // el calendario no está abierto de entrada
    expect(html).not.toMatch(/decidir|aprobar\b/i)
    const c = readFileSync("components/nuevo/PanelAplicaciones.tsx", "utf8")
    expect(c).not.toContain('method: "POST"'); expect(c).toContain('window.addEventListener("keydown", tecla, true)') // Esc cierra las aplicaciones y no la oficina
    expect(c).toContain('if (vista !== "inicio") return') // con el calendario encima, su Esc manda y solo vuelve a las aplicaciones
    expect(c).toContain("<PanelPizarron onCerrar={volverAlInicio} datosIniciales={datos} />")
    expect(c).toContain("@media (prefers-reduced-motion:reduce)")
  })
  it("el tablero de la oficina abre primero las aplicaciones (la escena ya no monta el calendario directo)", () => {
    const e = readFileSync("components/nuevo/EscenaViva.tsx", "utf8")
    expect(e).toContain("createPortal(<PanelAplicaciones onCerrar={cerrarPizarron} />, document.body)")
    expect(e).not.toContain("<PanelPizarron")
  })
})
