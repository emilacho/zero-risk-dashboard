/**
 * «EN VIVO» (dashboard nuevo · sprint 2 · 31-oct): el grafo vivo de oficinas y empleados. Solo funciones puras (sin red, sin reloj): de las filas reales del
 * trabajo sale (1) a qué oficina pertenece cada empleado, (2) dónde se dibuja cada cosa y (3) el recorrido del pulso. Nada se inventa: un empleado
 * aparece en el dibujo solo si hizo algo de verdad (agent_invocations) y el pulso sale cuando ESA fila llega.
 */

export type ClaveDeOficina = "creativa" | "financiera" | "jefatura" | "cerebro" | "planeacion"

export interface OficinaEnVivo { clave: ClaveDeOficina; nombre: string; x: number; y: number }

/** el lienzo del grafo (coordenadas del SVG) */
export const LIENZO = { w: 800, h: 520 } as const
export const CENTRO = { x: 400, y: 262 } as const

/** las cinco oficinas sobre una elipse (vista isométrica: ancha y baja), en el mismo orden de la pantalla de Oficinas */
export const OFICINAS_EN_VIVO: OficinaEnVivo[] = [
  { clave: "planeacion", nombre: "Planeación", x: 400, y: 92 },
  { clave: "creativa", nombre: "Oficina creativa", x: 668, y: 188 },
  { clave: "jefatura", nombre: "Jefatura", x: 598, y: 396 },
  { clave: "cerebro", nombre: "Cerebro y portero", x: 202, y: 396 },
  { clave: "financiera", nombre: "Oficina financiera", x: 132, y: 188 },
]

/** a qué oficina pertenece cada empleado (por su nombre en la base). Lo que no está aquí cae en «otras» y no tiene lugar en el dibujo. */
const OFICINA_DEL_EMPLEADO: Record<string, ClaveDeOficina> = {
  "campaign-brief-agent": "planeacion", "jefe-marketing": "planeacion", "onboarding-specialist": "planeacion",
  "competitive-intelligence-agent": "planeacion", "reporting-agent": "planeacion", "social-media-strategist": "planeacion",
  "content-creator": "creativa", "carousel-designer": "creativa", "design-image-prompt-engineer": "creativa", "design-visual-storyteller": "creativa",
  "image-generation": "creativa", "creative-director-mesa": "creativa", "spell-check-corrector": "creativa", "marketing_instagram_curator": "creativa",
  "brand-strategist": "jefatura", "editor-en-jefe": "jefatura", "jefe-client-success": "jefatura", "revisor-externo-gpt": "jefatura",
  "finance-fpa-analyst": "financiera", "chief-financial-officer": "financiera", "tracking-specialist": "financiera",
  "etiquetador-del-cerebro": "cerebro", "desmenuzador-del-dueno": "cerebro",
}

export function oficinaDelEmpleado(empleado: string, comando?: unknown): ClaveDeOficina | null {
  if (typeof comando === "string" && comando.startsWith("portero.")) return "cerebro"
  if (empleado.startsWith("paid_media")) return "financiera"
  return OFICINA_DEL_EMPLEADO[empleado] ?? null
}

export interface FilaEnVivo {
  id: string; cuando: string; hace: string
  /** el nombre del empleado en la base (sirve para ubicarlo; no se muestra) */
  empleado: string
  agente: string
  oficina: ClaveDeOficina | null
  oficina_nombre: string | null
  cliente: string | null
  que_hace: string
  estado: "trabajando" | "listo" | "fallo"
}

export interface NodoDeEmpleado { empleado: string; agente: string; oficina: ClaveDeOficina; x: number; y: number }

/** los empleados que se dibujan a la vez (los más recientes): más serían una mancha */
export const MAXIMO_DE_EMPLEADOS = 12
const RADIO_DEL_EMPLEADO = 62

/** dónde se dibuja cada empleado: alrededor de su oficina, repartidos en abanico hacia afuera del centro. El lugar depende solo de su orden en su oficina (no salta cuando llega otro de otra oficina). */
export function ubicarEmpleados(filas: Pick<FilaEnVivo, "empleado" | "agente" | "oficina">[]): NodoDeEmpleado[] {
  const vistos = new Set<string>()
  const porOficina = new Map<ClaveDeOficina, { empleado: string; agente: string }[]>()
  for (const f of filas) {
    if (!f.oficina || vistos.has(f.empleado) || vistos.size >= MAXIMO_DE_EMPLEADOS) continue
    vistos.add(f.empleado)
    porOficina.set(f.oficina, [...(porOficina.get(f.oficina) ?? []), { empleado: f.empleado, agente: f.agente }])
  }
  const nodos: NodoDeEmpleado[] = []
  for (const of_ of OFICINAS_EN_VIVO) {
    const lista = (porOficina.get(of_.clave) ?? []).sort((a, b) => (a.empleado < b.empleado ? -1 : 1))
    const afuera = Math.atan2(of_.y - CENTRO.y, of_.x - CENTRO.x) // hacia afuera del centro
    lista.forEach((e, i) => {
      const abanico = lista.length === 1 ? 0 : (i / (lista.length - 1) - 0.5) * 1.9
      const a = afuera + abanico
      // elipse aplastada: vista isométrica
      nodos.push({ ...e, oficina: of_.clave, x: Math.round(of_.x + Math.cos(a) * RADIO_DEL_EMPLEADO * 1.35), y: Math.round(of_.y + Math.sin(a) * RADIO_DEL_EMPLEADO * 0.78) })
    })
  }
  return nodos
}

/** el recorrido del pulso: del centro a la oficina y de ahí al empleado (o solo hasta la oficina si no tiene lugar) */
export function recorridoDelPulso(oficina: ClaveDeOficina, empleado?: NodoDeEmpleado | null): string {
  const o = OFICINAS_EN_VIVO.find((x) => x.clave === oficina)
  if (!o) return `M${CENTRO.x},${CENTRO.y}`
  return `M${CENTRO.x},${CENTRO.y} L${o.x},${o.y}${empleado ? ` L${empleado.x},${empleado.y}` : ""}`
}

/** de lo que ya se vio a lo que llegó: las filas nuevas (por id), en el orden en que ocurrieron (la más vieja primero) */
export function filasNuevas(vistas: ReadonlySet<string>, llegadas: FilaEnVivo[]): FilaEnVivo[] {
  return llegadas.filter((f) => !vistas.has(f.id)).sort((a, b) => (a.cuando < b.cuando ? -1 : a.cuando > b.cuando ? 1 : 0))
}

/** al abrir, solo pulsan las filas de los últimos minutos (lo viejo no es «ahora») */
export const VENTANA_DEL_PRIMER_PULSO_MS = 120_000
export function entreLasRecientes(filas: FilaEnVivo[], ahora: number): FilaEnVivo[] {
  return filas.filter((f) => { const t = Date.parse(f.cuando); return Number.isFinite(t) && ahora - t <= VENTANA_DEL_PRIMER_PULSO_MS })
}
