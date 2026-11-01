/**
 * DASHBOARD NUEVO · SPRINT 6.22 (1-nov · correcciones de Emilio a Riesgos, `raw/tasks/2026-11-01-ENCARGO-LENOVO-a-CC5-correcciones-de-riesgos.md`):
 * radar premium y más chico · 8 sectores fijos · pausas del dueño fuera del radar · saldos y freno a Dinero · mensajes claros (el proceso que falla, con su
 * nombre) · avisos de gasto viejos caducan · REGLA GENERAL: el chat de abajo siempre visible en todo /nuevo.
 */
import { describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync, readdirSync } from "node:fs"
import { leerRiesgos, limpiarMensaje, nombreDelProceso, normalizarRiesgos, sectorDelRiesgo, SECTORES } from "@/lib/direccion-riesgos"
import { PanelRiesgos } from "@/components/nuevo/PanelRiesgos"

const AHORA = Date.parse("2026-11-01T16:30:00Z")
// recorte de la respuesta real de producción del 1-nov (textos tal cual llegan)
const CRUDO = {
  ok: true, completo: true, total: 7, generado_en: "2026-11-01T16:20:00Z",
  riesgos: [
    { id: "r1", gravedad: 3, categoria: "falla", titulo: "TERMINÓ el trabajo y NADIE lo entregó · el resultado existe · el que esperaba no se enteró", detalle: "empleado jefe-marketing · termino_y_no_entrego", client_id: "n", cliente: "Náufrago", desde: "2026-11-01T11:33:11Z", fuente: "agent_dispatch_reconciliations" },
    { id: "r2", gravedad: 2, categoria: "falla", titulo: "Proceso operativo con 1 ejecución fallida", detalle: "flujo fe9D7xdk5QpKmBRw", client_id: null, cliente: null, desde: "2026-11-01T12:00:00Z", fuente: "n8n" },
    { id: "r3", gravedad: 2, categoria: "falla", titulo: "Proceso operativo con 1 ejecución fallida", detalle: "flujo 9UYoXtIqFvOaNel0", client_id: null, cliente: null, desde: "2026-11-01T08:00:00Z", fuente: "n8n" },
    { id: "r4", gravedad: 2, categoria: "incidente", titulo: "🟠 Portero del cerebro · PAUSADO solo para Náufrago: hay 1 ficha(s) viva(s) repetida(s) · los demás clientes siguen (flujo ogfq56oIEoHufFPM encendido) · se reanuda con POST /api/brain/alimentar/reanudar", detalle: null, client_id: "n", cliente: "Náufrago", desde: "2026-11-01T00:38:09Z", fuente: "cerebro_alertas" },
    { id: "r5", gravedad: 2, categoria: "pausa", titulo: "El portero del cerebro está en pausa para este cliente", detalle: "hay 1 ficha(s) viva(s) repetida(s)", client_id: "n", cliente: "Náufrago", desde: "2026-11-01T00:37:59Z", fuente: "cerebro_portero_pausas" },
    { id: "r6", gravedad: 1, categoria: "pausa", titulo: "Campaña en pausa", detalle: "pausa por decisión del dueño 31-oct: foco en Náufrago", client_id: null, cliente: null, desde: "2026-10-31T12:59:35Z", fuente: "cadena_campanas" },
    { id: "r7", gravedad: 1, categoria: "incidente", titulo: "🟡 Portero del cerebro · Náufrago: el gasto del día va en US$ 4.02 (aviso desde 3.00)", detalle: null, client_id: "n", cliente: "Náufrago", desde: "2026-10-29T18:41:38Z", fuente: "cerebro_alertas" },
  ],
  saldos: [{ proveedor: "Apify", plan: "STARTER", usado_usd: 14.77, credito_usd: 29, pct: 50.9, ciclo_hasta: "2026-11-24T23:59:59.999Z" }],
  topes: [{ client_id: "n", cliente: "Náufrago", gastado_24h_usd: 2.62, techo_usd: 20, pct: 13.1 }],
  fuentes: [{ fuente: "n8n", estado: "ok", filas: 2 }],
  sin_fuente: [{ que: "credencial de Google de n8n", motivo: "vive dentro de n8n" }],
}
const NOMBRES: Record<string, string> = { fe9D7xdk5QpKmBRw: "Zero Risk — Landing Page CRO Optimizer v2 (Weekly Sundays 7am)" }
const conNombres = () => ({ ...CRUDO, riesgos: CRUDO.riesgos.map((x) => { const id = String(x.detalle ?? "").match(/flujo (\w{16})/)?.[1]; return id && NOMBRES[id] ? { ...x, proceso: NOMBRES[id] } : x }) })

describe("6.22 · los 8 sectores fijos", () => {
  it("el radar tiene 8 sectores en orden fijo", () => {
    expect(SECTORES).toEqual(["dinero", "credenciales", "servicios", "flujos", "datos", "calidad", "plazos", "seguridad"])
  })
  it("cada riesgo cae en un sector por su tipo y su origen", () => {
    expect(sectorDelRiesgo({ categoria: "tope", fuente: "agent_invocations", titulo: "Gasto de 24 h al 90 %" })).toBe("dinero")
    expect(sectorDelRiesgo({ categoria: "saldo", fuente: "apify", titulo: "Saldo bajo" })).toBe("dinero")
    expect(sectorDelRiesgo({ categoria: "incidente", fuente: "cerebro_alertas", titulo: "Portero · el gasto del día va en US$ 4" })).toBe("dinero")
    expect(sectorDelRiesgo({ categoria: "credencial", fuente: "n8n", titulo: "Llave rechazada" })).toBe("credenciales")
    expect(sectorDelRiesgo({ categoria: "servicio", fuente: "cost_monitor_runs", titulo: "El vigilante lleva horas sin correr" })).toBe("servicios")
    expect(sectorDelRiesgo({ categoria: "incidente", fuente: "uptime_incidents", titulo: "Caída" })).toBe("servicios")
    expect(sectorDelRiesgo({ categoria: "falla", fuente: "n8n", titulo: "Proceso con 1 ejecución fallida" })).toBe("flujos")
    expect(sectorDelRiesgo({ categoria: "incidente", fuente: "cerebro_alertas", titulo: "Portero del cerebro · PAUSADO" })).toBe("datos")
    expect(sectorDelRiesgo({ categoria: "falla", fuente: "apify", titulo: "Raspado fallido" })).toBe("datos")
    // la plataforma puede mandar desde ya el nombre de un sector para los riesgos nuevos (calidad, plazos, seguridad…)
    expect(sectorDelRiesgo({ categoria: "plazos", fuente: null, titulo: "Aprobación por vencer" })).toBe("plazos")
    expect(normalizarRiesgos({ ...CRUDO, riesgos: [{ id: "q", gravedad: 2, categoria: "calidad", titulo: "Pieza devuelta 3 veces" }] }).riesgos[0].sector).toBe("calidad")
  })
})

describe("6.22 · lo que entra al radar y cómo se lee", () => {
  const d = normalizarRiesgos(conNombres(), AHORA)
  it("las pausas que decidió el dueño salen del radar como «decisiones tuyas»; la pausa automática del portero sí es riesgo (y no se cuenta dos veces)", () => {
    expect(d.decisiones_tuyas.map((x) => x.id)).toEqual(["r6"])
    expect(d.riesgos.find((x) => x.id === "r6")).toBeUndefined()
    expect(d.riesgos.find((x) => x.id === "r5")).toBeUndefined() // la misma pausa del portero ya está en su alerta r4
    expect(d.riesgos.find((x) => x.id === "r4")?.sector).toBe("datos")
  })
  it("los avisos de gasto del día caducan a las 24 h", () => {
    expect(d.riesgos.find((x) => x.id === "r7")).toBeUndefined(); expect(d.caducados).toBe(1)
    expect(normalizarRiesgos(conNombres(), Date.parse("2026-10-30T10:00:00Z")).riesgos.find((x) => x.id === "r7")).toBeDefined()
  })
  it("el proceso que falla se nombra; sin nombre lo dice, y nunca muestra su código", () => {
    expect(d.riesgos.find((x) => x.id === "r2")).toMatchObject({ titulo: "Falló el proceso «Landing Page CRO Optimizer v2»", detalle: "1 ejecución fallida en las últimas horas" })
    expect(d.riesgos.find((x) => x.id === "r3")?.titulo).toBe("Falló un proceso operativo (sin nombre todavía)")
    expect(JSON.stringify(d.riesgos)).not.toMatch(/9UYoXtIqFvOaNel0|fe9D7xdk5QpKmBRw|ogfq56oIEoHufFPM|\/api\/|POST|termino_y_no_entrego/)
  })
  it("mensajes en palabras claras: sin marcas, sin rutas, plurales bien puestos, empleados con nombre legible", () => {
    expect(d.riesgos.find((x) => x.id === "r4")?.titulo).toBe("Portero del cerebro · PAUSADO solo para Náufrago: hay 1 ficha viva repetida · los demás clientes siguen")
    expect(d.riesgos.find((x) => x.id === "r1")?.detalle).toBe("Empleado «jefe marketing»")
    expect(limpiarMensaje("hay 3 ficha(s) viva(s)")).toBe("Hay 3 fichas vivas")
    expect(limpiarMensaje("Trabajo de campaign-brief-agent atascado")).toBe("Trabajo de «campaign brief» atascado")
    expect(nombreDelProceso("Zero Risk — Cerebro · mantenimiento diario del portero (que ALIMENTA) · CC-CEREBRO")).toBe("Cerebro · mantenimiento diario del portero")
  })
  it("las cuentas por sector cuadran con la lista", () => {
    expect(Object.values(d.por_sector).reduce((a, b) => a + b, 0)).toBe(d.total)
    expect(d.por_sector).toMatchObject({ flujos: 3, datos: 1, dinero: 0 })
  })
})

describe("6.22 · el servidor busca el nombre de los procesos (solo lectura)", () => {
  it("lee el nombre en n8n por GET con su llave y lo pega al riesgo", async () => {
    const antes = { b: process.env.N8N_BASE_URL, k: process.env.N8N_API_KEY }
    process.env.N8N_BASE_URL = "https://n8n.test/"; process.env.N8N_API_KEY = "kn"
    try {
      const plataforma = vi.fn(async () => new Response(JSON.stringify(CRUDO), { status: 200 }))
      const n8n = vi.fn(async (url: string) => (url.endsWith("/fe9D7xdk5QpKmBRw") ? new Response(JSON.stringify({ name: NOMBRES.fe9D7xdk5QpKmBRw }), { status: 200 }) : new Response("{}", { status: 404 })))
      const r = await leerRiesgos({ plataformaUrl: "https://p.test", llave: "k", fetchImpl: plataforma as unknown as typeof fetch, procesosImpl: n8n as unknown as typeof fetch })
      expect(r.ok && r.datos.riesgos.find((x) => x.id === "r2")?.titulo).toBe("Falló el proceso «Landing Page CRO Optimizer v2»")
      expect(n8n).toHaveBeenCalledTimes(2)
      for (const [url, init] of n8n.mock.calls as unknown as Array<[string, RequestInit]>) { expect(url).toMatch(/^https:\/\/n8n\.test\/api\/v1\/workflows\/\w{16}$/); expect(init.method).toBe("GET") }
    } finally { process.env.N8N_BASE_URL = antes.b; process.env.N8N_API_KEY = antes.k }
  })
})

describe("6.22 · el panel", () => {
  const html = renderToStaticMarkup(createElement(PanelRiesgos, { onCerrar: () => {}, datosIniciales: normalizarRiesgos(conNombres(), AHORA) }))
  it("el radar dibuja los 8 sectores y debajo 8 tarjetas que filtran", () => {
    expect(html.match(/<g data-sector=/g)).toHaveLength(8)
    expect(html.match(/data-tarjeta-sector=/g)).toHaveLength(8)
    expect(html).toContain("Credenciales y accesos"); expect(html).toContain("Seguridad y cumplimiento")
  })
  it("ya no muestra saldos ni freno de gasto (se van a la pantalla Dinero)", () => {
    expect(html).not.toContain("Saldos de proveedores"); expect(html).not.toContain("Freno de gasto"); expect(html).not.toContain("techo")
  })
  it("tus pausas van fuera del radar y lo que no tiene fuente dice «sin dato»", () => {
    expect(html).toContain("Pausas que decidiste"); expect(html).toContain("foco en Náufrago")
    expect(html).toContain("calidad, plazos, seguridad y cumplimiento: el sistema todavía no tiene de dónde leerlos"); expect(html).not.toMatch(/: n8n conserva/)
    expect(html).toContain("1 aviso viejo caducó solo")
  })
  it("6.24 · el radar llena su columna: sin vacío alrededor (Emilio: «reduce el espacio vacío que lo rodea, que todo tenga más simetría»)", () => {
    const c = readFileSync("components/nuevo/PanelRiesgos.tsx", "utf8")
    expect(c).toContain('data-radar className="relative aspect-square w-full lg:aspect-auto lg:min-h-0 lg:flex-1"'); expect(c).not.toContain("max-w-[380px]"); expect(c).toContain("const C = 200, R = 150,")
  })
})

describe("6.22 · REGLA GENERAL · el chat de abajo siempre visible en todo /nuevo", () => {
  it("el chat se marca y la regla reserva su alto debajo de todo panel", () => {
    expect(readFileSync("components/nuevo/ChatDeOficinas.tsx", "utf8")).toContain("data-chat-de-oficinas")
    const css = readFileSync("app/globals.css", "utf8")
    expect(css).toContain("--nv-chat-reserva: 156px")
    expect(css).toContain("body:has([data-chat-de-oficinas]) .nv-panel { bottom: var(--nv-chat-reserva); }")
  })
  it("TODOS los paneles de /nuevo llevan la clase que les deja espacio al chat", () => {
    const paneles = readdirSync("components/nuevo").filter((f) => /^Panel.*\.tsx$/.test(f))
    expect(paneles.length).toBeGreaterThanOrEqual(13)
    for (const f of paneles) {
      const s = readFileSync(`components/nuevo/${f}`, "utf8")
      expect(s, f).not.toMatch(/<div className="fixed inset-0 z-\[70\]/)
      expect(s, f).toContain('className="nv-panel fixed inset-0 z-[70]')
    }
  })
})
