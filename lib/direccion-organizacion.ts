/**
 * ORGANIZACIÓN · el organigrama vivo de TODA la empresa (sprint 6.28-B · encargo 01-nov + «dale» de Emilio 2-nov a ChartHop como referencia).
 * Estructura copiada de ChartHop (solo la fachada es nuestra): árbol de arriba hacia abajo con tarjetas de persona, departamentos que se abren y cierran con su conteo,
 * equipos apilados, puestos por cubrir en línea punteada, buscador, filtros por estado, zoom y ficha lateral de cada persona.
 * FUENTES (SOLO LECTURA): `departments` (departamentos y si están activos o planeados) · `agents` (empleados instalados: departamento, rol, a quién reporta, activo) ·
 * `oficina_equipos` (los 6 equipos de marketing) · `oficina_directorio` (equipo, especialidad y lo que sabe hacer) · `agent_invocations` de 24 h (quién trabaja ahora) ·
 * el mapa firmado de `lib/organigrama.ts` SOLO para el equipo de marketing de quien no tiene tarjeta en el directorio (se marca «según el mapa firmado») y los puestos por cubrir.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { EQUIPOS, nombreCanonico, nombreLegibleDelAgente, equipoDelAgente, EQUIPOS_DE_MARKETING, actividadDelAgente, type Invocacion } from "@/lib/organigrama"

export type EstadoDePersona = "trabajando" | "activo" | "por_activar" | "apagado"
export interface Persona {
  id: string
  nombre: string
  puesto: string
  departamento: string
  equipo: string | null
  /** de dónde salió el equipo: la tarjeta del directorio o el mapa firmado */
  equipo_segun: "directorio" | "mapa" | null
  reporta_a: string | null
  estado: EstadoDePersona
  instalado: boolean
  especialidad: string | null
  sabe_hacer: string[]
  trabajos_24h: number
  ultima: string | null
  tarea: string | null
}
export interface EquipoDeOrg { clave: string; nombre: string; descripcion: string; etapa: "activo" | "segunda_etapa"; bloqueo: string | null; color: string; miembros: string[]; por_cubrir: string[] }
export interface Departamento { clave: string; nombre: string; descripcion: string; estado: "activo" | "planeado"; color: string; jefe: string | null; equipos: EquipoDeOrg[]; total: number }
export interface Organizacion {
  dueno: { nombre: string; puesto: string }
  gerente: string | null
  departamentos: Departamento[]
  personas: Record<string, Persona>
  resumen: { empleados: number; departamentos: number; trabajando: number; activos: number; por_activar: number; por_cubrir: number }
  notas: string[]
  leido_en: string
}

/** filas crudas de la base */
export interface FilaDepto { id: string; name: string; display_name: string | null; description: string | null; status: string | null }
export interface FilaAgente { id: string; name: string; display_name: string | null; role: string | null; department: string | null; department_id: string | null; reports_to: string | null; is_active: boolean | null; status: string | null }
export interface FilaEquipo { clave: string; nombre: string | null; descripcion: string | null; etapa: string | null; bloqueo: string | null; orden: number | null }
export interface FilaDirectorio { agente: string; equipo: string | null; especialidad: string | null; sabe_hacer: string[]; activo: boolean | null }

/** la base tiene «sales» (activo, con gente) y «ventas» (planeado, vacío): son el mismo departamento. «paid_media» trabaja dentro de Marketing (equipo Medios y Performance, mapa firmado 01-nov) */
const ALIAS_DE_DEPTO: Record<string, string> = { sales: "ventas", paid_media: "marketing" }
const NOMBRE_DE_DEPTO: Record<string, string> = { marketing: "Marketing", ventas: "Ventas", client_success: "Éxito del cliente", contabilidad: "Contabilidad", administracion: "Administración", transversal: "Servicios compartidos" }
const DESCRIPCION_DE_DEPTO: Record<string, string> = {
  marketing: "La primera oficina de la agencia: estrategia, creatividad, web, medios y relaciones",
  ventas: "Prospección, propuestas y cierre de clientes nuevos",
  client_success: "Alta, cuenta e informes de cada cliente",
  contabilidad: "Finanzas y planeación financiera de la agencia",
  administracion: "Administración de la agencia",
  transversal: "Le sirven a todos los departamentos: revisión, operaciones y datos",
}
const ORDEN_DE_DEPTO = ["marketing", "ventas", "client_success", "transversal", "contabilidad", "administracion"]
export const COLOR_DE_DEPTO: Record<string, string> = { marketing: "#e8731a", ventas: "#f5a524", client_success: "#ffb86b", transversal: "#c9a27a", contabilidad: "#9a7b5a", administracion: "#8c8c8c" }
const COLOR_DE_EQUIPO: Record<string, string> = Object.fromEntries(EQUIPOS.map((e) => [e.clave, e.color]))
const PUESTO: Record<string, string> = { gerente_general: "Gerente general", jefe_departamento: "Jefe de departamento", transversal: "Servicio compartido", empleado: "Especialista" }

export const SIN_EQUIPO = "sin_equipo"
const EQUIPO_UNICO = "todos"

export function armarOrganizacion(d: { deptos: FilaDepto[]; agentes: FilaAgente[]; equipos: FilaEquipo[]; directorio: FilaDirectorio[]; invocaciones: Invocacion[] }, o: { ahora: Date }): Organizacion {
  const notas: string[] = []
  const deptoPorId = new Map(d.deptos.map((x) => [x.id, x]))
  const claveDepto = (nombre: string) => ALIAS_DE_DEPTO[nombre] ?? nombre
  const dir = new Map(d.directorio.map((x) => [nombreCanonico(x.agente), x]))
  const equiposMk = [...d.equipos].sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99))
  const etapaDe = new Map(equiposMk.map((e) => [e.clave, e.etapa === "activo" ? "activo" : "segunda_etapa"] as const))
  const porId = new Map(d.agentes.map((a) => [a.id, a]))
  const gerenteFila = d.agentes.find((a) => a.role === "gerente_general") ?? null

  // departamento de cada empleado: el dato manda; sin dato, el mapa firmado de marketing; si tampoco, servicios compartidos
  const deptoDe = (a: FilaAgente): string => {
    const fila = a.department_id ? deptoPorId.get(a.department_id) : null
    if (fila) return claveDepto(fila.name)
    if (a.department) return claveDepto(a.department)
    if (equipoDelAgente(a.name) !== "otros" && EQUIPOS_DE_MARKETING.includes(equipoDelAgente(a.name))) return "marketing"
    return "transversal"
  }
  const estadoDelDepto = (clave: string): "activo" | "planeado" => {
    const filas = d.deptos.filter((x) => claveDepto(x.name) === clave)
    return filas.some((x) => x.status === "active") ? "activo" : filas.length ? "planeado" : "activo"
  }

  const personas: Record<string, Persona> = {}
  const alta = (id: string, nombre: string, puesto: string, departamento: string, extra: Partial<Persona> & { activo: boolean; instalado: boolean }) => {
    const act = actividadDelAgente(id, d.invocaciones, { ahora: o.ahora })
    const desde = o.ahora.getTime() - 24 * 3600_000
    const trabajos = d.invocaciones.filter((i) => nombreCanonico(i.agent_name) === nombreCanonico(id) && i.started_at && new Date(i.started_at).getTime() >= desde).length
    const dd = dir.get(nombreCanonico(id))
    personas[id] = {
      id, nombre, puesto, departamento, equipo: extra.equipo ?? null, equipo_segun: extra.equipo_segun ?? null, reporta_a: extra.reporta_a ?? null,
      estado: !extra.activo ? "apagado" : act.estado === "trabajando" ? "trabajando" : "activo", instalado: extra.instalado,
      especialidad: dd?.especialidad ?? null, sabe_hacer: dd?.sabe_hacer ?? [], trabajos_24h: trabajos, ultima: act.ultima, tarea: act.tarea,
    }
  }
  for (const a of d.agentes) {
    if (a === gerenteFila) continue
    const depto = deptoDe(a)
    alta(a.name, a.display_name || nombreLegibleDelAgente(a.name), PUESTO[a.role ?? ""] ?? "Especialista", depto, { activo: a.is_active !== false && a.status !== "inactive", instalado: true, reporta_a: a.reports_to ? porId.get(a.reports_to)?.name ?? null : null })
  }
  // tarjetas del directorio sin empleado instalado (p. ej. el portero del cerebro): se listan, sin inventarles más
  for (const x of d.directorio) {
    if (personas[x.agente] || [...Object.keys(personas)].some((k) => nombreCanonico(k) === nombreCanonico(x.agente))) continue
    alta(x.agente, nombreLegibleDelAgente(x.agente), "Especialista", x.equipo ? "marketing" : "transversal", { activo: x.activo !== false, instalado: false })
  }

  // jefe de cada departamento: el jefe de departamento que no le reporta a otro del mismo departamento
  const jefeDe = (clave: string): string | null => {
    const jefes = Object.values(personas).filter((p) => p.departamento === clave && p.puesto === "Jefe de departamento")
    return (jefes.find((p) => !p.reporta_a || personas[p.reporta_a]?.departamento !== clave) ?? jefes[0])?.id ?? null
  }

  // equipo de marketing: la tarjeta del directorio manda; si no tiene, el mapa firmado (y se marca)
  const claveEquipo = (s: string) => nombreCanonico(s).replace(/-/g, "_")
  const clavesMk = new Set(equiposMk.map((e) => e.clave))
  for (const p of Object.values(personas)) {
    if (p.departamento !== "marketing") continue
    const dd = dir.get(nombreCanonico(p.id))
    if (dd?.equipo && clavesMk.has(claveEquipo(dd.equipo))) { p.equipo = claveEquipo(dd.equipo); p.equipo_segun = "directorio" }
    else { const m = equipoDelAgente(p.id); if (clavesMk.has(m)) { p.equipo = m; p.equipo_segun = "mapa" } }
  }

  const gerenteId = gerenteFila?.name ?? null
  const departamentos: Departamento[] = []
  const claves = [...new Set([...ORDEN_DE_DEPTO.filter((c) => d.deptos.some((x) => claveDepto(x.name) === c) || Object.values(personas).some((p) => p.departamento === c)), ...Object.values(personas).map((p) => p.departamento)])]
  for (const clave of claves) {
    const estado = estadoDelDepto(clave)
    const jefe = jefeDe(clave)
    const gente = Object.values(personas).filter((p) => p.departamento === clave)
    for (const p of gente) {
      if (estado === "planeado" && p.estado === "activo") p.estado = "por_activar"
      if (!p.reporta_a) p.reporta_a = p.id === jefe ? gerenteId : jefe ?? gerenteId
    }
    const fila = d.deptos.find((x) => x.name === clave)
    const nombre = NOMBRE_DE_DEPTO[clave] ?? fila?.display_name ?? nombreLegibleDelAgente(clave)
    let equipos: EquipoDeOrg[]
    if (clave === "marketing") {
      // «X/Twitter Intelligence Analyst» y `x-twitter-intelligence-analyst` son el mismo: se comparan solo letras y números
      const solo = (x: string) => nombreCanonico(x).replace(/[^a-z0-9]/g, "")
      const instalados = new Set(Object.keys(personas).map(solo))
      equipos = equiposMk.map((e) => {
        const mapa = EQUIPOS.find((m) => m.clave === e.clave)
        const miembros = gente.filter((p) => p.equipo === e.clave && p.id !== jefe).map((p) => p.id)
        for (const id of miembros) if (etapaDe.get(e.clave) === "segunda_etapa" && personas[id].estado === "activo") personas[id].estado = "por_activar"
        const por_cubrir = [...new Set((mapa?.areas ?? []).flatMap((a) => a.por_instalar))].filter((n) => !instalados.has(solo(n)))
        return { clave: e.clave, nombre: e.nombre || e.clave, descripcion: e.descripcion ?? mapa?.descripcion ?? "", etapa: etapaDe.get(e.clave) ?? "activo", bloqueo: e.bloqueo, color: COLOR_DE_EQUIPO[e.clave] ?? "#8a8a8a", miembros: ordenar(miembros, personas), por_cubrir }
      })
      const sueltos = gente.filter((p) => !p.equipo && p.id !== jefe).map((p) => p.id)
      if (sueltos.length) equipos.push({ clave: SIN_EQUIPO, nombre: "Sin equipo asignado", descripcion: "Empleados de marketing que ni el directorio ni el mapa firmado ponen en un equipo", etapa: "activo", bloqueo: null, color: "#6f6f6f", miembros: ordenar(sueltos, personas), por_cubrir: [] })
      const segunMapa = gente.filter((p) => p.equipo_segun === "mapa").length
      if (segunMapa) notas.push(`${segunMapa} empleados de marketing no tienen tarjeta en el directorio: su equipo sale del mapa firmado del 01-nov`)
    } else {
      const miembros = gente.filter((p) => p.id !== jefe).map((p) => p.id)
      equipos = miembros.length ? [{ clave: EQUIPO_UNICO, nombre: "Equipo", descripcion: "", etapa: estado === "activo" ? "activo" : "segunda_etapa", bloqueo: null, color: COLOR_DE_DEPTO[clave] ?? "#8a8a8a", miembros: ordenar(miembros, personas), por_cubrir: [] }] : []
    }
    departamentos.push({ clave, nombre, descripcion: DESCRIPCION_DE_DEPTO[clave] ?? fila?.description ?? "", estado, color: COLOR_DE_DEPTO[clave] ?? "#8a8a8a", jefe, equipos, total: gente.length })
  }
  if (d.deptos.some((x) => x.name === "sales") && d.deptos.some((x) => x.name === "ventas")) notas.push("En la base, Ventas figura dos veces («sales» con la gente y «ventas» planeado): aquí se muestran juntos")
  if (d.deptos.some((x) => x.name === "paid_media")) notas.push("En la base, Pauta figura como departamento aparte; según el mapa firmado trabaja dentro de Marketing (Medios y Performance)")

  if (gerenteFila) {
    const act = actividadDelAgente(gerenteFila.name, d.invocaciones, { ahora: o.ahora })
    personas[gerenteFila.name] = { id: gerenteFila.name, nombre: gerenteFila.display_name || "Gerente general", puesto: "Dirige la agencia", departamento: "direccion_general", equipo: null, equipo_segun: null, reporta_a: null, estado: gerenteFila.is_active === false ? "apagado" : act.estado === "trabajando" ? "trabajando" : "activo", instalado: true, especialidad: null, sabe_hacer: [], trabajos_24h: d.invocaciones.filter((i) => nombreCanonico(i.agent_name) === nombreCanonico(gerenteFila.name)).length, ultima: act.ultima, tarea: act.tarea }
  }
  const lista = Object.values(personas)
  return {
    dueno: { nombre: "Emilio Pérez", puesto: "Dueño · administrador" },
    gerente: gerenteId,
    departamentos,
    personas,
    resumen: {
      empleados: lista.length, departamentos: departamentos.length,
      trabajando: lista.filter((p) => p.estado === "trabajando").length, activos: lista.filter((p) => p.estado === "activo" || p.estado === "trabajando").length,
      por_activar: lista.filter((p) => p.estado === "por_activar").length, por_cubrir: departamentos.reduce((n, x) => n + x.equipos.reduce((m, e) => m + e.por_cubrir.length, 0), 0),
    },
    notas,
    leido_en: o.ahora.toISOString(),
  }
}

const PESO: Record<EstadoDePersona, number> = { trabajando: 0, activo: 1, por_activar: 2, apagado: 3 }
const ordenar = (ids: string[], p: Record<string, Persona>) => [...ids].sort((a, b) => PESO[p[a].estado] - PESO[p[b].estado] || (p[a].puesto === "Jefe de departamento" ? -1 : 0) - (p[b].puesto === "Jefe de departamento" ? -1 : 0) || p[a].nombre.localeCompare(p[b].nombre, "es"))

/** quiénes le reportan directamente a alguien */
export const aSuCargo = (org: Organizacion, id: string): string[] => Object.values(org.personas).filter((p) => p.reporta_a === id).map((p) => p.id)

/** búsqueda sin tildes ni mayúsculas, por nombre, puesto, equipo o especialidad */
const plano = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
export function coincide(p: Persona, q: string, org: Organizacion): boolean {
  const t = plano(q.trim()); if (!t) return true
  const eq = p.equipo ? org.departamentos.flatMap((x) => x.equipos).find((e) => e.clave === p.equipo)?.nombre ?? "" : ""
  return plano([p.nombre, p.id, p.puesto, eq, p.especialidad ?? ""].join(" ")).includes(t)
}

export const NOMBRE_DEL_ESTADO: Record<EstadoDePersona, string> = { trabajando: "Trabajando ahora", activo: "Activo", por_activar: "Por activar", apagado: "Apagado" }

/** ─── lectura (servidor, SOLO LECTURA) ─── */
type Fila = Record<string, unknown>
type R = PromiseLike<{ data: unknown; error: { message: string } | null }>
async function filas(q: R, que: string): Promise<Fila[]> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? []) as Fila[] }
const txt = (v: unknown) => (v == null || v === "" ? null : String(v))
const lst = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])

export async function leerOrganizacion(db: SupabaseClient, o: { ahora?: Date } = {}): Promise<Organizacion> {
  const ahora = o.ahora ?? new Date()
  const desde = new Date(ahora.getTime() - 24 * 3600_000).toISOString()
  const [deptos, agentes, equipos, directorio, inv] = await Promise.all([
    filas(db.from("departments").select("id, name, display_name, description, status").limit(100), "departments"),
    filas(db.from("agents").select("id, name, display_name, role, department, department_id, reports_to, is_active, status").limit(500), "agents"),
    filas(db.from("oficina_equipos").select("clave, nombre, descripcion, etapa, bloqueo, orden").limit(50), "oficina_equipos"),
    filas(db.from("oficina_directorio").select("agente, equipo, especialidad, sabe_hacer, activo").limit(500), "oficina_directorio"),
    filas(db.from("agent_invocations").select("agent_name, command, started_at, ended_at, status, client_id, cost_usd").gte("created_at", desde).limit(5000), "agent_invocations"),
  ])
  return armarOrganizacion({
    deptos: deptos.map((x) => ({ id: String(x.id), name: String(x.name), display_name: txt(x.display_name), description: txt(x.description), status: txt(x.status) })),
    agentes: agentes.map((x) => ({ id: String(x.id), name: String(x.name), display_name: txt(x.display_name), role: txt(x.role), department: txt(x.department), department_id: txt(x.department_id), reports_to: txt(x.reports_to), is_active: typeof x.is_active === "boolean" ? x.is_active : null, status: txt(x.status) })),
    equipos: equipos.map((x) => ({ clave: String(x.clave), nombre: txt(x.nombre), descripcion: txt(x.descripcion), etapa: txt(x.etapa), bloqueo: txt(x.bloqueo), orden: x.orden == null ? null : Number(x.orden) })),
    directorio: directorio.map((x) => ({ agente: String(x.agente), equipo: txt(x.equipo), especialidad: txt(x.especialidad), sabe_hacer: lst(x.sabe_hacer), activo: typeof x.activo === "boolean" ? x.activo : null })),
    invocaciones: inv.map((x) => ({ agent_name: String(x.agent_name ?? ""), command: txt(x.command), started_at: txt(x.started_at), ended_at: txt(x.ended_at), status: txt(x.status), client_id: txt(x.client_id), cost_usd: null })),
  }, { ahora })
}
