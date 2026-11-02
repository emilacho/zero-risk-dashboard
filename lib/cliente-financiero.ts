/**
 * VISTA FINANCIERA DEL CLIENTE (6.42 acceso · 6.46 v2 «solo dinero», boceto aprobado por Emilio 2-nov: Harvest + Productive + CloudZero; costos compartidos regla A).
 * Estructura copiada de Tableau Pulse (tarjetas con número, mini tendencia, variación y UNA línea de lectura; resumen en palabras arriba; preguntas
 * sugeridas) + Ramp (qué pasó, por qué, qué conviene). Solo el estilo es nuestro.
 * Todo sale de los mismos datos de Dinero (`/api/direccion/dinero`, SOLO LECTURA), filtrados por el cliente. Lo escribe el código (US$ 0); más adelante,
 * la oficina financiera. Lo que no tiene dato dice «sin dato todavía», nunca un cero inventado.
 */
import {
  anteriorDe, costoDeRehacer, costoPorResultado, desglose, diasEntre, frenteA, PROCESO_DEL_ALTA, PROCESO_DEL_PLAN, PRUEBAS_Y_FICHAS_VIEJAS,
  rangoDe, raizDeCorrida, resumenDelPeriodo, TRABAJO_INTERNO, tarjetas, usdCorto, type Dinero, type FilaDeDesglose, type Movimiento, type Periodo,
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

/* ───────────── 6.46 · v2 «solo dinero» (boceto aprobado 2-nov): Harvest + Productive + CloudZero ───────────── */
/** los tipos de costo del desglose (cada movimiento cae en UNO; suman el costo del período) */
export const TIPOS_DE_COSTO = ["Piezas y video", "Planeación", "Cerebro", "Alta", "Manual", "Otros"] as const
export type TipoDeCosto = (typeof TIPOS_DE_COSTO)[number]
export function tipoDeCosto(x: Pick<Movimiento, "proceso" | "empleado">): TipoDeCosto {
  const p = x.proceso ?? "", e = x.empleado
  if (p === PROCESO_DEL_PLAN) return "Planeación"
  if (/bb lens|faithfulness|brand/i.test(e)) return "Manual" // misma regla del boceto v2 aprobado (Brand strategist = manual de marca)
  if (p === PROCESO_DEL_ALTA || /onboarding/i.test(e)) return "Alta"
  if (/cerebro|portero|etiquet/i.test(`${p} ${e}`)) return "Cerebro"
  if (/pieza|contenido|cadena|creativ|brief|concepto|video|jefatura/i.test(`${p} ${e}`)) return "Piezas y video"
  return "Otros"
}
export const REGLA_DE_COMPARTIDOS = "Se reparte en proporción al gasto directo de cada cliente en el mismo período. Pruebas y fichas viejas no se reparten: son de la agencia."

export interface Entrega { clave: "plan" | "manual" | "pieza"; nombre: string; ahora: number | null; antes: number | null; cuantos: number; tendencia: number[]; nota: string }
export interface VistaDelCliente {
  nombre: string
  periodo: Periodo
  comparado_con: string
  saber: { que_paso: string; por_que: string; que_conviene: string }
  /** Harvest · los 4 números (ingreso, ganancia y margen: null = sin dato todavía) */
  numeros: { ingreso: number | null; costo: number; costo_anterior: number; variacion_pct: number | null; costo_con_compartido: number; ganancia: number | null; margen_pct: number | null }
  /** Harvest · mes a mes (los meses que cubre la lectura de Dinero) */
  meses: Array<{ mes: string; rotulo: string; costo: number; ingreso: number | null; en_curso: boolean }>
  por_tipo: Array<{ tipo: TipoDeCosto; usd: number; pct: number }>
  /** el costo de rehacer con la MISMA regla que Dinero (ya está dentro de los tipos: no se suma otra vez) */
  rehacer: { usd: number; pct: number; partes: Array<{ nombre: string; usd: number | null; cuantos: number }> }
  /** Productive · pronóstico */
  pronostico: { cierre: number; ritmo: number; poco_dato: boolean; presupuesto: number | null; margen_esperado: number | null; freno: Tope | null; avisos: string[] }
  /** CloudZero · costo por entrega ahora contra antes */
  entregas: Entrega[]
  /** Productive/CloudZero · lo compartido que le toca (regla A) */
  compartido: { interno: number; cuota_pct: number; toca: number; real: number; regla: string }
  preguntas: string[]
  detalle: { por_dia: Array<{ d: string; usd: number }>; por_empleado: FilaDeDesglose[]; corridas: FilaDeDesglose[] }
}

const r2 = (n: number) => Math.round(n * 100) / 100
const enRango = (x: { d: string }, r: { desde: string; hasta: string }) => x.d >= r.desde && x.d <= r.hasta
const suma = (xs: Movimiento[]) => xs.reduce((s, x) => s + x.usd, 0)
const pct = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("es-EC")} %`
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const ES_DEL_MANUAL = (x: Movimiento) => x.proceso === PROCESO_DEL_ALTA || /onboarding|bb lens|faithfulness/i.test(x.empleado)
const minuscula = (s: string) => s.charAt(0).toLocaleLowerCase("es") + s.slice(1)
/** lo que costó cada corrida de un proceso, en orden de fecha */
function corridasDe(movs: Movimiento[], es: (x: Movimiento) => boolean): Array<{ d: string; usd: number }> {
  const m = new Map<string, { d: string; usd: number }>()
  for (const x of movs) if (x.corrida && es(x)) { const k = raizDeCorrida(x.corrida), c = m.get(k) ?? { d: x.d, usd: 0 }; c.usd += x.usd; if (x.d < c.d) c.d = x.d; m.set(k, c) }
  return [...m.values()].sort((a, b) => a.d.localeCompare(b.d)).map((c) => ({ d: c.d, usd: r2(c.usd) }))
}
const promedio = (xs: Array<{ usd: number }>) => (xs.length ? r2(xs.reduce((s, x) => s + x.usd, 0) / xs.length) : null)

/** la vista entera de un cliente para un período (funciones puras: corre en el navegador; mismas reglas y mismo período que Dinero) */
export function vistaDelCliente(todo: Dinero, slug: string, periodo: Periodo, hoy: string): VistaDelCliente | null {
  const c = dineroDelCliente(todo, slug); if (!c) return null
  const { nombre, dinero: d, tope } = c
  const r = rangoDe(periodo, hoy), ant = anteriorDe(periodo, r)
  const k = resumenDelPeriodo(d.movimientos, r, ant, hoy), mes = tarjetas(d.movimientos, hoy)
  const movs = d.movimientos.filter((x) => enRango(x, r))
  const costo = k.total

  // costos compartidos · regla A: el trabajo interno del período, en proporción al gasto directo de cada cliente
  const delPeriodo = todo.movimientos.filter((x) => enRango(x, r))
  const interno = r2(suma(delPeriodo.filter((x) => x.cliente === TRABAJO_INTERNO)))
  const directoDeClientes = suma(delPeriodo.filter((x) => !NO_ES_CLIENTE(x.cliente)))
  const cuota = directoDeClientes > 0 ? costo / directoDeClientes : 0
  const toca = r2(interno * cuota)

  // desglose por tipo (suman el costo) y rehacer con la regla de Dinero (cruza los tipos)
  const porTipo = new Map<TipoDeCosto, number>(); for (const x of movs) porTipo.set(tipoDeCosto(x), (porTipo.get(tipoDeCosto(x)) ?? 0) + x.usd)
  const por_tipo = TIPOS_DE_COSTO.map((t) => ({ tipo: t, usd: r2(porTipo.get(t) ?? 0), pct: costo > 0 ? Math.round(((porTipo.get(t) ?? 0) / costo) * 1000) / 10 : 0 })).filter((x) => x.usd > 0 || x.tipo === "Otros").sort((a, b) => b.usd - a.usd)
  const rh = costoDeRehacer(d, r), rehacerUsd = r2(rh.reduce((s, x) => s + (x.usd ?? 0), 0))

  // mes a mes (los meses que cubre la lectura de Dinero)
  const porMes = new Map<string, number>(); for (const x of d.movimientos) porMes.set(x.d.slice(0, 7), (porMes.get(x.d.slice(0, 7)) ?? 0) + x.usd)
  const meses: VistaDelCliente["meses"] = []
  for (let m = todo.desde.slice(0, 7); m <= hoy.slice(0, 7); m = (() => { const [a, b] = m.split("-").map(Number); return b === 12 ? `${a + 1}-01` : `${a}-${String(b + 1).padStart(2, "0")}` })()) meses.push({ mes: m, rotulo: MESES[Number(m.slice(5, 7)) - 1], costo: r2(porMes.get(m) ?? 0), ingreso: null, en_curso: m === hoy.slice(0, 7) })

  // costo por entrega ahora contra el período anterior (CloudZero)
  const delAnt = d.movimientos.filter((x) => enRango(x, ant))
  const planes = corridasDe(movs, (x) => x.proceso === PROCESO_DEL_PLAN), planesAntes = corridasDe(delAnt, (x) => x.proceso === PROCESO_DEL_PLAN)
  const altas = corridasDe(movs, ES_DEL_MANUAL), altasAntes = corridasDe(delAnt, ES_DEL_MANUAL)
  const pieza = costoPorResultado(d, r).find((x) => x.clave === "pieza")!, piezaAntes = costoPorResultado(d, ant).find((x) => x.clave === "pieza")!
  const todasLasPiezas = (d.piezas ?? []).filter((p) => p.usd != null && (p.estado === "approved" || p.estado === "edited")).sort((a, b) => a.d.localeCompare(b.d))
  const notaDe = (ahora: number | null, antes: number | null, vacio: string) => ahora == null ? vacio : antes == null ? `antes: sin entregas ${ant.nombre === "ayer" ? "ayer" : `en ${ant.nombre}`}` : ahora > antes ? `▲ antes ${usdCorto(antes)}` : ahora < antes ? `▼ antes ${usdCorto(antes)}` : `igual que antes (${usdCorto(antes)})`
  const entregas: Entrega[] = [
    { clave: "plan", nombre: "Una vuelta del plan", ahora: promedio(planes), antes: promedio(planesAntes), cuantos: planes.length, tendencia: corridasDe(d.movimientos, (x) => x.proceso === PROCESO_DEL_PLAN).map((p) => p.usd), nota: "" },
    { clave: "manual", nombre: "Un manual", ahora: promedio(altas), antes: promedio(altasAntes), cuantos: altas.length, tendencia: corridasDe(d.movimientos, ES_DEL_MANUAL).map((p) => p.usd), nota: "" },
    { clave: "pieza", nombre: "Una pieza aprobada", ahora: pieza.por_unidad, antes: piezaAntes.por_unidad, cuantos: pieza.cuantos, tendencia: todasLasPiezas.map((p) => p.usd!), nota: "" },
  ]
  for (const e of entregas) e.nota = notaDe(e.ahora, e.antes, e.clave === "pieza" ? (d.piezas == null ? "no se pudo leer la bandeja" : "ninguna aprobada con costo anotado en el período") : `ninguna en el período`)

  // pronóstico (Productive)
  const avisos: string[] = []
  if (tope?.pct != null && tope.pct >= 80) avisos.push(`El freno de 24 h va en ${pct(tope.pct)}: el trabajo puede detenerse.`)

  /* 1 · lo que tienes que saber · SOLO dinero */
  const cuando = PERIODO_EN_PALABRAS[periodo], sube = (k.variacion_pct ?? 0) >= 0
  const conCompartido = toca > 0 ? ` Con su parte de lo compartido, ${usdCorto(r2(costo + toca))}.` : ""
  const que_paso = costo === 0 && k.anterior === 0 ? `${nombre} no tuvo costo en ${cuando} ni en ${ant.nombre}.`
    : k.variacion_pct == null ? `${nombre} costó ${usdCorto(costo)} en ${cuando} (antes ${usdCorto(0)}).${conCompartido}`
    : k.variacion_pct > 500 ? `${nombre} costó ${usdCorto(costo)} en ${cuando}; en ${ant.nombre} casi no tuvo costo (${usdCorto(k.anterior)}).${conCompartido}`
    : `${nombre} costó ${usdCorto(costo)} en ${cuando}: ${sube ? "subió" : "bajó"} ${Math.abs(k.variacion_pct)} % ${frenteA(ant.nombre)} (${usdCorto(k.anterior)}).${conCompartido}`
  const top = por_tipo.filter((x) => x.usd > 0 && x.tipo !== "Otros").slice(0, 2)
  const plan = entregas[0], cambioPlan = plan.ahora != null && plan.antes != null && plan.antes > 0 && Math.abs(plan.ahora - plan.antes) / plan.antes >= 0.2
  const por_que = costo === 0 ? "Sin trabajo con costo en el período."
    : !top.length ? `Todo el costo fue trabajo sin tipo propio (otros · ${usdCorto(costo)}); el detalle por empleado dice quién lo hizo.`
    : `Lo que más costó: ${top.map((x) => `${minuscula(x.tipo)} (${usdCorto(x.usd)})`).join(" y ")}.${cambioPlan ? ` Cada vuelta del plan cuesta ${plan.ahora! > plan.antes! ? "más" : "menos"} que antes (${usdCorto(plan.ahora!)} contra ${usdCorto(plan.antes!)}).` : ""}`
  const que_conviene = `A este ritmo cierra el mes en ${usdCorto(mes.proyeccion)}.${avisos.length ? ` ${avisos[0]}` : ""} Para ver ganancia y margen falta registrar lo que se le cobra.`

  return {
    nombre, periodo, comparado_con: ant.nombre,
    saber: { que_paso, por_que, que_conviene },
    numeros: { ingreso: null, costo, costo_anterior: k.anterior, variacion_pct: k.variacion_pct, costo_con_compartido: r2(costo + toca), ganancia: null, margen_pct: null },
    meses, por_tipo,
    rehacer: { usd: rehacerUsd, pct: costo > 0 ? Math.round((rehacerUsd / costo) * 1000) / 10 : 0, partes: rh.map((x) => ({ nombre: x.nombre, usd: x.usd, cuantos: x.cuantos })) },
    pronostico: { cierre: mes.proyeccion, ritmo: mes.ritmo_diario, poco_dato: mes.poco_dato_del_mes, presupuesto: null, margen_esperado: null, freno: tope, avisos },
    entregas,
    compartido: { interno, cuota_pct: Math.round(cuota * 1000) / 10, toca, real: r2(costo + toca), regla: REGLA_DE_COMPARTIDOS },
    preguntas: [
      k.variacion_pct != null && !sube ? `¿Por qué bajó el costo de ${nombre}?` : `¿Por qué subió el costo de ${nombre}?`,
      `¿Cuánto me cuesta ${nombre} con lo compartido?`,
      `¿A cuánto cierra el mes ${nombre}?`,
      ...(cambioPlan ? [`¿Por qué cambió lo que cuesta cada vuelta del plan de ${nombre}?`] : []),
    ],
    detalle: {
      por_dia: diasEntre(r.desde, r.hasta).map((dd) => ({ d: dd, usd: r2(suma(movs.filter((x) => x.d === dd))) })),
      por_empleado: desglose(d.movimientos, "empleado", r, ant).slice(0, 12),
      corridas: desglose(d.movimientos, "corrida", r, ant).slice(0, 10),
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
