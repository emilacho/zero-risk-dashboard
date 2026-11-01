/**
 * LA ESCENA VIVA · AVATARES (CC6 · Sprint 1 · 01-nov · encargo `2026-11-01-CONTEXTO-LENOVO-a-CC6-escena-viva-avatares-y-observabilidad.md` + respuesta de Emilio
 * `2026-11-01-RESPUESTA-LENOVO-a-CC6-boceto-v2.md`): sobre la foto de la oficina de marketing, en la silla de la mesa de su equipo, se SIENTA SOLO el empleado que está
 * trabajando AHORA (uno o varios); el resto del equipo se ve al tocar la mesa. Mesa sin nadie trabajando = vacía y quieta. Nada se inventa: ni avatares de relleno ni estados.
 *
 * Fuentes (sonda 01-nov 11:35Z y 12:40Z, solo lectura):
 * - «trabajando ahora» = `agent_dispatches.status = 'running'` con `running_at` hace menos de MINUTOS_TOPE y SIN una invocación terminada posterior del mismo agente para la misma
 *   corrida (`workflow_execution_id` igual o con sufijo «:paso»). `agent_invocations` se escribe AL TERMINAR (0 filas con `ended_at` vacío en todo el histórico), así que el
 *   «ahora» no puede salir de ahí. Un despacho puede quedar `running` para siempre (vueltas de más de 13 min no regresan): pasado el tope ya no se sienta y se dice «sin fin registrado».
 * - «falló» = despacho en `error` o invocación con estado de error/fallo en los últimos MINUTOS_FALLO: la figura se queda sentada con el monitor en rojo ese rato y luego se levanta.
 * - «qué hizo · cuánto costó» = `agent_invocations` (`cost_usd` llega al terminar · `metadata.task_text` · `metadata.step_name`).
 * - la mesa de cada uno = `oficina_directorio.equipo` (el dato); si no tiene tarjeta, el mapa firmado de `lib/organigrama.ts` (rotulado «según el mapa»); si tampoco, «sin mesa».
 * Todo aquí es puro (sin red, sin reloj propio: `ahora` se pasa) y está probado con vitest. Coordenadas en píxeles de `marketing-2560.jpg` (2560×1440), como el Centro de campaña.
 */
import { EQUIPOS_DE_MARKETING, equipoDelAgente, nombreCanonico } from "@/lib/organigrama"
import { haceCuanto } from "@/lib/oficinas"
import { nombreLegible } from "@/lib/trabajo-en-vivo"

export const FOTO = { w: 2560, h: 1440 } as const
export type ClaveDeMesa = "direccion" | "estrategia" | "creativo" | "web" | "medios" | "relaciones"
export type EtapaDeMesa = "activo" | "segunda_etapa"
export interface Punto { x: number; y: number }
export interface Mesa {
  clave: ClaveDeMesa
  nombre: string
  orden: number
  etapa: EtapaDeMesa
  /** la silla (donde se sienta la figura) y el monitor (donde se enciende la luz), en píxeles de la foto */
  silla: Punto
  monitor: Punto
  /** dónde va el rótulo del equipo */
  rotulo: Punto
  /** la mesa está en la foto original (1-4) o es una de las 2 copias idénticas de la capa `MESAS_EXTRA` (5-6, en el piso ganado al acercar el vidrio) */
  en_la_foto: boolean
  /** centro del tablero de la mesa (para la zona del ratón) */
  centro: Punto
  color: string
}

/** ejes de la vista isométrica de la foto: `U` va hacia arriba-derecha (el largo de la mesa), `V` hacia abajo-derecha */
export const U = { x: 0.866, y: -0.5 } as const
export const V = { x: 0.866, y: 0.5 } as const
const mesa = (clave: ClaveDeMesa, nombre: string, orden: number, etapa: EtapaDeMesa, silla: Punto, monitor: Punto, en_la_foto: boolean, centro: Punto, color: string): Mesa =>
  ({ clave, nombre, orden, etapa, silla, monitor, rotulo: { x: monitor.x, y: monitor.y - 95 }, en_la_foto, centro, color })

/**
 * LAS 6 MESAS del boceto de CC5 (`2026-11-01-BOCETO-CC5-oficina-de-marketing-6-equipos.md`, aprobado por Emilio 01-nov): Dirección · Estrategia · Creativo encendidas en 3 de las
 * 4 mesas de la foto; Web y búsqueda en la 4.ª; Medios y Performance y Relaciones en 2 mesas NUEVAS idénticas (pedidos de Emilio 01-nov: «2 mesas extras idénticas a las
 * que ya se ven», sin punteadas, y «reducir el espacio entre el vidrio y la mesa redonda para ganar espacio»): el vidrio de la sala de reuniones se acerca a la mesa redonda y
 * en el piso ganado van 2 copias píxel a píxel de la mesa Creativo, alineadas con las demás (Medios junto a Dirección, Relaciones junto a Creativo). Todo va en una capa
 * aparte encima de la foto (`MESAS_EXTRA`); la foto original no se toca. Sus sillas/monitores = los de Creativo trasladados. Colores de `lib/organigrama.ts`.
 */
export const MESAS: Mesa[] = [
  mesa("direccion", "Dirección", 1, "activo", { x: 1038, y: 628 }, { x: 1102, y: 552 }, true, { x: 1078, y: 585 }, "#f5a524"),
  mesa("estrategia", "Estrategia", 2, "activo", { x: 836, y: 728 }, { x: 895, y: 650 }, true, { x: 872, y: 684 }, "#e8731a"),
  mesa("creativo", "Creativo", 3, "activo", { x: 1024, y: 836 }, { x: 1088, y: 758 }, true, { x: 1064, y: 792 }, "#ffb86b"),
  mesa("web", "Web y búsqueda", 4, "segunda_etapa", { x: 1222, y: 930 }, { x: 1275, y: 855 }, true, { x: 1255, y: 888 }, "#9a7b5a"),
  mesa("medios", "Medios y Performance", 5, "segunda_etapa", { x: 1185, y: 727 }, { x: 1249, y: 649 }, false, { x: 1225, y: 683 }, "#8c8c8c"),
  mesa("relaciones", "Relaciones", 6, "segunda_etapa", { x: 1336, y: 838 }, { x: 1400, y: 760 }, false, { x: 1376, y: 794 }, "#a08cff"),
]

/**
 * La capa de las 2 mesas nuevas: `public/nuevo/marketing-mesas-y-vidrio.webp` (con transparencia: solo los píxeles que cambian). Lleva el vidrio en L de la sala de
 * reuniones trasladado (83, −39) hacia la mesa redonda (el piso donde estaba se rehace liso con el grano del piso; la marca del piso junto al poste se conserva) y
 * la mesa Creativo de `marketing-2560.jpg` copiada 2 veces (`traslados`) en el piso ganado. `caja` = dónde va, en píxeles de la foto.
 * Generada por `.cc6/mover-vidrio.py 0.4 … --capa` (CC6, 01-nov · copia del guion en zr-vault/raw/evidencia/dashboard-nuevo/cc6/vidrio-y-mesas/).
 */
export const MESAS_EXTRA = {
  src: "/nuevo/marketing-mesas-y-vidrio.webp",
  caja: { x: 1131, y: 436, w: 500, h: 517 },
  traslados: { medios: { x: 161, y: -109 }, relaciones: { x: 312, y: 2 } },
} as const
export const mesaPorClave = (k: string): Mesa | undefined => MESAS.find((m) => m.clave === k)

/** el tablero de una mesa como polígono (puntos «x,y x,y …» para SVG): un paralelogramo isométrico de 200 × 84 alrededor de su centro */
export function tableroDeLaMesa(m: Mesa, largo = 100, ancho = 42): string {
  const c = m.centro
  const p = (a: number, b: number) => `${Math.round(c.x + a * U.x + b * V.x)},${Math.round(c.y + a * U.y + b * V.y)}`
  return [p(largo, -ancho), p(largo, ancho), p(-largo, ancho), p(-largo, -ancho)].join(" ")
}

/** dónde se sienta cada uno cuando trabajan VARIOS a la vez en la misma mesa: a lo largo del borde de la mesa, de a 60 px, centrados en la silla; más de MAXIMO_POR_MESA → «+N» */
export const MAXIMO_POR_MESA = 3
export const PASO_ENTRE_SILLAS = 60
export function asientosDeLaMesa(m: Mesa, n: number): Punto[] {
  const k = Math.min(Math.max(n, 0), MAXIMO_POR_MESA)
  return Array.from({ length: k }, (_, i) => { const d = (i - (k - 1) / 2) * PASO_ENTRE_SILLAS; return { x: Math.round(m.silla.x + d * U.x), y: Math.round(m.silla.y + d * U.y) } })
}

/** ─── el estado de cada empleado a partir del dato ─── */
export const MINUTOS_TOPE = 20
export const MINUTOS_FALLO = 10
export const HORAS_RECIENTE = 24

export interface Despacho { id: string; agent_name: string; client_id: string | null; workflow_id: string | null; workflow_execution_id: string | null; status: string | null; running_at: string | null; completed_at: string | null; created_at: string | null }
export interface InvocacionViva { agent_name: string; client_id: string | null; workflow_id: string | null; workflow_execution_id: string | null; status: string | null; started_at: string | null; ended_at: string | null; cost_usd: number | null; step_name: string | null; task_text: string | null }
export interface TarjetaDelDirectorio { agente: string; equipo: string | null }
export interface NombreDeAgente { name: string; display_name: string | null }
export type EstadoDelAsiento = "trabajando" | "fallo"
export type EstadoDelMiembro = EstadoDelAsiento | "reciente" | "quieto"
export type OrigenDeLaMesa = "directorio" | "mapa"

export interface Sentado {
  agente: string
  nombre: string
  mesa: ClaveDeMesa
  estado: EstadoDelAsiento
  cliente: string | null
  flujo: string
  paso: string | null
  tarea: string | null
  /** desde cuándo (ISO) y en palabras */
  desde: string | null
  hace: string
  /** gasto de ESTA tarea: llega al terminar; mientras corre no hay dato */
  gasto_usd: number | null
  /** de dónde salió cada cosa */
  fuente: string
  origen_de_la_mesa: OrigenDeLaMesa
}
export interface MiembroDeMesa { agente: string; nombre: string; estado: EstadoDelMiembro; ultima: string | null; hace: string; nota: string | null; origen_de_la_mesa: OrigenDeLaMesa }
export interface MesaViva extends Mesa { sentados: Sentado[]; equipo: MiembroDeMesa[]; trabajando: number; fallando: number }
export interface EscenaDatos {
  leido_en: string
  fuente: string
  mesas: MesaViva[]
  /** trabajando ahora pero sin mesa conocida (ni tarjeta en el directorio ni puesto en el mapa) */
  sin_mesa: Sentado[]
  /** despachos «running» más viejos que el tope: no se sientan, se dicen */
  sin_fin_registrado: number
}

/** nombres legibles de los flujos de n8n que se conocen (no hay tabla que traduzca `workflow_id` → nombre; pedido a Lenovo 01-nov). El resto sale como «flujo X9F0…» */
export const FLUJOS: Record<string, string> = {
  X9F0zp6LQ2xGEYVS: "Plan de 90 días",
}
export const nombreDelFlujo = (workflowId: string | null | undefined): string => (workflowId ? FLUJOS[workflowId] ?? `flujo ${workflowId.slice(0, 4)}…` : "sin flujo registrado")
/** «209744:analisis-mercado» → «análisis mercado» (el paso viene en el id de ejecución; si no, de `metadata.step_name`) */
export function pasoDe(execId: string | null | undefined, stepName?: string | null): string | null {
  const s = stepName?.trim() || (execId && execId.includes(":") ? execId.slice(execId.indexOf(":") + 1) : "")
  return s ? s.replace(/[-_]+/g, " ").trim() : null
}
const esFallo = (status: unknown) => /error|fail|timeout|cancel/i.test(String(status ?? ""))
const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN)
/** la invocación cierra el despacho si es del mismo agente y de la misma corrida (id igual, o con «:paso») y terminó después de que arrancó */
export function invocacionCierraElDespacho(d: Despacho, i: InvocacionViva): boolean {
  if (nombreCanonico(i.agent_name) !== nombreCanonico(d.agent_name)) return false
  if (!d.workflow_execution_id || !i.workflow_execution_id) return false
  const misma = i.workflow_execution_id === d.workflow_execution_id || i.workflow_execution_id.startsWith(d.workflow_execution_id + ":")
  if (!misma) return false
  const fin = ms(i.ended_at), ini = ms(d.running_at ?? d.created_at)
  return Number.isFinite(fin) && (!Number.isFinite(ini) || fin >= ini - 1000)
}
const recorte = (s: string | null | undefined, n = 110): string | null => { const t = (s ?? "").replace(/\s+/g, " ").trim(); return t ? (t.length > n ? t.slice(0, n - 1) + "…" : t) : null }

export interface EntradaDeLaEscena {
  despachos: Despacho[]
  invocaciones: InvocacionViva[]
  directorio: TarjetaDelDirectorio[]
  agentes: NombreDeAgente[]
  clientes: Array<{ id: string; nombre: string }>
  /** las filas de `oficina_equipos` (etapa real); si faltan, manda la tabla MESAS */
  equipos?: Array<{ clave: string; nombre: string | null; etapa: string | null }> | null
  ahora: Date
}

/** la mesa de un agente: el dato del directorio primero; si no tiene tarjeta, el mapa firmado; si no, ninguna */
export function mesaDelAgente(agente: string, directorio: TarjetaDelDirectorio[]): { mesa: ClaveDeMesa; origen: OrigenDeLaMesa } | null {
  const k = nombreCanonico(agente)
  const t = directorio.find((d) => nombreCanonico(d.agente) === k)
  if (t?.equipo) { const e = nombreCanonico(t.equipo).replace(/-/g, "_"); if (mesaPorClave(e)) return { mesa: e as ClaveDeMesa, origen: "directorio" } }
  if (t) return null // tiene tarjeta sin equipo (el portero): a propósito, sin mesa
  const e = equipoDelAgente(agente)
  return (EQUIPOS_DE_MARKETING as string[]).includes(e) && mesaPorClave(e) ? { mesa: e as ClaveDeMesa, origen: "mapa" } : null
}

export function armarEscena(e: EntradaDeLaEscena): EscenaDatos {
  const t = e.ahora.getTime()
  const nombres = new Map(e.agentes.map((a) => [nombreCanonico(a.name), a.display_name || nombreLegible(a.name)]))
  const nombre = (a: string) => nombres.get(nombreCanonico(a)) ?? nombreLegible(a)
  const clientes = new Map(e.clientes.map((c) => [c.id, c.nombre]))
  const cliente = (id: string | null) => (id ? clientes.get(id) ?? "cliente sin nombre" : null)
  const hora = e.ahora.toISOString().slice(11, 16) + "Z"
  const fuente = `agent_dispatches + agent_invocations · leído ${hora}`
  const etapas = new Map((e.equipos ?? []).map((q) => [nombreCanonico(q.clave).replace(/-/g, "_"), q]))

  const sentados: Sentado[] = []
  const sinMesa: Sentado[] = [] // sentados sin mesa conocida (se listan aparte, no se sientan en ninguna)
  let sinFin = 0
  const yaSentado = new Set<string>()
  // 1 · trabajando ahora: despachos abiertos dentro del tope y sin invocación que los cierre
  for (const d of e.despachos) {
    if (String(d.status ?? "").toLowerCase() !== "running") continue
    const ini = ms(d.running_at ?? d.created_at)
    if (!Number.isFinite(ini)) continue
    if (e.invocaciones.some((i) => invocacionCierraElDespacho(d, i))) continue
    if (t - ini > MINUTOS_TOPE * 60_000) { sinFin++; continue }
    const k = nombreCanonico(d.agent_name) + "|" + (d.workflow_execution_id ?? "")
    if (yaSentado.has(k)) continue
    yaSentado.add(k)
    const m = mesaDelAgente(d.agent_name, e.directorio)
    const inv = e.invocaciones.find((i) => nombreCanonico(i.agent_name) === nombreCanonico(d.agent_name) && i.workflow_execution_id && d.workflow_execution_id && i.workflow_execution_id.startsWith(d.workflow_execution_id))
    const s: Sentado = {
      agente: d.agent_name, nombre: nombre(d.agent_name), mesa: m?.mesa ?? "direccion", estado: "trabajando", cliente: cliente(d.client_id),
      flujo: nombreDelFlujo(d.workflow_id), paso: pasoDe(d.workflow_execution_id, inv?.step_name), tarea: recorte(inv?.task_text),
      desde: d.running_at ?? d.created_at, hace: haceCuanto(d.running_at ?? d.created_at, e.ahora), gasto_usd: null, fuente, origen_de_la_mesa: m?.origen ?? "mapa",
    }
    sentados.push(s)
    if (!m) sinMesa.push(s)
  }
  // 2 · falló hace poco: despacho en error o invocación fallida en los últimos minutos (se queda sentado con el monitor en rojo ese rato)
  const fallos: Array<{ agente: string; cuando: string; d?: Despacho; i?: InvocacionViva }> = []
  for (const d of e.despachos) { const c = d.completed_at ?? d.created_at; if (esFallo(d.status) && c && t - ms(c) < MINUTOS_FALLO * 60_000) fallos.push({ agente: d.agent_name, cuando: c, d }) }
  for (const i of e.invocaciones) { const c = i.ended_at ?? i.started_at; if (esFallo(i.status) && c && t - ms(c) < MINUTOS_FALLO * 60_000) fallos.push({ agente: i.agent_name, cuando: c, i }) }
  for (const f of fallos.sort((a, b) => (a.cuando < b.cuando ? 1 : -1))) {
    const k = nombreCanonico(f.agente)
    if (sentados.some((s) => nombreCanonico(s.agente) === k)) continue
    const m = mesaDelAgente(f.agente, e.directorio)
    const s: Sentado = {
      agente: f.agente, nombre: nombre(f.agente), mesa: m?.mesa ?? "direccion", estado: "fallo", cliente: cliente(f.d?.client_id ?? f.i?.client_id ?? null),
      flujo: nombreDelFlujo(f.d?.workflow_id ?? f.i?.workflow_id), paso: pasoDe(f.d?.workflow_execution_id ?? f.i?.workflow_execution_id, f.i?.step_name), tarea: recorte(f.i?.task_text),
      desde: f.cuando, hace: haceCuanto(f.cuando, e.ahora), gasto_usd: f.i?.cost_usd ?? null, fuente, origen_de_la_mesa: m?.origen ?? "mapa",
    }
    sentados.push(s)
    if (!m) sinMesa.push(s)
  }

  // 3 · el equipo completo de cada mesa (para la lista al tocar la mesa): directorio + mapa, con su última actividad
  const agentesConocidos = new Set<string>([...e.directorio.map((d) => d.agente), ...e.agentes.map((a) => a.name), ...e.invocaciones.map((i) => i.agent_name), ...e.despachos.map((d) => d.agent_name)].filter(Boolean))
  const mesas: MesaViva[] = MESAS.map((m) => {
    const q = etapas.get(m.clave)
    const base: Mesa = { ...m, nombre: q?.nombre || m.nombre, etapa: q ? (q.etapa === "activo" ? "activo" : "segunda_etapa") : m.etapa }
    const misSentados = sentados.filter((s) => s.mesa === m.clave && !sinMesa.includes(s))
    const equipo: MiembroDeMesa[] = []
    for (const a of agentesConocidos) {
      const pm = mesaDelAgente(a, e.directorio)
      if (pm?.mesa !== m.clave) continue
      const sentado = misSentados.find((s) => nombreCanonico(s.agente) === nombreCanonico(a))
      const mias = e.invocaciones.filter((i) => nombreCanonico(i.agent_name) === nombreCanonico(a))
      const ultima = mias.map((i) => i.ended_at ?? i.started_at).filter((x): x is string => !!x).sort().at(-1) ?? null
      const abiertoViejo = e.despachos.find((d) => nombreCanonico(d.agent_name) === nombreCanonico(a) && String(d.status ?? "").toLowerCase() === "running" && !e.invocaciones.some((i) => invocacionCierraElDespacho(d, i)) && t - ms(d.running_at ?? d.created_at) > MINUTOS_TOPE * 60_000)
      const estado: EstadoDelMiembro = sentado ? sentado.estado : ultima && t - ms(ultima) < HORAS_RECIENTE * 3_600_000 ? "reciente" : "quieto"
      equipo.push({ agente: a, nombre: nombre(a), estado, ultima, hace: ultima ? haceCuanto(ultima, e.ahora) : "sin trabajo en la ventana leída", nota: abiertoViejo ? `despacho abierto ${haceCuanto(abiertoViejo.running_at ?? abiertoViejo.created_at, e.ahora)} sin fin registrado` : null, origen_de_la_mesa: pm.origen })
    }
    const orden = (x: MiembroDeMesa) => (x.estado === "trabajando" ? 0 : x.estado === "fallo" ? 1 : x.estado === "reciente" ? 2 : 3)
    equipo.sort((a, b) => orden(a) - orden(b) || a.nombre.localeCompare(b.nombre, "es"))
    return { ...base, sentados: misSentados, equipo, trabajando: misSentados.filter((s) => s.estado === "trabajando").length, fallando: misSentados.filter((s) => s.estado === "fallo").length }
  })
  return { leido_en: e.ahora.toISOString(), fuente, mesas, sin_mesa: sinMesa, sin_fin_registrado: sinFin }
}

/** las líneas de la ficha al pasar el cursor, en este orden; nunca se rellena: lo que no hay dice «sin dato» */
export function lineasDeLaFicha(s: Sentado, mesa: Pick<Mesa, "nombre">): string[] {
  const estado = s.estado === "trabajando" ? "trabajando" : "falló"
  const equipo = `${mesa.nombre}${s.origen_de_la_mesa === "mapa" ? " (según el mapa, sin tarjeta en el directorio)" : ""} · ${estado}`
  const enQue = [s.cliente ?? "sin cliente", s.flujo, s.paso].filter(Boolean).join(" · ")
  const desde = s.desde ? `${s.estado === "trabajando" ? "desde" : "falló"} ${s.hace}` : "desde · sin dato"
  const gasto = s.gasto_usd == null ? (s.estado === "trabajando" ? "gasto de esta tarea · en curso, sin registrar aún" : "gasto de esta tarea · sin dato") : `gasto de esta tarea · US$ ${s.gasto_usd.toFixed(3)}`
  return [s.nombre, equipo, enQue, ...(s.tarea ? [`tarea · ${s.tarea}`] : []), desde, gasto, `fuente ${s.fuente}`]
}

/** ─── la cámara de la escena de Spline que se monta sobre la foto: de píxeles de la foto a coordenadas del suelo 3D y vuelta ─── */
/** cámara en perspectiva que orbita el origen (acimut y elevación en grados), mirando al centro; `fov` vertical en grados. Se calibra con las marcas (`?marcas=1`) */
export interface Camara { acimut: number; elevacion: number; distancia: number; fov: number; centro: Punto }
export const CAMARA: Camara = { acimut: 25, elevacion: 35, distancia: 2600, fov: 20, centro: { x: 1024, y: 836 } }
export interface Vec3 { x: number; y: number; z: number }
const rad = (g: number) => (g * Math.PI) / 180
const norm = (v: Vec3): Vec3 => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l } }
const cruz = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const punto = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
export function baseDeLaCamara(c: Camara) {
  const a = rad(c.acimut), e = rad(c.elevacion)
  const pos: Vec3 = { x: c.distancia * Math.sin(a) * Math.cos(e), y: c.distancia * Math.sin(e), z: c.distancia * Math.cos(a) * Math.cos(e) }
  const frente = norm({ x: -pos.x, y: -pos.y, z: -pos.z })
  const derecha = norm(cruz(frente, { x: 0, y: 1, z: 0 }))
  const arriba = cruz(derecha, frente)
  const f = (FOTO.h / 2) / Math.tan(rad(c.fov) / 2)
  return { pos, frente, derecha, arriba, f }
}
/** un punto del mundo 3D → píxel de la foto */
export function proyectar(p: Vec3, c: Camara = CAMARA): Punto {
  const b = baseDeLaCamara(c)
  const v = { x: p.x - b.pos.x, y: p.y - b.pos.y, z: p.z - b.pos.z }
  const z = punto(v, b.frente)
  return { x: c.centro.x + (b.f * punto(v, b.derecha)) / z, y: c.centro.y - (b.f * punto(v, b.arriba)) / z }
}
/** un píxel de la foto → el punto del suelo (y = 0) que la cámara ve ahí */
export function alSuelo(px: Punto, c: Camara = CAMARA): Vec3 {
  const b = baseDeLaCamara(c)
  const dx = (px.x - c.centro.x) / b.f, dy = (c.centro.y - px.y) / b.f
  const dir = { x: b.frente.x + dx * b.derecha.x + dy * b.arriba.x, y: b.frente.y + dx * b.derecha.y + dy * b.arriba.y, z: b.frente.z + dx * b.derecha.z + dy * b.arriba.z }
  const t = -b.pos.y / dir.y
  return { x: b.pos.x + t * dir.x, y: 0, z: b.pos.z + t * dir.z }
}
/** hacia dónde mira la figura: de la silla al monitor, como giro en Y (grados) sobre el suelo */
export function giroHaciaElMonitor(m: Pick<Mesa, "silla" | "monitor">, c: Camara = CAMARA): number {
  const s = alSuelo(m.silla, c), o = alSuelo(m.monitor, c)
  return (Math.atan2(o.x - s.x, o.z - s.z) * 180) / Math.PI
}

/** nombres de los objetos de la escena de Spline «Zero Risk · avatares de la oficina»: hasta MAXIMO_DE_FIGURAS figuras iguales que esta capa coloca, muestra y enciende */
export const MAXIMO_DE_FIGURAS = 8
export const NOMBRES_SPLINE = {
  camara: "Camara",
  figuras: Array.from({ length: MAXIMO_DE_FIGURAS }, (_, i) => `Figura ${i + 1}`),
  luzAmbar: Array.from({ length: MAXIMO_DE_FIGURAS }, (_, i) => `Figura ${i + 1} luz ambar`),
  luzRoja: Array.from({ length: MAXIMO_DE_FIGURAS }, (_, i) => `Figura ${i + 1} luz roja`),
  marcas: MESAS.map((m) => `Marca ${m.clave}`),
}
/** la escena exportada desde Spline (vacía hasta que se exporte el archivo `825be760-…` con las figuras: sin escena, la capa muestra solo luces y fichas) */
export const ESCENA_AVATARES = ""

/** qué figura ocupa cada asiento: las sentadas en orden de mesa; el resto de figuras se esconde */
export interface Colocacion { figura: string; luzAmbar: string; luzRoja: string; px: Punto; suelo: Vec3; giro: number; estado: EstadoDelAsiento; sentado: Sentado }
export function colocarFiguras(mesas: MesaViva[], c: Camara = CAMARA): Colocacion[] {
  const out: Colocacion[] = []
  for (const m of mesas) {
    const asientos = asientosDeLaMesa(m, m.sentados.length)
    m.sentados.slice(0, asientos.length).forEach((s, i) => {
      const n = out.length
      if (n >= MAXIMO_DE_FIGURAS) return
      const px = asientos[i]
      out.push({ figura: NOMBRES_SPLINE.figuras[n], luzAmbar: NOMBRES_SPLINE.luzAmbar[n], luzRoja: NOMBRES_SPLINE.luzRoja[n], px, suelo: alSuelo(px, c), giro: giroHaciaElMonitor(m, c), estado: s.estado, sentado: s })
    })
  }
  return out
}
/** respiración lenta de una figura sentada (escala en Y, ±1 %), distinta por figura para que no vayan al unísono */
export const respiracion = (t: number, i: number) => 1 + 0.01 * Math.sin((2 * Math.PI * t) / 3.4 + i * 1.1)
