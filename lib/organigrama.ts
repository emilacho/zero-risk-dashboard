/**
 * EL ORGANIGRAMA DEL DEPARTAMENTO DE MARKETING · 6 EQUIPOS (sprint 6.10 · encargo 01-nov ADENDA 6 + MAPA «ESTRUCTURA FINAL: 6 EQUIPOS», firma de Emilio 01-nov 00:11Z).
 * Canon de Emilio (31-oct): «se estructura COMO UNA EMPRESA REAL… cada agente queda asignado a SU equipo con ese nombre (y así se verá en el dashboard /nuevo)».
 * Equipos: Dirección · Estrategia (incluye la investigación = mesa de análisis antes del plan) · Creativo (gran idea + piezas y video) → ACTIVOS ·
 *          Web y búsqueda · Medios y Performance · Relaciones → SEGUNDA ETAPA (presentes, atenuados; encenderlos es un dato). Las mesas de trabajo (brief, concepto, pieza)
 *          son SESIONES en la sala de reuniones compartida, no equipos.
 * FUENTE: `raw/tasks/2026-11-01-MAPA-LENOVO-departamento-de-marketing-completo-por-etapas.md` (sección final) + FIRMAS 31-oct/01-nov. HOY `oficina_directorio` NO tiene
 * columna de equipo (sonda 1-nov): mientras no exista, el equipo sale de aquí («según el mapa firmado») y el directorio aporta rol, especialidad y pertinencia; cuando la
 * plataforma la agregue (nota para CC1 en el MAPA), el dato manda y esta tabla queda de respaldo. Lo firmado y no instalado se muestra «por instalar», nunca como presente.
 */
export type ClaveDeEquipo = "direccion" | "estrategia" | "creativo" | "web" | "medios" | "relaciones" | "proveedores" | "otros"
export type EtapaDeEquipo = "activo" | "segunda_etapa" | "fuera"

export interface Area {
  clave: string
  /** nombre de agencia real */
  nombre: string
  /** nombre del sistema (código, directorio, firmas) */
  sistema: string | null
  /** cuándo trabaja esta área en la cadena */
  momento: string | null
  agentes: string[]
  por_instalar: string[]
  nota: string | null
}
export interface Equipo {
  clave: ClaveDeEquipo
  nombre: string
  sistema: string
  descripcion: string
  etapa: EtapaDeEquipo
  /** por qué todavía no se enciende (segunda etapa) */
  bloqueo: string | null
  /** el color del equipo (avatares y rótulos): tonos de la escena, oscura con luz naranja */
  color: string
  areas: Area[]
  fuente: string
}

const area = (clave: string, nombre: string, sistema: string | null, momento: string | null, agentes: string[], por_instalar: string[] = [], nota: string | null = null): Area => ({ clave, nombre, sistema, momento, agentes, por_instalar, nota })

export const EQUIPOS: Equipo[] = [
  { clave: "direccion", nombre: "Dirección", sistema: "jefatura de marketing", descripcion: "Dirige el departamento: revisa, corrige y juzga lo que sale de los equipos; aprueba, devuelve y marca promesas", etapa: "activo", bloqueo: null, color: "#f5a524",
    areas: [
      area("jefatura", "Jefatura", "jefatura de marketing", "en toda la cadena", ["jefe-marketing", "spell-check-corrector", "revisor-externo-gpt"], ["Legal Compliance Checker"], "GPT opina, no vota (satélite)"),
      area("revisores", "Revisores de la jefatura", "jefatura · 3 jefes (ADR-020)", "al revisar piezas y plan", ["editor_en_jefe", "brand_strategist", "jefe_client_success"], [], "no figuran en el MAPA 01-nov; se listan por ADR-020 §16 (3 jefes Sonnet) · confirmar con Lenovo"),
    ], fuente: "MAPA 01-nov · ESTRUCTURA FINAL 1 · ADR-020 §16" },
  { clave: "estrategia", nombre: "Estrategia", sistema: "mesa de análisis + plan · brief · calendario", descripcion: "Investiga antes del plan y escribe el plan de 90 días, el brief creativo y el calendario", etapa: "activo", bloqueo: null, color: "#e8731a",
    areas: [
      area("investigacion", "Investigación", "mesa de análisis", "antes del plan", ["market_research_analyst", "competitive-intelligence-agent", "growth-hacker"], ["Feedback Synthesizer", "X/Twitter Intelligence Analyst"], "sus informes van al cerebro (clase informe_de_analisis) y el portero los adjunta a todo pedido"),
      area("plan", "Plan de 90 días", "jefe-marketing escribe", "al abrir la campaña", ["jefe-marketing"]),
      area("brief", "Brief de campaña", "mesa de brief", "después del plan", ["campaign-brief-agent"], [], "la mesa del brief es una sesión en la sala de reuniones"),
      area("calendario", "Calendario", "estrategia y calendario", "con la gran idea aprobada", ["social-media-strategist"]),
    ], fuente: "MAPA 01-nov · ESTRUCTURA FINAL 2 · FIRMAS 3 y 5 (31-oct) · FIRMA 01-nov §6" },
  { clave: "creativo", nombre: "Creativo", sistema: "mesa de creativos + mesa de piezas y video", descripcion: "La gran idea de la campaña y cada pieza del calendario: texto, láminas, fotos, imágenes y video", etapa: "activo", bloqueo: null, color: "#ffb86b",
    areas: [
      area("gran-idea", "Gran idea", "mesa de creativos", "una vez por campaña, con el brief", ["creative-director-mesa", "content-creator", "design-visual-storyteller", "marketing_instagram_curator", "video-editor"], ["Whimsy Injector", "TikTok Strategist"], "sesión en la sala de reuniones; la dirige creative-director-mesa"),
      area("piezas", "Piezas y video", "mesa de piezas", "por cada fila del calendario", ["creative-director-mesa", "content-creator", "carousel-designer", "design-image-prompt-engineer", "design-visual-storyteller", "marketing_instagram_curator", "marketing_short_video_editing_coach", "marketing_video_optimization_specialist", "video-editor"], ["Inclusive Visuals Specialist", "Whimsy Injector"], "video largo de YouTube = familia propia (FIRMA 01-nov §4)"),
    ], fuente: "MAPA 01-nov · ESTRUCTURA FINAL 3 · oficina_directorio · FIRMA 01-nov §2-5" },
  { clave: "web", nombre: "Web y búsqueda", sistema: "landings · CRO · SEO · GEO/AEO", descripcion: "Que la web del cliente convierta y que lo encuentren en buscadores y en las respuestas de las IA", etapa: "segunda_etapa", bloqueo: "se activa con firma; los revisores de landing trabajan ya cuando hay landing", color: "#9a7b5a",
    areas: [
      area("landings", "Landings y CRO", "landings y CRO", "cuando hay landing", ["web_designer", "creative-director", "style-consistency-reviewer", "delivery-coordinator", "editor_en_jefe", "cro-specialist"], [], "cro-specialist tiene la identidad equivocada (App Store): a arreglar (estudio CC3 tras T9)"),
      area("revisores-landing", "Revisores de landing", "mesa de análisis · landing lista", "antes de que la landing llegue a Emilio", [], ["Persona Walkthrough Specialist", "Accessibility Auditor"], "trabajan ya cuando hay landing (FIRMA 01-nov)"),
      area("seo", "SEO", "SEO", "campañas de búsqueda", ["seo-specialist", "seo-content-strategist", "seo-backlink-strategist", "seo-technical", "seo-orchestrator"]),
      area("geo", "GEO / AEO (visibilidad en IA)", "GEO/AEO", "campañas de visibilidad en ChatGPT, Claude, Gemini, Perplexity", ["seo-geo-optimization", "marketing_ai_citation_strategist"], [], "evaluar AEO Foundations Architect y Agentic Search Optimizer (estudio CC3)"),
    ], fuente: "MAPA 01-nov · ESTRUCTURA FINAL 4" },
  { clave: "medios", nombre: "Medios y Performance", sistema: "pauta · email · medición y optimización", descripcion: "Anuncios pagados, correos a la base propia y la medición de lo publicado", etapa: "segunda_etapa", bloqueo: "espera las métricas de Meta", color: "#8c8c8c",
    areas: [
      area("pauta", "Pauta", "mesa de pauta", "campañas de pauta", ["media-buyer", "paid_media_auditor", "paid_media_creative_strategist", "paid_media_paid_social_strategist", "paid_media_ppc_strategist", "paid_media_programmatic_buyer", "paid_media_search_query_analyst"]),
      area("email", "Email", "mesa de email", "campañas de email", ["email-marketer"]),
      area("medicion", "Medición y optimización", "performance", "después de publicar", ["optimization-agent", "reporting_agent", "tracking-specialist", "growth-hacker"], ["Experiment Tracker"], "Experiment Tracker en backlog"),
    ], fuente: "MAPA 01-nov · ESTRUCTURA FINAL 5" },
  { clave: "relaciones", nombre: "Relaciones", sistema: "comunidad · reputación · PR · influencers", descripcion: "La conversación con la gente: reseñas, comunidad, prensa ganada y creadores", etapa: "segunda_etapa", bloqueo: "se activa con firma", color: "#a08cff",
    areas: [
      area("comunidad", "Comunidad y reputación", "mesa de comunidad y reputación", "campañas de comunidad", ["community_manager", "review-responder", "marketing_twitter_engager"], ["Reddit Community Builder"], "Reddit Community Builder en backlog prioritario (FIRMA 5)"),
      area("pr", "Prensa ganada", "PR", "campañas de PR", ["pr-earned-media-manager"]),
      area("influencers", "Influencers", "mesa de influencers", "campañas con creadores", ["influencer-manager"]),
    ], fuente: "MAPA 01-nov · ESTRUCTURA FINAL 6" },
  { clave: "proveedores", nombre: "Proveedores del departamento", sistema: "cerebro/portero · brazo de video", descripcion: "No son del departamento pero le sirven: la escucha y la biblioteca (cerebro) y la producción audiovisual", etapa: "fuera", bloqueo: null, color: "#6f6f6f",
    areas: [
      area("escucha", "Escucha y Biblioteca", "cerebro · portero", "siempre", ["portero-del-cerebro", "etiquetador-del-cerebro", "desmenuzador-del-dueno", "portero"], [], "la antena y el librero de la oficina"),
      area("video", "Producción audiovisual", "brazo de video", "cuando una pieza pide video", ["video-generation", "image-generation"], [], "la cámara de la oficina · saldo de Higgsfield sin ruta (faltante)"),
    ], fuente: "MAPA 01-nov (proveedores fuera del depto)" },
  { clave: "otros", nombre: "Otros departamentos", sistema: "finanzas · ventas · RRHH · IT · alta de clientes", descripcion: "Lo que no es marketing: alta de clientes, finanzas, ventas y dirección de la agencia", etapa: "fuera", bloqueo: null, color: "#555555",
    areas: [area("otros", "Sin equipo de marketing", null, null, [], [], "agentes instalados que el MAPA no asigna a ningún equipo de marketing")], fuente: "MAPA 01-nov" },
]

/** `editor-en-jefe` y `editor_en_jefe` son el mismo empleado: en `agents` va con guion bajo y en `agent_invocations` con guion */
export const nombreCanonico = (s: unknown): string => String(s ?? "").trim().toLowerCase().replace(/[_\s]+/g, "-")

const INDICE: Map<string, Array<{ equipo: ClaveDeEquipo; area: string }>> = (() => {
  const m = new Map<string, Array<{ equipo: ClaveDeEquipo; area: string }>>()
  for (const e of EQUIPOS) for (const a of e.areas) for (const n of a.agentes) { const k = nombreCanonico(n); m.set(k, [...(m.get(k) ?? []), { equipo: e.clave, area: a.clave }]) }
  return m
})()
/** los firmados «por instalar», por su nombre canónico: cuando se instalan, caen en su equipo y no en «otros» */
const FIRMADOS: Map<string, Array<{ equipo: ClaveDeEquipo; area: string }>> = (() => {
  const m = new Map<string, Array<{ equipo: ClaveDeEquipo; area: string }>>()
  for (const e of EQUIPOS) for (const a of e.areas) for (const n of a.por_instalar) { const k = nombreCanonico(n); m.set(k, [...(m.get(k) ?? []), { equipo: e.clave, area: a.clave }]) }
  return m
})()
/** todos los puestos de un agente (jefe-marketing está en Dirección y en Estrategia); vacío si el mapa no lo asigna */
export const puestosDelAgente = (nombre: unknown) => INDICE.get(nombreCanonico(nombre)) ?? FIRMADOS.get(nombreCanonico(nombre)) ?? []
export const equiposDelAgente = (nombre: unknown): ClaveDeEquipo[] => [...new Set(puestosDelAgente(nombre).map((p) => p.equipo))]
/** el equipo principal (el primero del mapa) · «otros» si no está asignado */
export const equipoDelAgente = (nombre: unknown): ClaveDeEquipo => equiposDelAgente(nombre)[0] ?? "otros"
export const equipoPorClave = (k: ClaveDeEquipo): Equipo => EQUIPOS.find((e) => e.clave === k)!
export const EQUIPOS_DE_MARKETING: ClaveDeEquipo[] = ["direccion", "estrategia", "creativo", "web", "medios", "relaciones"]

export function etapaLegible(e: EtapaDeEquipo): string {
  return e === "activo" ? "Activo" : e === "segunda_etapa" ? "Segunda etapa · por activar" : "Fuera del departamento"
}
export function rolLegible(rol: unknown): string {
  switch (String(rol ?? "")) {
    case "direccion": return "Dirige la sesión"
    case "miembro": return "Miembro"
    case "portero": return "Portero"
    case "": return ""
    default: return String(rol)
  }
}

/** ─── lo que el equipo está haciendo: de `agent_invocations` a un estado legible por agente ─── */
export interface Invocacion { agent_name: string; command: string | null; started_at: string | null; ended_at: string | null; status: string | null; client_id: string | null; cost_usd: number | null }
export type EstadoDeAhora = "trabajando" | "reciente" | "quieto"
export interface Actividad { estado: EstadoDeAhora; ultima: string | null; tarea: string | null; para_este_cliente: boolean; trabajos_7d: number; para_el_cliente_7d: number; gasto_7d_usd: number }

/** «trabajando» = una corrida abierta (sin fin) empezada hace menos de 20 min · «reciente» = algo en las últimas 24 h · si no, «quieto» */
export const MINUTOS_TRABAJANDO = 20
export function actividadDelAgente(nombre: string, invocaciones: Invocacion[], o: { cliente?: string | null; ahora: Date }): Actividad {
  const k = nombreCanonico(nombre)
  const mias = invocaciones.filter((i) => nombreCanonico(i.agent_name) === k)
  const t = o.ahora.getTime()
  const abierta = mias.find((i) => !i.ended_at && i.started_at && t - new Date(i.started_at).getTime() < MINUTOS_TRABAJANDO * 60_000)
  const ultima = mias.map((i) => i.ended_at ?? i.started_at).filter((x): x is string => !!x).sort().at(-1) ?? null
  const ref = abierta ?? (ultima ? mias.find((i) => (i.ended_at ?? i.started_at) === ultima) ?? null : null)
  const estado: EstadoDeAhora = abierta ? "trabajando" : ultima && t - new Date(ultima).getTime() < 24 * 3600_000 ? "reciente" : "quieto"
  return {
    estado, ultima, tarea: ref?.command ?? null, para_este_cliente: !!(ref && o.cliente && ref.client_id === o.cliente),
    trabajos_7d: mias.length, para_el_cliente_7d: o.cliente ? mias.filter((i) => i.client_id === o.cliente).length : 0,
    gasto_7d_usd: Math.round(mias.reduce((s, i) => s + (i.cost_usd ?? 0), 0) * 10000) / 10000,
  }
}
export function estadoDeAhoraLegible(a: Actividad): string {
  if (a.estado === "trabajando") return a.tarea ? `Trabajando ahora · ${a.tarea}` : "Trabajando ahora"
  if (a.estado === "reciente") return a.tarea ? `Trabajó hoy · ${a.tarea}` : "Trabajó hoy"
  return a.ultima ? "Sin trabajo hoy" : "Sin trabajo en 7 días"
}

/** ─── armar el equipo: agentes instalados + directorio + actividad → equipos con áreas y miembros ─── */
export interface FilaDeAgente { name: string; display_name: string | null; role: string | null; model: string | null; is_active: boolean | null; status: string | null }
export interface FilaDeDirectorio { agente: string; rol: string | null; especialidad: string | null; sabe_hacer: string[]; necesita: string[]; entrega: string[]; pertinente_en: string[]; activo: boolean | null; equipo?: string | null; mesa?: string | null }
export interface Miembro {
  nombre: string
  nombre_visible: string
  modelo: string | null
  activo: boolean
  /** tiene fila en `agents` (instalado) · los que solo aparecen trabajando (p. ej. portero-del-cerebro) se listan igual */
  instalado: boolean
  /** tiene fila en el directorio de la oficina (sabe qué hace en las sesiones) */
  en_directorio: boolean
  rol_en_sesion: string
  especialidad: string | null
  sabe_hacer: string[]
  necesita: string[]
  entrega: string[]
  pertinente_en: string[]
  equipos: ClaveDeEquipo[]
  actividad: Actividad
}
export interface AreaArmada extends Area { miembros: Miembro[] }
export interface EquipoArmado extends Equipo {
  areas: AreaArmada[]
  /** miembros únicos del equipo */
  miembros: Miembro[]
  trabajando: number
  por_instalar_total: number
  /** el equipo viene del dato (`oficina_directorio.equipo`) o del mapa firmado */
  origen: "directorio" | "mapa"
}

export function armarEquipos(agentes: FilaDeAgente[], directorio: FilaDeDirectorio[], invocaciones: Invocacion[], o: { cliente?: string | null; ahora: Date }): EquipoArmado[] {
  const dir = new Map(directorio.map((d) => [nombreCanonico(d.agente), d]))
  const miembro = (a: FilaDeAgente, instalado: boolean): Miembro => {
    const d = dir.get(nombreCanonico(a.name))
    return {
      nombre: a.name, nombre_visible: a.display_name || a.name, modelo: a.model, activo: a.is_active !== false && a.status !== "inactive", instalado, en_directorio: !!d,
      rol_en_sesion: rolLegible(d?.rol), especialidad: d?.especialidad ?? null, sabe_hacer: d?.sabe_hacer ?? [], necesita: d?.necesita ?? [], entrega: d?.entrega ?? [], pertinente_en: d?.pertinente_en ?? [],
      equipos: equiposDelAgente(a.name), actividad: actividadDelAgente(a.name, invocaciones, o),
    }
  }
  const instalados = new Set(agentes.map((a) => nombreCanonico(a.name)))
  // los que trabajan (hay corridas) pero no tienen fila en `agents` (p. ej. portero-del-cerebro, video-generation): se listan igual, con lo que se sabe
  const fantasmas: FilaDeAgente[] = [...new Set(invocaciones.map((i) => i.agent_name))].filter((n) => n && !instalados.has(nombreCanonico(n)) && puestosDelAgente(n).length).map((n) => ({ name: n, display_name: null, role: null, model: null, is_active: true, status: null }))
  const todos = [...agentes.map((a) => miembro(a, true)), ...fantasmas.map((a) => miembro(a, false))]
  const porNombre = new Map(todos.map((m) => [nombreCanonico(m.nombre), m]))
  const conEquipoDelDato = directorio.some((d) => d.equipo)
  const asignados = new Set<string>()
  const equipos = EQUIPOS.map((e): EquipoArmado => {
    const areas: AreaArmada[] = e.areas.map((a) => {
      // lo firmado «por instalar» pasa solo a instalado en cuanto exista su fila en `agents` («Whimsy Injector» → `whimsy-injector`)
      const instaladosDeLosFirmados = a.por_instalar.filter((n) => porNombre.has(nombreCanonico(n)))
      const por_instalar = a.por_instalar.filter((n) => !porNombre.has(nombreCanonico(n)))
      const miembros = [...a.agentes, ...instaladosDeLosFirmados].map((n) => porNombre.get(nombreCanonico(n))).filter((m): m is Miembro => !!m)
      // el dato manda cuando existe: un agente cuyo directorio lo pone en este equipo entra aunque el mapa no lo nombre
      for (const m of todos) { const d = dir.get(nombreCanonico(m.nombre)); if (d?.equipo && nombreCanonico(d.equipo) === e.clave && !miembros.includes(m) && a === e.areas[0]) miembros.push(m) }
      for (const m of miembros) asignados.add(nombreCanonico(m.nombre))
      return { ...a, por_instalar, miembros: ordenar(miembros) }
    })
    const miembros = ordenar([...new Map(areas.flatMap((a) => a.miembros).map((m) => [m.nombre, m])).values()])
    return { ...e, areas, miembros, trabajando: miembros.filter((m) => m.actividad.estado === "trabajando").length, por_instalar_total: new Set(areas.flatMap((a) => a.por_instalar)).size, origen: conEquipoDelDato ? "directorio" : "mapa" }
  })
  // «otros»: todo lo instalado que ningún equipo del mapa nombra
  const otros = equipos.find((e) => e.clave === "otros")!
  const sueltos = ordenar(todos.filter((m) => !asignados.has(nombreCanonico(m.nombre))))
  otros.areas[0] = { ...otros.areas[0], miembros: sueltos }; otros.miembros = sueltos; otros.trabajando = sueltos.filter((m) => m.actividad.estado === "trabajando").length
  return equipos
}
const ordenar = (xs: Miembro[]) => [...xs].sort((a, b) => (a.rol_en_sesion === "Dirige la sesión" ? -1 : b.rol_en_sesion === "Dirige la sesión" ? 1 : 0) || (a.actividad.estado === "trabajando" ? -1 : b.actividad.estado === "trabajando" ? 1 : 0) || a.nombre_visible.localeCompare(b.nombre_visible, "es"))

export const resumenDelEquipo = (equipos: EquipoArmado[]) => {
  const mk = equipos.filter((e) => EQUIPOS_DE_MARKETING.includes(e.clave))
  const activos = mk.filter((e) => e.etapa === "activo")
  const u = (xs: EquipoArmado[]) => new Set(xs.flatMap((e) => e.miembros.map((m) => m.nombre))).size
  return { equipos: mk.length, activos: activos.length, miembros: u(mk), miembros_activos: u(activos), trabajando: new Set(mk.flatMap((e) => e.miembros.filter((m) => m.actividad.estado === "trabajando").map((m) => m.nombre))).size, por_instalar: mk.reduce((n, e) => n + e.por_instalar_total, 0) }
}
