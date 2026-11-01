/**
 * DASHBOARD NUEVO · SPRINT 6.10 (encargo Lenovo 01-nov §2 + ADENDA 6 + MAPA «ESTRUCTURA FINAL: 6 EQUIPOS»): el Centro de campaña con sus 9 botones en el orden de la
 * cadena, y los tres nuevos: Brief de campaña (4) · Gran idea (5) · Equipo (8, el organigrama de 6 equipos). Todo SOLO LECTURA; lo que la plataforma no tiene
 * todavía (brief y conceptos de la cadena nueva · T9) se dice tal cual, no se inventa.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { APLICACIONES } from "@/lib/aplicaciones-marketing"
import { PanelAplicaciones, detalleDelCuadro } from "@/components/nuevo/PanelAplicaciones"
import { PanelEquipo } from "@/components/nuevo/PanelEquipo"
import { PanelBrief } from "@/components/nuevo/PanelBrief"
import { PanelGranIdea } from "@/components/nuevo/PanelGranIdea"
import { EQUIPOS, EQUIPOS_DE_MARKETING, MINUTOS_TRABAJANDO, actividadDelAgente, armarEquipos, equipoDelAgente, equiposDelAgente, estadoDeAhoraLegible, nombreCanonico, puestosDelAgente, resumenDelEquipo, type FilaDeAgente, type FilaDeDirectorio, type Invocacion } from "@/lib/organigrama"
import { briefDesdeFila, briefVigente, detalleDelBrief, estadoDelBriefLegible, seccionesDelBrief } from "@/lib/brief"
import { esTablaInexistente } from "@/lib/brief-datos"
import { detalleDeGranIdea, tarjetaDesdeFila } from "@/lib/gran-idea-datos"
import type { EquipoDelCliente } from "@/lib/equipo-datos"
import type { Centro } from "@/lib/centro-datos"

const leer = (p: string) => readFileSync(p, "utf8")
const NAUFRAGO = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const CLIENTE = { id: NAUFRAGO, nombre: "Náufrago" }
const AHORA = new Date("2026-11-01T12:00:00Z")

describe("6.10 · el Centro de campaña tiene 9 botones en el orden de la cadena", () => {
  it("1 Manual · 2 Informes · 3 Plan · 4 Brief · 5 Gran idea · 6 Calendario · 7 Piezas · 8 Equipo · 9 Gasto; los nuevos abren encima", () => {
    expect(APLICACIONES.map((a) => `${a.paso} ${a.nombre}`)).toEqual(["1 Manual de marca", "2 Informes", "3 Plan de 90 días", "4 Brief de campaña", "5 Gran idea", "6 Calendario", "7 Piezas", "8 Equipo", "9 Gasto"])
    expect(APLICACIONES.map((a) => a.paso)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    for (const k of ["brief", "gran_idea", "equipo"] as const) expect(APLICACIONES.find((a) => a.clave === k)!.enlace(NAUFRAGO)).toBeNull()
    const html = renderToStaticMarkup(createElement(PanelAplicaciones, { onCerrar: () => {} }))
    expect(html.match(/data-paso="\d"/g)).toHaveLength(9)
    expect(html).toContain('data-aplicacion="gran_idea"'); expect(html).toContain('data-aplicacion="equipo"'); expect(html).toContain('data-aplicacion="brief"')
    expect(html).toContain("los 9 pasos de la campaña")
  })
  it("la segunda línea de los cuadros nuevos la trae la lectura del centro (lo real o lo que falta); sin ella queda la descripción fija", () => {
    const centro: Centro = { cliente: NAUFRAGO, informes: { texto: "todavía sin informes", aviso: false, total: 0 }, brief: { texto: "La cadena aún no publica el brief (llega con T9)", aviso: false, publicado: false }, gran_idea: { texto: "Espera tu decisión", aviso: true, publicado: true }, equipo: { texto: "2 empleados trabajan ahora mismo", aviso: false, trabajando: 2 }, leido_en: "x" }
    expect(detalleDelCuadro("brief", null, centro).texto).toBe("La cadena aún no publica el brief (llega con T9)")
    expect(detalleDelCuadro("gran_idea", null, centro)).toEqual({ texto: "Espera tu decisión", aviso: true })
    expect(detalleDelCuadro("equipo", null, centro).texto).toBe("2 empleados trabajan ahora mismo")
    expect(detalleDelCuadro("brief", null).texto).toBe(APLICACIONES.find((a) => a.clave === "brief")!.descripcion)
    const p = leer("components/nuevo/PanelAplicaciones.tsx")
    expect(p).toContain("/api/centro"); expect(p).toContain('if (vista === "brief") return <PanelBrief'); expect(p).toContain('if (vista === "gran_idea") return <PanelGranIdea'); expect(p).toContain('if (vista === "equipo") return <PanelEquipo')
  })
  it("las cuatro lecturas nuevas piden administrador y no se guardan en caché", () => {
    for (const r of ["equipo", "brief", "gran-idea", "centro"]) {
      const s = leer(`app/api/${r}/route.ts`)
      expect(s).toContain("await exigirAdmin()"); expect(s).toContain('"Cache-Control": "no-store"'); expect(s).toContain("export async function GET"); expect(s).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/)
    }
  })
})

describe("6.10 · el organigrama: 6 equipos del MAPA firmado (01-nov)", () => {
  it("son Dirección · Estrategia · Creativo (activos) y Web y búsqueda · Medios y Performance · Relaciones (segunda etapa); afuera, proveedores y otros", () => {
    expect(EQUIPOS_DE_MARKETING).toEqual(["direccion", "estrategia", "creativo", "web", "medios", "relaciones"])
    expect(EQUIPOS.filter((e) => e.etapa === "activo").map((e) => e.nombre)).toEqual(["Dirección", "Estrategia", "Creativo"])
    expect(EQUIPOS.filter((e) => e.etapa === "segunda_etapa").map((e) => e.nombre)).toEqual(["Web y búsqueda", "Medios y Performance", "Relaciones"])
    expect(EQUIPOS.filter((e) => e.etapa === "fuera").map((e) => e.clave)).toEqual(["proveedores", "otros"])
    expect(EQUIPOS.find((e) => e.clave === "direccion")!.sistema).toBe("jefatura de marketing")
    expect(EQUIPOS.find((e) => e.clave === "medios")!.bloqueo).toMatch(/Meta/)
  })
  it("cada agente del MAPA está en su equipo; guion y guion bajo son el mismo empleado; jefe-marketing dirige y también escribe el plan", () => {
    expect(nombreCanonico("Editor_En_Jefe ")).toBe("editor-en-jefe")
    expect(equipoDelAgente("jefe-marketing")).toBe("direccion"); expect(equiposDelAgente("jefe-marketing")).toEqual(["direccion", "estrategia"])
    expect(equipoDelAgente("market_research_analyst")).toBe("estrategia")
    expect(equipoDelAgente("campaign-brief-agent")).toBe("estrategia")
    expect(equipoDelAgente("creative-director-mesa")).toBe("creativo"); expect(equipoDelAgente("carousel_designer")).toBe("creativo")
    expect(equipoDelAgente("seo-specialist")).toBe("web"); expect(equipoDelAgente("cro-specialist")).toBe("web")
    expect(equipoDelAgente("media-buyer")).toBe("medios"); expect(equipoDelAgente("email_marketer")).toBe("medios")
    expect(equipoDelAgente("community_manager")).toBe("relaciones"); expect(equipoDelAgente("influencer-manager")).toBe("relaciones")
    expect(equipoDelAgente("portero-del-cerebro")).toBe("proveedores"); expect(equipoDelAgente("video-generation")).toBe("proveedores")
    expect(equipoDelAgente("agente-que-no-existe")).toBe("otros"); expect(puestosDelAgente("agente-que-no-existe")).toEqual([])
    // lo firmado y no instalado va aparte, nunca como presente
    expect(EQUIPOS.find((e) => e.clave === "creativo")!.areas.flatMap((a) => a.por_instalar)).toContain("Whimsy Injector")
    for (const e of EQUIPOS) for (const a of e.areas) for (const n of a.por_instalar) expect(a.agentes.map(nombreCanonico)).not.toContain(nombreCanonico(n))
    // pero en cuanto se instala («Whimsy Injector» → fila `whimsy-injector`), cae en su equipo y no en «otros»
    expect(equipoDelAgente("whimsy-injector")).toBe("creativo"); expect(equipoDelAgente("inclusive-visuals-specialist")).toBe("creativo"); expect(equipoDelAgente("tiktok-strategist")).toBe("creativo")
    const eq = armarEquipos([{ name: "whimsy-injector", display_name: "Whimsy Injector", role: null, model: null, is_active: true, status: null }], [], [], { ahora: AHORA })
    const creativo = eq.find((e) => e.clave === "creativo")!
    expect(creativo.miembros.map((m) => m.nombre)).toEqual(["whimsy-injector"]); expect(creativo.areas.flatMap((a) => a.por_instalar)).not.toContain("Whimsy Injector"); expect(creativo.por_instalar_total).toBe(2) // TikTok Strategist + Inclusive Visuals siguen por instalar
    expect(eq.find((e) => e.clave === "otros")!.miembros).toEqual([])
  })
  it("qué hace cada uno: trabajando = corrida abierta hace < 20 min · trabajó hoy = algo en 24 h · si no, quieto", () => {
    const t = AHORA.getTime()
    const inv: Invocacion[] = [
      { agent_name: "content-creator", command: "pieza", started_at: new Date(t - 5 * 60_000).toISOString(), ended_at: null, status: "running", client_id: NAUFRAGO, cost_usd: 0.1 },
      { agent_name: "content-creator", command: "pieza", started_at: new Date(t - 3 * 3600_000).toISOString(), ended_at: new Date(t - 2.9 * 3600_000).toISOString(), status: "ok", client_id: "otro", cost_usd: 0.2 },
      { agent_name: "jefe-marketing", command: "plan", started_at: new Date(t - 2 * 3600_000).toISOString(), ended_at: new Date(t - 1.9 * 3600_000).toISOString(), status: "ok", client_id: NAUFRAGO, cost_usd: 0.5 },
      { agent_name: "seo-specialist", command: null, started_at: new Date(t - 3 * 86400_000).toISOString(), ended_at: new Date(t - 3 * 86400_000 + 60_000).toISOString(), status: "ok", client_id: null, cost_usd: 0.01 },
      // una corrida «abierta» de hace 2 horas no es trabajo de ahora (quedó colgada)
      { agent_name: "media-buyer", command: "x", started_at: new Date(t - 2 * 3600_000).toISOString(), ended_at: null, status: "running", client_id: null, cost_usd: null },
    ]
    const cc = actividadDelAgente("content_creator", inv, { cliente: NAUFRAGO, ahora: AHORA })
    expect(cc.estado).toBe("trabajando"); expect(cc.para_este_cliente).toBe(true); expect(cc.trabajos_7d).toBe(2); expect(cc.para_el_cliente_7d).toBe(1); expect(cc.gasto_7d_usd).toBeCloseTo(0.3)
    expect(estadoDeAhoraLegible(cc)).toBe("Trabajando ahora · pieza")
    expect(actividadDelAgente("jefe-marketing", inv, { cliente: NAUFRAGO, ahora: AHORA }).estado).toBe("reciente")
    expect(actividadDelAgente("seo-specialist", inv, { ahora: AHORA }).estado).toBe("quieto")
    expect(estadoDeAhoraLegible(actividadDelAgente("seo-specialist", inv, { ahora: AHORA }))).toBe("Sin trabajo hoy")
    expect(estadoDeAhoraLegible(actividadDelAgente("nadie", inv, { ahora: AHORA }))).toBe("Sin trabajo en 7 días")
    expect(actividadDelAgente("media-buyer", inv, { ahora: AHORA }).estado).toBe("reciente")
    expect(MINUTOS_TRABAJANDO).toBe(20)
  })
  it("armar el equipo: instalados + directorio + corridas; el que trabaja sin ficha se lista igual; lo que nadie nombra va a «Otros»; el dato del directorio manda cuando existe", () => {
    const agentes: FilaDeAgente[] = [
      { name: "jefe-marketing", display_name: "Jefe de marketing", role: "x", model: "claude-opus", is_active: true, status: "active" },
      { name: "creative-director-mesa", display_name: "Director creativo", role: "x", model: "claude-sonnet", is_active: true, status: "active" },
      { name: "content-creator", display_name: null, role: "x", model: null, is_active: true, status: null },
      { name: "cfo_agent", display_name: "CFO", role: "x", model: null, is_active: true, status: null },
    ]
    const directorio: FilaDeDirectorio[] = [
      { agente: "creative-director-mesa", rol: "direccion", especialidad: "Dirige la mesa", sabe_hacer: ["a"], necesita: [], entrega: ["b"], pertinente_en: ["gran idea"], activo: true },
      { agente: "content-creator", rol: "miembro", especialidad: "Textos", sabe_hacer: [], necesita: [], entrega: [], pertinente_en: [], activo: true },
    ]
    const t = AHORA.getTime()
    const inv: Invocacion[] = [
      { agent_name: "portero-del-cerebro", command: "escucha", started_at: new Date(t - 60_000).toISOString(), ended_at: null, status: "running", client_id: NAUFRAGO, cost_usd: 0.01 },
      { agent_name: "content-creator", command: "pieza", started_at: new Date(t - 60_000).toISOString(), ended_at: null, status: "running", client_id: NAUFRAGO, cost_usd: 0.01 },
    ]
    const eq = armarEquipos(agentes, directorio, inv, { cliente: NAUFRAGO, ahora: AHORA })
    const creativo = eq.find((e) => e.clave === "creativo")!
    expect(creativo.miembros.map((m) => m.nombre)).toEqual(["creative-director-mesa", "content-creator"]) // el que dirige primero
    expect(creativo.trabajando).toBe(1); expect(creativo.origen).toBe("mapa")
    expect(creativo.areas.find((a) => a.clave === "gran-idea")!.miembros.map((m) => m.nombre)).toEqual(["creative-director-mesa", "content-creator"])
    expect(creativo.miembros[0].rol_en_sesion).toBe("Dirige la sesión"); expect(creativo.miembros[0].en_directorio).toBe(true)
    const direccion = eq.find((e) => e.clave === "direccion")!
    expect(direccion.miembros.map((m) => m.nombre)).toEqual(["jefe-marketing"]); expect(direccion.por_instalar_total).toBe(1)
    expect(eq.find((e) => e.clave === "estrategia")!.miembros.map((m) => m.nombre)).toEqual(["jefe-marketing"]) // también escribe el plan
    const prov = eq.find((e) => e.clave === "proveedores")!
    expect(prov.miembros.map((m) => [m.nombre, m.instalado])).toEqual([["portero-del-cerebro", false]]); expect(prov.trabajando).toBe(1)
    expect(eq.find((e) => e.clave === "otros")!.miembros.map((m) => m.nombre)).toEqual(["cfo_agent"])
    const r = resumenDelEquipo(eq)
    expect(r).toMatchObject({ equipos: 6, activos: 3, miembros: 3, miembros_activos: 3, trabajando: 1 })
    expect(r.por_instalar).toBeGreaterThan(5)
    // el directorio con equipo: manda el dato, aunque el mapa no lo nombre
    const conDato = armarEquipos(agentes, [...directorio, { agente: "cfo_agent", rol: "miembro", especialidad: null, sabe_hacer: [], necesita: [], entrega: [], pertinente_en: [], activo: true, equipo: "medios" }], inv, { cliente: NAUFRAGO, ahora: AHORA })
    expect(conDato.find((e) => e.clave === "medios")!.miembros.map((m) => m.nombre)).toEqual(["cfo_agent"]); expect(conDato[0].origen).toBe("directorio")
    expect(conDato.find((e) => e.clave === "otros")!.miembros).toEqual([])
  })
  it("el panel Equipo pinta el organigrama con los 6 equipos (los de segunda etapa atenuados) y sin selector de cliente", () => {
    const eq = armarEquipos([{ name: "jefe-marketing", display_name: "Jefe de marketing", role: null, model: null, is_active: true, status: null }], [], [], { cliente: NAUFRAGO, ahora: AHORA })
    const datos: EquipoDelCliente = { clientes: [CLIENTE], cliente: CLIENTE, equipos: eq, origen: "mapa", resumen: resumenDelEquipo(eq), ventana: { desde: "x", corridas: 0 }, leido_en: "x" }
    const html = renderToStaticMarkup(createElement(PanelEquipo, { onCerrar: () => {}, datosIniciales: datos }))
    expect(html).toContain('data-seccion="equipo"'); expect(html).toContain('data-vista="organigrama"')
    for (const k of EQUIPOS_DE_MARKETING) expect(html).toContain(`data-equipo="${k}"`)
    expect(html.match(/data-etapa="segunda_etapa"/g)!.length).toBeGreaterThanOrEqual(3)
    expect(html).toContain("Los 6 equipos del departamento"); expect(html).toContain("sale del mapa firmado")
    expect(html).not.toContain("<select"); expect(html).not.toContain('data-equipo="otros"') // vacío: no se pinta
    expect(html).toContain("nadie trabaja ahora")
  })
})

describe("6.10 · Brief de campaña (botón 4) · solo lectura, honesto cuando la cadena no lo publica", () => {
  it("lee la fila, parte el texto por encabezados, elige el vigente y traduce estados", () => {
    const b = briefDesdeFila({ id: "b1", version: 2, estado: "validada", texto_md: "## Insight\r\nLa gente vuelve por el desayuno.\n\n## Mensaje\nUn solo mensaje.\n", leido: { insight: "x" }, costo_usd: "0.12", seco: false, creada_en: "2026-11-01T10:00:00Z" })
    expect(b.version).toBe(2); expect(b.costo_usd).toBe(0.12); expect(b.leido).toEqual({ insight: "x" })
    expect(seccionesDelBrief(b.texto_md)).toEqual([{ titulo: "Insight", cuerpo: "La gente vuelve por el desayuno." }, { titulo: "Mensaje", cuerpo: "Un solo mensaje." }])
    expect(seccionesDelBrief("sin encabezados")).toEqual([{ titulo: "Brief", cuerpo: "sin encabezados" }]); expect(seccionesDelBrief(null)).toEqual([])
    const viejo = briefDesdeFila({ id: "b0", version: 1, estado: "devuelto", texto_md: "x" })
    const borrador = briefDesdeFila({ id: "b3", version: 3, estado: "borrador", texto_md: "y" })
    expect(briefVigente([viejo, borrador, b])!.id).toBe("b1") // el validado más nuevo gana al borrador posterior
    expect(briefVigente([viejo])!.id).toBe("b0")
    expect(estadoDelBriefLegible("devuelto")).toEqual({ texto: "Devuelto por la dirección creativa", tono: "rojo" })
    expect(estadoDelBriefLegible("validada").tono).toBe("verde")
    expect(detalleDelBrief({ publicado: false, campana: { id: "c" }, briefs: [] }).texto).toBe("La cadena aún no publica el brief (llega con T9)")
    expect(detalleDelBrief({ publicado: true, campana: null, briefs: [] }).texto).toBe("Sin campaña todavía")
    expect(detalleDelBrief({ publicado: true, campana: { id: "c" }, briefs: [] }).texto).toBe("La mesa del brief todavía no escribió")
    expect(detalleDelBrief({ publicado: true, campana: { id: "c" }, briefs: [viejo] })).toEqual({ texto: "Versión 1 · Devuelto por la dirección creativa", aviso: true })
    expect(esTablaInexistente("Could not find the table 'public.cadena_brief_creativo' in the schema cache")).toBe(true)
    expect(esTablaInexistente("permission denied for table x")).toBe(false)
  })
  it("el panel dice «la cadena todavía no publica el brief» sin inventar nada; con brief, lo pinta por secciones", () => {
    const sin = renderToStaticMarkup(createElement(PanelBrief, { onCerrar: () => {}, datosIniciales: { clientes: [CLIENTE], cliente: CLIENTE, campana: { id: "c", estado: "pausada" }, publicado: false, briefs: [], leido_en: "x" } }))
    expect(sin).toContain('data-vista="no-publicado"'); expect(sin).toContain("La cadena todavía no publica el brief"); expect(sin).not.toContain('data-vista="brief"')
    const con = renderToStaticMarkup(createElement(PanelBrief, { onCerrar: () => {}, datosIniciales: { clientes: [CLIENTE], cliente: CLIENTE, campana: { id: "c", estado: "activa" }, publicado: true, briefs: [briefDesdeFila({ id: "b1", version: 1, estado: "validada", texto_md: "## Insight\nAlgo real." })], leido_en: "x" } }))
    expect(con).toContain('data-vista="brief"'); expect(con).toContain('data-bloque="Insight"'); expect(con).toContain("Algo real."); expect(con).toContain(">Validado<")
  })
})

describe("6.10 · Gran idea (botón 5) · solo lectura hasta que la cadena publique la decisión", () => {
  it("las tarjetas salen de la bandeja (concepto_review) y la segunda línea avisa cuando espera a Emilio", () => {
    const t = tarjetaDesdeFila({ id: "h1", status: "pending", title: "Gran idea v1", created_at: "2026-11-01T10:00:00Z", decision: null, metadata: { version: 1 } })
    expect(t).toMatchObject({ hitl_id: "h1", estado: "pendiente", version: 1 })
    expect(tarjetaDesdeFila({ id: "h2", status: "rejected", decision: { accion: "pedir_cambios" } }).estado).toBe("con_cambios")
    expect(detalleDeGranIdea({ publicado: true, campana: { id: "c" }, tarjetas: [t] })).toEqual({ texto: "Espera tu decisión", aviso: true })
    expect(detalleDeGranIdea({ publicado: false, campana: { id: "c" }, tarjetas: [] }).texto).toBe("La sala creativa aún no abre (llega con T9)")
    expect(detalleDeGranIdea({ publicado: true, campana: null, tarjetas: [] }).texto).toBe("Sin campaña todavía")
    expect(detalleDeGranIdea({ publicado: true, campana: { id: "c" }, tarjetas: [] }).texto).toBe("La mesa de creativos todavía no sesionó")
  })
  it("el panel dice «la sala creativa aún no abre» cuando no hay tabla ni tarjetas, sin botones de decisión; la decisión (6.11) va SOLO por la ruta de CC#1, nunca directo a la plataforma", () => {
    const html = renderToStaticMarkup(createElement(PanelGranIdea, { onCerrar: () => {}, datosIniciales: { clientes: [CLIENTE], cliente: CLIENTE, campana: { id: "c", estado: "pausada" }, publicado: false, tarjetas: [], detalle: null, leido_en: "x" } }))
    expect(html).toContain('data-vista="no-publicado"'); expect(html).toContain("La sala creativa aún no abre")
    expect(html).not.toContain("data-accion=\"aprobar-gran-idea\"")
    const src = leer("components/nuevo/PanelGranIdea.tsx")
    expect(src).not.toContain("/api/cadena/concepto"); expect(src).toContain("rutaDeDecisionDeGranIdea(") // la ruta del tablero de CC#1 (PR #77), reutilizada tal cual
    expect(leer("lib/concepto-datos.ts")).toContain('export const TIPO_CONCEPTO = "concepto_review"') // el lector de CC#1 (PR #77) reutilizado tal cual
  })
})

describe("6.10 · nada del arnés local queda en lo publicable", () => {
  it("las puertas de las rutas nuevas son las reales", () => {
    for (const r of ["equipo", "brief", "gran-idea", "centro", "informes", "cerebro"]) expect(leer(`app/api/${r}/route.ts`)).not.toContain("ARNÉS LOCAL")
    expect(leer("middleware.ts")).not.toContain("ARNÉS LOCAL")
  })
})
