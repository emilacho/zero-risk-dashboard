/**
 * LAS ALERTAS (CC#2 · 29-oct · ADENDA 4): lógica PURA de la pantalla «¿qué se quejó el sistema?» con «ya lo vi».
 * Tres fuentes que sí podemos leer: las alarmas del cerebro (`cerebro_alertas`), el estado de los topes de costo (`cost_alerts_state`)
 * y los problemas REALES de la oficina (encargos fallidos, cortados por tope o con desacuerdo; los ensayos y pruebas no cuentan).
 * El historial del canal #alertas de Slack NO se lee: la llave del bot no tiene permiso de leer historial (`channels:history`). La pantalla lo dice.
 * «Ya lo vi» guarda una marca por alerta: si la alerta ocurre OTRA VEZ (su última vez es posterior a la marca) vuelve a aparecer como nueva.
 */
import { tituloDePieza, usdES } from "@/lib/lenguaje"

export type FuenteDeAlerta = "cerebro" | "costo" | "oficina"
export const VENTANA_OFICINA_DIAS = 14

export interface Alerta {
  clave: string
  fuente: FuenteDeAlerta
  titulo: string
  detalle: string
  repeticiones: number
  desde: string
  ultima_en: string
  cerrada: boolean
  vista_en: string | null
  /** a dónde lleva cada alerta (30-oct): la pieza, el cliente o el gasto; «Rehacer» lo agrega la pantalla cuando la alerta es de una pieza */
  acciones: AccionDeAlerta[]
  /** solo las alertas de una pieza: el encargo que se puede rehacer */
  encargo_id?: string
}
export interface AccionDeAlerta { texto: string; href: string }
export type AlertaCruda = Omit<Alerta, "vista_en">

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

type Fila = Record<string, unknown>
const txt = (v: unknown): string => (v == null ? "" : String(v))
const iso = (v: unknown): string => { const t = new Date(txt(v)).getTime(); return Number.isFinite(t) ? new Date(t).toISOString() : "" }

/** la clave sin el día del final: «aviso-del-dia:<cliente>:2026-10-29» y «…:2026-10-30» son la misma alarma del portero */
export const claveSinDia = (clave: string): string => clave.replace(/:\d{4}-\d{2}-\d{2}$/, "")

/** las alarmas del cerebro que solo cambian de día se juntan en una: manda la más reciente, las repeticiones se suman */
export function deCerebro(filas: Fila[]): AlertaCruda[] {
  const grupos = new Map<string, Fila[]>()
  for (const f of filas.filter((x) => iso(x.ultima_en))) { const k = claveSinDia(txt(f.clave)); grupos.set(k, [...(grupos.get(k) ?? []), f]) }
  return [...grupos.entries()].map(([base, fs]) => {
    const orden = [...fs].sort((a, b) => (iso(b.ultima_en) > iso(a.ultima_en) ? 1 : -1))
    const f = orden[0]
    const cliente = UUID.exec(base)?.[0]
    const desde = fs.map((x) => iso(x.abierto_en) || iso(x.ultima_en)).sort()[0]
    return {
      clave: `cerebro:${fs.length > 1 ? base : txt(f.clave)}`, fuente: "cerebro" as const, titulo: txt(f.titulo) || txt(f.clave), detalle: txt(f.ultimo_detalle),
      repeticiones: fs.reduce((t, x) => t + Math.max(1, Number(x.repeticiones) || 1), 0), desde, ultima_en: iso(f.ultima_en), cerrada: fs.every((x) => !!x.cerrado_en),
      acciones: cliente ? [{ texto: "Ver el cliente", href: `/clientes/${cliente}` }] : [],
    }
  })
}

export function deCostos(filas: Fila[]): AlertaCruda[] {
  return filas.filter((f) => iso(f.last_fired_at)).map((f) => {
    const valor = Number(f.last_value_usd), techo = Number(f.threshold_usd)
    const cifras = Number.isFinite(valor) && Number.isFinite(techo) ? `llegó a ${usdES(valor)} con un techo de ${usdES(techo)}` : "se disparó"
    return { clave: `costo:${txt(f.threshold_key)}`, fuente: "costo" as const, titulo: "Se llegó a un tope de costo", detalle: cifras, repeticiones: 1, desde: iso(f.last_fired_at), ultima_en: iso(f.last_fired_at), cerrada: false, acciones: [{ texto: "Ver el gasto", href: "/gasto" }] }
  })
}

const ESTADOS_MALOS: Record<string, string> = { fallido: "falló", cerrado_por_tope: "se cortó por llegar a su tope de gasto" }
const NO_ES_PRUEBA = (f: Fila): boolean => f.dry_run !== true && f.prueba !== true

export function deOficina(filas: Fila[], ahora: Date): AlertaCruda[] {
  const corte = ahora.getTime() - VENTANA_OFICINA_DIAS * 86_400_000
  const out: AlertaCruda[] = []
  // una pieza = un pedido (brief + familia): solo cuenta su intento MÁS NUEVO; si se rehízo y salió bien, los intentos viejos ya no son alerta
  const ultimo = new Map<string, Fila>()
  for (const f of filas.filter(NO_ES_PRUEBA)) {
    const k = `${txt(f.brief_id)}|${txt(f.familia)}`
    const p = ultimo.get(k)
    if (!p || (iso(f.creado_en) || "") > (iso(p.creado_en) || "")) ultimo.set(k, f)
  }
  for (const f of ultimo.values()) {
    const cuando = iso(f.cerrado_en) || iso(f.creado_en)
    if (!cuando || new Date(cuando).getTime() < corte) continue
    const motivos: string[] = []
    if (ESTADOS_MALOS[txt(f.estado)]) motivos.push(ESTADOS_MALOS[txt(f.estado)])
    if (f.con_desacuerdo === true) motivos.push("la revisión de la jefatura quedó con desacuerdos abiertos")
    if (!motivos.length) continue
    out.push({
      clave: `oficina:${txt(f.id)}`, fuente: "oficina", titulo: tituloDePieza({ familia: f.familia, creada: iso(f.creado_en) || cuando }),
      detalle: `${motivos.join(" y ")} (gastó ${usdES(Number(f.gasto_usd) || 0)} de ${usdES(Number(f.tope_usd) || 0)})`,
      repeticiones: 1, desde: iso(f.creado_en) || cuando, ultima_en: cuando, cerrada: false, encargo_id: txt(f.id),
      acciones: [{ texto: "Ver la pieza", href: f.hitl_queue_id ? `/piezas?id=${txt(f.hitl_queue_id)}&estado=todas` : "/mapa" }],
    })
  }
  return out
}

/** cruza con las marcas «ya lo vi» (clave → instante) y ordena: nuevas primero, luego vistas; dentro de cada grupo, la más reciente arriba */
export function cruzarVistas(altas: AlertaCruda[], vistas: Record<string, string>): { nuevas: Alerta[]; vistas: Alerta[] } {
  const todas: Alerta[] = altas.map((a) => ({ ...a, vista_en: vistas[a.clave] ?? null }))
  const esNueva = (a: Alerta) => !a.vista_en || new Date(a.ultima_en).getTime() > new Date(a.vista_en).getTime()
  const porFecha = (a: Alerta, b: Alerta) => new Date(b.ultima_en).getTime() - new Date(a.ultima_en).getTime()
  return { nuevas: todas.filter(esNueva).sort(porFecha), vistas: todas.filter((a) => !esNueva(a)).sort(porFecha) }
}

/** una clave de alerta válida para marcar: una de las tres fuentes, sin espacios raros, de largo razonable */
export const claveValida = (c: unknown): c is string => typeof c === "string" && c.length <= 200 && /^(cerebro|costo|oficina):[\w.\-:/ ]+$/.test(c)
