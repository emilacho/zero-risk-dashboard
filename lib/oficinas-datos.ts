/**
 * LAS OFICINAS · lectura (servidor, solo lectura): una tarjeta por oficina con su estado en una frase, lo que hizo y lo que necesita de Emilio.
 * Cada oficina se lee por separado: si una lectura falla, esa tarjeta lo dice y las demás siguen. Nada crudo: la traducción vive en `oficinas-frases.ts` y `lenguaje.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { DIAS_DE_LA_VENTANA, desde, semaforoDelInterruptor, suma, tarjetaConError, usd, type Dato, type Semaforo, type TarjetaDeOficina } from "@/lib/oficinas"
import { frasesDeLaCreativa, frasesDeLaFinanciera, frasesDeLaJefatura, fraseDeEstadoDeLaCreativa, resumirEncargos } from "@/lib/oficinas-frases"
import { contarPiezasPorAprobar } from "@/lib/piezas-datos"
import { estadoDeCampanaLegible, plural } from "@/lib/lenguaje"

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
/** la peor de dos luces: rojo > ámbar > verde > gris */
const peor = (a: Semaforo, b: Semaforo | null): Semaforo => {
  const orden: Semaforo[] = ["rojo", "ambar", "verde", "gris"]
  return b === null ? a : orden[Math.min(orden.indexOf(a), orden.indexOf(b))]
}

const QUE_HACE = {
  creativa: "Hace las piezas: carruseles, historias y publicaciones, con la mesa de especialistas.",
  financiera: "Arma el tablero financiero del cliente y le pregunta al dueño lo que falta.",
  jefatura: "Revisa cada pieza y cada plan antes de que lleguen a Emilio.",
  cerebro: "Guarda lo que se sabe de cada cliente; el portero lo vigila y lo entrega a quien lo pide.",
  planeacion: "Arma el plan y el calendario de cada campaña.",
} as const

export async function leerCreativa(supa: SupabaseClient, ahora: Date): Promise<TarjetaDeOficina> {
  const cfg = await una(supa.from("oficina_config").select("estado, clientes_ensayo").eq("id", 1).maybeSingle(), "oficina_config")
  const enc = await filas(supa.from("oficina_encargos").select("estado, gasto_usd, dry_run, familia, brief_id, creado_en").gte("creado_en", desde(DIAS_DE_LA_VENTANA, ahora)).order("creado_en", { ascending: false }).limit(500), "oficina_encargos")
  const porAprobar = await contarPiezasPorAprobar(supa)
  const r = resumirEncargos(enc, ahora)
  const f = frasesDeLaCreativa(r, porAprobar)
  const sw = semaforoDelInterruptor(cfg?.estado as string, cfg?.clientes_ensayo)
  const conProblema = r.fallidas.length + r.a_medias.length
  const datos: Dato[] = [
    { etiqueta: "Piezas entregadas (7 días)", valor: String(r.entregadas) },
    { etiqueta: "Piezas con problema", valor: String(conProblema), alerta: conProblema > 0 },
    { etiqueta: "Gasto (7 días)", valor: usd(r.gasto) },
  ]
  return {
    clave: "creativa", nombre: "Oficina creativa", que_hace: QUE_HACE.creativa, semaforo: peor(sw.semaforo, f.semaforoExtra), estado_texto: fraseDeEstadoDeLaCreativa(sw.texto, r), datos,
    ultima_actividad: r.ultima, espera: f.espera, hizo: f.hizo, enlace: { href: "/piezas", texto: "Abrir piezas" },
  }
}

export async function leerFinanciera(supa: SupabaseClient, ahora: Date): Promise<TarjetaDeOficina> {
  const cfg = await una(supa.from("finanzas_config").select("estado, conversa, preguntas_slack, clientes_ensayo").eq("id", 1).maybeSingle(), "finanzas_config")
  const enc = await filas(supa.from("finanzas_encargos").select("estado, gasto_usd, dry_run, creado_en, actualizado_en").gte("creado_en", desde(DIAS_DE_LA_VENTANA, ahora)).order("creado_en", { ascending: false }).limit(200), "finanzas_encargos")
  const abiertas = await contar(supa.from("finanzas_preguntas").select("*", { count: "exact", head: true }).is("respondida_en", null), "finanzas_preguntas")
  const tableros = await filas(supa.from("finanzas_tableros").select("estado, vigente, creado_en").eq("vigente", true).order("creado_en", { ascending: false }).limit(5), "finanzas_tableros")
  const reales = enc.filter((e) => e.dry_run !== true)
  const gasto = suma(reales, "gasto_usd")
  const sw = semaforoDelInterruptor(cfg?.estado as string, cfg?.clientes_ensayo)
  const f = frasesDeLaFinanciera({ encargos: reales, gasto, tableros, conversa: cfg?.conversa, preguntasSlack: cfg?.preguntas_slack, abiertas })
  return {
    clave: "financiera", nombre: "Oficina financiera", que_hace: QUE_HACE.financiera, semaforo: sw.semaforo, estado_texto: sw.texto,
    datos: [{ etiqueta: "Encargos (7 días)", valor: String(reales.length) }, { etiqueta: "Gasto (7 días)", valor: usd(gasto) }],
    ultima_actividad: maxFecha(enc, "actualizado_en") ?? maxFecha(enc, "creado_en"), espera: f.espera, hizo: f.hizo,
  }
}

export async function leerJefatura(supa: SupabaseClient, ahora: Date): Promise<TarjetaDeOficina> {
  const cfg = await una(supa.from("jefatura_config").select("estado, tipos_activos, clientes_ensayo").eq("id", 1).maybeSingle(), "jefatura_config")
  const rev = await filas(supa.from("jefatura_revisiones").select("estado, resultado, gasto_usd, dry_run, creado_en").gte("creado_en", desde(DIAS_DE_LA_VENTANA, ahora)).order("creado_en", { ascending: false }).limit(300), "jefatura_revisiones")
  const reales = rev.filter((r) => r.dry_run !== true)
  const gasto = suma(reales, "gasto_usd")
  const sw = semaforoDelInterruptor(cfg?.estado as string, cfg?.clientes_ensayo)
  const f = frasesDeLaJefatura({ revisiones: reales, gasto, tipos: cfg?.tipos_activos })
  return {
    clave: "jefatura", nombre: "Jefatura (revisión)", que_hace: QUE_HACE.jefatura, semaforo: peor(sw.semaforo, f.ambar ? "ambar" : null),
    estado_texto: f.estadoExtra ? `${sw.texto} · ${f.estadoExtra}` : sw.texto,
    datos: [{ etiqueta: "Revisiones (7 días)", valor: String(reales.length) }, { etiqueta: "Gasto (7 días)", valor: usd(gasto) }],
    ultima_actividad: maxFecha(rev, "creado_en"), espera: [], hizo: f.hizo,
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
  const hechas = reales.filter((c) => c.estado === "hecha").length
  const gasto = suma(reales, "gasto_apify_usd") + suma(reales, "gasto_modelo_usd")
  const hizo = [
    `Guarda ${plural(fichas, "ficha vigente", "fichas vigentes")} y ${plural(trozos, "trozo de conocimiento", "trozos de conocimiento")}`,
    reales.length === 0 ? "El portero no repasó nada en 7 días" : `El portero repasó ${plural(reales.length, "vez", "veces")} en 7 días (${plural(hechas, "terminada bien", "terminadas bien")})`,
    `Atendió ${plural(pedidos.length, "pedido", "pedidos")} de las oficinas en 7 días`,
    ...(gasto > 0 ? [`Gastó ${usd(gasto)} en 7 días`] : []),
  ]
  const espera = [
    ...pausas.map((p) => `El portero está en pausa: ${String(p.motivo).slice(0, 120)}`),
    ...alertas.map((a) => `Alarma abierta: ${String(a.titulo).slice(0, 100)}${Number(a.repeticiones) > 1 ? ` (se repitió ${a.repeticiones} veces)` : ""}`),
  ]
  const semaforo: Semaforo = pausas.length > 0 ? "rojo" : alertas.length > 0 || viejo ? "ambar" : "verde"
  return {
    clave: "cerebro", nombre: "Cerebro y portero", que_hace: QUE_HACE.cerebro, semaforo,
    estado_texto: pausas.length > 0 ? "Portero en pausa" : viejo ? "El portero no ha corrido en más de 2 días" : "Al día",
    datos: [{ etiqueta: "Fichas vigentes", valor: String(fichas) }, { etiqueta: "Trozos de conocimiento", valor: String(trozos) }],
    ultima_actividad: ultima, espera, hizo,
  }
}

export async function leerPlaneacion(supa: SupabaseClient, ahora: Date): Promise<TarjetaDeOficina> {
  const cfg = await filas(supa.from("cadena_config").select("clave, valor").in("clave", ["estado_cadena", "clientes_ensayo"]), "cadena_config")
  const valor = (k: string) => cfg.find((c) => c.clave === k)?.valor
  const campanas = await filas(supa.from("cadena_campanas").select("estado, seco").limit(200), "cadena_campanas")
  const corridas = await filas(supa.from("cadena_corridas").select("estado, costo_usd, seco, creada_en").gte("creada_en", desde(DIAS_DE_LA_VENTANA, ahora)).order("creada_en", { ascending: false }).limit(300), "cadena_corridas")
  const esperas = await filas(supa.from("cadena_esperas").select("estado, motivo, vence_en, seco").eq("estado", "viva").limit(50), "cadena_esperas")
  const reales = corridas.filter((c) => c.seco !== true)
  const vencidas = reales.filter((c) => c.estado === "vencida").length
  const vivas = esperas.filter((e) => e.seco !== true).length
  const sw = semaforoDelInterruptor(valor("estado_cadena") as string, valor("clientes_ensayo"))
  const camp = campanas.filter((c) => c.seco !== true)
  const gasto = suma(reales, "costo_usd")
  const hizo = [
    camp.length === 0 ? "No hay campañas armadas" : `${plural(camp.length, "campaña", "campañas")}: ${camp.map((c) => estadoDeCampanaLegible(c.estado)).join(", ")}`,
    reales.length === 0 ? "No dio pasos en 7 días" : `Dio ${plural(reales.length, "paso", "pasos")} en 7 días`,
    ...(vencidas > 0 ? [`${plural(vencidas, "paso se venció", "pasos se vencieron")} sin terminar`] : []),
    ...(gasto > 0 ? [`Gastó ${usd(gasto)} en 7 días`] : []),
  ]
  return {
    clave: "planeacion", nombre: "Planeación", que_hace: QUE_HACE.planeacion, semaforo: peor(sw.semaforo, vencidas > 0 ? "ambar" : null), estado_texto: sw.texto,
    datos: [{ etiqueta: "Campañas", valor: String(camp.length) }, { etiqueta: "Gasto (7 días)", valor: usd(gasto) }],
    ultima_actividad: maxFecha(corridas, "creada_en"), espera: vivas > 0 ? [plural(vivas, "paso espera una respuesta y su plazo corre", "pasos esperan una respuesta y su plazo corre")] : [], hizo,
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
