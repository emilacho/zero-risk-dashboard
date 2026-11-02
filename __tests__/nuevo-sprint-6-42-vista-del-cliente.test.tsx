/**
 * DASHBOARD NUEVO · SPRINT 6.42 · VISTA FINANCIERA DEL CLIENTE (boceto aprobado por Emilio 2-nov con 3 cambios): a un clic desde Dinero y desde el selector
 * de arriba; «lo que tienes que saber» en 3 líneas; tarjetas tipo Pulse; el negocio en UNA línea mientras no haya dato; preguntas que escriben en el chat.
 */
import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { clientesDelSelector, dineroDelCliente, rutaDelCliente, slugDeCliente, vistaDelCliente } from "@/lib/cliente-financiero"
import { PRUEBAS_Y_FICHAS_VIEJAS, TRABAJO_INTERNO, type Dinero, type Movimiento } from "@/lib/dinero-completo"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }))

const m = (d: string, usd: number, x: Partial<Movimiento> = {}): Movimiento => ({ t: `${d}T15:00:00.000Z`, d, proveedor: "Anthropic", modelo: "claude-sonnet-4-6", empleado: "Jefe marketing", cliente: "Náufrago", client_id: "c1", corrida: `r-${d}`, usd, ok: true, cota: false, ...x })
const movs: Movimiento[] = [
  m("2026-10-20", 0.6, { proceso: "Planeación del plan de 90 días", corrida: "p1" }), m("2026-10-20", 0.4, { proceso: "Planeación del plan de 90 días", corrida: "p1:rama" }),
  m("2026-10-25", 1.2, { proceso: "Planeación del plan de 90 días", corrida: "p2" }),
  m("2026-10-28", 2, { proceso: "Alta de un cliente nuevo", corrida: "a1" }),
  m("2026-11-01", 0.5, { ok: false }),
  m("2026-11-01", 3, { cliente: "Otro cliente", client_id: "c2" }),
  m("2026-11-02", 1, { cliente: TRABAJO_INTERNO, client_id: null }),
]
const hoy = "2026-11-02"
const datos: Dinero = {
  movimientos: movs, saldos: [], cache: null, desde: "2026-09-01T00:00:00Z", leido_en: "2026-11-02T17:00:00Z", faltan: [],
  topes: [{ client_id: "c1", cliente: "Náufrago", gastado_24h_usd: 5.61, techo_usd: 20, pct: 28 }, { client_id: "c2", cliente: "Otro cliente", gastado_24h_usd: 1, techo_usd: 20, pct: 5 }],
  piezas: [{ d: "2026-10-29", estado: "approved", usd: 1.5, client_id: "c1" }, { d: "2026-10-29", estado: "rejected", usd: 0.7, client_id: "c1" }, { d: "2026-10-29", estado: "rejected", usd: 9, client_id: "c2" }],
  manuales: ["2026-10-28", "2026-10-28"], manuales_de: [{ d: "2026-10-28", client_id: "c1" }, { d: "2026-10-28", client_id: "c2" }],
}

describe("6.42 · la ruta del cliente", () => {
  it("el nombre se vuelve una dirección limpia", () => {
    expect(slugDeCliente("Náufrago")).toBe("naufrago"); expect(slugDeCliente("Zero Risk Seguridad Industrial")).toBe("zero-risk-seguridad-industrial")
    expect(rutaDelCliente("Náufrago")).toBe("/nuevo/cliente/naufrago")
  })
  it("solo toma lo del cliente: su gasto, su freno, sus piezas y sus versiones del manual", () => {
    const c = dineroDelCliente(datos, "naufrago")!
    expect(c.nombre).toBe("Náufrago"); expect(c.ids).toEqual(["c1"]); expect(c.tope?.pct).toBe(28)
    expect(c.dinero.movimientos.every((x) => x.client_id === "c1")).toBe(true)
    expect(c.dinero.piezas).toHaveLength(2); expect(c.dinero.manuales).toEqual(["2026-10-28"])
    expect(dineroDelCliente(datos, "no-existe")).toBeNull()
  })
})

describe("6.42 · la vista", () => {
  const v = vistaDelCliente(datos, "naufrago", "30", hoy)!
  it("«lo que tienes que saber»: qué pasó · por qué · qué conviene, escrito por el código", () => {
    expect(v.saber.que_paso).toContain("Náufrago gastó US$ 4,70 en los últimos 30 días")
    expect(v.saber.por_que).toContain("planeación del plan de 90 días (US$ 2,20)")
    expect(v.saber.que_conviene).toMatch(/^A este ritmo cierra el mes en US\$ /); expect(v.saber.que_conviene).toContain("holgado (28 %)")
  })
  it("cambio 3 de Emilio: «N vueltas de la planeación», no «planes»", () => {
    const plan = v.tarjetas.find((t) => t.clave === "plan")!
    expect(plan.variacion?.texto).toBe("2 vueltas de la planeación"); expect(plan.valor).toBe("US$ 1,10")
    expect(JSON.stringify(v)).not.toMatch(/planes en|planes hechos/)
  })
  it("tarjetas tipo Pulse: número, tendencia, variación y una línea; margen sin dato", () => {
    expect(v.tarjetas.map((t) => t.clave)).toEqual(["gasto", "proyeccion", "freno", "rehacer", "plan", "manual", "pieza", "margen"])
    expect(v.tarjetas.find((t) => t.clave === "margen")!.valor).toBeNull()
    expect(v.tarjetas.find((t) => t.clave === "pieza")!.valor).toBe("US$ 1,50")
    expect(v.tarjetas.find((t) => t.clave === "rehacer")!.valor).toBe("US$ 1,20")
    for (const t of v.tarjetas) expect(t.lectura.length).toBeGreaterThan(5)
  })
  it("cambio 2 de Emilio: el negocio va en UNA línea mientras no haya dato", () => { expect(v.negocio).toBe("Cómo le va al negocio: sin dato todavía") })
  it("preguntas sugeridas con el nombre del cliente", () => {
    expect(v.preguntas).toContain("¿Por qué subió el gasto de Náufrago?"); expect(v.preguntas).toContain("¿Cuánto me costó el plan de Náufrago?")
    expect(v.preguntas).toContain("¿Por qué se devolvieron piezas de Náufrago?")
  })
})

describe("6.42 · en pantalla", () => {
  it("panel con el chat visible, 8 tarjetas, el negocio en una línea, preguntas y el detalle plegado", async () => {
    const { PanelCliente } = await import("@/components/nuevo/PanelCliente")
    const h = renderToStaticMarkup(createElement(PanelCliente, { slug: "naufrago", datosIniciales: datos })).replace(/<!-- -->/g, "")
    expect(h).toMatch(/^<div class="nv-panel fixed inset-0 z-\[70\]/)
    expect(h.match(/data-tarjeta-cliente=/g)).toHaveLength(8); expect(h.match(/data-negocio/g)).toHaveLength(1)
    expect(h).not.toContain('data-tarjeta-cliente="ventas"')
    expect(h.match(/data-saber-linea=/g)).toHaveLength(3); expect(h).toContain("data-pregunta=")
    expect(h.match(/<details/g)).toHaveLength(4); expect(h).not.toContain("<details open")
    expect(h).toContain('href="/nuevo/cliente/naufrago"'); expect(h).toContain("comparado con los 30 días anteriores")
  })
  it("las preguntas escriben en el chat de CC2 sin tocar su código", () => {
    const panel = readFileSync("components/nuevo/PanelCliente.tsx", "utf8")
    expect(panel).toContain('[data-chat-de-oficinas] textarea'); expect(panel).toContain('new Event("input", { bubbles: true })')
    expect(readFileSync("components/nuevo/ChatDeOficinas.tsx", "utf8")).not.toContain("PanelCliente")
  })
})

describe("6.42 · a un clic", () => {
  it("Dinero: «Ver cliente ↗» en cada fila de cliente, no en interno ni pruebas", async () => {
    const { Desglose } = await import("@/components/nuevo/DineroDesglose")
    const h = renderToStaticMarkup(createElement(Desglose, { datos, rango: { desde: "2026-10-04", hasta: hoy }, hoy }))
    expect(h).toContain('data-ver-cliente="Náufrago"'); expect(h).toContain('href="/nuevo/cliente/naufrago"')
    expect(h).not.toContain(`data-ver-cliente="${TRABAJO_INTERNO}"`)
  })
  it("cambio 1 de Emilio: el selector de arriba abre la vista del cliente; la lista sin pruebas ni repetidos", async () => {
    expect(clientesDelSelector(["Náufrago", "Náufrago", PRUEBAS_Y_FICHAS_VIEJAS, TRABAJO_INTERNO, "Zero Risk Seguridad Industrial"])).toEqual([
      { nombre: "Náufrago", ruta: "/nuevo/cliente/naufrago" }, { nombre: "Zero Risk Seguridad Industrial", ruta: "/nuevo/cliente/zero-risk-seguridad-industrial" }])
    const { BarraSuperior } = await import("@/components/nuevo/MarcoNuevo")
    const h = renderToStaticMarkup(createElement(BarraSuperior))
    expect(h).toContain("data-selector-de-cliente"); expect(h).toContain("Seleccionar cliente"); expect(h).toContain('aria-haspopup="menu"')
    expect(readFileSync("components/nuevo/SelectorDeCliente.tsx", "utf8")).toContain('href={c.ruta}')
   }, 60000)
  it("página propia con la puerta de administrador; la lista también exige administrador y solo lee", () => {
    const pagina = readFileSync("app/nuevo/cliente/[cliente]/page.tsx", "utf8"), ruta = readFileSync("app/api/direccion/clientes/route.ts", "utf8")
    expect(pagina).toContain("exigirAdmin()"); expect(pagina).toContain("<PantallaNuevo cliente={cliente} />")
    expect(ruta).toContain("exigirAdmin()"); expect(ruta).not.toMatch(/\.(insert|update|upsert|delete)\(/)
  })
})

describe("6.42 · sin porcentajes absurdos", () => {
  it("si antes casi no hubo gasto, dice de cuánto partió en vez de «subió 7638 %»", () => {
    const d2: Dinero = { ...datos, movimientos: [m("2026-10-22", 0.05), m("2026-11-01", 10)] }
    const v = vistaDelCliente(d2, "naufrago", "7", hoy)!
    expect(v.saber.que_paso).toBe("Náufrago gastó US$ 10,00 en los últimos 7 días; en los 7 días anteriores casi no tuvo gasto (US$ 0,05).")
    expect(v.tarjetas[0].variacion?.texto).toBe("▲ desde US$ 0,05")
  })
})

describe("6.43 · pedido de Emilio: sin dados de baja y títulos claros", () => {
  it("los clientes dados de baja no van en el selector", async () => {
    const { esDadoDeBaja } = await import("@/lib/cliente-financiero")
    expect(esDadoDeBaja("churned")).toBe(true); expect(esDadoDeBaja("onboarding")).toBe(false); expect(esDadoDeBaja(null)).toBe(false)
    expect(readFileSync("app/api/direccion/clientes/route.ts", "utf8")).toContain("filter((c) => !esDadoDeBaja(c.status))")
  })
  it("una sola escala: el título de sección es más grande y más claro que el rótulo, y éste que la subcategoría", async () => {
    const e = await import("@/components/nuevo/estilos-titulos")
    const tam = (c: string) => Number(/text-\[([0-9.]+)px\]/.exec(c)![1])
    expect(tam(e.TITULO_SECCION)).toBeGreaterThan(tam(e.ROTULO_TARJETA)); expect(tam(e.ROTULO_TARJETA)).toBeGreaterThan(tam(e.SUBCATEGORIA)); expect(tam(e.SUBCATEGORIA)).toBeGreaterThan(tam(e.ENCABEZADO_TABLA))
    for (const c of Object.values(e)) { expect(c).toContain("font-medium"); expect(c).not.toMatch(/text-zinc-(5|6|7)00/) }
    for (const f of ["PanelCliente", "PanelDinero", "DineroDesglose", "DineroResultados"]) {
      const s = readFileSync(`components/nuevo/${f}.tsx`, "utf8")
      expect(s, f).toContain("estilos-titulos"); expect(s, f).not.toContain("text-[11px] uppercase"); expect(s, f).not.toContain('text-[12px] uppercase tracking-[0.2em] text-[#ffb86b]')
    }
  })
})
