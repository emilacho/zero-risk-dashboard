/**
 * DASHBOARD NUEVO · SPRINT 6.49 · OBSERVABILIDAD VISUAL (boceto aprobado por Emilio 2-nov: «dale»).
 * Encargo `2026-11-02-ENCARGO-LENOVO-a-CC5-observabilidad-visual.md` + ADENDA 1 (medidas exactas):
 * gráficos grandes (≥180 px, barras ≥12 px, eje con 3–4 cifras redondas, total al pasar el cursor), la cascada de lo que falló a la vista,
 * procesos y empleados como barras horizontales (el mayor = 100 %, tramo rojo = errores), una sola línea gris de aviso, colores ámbar · rojo · gris.
 */
import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { normalizarDetalle, normalizarLista } from "@/lib/direccion-corridas"
import { type Dinero, type Movimiento } from "@/lib/dinero-completo"
import { cascadaDe, costoDelPeriodo, costoPorCubeta, cubetasDe, desdeDeLaLectura, noLeidas, rotuloDe, rotuloLargo, serieDe, ventanaDe } from "@/lib/observabilidad"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {}, back: () => {} }) }))

const NAU = "0a2ffbd4-0000-4000-8000-000000000001"
const c = (id: string, x: Record<string, unknown> = {}) => ({ workflow_id: "X9F0zp6LQ2xGEYVS", workflow_execution_id: id, client_id: NAU, cliente: "Náufrago", inicio: "2026-11-01T17:32:00.000Z", fin: "2026-11-01T17:48:00.000Z", duracion_ms: 960000, costo_usd: 1, tokens: 0, pasos: 1, fallos: 0, estado: "completa", nombre: "Plan de Marketing · investigación, redacción y revisión", ...x })
const hoy = "2026-11-02"
const v = ventanaDe("7", hoy)
const LISTA = normalizarLista({
  total: 6, ejecuciones_total: 6, ejecuciones_leidas: 6,
  corridas: [
    c("plan-1", { estado: "fallida", fallos: 1 }),
    c("plan-2", { inicio: "2026-10-30T15:00:00.000Z" }),
    c("pieza-1", { workflow_id: "pieza", nombre: "Piezas y video · Náufrago", inicio: "2026-10-30T16:00:00.000Z", duracion_ms: 12000 }),
    c("pieza-2", { workflow_id: "pieza", nombre: "Piezas y video · Náufrago", inicio: "2026-10-31T16:00:00.000Z", duracion_ms: 13000 }),
    c("cambio-1", { workflow_id: "cambio", nombre: "Cambios al Plan de Marketing · pedido del dueño", inicio: "2026-10-29T15:00:00.000Z" }),
    c("alta-1", { workflow_id: "LyVoKcrypS5uLyuu", nombre: "Manual de marca y alta", inicio: "2026-10-29T18:00:00.000Z", duracion_ms: 240000 }),
  ],
})
const m = (corrida: string, d: string, usd: number, x: Partial<Movimiento> = {}): Movimiento => ({ t: `${d}T15:00:00.000Z`, d, proveedor: "Anthropic", modelo: "claude-sonnet-4-6", empleado: "Jefe de Marketing", cliente: "Náufrago", client_id: NAU, corrida, proceso: "Plan de Marketing", usd, ...x } as Movimiento)
const DINERO: Dinero = {
  movimientos: [m("plan-1", "2026-11-01", 6.36), m("plan-2", "2026-10-30", 1), m("pieza-1", "2026-10-30", 4), m("pieza-2", "2026-10-31", 2.53), m("cambio-1", "2026-10-29", 1.34), m("alta-1", "2026-10-29", 1.23)],
  saldos: [], cache: null, desde: "2026-09-01T00:00:00Z", leido_en: "2026-11-02T17:00:00Z", faltan: [], topes: [], piezas: [], manuales: [], manuales_de: [],
}
const empleados = {
  todo: [{ slug: "jefe-marketing", nombre: "Jefe de Marketing", llamadas: 2, errores: 1, mediana_ms: 680000, max_ms: 680000, usd: 2, ejecuciones: ["plan-1"], interno: false }, { slug: "video-generation", nombre: "Video generation", llamadas: 1, errores: 0, mediana_ms: 441000, max_ms: 441000, usd: 2.59, ejecuciones: ["pieza-1"], interno: false }],
  sin_interno: [{ slug: "jefe-marketing", nombre: "Jefe de Marketing", llamadas: 2, errores: 1, mediana_ms: 680000, max_ms: 680000, usd: 2, ejecuciones: ["plan-1"], interno: false }, { slug: "video-generation", nombre: "Video generation", llamadas: 1, errores: 0, mediana_ms: 441000, max_ms: 441000, usd: 2.59, ejecuciones: ["pieza-1"], interno: false }],
}
const paso = (id: string, nombre: string, inicio: string, ms: number, x: Record<string, unknown> = {}) => ({ origen: "invocacion", id, agente: "a", modelo: "claude-sonnet-4-6", inicio, fin: null, duracion_ms: ms, costo_usd: 0, tokens: {}, tokens_total: 0, turnos: 1, estado: "completed", error: null, despacho: null, nombre, ...x })
// la corrida real del Plan de Marketing del 1-nov: 5 analistas en paralelo → escribe (11 min) → revisa → corrige (2 s, error) → cierre de 0 s
const DETALLE = normalizarDetalle({
  corrida: c("plan-1", { estado: "fallida" }),
  arbol: [{ rama: null, costo_usd: 0, pasos: [
    paso("a1", "Competitive intelligence · analiza competencia", "2026-11-01T16:32:14.368Z", 153569), paso("a2", "X twitter · analiza escucha x", "2026-11-01T16:32:15.325Z", 15495),
    paso("a3", "Market research analyst · analiza mercado", "2026-11-01T16:32:15.422Z", 155321), paso("a4", "Feedback synthesizer · analiza voz del publico", "2026-11-01T16:32:15.459Z", 46227),
    paso("a5", "Growth hacker · analiza retencion", "2026-11-01T16:32:34.166Z", 83016), paso("e1", "Jefe marketing · escribe el plan", "2026-11-01T16:36:31.391Z", 680132),
    paso("r1", "Editor en jefe · revisa el fondo del plan", "2026-11-01T16:47:57.803Z", 68333),
    paso("c1", "Jefe marketing · corrige el plan con lo que marcó la jefatura", "2026-11-01T16:49:09.214Z", 2281, { estado: "error", error: "/task must NOT have more than 120000 characters" }),
    paso("z1", "Jefatura · cierra la revisión", "2026-11-01T16:49:11.644Z", 0),
  ] }],
})

describe("6.49 · las series de los gráficos grandes", () => {
  it("por día en 7 días; por hora si el período es Hoy (como Dinero)", () => {
    expect(cubetasDe(v)).toEqual({ rotulos: ["2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"], porHora: false })
    const h = cubetasDe(ventanaDe("hoy", hoy)); expect(h.porHora).toBe(true); expect(h.rotulos).toHaveLength(24); expect(h.rotulos[15]).toBe("15")
  })
  it("corridas apiladas: con error y sin error, día por día", () => {
    const s = serieDe(LISTA.corridas, cubetasDe(v), (xs) => ({ total: xs.length, con_error: xs.filter((x) => x.estado === "fallida").length }))
    expect(s.map((x) => x.total)).toEqual([0, 0, 2, 2, 1, 1, 0]); expect(s.map((x) => x.con_error)).toEqual([0, 0, 0, 0, 0, 1, 0])
  })
  it("el costo por día es la misma cuenta que Dinero", () => {
    expect(costoPorCubeta(DINERO, v, cubetasDe(v), true)).toEqual(costoDelPeriodo(DINERO, v, hoy, true).por_dia)
    expect(costoPorCubeta(DINERO, v, cubetasDe(v), true)).toEqual([0, 0, 2.57, 5, 2.53, 6.36, 0])
  })
  it("los días que la lectura cortada no alcanzó son «no leído», nunca cero; con la lectura entera no hay ninguno", () => {
    const k = cubetasDe(v)
    expect(noLeidas(k, desdeDeLaLectura(LISTA.corridas, true), v.r.desde)).toEqual([true, true, false, false, false, false, false])
    expect(noLeidas(k, desdeDeLaLectura(LISTA.corridas, false), v.r.desde).some(Boolean)).toBe(false)
    const kh = cubetasDe(ventanaDe("hoy", hoy)), nh = noLeidas(kh, "2026-11-02T15:00:00.000Z", hoy)
    expect(nh.slice(0, 10).every(Boolean)).toBe(true); expect(nh[10]).toBe(false)
  })
  it("rótulos: «mar 27» con pocos días, «27 oct» con muchos, «15 h» en Hoy; el detalle dice «dom 1 nov»", () => {
    const k = cubetasDe(v)
    expect(rotuloDe("2026-10-27", k, 7)).toBe("mar 27"); expect(rotuloDe("2026-10-27", k, 30)).toBe("27 oct"); expect(rotuloLargo("2026-11-01", k)).toBe("dom 1 nov")
    expect(rotuloDe("15", cubetasDe(ventanaDe("hoy", hoy)), 24)).toBe("15 h")
  })
})

describe("6.49 · la cascada de la corrida con error", () => {
  const cas = cascadaDe(DETALLE!)!
  it("los pasos que se pisan son una fase; el cierre de 0 s no se dibuja; la que falló va marcada", () => {
    expect(cas.fases.map((f) => f.nombre)).toEqual(["Analiza · 5 empleados en paralelo", "Escribe el plan", "Revisa el fondo del plan", "Corrige el plan con lo que marcó la jefatura"])
    expect(cas.fases.map((f) => f.fallo)).toEqual([false, false, false, true]); expect(cas.fases[0].pasos).toBe(5)
    expect(cas.fases[3].clave).toBe("p:c1")
  })
  it("el largo de cada fase es su tiempo real (17 min en total)", () => {
    expect(Math.round(cas.total_ms / 60000)).toBe(17); expect(Math.round(cas.fases[1].dur_ms / 60000)).toBe(11); expect(cas.fases[3].dur_ms).toBe(2281)
    expect(cas.fases[1].desde_ms).toBeGreaterThan(cas.fases[0].desde_ms + cas.fases[0].dur_ms)
  })
  it("se dibuja: un tramo por fase, el que falló en rojo, tocar abre ese paso", async () => {
    const { CascadaVisible } = await import("@/components/nuevo/ObservabilidadGraficos")
    const h = renderToStaticMarkup(createElement(CascadaVisible, { c: cas, alTocar: () => {} })).replace(/<!-- -->/g, "")
    expect(h.match(/data-fase="/g)).toHaveLength(4); expect(h).toContain('data-fase-fallo="si"'); expect(h).toMatch(/data-fase-fallo="si"[^>]*background:#ff5a36/)
    expect(h).toContain("h-[18px]"); expect(h).toContain("Escribe el plan"); expect(h).toContain("17 min en total")
  })
})

describe("6.49 · en pantalla (la primera pantalla del boceto)", () => {
  const render = async (x: Record<string, unknown> = {}) => {
    const { PanelObservabilidad } = await import("@/components/nuevo/PanelObservabilidad")
    return renderToStaticMarkup(createElement(PanelObservabilidad, { onCerrar: () => {}, listaInicial: LISTA, dineroInicial: DINERO, empleadosInicial: empleados, hoy, ...x })).replace(/<!-- -->/g, "")
  }
  it("un solo renglón arriba: título, período, interno, búsqueda y «ver todas»", async () => {
    const h = await render()
    const cab = h.slice(h.indexOf("<header"), h.indexOf("</header>"))
    for (const k of ["Observabilidad", "data-controles", "data-mostrar-interno", "data-busca", "data-ver-todas", "Actualizar", "Cerrar · Esc"]) expect(cab).toContain(k)
    expect(cab.match(/data-periodo=/g)).toHaveLength(4); expect(h).not.toContain("Qué hicieron los empleados")
  }, 60000)
  it("dos gráficos grandes arriba (corridas apiladas y costo) y la demora abajo: 200 px de alto, eje y días", async () => {
    const h = await render()
    expect(h.indexOf('data-grafico-obs="corridas"')).toBeLessThan(h.indexOf('data-grafico-obs="costo"')); expect(h.indexOf('data-grafico-obs="costo"')).toBeLessThan(h.indexOf("data-lo-que-fallo"))
    expect(h.indexOf("data-grupos=")).toBeLessThan(h.indexOf('data-grafico-obs="demora"')); expect(h.indexOf('data-grafico-obs="demora"')).toBeLessThan(h.indexOf("data-empleados-obs"))
    for (const g of ["corridas", "costo", "demora"]) expect(h).toMatch(new RegExp(`data-grafico-obs="${g}" width="100%" height="200"`))
    expect(h).toContain('data-capa="con-error"'); expect(h).toContain('data-capa="sin-error"'); expect(h).toContain('fill="#ff5a36"')
    expect(h.match(/data-barra-dia=/g)).toHaveLength(21); expect(h).toContain(">mar 27<"); expect(h).toContain(">dom 1<")
    expect(h).toContain("Corridas por día"); expect(h).toContain("Costo por día"); expect(h).toContain("Demora típica por día")
    expect(h).toContain(">US$ 16,46<"); expect(h).toContain("1 con error")
  }, 60000)
  it("el eje con 3–4 cifras redondas y las barras de al menos 12 px", async () => {
    const h = await render()
    const costo = h.slice(h.indexOf('data-grafico-obs="costo"'), h.indexOf("</svg>", h.indexOf('data-grafico-obs="costo"')))
    const eje = [...costo.matchAll(/data-eje[^>]*>([^<]+)</g)].map((x) => x[1]); expect(eje.length).toBeGreaterThanOrEqual(3); expect(eje.length).toBeLessThanOrEqual(4)
    expect(eje).toEqual(["US$ 2", "US$ 4", "US$ 6", "US$ 8"])
    const corr = h.slice(h.indexOf('data-grafico-obs="corridas"'), h.indexOf("</svg>", h.indexOf('data-grafico-obs="corridas"')))
    expect([...corr.matchAll(/data-eje[^>]*>([^<]+)</g)].map((x) => x[1])).toEqual(["1", "2"]) // las corridas se cuentan enteras: nunca «0,5 corridas»
    const anchos = [...h.matchAll(/data-capa="[^"]+" x="[\d.]+" y="[\d.]+" width="([\d.]+)"/g)].map((x) => Number(x[1])); expect(anchos.length).toBeGreaterThan(0); expect(Math.min(...anchos)).toBeGreaterThanOrEqual(12)
  }, 60000)
  it("lectura cortada: los días no leídos punteados y UNA línea gris chica (no franja amarilla)", async () => {
    const h = await render({ listaInicial: { ...LISTA, ejecuciones_total: 500, ejecuciones_leidas: 6 } })
    expect(h).toContain('data-no-leido="2026-10-27"'); expect(h).toContain('data-no-leido="2026-10-28"'); expect(h).not.toContain('data-no-leido="2026-10-29"')
    expect(h).toMatch(/data-aviso-lectura="true" role="status" class="[^"]*text-\[12px\][^"]*text-zinc-500/); expect(h.match(/data-aviso-lectura/g)).toHaveLength(1)
    expect(h).toContain("sobre las últimas 6 ejecuciones (desde el 29 oct)")
    const completa = await render(); expect(completa).not.toContain("data-no-leido"); expect(completa).not.toContain("data-aviso-lectura")
  }, 60000)
  it("procesos como barras: el mayor = 100 %, tramo rojo = la parte con error, cifras a la derecha", async () => {
    const h = await render()
    const g = h.slice(h.indexOf("data-grupos="), h.indexOf('data-grafico-caja="demora"'))
    expect(g.match(/data-barra-largo="100"/g)).toHaveLength(1); expect(g).toContain("data-tramo-rojo"); expect(g).toContain("US$ 7,36 · 2 corridas"); expect(g).toContain(" · 1 con error")
    expect(g).toContain("data-medir-por=\"costo\""); expect(g).toContain("data-medir-por=\"corridas\""); expect(g).toContain("largo = costo · tramo rojo = corridas con error")
    expect(g.indexOf('data-grupo="Plan de Marketing"')).toBeLessThan(g.indexOf('data-grupo="Piezas y video"'))
  }, 60000)
  it("lo que falló: una línea con el motivo y «Ver completa →»; la cascada sale de la misma lectura de sus pasos", async () => {
    const h = await render()
    const f = h.slice(h.indexOf("data-lo-que-fallo"), h.indexOf("data-grupos="))
    expect(f).toContain("Lo que falló"); expect(f).toContain("Plan de Marketing"); expect(f).toContain("Ver completa →"); expect(f).not.toContain("data-texto-tecnico")
    const s = readFileSync("components/nuevo/PanelObservabilidad.tsx", "utf8")
    expect(s).toContain("setCascadas((m) => new Map(m).set(c.workflow_execution_id, cascadaDe(d)))"); expect(s).toContain("<CascadaVisible c={cas} alTocar={(k) => abrirEn(c, k)} />")
  }, 60000)
  it("empleados como barras cortas: los que más fallan en rojo, los que más tardan en ámbar, con la flecha a su ficha", async () => {
    const h = await render()
    const e = h.slice(h.indexOf("data-empleados-obs"))
    expect(e).toMatch(/data-top="fallan"[\s\S]*background:#ff5a36/); expect(e).toMatch(/data-top="tardan"[\s\S]*background:#e8731a/)
    expect(e).toContain('data-ficha-de="jefe-marketing"'); expect(e).toContain("1 fallo de 2"); expect(e).toContain("11 min típica")
  }, 60000)
  it("colores de los gráficos: ámbar, rojo y gris; nada más (y el texto técnico nunca a la vista)", () => {
    const g = readFileSync("components/nuevo/ObservabilidadGraficos.tsx", "utf8")
    const colores = new Set([...g.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((x) => x[0].toLowerCase()))
    for (const x of colores) expect(["#e8731a", "#ff5a36", "#6f6a64", "#8a8580", "#0f0d0c", "#e4e4e7"]).toContain(x)
    expect(readFileSync("components/nuevo/PanelObservabilidad.tsx", "utf8")).not.toContain("function MiniGrafico")
  })
})
