/**
 * LAS OFICINAS · frases (lógica PURA): convierte lo que dice la base en frases para Emilio. Sin códigos internos, sin valores crudos.
 * Criterios de semáforo (míos, declarados): ámbar = hay algo real que mirar (una pieza que falló y no se rehízo, una revisión cortada, una espera que vence); rojo = una lectura falló o el portero está en pausa.
 */
import { diaCorto, familiaLegible, plural, resultadoDeJefaturaLegible, usdES } from "@/lib/lenguaje"
import { haceCuanto, type Semaforo } from "@/lib/oficinas"

type Fila = Record<string, unknown>

/** una pieza en curso más vieja que esto ya no «está en curso»: quedó a medias */
export const HORAS_PARA_DAR_POR_A_MEDIAS = 6

export interface ResumenDeEncargos { entregadas: number; fallidas: Fila[]; en_curso: number; a_medias: Fila[]; gasto: number; ultima: string | null }

/**
 * Cuenta los encargos REALES (sin ensayos). Un encargo que fue reemplazado por otro más nuevo del mismo brief y la misma familia ya no cuenta como estado final:
 * si se rehízo, el intento viejo no es «un fallo» ni «en paso».
 */
export function resumirEncargos(todos: Fila[], ahora: Date): ResumenDeEncargos {
  const reales = todos.filter((e) => e.dry_run !== true)
  const ultimoPorClave = new Map<string, Fila>()
  for (const e of reales) {
    const k = `${e.brief_id}|${e.familia}`
    const prev = ultimoPorClave.get(k)
    if (!prev || String(e.creado_en) > String(prev.creado_en)) ultimoPorClave.set(k, e)
  }
  const finales = [...ultimoPorClave.values()]
  const hechos = (e: Fila) => String(e.estado).startsWith("cerrado")
  const fallido = (e: Fila) => e.estado === "fallido"
  const viejo = (e: Fila) => ahora.getTime() - new Date(String(e.creado_en)).getTime() > HORAS_PARA_DAR_POR_A_MEDIAS * 3_600_000
  const abiertos = finales.filter((e) => !hechos(e) && !fallido(e))
  let gasto = 0
  for (const e of reales) { const g = Number(e.gasto_usd); if (Number.isFinite(g)) gasto += g }
  return {
    entregadas: finales.filter(hechos).length,
    fallidas: finales.filter(fallido),
    en_curso: abiertos.filter((e) => !viejo(e)).length,
    a_medias: abiertos.filter(viejo),
    gasto: Math.round(gasto * 1e6) / 1e6,
    ultima: reales.map((e) => String(e.creado_en)).sort().pop() ?? null,
  }
}

export function frasesDeLaCreativa(r: ResumenDeEncargos, porAprobar: number): { semaforoExtra: Semaforo | null; hizo: string[]; espera: string[] } {
  const hizo: string[] = []
  hizo.push(r.entregadas > 0 ? `Entregó ${plural(r.entregadas, "pieza", "piezas")} en 7 días` : "No entregó piezas en 7 días")
  if (r.en_curso > 0) hizo.push(`Trabaja ahora en ${plural(r.en_curso, "pieza", "piezas")}`)
  for (const f of r.fallidas) hizo.push(`Una pieza falló y no se rehízo: ${familiaLegible(f.familia).toLowerCase()} del ${diaCorto(String(f.creado_en))}`)
  for (const m of r.a_medias) hizo.push(`Una pieza quedó a medias desde el ${diaCorto(String(m.creado_en))}`)
  hizo.push(`Gastó ${usdES(r.gasto)} en 7 días`)
  return {
    semaforoExtra: r.fallidas.length + r.a_medias.length > 0 ? "ambar" : null,
    hizo,
    espera: porAprobar > 0 ? [`${plural(porAprobar, "pieza", "piezas")} por aprobar`] : [],
  }
}

export function fraseDeEstadoDeLaCreativa(base: string, r: ResumenDeEncargos): string {
  const problemas = r.fallidas.length + r.a_medias.length
  return problemas > 0 ? `${base} · ${plural(problemas, "pieza con problema", "piezas con problema")}` : base
}

/** estados de los tableros financieros */
export function tableroLegible(estado: unknown): string {
  switch (String(estado ?? "")) {
    case "firmado": return "firmado"
    case "sin_firma": return "sin firmar"
    case "borrador": return "en borrador"
    default: return "en revisión"
  }
}

export function frasesDeLaFinanciera(p: { encargos: Fila[]; gasto: number; tableros: Fila[]; conversa: unknown; preguntasSlack: unknown; abiertas: number }): { hizo: string[]; espera: string[] } {
  const hizo: string[] = []
  const hechos = p.encargos.filter((e) => String(e.estado).startsWith("cerrado") || e.estado === "hecho" || e.estado === "terminado").length
  hizo.push(p.encargos.length === 0 ? "No hizo encargos en 7 días" : `Trabajó en ${plural(p.encargos.length, "encargo", "encargos")} en 7 días (${plural(hechos, "terminado", "terminados")})`)
  if (p.tableros.length > 0) {
    const firmados = p.tableros.filter((t) => t.estado === "firmado").length
    const sin = p.tableros.length - firmados
    hizo.push(`Tablero vigente: ${[firmados > 0 ? plural(firmados, "firmado", "firmados") : "", sin > 0 ? plural(sin, "sin firmar", "sin firmar") : ""].filter(Boolean).join(" y ")}`)
  } else hizo.push("Todavía no hay un tablero financiero vigente")
  const activo = (v: unknown) => /^(enciende|encendida|envia|envía|si|sí|activa|activada)$/i.test(String(v ?? ""))
  hizo.push(activo(p.conversa) ? "Puede conversar con el dueño del negocio" : "No conversa con el dueño del negocio")
  hizo.push(activo(p.preguntasSlack) ? "Sus preguntas salen por Slack" : "Sus preguntas no salen por Slack")
  if (p.gasto > 0) hizo.push(`Gastó ${usdES(p.gasto)} en 7 días`)
  return { hizo, espera: p.abiertas > 0 ? [`${plural(p.abiertas, "pregunta al dueño sin responder", "preguntas al dueño sin responder")}`] : [] }
}

export function frasesDeLaJefatura(p: { revisiones: Fila[]; gasto: number; tipos: unknown }): { hizo: string[]; ambar: boolean; estadoExtra: string | null } {
  const n = p.revisiones.length
  const hizo: string[] = []
  if (n === 0) hizo.push("No revisó nada en 7 días")
  else {
    const por = new Map<string, number>()
    for (const r of p.revisiones) por.set(String(r.resultado), (por.get(String(r.resultado)) ?? 0) + 1)
    hizo.push(`Revisó ${plural(n, "trabajo", "trabajos")} en 7 días`)
    for (const [k, c] of por) hizo.push(`${c} ${resultadoDeJefaturaLegible(k)}`)
  }
  const tipos = Array.isArray(p.tipos) ? p.tipos.map(String) : []
  const que = [tipos.includes("pieza") ? "piezas" : "", tipos.includes("plan") ? "planes" : ""].filter(Boolean).join(" y ")
  if (que) hizo.push(`Revisa ${que} antes de que lleguen a Emilio`)
  if (p.gasto > 0) hizo.push(`Gastó ${usdES(p.gasto)} en 7 días`)
  const cortadas = p.revisiones.filter((r) => r.resultado === "incompleta_por_tope").length
  return { hizo, ambar: cortadas > 0, estadoExtra: cortadas > 0 ? `${plural(cortadas, "revisión cortada", "revisiones cortadas")} por límite de gasto` : null }
}

/** una fecha de «hace cuánto» para la última actividad */
export const ultimaActividadLegible = (iso: string | null, ahora: Date): string => haceCuanto(iso, ahora)
