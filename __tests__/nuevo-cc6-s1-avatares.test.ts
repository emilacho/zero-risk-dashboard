/** Dashboard nuevo · CC6 Sprint 1 (01-nov): la escena viva de la oficina de marketing. 6 mesas · solo se sienta el que trabaja ahora · ficha con el agente real, fuente y hora. US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import type { EscenaDatos } from "@/lib/escena-avatares"
import { existsSync, readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import {
  alSuelo, armarEscena, asientosDeLaMesa, CAMARA, colocarFiguras, FOTO, giroHaciaElMonitor, invocacionCierraElDespacho, lineasDeLaFicha, MAXIMO_DE_FIGURAS, MAXIMO_POR_MESA, MESAS, mesaDelAgente, estadoDePantalla, matrizDeLaPantalla, oficioDeLaMesa, puntosDeLaPantalla,
  MINUTOS_FALLO, MINUTOS_TOPE, NOMBRES_SPLINE, nombreDelFlujo, pasoDe, proyectar, tableroDeLaMesa, type Despacho, type EntradaDeLaEscena, type InvocacionViva,
} from "@/lib/escena-avatares"
import { leerEscenaViva, LIMITE_DE_INVOCACIONES } from "@/lib/escena-avatares-datos"
import { Avatares } from "@/components/nuevo/escena/Avatares"

const ahora = new Date("2026-11-01T12:00:00Z")
const hace = (min: number) => new Date(ahora.getTime() - min * 60_000).toISOString()
const despacho = (agent_name: string, min: number, extra: Partial<Despacho> = {}): Despacho => ({ id: `d-${agent_name}-${min}`, agent_name, client_id: "c1", workflow_id: "X9F0zp6LQ2xGEYVS", workflow_execution_id: "209744", status: "running", running_at: hace(min), completed_at: null, created_at: hace(min), ...extra })
const invocacion = (agent_name: string, finMin: number, extra: Partial<InvocacionViva> = {}): InvocacionViva => ({ agent_name, client_id: "c1", workflow_id: "X9F0zp6LQ2xGEYVS", workflow_execution_id: "209744:analisis-mercado", status: "completed", started_at: hace(finMin + 3), ended_at: hace(finMin), cost_usd: 0.2879, step_name: null, task_text: "Eres el analista de tendencia y oportunidad de la categoría", ...extra })
const base = (extra: Partial<EntradaDeLaEscena> = {}): EntradaDeLaEscena => ({
  despachos: [], invocaciones: [],
  directorio: [{ agente: "market_research_analyst", equipo: "estrategia" }, { agente: "content-creator", equipo: "creativo" }, { agente: "carousel-designer", equipo: "creativo" }, { agente: "portero", equipo: null }],
  agentes: [{ name: "market_research_analyst", display_name: "Analista de mercado" }, { name: "jefe-marketing", display_name: "Jefe de marketing" }],
  clientes: [{ id: "c1", nombre: "Náufrago" }],
  equipos: [{ clave: "direccion", nombre: "Dirección", etapa: "activo" }, { clave: "estrategia", nombre: "Estrategia", etapa: "activo" }, { clave: "creativo", nombre: "Creativo", etapa: "activo" }, { clave: "web", nombre: "Web y búsqueda", etapa: "segunda_etapa" }, { clave: "medios", nombre: "Medios y Performance", etapa: "segunda_etapa" }, { clave: "relaciones", nombre: "Relaciones", etapa: "segunda_etapa" }],
  ahora, ...extra,
})

describe("las 6 mesas del boceto aprobado", () => {
  it("son 6, en el orden del organigrama, todas EN la foto regenerada, en rejilla de 2 filas × 3 columnas con el mismo paso", () => {
    expect(MESAS.map((m) => m.clave)).toEqual(["direccion", "estrategia", "creativo", "web", "medios", "relaciones"])
    expect(MESAS.filter((m) => m.etapa === "activo").map((m) => m.clave)).toEqual(["direccion", "estrategia", "creativo"])
    expect(MESAS.every((m) => m.en_la_foto)).toBe(true) // ya no hay capas de retoque
    for (const m of MESAS) for (const p of [m.silla, m.monitor, m.rotulo, m.centro]) { expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(FOTO.w); expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(FOTO.h) }
    expect(tableroDeLaMesa(MESAS[0]).split(" ")).toHaveLength(4)
    // rejilla: el paso entre columnas y entre filas es el mismo en toda la oficina (± 16 px por la perspectiva del render)
    const m = (k: string) => MESAS.find((x) => x.clave === k)!.monitor
    const resta = (p: { x: number; y: number }, q: { x: number; y: number }) => ({ x: p.x - q.x, y: p.y - q.y })
    const cerca = (a: { x: number; y: number }, b: { x: number; y: number }) => { expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(16); expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(16) }
    const col = resta(m("estrategia"), m("direccion"))
    for (const [a, b] of [["creativo", "estrategia"], ["medios", "web"], ["relaciones", "medios"]] as const) cerca(resta(m(a), m(b)), col)
    const fila = resta(m("web"), m("direccion"))
    for (const [a, b] of [["medios", "estrategia"], ["relaciones", "creativo"]] as const) cerca(resta(m(a), m(b)), fila)
    // la silla y el centro guardan el mismo desplazamiento respecto del monitor en las 6
    const d0 = resta(MESAS[0].silla, MESAS[0].monitor)
    for (const x of MESAS) expect(resta(x.silla, x.monitor)).toEqual(d0)
  })
  it("la foto de la oficina es la regenerada: 6 pantallas encendidas en los monitores de las mesas", () => {
    const foto = readFileSync("public/nuevo/marketing-2560.jpg")
    expect(foto.length).toBeGreaterThan(150_000); expect(foto.length).toBeLessThan(400_000)
    expect(existsSync("public/nuevo/marketing-oficina-simetrica.webp")).toBe(false) // la capa de retoques se fue
    expect(existsSync("public/nuevo/marketing-mesas-y-vidrio.webp")).toBe(false)
  })
  it("un solo sentado va en la silla; varios se reparten a lo largo de la mesa; nunca más de MAXIMO_POR_MESA", () => {
    const m = MESAS[1]
    expect(asientosDeLaMesa(m, 1)).toEqual([m.silla])
    const dos = asientosDeLaMesa(m, 2)
    expect(dos).toHaveLength(2)
    expect(dos[0].x + dos[1].x).toBeCloseTo(2 * m.silla.x, -1)
    expect(dos[0].y).not.toBe(dos[1].y)
    expect(asientosDeLaMesa(m, 9)).toHaveLength(MAXIMO_POR_MESA)
    expect(asientosDeLaMesa(m, 0)).toEqual([])
  })
})

describe("quién se sienta (solo el que trabaja ahora, dato real)", () => {
  it("un despacho abierto hace poco sin invocación que lo cierre: sentado en la mesa de su tarjeta, trabajando, con el flujo, el paso, el cliente y SIN gasto todavía", () => {
    const r = armarEscena(base({ despachos: [despacho("market_research_analyst", 4, { workflow_execution_id: "209744:analisis-mercado" })] }))
    const estrategia = r.mesas.find((m) => m.clave === "estrategia")!
    expect(estrategia.sentados).toHaveLength(1)
    expect(estrategia.sentados[0]).toMatchObject({ agente: "market_research_analyst", nombre: "Analista de mercado", estado: "trabajando", cliente: "Náufrago", flujo: "Plan de 90 días", paso: "analisis mercado", gasto_usd: null, origen_de_la_mesa: "directorio", hace: "hace 4 min" })
    expect(estrategia.trabajando).toBe(1)
    expect(r.mesas.filter((m) => m.clave !== "estrategia").every((m) => m.sentados.length === 0)).toBe(true)
    expect(r.sin_mesa).toEqual([])
    expect(r.fuente).toBe("agent_dispatches + agent_invocations · leído 12:00Z")
  })
  it("la invocación terminada de la misma corrida (id con «:paso») cierra el despacho: ya no está sentado, queda «reciente» en la lista del equipo", () => {
    const r = armarEscena(base({ despachos: [despacho("market_research_analyst", 6)], invocaciones: [invocacion("market_research_analyst", 2)] }))
    const estrategia = r.mesas.find((m) => m.clave === "estrategia")!
    expect(estrategia.sentados).toEqual([])
    expect(estrategia.equipo.find((p) => p.agente === "market_research_analyst")).toMatchObject({ estado: "reciente", hace: "hace 2 min", nota: null })
    expect(invocacionCierraElDespacho(despacho("market_research_analyst", 6), invocacion("market_research_analyst", 2, { workflow_execution_id: "209700:otro" }))).toBe(false)
    expect(invocacionCierraElDespacho(despacho("market_research_analyst", 6), invocacion("otro-agente", 2))).toBe(false)
  })
  it(`un despacho «running» más viejo que ${MINUTOS_TOPE} min NO se sienta (la vuelta que no regresa): se cuenta aparte y el miembro lleva la nota`, () => {
    const r = armarEscena(base({ despachos: [despacho("market_research_analyst", 125)] }))
    expect(r.mesas.every((m) => m.sentados.length === 0)).toBe(true)
    expect(r.sin_fin_registrado).toBe(1)
    const p = r.mesas.find((m) => m.clave === "estrategia")!.equipo.find((x) => x.agente === "market_research_analyst")!
    expect(p.estado).toBe("quieto")
    expect(p.nota).toBe("despacho abierto hace 2 h sin fin registrado")
  })
  it(`un fallo de hace menos de ${MINUTOS_FALLO} min se queda sentado en rojo con su gasto; uno más viejo no`, () => {
    const r = armarEscena(base({ invocaciones: [invocacion("content-creator", 3, { status: "failed", workflow_execution_id: "209800:pieza", cost_usd: 0.05, workflow_id: "otro" })] }))
    const creativo = r.mesas.find((m) => m.clave === "creativo")!
    expect(creativo.sentados[0]).toMatchObject({ agente: "content-creator", estado: "fallo", gasto_usd: 0.05, paso: "pieza", flujo: "flujo otro…" })
    expect(creativo.fallando).toBe(1)
    const viejo = armarEscena(base({ invocaciones: [invocacion("content-creator", 40, { status: "failed" })] }))
    expect(viejo.mesas.find((m) => m.clave === "creativo")!.sentados).toEqual([])
    const porDespacho = armarEscena(base({ despachos: [despacho("content-creator", 2, { status: "error", completed_at: hace(2) })] }))
    expect(porDespacho.mesas.find((m) => m.clave === "creativo")!.sentados[0]?.estado).toBe("fallo")
  })
  it("sin tarjeta en el directorio manda el mapa firmado (jefe-marketing → Dirección, rotulado); con tarjeta sin equipo (el portero) no hay mesa", () => {
    expect(mesaDelAgente("jefe-marketing", base().directorio)).toEqual({ mesa: "direccion", origen: "mapa" })
    expect(mesaDelAgente("portero", base().directorio)).toBeNull()
    expect(mesaDelAgente("un-agente-que-nadie-conoce", base().directorio)).toBeNull()
    const r = armarEscena(base({ despachos: [despacho("jefe-marketing", 1), despacho("portero", 1, { workflow_execution_id: "1" })] }))
    const direccion = r.mesas.find((m) => m.clave === "direccion")!
    expect(direccion.sentados[0]).toMatchObject({ agente: "jefe-marketing", origen_de_la_mesa: "mapa" })
    expect(lineasDeLaFicha(direccion.sentados[0], direccion)[1]).toBe("Dirección (según el mapa, sin tarjeta en el directorio) · trabajando")
    expect(r.sin_mesa.map((s) => s.agente)).toEqual(["portero"])
    expect(r.mesas.flatMap((m) => m.sentados).some((s) => s.agente === "portero")).toBe(false)
  })
  it("dos trabajando a la vez en la misma mesa: dos sentados en dos asientos distintos; el mismo agente en la misma corrida no se duplica", () => {
    const r = armarEscena(base({ despachos: [despacho("content-creator", 1, { workflow_execution_id: "1" }), despacho("carousel-designer", 2, { workflow_execution_id: "2" }), despacho("content-creator", 1, { id: "dup", workflow_execution_id: "1" })] }))
    const creativo = r.mesas.find((m) => m.clave === "creativo")!
    expect(creativo.sentados.map((s) => s.agente)).toEqual(["content-creator", "carousel-designer"])
    const c = colocarFiguras(r.mesas)
    expect(c).toHaveLength(2)
    expect(c[0].px).not.toEqual(c[1].px)
    expect(c.map((x) => x.figura)).toEqual(["Figura 1", "Figura 2"])
  })
  it("la ficha dice lo que hay y «sin dato» donde no hay; termina con la fuente y la hora; mientras corre no inventa gasto", () => {
    const r = armarEscena(base({ despachos: [despacho("market_research_analyst", 4, { workflow_execution_id: "209744:analisis-mercado" })], invocaciones: [invocacion("market_research_analyst", 30, { workflow_execution_id: "209000:analisis-mercado" })] }))
    const m = r.mesas.find((x) => x.clave === "estrategia")!
    const l = lineasDeLaFicha(m.sentados[0], m)
    expect(l[0]).toBe("Analista de mercado")
    expect(l[1]).toBe("Estrategia · trabajando")
    expect(l[2]).toBe("Náufrago · Plan de 90 días · analisis mercado")
    expect(l).toContain("desde hace 4 min")
    expect(l).toContain("gasto de esta tarea · en curso, sin registrar aún")
    expect(l.at(-1)).toBe("fuente agent_dispatches + agent_invocations · leído 12:00Z")
    expect(l.some((x) => x.startsWith("tarea ·"))).toBe(false) // la corrida de hace 30 min es OTRA: su texto no se le cuelga a la de ahora
    const sinCliente = armarEscena(base({ despachos: [despacho("market_research_analyst", 4, { client_id: null, workflow_id: null, workflow_execution_id: null })] }))
    expect(lineasDeLaFicha(sinCliente.mesas[1].sentados[0], sinCliente.mesas[1])[2]).toBe("sin cliente · sin flujo registrado")
  })
  it("sin dato no hay nadie sentado ni nombres inventados; la etapa viene de la tabla de equipos", () => {
    const r = armarEscena(base())
    expect(r.mesas.every((m) => m.sentados.length === 0 && m.trabajando === 0)).toBe(true)
    expect(r.mesas.find((m) => m.clave === "web")!.etapa).toBe("segunda_etapa")
    const otraEtapa = armarEscena(base({ equipos: [{ clave: "web", nombre: "Web", etapa: "activo" }] }))
    expect(otraEtapa.mesas.find((m) => m.clave === "web")).toMatchObject({ etapa: "activo", nombre: "Web" })
    expect(r.mesas.find((m) => m.clave === "creativo")!.equipo.map((p) => p.agente).sort()).toEqual(["carousel-designer", "content-creator"])
  })
  it("los nombres de flujo y paso salen del dato; lo desconocido se abrevia, no se inventa", () => {
    expect(nombreDelFlujo("X9F0zp6LQ2xGEYVS")).toBe("Plan de 90 días")
    expect(nombreDelFlujo("o8qaF7bI0PKv2XGZ")).toBe("flujo o8qa…")
    expect(nombreDelFlujo(null)).toBe("sin flujo registrado")
    expect(pasoDe("209744:analisis-mercado")).toBe("analisis mercado")
    expect(pasoDe("209744")).toBeNull()
    expect(pasoDe("209744", "redactar_plan")).toBe("redactar plan")
  })
})

describe("la cámara de Spline sobre la foto", () => {
  it("de la foto al suelo y de vuelta a la foto se vuelve al mismo píxel; las marcas y figuras tienen nombre fijo", () => {
    for (const m of MESAS) {
      const s = alSuelo(m.silla, CAMARA)
      expect(s.y).toBe(0)
      const p = proyectar(s, CAMARA)
      expect(p.x).toBeCloseTo(m.silla.x, 3); expect(p.y).toBeCloseTo(m.silla.y, 3)
      expect(Number.isFinite(giroHaciaElMonitor(m, CAMARA))).toBe(true)
    }
    // más abajo en la foto = más cerca de la cámara (z mayor)
    expect(alSuelo({ x: 1024, y: 1000 }).z).toBeGreaterThan(alSuelo({ x: 1024, y: 600 }).z)
    expect(NOMBRES_SPLINE.figuras).toHaveLength(MAXIMO_DE_FIGURAS)
    expect(NOMBRES_SPLINE.marcas).toEqual(MESAS.map((m) => `Marca ${m.clave}`))
  })
})

/** una base de mentira: cada tabla devuelve lo suyo y deja registrado qué se le pidió */
function baseFalsa(tablas: Record<string, unknown[]>, errores: Record<string, string> = {}) {
  const pedidos: string[] = []
  const consulta = (tabla: string) => {
    const q: Record<string, unknown> = {}
    for (const m of ["select", "order", "limit", "gte", "or", "eq"]) q[m] = (...a: unknown[]) => { pedidos.push(`${tabla}.${m}(${a.map((x) => JSON.stringify(x)).join(",")})`); return q }
    q.then = (res: (v: unknown) => unknown) => res(errores[tabla] ? { data: null, error: { message: errores[tabla] } } : { data: tablas[tabla] ?? [], error: null })
    return q
  }
  return { supa: { from: consulta } as never, pedidos }
}

describe("la lectura y la ruta", () => {
  it("lee despachos abiertos o recientes, invocaciones de 24 h con su metadata, directorio, equipos y nombres; arma la escena sin escribir nada", async () => {
    const { supa, pedidos } = baseFalsa({
      agent_dispatches: [{ id: "1", agent_name: "market_research_analyst", client_id: "c1", workflow_id: "X9F0zp6LQ2xGEYVS", workflow_execution_id: "209744:analisis-mercado", status: "running", running_at: hace(3), completed_at: null, created_at: hace(3) }],
      agent_invocations: [{ agent_name: "jefe-marketing", client_id: "c1", workflow_id: "X9F0zp6LQ2xGEYVS", workflow_execution_id: "209700", status: "completed", started_at: hace(50), ended_at: hace(40), cost_usd: "1.083406", metadata: { step_name: "plan", task_text: "Escribe tú el plan" } }],
      agents: [{ name: "market_research_analyst", display_name: "Analista de mercado" }],
      clients: [{ id: "c1", name: "Náufrago" }],
      oficina_directorio: [{ agente: "market_research_analyst", equipo: "estrategia" }],
      oficina_equipos: [{ clave: "estrategia", nombre: "Estrategia", etapa: "activo" }],
    })
    const r = await leerEscenaViva(supa, { ahora })
    expect(r.mesas.find((m) => m.clave === "estrategia")!.sentados[0]).toMatchObject({ nombre: "Analista de mercado", cliente: "Náufrago", estado: "trabajando" })
    expect(r.mesas.find((m) => m.clave === "direccion")!.equipo.find((p) => p.agente === "jefe-marketing")).toMatchObject({ estado: "reciente", origen_de_la_mesa: "mapa" })
    expect(pedidos.some((p) => p.startsWith("agent_dispatches.or(") && p.includes("status.eq.running"))).toBe(true)
    expect(pedidos).toContain(`agent_invocations.limit(${LIMITE_DE_INVOCACIONES})`)
    expect(pedidos.some((p) => /insert|update|delete|upsert/.test(p))).toBe(false)
  })
  it("si la tabla de equipos no está, manda la tabla de mesas; si fallan los despachos, se dice", async () => {
    const sinEquipos = baseFalsa({}, { oficina_equipos: 'relation "oficina_equipos" does not exist' })
    const r = await leerEscenaViva(sinEquipos.supa, { ahora })
    expect(r.mesas.map((m) => m.etapa)).toEqual(["activo", "activo", "activo", "segunda_etapa", "segunda_etapa", "segunda_etapa"])
    await expect(leerEscenaViva(baseFalsa({}, { agent_dispatches: "se cayó" }).supa, { ahora })).rejects.toThrow("agent_dispatches: se cayó")
  })
  it("la ruta es solo de administrador y de solo lectura; la capa va dentro de la proyección de marketing", () => {
    const ruta = readFileSync("app/api/escena-viva/route.ts", "utf8")
    expect(ruta).toContain("exigirAdmin()")
    expect(ruta).toContain("leerEscenaViva(")
    expect(ruta).not.toMatch(/insert|update|delete|upsert/)
    const escena = readFileSync("components/nuevo/EscenaViva.tsx", "utf8")
    expect(escena).toContain('import { Avatares } from "@/components/nuevo/escena/Avatares"')
    expect(escena).toMatch(/depto === "marketing" && \(<>[\s\S]*<Avatares \/>[\s\S]*<\/>\)\}/)
  })
  it("antes del dato la capa dibuja las 6 mesas vacías (todas de la foto, sin punteado), sin sentados ni fichas", () => {
    const html = renderToStaticMarkup(createElement(Avatares))
    expect(html.match(/data-mesa="/g)).toHaveLength(6)
    // pedido de Emilio 01-nov: nada de mesas punteadas
    expect(html).not.toContain("nv-av-punteada")
    expect(html).not.toContain("stroke-dasharray")
    expect(html).not.toContain("nv-av-mesas-extra") // sin capas encima de la foto
    expect(html).not.toContain('class="nv-av-asiento"')
    expect(html).not.toContain('role="tooltip"')
    expect(html).toContain("MEDIOS Y PERFORMANCE")
    expect(html).toContain("por activar · nadie trabaja")
  })
})

describe("Sprint A · pantallas vivas en las mesas (pedido de Emilio, 01-nov)", () => {
  it("cada mesa tiene su pantalla medida en la foto, cerca de su monitor, y un oficio", () => {
    for (const m of MESAS) {
      const pts = puntosDeLaPantalla(m.clave).split(" ").map((p) => p.split(",").map(Number))
      expect(pts).toHaveLength(4)
      for (const [x, y] of pts) { expect(Math.abs(x - m.monitor.x)).toBeLessThan(45); expect(Math.abs(y - m.monitor.y)).toBeLessThan(45) }
      expect(matrizDeLaPantalla(m.clave)).toMatch(/^matrix\(/)
    }
    expect(MESAS.map((m) => oficioDeLaMesa(m.clave))).toEqual(["tablero", "grafico", "diseno", "codigo", "grafico", "mensajes"])
  })
  it("negra si nadie trabaja (también las por activar), viva si alguien trabaja, roja si falló", () => {
    expect(estadoDePantalla({ trabajando: 0, fallando: 0 })).toBe("apagada")
    expect(estadoDePantalla({ trabajando: 1, fallando: 0 })).toBe("trabajando")
    expect(estadoDePantalla({ trabajando: 0, fallando: 1 })).toBe("fallo")
    expect(estadoDePantalla({ trabajando: 1, fallando: 1 })).toBe("trabajando")
    const html = renderToStaticMarkup(createElement(Avatares))
    expect(html.match(/data-pantalla="apagada"/g)).toHaveLength(6) // antes del dato y sin nadie: las 6 negras
    const datos = { leido_en: "2026-11-01T17:00:00Z", fuente: "x", sin_mesa: [], sin_fin_registrado: 0, mesas: MESAS.map((m) => ({ ...m, sentados: [], equipo: [], trabajando: m.clave === "web" ? 1 : 0, fallando: m.clave === "medios" ? 1 : 0 })) }
    const vivo = renderToStaticMarkup(createElement(Avatares, { datosIniciales: datos as unknown as EscenaDatos }))
    expect(vivo).toMatch(/data-pantalla="trabajando" data-pantalla-mesa="web"/); expect(vivo).toMatch(/data-pantalla="fallo" data-pantalla-mesa="medios"/)
    expect(vivo.match(/data-pantalla="apagada"/g)).toHaveLength(4)
    expect(vivo).toContain('class="nv-pa-sube"') // el código de Web avanza
    expect(vivo).toContain("@media (prefers-reduced-motion:reduce){.nv-av .nv-pa-respira")
  })
})
