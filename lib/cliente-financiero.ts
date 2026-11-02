/**
 * VISTA FINANCIERA DEL CLIENTE (sprint 6.42 · encargo 02-nov · boceto aprobado por Emilio con 3 cambios).
 * Estructura copiada de Tableau Pulse (tarjetas con número, mini tendencia, variación y UNA línea de lectura; resumen en palabras arriba; preguntas
 * sugeridas) + Ramp (qué pasó, por qué, qué conviene). Solo el estilo es nuestro.
 * Todo sale de los mismos datos de Dinero (`/api/direccion/dinero`, SOLO LECTURA), filtrados por el cliente. Lo escribe el código (US$ 0); más adelante,
 * la oficina financiera. Lo que no tiene dato dice «sin dato todavía», nunca un cero inventado.
 */
import {
  anomalias, anteriorDe, costoDeRehacer, costoPorResultado, desglose, diasEntre, fechaCorta, frenteA, PROCESO_DEL_ALTA, PROCESO_DEL_PLAN, PRUEBAS_Y_FICHAS_VIEJAS,
  rangoDe, raizDeCorrida, resumenDelPeriodo, TRABAJO_INTERNO, tarjetas, usdCorto, veces, type Dinero, type FilaDeDesglose, type Movimiento, type Periodo,
} from "@/lib/dinero-completo"
import type { Tope } from "@/lib/direccion-riesgos"

/** «Náufrago» → «naufrago» · «Zero Risk Seguridad Industrial» → «zero-risk-seguridad-industrial» */
export function slugDeCliente(nombre: string): string {
  return nombre.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}
/** los grupos que NO son un cliente (no llevan «Ver cliente») */
export const NO_ES_CLIENTE = (nombre: string): boolean => nombre === TRABAJO_INTERNO || nombre === PRUEBAS_Y_FICHAS_VIEJAS || nombre === "Sin gasto"
export const rutaDelCliente = (nombre: string): string => `/nuevo/cliente/${slugDeCliente(nombre)}`

/** los datos de Dinero de UN cliente: sus movimientos, su freno, sus piezas y sus versiones del manual */
export function dineroDelCliente(d: Dinero, slug: string): { nombre: string; ids: string[]; dinero: Dinero; tope: Tope | null } | null {
  const movimientos = d.movimientos.filter((x) => !NO_ES_CLIENTE(x.cliente) && slugDeCliente(x.cliente) === slug)
  const topesDelNombre = d.topes.filter((t) => t.cliente && slugDeCliente(t.cliente) === slug)
  if (!movimientos.length && !topesDelNombre.length) return null
  const nombre = movimientos[0]?.cliente ?? topesDelNombre[0].cliente!
  const ids = [...new Set([...movimientos.map((x) => x.client_id), ...topesDelNombre.map((t) => t.client_id)].filter((x): x is string => !!x))]
  const tope = d.topes.filter((t) => t.client_id && ids.includes(t.client_id)).sort((a, b) => (b.gastado_24h_usd ?? 0) - (a.gastado_24h_usd ?? 0))[0] ?? null
  const es = (cid: string | null | undefined) => !!cid && ids.includes(cid)
  const manuales_de = d.manuales_de == null ? null : d.manuales_de.filter((m) => es(m.client_id))
  return {
    nombre, ids, tope,
    dinero: { ...d, movimientos, topes: tope ? [tope] : [], piezas: d.piezas == null ? null : d.piezas.filter((p) => es(p.client_id)), manuales: manuales_de == null ? null : manuales_de.map((m) => m.d), manuales_de, cache: null, cache_por_empleado: null },
  }
}

export const PERIODO_EN_PALABRAS: Record<Periodo, string> = { hoy: "hoy", "7": "los últimos 7 días", mes: "lo que va del mes", "30": "los últimos 30 días" }
export interface Tarjeta { clave: string; rotulo: string; valor: string | null; extra?: string; variacion?: { texto: string; tono: "sube" | "baja" | "neutro" }; lectura: string; tendencia: number[]; proyectada?: boolean; barra?: number }
export interface VistaDelCliente {
  nombre: string
  periodo: Periodo
  comparado_con: string
  saber: { que_paso: string; por_que: string; que_conviene: string }
  tarjetas: Tarjeta[]
  negocio: string
  preguntas: string[]
  detalle: { por_dia: Array<{ d: string; usd: number }>; por_empleado: FilaDeDesglose[]; corridas: FilaDeDesglose[]; anomalias: Array<{ d: string; texto: string; usd: number }> }
}

const r2 = (n: number) => Math.round(n * 100) / 100
const enRango = (x: { d: string }, r: { desde: string; hasta: string }) => x.d >= r.desde && x.d <= r.hasta
const pct = (n: number) => `${Math.round(n).toLocaleString("es-EC")} %`
/** lo que costó cada corrida de un proceso, en orden de fecha (la mini tendencia de plan y manual) */
function corridasDe(movs: Movimiento[], es: (x: Movimiento) => boolean): Array<{ d: string; usd: number }> {
  const m = new Map<string, { d: string; usd: number }>()
  for (const x of movs) if (x.corrida && es(x)) { const k = raizDeCorrida(x.corrida), c = m.get(k) ?? { d: x.d, usd: 0 }; c.usd += x.usd; if (x.d < c.d) c.d = x.d; m.set(k, c) }
  return [...m.values()].sort((a, b) => a.d.localeCompare(b.d)).map((c) => ({ d: c.d, usd: r2(c.usd) }))
}
const ES_DEL_MANUAL = (x: Movimiento) => x.proceso === PROCESO_DEL_ALTA || /onboarding|bb lens|faithfulness/i.test(x.empleado)

/** la vista entera de un cliente para un período (funciones puras: corre en el navegador) */
export function vistaDelCliente(todo: Dinero, slug: string, periodo: Periodo, hoy: string): VistaDelCliente | null {
  const c = dineroDelCliente(todo, slug); if (!c) return null
  const { nombre, dinero: d, tope } = c
  const r = rangoDe(periodo, hoy), ant = anteriorDe(periodo, r)
  const k = resumenDelPeriodo(d.movimientos, r, ant, hoy), mes = tarjetas(d.movimientos, hoy)
  const movs = d.movimientos.filter((x) => enRango(x, r))
  const dias = diasEntre(r.desde, r.hasta)
  const porDia = new Map<string, number>(); for (const x of movs) porDia.set(x.d, (porDia.get(x.d) ?? 0) + x.usd)
  const serieDiaria = dias.map((dd) => r2(porDia.get(dd) ?? 0))

  // costo de rehacer y resultados (las mismas reglas que Dinero, sobre el cliente)
  const rh = costoDeRehacer(d, r), rehacer = r2(rh.reduce((s, x) => s + (x.usd ?? 0), 0))
  const principal = [...rh].filter((x) => (x.usd ?? 0) > 0).sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0))[0]
  const res = costoPorResultado(d, r), de = (q: "plan" | "manual" | "pieza") => res.find((x) => x.clave === q)!
  const plan = de("plan"), manual = de("manual"), pieza = de("pieza")
  const planes = corridasDe(movs, (x) => x.proceso === PROCESO_DEL_PLAN), altas = corridasDe(movs, ES_DEL_MANUAL)
  const caro = [...planes].sort((a, b) => b.usd - a.usd)[0]
  const piezas = d.piezas == null ? null : d.piezas.filter((p) => enRango(p, r))
  const devueltas = piezas?.filter((p) => p.estado === "rejected").length ?? 0
  const versiones = d.manuales == null ? null : d.manuales.filter((x) => x >= r.desde && x <= r.hasta).length

  // anomalías del cliente: corridas 3× lo habitual de su proceso (medido sobre toda la agencia) y días 3× lo normal del cliente
  const corridasDelCliente = new Set(d.movimientos.map((x) => x.corrida && raizDeCorrida(x.corrida)).filter(Boolean) as string[])
  const anoms = [
    ...anomalias(todo, hoy, r).filter((a) => a.tipo === "corrida" && a.corrida && corridasDelCliente.has(a.corrida)),
    ...anomalias(d, hoy, r).filter((a) => a.tipo === "dia"),
  ].sort((a, b) => b.d.localeCompare(a.d) || b.usd - a.usd)
  const anom = anoms[0]

  // qué costó más (por proceso, en palabras de oficina)
  const porProceso = new Map<string, number>(); for (const x of movs) { const p = x.proceso || x.empleado; porProceso.set(p, (porProceso.get(p) ?? 0) + x.usd) }
  const top = [...porProceso.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)

  /* 1 · lo que tienes que saber (Ramp): qué pasó · por qué · qué conviene */
  const cuando = PERIODO_EN_PALABRAS[periodo]
  const sube = (k.variacion_pct ?? 0) >= 0
  const que_paso = k.total === 0 && k.anterior === 0 ? `${nombre} no tuvo gasto en ${cuando} ni en ${ant.nombre}.`
    : k.variacion_pct == null ? `${nombre} gastó ${usdCorto(k.total)} en ${cuando}; en ${ant.nombre} no tuvo gasto.`
    : k.variacion_pct > 500 ? `${nombre} gastó ${usdCorto(k.total)} en ${cuando}; en ${ant.nombre} casi no tuvo gasto (${usdCorto(k.anterior)}).`
    : `${nombre} gastó ${usdCorto(k.total)} en ${cuando}: ${sube ? "subió" : "bajó"} ${Math.abs(k.variacion_pct)} % ${frenteA(ant.nombre)} (${usdCorto(k.anterior)}).`
  const por_que = !top.length ? "Sin trabajo con costo en el período."
    : `Lo que más costó: ${top.map(([p, u]) => `${p.charAt(0).toLocaleLowerCase("es") + p.slice(1)} (${usdCorto(u)})`).join(" y ")}.${anom ? ` El ${fechaCorta(anom.d)}, ${anom.tipo === "dia" ? `el día costó ${veces(anom.veces)} lo normal` : `una corrida costó ${veces(anom.veces)} lo habitual`}.` : ""}`
  const fr = tope?.pct != null ? (tope.pct >= 80 ? ` El freno de 24 h está casi lleno (${pct(tope.pct)}).` : ` El freno de 24 h está holgado (${pct(tope.pct)}).`) : ""
  const accion = tope?.pct != null && tope.pct >= 80 ? " Conviene revisarlo antes de que se detenga el trabajo."
    : anom ? ` Conviene revisar ${anom.tipo === "dia" ? "el día" : "la corrida"} del ${fechaCorta(anom.d)}.`
    : k.total > 0 && rehacer / k.total >= 0.25 ? ` Conviene bajar lo que se rehace (${pct((rehacer / k.total) * 100)} del gasto).`
    : " Nada urgente."
  const que_conviene = `A este ritmo cierra el mes en ${usdCorto(mes.proyeccion)}.${fr}${accion}`

  /* 2 · tarjetas tipo Pulse */
  // la proyección: lo acumulado día a día en el mes y, punteado, hasta el cierre
  const acumuladoDelMes: number[] = []; { let t = 0; for (const dd of diasEntre(`${hoy.slice(0, 8)}01`, hoy)) { t += d.movimientos.filter((x) => x.d === dd).reduce((s, x) => s + x.usd, 0); acumuladoDelMes.push(r2(t)) } }
  const variacion: Tarjeta["variacion"] = k.variacion_pct == null ? (k.total > 0 ? { texto: `▲ nuevo · antes ${usdCorto(0)}`, tono: "sube" } : undefined)
    : k.variacion_pct > 500 ? { texto: `▲ desde ${usdCorto(k.anterior)}`, tono: "sube" }
    : { texto: `${sube ? "▲" : "▼"} ${Math.abs(k.variacion_pct)} % · antes ${usdCorto(k.anterior)}`, tono: k.variacion_pct === 0 ? "neutro" : sube ? "sube" : "baja" }
  const ts: Tarjeta[] = [
    { clave: "gasto", rotulo: "Gasto del período", valor: usdCorto(k.total), variacion, tendencia: serieDiaria, lectura: top[0] ? `Lo que más pesó: ${top[0][0].charAt(0).toLocaleLowerCase("es") + top[0][0].slice(1)}.` : "Sin trabajo con costo en el período." },
    { clave: "proyeccion", rotulo: "Proyección del mes", valor: usdCorto(mes.proyeccion), variacion: { texto: `ritmo ${usdCorto(mes.ritmo_diario)}/día`, tono: "neutro" }, tendencia: [...acumuladoDelMes, mes.proyeccion], proyectada: true, lectura: mes.poco_dato_del_mes ? "Poco dato del mes todavía: tómalo como guía." : `A este ritmo, ~${usdCorto(Math.round(mes.proyeccion))} a fin de mes.` },
    tope && tope.techo_usd != null
      ? { clave: "freno", rotulo: "Freno 24 h", valor: usdCorto(tope.gastado_24h_usd ?? 0), extra: `de ${usdCorto(tope.techo_usd)}`, tendencia: [], barra: Math.min(100, tope.pct ?? 0), variacion: { texto: `${pct(tope.pct ?? 0)} usado`, tono: "neutro" }, lectura: (tope.pct ?? 0) >= 80 ? "Casi lleno: el trabajo puede detenerse." : "Holgado: nada se detiene hoy." }
      : { clave: "freno", rotulo: "Freno 24 h", valor: null, tendencia: [], lectura: "Aparece cuando el cliente tenga su freno de 24 h." },
    { clave: "rehacer", rotulo: "Costo de rehacer", valor: usdCorto(rehacer), variacion: { texto: k.total > 0 ? `${pct((rehacer / k.total) * 100)} del gasto` : "sin gasto", tono: "neutro" }, tendencia: [], lectura: principal ? `Sobre todo ${principal.nombre.toLocaleLowerCase("es")}.` : "Nada que rehacer en el período." },
    { clave: "plan", rotulo: "Costo de un plan", valor: plan.por_unidad == null ? null : usdCorto(plan.por_unidad), extra: undefined, variacion: { texto: `${plan.cuantos} ${plan.cuantos === 1 ? "vuelta" : "vueltas"} de la planeación`, tono: "neutro" }, tendencia: planes.map((p) => p.usd), lectura: caro ? `La más cara: ${fechaCorta(caro.d)} (${usdCorto(caro.usd)} en una vuelta).` : "Ninguna vuelta de la planeación en el período." },
    { clave: "manual", rotulo: "Costo del manual", valor: manual.por_unidad == null ? null : usdCorto(manual.por_unidad), variacion: { texto: `${manual.cuantos} ${manual.cuantos === 1 ? "alta" : "altas"}${versiones == null ? "" : ` · ${versiones} ${versiones === 1 ? "versión" : "versiones"}`}`, tono: "neutro" }, tendencia: altas.map((a) => a.usd), lectura: manual.cuantos ? "Lo que costó armar y revisar su manual de marca." : "Sin alta ni manual en el período." },
    { clave: "pieza", rotulo: "Costo de una pieza aprobada", valor: pieza.por_unidad == null ? null : usdCorto(pieza.por_unidad), variacion: piezas == null ? undefined : { texto: `${pieza.cuantos} ${pieza.cuantos === 1 ? "aprobada" : "aprobadas"} de ${piezas.length}`, tono: "neutro" }, tendencia: (piezas ?? []).filter((p) => p.usd != null && (p.estado === "approved" || p.estado === "edited")).sort((a, b) => a.d.localeCompare(b.d)).map((p) => p.usd!), lectura: piezas == null ? "No se pudo leer la bandeja de revisión." : devueltas ? `${devueltas} ${devueltas === 1 ? "devuelta" : "devueltas"}: ahí está el costo de rehacer.` : piezas.length ? "Ninguna pieza devuelta." : "Sin piezas revisadas en el período." },
    { clave: "margen", rotulo: "Margen", valor: null, tendencia: [], lectura: "Aparece cuando exista lo que se le cobra." },
  ]

  /* 4 · preguntas sugeridas (Pulse): abren el chat con la pregunta ya escrita */
  const preguntas = [
    k.variacion_pct != null && !sube ? `¿Por qué bajó el gasto de ${nombre}?` : `¿Por qué subió el gasto de ${nombre}?`,
    `¿Cuánto me costó el plan de ${nombre}?`,
    ...(anom ? [`¿Qué pasó el ${fechaCorta(anom.d)} con ${nombre}?`] : []),
    ...(devueltas ? [`¿Por qué se devolvieron piezas de ${nombre}?`] : []),
  ]

  return {
    nombre, periodo, comparado_con: ant.nombre,
    saber: { que_paso, por_que, que_conviene },
    tarjetas: ts,
    // cambio 2 de Emilio: mientras no haya dato, ventas · web · anuncios van juntos en UNA línea
    negocio: "Cómo le va al negocio: sin dato todavía",
    preguntas,
    detalle: {
      por_dia: dias.map((dd, i) => ({ d: dd, usd: serieDiaria[i] })),
      por_empleado: desglose(d.movimientos, "empleado", r, ant).slice(0, 12),
      corridas: desglose(d.movimientos, "corrida", r, ant).slice(0, 10),
      anomalias: anoms.slice(0, 10).map((a) => ({ d: a.d, usd: a.usd, texto: a.texto })),
    },
  }
}

/** 6.43 · un cliente dado de baja (churned) no va en el selector */
export const esDadoDeBaja = (status: string | null | undefined): boolean => /^(churned|baja|inactive|inactivo)$/i.test(String(status ?? "").trim())

/** la lista del selector «Seleccionar cliente»: los clientes de verdad (sin pruebas ni fichas archivadas), con su ruta */
export function clientesDelSelector(nombres: string[]): Array<{ nombre: string; ruta: string }> {
  const vistos = new Map<string, string>()
  for (const n of nombres) { if (NO_ES_CLIENTE(n)) continue; const s = slugDeCliente(n); if (s && !vistos.has(s)) vistos.set(s, n) }
  return [...vistos.entries()].sort((a, b) => a[1].localeCompare(b[1], "es")).map(([, n]) => ({ nombre: n, ruta: rutaDelCliente(n) }))
}
