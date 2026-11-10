/**
 * CENTRO DE CAMPAÑA · ESTADO Y CANTIDAD EN CADA TARJETA (boceto aprobado por Emilio 09-nov 15:15Z · GO de Lenovo, reasignado a CC2).
 * Cada tarjeta dice, con datos reales: su ESTADO en una o dos palabras (con su punto: oro = listo o vivo · alarma = detenido · gris = en espera),
 * una CANTIDAD en un recuadro y una línea corta (cuándo se actualizó o qué espera). Función pura: la pantalla solo la pinta.
 * Lo que una lectura no trae (o no pudo leer) se muestra «—»: nunca un cero inventado.
 * Brief · Gran idea · Calendario siguen el estado de la campaña (`cadena_campanas`): el primer paso que falta es el que está en curso (o DETENIDO si la
 * campaña espera que la destraben); los que vienen después esperan al anterior.
 */
import type { ClaveDeAplicacion } from "@/lib/aplicaciones-marketing"
import type { Centro } from "@/lib/centro-datos"
import type { Pizarron } from "@/lib/pizarron-datos"
import { conteoDePublicaciones, textoDePublicaciones } from "@/lib/pizarron"

export type TonoDeEstado = "oro" | "alarma" | "gris"
export interface TarjetaDelCentro { estado: string; tono: TonoDeEstado; cantidad: string; linea: string }

export const SIN_DATO = "—"
const ZONA = "America/Guayaquil"

/** «03-nov» (día y mes en Ecuador) · null si la fecha no se puede leer */
export function diaCorto(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)
  if (Number.isNaN(d.getTime())) return null
  const p = new Intl.DateTimeFormat("es-EC", { timeZone: ZONA, day: "2-digit", month: "short" }).formatToParts(d)
  const dia = p.find((x) => x.type === "day")?.value ?? ""
  const mes = (p.find((x) => x.type === "month")?.value ?? "").replace(".", "").toLowerCase()
  return `${dia}-${mes}`
}
const act = (iso: string | null | undefined): string => { const d = diaCorto(iso); return d ? `Act. ${d}` : "Sin fecha" }
const usd = (n: number): string => `US$ ${n.toLocaleString("es-EC", { maximumFractionDigits: n < 10 ? 2 : 0 })}`
const sinDato = (linea = "Sin dato"): TarjetaDelCentro => ({ estado: SIN_DATO, tono: "gris", cantidad: SIN_DATO, linea })
const LEYENDO: TarjetaDelCentro = { estado: "Leyendo", tono: "gris", cantidad: SIN_DATO, linea: "Leyendo…" }

/** los pasos de la campaña que siguen a la cadena, en orden */
const PASOS_DE_CAMPANA = ["brief", "gran_idea", "calendario"] as const
type PasoDeCampana = (typeof PASOS_DE_CAMPANA)[number]
const DESPUES_DE: Record<PasoDeCampana, string> = { brief: "Tras la estrategia", gran_idea: "Tras el brief", calendario: "Tras la gran idea" }
const DETENIDA = new Set(["necesita_humano", "pausada"])
const ANTES_DEL_BRIEF = new Set(["abierta", "estrategia"])

/** ¿ese paso de la campaña ya está hecho? (brief validado · gran idea aprobada · calendario con la campaña activa) */
function hecho(p: PasoDeCampana, datos: Pizarron, centro: Centro): boolean {
  if (p === "brief") return /^valid/.test(String(centro.brief.estado ?? ""))
  if (p === "gran_idea") return centro.gran_idea.estado === "aprobada"
  return datos.campana?.estado === "activa" && datos.filas.length > 0
}
function cantidadDelPaso(p: PasoDeCampana, datos: Pizarron, centro: Centro): string {
  if (p === "calendario") return String(conteoDePublicaciones(datos.filas).publicaciones) // las filas en esquema no son publicaciones (GO Lenovo 20:30Z)
  const v = p === "brief" ? centro.brief.versiones : centro.gran_idea.versiones
  return v == null ? SIN_DATO : String(v)
}
function fechaDelPaso(p: PasoDeCampana, centro: Centro): string | null { return p === "brief" ? centro.brief.fecha ?? null : p === "gran_idea" ? centro.gran_idea.fecha ?? null : null }

function tarjetaDelPaso(p: PasoDeCampana, datos: Pizarron, centro: Centro): TarjetaDelCentro {
  const c = datos.campana
  if (!c) return { estado: "Sin campaña", tono: "gris", cantidad: "0", linea: "Sin campaña todavía" }
  if (c.estado === "cerrada" || c.estado === "reemplazada") return { estado: c.estado === "cerrada" ? "Cerrada" : "Reemplazada", tono: "gris", cantidad: cantidadDelPaso(p, datos, centro), linea: "La campaña ya no corre" }
  if (p !== "calendario" && !(p === "brief" ? centro.brief.publicado : centro.gran_idea.publicado)) return sinDato()
  const cantidad = cantidadDelPaso(p, datos, centro)
  if (hecho(p, datos, centro)) return { estado: p === "gran_idea" ? "Aprobada" : p === "calendario" ? "Armado" : "Listo", tono: "oro", cantidad, linea: p === "calendario" ? textoDePublicaciones(conteoDePublicaciones(datos.filas)) ?? "0 publicaciones" : act(fechaDelPaso(p, centro)) }
  const i = PASOS_DE_CAMPANA.indexOf(p)
  const primeroQueFalta = PASOS_DE_CAMPANA.find((x) => !hecho(x, datos, centro))
  // un paso después del que falta espera al anterior, aunque la campaña esté detenida
  if (primeroQueFalta && PASOS_DE_CAMPANA.indexOf(primeroQueFalta) < i) return { estado: "En espera", tono: "gris", cantidad, linea: DESPUES_DE[p] }
  if (DETENIDA.has(c.estado)) return { estado: c.estado === "pausada" ? "En pausa" : "Detenido", tono: "alarma", cantidad, linea: c.estado === "pausada" ? "La campaña está en pausa" : "Espera arreglo" }
  if (p === "brief" && ANTES_DEL_BRIEF.has(c.estado) && !centro.brief.versiones) return { estado: "En espera", tono: "gris", cantidad, linea: DESPUES_DE.brief }
  if (p === "gran_idea" && centro.gran_idea.estado === "pendiente") return { estado: "Por aprobar", tono: "oro", cantidad, linea: "Espera tu decisión" }
  if (p === "gran_idea" && centro.gran_idea.estado === "con_cambios") return { estado: "En la mesa", tono: "oro", cantidad, linea: "Rehace con tus cambios" }
  if (p === "calendario") return { estado: "En curso", tono: "oro", cantidad, linea: datos.filas.length ? "Se arma por tandas" : "Empieza la primera tanda" }
  return { estado: "En la mesa", tono: "oro", cantidad, linea: p === "brief" ? "La mesa del brief escribe" : "La sala creativa propone" }
}

/** la tarjeta de un cuadro del Centro. `cargando` = la primera lectura todavía no llega */
export function tarjetaDelCentro(clave: ClaveDeAplicacion, datos: Pizarron | null, centro: Centro | null, cargando = false): TarjetaDelCentro {
  if (cargando && !datos) return LEYENDO
  if (clave === "piezas") {
    if (!datos) return sinDato()
    if (!datos.campana) return { estado: "Sin piezas", tono: "gris", cantidad: "0", linea: "Sin campaña todavía" }
    if (datos.campana.del_plan_anterior) return { estado: "Sin piezas", tono: "gris", cantidad: "0", linea: "Nada por aprobar del plan vigente" }
    const n = datos.totales.emilio ?? 0
    if (n) return { estado: "Por aprobar", tono: "oro", cantidad: String(n), linea: n === 1 ? "Espera tu aprobación" : "Esperan tu aprobación" }
    return { estado: datos.filas.length ? "Al día" : "Sin piezas", tono: datos.filas.length ? "oro" : "gris", cantidad: "0", linea: "Nada por aprobar" }
  }
  if (!centro) return cargando ? LEYENDO : sinDato()
  switch (clave) {
    case "manual": {
      const m = centro.manual
      if (!m) return sinDato()
      if (!m.total) return { estado: "Sin manual", tono: "gris", cantidad: "0", linea: "Todavía no hay manual" }
      return m.aprobado ? { estado: "Aprobado", tono: "oro", cantidad: String(m.total), linea: act(m.fecha) } : { estado: "Por aprobar", tono: "gris", cantidad: String(m.total), linea: "Espera tu aprobación" }
    }
    case "informes": {
      const x = centro.informes
      if (!x.total) return { estado: "Sin informes", tono: "gris", cantidad: "0", linea: "Todavía no hay informes" }
      if (x.esperan) return { estado: "Por revisar", tono: "oro", cantidad: String(x.total), linea: x.esperan === 1 ? "1 espera tu revisión" : `${x.esperan} esperan tu revisión` }
      return { estado: "Al día", tono: "oro", cantidad: String(x.total), linea: act(x.ultimo) }
    }
    case "plan": {
      if (centro.plan === undefined) return sinDato()
      if (centro.plan === null) return { estado: "Sin plan", tono: "gris", cantidad: "0", linea: "Todavía no hay plan" }
      // el plan no se firma antes del manual (firma de Emilio 03-nov)
      // 09-nov 18:10Z (Emilio): el recuadro dice la CANTIDAD (el plan vigente = 1), nunca la versión · la versión va a la derecha de la fecha: «Act. 06-nov · v2»
      const v = ` · v${centro.plan.version}`
      if (datos?.manual_aprobado === false) return { estado: "En espera", tono: "gris", cantidad: "1", linea: `Espera el manual${v}` }
      return centro.plan.estado === "approved"
        ? { estado: "Aprobado", tono: "oro", cantidad: "1", linea: `${act(centro.plan.fecha)}${v}` }
        : { estado: "Por aprobar", tono: "gris", cantidad: "1", linea: `${act(centro.plan.fecha)}${v}` }
    }
    case "brief": case "gran_idea": case "calendario":
      return datos ? tarjetaDelPaso(clave, datos, centro) : sinDato()
    case "equipo": {
      const a = centro.equipo.agentes
      const t = centro.equipo.trabajando
      return { estado: t ? "Activos" : "Sin tareas", tono: t ? "oro" : "gris", cantidad: a == null ? SIN_DATO : String(a), linea: t ? `${t} trabajando` : "Nadie trabaja ahora" }
    }
    case "gasto": {
      const d = centro.dinero
      if (!d || d.gastado_24h_usd == null) return sinDato()
      const tope = d.techo_usd
      const enElTope = tope != null && tope > 0 && d.gastado_24h_usd >= tope
      return { estado: enElTope ? "En el tope" : "Gastado 24 h", tono: enElTope ? "alarma" : "gris", cantidad: usd(d.gastado_24h_usd), linea: tope != null ? `Tope ${usd(tope)}/día` : "Sin tope" }
    }
  }
}
