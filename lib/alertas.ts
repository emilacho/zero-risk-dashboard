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
}
export type AlertaCruda = Omit<Alerta, "vista_en">

type Fila = Record<string, unknown>
const txt = (v: unknown): string => (v == null ? "" : String(v))
const iso = (v: unknown): string => { const t = new Date(txt(v)).getTime(); return Number.isFinite(t) ? new Date(t).toISOString() : "" }

export function deCerebro(filas: Fila[]): AlertaCruda[] {
  return filas.filter((f) => iso(f.ultima_en)).map((f) => ({
    clave: `cerebro:${txt(f.clave)}`, fuente: "cerebro" as const, titulo: txt(f.titulo) || txt(f.clave), detalle: txt(f.ultimo_detalle),
    repeticiones: Math.max(1, Number(f.repeticiones) || 1), desde: iso(f.abierto_en) || iso(f.ultima_en), ultima_en: iso(f.ultima_en), cerrada: !!f.cerrado_en,
  }))
}

export function deCostos(filas: Fila[]): AlertaCruda[] {
  return filas.filter((f) => iso(f.last_fired_at)).map((f) => {
    const valor = Number(f.last_value_usd), techo = Number(f.threshold_usd)
    const cifras = Number.isFinite(valor) && Number.isFinite(techo) ? `llegó a ${usdES(valor)} con un techo de ${usdES(techo)}` : "se disparó"
    return { clave: `costo:${txt(f.threshold_key)}`, fuente: "costo" as const, titulo: "Se llegó a un tope de costo", detalle: cifras, repeticiones: 1, desde: iso(f.last_fired_at), ultima_en: iso(f.last_fired_at), cerrada: false }
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
      repeticiones: 1, desde: iso(f.creado_en) || cuando, ultima_en: cuando, cerrada: false,
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
