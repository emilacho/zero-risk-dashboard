/**
 * MANUAL DE MARCA · lectura (servidor, SOLO LECTURA · sprint 6.3). Un error de la base lanza; nunca se lee como «sin manual».
 * Fuentes: `clients` (los clientes elegibles) · `client_brand_books` (la versión vigente = la mayor por cliente). Los textos los interpreta el lector
 * de siempre (`manual-lector.ts`: columna primero, borrador después, quién validó, qué falta); la identidad visual y las listas, `lib/manual.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { clientesParaElegir } from "@/lib/clientes-datos"
import { leerManual, type ManualLeido } from "@/lib/manual-lector"
import { borradorDelManual, coloresDelManual, listaDeTextos, origenDelManualLegible, politicaDeCompetidoresLegible, tipografiasDelManual, type ColorDelManual, type TipografiaDelManual } from "@/lib/manual"
import { revisionDeFidelidadLegible } from "@/lib/lenguaje"
import { palabrasDelManual, type PalabraDelManual } from "@/lib/manual-palabras"
import { avanceDelPedido } from "@/lib/plan"
import { jerarquiaTipografica, seccionesNuevasDelBorrador, type SeccionLeida } from "@/lib/manual-secciones"
import { canalesDelCliente, fotosDeLaBarra, logoDelManual, sedesDeLaBarra, type CanalDeLaBarra, type FotoDeLaBarra, type SedeDeLaBarra } from "@/lib/manual-barra"
import { CICLO_DEL_MANUAL_CERRADO, esPedidoAbierto, queCambioEnElManual, type CicloDelManual, type PedidoDelManual, quedoSinCambioPorLoValidado } from "@/lib/manual-ciclo"

type Fila = Record<string, unknown>
type R = PromiseLike<{ data: unknown; error: { message: string } | null }>
async function filas(q: R, que: string): Promise<Fila[]> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? []) as Fila[] }
async function una(q: R, que: string): Promise<Fila | null> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? null) as Fila | null }
/** la tabla o la columna del pedido todavía no existen (antes de la ventana de CC1): no es un error, es «aún no disponible» */
const AUN_NO_EXISTE = /schema cache|does not exist|PGRST20[045]|42P01|42703/i
async function opcional(q: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>, que: string): Promise<{ falta: boolean; fila: Fila | null }> {
  const r = await q
  if (r.error) { if (AUN_NO_EXISTE.test(`${r.error.code ?? ""} ${r.error.message}`)) return { falta: true, fila: null }; throw new Error(`${que}: ${r.error.message}`) }
  return { falta: false, fila: (r.data ?? null) as Fila | null }
}
const t = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null)
const detalleCorto = (v: unknown): string | null => {
  if (typeof v === "string") return v.trim() || null
  if (v && typeof v === "object") { const o = v as Record<string, unknown>; return t(o.motivo) ?? t(o.error) ?? t(o.mensaje) }
  return null
}
/** LA BARRA LATERAL (CC6 · 02-nov): logo (del borrador), fotos propias (producto y ambiente, ya en nuestro almacén), sedes con su atención/horario/dirección y fuente, y canales propios. Solo lectura */
async function leerLaBarra(supa: SupabaseClient, clienteId: string, libro: Fila): Promise<NonNullable<NonNullable<ManualDelCliente["manual"]>["barra"]>> {
  const [ficha, sedes, datos, fotos] = await Promise.all([
    una(supa.from("clients").select("config, website_url").eq("id", clienteId).maybeSingle(), "clients"),
    filas(supa.from("client_sedes").select("id, clave, ciudad").eq("client_id", clienteId).limit(20), "client_sedes"),
    filas(supa.from("client_sede_datos").select("sede_id, campo, valor_texto, fuente, fuente_ref").eq("client_id", clienteId).limit(200), "client_sede_datos"),
    filas(supa.from("client_social_images").select("url, que_muestra, tipo_de_toma, created_at").eq("client_id", clienteId).eq("owner_role", "propio").eq("estado", "ok").in("tipo_de_toma", ["producto", "ambiente"]).order("created_at", { ascending: false }).limit(30), "client_social_images"),
  ])
  return { logo: logoDelManual(borradorDelManual(libro)), fotos: fotosDeLaBarra(fotos), sedes: sedesDeLaBarra(sedes, datos, typeof ficha?.website_url === "string" ? ficha.website_url : null), canales: canalesDelCliente(ficha?.config, typeof ficha?.website_url === "string" ? ficha.website_url : null) }
}
/** el aplicado se sigue mostrando un rato (para ver «Listo»); después solo queda «Qué cambió» */
const HORAS_QUE_SE_VE_EL_APLICADO = 12

/**
 * EL CICLO DEL MANUAL (CC6 · 02-nov · contrato CC1): el último pedido del cliente en `plan_cambios` con `documento='manual'`, su avance con la MISMA cuenta
 * que el plan, y «Qué cambió» entre la versión sobre la que se pidió (`manual_id`) y la vigente si salió de ese pedido (`manual_nuevo_id`).
 */
async function leerCicloDelManual(supa: SupabaseClient, clienteId: string, vigente: Fila, ahora: Date): Promise<CicloDelManual> {
  const pc = await opcional(supa.from("plan_cambios").select("*").eq("documento", "manual").eq("client_id", clienteId).order("creado_en", { ascending: false }).limit(1).maybeSingle(), "plan_cambios")
  if (pc.falta) return CICLO_DEL_MANUAL_CERRADO
  const f = pc.fila
  if (!f) return { disponible: true, abierto: null, avance: null, que_cambio: [] }
  const pedido: PedidoDelManual = {
    id: String(f.id), estado: String(f.estado ?? ""), texto: String(f.texto ?? ""), seccion: t(f.seccion), creado_en: t(f.creado_en), actualizado_en: t(f.actualizado_en),
    despertado: typeof f.despertado === "boolean" ? f.despertado : null, despertar_detalle: detalleCorto(f.despertar_detalle), manual_id: t(f.manual_id), manual_nuevo_id: t(f.manual_nuevo_id),
    resultado: f.resultado && typeof f.resultado === "object" ? { sin_cambios: typeof (f.resultado as Record<string, unknown>).sin_cambios === "boolean" ? ((f.resultado as Record<string, unknown>).sin_cambios as boolean) : null } : null,
  }
  const vigenteId = String(vigente.id)
  const deEstaVersion = pedido.estado === "aplicado" && pedido.manual_nuevo_id === vigenteId
  const reciente = pedido.actualizado_en ? ahora.getTime() - Date.parse(pedido.actualizado_en) <= HORAS_QUE_SE_VE_EL_APLICADO * 3_600_000 : false
  const mostrarAvance = pedido.estado !== "aplicado" || (deEstaVersion && reciente)
  const wfe = t(f.workflow_execution_id)
  const [desp, invs, vivos, base] = await Promise.all([
    mostrarAvance && wfe ? filas(supa.from("agent_dispatches").select("status, created_at, running_at, completed_at").eq("workflow_execution_id", wfe).limit(50), "agent_dispatches") : Promise.resolve([] as Fila[]),
    mostrarAvance && wfe ? filas(supa.from("agent_invocations").select("status, created_at").eq("workflow_execution_id", wfe).limit(50), "agent_invocations") : Promise.resolve([] as Fila[]),
    mostrarAvance && pedido.creado_en && esPedidoAbierto(pedido.estado) ? filas(supa.from("agent_dispatches").select("agent_name, running_at, created_at").eq("client_id", clienteId).eq("status", "running").gte("created_at", pedido.creado_en).limit(20), "agent_dispatches") : Promise.resolve([] as Fila[]),
    deEstaVersion && pedido.manual_id ? una(supa.from("client_brand_books").select("*").eq("id", pedido.manual_id).maybeSingle(), "client_brand_books") : Promise.resolve(null),
  ])
  const avance = mostrarAvance ? avanceDelPedido({
    pedido: { id: pedido.id, estado: pedido.estado, creado_en: pedido.creado_en, actualizado_en: pedido.actualizado_en, despertado: pedido.despertado, despertar_detalle: pedido.despertar_detalle },
    despachos: desp.map((x) => ({ status: String(x.status ?? ""), creado_en: t(x.created_at), empezo_en: t(x.running_at), termino_en: t(x.completed_at) })),
    invocaciones: invs.map((x) => ({ status: String(x.status ?? ""), creado_en: t(x.created_at) })),
    version_nueva: pedido.manual_nuevo_id ? { id: pedido.manual_nuevo_id, creado_en: pedido.estado === "aplicado" ? pedido.actualizado_en : null } : null,
    jefatura: null, // el manual no pasa por la jefatura (CC1, 02-nov)
    compuerta_nueva: null,
    trabajando: vivos.map((x) => ({ agente: String(x.agent_name ?? ""), desde: t(x.running_at) ?? t(x.created_at) })),
  }, ahora, "manual") : null
  const antes = base ? leerManual(base) : null, ahoraL = leerManual(vigente)
  // el aviso del campo validado: solo si el último pedido ya terminó (no abierto) y dejó `resultado.sin_cambios` (nulo = pedido viejo: nada)
  const sin_cambio_por_lo_validado = !esPedidoAbierto(pedido.estado) && quedoSinCambioPorLoValidado(f.resultado)
  return { disponible: true, abierto: esPedidoAbierto(pedido.estado) ? pedido : null, avance, que_cambio: antes && ahoraL ? queCambioEnElManual(antes.campos, ahoraL.campos) : [], ...(sin_cambio_por_lo_validado ? { sin_cambio_por_lo_validado: true } : {}) }
}

export interface ManualDelCliente {
  clientes: Array<{ id: string; nombre: string; con_manual: boolean }>
  cliente: { id: string; nombre: string } | null
  manual: null | {
    version: number | null
    /** cuántas versiones lleva el manual de este cliente */
    versiones: number
    lector: ManualLeido
    /** la revisión automática de fidelidad del cimiento, en palabras */
    fidelidad: string
    origen: string | null
    colores: ColorDelManual[]
    tipografias: TipografiaDelManual[]
    /** las opciones de eslogan del borrador (las marcadas «PROPUESTA» no son dato del cliente) cuando el eslogan aún no está decidido */
    opciones_eslogan: string[]
    palabras_prohibidas: string[]
    /** CC6 · tablero del dueño: cada palabra con su intención (norma · dueño · estilo), con la misma regla que la plataforma */
    palabras?: PalabraDelManual[]
    terminos_propios: string[]
    politica_competidores: string | null
    /** CC6 · pedir cambios al manual: el pedido, su avance y «Qué cambió» (cerrado mientras la plataforma no lo tenga) */
    ciclo?: CicloDelManual
    /** CC6 · la barra lateral (boceto aprobado por Emilio, 02-nov): lo que no está en las columnas del manual, con datos reales */
    barra?: { logo: { url: string; procedencia: string | null } | null; fotos: FotoDeLaBarra[]; sedes: SedeDeLaBarra[]; canales: CanalDeLaBarra[] }
    /** CC6 · las secciones nuevas del manual (ADENDA 1): solo las que tienen dato; y la jerarquía tipográfica para la barra */
    secciones_nuevas?: SeccionLeida[]
    jerarquia_tipografica?: Array<{ uso: string; familia: string }>
    creado_en: string | null
    actualizado_en: string | null
  }
  leido_en: string
}

export async function leerManualDelCliente(supa: SupabaseClient, o: { cliente?: string | null; ahora?: Date } = {}): Promise<ManualDelCliente> {
  const ahora = o.ahora ?? new Date()
  const [elegibles, libros] = await Promise.all([
    clientesParaElegir(supa),
    filas(supa.from("client_brand_books").select("client_id, version").limit(2000), "client_brand_books"),
  ])
  const versionesPorCliente = new Map<string, number>()
  for (const l of libros) { const k = String(l.client_id); versionesPorCliente.set(k, (versionesPorCliente.get(k) ?? 0) + 1) }
  const clientes = elegibles.map((c) => ({ ...c, con_manual: versionesPorCliente.has(c.id) }))
  let elegido: { id: string; nombre: string } | null = (o.cliente && clientes.find((c) => c.id === o.cliente)) || null
  if (!elegido && o.cliente) {
    // pedido a propósito y fuera de la lista (ficha de práctica o dada de baja): se lee igual, sin agregarla a la lista
    const c = await una(supa.from("clients").select("id, name").eq("id", o.cliente).maybeSingle(), "clients")
    if (c) elegido = { id: String(c.id), nombre: String(c.name) }
  }
  if (!elegido) elegido = clientes.find((c) => c.con_manual) || clientes[0] || null
  const base = { clientes, leido_en: ahora.toISOString() }
  if (!elegido) return { ...base, cliente: null, manual: null }
  const cliente = { id: elegido.id, nombre: elegido.nombre }

  const b = await una(supa.from("client_brand_books").select("*").eq("client_id", cliente.id).order("version", { ascending: false }).limit(1).maybeSingle(), "client_brand_books")
  if (!b) return { ...base, cliente, manual: null }
  const lector = leerManual(b)
  if (!lector) return { ...base, cliente, manual: null }
  return {
    ...base, cliente,
    manual: {
      version: b.version == null ? null : Number(b.version),
      versiones: versionesPorCliente.get(cliente.id) ?? 1,
      lector,
      fidelidad: revisionDeFidelidadLegible(b.gate_outcome),
      origen: origenDelManualLegible(b.auto_generated_from),
      colores: coloresDelManual(b),
      tipografias: tipografiasDelManual(b),
      opciones_eslogan: listaDeTextos(borradorDelManual(b).tagline_opciones),
      palabras_prohibidas: listaDeTextos(b.forbidden_words),
      palabras: palabrasDelManual(b),
      terminos_propios: listaDeTextos(b.required_terminology),
      politica_competidores: politicaDeCompetidoresLegible(b.competitor_mentions_policy),
      ciclo: await leerCicloDelManual(supa, cliente.id, b, ahora),
      barra: await leerLaBarra(supa, cliente.id, b),
      secciones_nuevas: seccionesNuevasDelBorrador(borradorDelManual(b)),
      jerarquia_tipografica: jerarquiaTipografica(borradorDelManual(b)),
      creado_en: typeof b.created_at === "string" ? b.created_at : null,
      actualizado_en: typeof b.updated_at === "string" ? b.updated_at : null,
    },
  }
}
