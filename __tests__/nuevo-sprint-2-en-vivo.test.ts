/** Dashboard nuevo · sprint 2 «En vivo» (31-oct): el tótem abre la vista, el grafo sale de filas REALES y el pulso solo corre por filas que llegan. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { EscenaNuevo, ZONAS } from "@/components/nuevo/EscenaNuevo"
import { TOTEM, TotemEnVivo } from "@/components/nuevo/TotemEnVivo"
import {
  CENTRO, LIENZO, MAXIMO_DE_EMPLEADOS, OFICINAS_EN_VIVO, VENTANA_DEL_PRIMER_PULSO_MS, entreLasRecientes, filasNuevas, oficinaDelEmpleado, recorridoDelPulso, ubicarEmpleados, type FilaEnVivo,
} from "@/lib/en-vivo"
import { leerEnVivo } from "@/lib/en-vivo-datos"

const fila = (id: string, empleado: string, cuando: string, extra: Partial<FilaEnVivo> = {}): FilaEnVivo => ({
  id, cuando, hace: "hace un momento", empleado, agente: empleado, oficina: oficinaDelEmpleado(empleado), oficina_nombre: null, cliente: null, que_hace: "x", estado: "listo", ...extra,
})

describe("el tótem", () => {
  it("la pantalla suelta de abajo ya no es un enlace a las oficinas: es el botón «En vivo» (el resto de la escena queda igual)", () => {
    expect(ZONAS.map((z) => z.clave)).toEqual(["oficina", "marketing"]) // 6.12: el monolito es tu oficina
    expect(ZONAS.flatMap((z) => z.formas)).not.toContain(TOTEM.forma)
    const html = renderToStaticMarkup(createElement(EscenaNuevo, null, createElement(TotemEnVivo)))
    expect(html).toContain('role="button"')
    expect(html).toContain('aria-label="En vivo"')
    expect([...html.matchAll(/<a [^>]*?href="([^"]+)"/g)].map((m) => m[1]).sort()).toEqual(["/nuevo/marketing", "/nuevo/oficina"]) // 6.12: el monolito es tu oficina (el Cerebro vive adentro)
    expect(html).not.toContain('role="dialog"') // cerrado de entrada: la capa no existe hasta el clic
  })
  it("la página pone el tótem dentro de la escena", () => {
    expect(readFileSync("components/nuevo/EscenaViva.tsx", "utf8")).toMatch(/<EscenaNuevo [^\n]*>\s*<TotemEnVivo \/>\s*<\/EscenaNuevo>/)
  })
})

describe("el grafo", () => {
  it("cada empleado conocido cae en una de las cinco oficinas; el portero va al cerebro por su orden; los desconocidos no se dibujan", () => {
    expect(oficinaDelEmpleado("chief-financial-officer")).toBe("financiera")
    expect(oficinaDelEmpleado("paid_media_paid_social_strategist")).toBe("financiera")
    expect(oficinaDelEmpleado("editor-en-jefe")).toBe("jefatura")
    expect(oficinaDelEmpleado("campaign-brief-agent")).toBe("planeacion")
    expect(oficinaDelEmpleado("content-creator")).toBe("creativa")
    expect(oficinaDelEmpleado("quien-sea", "portero.razonar")).toBe("cerebro")
    expect(oficinaDelEmpleado("empleado-que-no-conozco")).toBeNull()
    expect(OFICINAS_EN_VIVO.map((o) => o.clave).sort()).toEqual(["cerebro", "creativa", "financiera", "jefatura", "planeacion"])
  })
  it("solo se dibujan empleados que hicieron algo: sin filas no hay nodos; repetidos cuentan una vez; hay un máximo", () => {
    expect(ubicarEmpleados([])).toEqual([])
    const dos = ubicarEmpleados([fila("1", "editor-en-jefe", "2026-10-31T10:00:00Z"), fila("2", "editor-en-jefe", "2026-10-31T10:01:00Z")])
    expect(dos).toHaveLength(1)
    expect(ubicarEmpleados([fila("1", "empleado-que-no-conozco", "2026-10-31T10:00:00Z")])).toEqual([])
    const muchos = Object.keys({ "campaign-brief-agent": 1, "jefe-marketing": 1, "onboarding-specialist": 1, "competitive-intelligence-agent": 1, "reporting-agent": 1, "content-creator": 1, "carousel-designer": 1, "design-image-prompt-engineer": 1, "image-generation": 1, "brand-strategist": 1, "editor-en-jefe": 1, "jefe-client-success": 1, "finance-fpa-analyst": 1, "chief-financial-officer": 1 })
    expect(ubicarEmpleados(muchos.map((e, i) => fila(String(i), e, "2026-10-31T10:00:00Z")))).toHaveLength(MAXIMO_DE_EMPLEADOS)
  })
  it("todo cae dentro del lienzo y los empleados no se pisan con su oficina", () => {
    const todos = ["campaign-brief-agent", "jefe-marketing", "onboarding-specialist", "content-creator", "carousel-designer", "brand-strategist", "editor-en-jefe", "jefe-client-success", "finance-fpa-analyst", "chief-financial-officer", "tracking-specialist", "etiquetador-del-cerebro"]
    const nodos = ubicarEmpleados(todos.map((e, i) => fila(String(i), e, "2026-10-31T10:00:00Z")))
    for (const o of OFICINAS_EN_VIVO) { expect(o.x).toBeGreaterThan(20); expect(o.x).toBeLessThan(LIENZO.w - 20); expect(o.y).toBeGreaterThan(20); expect(o.y).toBeLessThan(LIENZO.h - 40) }
    for (const n of nodos) {
      expect(n.x, n.empleado).toBeGreaterThan(0); expect(n.x, n.empleado).toBeLessThan(LIENZO.w)
      expect(n.y, n.empleado).toBeGreaterThan(0); expect(n.y, n.empleado).toBeLessThan(LIENZO.h)
      const o = OFICINAS_EN_VIVO.find((x) => x.clave === n.oficina)!
      expect(Math.hypot(n.x - o.x, n.y - o.y), n.empleado).toBeGreaterThan(30)
    }
  })
  it("el lugar de un empleado no cambia cuando llega alguien de OTRA oficina", () => {
    const a = ubicarEmpleados([fila("1", "editor-en-jefe", "2026-10-31T10:00:00Z")])
    const b = ubicarEmpleados([fila("1", "editor-en-jefe", "2026-10-31T10:00:00Z"), fila("2", "chief-financial-officer", "2026-10-31T10:00:01Z")])
    expect(b.find((n) => n.empleado === "editor-en-jefe")).toEqual(a[0])
  })
  it("el pulso viaja del centro a la oficina y de ahí al empleado; sin lugar propio llega solo a la oficina", () => {
    const [n] = ubicarEmpleados([fila("1", "editor-en-jefe", "2026-10-31T10:00:00Z")])
    const j = OFICINAS_EN_VIVO.find((o) => o.clave === "jefatura")!
    expect(recorridoDelPulso("jefatura", n)).toBe(`M${CENTRO.x},${CENTRO.y} L${j.x},${j.y} L${n.x},${n.y}`)
    expect(recorridoDelPulso("jefatura", null)).toBe(`M${CENTRO.x},${CENTRO.y} L${j.x},${j.y}`)
  })
})

describe("cuándo hay pulso", () => {
  it("solo las filas que NO se habían visto, la más vieja primero (cada una pulsa una sola vez)", () => {
    const f = [fila("c", "a", "2026-10-31T10:03:00Z"), fila("a", "a", "2026-10-31T10:01:00Z"), fila("b", "a", "2026-10-31T10:02:00Z")]
    expect(filasNuevas(new Set(["a"]), f).map((x) => x.id)).toEqual(["b", "c"])
    expect(filasNuevas(new Set(["a", "b", "c"]), f)).toEqual([])
  })
  it("al abrir solo pulsan los últimos minutos: lo viejo no es «ahora»", () => {
    const ahora = Date.parse("2026-10-31T12:00:00Z")
    const f = [fila("v", "a", "2026-10-31T11:50:00Z"), fila("n", "a", new Date(ahora - VENTANA_DEL_PRIMER_PULSO_MS + 1000).toISOString()), fila("m", "a", "no es fecha")]
    expect(entreLasRecientes(f, ahora).map((x) => x.id)).toEqual(["n"])
  })
})

/** una base de mentira: cada consulta devuelve lo mismo y deja registrado qué se le pidió */
function baseFalsa(invocaciones: Record<string, unknown>[], extra: { agents?: Record<string, unknown>[]; clients?: Record<string, unknown>[] } = {}) {
  const pedidos: string[] = []
  const consulta = (tabla: string, data: unknown[], count?: number) => {
    const q: Record<string, unknown> = {}
    for (const m of ["select", "order", "limit", "gte"]) q[m] = (...a: unknown[]) => { pedidos.push(`${tabla}.${m}(${a.map((x) => JSON.stringify(x)).join(",")})`); return q }
    q.gt = (c: string, v: string) => { pedidos.push(`${tabla}.gt(${c},${v})`); return q }
    q.then = (res: (v: unknown) => unknown) => res({ data, count: count ?? data.length, error: null })
    return q
  }
  const supa = { from: (t: string) => (t === "agent_invocations" ? consulta(t, invocaciones, 7) : consulta(t, t === "agents" ? extra.agents ?? [] : extra.clients ?? [])) }
  return { supa: supa as never, pedidos }
}

describe("la lectura (datos reales, en nombres del sistema)", () => {
  const ahora = new Date("2026-10-31T12:00:00Z")
  const inv = [
    { id: "i2", agent_name: "chief-financial-officer", command: "x", status: "completed", ended_at: "2026-10-31T11:59:30Z", created_at: "2026-10-31T11:59:31Z", started_at: "2026-10-31T11:55:00Z", client_id: "c1" },
    { id: "i1", agent_name: "empleado-nuevo-sin-nombre", command: "x", status: "failed", ended_at: null, created_at: "2026-10-31T11:50:00Z", started_at: "2026-10-31T11:49:00Z", client_id: null },
  ]
  const dir = { agents: [{ name: "chief-financial-officer", display_name: "Director financiero" }], clients: [{ id: "c1", name: "Náufrago" }] }

  it("trae empleado, oficina, cliente y qué hace, sin códigos; cuenta las últimas 24 h; el cursor es la última fila REGISTRADA", async () => {
    const { supa } = baseFalsa(inv, dir)
    const r = await leerEnVivo(supa, { ahora })
    expect(r.hoy).toBe(7)
    expect(r.cursor).toBe("2026-10-31T11:59:31Z")
    const [a, b] = r.filas
    expect(a).toMatchObject({ id: "i2", empleado: "chief-financial-officer", agente: "Director financiero", oficina: "financiera", oficina_nombre: "Oficina financiera", cliente: "Náufrago", estado: "listo", hace: "hace un momento" })
    expect(a.que_hace).toBe("revisó las finanzas para Náufrago")
    expect(b).toMatchObject({ agente: "Empleado nuevo sin nombre", oficina: null, cliente: null, estado: "fallo" })
    expect(b.que_hace.startsWith("no pudo")).toBe(true)
    for (const x of r.filas) expect(JSON.stringify(x)).not.toMatch(/cost|usd|tokens/i)
  })
  it("el sondeo trae solo lo registrado después de `desde`, y el límite está acotado", async () => {
    const { supa, pedidos } = baseFalsa(inv, dir)
    await leerEnVivo(supa, { ahora, desde: "2026-10-31T11:00:00Z", limite: 9999 })
    expect(pedidos).toContain("agent_invocations.gt(created_at,2026-10-31T11:00:00Z)")
    expect(pedidos).toContain("agent_invocations.limit(40)")
    const sin = baseFalsa(inv, dir)
    await leerEnVivo(sin.supa, { ahora, desde: "basura" })
    expect(sin.pedidos.some((p) => p.includes(".gt("))).toBe(false)
  })
  it("sin trabajo no inventa nada", async () => {
    const r = await leerEnVivo(baseFalsa([], dir).supa, { ahora })
    expect(r.filas).toEqual([])
    expect(r.cursor).toBeNull()
  })
})

describe("la ruta y el panel", () => {
  it("la ruta es solo de administrador", () => {
    const r = readFileSync("app/api/en-vivo/route.ts", "utf8")
    expect(r).toMatch(/exigirAdmin\(\)/)
    expect(r.indexOf("exigirAdmin()")).toBeLessThan(r.indexOf("leerEnVivo("))
  })
  it("el panel sondea cada 5 s, se detiene con la pestaña oculta, respeta «reducir movimiento» y se cierra con Esc", () => {
    const p = readFileSync("components/nuevo/PanelEnVivo.tsx", "utf8")
    expect(p).toMatch(/CADA_MS = 5_000/)
    expect(p).toMatch(/document\.hidden/)
    expect(p).toMatch(/prefers-reduced-motion/)
    expect(p).toMatch(/e\.key === "Escape"/)
    expect(p).toMatch(/role="dialog"/)
  })
})
