/**
 * LAS OFICINAS · lectura (servidor, solo lectura): una tarjeta por oficina con su interruptor real, lo de los últimos 7 días y lo que espera de Emilio.
 * Cada oficina se lee por separado: si una lectura falla, esa tarjeta lo dice y las demás siguen.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { DIAS_DE_LA_VENTANA, agrupar, desde, haceCuanto, semaforoDelInterruptor, suma, tarjetaConError, usd, type Dato, type TarjetaDeOficina } from "@/lib/oficinas"

type Fila = Record<string, unknown>

/** una lectura de filas; un error de la base se vuelve excepción (nunca «0 filas» por error) */
async function filas(q: PromiseLike<{ data: unknown; error: { message: string } | null }>, que: string): Promise<Fila[]> {
  const r = await q
  if (r.error) throw new Error(`${que}: ${r.error.message}`)
  return (r.data ?? []) as Fila[]
}
async function una(q: PromiseLike<{ data: unknown; error: { message: string } | null }>, que: string): Promise<Fila | null> {
  const r = await q
  if (r.error) throw new Error(`${que}: ${r.error.message}`)
  return (r.data ?? null) as Fila | null
}
async function contar(q: PromiseLike<{ count: number | null; error: { message: string } | null }>, que: string): Promise<number> {
  const r = await q
  if (r.error) throw new Error(`${que}: ${r.error.message}`)
  return r.count ?? 0
}
const maxFecha = (f: Fila[], col: string): string | null => f.map((x) => String(x[col] ?? "")).filter(Boolean).sort().pop() ?? null
const lista = (v: unknown): string => (Array.isArray(v) && v.length > 0 ? v.join(", ") : "ninguna")
const resumenDeEstados = (m: Record<string, number>): string => (Object.keys(m).length === 0 ? "ninguno" : Object.entries(m).map(([k, n]) => `${n} ${k.replace(/_/g, " ")}`).join(" · "))

const QUE_HACE = {
  creativa: "Hace las piezas: carruseles, historias, publicaciones; con la mesa de especialistas.",
  financiera: "Arma el tablero financiero del cliente y le pregunta al dueño lo que falta.",
  jefatura: "Revisa cada pieza y cada plan antes de que llegue a Emilio.",
  cerebro: "Guarda lo que se sabe de cada cliente; el portero lo vigila y lo entrega a quien lo pide.",
  planeacion: "Arma el plan y el calendario de cada campaña.",
} as const

export async function leerCreativa(supa: SupabaseClient, ahora: Date): Promise<TarjetaDeOficina> {
  const cfg = await una(supa.from("oficina_config").select("estado, familias_activas, clientes_ensayo").eq("id", 1).maybeSingle(), "oficina_config")
  const enc = await filas(supa.from("oficina_encargos").select("estado, gasto_usd, dry_run, familia, brief_id, version_encargo, creado_en").gte("creado_en", desde(DIAS_DE_LA_VENTANA, ahora)).order("creado_en", { ascending: false }).limit(300), "oficina_encargos")
  const reales = enc.filter((e) => e.dry_run !== true)
  const pendientes = await contar(supa.from("hitl_queue").select("*", { count: "exact", head: true }).eq("status", "pending").eq("type", "content_piece_review"), "hitl_queue")
  const fallo = await filas(supa.from("oficina_turnos").select("paso, agente, error, fin").eq("estado", "fallo").order("fin", { ascending: false }).limit(1), "oficina_turnos")
  const por = agrupar(reales, "estado")
  const fallidos = por.fallido ?? 0
  const hechos = Object.entries(por).filter(([k]) => k.startsWith("cerrado")).reduce((a, [, n]) => a + n, 0)
  const enCurso = reales.length - hechos - fallidos
  const sw = semaforoDelInterruptor(cfg?.estado as string, cfg?.clientes_ensayo)
  const datos: Dato[] = [
    { etiqueta: "Piezas entregadas (7 días)", valor: String(hechos) },
    { etiqueta: "Fallidas (7 días)", valor: String(fallidos), alerta: fallidos > 0 },
    { etiqueta: "En curso ahora", valor: String(enCurso) },
    { etiqueta: "Gasto real (7 días)", valor: usd(suma(reales, "gasto_usd")) },
  ]
  const detalle = [`Familias activas: ${lista(cfg?.familias_activas)}`]
  const t = fallo[0]
  if (t) detalle.push(`Último turno fallido (${haceCuanto(String(t.fin ?? ""), ahora)}): ${String(t.paso)} · ${String(t.error ?? "").slice(0, 180)}`)
  const ult = reales.slice(0, 4).map((e) => `${e.brief_id ?? "—"} v${e.version_encargo ?? 1} · ${e.familia} · ${String(e.estado).replace(/_/g, " ")} · ${usd(Number(e.gasto_usd))}`)
  if (ult.length) detalle.push(...ult.map((x) => `· ${x}`))
  return {
    clave: "creativa", nombre: "Oficina creativa", que_hace: QUE_HACE.creativa, semaforo: sw.semaforo, estado_texto: sw.texto, datos,
    ultima_actividad: maxFecha(enc, "creado_en"), espera: pendientes > 0 ? [`${pendientes} pieza${pendientes === 1 ? "" : "s"} por aprobar`] : [], detalle,
    enlace: { href: "/piezas", texto: "Abrir piezas" },
  }
}

export async function leerFinanciera(supa: SupabaseClient, ahora: Date): Promise<TarjetaDeOficina> {
  const cfg = await una(supa.from("finanzas_config").select("estado, conversa, preguntas_slack, clientes_ensayo").eq("id", 1).maybeSingle(), "finanzas_config")
  const enc = await filas(supa.from("finanzas_encargos").select("estado, gasto_usd, dry_run, creado_en, actualizado_en").gte("creado_en", desde(DIAS_DE_LA_VENTANA, ahora)).order("creado_en", { ascending: false }).limit(200), "finanzas_encargos")
  const abiertas = await contar(supa.from("finanzas_preguntas").select("*", { count: "exact", head: true }).is("respondida_en", null), "finanzas_preguntas")
  const tableros = await filas(supa.from("finanzas_tableros").select("estado, vigente, creado_en").eq("vigente", true).order("creado_en", { ascending: false }).limit(5), "finanzas_tableros")
  const reales = enc.filter((e) => e.dry_run !== true)
  const sw = semaforoDelInterruptor(cfg?.estado as string, cfg?.clientes_ensayo)
  return {
    clave: "financiera", nombre: "Oficina financiera", que_hace: QUE_HACE.financiera, semaforo: sw.semaforo, estado_texto: sw.texto,
    datos: [
      { etiqueta: "Encargos (7 días)", valor: resumenDeEstados(agrupar(reales, "estado")) },
      { etiqueta: "Gasto real (7 días)", valor: usd(suma(reales, "gasto_usd")) },
      { etiqueta: "Conversa con el dueño", valor: String(cfg?.conversa ?? "—") },
      { etiqueta: "Preguntas por Slack", valor: String(cfg?.preguntas_slack ?? "—") },
    ],
    ultima_actividad: maxFecha(enc, "actualizado_en") ?? maxFecha(enc, "creado_en"),
    espera: abiertas > 0 ? [`${abiertas} pregunta${abiertas === 1 ? "" : "s"} al dueño sin responder`] : [],
    detalle: [tableros.length ? `Tableros vigentes: ${tableros.map((t) => String(t.estado)).join(", ")}` : "Sin tablero vigente"],
  }
}

export async function leerJefatura(supa: SupabaseClient, ahora: Date): Promise<TarjetaDeOficina> {
  const cfg = await una(supa.from("jefatura_config").select("estado, tipos_activos, clientes_ensayo").eq("id", 1).maybeSingle(), "jefatura_config")
  const rev = await filas(supa.from("jefatura_revisiones").select("estado, resultado, gasto_usd, dry_run, creado_en").gte("creado_en", desde(DIAS_DE_LA_VENTANA, ahora)).order("creado_en", { ascending: false }).limit(300), "jefatura_revisiones")
  const reales = rev.filter((r) => r.dry_run !== true)
  const por = agrupar(reales, "resultado")
  const incompletas = por.incompleta_por_tope ?? 0
  const fallidas = por.fallida ?? 0
  const sw = semaforoDelInterruptor(cfg?.estado as string, cfg?.clientes_ensayo)
  return {
    clave: "jefatura", nombre: "Jefatura (revisión)", que_hace: QUE_HACE.jefatura, semaforo: sw.semaforo, estado_texto: sw.texto,
    datos: [
      { etiqueta: "Revisiones (7 días)", valor: String(reales.length) },
      { etiqueta: "Resultado", valor: resumenDeEstados(por) },
      { etiqueta: "Cortadas por tope", valor: String(incompletas), alerta: incompletas > 0 },
      { etiqueta: "Gasto (7 días)", valor: usd(suma(reales, "gasto_usd")) },
    ],
    ultima_actividad: maxFecha(rev, "creado_en"),
    espera: [],
    detalle: [`Revisa: ${lista(cfg?.tipos_activos)}`, ...(fallidas > 0 ? [`${fallidas} revisión${fallidas === 1 ? "" : "es"} fallida${fallidas === 1 ? "" : "s"} en 7 días`] : [])],
  }
}

export async function leerCerebro(supa: SupabaseClient, ahora: Date): Promise<TarjetaDeOficina> {
  const trozos = await contar(supa.from("client_brain_chunks").select("*", { count: "exact", head: true }), "client_brain_chunks")
  const fichas = await contar(supa.from("cerebro_fichas").select("*", { count: "exact", head: true }).is("retirada_en", null), "cerebro_fichas")
  const corridas = await filas(supa.from("cerebro_portero_corridas").select("estado, gasto_apify_usd, gasto_modelo_usd, creado_en, prueba").gte("creado_en", desde(DIAS_DE_LA_VENTANA, ahora)).order("creado_en", { ascending: false }).limit(200), "cerebro_portero_corridas")
  const pedidos = await filas(supa.from("cerebro_pedidos").select("estado, costo_usd, creado_en").gte("creado_en", desde(DIAS_DE_LA_VENTANA, ahora)).limit(200), "cerebro_pedidos")
  const pausas = await filas(supa.from("cerebro_portero_pausas").select("motivo, desde").is("levantada_en", null).limit(20), "cerebro_portero_pausas")
  const alertas = await filas(supa.from("cerebro_alertas").select("titulo, repeticiones").is("cerrado_en", null).limit(20), "cerebro_alertas")
  const reales = corridas.filter((c) => c.prueba !== true)
  const ultima = maxFecha(corridas, "creado_en")
  const viejo = ultima ? ahora.getTime() - new Date(ultima).getTime() > 48 * 3_600_000 : true
  const espera = [
    ...pausas.map((p) => `Portero en pausa: ${String(p.motivo).slice(0, 120)}`),
    ...alertas.map((a) => `Alarma abierta: ${String(a.titulo).slice(0, 100)}${Number(a.repeticiones) > 1 ? ` (×${a.repeticiones})` : ""}`),
  ]
  const semaforo = pausas.length > 0 ? "rojo" : alertas.length > 0 || viejo ? "ambar" : "verde"
  return {
    clave: "cerebro", nombre: "Cerebro y portero", que_hace: QUE_HACE.cerebro, semaforo,
    estado_texto: pausas.length > 0 ? "Portero en pausa" : viejo ? "El portero no corre hace más de 2 días" : "Al día",
    datos: [
      { etiqueta: "Trozos de conocimiento", valor: String(trozos) },
      { etiqueta: "Fichas vigentes", valor: String(fichas) },
      { etiqueta: "Pasadas del portero (7 días)", valor: resumenDeEstados(agrupar(reales, "estado")) },
      { etiqueta: "Gasto del portero (7 días)", valor: usd(suma(reales, "gasto_apify_usd") + suma(reales, "gasto_modelo_usd")) },
      { etiqueta: "Pedidos de las oficinas (7 días)", valor: String(pedidos.length) },
    ],
    ultima_actividad: ultima, espera, detalle: [],
  }
}

export async function leerPlaneacion(supa: SupabaseClient, ahora: Date): Promise<TarjetaDeOficina> {
  const cfg = await filas(supa.from("cadena_config").select("clave, valor").in("clave", ["estado_cadena", "clientes_ensayo"]), "cadena_config")
  const valor = (k: string) => cfg.find((c) => c.clave === k)?.valor
  const campanas = await filas(supa.from("cadena_campanas").select("estado, seco").limit(200), "cadena_campanas")
  const corridas = await filas(supa.from("cadena_corridas").select("estado, costo_usd, seco, creada_en").gte("creada_en", desde(DIAS_DE_LA_VENTANA, ahora)).order("creada_en", { ascending: false }).limit(300), "cadena_corridas")
  const esperas = await filas(supa.from("cadena_esperas").select("estado, motivo, vence_en, seco").eq("estado", "viva").limit(50), "cadena_esperas")
  const reales = corridas.filter((c) => c.seco !== true)
  const por = agrupar(reales, "estado")
  const vencidas = por.vencida ?? 0
  const vivas = esperas.filter((e) => e.seco !== true).length
  const sw = semaforoDelInterruptor(valor("estado_cadena") as string, valor("clientes_ensayo"))
  return {
    clave: "planeacion", nombre: "Planeación", que_hace: QUE_HACE.planeacion, semaforo: vencidas > 0 && sw.semaforo === "verde" ? "ambar" : sw.semaforo, estado_texto: sw.texto,
    datos: [
      { etiqueta: "Campañas", valor: resumenDeEstados(agrupar(campanas.filter((c) => c.seco !== true), "estado")) },
      { etiqueta: "Pasos (7 días)", valor: resumenDeEstados(por) },
      { etiqueta: "Vencidos", valor: String(vencidas), alerta: vencidas > 0 },
      { etiqueta: "Gasto (7 días)", valor: usd(suma(reales, "costo_usd")) },
    ],
    ultima_actividad: maxFecha(corridas, "creada_en"),
    espera: vivas > 0 ? [`${vivas} espera${vivas === 1 ? "" : "s"} con plazo corriendo`] : [],
    detalle: [],
  }
}

const LECTORES: Array<{ clave: TarjetaDeOficina["clave"]; nombre: string; leer: (s: SupabaseClient, a: Date) => Promise<TarjetaDeOficina> }> = [
  { clave: "creativa", nombre: "Oficina creativa", leer: leerCreativa },
  { clave: "financiera", nombre: "Oficina financiera", leer: leerFinanciera },
  { clave: "jefatura", nombre: "Jefatura (revisión)", leer: leerJefatura },
  { clave: "cerebro", nombre: "Cerebro y portero", leer: leerCerebro },
  { clave: "planeacion", nombre: "Planeación", leer: leerPlaneacion },
]

/** las cinco tarjetas; cada una se lee aparte: una que falla se muestra como «No pude leerla» con la causa */
export async function leerOficinas(supa: SupabaseClient, ahora: Date = new Date()): Promise<TarjetaDeOficina[]> {
  return Promise.all(LECTORES.map(async (l) => {
    try { return await l.leer(supa, ahora) } catch (e) { return tarjetaConError(l.clave, l.nombre, QUE_HACE[l.clave], e instanceof Error ? e.message : String(e)) }
  }))
}
