/**
 * DASHBOARD NUEVO · SPRINT 6.42 · VISTA FINANCIERA DEL CLIENTE (boceto aprobado por Emilio 2-nov con 3 cambios): a un clic desde Dinero y desde el selector
 * de arriba; «lo que tienes que saber» en 3 líneas; preguntas que escriben en el chat.
 * 6.46 · v2 «solo dinero» (boceto aprobado 2-nov): los 4 números, mes a mes, costo por tipo con rehacer, pronóstico, costo por entrega y compartidos (regla A).
 */
import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { clientesDelSelector, dineroDelCliente, rutaDelCliente, slugDeCliente, vistaDelCliente } from "@/lib/cliente-financiero"
import { costoDeRehacer, PRUEBAS_Y_FICHAS_VIEJAS, TRABAJO_INTERNO, type Dinero, type Movimiento } from "@/lib/dinero-completo"

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

describe("6.46 · la vista solo de dinero", () => {
  const v = vistaDelCliente(datos, "naufrago", "30", hoy)!
  it("«lo que tienes que saber»: 3 líneas, solo dinero", () => {
    expect(v.saber.que_paso).toBe("Náufrago costó US$ 4,70 en los últimos 30 días (antes US$ 0,00). Con su parte de lo compartido, US$ 5,31.")
    expect(v.saber.por_que).toBe("Lo que más costó: planeación (US$ 2,20) y alta (US$ 2,00).")
    expect(v.saber.que_conviene).toContain("A este ritmo cierra el mes en US$ 4,89."); expect(v.saber.que_conviene).toContain("falta registrar lo que se le cobra")
  })
  it("los 4 números: sin ingreso, ganancia y margen quedan «sin dato» (null), nunca un ejemplo", () => {
    expect(v.numeros).toMatchObject({ ingreso: null, costo: 4.7, costo_anterior: 0, ganancia: null, margen_pct: null, costo_con_compartido: 5.31 })
  })
  it("costo por tipo suma el costo; rehacer es la MISMA cuenta de Dinero y va «de eso», no sumado", () => {
    expect(v.por_tipo.map((t) => t.tipo)).toEqual(["Planeación", "Alta", "Otros"])
    expect(Math.round(v.por_tipo.reduce((s, t) => s + t.usd, 0) * 100) / 100).toBe(v.numeros.costo)
    const d = dineroDelCliente(datos, "naufrago")!.dinero, r = { desde: "2026-10-04", hasta: hoy }
    expect(v.rehacer.usd).toBe(Math.round(costoDeRehacer(d, r).reduce((s, x) => s + (x.usd ?? 0), 0) * 100) / 100)
    expect(v.rehacer.usd).toBe(1.2)
  })
  it("mes a mes desde el primer mes con datos hasta el mes en curso; sin ingreso todavía", () => {
    expect(v.meses.map((x) => [x.rotulo, x.costo, x.en_curso])).toEqual([["sep", 0, false], ["oct", 4.2, false], ["nov", 0.5, true]])
    expect(v.meses.every((x) => x.ingreso === null)).toBe(true)
  })
  it("costo por entrega: vuelta del plan, manual y pieza aprobada con su comparación", () => {
    expect(v.entregas.map((e) => [e.clave, e.ahora, e.cuantos])).toEqual([["plan", 1.1, 2], ["manual", 2, 1], ["pieza", 1.5, 1]])
    expect(vistaDelCliente(datos, "naufrago", "7", hoy)!.entregas[0]).toMatchObject({ ahora: null, antes: 1.1, nota: "ninguna en el período" })
  })
  it("compartidos con la regla A: proporcional al gasto directo; pruebas no se reparten", () => {
    expect(v.compartido).toMatchObject({ interno: 1, cuota_pct: 61, toca: 0.61, real: 5.31 })
    expect(v.compartido.regla).toMatch(/^Se reparte en proporción al gasto directo/)
  })
  it("pronóstico: cierre, freno; presupuesto y margen esperado sin dato", () => {
    expect(v.pronostico).toMatchObject({ cierre: 4.89, presupuesto: null, margen_esperado: null, avisos: [] }); expect(v.pronostico.freno?.pct).toBe(28)
  })
  it("preguntas solo de dinero, con el nombre del cliente; nada de «qué me espera» ni conteo de piezas", () => {
    expect(v.preguntas).toEqual(["¿Por qué subió el costo de Náufrago?", "¿Cuánto me cuesta Náufrago con lo compartido?", "¿A cuánto cierra el mes Náufrago?"])
    expect(JSON.stringify(v)).not.toMatch(/me espera|aprobación|piezas devueltas de/)
  })
})

describe("6.46 · en pantalla", () => {
  it("panel con el chat visible y los bloques del boceto v2 en orden; el detalle plegado", async () => {
    const { PanelCliente } = await import("@/components/nuevo/PanelCliente")
    const h = renderToStaticMarkup(createElement(PanelCliente, { slug: "naufrago", datosIniciales: datos })).replace(/<!-- -->/g, "")
    expect(h).toMatch(/^<div class="nv-panel fixed inset-0 z-\[70\]/)
    const orden = ["data-saber", "data-cuatro-numeros", "data-mes-a-mes", "data-ingreso", "data-costo-por-tipo", "data-pronostico", "data-entregas", "data-compartidos", "data-pregunta=", "data-detalles"]
    const pos = orden.map((x) => h.indexOf(x)); expect(pos.every((x) => x > 0)).toBe(true); expect([...pos].sort((a, b) => a - b)).toEqual(pos)
    expect(h.match(/data-numero=/g)).toHaveLength(4); expect(h.match(/data-entrega=/g)).toHaveLength(3)
    expect(h.match(/data-sin-dato-todavia/g)!.length).toBeGreaterThanOrEqual(7)
    expect(h).not.toMatch(/Qué me espera|data-tarjeta-cliente|data-negocio|¿Cuál regla/)
    expect(h.match(/data-saber-linea=/g)).toHaveLength(3); expect(h).toContain("data-rehacer"); expect(h).toContain("data-regla")
    expect(h).not.toContain("<details open")
    expect(h).toContain('href="/nuevo/cliente/naufrago"'); expect(h).toContain("comparado con los 30 días anteriores")
   }, 60000)
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
    expect(v.saber.que_paso).toBe("Náufrago costó US$ 10,00 en los últimos 7 días; en los 7 días anteriores casi no tuvo costo (US$ 0,05).")
    expect(v.saber.por_que).toContain("otros · US$ 10,00")
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
