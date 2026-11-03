/**
 * LA ESCENA VIVA · lectura (servidor, SOLO LECTURA · CC6 Sprint 1): quién está trabajando AHORA (`agent_dispatches` abiertos), qué terminó o falló hace poco
 * (`agent_invocations`), la mesa de cada uno (`oficina_directorio.equipo` + `oficina_equipos`) y los nombres (`agents`, `clients`). Una lectura pequeña por pedido;
 * el navegador pide cada pocos segundos. Los nombres y el directorio se leen una vez cada 5 min. Nada se escribe.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { conCache } from "@/lib/cache-corta"
import { esDePractica } from "@/lib/clientes"
import { nombresDeProcesos } from "@/lib/direccion-riesgos"
import { conAportes, MINUTOS_ENLACE, type ReunionDeLaSala } from "@/lib/escena-sala"
import { armarEscena, HORAS_RECIENTE, momentoDeLaCampana, type Despacho, type EscenaDatos, type InvocacionViva, type NombreDeAgente, type TarjetaDelDirectorio } from "@/lib/escena-avatares"
import { leerPlanDelCliente } from "@/lib/plan-datos"
import { leerLaVitrina, type VitrinaDeLaEscena } from "@/lib/escena-vitrina"
import { cuadrosDelPizarron, leerMetricas, redesDelCliente, type MetricasDelPizarron } from "@/lib/escena-metricas"
import { armarEntregas, conRevisiones, devolvioEmilio, MAXIMO_DE_CUADROS, MINUTOS_DE_CORRIGE, REVISION_VIVA_H, VIGENCIA_DE_LA_ENTREGA_H, type EntregasDeLaEscena } from "@/lib/escena-entregas"

type Fila = Record<string, unknown>
type R = PromiseLike<{ data: unknown; error: { message: string } | null }>
async function filas(q: R, que: string): Promise<Fila[]> { const r = await q; if (r.error) throw new Error(`${que}: ${r.error.message}`); return (r.data ?? []) as Fila[] }
const s = (v: unknown): string | null => (v == null || v === "" ? null : String(v))

/** cuántas invocaciones recientes se miran (para cerrar despachos, para «falló» y para la última actividad del equipo) */
export const LIMITE_DE_INVOCACIONES = 400
/** cuánto espera la escena a la línea del cliente y el momento de su campaña antes de salir sin ella */
export const ESPERA_DEL_CONTEXTO_MS = 1200

async function directorio(supa: SupabaseClient) {
  return conCache("escena-viva-directorio", 300_000, async () => {
    const [ag, cl, dir, eq] = await Promise.all([
      supa.from("agents").select("name, display_name, is_active").limit(1000),
      supa.from("clients").select("id, name").limit(1000),
      supa.from("oficina_directorio").select("agente, equipo, rol").limit(500),
      supa.from("oficina_equipos").select("clave, nombre, etapa").limit(50),
    ])
    const agentes: NombreDeAgente[] = ((ag.data ?? []) as Fila[]).map((a) => ({ name: String(a.name), display_name: s(a.display_name), activo: typeof a.is_active === "boolean" ? a.is_active : null }))
    const clientes = ((cl.data ?? []) as Fila[]).map((c) => ({ id: String(c.id), nombre: String(c.name ?? "") + (esDePractica({ nombre: String(c.name ?? "") }) ? " (práctica)" : "") }))
    const tarjetas: TarjetaDelDirectorio[] = ((dir.data ?? []) as Fila[]).map((d) => ({ agente: String(d.agente), equipo: s(d.equipo), rol: s(d.rol) }))
    // la tabla de equipos puede no estar en una base vieja: entonces manda la tabla MESAS
    const equipos = eq.error ? null : ((eq.data ?? []) as Fila[]).map((q) => ({ clave: String(q.clave), nombre: s(q.nombre), etapa: s(q.etapa) }))
    return { agentes, clientes, tarjetas, equipos }
  })
}

/** el cliente y el momento de su campaña (una lectura por minuto, compartida); si no se puede leer, la escena sigue sin esa línea */
/** el plan del cliente de la escena: el que pide el navegador (el de trabajo de Emilio) o, sin pedido, el de la regla por omisión; una lectura por minuto y por cliente */
const planDeLaEscena = (supa: SupabaseClient, ahora: Date, cliente: string | null) => conCache(`escena-viva-contexto:${cliente ?? "omision"}`, 60_000, () => leerPlanDelCliente(supa, { ahora, cliente }))

async function contexto(supa: SupabaseClient, ahora: Date, cliente: string | null): Promise<EscenaDatos["contexto"]> {
  // 02-nov · carga: la línea del cliente es un detalle y NO frena la escena. Si la lectura del plan tarda más de ESPERA_DEL_CONTEXTO_MS, la escena sale sin ella
  // (la lectura sigue y queda en la memoria de 60 s: el siguiente sondeo ya la trae)
  const lectura = planDeLaEscena(supa, ahora, cliente)
  lectura.catch(() => undefined)
  try {
    const plan = await Promise.race([lectura, new Promise<null>((r) => setTimeout(() => r(null), ESPERA_DEL_CONTEXTO_MS))])
    return plan ? momentoDeLaCampana(plan) : null
  } catch { return null }
}

export async function leerEscenaViva(supa: SupabaseClient, o: { ahora?: Date; /** CC6 · 02-nov: el cliente de trabajo que manda el navegador */ cliente?: string | null } = {}): Promise<EscenaDatos> {
  const ahora = o.ahora ?? new Date()
  const cliente = o.cliente ?? null
  const desde = new Date(ahora.getTime() - HORAS_RECIENTE * 3_600_000).toISOString()
  const [desp, inv, dir, ctx] = await Promise.all([
    // los despachos abiertos (sin importar cuándo: los viejos se cuentan como «sin fin registrado») + los que terminaron o fallaron en la ventana
    filas(supa.from("agent_dispatches").select("id, agent_name, client_id, workflow_id, workflow_execution_id, status, running_at, completed_at, created_at").or(`status.eq.running,created_at.gte.${desde}`).order("created_at", { ascending: false }).limit(300), "agent_dispatches"),
    filas(supa.from("agent_invocations").select("agent_name, client_id, workflow_id, workflow_execution_id, status, started_at, ended_at, cost_usd, step_name:metadata->>step_name, task_text:metadata->>task_text").gte("created_at", desde).order("created_at", { ascending: false }).limit(LIMITE_DE_INVOCACIONES), "agent_invocations"),
    directorio(supa),
    contexto(supa, ahora, cliente),
  ])
  const despachos: Despacho[] = desp.map((d) => ({ id: String(d.id), agent_name: String(d.agent_name ?? ""), client_id: s(d.client_id), workflow_id: s(d.workflow_id), workflow_execution_id: s(d.workflow_execution_id), status: s(d.status), running_at: s(d.running_at), completed_at: s(d.completed_at), created_at: s(d.created_at) }))
  const invocaciones: InvocacionViva[] = inv.map((i) => {
    const meta = (i.metadata && typeof i.metadata === "object" ? i.metadata : {}) as Fila
    const m = { step_name: i.step_name ?? meta.step_name, task_text: i.task_text ?? meta.task_text } as Fila // 02-nov · solo se pide lo que se usa de `metadata` (antes viajaba el objeto entero de 400 filas)
    return { agent_name: String(i.agent_name ?? ""), client_id: s(i.client_id), workflow_id: s(i.workflow_id), workflow_execution_id: s(i.workflow_execution_id), status: s(i.status), started_at: s(i.started_at), ended_at: s(i.ended_at), cost_usd: i.cost_usd == null ? null : Number(i.cost_usd), step_name: s(m.step_name), task_text: s(m.task_text) }
  })
  // 03-nov · el nombre del trabajo de las corridas recientes (n8n, solo lectura): sin él, la sala diría «flujo 2128…»
  const idsDeFlujos = [...new Set([...invocaciones.map((i) => i.workflow_id), ...despachos.map((d) => d.workflow_id)].filter((x): x is string => !!x))].slice(0, 12)
  const nombresDeFlujos = Object.fromEntries(await nombresDeProcesos(idsDeFlujos, fetch).catch(() => new Map<string, string>()))
  let escena = armarEscena({ despachos, invocaciones, directorio: dir.tarjetas, agentes: dir.agentes, clientes: dir.clientes, equipos: dir.equipos, ahora, contexto: ctx, nombresDeFlujos })
  // sprint 3 · entregas al pizarrón, revisiones de la jefatura y firmas pendientes: si la lectura falla, la escena sigue sin eso (no se inventa)
  try {
    const ent = await conCache("escena-viva-entregas", 15_000, () => leerEntregas(supa, ahora))
    escena = conRevisiones(escena, ent, { directorio: dir.tarjetas, agentes: dir.agentes, ahora }).escena
  } catch { /* sin entregas esta vez */ }
  // el pizarrón de métricas: las redes del cliente (de sus canales) y la lectura única de métricas (hoy «sin datos»)
  try { escena = { ...escena, metricas: await leerElPizarronDeMetricas(supa, ahora, cliente) } } catch { /* sin pizarrón esta vez */ }
  // la pantalla vertical: la vitrina de las mejores piezas (hoy «métricas pronto» + la última pieza aprobada)
  try { escena = { ...escena, vitrina: await leerLaVitrinaDeMarketing(supa, ahora, cliente) } } catch { /* sin vitrina esta vez */ }
  // S4 · los aportes de la reunión de la sala (3 lecturas chicas, solo si hay reunión; se guardan 20 s)
  if (escena.sala?.reunion) escena.sala = { ...escena.sala, reunion: await leerAportesDeLaReunion(supa, escena.sala.reunion) }
  return escena
}

/** S4 · lo que hace falta para los globos: la salida guardada de cada participante, los informes que entraron al cerebro durante la reunión y la revisión
 *  de la jefatura. Un error de la base lanza (no se lee como «no se usó»). */
export async function leerAportesDeLaReunion(supa: SupabaseClient, r: ReunionDeLaSala): Promise<ReunionDeLaSala> {
  const corridas = r.participantes.map((p) => p.corrida).filter((x): x is string => !!x)
  const clave = `escena-viva-aportes|${corridas.join(",")}|${r.participantes.map((p) => p.estado).join(",")}`
  const datos = await conCache(clave, 20_000, async () => {
    const desde = r.desde ?? new Date(0).toISOString()
    const hasta = new Date(Date.parse(r.hasta ?? new Date().toISOString()) + MINUTOS_ENLACE * 60_000).toISOString()
    const tieneJefatura = r.fases.some((f) => f.nombre === "revisión de la jefatura")
    const [salidas, fichas, revision] = await Promise.all([
      corridas.length ? filas(supa.from("agent_invocations").select("agent_name, workflow_execution_id, output_summary").in("workflow_execution_id", corridas).limit(100), "agent_invocations") : Promise.resolve([] as Fila[]),
      r.cliente_id ? filas(supa.from("cerebro_fichas").select("ref").eq("client_id", r.cliente_id).eq("clase", "informe_de_analisis").gte("creado_en", desde).lte("creado_en", hasta).limit(50), "cerebro_fichas") : Promise.resolve([] as Fila[]),
      r.cliente_id && tieneJefatura ? filas(supa.from("jefatura_revisiones").select("estado_del_motor, creado_en").eq("client_id", r.cliente_id).gte("creado_en", desde).lte("creado_en", hasta).order("creado_en", { ascending: false }).limit(1), "jefatura_revisiones") : Promise.resolve([] as Fila[]),
    ])
    return {
      salidas: salidas.map((x) => ({ agent_name: String(x.agent_name ?? ""), workflow_execution_id: s(x.workflow_execution_id), output_summary: s(x.output_summary) })),
      informesEnElCerebro: fichas.map((f) => String(f.ref ?? "")).filter(Boolean),
      revision: revision[0] ? { estado_del_motor: revision[0].estado_del_motor } : null,
    }
  })
  return conAportes(r, datos)
}

/** sprint 3 · lo que se entregó, quién revisa y cuántas firmas esperan (solo lectura; un error de la base lanza y la escena sigue sin esto) */
export async function leerEntregas(supa: SupabaseClient, ahora: Date): Promise<EntregasDeLaEscena> {
  const desdeEntrega = new Date(ahora.getTime() - VIGENCIA_DE_LA_ENTREGA_H * 3_600_000).toISOString()
  const desdeRevision = new Date(ahora.getTime() - REVISION_VIVA_H * 3_600_000).toISOString()
  const desdeCorrige = new Date(ahora.getTime() - MINUTOS_DE_CORRIGE * 60_000).toISOString()
  const [encargos, revisiones, bandeja, pasosDeCorreccion, decisiones, cambios] = await Promise.all([
    filas(supa.from("oficina_encargos").select("id, estado, sala_ref, cerrado_en").eq("dry_run", false).like("estado", "cerrado%").gte("cerrado_en", desdeEntrega).order("cerrado_en", { ascending: false }).limit(MAXIMO_DE_CUADROS * 3), "oficina_encargos"),
    filas(supa.from("jefatura_revisiones").select("id, artifact_id, estado, creado_en, cerrado_en").eq("artifact_type", "pieza").is("cerrado_en", null).gte("creado_en", desdeRevision).order("creado_en", { ascending: false }).limit(60), "jefatura_revisiones"),
    // lo archivado de una campaña anterior no espera a nadie (CC1 #852 · reserva de CC3 a #199)
    filas(supa.from("hitl_queue").select("id, expires_at").eq("status", "pending").is("archivada_en", null).limit(500), "hitl_queue"),
    // «corrige» (reglas de CC1): la jefatura devolvió = un paso `correccion:%` hecho · Emilio devolvió = pieza / plan / manual
    filas(supa.from("jefatura_pasos").select("revision_id, paso, estado, agente, inicio, fin").like("paso", "correccion:%").eq("estado", "hecho").gte("fin", desdeCorrige).limit(100), "jefatura_pasos"),
    filas(supa.from("hitl_queue").select("id, status, reviewer, decision, metadata, decided_at").eq("type", "content_piece_review").in("status", ["edited", "rejected"]).gte("decided_at", desdeCorrige).limit(100), "hitl_queue"),
    filas(supa.from("plan_cambios").select("id, plan_id, documento, campos_liberados, creado_en").in("documento", ["plan", "manual"]).gte("creado_en", desdeCorrige).limit(50), "plan_cambios"),
  ])
  const decisionesDeEmilio = decisiones.filter(devolvioEmilio)
  const idsAtribucion = [...new Set([...pasosDeCorreccion.map((p) => s(p.revision_id)), ...decisionesDeEmilio.map((d) => s(((d.metadata as Fila | null) ?? {}).jefatura_revision_id))].filter((x): x is string => !!x))]
  const idsDePlan = [...new Set(cambios.filter((c) => c.documento === "plan").map((c) => s(c.plan_id)).filter((x): x is string => !!x))]
  const idsDeEncargoDeEmilio = decisionesDeEmilio.map((d) => s(((d.metadata as Fila | null) ?? {}).oficina_encargo_id)).filter((x): x is string => !!x)
  const idsEncargo = [...new Set([...encargos.map((e) => String(e.id)), ...revisiones.map((r) => s(r.artifact_id)).filter((x): x is string => !!x), ...idsDeEncargoDeEmilio])]
  const idsFila = [...new Set(encargos.map((e) => s(((e.sala_ref as Fila | null) ?? {}).fila && (((e.sala_ref as Fila).fila as Fila).id))).filter((x): x is string => !!x))]
  const idsRevision = revisiones.map((r) => String(r.id))
  const [turnos, filasCal, pasos, atribucionPorId, atribucionPorPlan] = await Promise.all([
    idsEncargo.length ? filas(supa.from("oficina_turnos").select("encargo_id, agente, tipo, inicio, fin").in("encargo_id", idsEncargo).eq("tipo", "agente").limit(1500), "oficina_turnos") : Promise.resolve([] as Fila[]),
    idsFila.length ? filas(supa.from("cadena_calendario_filas").select("id, tema, red").in("id", idsFila).limit(100), "cadena_calendario_filas") : Promise.resolve([] as Fila[]),
    idsRevision.length ? filas(supa.from("jefatura_pasos").select("revision_id, agente, tipo, estado").in("revision_id", idsRevision).limit(400), "jefatura_pasos") : Promise.resolve([] as Fila[]),
    idsAtribucion.length ? filas(supa.from("jefatura_revisiones").select("id, artifact_id, productores, prueba, dry_run").in("id", idsAtribucion).limit(100), "jefatura_revisiones") : Promise.resolve([] as Fila[]),
    idsDePlan.length ? filas(supa.from("jefatura_revisiones").select("id, artifact_id, productores, prueba, dry_run").in("artifact_id", idsDePlan).limit(100), "jefatura_revisiones") : Promise.resolve([] as Fila[]),
  ])
  return armarEntregas({ encargos, turnos, filas: filasCal, revisiones, pasos, bandeja, pasosDeCorreccion, decisiones, cambios, atribucion: [...atribucionPorId, ...atribucionPorPlan], ahora })
}

/** el pizarrón de métricas de marketing: el cliente de la escena, las redes que tiene (de `clients.config` y su sitio) y la lectura de métricas. Solo lectura */
export async function leerElPizarronDeMetricas(supa: SupabaseClient, ahora: Date, clientePedido: string | null = null): Promise<MetricasDelPizarron> {
  return conCache(`escena-viva-metricas:${clientePedido ?? "omision"}`, 60_000, async () => {
    const plan = await planDeLaEscena(supa, ahora, clientePedido)
    const cliente = plan.cliente
    let redes: ReturnType<typeof redesDelCliente> = []
    if (cliente) {
      const r = await supa.from("clients").select("config, website_url").eq("id", cliente.id).maybeSingle()
      if (r.error) throw new Error(`clients: ${r.error.message}`)
      // los campos de sus sedes con dato que nombran una red (p. ej. el WhatsApp de una sede): la barra del manual los muestra en «Sedes y canales»
      const s = await supa.from("client_sede_datos").select("campo, valor_texto").eq("client_id", cliente.id).limit(200)
      const deSedes = s.error ? [] : ((s.data ?? []) as Array<{ campo?: unknown; valor_texto?: unknown }>).filter((x) => typeof x.campo === "string" && typeof x.valor_texto === "string" && x.valor_texto.trim() !== "").map((x) => String(x.campo))
      redes = redesDelCliente(r.data?.config, typeof r.data?.website_url === "string" ? r.data.website_url : null, deSedes)
    }
    const lectura = await leerMetricas(supa, { cliente: cliente?.id ?? null })
    return { cliente: cliente?.nombre ?? null, cuadros: cuadrosDelPizarron(redes, lectura), lectura: lectura.estado }
  })
}

/** la vitrina de la pantalla vertical de marketing: el cliente de la escena y su última pieza aprobada. Solo lectura */
export async function leerLaVitrinaDeMarketing(supa: SupabaseClient, ahora: Date, clientePedido: string | null = null): Promise<VitrinaDeLaEscena> {
  return conCache(`escena-viva-vitrina:${clientePedido ?? "omision"}`, 60_000, async () => {
    const plan = await planDeLaEscena(supa, ahora, clientePedido)
    return leerLaVitrina(supa, { cliente: plan.cliente?.id ?? null })
  })
}
