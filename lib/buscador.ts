/**
 * EL BUSCADOR DE LA BARRA SUPERIOR (CC6 · 03-nov · sprint dashboard · ENCARGO-LENOVO-a-CC6-botones-muertos-y-enlaces-al-viejo): busca de verdad en
 * paneles, clientes, empleados y piezas. Lógica PURA: los datos los lee el componente (las mismas lecturas de siempre, solo lectura).
 */

/** los paneles que el marco puede abrir encima de la escena (el mismo nombre que usa el evento `nv:abrir-panel`) */
export type PanelDelMarco = "riesgos" | "dinero" | "organizacion" | "observabilidad" | "piezas" | "aplicaciones" | "envivo" | "decisiones"
export const EVENTO_ABRIR_PANEL = "nv:abrir-panel"
export interface PedidoDePanel { panel: PanelDelMarco; pieza?: string | null }

/** CC6 · 03-nov (auditoría punto 15 · una sola vista del equipo): el Centro de campaña pide a la escena de Marketing que abra el Squad Hub de CC4 */
export const EVENTO_ABRIR_PLANTEL = "nv:abrir-plantel"
export interface PedidoDePlantel { cliente?: string | null; mesa?: string | null }

/** los paneles por su nombre de pantalla (y otras palabras con las que alguien los buscaría) */
export const PANELES_DEL_BUSCADOR: ReadonlyArray<{ panel: PanelDelMarco; nombre: string; palabras: string }> = [
  { panel: "riesgos", nombre: "Riesgos y alarmas", palabras: "alertas alarmas riesgos campana" },
  { panel: "dinero", nombre: "Dinero", palabras: "gasto plata costos saldos facturacion" },
  { panel: "organizacion", nombre: "Organización", palabras: "empleados equipo organigrama personas" },
  { panel: "observabilidad", nombre: "Flujos y corridas", palabras: "flujos corridas observabilidad trazas" },
  { panel: "piezas", nombre: "Piezas", palabras: "piezas bandeja aprobar creativos" },
  { panel: "aplicaciones", nombre: "Aplicaciones de Marketing", palabras: "aplicaciones pizarron calendario manual plan brief" },
  { panel: "envivo", nombre: "Actividad en vivo", palabras: "actividad en vivo ahora trabajando" },
  { panel: "decisiones", nombre: "Decisiones", palabras: "decisiones firmas aprobaciones mesa" },
]

/** minúsculas y sin tildes: «Organización» = «organizacion» */
export const normalizar = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

export type ResultadoDeBusqueda =
  | { tipo: "panel"; id: string; titulo: string; detalle: string; panel: PanelDelMarco }
  | { tipo: "cliente"; id: string; titulo: string; detalle: string; ruta: string }
  | { tipo: "empleado"; id: string; titulo: string; detalle: string }
  | { tipo: "pieza"; id: string; titulo: string; detalle: string }

export interface FuentesDelBuscador {
  clientes: Array<{ nombre: string; ruta: string }>
  empleados: Array<{ id: string; nombre: string; puesto: string; departamento: string }>
  piezas: Array<{ id: string; titulo: string; cliente: string | null }>
}

/** cuánto se parece: empieza igual (2) · una palabra empieza igual (1) · lo contiene (0) · nada (-1) */
function parecido(texto: string, q: string): number {
  const t = normalizar(texto)
  if (!q || !t.includes(q)) return -1
  if (t.startsWith(q)) return 2
  return t.split(/\s+/).some((p) => p.startsWith(q)) ? 1 : 0
}

/** los resultados, por grupo (paneles · clientes · empleados · piezas) y hasta `porGrupo` en cada uno; lo que empieza igual, primero */
export function resultadosDeBusqueda(consulta: string, f: FuentesDelBuscador, porGrupo = 5): ResultadoDeBusqueda[] {
  const q = normalizar(consulta)
  if (q.length < 1) return []
  const mejores = <T,>(xs: Array<{ x: T; p: number; orden: string }>) => xs.filter((r) => r.p >= 0).sort((a, b) => b.p - a.p || a.orden.localeCompare(b.orden, "es")).slice(0, porGrupo).map((r) => r.x)
  const paneles = mejores(PANELES_DEL_BUSCADOR.map((p) => ({ x: { tipo: "panel" as const, id: `panel-${p.panel}`, titulo: p.nombre, detalle: "Panel", panel: p.panel }, p: Math.max(parecido(p.nombre, q), parecido(p.palabras, q)), orden: p.nombre })))
  const clientes = mejores(f.clientes.map((c) => ({ x: { tipo: "cliente" as const, id: `cliente-${c.ruta}`, titulo: c.nombre, detalle: "Cliente", ruta: c.ruta }, p: parecido(c.nombre, q), orden: c.nombre })))
  const empleados = mejores(f.empleados.map((e) => ({ x: { tipo: "empleado" as const, id: `empleado-${e.id}`, titulo: e.nombre, detalle: [e.puesto, e.departamento].filter(Boolean).join(" · ") || "Empleado" }, p: Math.max(parecido(e.nombre, q), parecido(e.puesto, q) - 1), orden: e.nombre })))
  const piezas = mejores(f.piezas.map((p) => ({ x: { tipo: "pieza" as const, id: `pieza-${p.id}`, titulo: p.titulo, detalle: p.cliente ? `Pieza · ${p.cliente}` : "Pieza" }, p: Math.max(parecido(p.titulo, q), p.cliente ? parecido(p.cliente, q) - 1 : -1), orden: p.titulo })))
  return [...paneles, ...clientes, ...empleados, ...piezas]
}

/** la tecla «/» abre el buscador, salvo que la persona esté escribiendo en otro campo */
export function esAtajoDelBuscador(e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }, enfocado: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return false
  const tag = (enfocado?.tagName ?? "").toUpperCase()
  return !(tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || enfocado?.isContentEditable)
}
