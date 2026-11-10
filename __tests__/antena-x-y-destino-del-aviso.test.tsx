/** 09-nov · CORRECCIÓN de Lenovo (Emilio en producción): la ✕ de la lista no cerraba y el aviso del cerebro llevaba a otra pantalla. US$ 0 · sin red. */
import { afterEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

const portales: unknown[] = []
vi.mock("react-dom", async (original) => ({ ...(await original<typeof import("react-dom")>()), createPortal: (hijo: unknown, destino: unknown) => { portales.push(destino); return hijo } }))

import { DESTINO_DEL_AVISO, cerebroNoCorrio, colgadas, fallidas, gastosRaros, preguntasSinResponder, type AlertaDeLaAntena, type EntradaDeAlertas } from "@/lib/escena-alertas"
import { ListaDeLasAlertas, PanelDeLasAlertas, alTocarElAviso, enElCuerpo } from "@/components/nuevo/escena/AntenaDeAlertas"

const AHORA = new Date("2026-11-09T19:00:00Z")
const hace = (h: number) => new Date(AHORA.getTime() - h * 3_600_000).toISOString()
const vacia = (): EntradaDeAlertas => ({ cliente: "c1", ahora: AHORA, plan: [], cerebroDiario: [], alarmasDelCerebro: [], preguntas: [], corridas: [] })
// la alarma real que Emilio vio hoy en producción (cerebro_alertas, abierta)
const ALARMA_DE_HOY = { clave: "raspado-en-pausa:2026-11-25", ultima_en: "2026-11-09T18:30:00.897+00:00" }
const plan = (id: string, estado: string, h: number, extra: Record<string, unknown> = {}) => ({ id, client_id: "c1", estado, creado_en: hace(h), actualizado_en: hace(h - 0.5), vence_en: null, motivo: null, dry_run: false, ...extra })

describe("1 · cada aviso abre la pantalla de donde salió (tabla tipo → destino)", () => {
  it("la tabla", () => {
    expect(DESTINO_DEL_AVISO).toEqual({ fallida: "envivo", colgada: "envivo", gasto: "dinero", cerebro_alarma: "riesgos", cerebro_diario: null, pregunta: "decisiones", decision: "decisiones" })
  })
  it("plan fallido → En vivo", () => { expect(fallidas({ ...vacia(), plan: [plan("a", "fallida", 2)] })[0].abre).toBe("envivo") })
  it("plan colgado → En vivo", () => { expect(colgadas({ ...vacia(), plan: [plan("b", "corriendo", 5)] })[0].abre).toBe("envivo") })
  it("gasto raro (apagado en la antena) → Dinero", () => {
    const c = (e: string, costo: number) => ({ ejecucion: e, flujo: "f", client_id: "c1", costo, inicio: hace(1) })
    expect(gastosRaros({ ...vacia(), corridas: [c("1", 0.1), c("2", 0.1), c("3", 0.1), c("4", 0.1), c("5", 9)] })[0].abre).toBe("dinero")
  })
  it("alarma del cerebro (la de hoy) → Riesgos, donde la plataforma la muestra como «Portero del cerebro»; ya no Observabilidad", () => {
    const [a] = cerebroNoCorrio({ ...vacia(), alarmasDelCerebro: [ALARMA_DE_HOY] })
    expect(a.clave).toBe("cerebro:alarma:raspado-en-pausa:2026-11-25"); expect(a.abre).toBe("riesgos")
  })
  it("la corrida diaria del cerebro (no corrió / salió mal) no tiene pantalla propia → no lleva a ningún lado", () => {
    const fila = (dia: string, estado = "hecha") => ({ client_id: "c1", dia, estado, prueba: false })
    const sin = cerebroNoCorrio({ ...vacia(), cerebroDiario: [fila("2026-11-01")] }), mal = cerebroNoCorrio({ ...vacia(), cerebroDiario: [fila("2026-11-08", "fallida")] })
    expect(sin[0].clave).toBe("cerebro:sin-corrida"); expect(sin[0].abre).toBeNull()
    expect(mal[0].clave).toBe("cerebro:fallo"); expect(mal[0].abre).toBeNull()
  })
  it("pregunta sin responder → Decisiones", () => {
    expect(preguntasSinResponder({ ...vacia(), preguntas: [{ id: "p", client_id: "c1", pregunta: "¿Cuántas sedes?", estado: "pendiente", creado_en: hace(3), oficina: "marketing" }] })[0].abre).toBe("decisiones")
  })
})

describe("2 · al tocar: un aviso sin destino no abre nada; con destino cierra la lista y abre SU pantalla", () => {
  const aviso = (abre: AlertaDeLaAntena["abre"]): AlertaDeLaAntena => ({ clave: "k", tipo: "cerebro", texto: "x", cuando: hace(1), abre, departamento: null })
  it("sin destino: no cierra ni abre", () => {
    const cerrar = vi.fn(), abrir = vi.fn()
    expect(alTocarElAviso(aviso(null), { cerrar, abrir })).toBe(false); expect(cerrar).not.toHaveBeenCalled(); expect(abrir).not.toHaveBeenCalled()
  })
  it("la alarma del cerebro abre Riesgos", () => {
    const cerrar = vi.fn(), abrir = vi.fn()
    alTocarElAviso(cerebroNoCorrio({ ...vacia(), alarmasDelCerebro: [ALARMA_DE_HOY] })[0], { cerrar, abrir })
    expect(cerrar).toHaveBeenCalledTimes(1); expect(abrir).toHaveBeenCalledWith("riesgos")
  })
  it("en la lista: la alarma dice «abre Riesgos»; el aviso sin destino queda sin flecha y deshabilitado", () => {
    const fila = { client_id: "c1", dia: "2026-11-01", estado: "hecha", prueba: false }
    const avisos = cerebroNoCorrio({ ...vacia(), cerebroDiario: [fila], alarmasDelCerebro: [ALARMA_DE_HOY] })
    const h = renderToStaticMarkup(createElement(ListaDeLasAlertas, { alertas: avisos, onAbrir: () => {}, onCerrar: () => {}, ahora: AHORA.getTime() })).replace(/<!-- -->/g, "")
    expect(h).toContain("· abre Riesgos"); expect(h).not.toContain("abre Observabilidad")
    expect(h.match(/›/g)).toHaveLength(1); expect(h.match(/disabled=""/g)).toHaveLength(1)
  })
})

describe("3 · la lista va al <body> (dentro de la escena heredaba «pointer-events: none»: ni la ✕ ni los avisos recibían el clic)", () => {
  afterEach(() => { portales.length = 0; vi.unstubAllGlobals() })
  it("con navegador, la lista se monta en document.body", () => {
    const body = { soy: "body", firstElementChild: { soy: "lo primero del body" } }; vi.stubGlobal("document", { body })
    enElCuerpo(createElement("div")); expect(portales).toEqual([body])
  })
  it("PanelDeLasAlertas usa ese camino (no se dibuja dentro de la escena)", () => {
    const body = { soy: "body", firstElementChild: { soy: "lo primero del body" } }; vi.stubGlobal("document", { body })
    renderToStaticMarkup(createElement(PanelDeLasAlertas, { alertas: [], onAbrir: () => {}, onCerrar: () => {} }))
    expect(portales).toEqual([body])
  })
  it("sin documento (servidor), se dibuja en el lugar", () => {
    expect(typeof document).toBe("undefined"); enElCuerpo(createElement("div")); expect(portales).toEqual([])
  })
})
