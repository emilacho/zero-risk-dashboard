import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createElement, type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { armarEscena, type EntradaDeLaEscena, type InvocacionViva } from "@/lib/escena-avatares"
import { lineasDeLaSala } from "@/lib/escena-sala"
import { Avatares } from "@/components/nuevo/escena/Avatares"
import { PanelDelPizarron, PanelDeLaVitrina } from "@/components/nuevo/escena/PanelesDelPizarron"
import { nombresDeFlujosEnCache, vaciarNombresDeFlujos, TTL_NOMBRE_MS, TTL_SIN_NOMBRE_MS } from "@/lib/nombres-de-flujos"
import type { MetricasDelPizarron } from "@/lib/escena-metricas"

// los clics se prueban llamando a los componentes como funciones, con los hooks de React sin estado (no hay navegador en las pruebas)
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), useState: (v: unknown) => [typeof v === "function" ? (v as () => unknown)() : v, () => {}], useEffect: () => {} }))
const { CuadrosDeMetricas, VitrinaVertical } = await import("@/components/nuevo/escena/EntregasEnLaFoto")

/** recorre el árbol de elementos de React y junta los que cumplan la condición */
function buscar(n: ReactNode, ok: (e: ReactElement<Record<string, unknown>>) => boolean, sal: ReactElement<Record<string, unknown>>[] = []) {
  if (Array.isArray(n)) n.forEach((x) => buscar(x, ok, sal))
  else if (n && typeof n === "object" && "props" in n) { const e = n as ReactElement<Record<string, unknown>>; if (ok(e)) sal.push(e); buscar(e.props.children as ReactNode, ok, sal) }
  return sal
}

const T0 = Date.parse("2026-11-03T10:00:00Z")
const en = (min: number) => new Date(T0 + min * 60_000).toISOString()
const ANALISTAS = ["x-twitter-intelligence-analyst", "feedback-synthesizer", "growth-hacker"]
const inv = (agent_name: string, exec: string, finMin: number, extra: Partial<InvocacionViva> = {}): InvocacionViva =>
  ({ agent_name, client_id: "nau", workflow_id: "X9F0zp6LQ2xGEYVS", workflow_execution_id: exec, status: "completed", started_at: en(finMin - 2), ended_at: en(finMin), cost_usd: 0.3, step_name: null, task_text: null, ...extra })
const entrada = (minAhora: number, invocaciones: InvocacionViva[], extra: Partial<EntradaDeLaEscena> = {}): EntradaDeLaEscena => ({
  despachos: [], invocaciones,
  directorio: ANALISTAS.map((a) => ({ agente: a, equipo: "estrategia", rol: "miembro" })),
  agentes: ANALISTAS.map((a) => ({ name: a, display_name: a })), clientes: [{ id: "nau", nombre: "Náufrago" }], equipos: null,
  ahora: new Date(T0 + minAhora * 60_000), ...extra,
})
// regla C: la reunión es el paso que consolida (el último analista re-sintetiza); los otros dos aportaron ANTES y se sientan con él
const conFallo = () => ANALISTAS.map((a, i) => inv(a, i === 2 ? "500:bba-resintesis-c1" : `500:paso${i}`, 2 + i * (i === 2 ? 3 : 1), i === 2 ? { started_at: en(4) } : i === 1 ? { status: "failed" } : {}))
const sinFallo = () => ANALISTAS.map((a, i) => inv(a, i === 2 ? "500:bba-resintesis-c1" : `500:paso${i}`, 2 + i * (i === 2 ? 3 : 1), i === 2 ? { started_at: en(4) } : {}))

describe("CC4 · sala · «falló» sale de los datos (se ejecuta, no se lee)", () => {
  it("una reunión reciente con una fase fallida dice «falló»; sin fallo dice «terminó»", () => {
    const mala = armarEscena(entrada(12, conFallo())).sala!
    expect(mala.reunion?.fallo).toBe(true)
    expect(lineasDeLaSala(mala).join(" ")).toMatch(/falló/); expect(lineasDeLaSala(mala).join(" ")).not.toMatch(/terminó/)
    const buena = armarEscena(entrada(12, sinFallo())).sala!
    expect(buena.reunion?.fallo).toBe(false)
    expect(lineasDeLaSala(buena).join(" ")).toMatch(/terminó/)
  })
  it("la última reunión (sala vacía) conserva el fallo: «la última … falló hace …»", () => {
    const s = armarEscena(entrada(600, conFallo())).sala!
    expect(s.reunion).toBeNull()
    expect(s.ultima?.fallo).toBe(true)
    expect(lineasDeLaSala(s).join(" ")).toMatch(/la última, .*falló/)
    expect(armarEscena(entrada(600, sinFallo())).sala!.ultima?.fallo).toBe(false)
  })
  it("se dibuja en rojo, y sin reunión el rótulo no es un botón", () => {
    const mala = renderToStaticMarkup(createElement(Avatares, { datosIniciales: armarEscena(entrada(12, conFallo())) }))
    expect(mala).toContain("#f87171"); expect(mala).toContain("Ver la reunión")
    const vacia = renderToStaticMarkup(createElement(Avatares, { datosIniciales: armarEscena(entrada(600, [])) }))
    expect(vacia).not.toContain("Ver la reunión")
  })
})

describe("CC4 · nombres de los trabajos · caché (reserva 1 de CC3)", () => {
  const llamadas: string[] = []
  const f = (async (url: string) => { llamadas.push(url); const id = decodeURIComponent(url.split("/").pop() ?? ""); return id === "perdido" ? { ok: false, json: async () => ({}) } : { ok: true, json: async () => ({ name: `Zero Risk — Cambios al manual (${id})` }) } }) as unknown as typeof fetch
  beforeEach(() => { vaciarNombresDeFlujos(); llamadas.length = 0; process.env.N8N_BASE_URL = "https://n8n.test"; process.env.N8N_API_KEY = "k" })
  afterEach(() => { delete process.env.N8N_BASE_URL; delete process.env.N8N_API_KEY })
  it("el segundo sondeo no vuelve a n8n; vencido el tiempo, sí", async () => {
    let t = 1_000
    const a = await nombresDeFlujosEnCache(["w1", "w2"], f, () => t)
    expect(Object.keys(a)).toEqual(["w1", "w2"]); expect(llamadas).toHaveLength(2)
    await nombresDeFlujosEnCache(["w1", "w2"], f, () => t + 1000)
    expect(llamadas).toHaveLength(2)
    await nombresDeFlujosEnCache(["w1"], f, () => t + TTL_NOMBRE_MS + 1)
    expect(llamadas).toHaveLength(3)
  })
  it("solo pide los que faltan, y el que n8n no da se reintenta al minuto, no en cada sondeo", async () => {
    const t = 5_000
    await nombresDeFlujosEnCache(["w1"], f, () => t)
    const r = await nombresDeFlujosEnCache(["w1", "perdido"], f, () => t + 10)
    expect(llamadas.filter((u) => u.includes("w1"))).toHaveLength(1); expect(r).toEqual({ w1: "Zero Risk — Cambios al manual (w1)" })
    await nombresDeFlujosEnCache(["perdido"], f, () => t + 20)
    expect(llamadas.filter((u) => u.includes("perdido"))).toHaveLength(1)
    await nombresDeFlujosEnCache(["perdido"], f, () => t + TTL_SIN_NOMBRE_MS + 100)
    expect(llamadas.filter((u) => u.includes("perdido"))).toHaveLength(2)
  })
})

const METRICAS: MetricasDelPizarron = { cliente: "nau", lectura: "sin_datos", cuadros: [
  { clave: "general" as never, nombre: "General", sigla: "GEN", principal: null, variacion: null, texto: "métricas pronto", tiene: true },
  { clave: "instagram" as never, nombre: "Instagram", sigla: "IG", principal: null, variacion: null, texto: "métricas pronto", tiene: true },
  { clave: "tiktok" as never, nombre: "TikTok", sigla: "TT", principal: null, variacion: null, texto: "sin cuenta todavía", tiene: false },
] }

describe("CC4 · pizarrón y vitrina · los toques llaman de verdad", () => {
  it("tocar un cuadro abre esa red; tocar el pizarrón entero abre el pizarrón; Enter también", () => {
    const abrir: string[] = []
    const arbol = CuadrosDeMetricas({ metricas: METRICAS, onAbrir: (k: string) => abrir.push(k) }) as ReactElement
    const cuadros = buscar(arbol, (e) => e.props["data-metrica"] !== undefined)
    expect(cuadros).toHaveLength(3)
    for (const c of cuadros) { expect(c.props.role).toBe("button"); (c.props.onClick as () => void)() }
    expect(abrir).toEqual(["general", "instagram", "tiktok"])
    const entero = buscar(arbol, (e) => e.props["data-pizarron-toque"] !== undefined)[0]
    ;(entero.props.onClick as () => void)(); expect(abrir.at(-1)).toBe("")
    ;(cuadros[1].props.onKeyDown as (e: unknown) => void)({ key: "Enter", preventDefault() {} }); expect(abrir.at(-1)).toBe("instagram")
  })
  it("tocar la vitrina (también sin piezas) la abre", () => {
    let n = 0
    const arbol = VitrinaVertical({ vitrina: { modo: "vacia", piezas: [], lectura: "sin_datos" } as never, onAbrir: () => { n++ } }) as ReactElement
    const zona = buscar(arbol, (e) => String(e.props.className ?? "").includes("nv-vitrina-hit"))[0]
    expect(zona.props.role).toBe("button"); (zona.props.onClick as () => void)(); expect(n).toBe(1)
  })
})

describe("CC4 · tarjetas · se dibujan con lo que dicen los datos", () => {
  it("la red sin cuenta dice «sin cuenta todavía · se conecta cuando exista»; la lista tiene botones de 72 px y volver de 52 px", () => {
    const tarjeta = renderToStaticMarkup(createElement(PanelDelPizarron, { metricas: METRICAS, inicial: "tiktok", onCerrar: () => {} }))
    expect(tarjeta).toContain("sin cuenta todavía · se conecta cuando exista"); expect(tarjeta).toContain("min-h-[52px]"); expect(tarjeta).toContain("data-volver-al-pizarron")
    const lista = renderToStaticMarkup(createElement(PanelDelPizarron, { metricas: METRICAS, onCerrar: () => {} }))
    expect(lista.match(/min-h-\[72px\]/g)).toHaveLength(3); expect(lista).toContain('data-red="tiktok"')
    expect(lista).not.toContain("data-tarjeta-de-red")
  })
  it("la vitrina sin piezas dice que aparecerán al aprobarse; con piezas las lista", () => {
    expect(renderToStaticMarkup(createElement(PanelDeLaVitrina, { vitrina: { modo: "vacia", piezas: [], lectura: "sin_datos" } as never, onCerrar: () => {} }))).toContain("data-vitrina-vacia")
    const con = renderToStaticMarkup(createElement(PanelDeLaVitrina, { vitrina: { modo: "mejores", piezas: [{ titulo: "Post uno", imagen: null, texto: "ok" }], lectura: "ok" } as never, onCerrar: () => {} }))
    expect(con).toContain("Post uno"); expect(con).not.toContain("data-vitrina-vacia")
  })
})
