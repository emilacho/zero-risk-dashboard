/**
 * DASHBOARD NUEVO · SPRINT 6.5 · EL PLAN DE 90 DÍAS EN EL ESTILO NUEVO (Emilio, 31-oct: «ya no uses el dashboard viejo… así con todo»). El cuadro «Plan de
 * 90 días» abre encima el plan completo: la portada (campaña · ventana · fase · estrategia · estado del plan), lo que espera tu decisión (la revisión
 * `plan_con_pendientes` con las marcas del chequeo y los botones «Aprobar el plan así» / «Pedir cambios al plan», por la acción del tablero
 * `revision-resolver`, la misma de la bandeja), las fases, la meta y el reparto (el documento escrito por la oficina de planeación), redes y ritmo,
 * pilares, la semana tipo, lo que la estrategia deja dicho y lo que espera la campaña. Lo que no existe se dice.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { agruparEsperas, canalDelPlanLegible, cuerpoDeResolucion, decisionDelPlanLegible, estadoDelPlanLegible, estrategiaDelContenido, marcasDelChequeo, planDelTexto, porcentaje, publicacionesPorSemana, puntosDeLoNoBuscado, puntosDelAviso, semanaDelPatron, textoDeLaMeta, tipoDeEsperaLegible } from "@/lib/plan"
import { leerPlanDelCliente, type PlanDelCliente } from "@/lib/plan-datos"
import { ACCIONES } from "@/lib/tablero-acciones"
import { PanelPlan } from "@/components/nuevo/PanelPlan"
import { PanelAplicaciones } from "@/components/nuevo/PanelAplicaciones"
import { faseActiva } from "@/lib/pizarron"

const CLIENTE = "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312"
const CAMPANA = "8168f32b-47d9-466a-9350-3dff31700a58"
const REVISION = "0d333a57-4bb5-411b-beaf-0dc163ed5409"

/** el documento del plan con la forma REAL de producción (lectura 31-oct): un bloque JSON dentro de una cerca, y el estado + las marcas en `provenance_tag` */
const TEXTO_DEL_PLAN = "```json\n" + JSON.stringify({
  meta_por_semana: 115, zonas: ["olon_santa_elena", "guayaquil"], dias_y_horarios: { horario: "08:00-16:00", dias_activos_por_semana: 5 }, evento: "visita al local",
  canales: [{ canal: "meta_ig", peso: 0.45, activo: true }, { canal: "busqueda_local", peso: 0.2, activo: true }, { canal: "influencers", peso: 0.05, activo: true, condicion: "solo micro-influencers surf/viaje en Olón" }],
  produccion: { fraccion: 0.2 }, marca: 0.15, no_se: ["presupuesto semanal de pauta disponible", "tamaño real de la base propia"],
  equilibrio_respuesta: { decision: "mantengo_la_meta", motivo: "El equilibrio no existe con los supuestos actuales." }, rareza: 1,
}) + "\n```"
const PROVENANCE = {
  fuente: "planeacion", caracteres: 1485, estado_del_plan: "con_pendientes",
  pendientes: "P3 · lleva nombres internos · P4 · presupuesto incompleto (las ventas o clientes necesarios, al menos dos escenarios) · P10b · afirmación del plan sin respaldo en la tabla de datos",
  jefatura_marcas: { motivo: null, resultado: "con_desacuerdo", marcado_en: "2026-10-30T23:39:50.326Z", revision_id: "5c019899-25d0-4289-af06-8103ced212ef" },
  registro_interno: { aviso_del_chequeo: "\n\n## Revisión del plan (la hace el sistema)\n- Antes de enviarlo al cliente hay que revisar: el plan lleva nombres internos · el presupuesto no sale de la meta · hay una cifra de hecho fuera de los slots", no_se_busco_del_sistema: "## Lo que NO se buscó y por qué\n- competidores precio · el rubro no lo requiere\n- velocidad sitio · no lo pidió ninguno" },
}
const CONTENIDO = {
  fases: [{ clave: "senal", objetivo: "Juntar señal de medición", cita_plan: "acumular señal", dia_desde: 1, dia_hasta: 30 }, { clave: "recompra", objetivo: "Crecer la base propia", cita_plan: "LTV", dia_desde: 31, dia_hasta: 60 }],
  canales: [{ red: "instagram", rol: "principal", motivo: "mayor peso", formatos: ["reel", "foto"], frecuencia: { feed_semana: 4, anuncios_semana: 1, historias_semana: 5 } }, { red: "linkedin", rol: "no", motivo: "no aplica", formatos: [], frecuencia: { feed_semana: 0, anuncios_semana: 0, historias_semana: 0 } }],
  pilares: [{ pct: 40, clave: "producto", nombre: "Encebollado y ceviche" }, { pct: 60, clave: "lugar", nombre: "Olón" }],
  hitos: [], alertas: [{ ref: "sede:0a605e33", texto: "Guayaquil está por abrir." }], excluidos: [],
  pendientes: [{ clave: "presupuesto_pauta", pedir_a: "portero", que_falta: "presupuesto semanal de pauta", desbloquea: ["anuncios"] }],
  dependencias: [{ antes: "confirmar influencers", regla: "No se activan influencers sin confirmar.", despues: "activar influencers", cita_plan: "x" }],
  patron_semanal: [{ red: "instagram", hora: "08:00", sede: "olon", slot: "jue_reel", pilar: "producto", formato: "reel", dia_semana: 4, requiere_abierto: true }, { red: "whatsapp", hora: "07:30", sede: "olon", slot: "lun_estado", pilar: "pedido", formato: "estado", dia_semana: 1, requiere_abierto: true }],
  piezas_fijas: [], fechas_que_importan: [{ tipo: "temporada alta de playa", ambito: "Olón", motivo: "falta confirmar cuándo empieza", origen: "plan" }],
}

/** una base falsa: registra tablas y filtros, contesta con lo preparado; cualquier escritura rompe la prueba */
function baseFalsa(respuestas: Record<string, unknown | ((registro: string[]) => unknown)>, registro: string[] = []) {
  const consulta = (tabla: string): unknown => {
    const q: Record<string, unknown> = {}
    const filtros: string[] = []
    const enc = (nombre: string) => (...args: unknown[]) => { const f = `${tabla}.${nombre}(${args.map((a) => JSON.stringify(a)).join(",")})`; registro.push(f); filtros.push(f); return q }
    for (const n of ["select", "eq", "in", "is", "order", "limit", "gte", "neq"]) q[n] = enc(n)
    const resolver = () => { const r = respuestas[tabla]; return typeof r === "function" ? (r as (f: string[]) => unknown)(filtros) : r }
    q.maybeSingle = () => { registro.push(`${tabla}.maybeSingle()`); const r = resolver(); return Promise.resolve({ data: Array.isArray(r) ? r[0] ?? null : r ?? null, error: null }) }
    q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => { const r = resolver(); const esConteo = filtros.some((f) => f.includes('"head":true')); return Promise.resolve(esConteo ? { data: null, count: Array.isArray(r) ? r.length : Number(r ?? 0), error: null } : { data: r ?? [], error: null }).then(res, rej) }
    for (const n of ["insert", "update", "upsert", "delete", "rpc"]) q[n] = () => { throw new Error(`escritura prohibida: ${tabla}.${n}`) }
    return q
  }
  return { from: consulta, registro } as unknown as Parameters<typeof leerPlanDelCliente>[0] & { registro: string[] }
}

const estrategia = estrategiaDelContenido(CONTENIDO)
const datos: PlanDelCliente = {
  clientes: [{ id: CLIENTE, nombre: "Náufrago", con_campana: true }, { id: "11111111-1111-4111-8111-111111111111", nombre: "Otro", con_campana: false }], cliente: { id: CLIENTE, nombre: "Náufrago" }, hoy: "2026-11-05",
  campana: { id: CAMPANA, estado: "pausada", estado_motivo: "pausa de pruebas por decisión del dueño 31-oct", desde: "2026-11-02", hasta: "2027-01-30", sedes: ["guayaquil", "olon"], tope_planeacion_usd: 6, autoproducir: true, publicaciones: 136, version_calendario: 1, creada_en: "2026-10-30T23:39:58Z", actualizada_en: "2026-10-31T13:36:53Z" },
  estrategia: { version: 1, estado: "validada", creada_en: "2026-10-30T23:40:37Z", costo_usd: 0.2499, texto_md: null, ...estrategia },
  fase_activa: faseActiva(estrategia.fases, "2026-11-02", "2026-11-05"),
  documento: { id: "3dfcc12f-993e-478a-b884-f7df45ceaf77", titulo: "Plan de 90 dias · 2026-10-30", creado_en: "2026-10-30T23:13:22Z", actualizado_en: null, status: "draft", estado_del_plan: "con_pendientes", marcas: marcasDelChequeo(PROVENANCE.pendientes), aviso_del_chequeo: puntosDelAviso(PROVENANCE.registro_interno.aviso_del_chequeo), no_se_busco: puntosDeLoNoBuscado(PROVENANCE.registro_interno.no_se_busco_del_sistema), jefatura: { resultado: "con_desacuerdo", marcado_en: "2026-10-30T23:39:50Z" }, plan: planDelTexto(TEXTO_DEL_PLAN).plan, prosa: null, caracteres: 1485, que_cambio: null },
  revision: { id: REVISION, titulo: "Plan de 90 días de Náufrago con pendientes", creada_en: "2026-10-30T23:40:00Z", status: "pending", decision: null, vence_en: null },
  ciclo: { disponible: true, version: 1, historial: [], con_compuerta: false, compuerta: null, pedido: null, avance: null },
  topes: [{ tramo: "oficina", nombre: "Mesa de análisis", usd: 1.5, version: 1, desde: "2026-10-15T14:24:08Z" }, { tramo: "redaccion", nombre: "Redactor del plan", usd: 0.8, version: 1, desde: "2026-10-15T14:24:08Z" }],
  esperas: { vivas: 3, grupos: agruparEsperas([{ objeto_tipo: "espera_video", motivo: "espera al brazo de video", vence_en: "2026-10-31T13:30:00Z", estado: "viva" }, { objeto_tipo: "espera_video", motivo: "espera al brazo de video", vence_en: "2026-10-30T13:30:00Z", estado: "viva" }, { objeto_tipo: "aprobacion_bandeja", motivo: "la pieza espera la aprobación de Emilio", vence_en: null, estado: "viva" }, { objeto_tipo: "necesita_humano", motivo: "x", vence_en: null, estado: "resuelta" }]), vencidas: { n: 0, grupos: [] } },
  leido_en: "x",
}

describe("sprint 6.5 · el plan de 90 días en el estilo nuevo", () => {
  it("el documento del plan se lee del bloque JSON real (cerca ```json) y, si fuera prosa, se devuelve tal cual", () => {
    const { plan, prosa } = planDelTexto(TEXTO_DEL_PLAN)
    expect(prosa).toBeNull()
    expect(plan).toMatchObject({ meta_por_semana: 115, evento: "visita al local", zonas: ["olon_santa_elena", "guayaquil"], horario: "08:00-16:00", dias_activos_por_semana: 5, produccion_fraccion: 0.2, marca_fraccion: 0.15, otras_claves: ["rareza"] })
    expect(plan!.canales).toEqual([{ canal: "meta_ig", peso: 0.45, activo: true, condicion: null }, { canal: "busqueda_local", peso: 0.2, activo: true, condicion: null }, { canal: "influencers", peso: 0.05, activo: true, condicion: "solo micro-influencers surf/viaje en Olón" }])
    expect(plan!.equilibrio).toEqual({ decision: "mantengo_la_meta", motivo: "El equilibrio no existe con los supuestos actuales." })
    expect(textoDeLaMeta(plan!)).toBe("115 por semana · visita al local")
    expect(planDelTexto("Un plan escrito en prosa.\nSegundo párrafo.")).toEqual({ plan: null, prosa: "Un plan escrito en prosa.\nSegundo párrafo." })
    expect(planDelTexto("")).toEqual({ plan: null, prosa: null }); expect(planDelTexto(null)).toEqual({ plan: null, prosa: null })
    expect(planDelTexto("```json\n{roto\n```")).toEqual({ plan: null, prosa: "```json\n{roto\n```" }) // JSON roto: no se inventa; se enseña el texto
    expect(canalDelPlanLegible("meta_ig")).toBe("Instagram y Facebook (Meta)"); expect(canalDelPlanLegible("algo_raro")).toBe("Algo raro")
    expect(porcentaje(0.45)).toBe("45 %"); expect(porcentaje(40)).toBe("40 %"); expect(porcentaje(null)).toBe("—")
  })
  it("la estrategia se lee con tolerancia: lo que falta queda vacío y la semana tipo va de lunes a domingo con sus huecos", () => {
    expect(estrategia.fases.map((f) => f.clave)).toEqual(["senal", "recompra"])
    expect(estrategia.redes.map((r) => `${r.red}:${r.rol}:${r.feed_semana + r.historias_semana + r.anuncios_semana}`)).toEqual(["instagram:principal:10", "linkedin:no:0"])
    expect(publicacionesPorSemana(estrategia.redes)).toEqual({ feed: 4, historias: 5, anuncios: 1, total: 10 })
    expect(estrategia.patron_semanal.map((s) => s.slot)).toEqual(["lun_estado", "jue_reel"]) // ordenados por día
    const semana = semanaDelPatron(estrategia.patron_semanal)
    expect(semana.map((d) => `${d.nombre}:${d.slots.length}`)).toEqual(["lun:1", "mar:0", "mié:0", "jue:1", "vie:0", "sáb:0", "dom:0"])
    expect(estrategia.hitos).toEqual([]); expect(estrategia.pendientes[0]).toEqual({ clave: "presupuesto_pauta", que_falta: "presupuesto semanal de pauta", desbloquea: ["anuncios"], pedir_a: "portero" })
    expect(estrategiaDelContenido(null).fases).toEqual([]); expect(estrategiaDelContenido({ canales: "no es lista" }).redes).toEqual([])
  })
  it("las marcas del chequeo, el aviso y lo no buscado salen en puntos; el estado y las esperas en palabras", () => {
    expect(marcasDelChequeo(PROVENANCE.pendientes)).toEqual([{ codigo: "P3", texto: "lleva nombres internos" }, { codigo: "P4", texto: "presupuesto incompleto (las ventas o clientes necesarios, al menos dos escenarios)" }, { codigo: "P10B", texto: "afirmación del plan sin respaldo en la tabla de datos" }])
    expect(marcasDelChequeo("")).toEqual([]); expect(marcasDelChequeo("sin código · otra cosa")).toEqual([{ codigo: "", texto: "sin código · otra cosa" }])
    expect(puntosDelAviso(PROVENANCE.registro_interno.aviso_del_chequeo)).toEqual(["el plan lleva nombres internos", "el presupuesto no sale de la meta", "hay una cifra de hecho fuera de los slots"])
    expect(puntosDeLoNoBuscado(PROVENANCE.registro_interno.no_se_busco_del_sistema)).toEqual(["competidores precio · el rubro no lo requiere", "velocidad sitio · no lo pidió ninguno"])
    expect(estadoDelPlanLegible("con_pendientes")).toBe("Con puntos por resolver"); expect(estadoDelPlanLegible(null)).toBe("Sin estado declarado")
    expect(datos.esperas.grupos).toEqual([{ tipo: "espera_video", etiqueta: tipoDeEsperaLegible("espera_video"), n: 2, vence_primero: "2026-10-30T13:30:00Z" }, { tipo: "aprobacion_bandeja", etiqueta: tipoDeEsperaLegible("aprobacion_bandeja"), n: 1, vence_primero: null }]) // la resuelta no cuenta
    expect(decisionDelPlanLegible("pending", null)).toBeNull(); expect(decisionDelPlanLegible("approved", { resultado: "aprobado así" })).toBe("Aprobado así"); expect(decisionDelPlanLegible("rejected", null)).toBe("Cambios pedidos")
  })
  it("la decisión arma exactamente el cuerpo que valida el servidor del tablero (revision-resolver): pedir cambios exige el porqué", () => {
    expect(cuerpoDeResolucion(REVISION, "aprobar", "")).toEqual({ hitl_id: REVISION, decision: "aprobar" })
    expect(cuerpoDeResolucion(REVISION, "rechazar", "  Falta el presupuesto real ")).toEqual({ hitl_id: REVISION, decision: "rechazar", comentario: "Falta el presupuesto real" })
    expect(cuerpoDeResolucion(REVISION, "rechazar", "no")).toEqual({ error: "Cuenta qué debe cambiar (al menos 5 caracteres)" })
    expect(cuerpoDeResolucion(null, "aprobar", "")).toEqual({ error: "No hay una revisión del plan que decidir" })
    expect(cuerpoDeResolucion(REVISION, "aprobar", "x".repeat(1001))).toEqual({ error: "Máximo 1.000 caracteres" })
    for (const c of [cuerpoDeResolucion(REVISION, "aprobar", ""), cuerpoDeResolucion(REVISION, "rechazar", "Falta el presupuesto real")]) {
      const v = ACCIONES["revision-resolver"].validar(c as Record<string, unknown>)
      expect(v.ok).toBe(true)
    }
    expect(ACCIONES["revision-resolver"].gasta).toBeNull() // decidir el plan no gasta
  })
  it("la lectura pide lo real (campaña viva, el documento que señala la campaña, la última estrategia, las esperas vivas, la última revisión) y una base rota lanza", async () => {
    const fila = { id: CAMPANA, plan_id: "3dfcc12f-993e-478a-b884-f7df45ceaf77", client_id: CLIENTE, estado: "pausada", estado_motivo: "pausa", fecha_inicio: "2026-11-02", fecha_fin: "2027-01-30", sedes: ["olon"], presupuesto_planificacion_usd: 6, autoproducir: true, seco: false, creada_en: "2026-10-30T23:39:58Z", actualizada_en: null }
    const b = baseFalsa({
      clients: [{ id: CLIENTE, name: "Náufrago", industry: "restaurante", status: "active", archived_at: null }],
      cadena_campanas: [fila],
      client_historical_outputs: [{ id: "3dfcc12f-993e-478a-b884-f7df45ceaf77", title: "Plan de 90 dias · 2026-10-30", status: "draft", content_text: TEXTO_DEL_PLAN, content: null, provenance_tag: PROVENANCE, created_at: "2026-10-30T23:13:22Z", updated_at: null }],
      cadena_estrategias: [{ version: 1, estado: "validada", contenido: CONTENIDO, texto_md: null, costo_usd: "0.2499", creada_en: "2026-10-30T23:40:37Z" }],
      cadena_calendario_filas: (f: string[]) => (f.some((x) => x.includes("calendario_version")) ? [{ calendario_version: 1 }] : [{ id: "a" }, { id: "b" }]),
      cadena_esperas: (f: string[]) => (f.some((x) => x.includes('"vencida"')) ? [] : [{ objeto_tipo: "espera_video", motivo: "espera al brazo de video", vence_en: "2026-10-31T13:30:00Z", estado: "viva" }]),
      hitl_queue: [{ id: REVISION, title: "Plan con pendientes", status: "pending", decision: null, created_at: "2026-10-30T23:40:00Z", expires_at: null }],
    })
    const p = await leerPlanDelCliente(b, { cliente: CLIENTE, ahora: new Date("2026-11-05T15:00:00Z") })
    expect(p.cliente).toEqual({ id: CLIENTE, nombre: "Náufrago" })
    expect(p.campana).toMatchObject({ id: CAMPANA, estado: "pausada", sedes: ["olon"], tope_planeacion_usd: 6, autoproducir: true, publicaciones: 2, version_calendario: 1 })
    expect(p.estrategia).toMatchObject({ version: 1, estado: "validada", costo_usd: 0.2499 }); expect(p.estrategia!.fases.map((f) => f.clave)).toEqual(["senal", "recompra"])
    expect(p.fase_activa).toMatchObject({ situacion: "en_curso", dia: 4 })
    expect(p.documento).toMatchObject({ id: "3dfcc12f-993e-478a-b884-f7df45ceaf77", estado_del_plan: "con_pendientes", caracteres: TEXTO_DEL_PLAN.length }); expect(p.documento!.marcas.map((m) => m.codigo)).toEqual(["P3", "P4", "P10B"]); expect(p.documento!.plan!.meta_por_semana).toBe(115)
    expect(p.revision).toMatchObject({ id: REVISION, status: "pending", decision: null })
    expect(p.ciclo).toMatchObject({ disponible: true, version: 1, con_compuerta: false, compuerta: null, pedido: null }) // CC6 · ciclo del plan sobre la versión vigente
    // errores 4: la espera vencía el 31-oct y se lee el 5-nov → va aparte, como vencida (no se mezcla con las pendientes)
    expect(p.esperas).toEqual({ vivas: 0, grupos: [], vencidas: { n: 1, grupos: [{ tipo: "espera_video", etiqueta: tipoDeEsperaLegible("espera_video"), n: 1, vence_primero: "2026-10-31T13:30:00Z" }] } })
    expect(b.registro.join("\n")).toContain('cadena_esperas.eq("estado","vencida")'); expect(b.registro.join("\n")).toContain('plan_catalogo_topes.eq("vigente",true)')
    const r = b.registro.join("\n")
    expect(r).toContain('cadena_campanas.eq("seco",false)'); expect(r).toContain('client_historical_outputs.eq("output_type","campaign_plan_90d")'); expect(r).toContain('client_historical_outputs.eq("id","3dfcc12f-993e-478a-b884-f7df45ceaf77")') // el documento que señala la campaña, no «el último»
    expect(r).toContain('cadena_estrategias.order("version",{"ascending":false})'); expect(r).toContain('cadena_esperas.eq("estado","viva")'); expect(r).toContain('hitl_queue.eq("type","plan_con_pendientes")')
    // sin campaña: se lee igual el último documento del cliente y la revisión; lo demás se dice vacío
    const sin = await leerPlanDelCliente(baseFalsa({ clients: [{ id: CLIENTE, name: "Náufrago", industry: "restaurante", status: "active", archived_at: null }], cadena_campanas: [], client_historical_outputs: [{ id: "3dfcc12f-993e-478a-b884-f7df45ceaf77", title: "Plan", status: "draft", content_text: "Prosa del plan.", provenance_tag: {}, created_at: "2026-10-30T23:13:22Z" }], hitl_queue: [] }), { cliente: CLIENTE })
    expect(sin.campana).toBeNull(); expect(sin.estrategia).toBeNull(); expect(sin.documento).toMatchObject({ prosa: "Prosa del plan.", plan: null, marcas: [] }); expect(sin.esperas.vivas).toBe(0)
    // una base rota lanza: nunca «sin plan»
    const caida = Promise.resolve({ data: null, error: { message: "se cayó" } })
    const q: Record<string, unknown> = {}
    for (const n of ["select", "eq", "in", "is", "order", "limit", "gte", "neq"]) q[n] = () => q
    q.maybeSingle = () => caida; q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => caida.then(res, rej)
    const rota = { from: () => q } as unknown as Parameters<typeof leerPlanDelCliente>[0]
    await expect(leerPlanDelCliente(rota)).rejects.toThrow(/se cayó/)
  })
  it("el panel dibuja la portada, la decisión pendiente con sus marcas y botones, las fases, la meta, las redes, la semana tipo y lo que espera; sin revisión pendiente no hay botones", () => {
    const html = renderToStaticMarkup(createElement(PanelPlan, { onCerrar: () => {}, datosIniciales: datos }))
    expect(html).toContain('role="dialog"'); expect(html).toContain('data-seccion="plan"'); expect(html).toContain("Plan de 90 días"); expect(html).toContain("Náufrago")
    expect(html).toContain("campaña en pausa"); expect(html).toContain("pausa de pruebas por decisión del dueño"); expect(html).toContain("Día 4 · fase senal"); expect(html).toContain("estrategia validada"); expect(html).not.toContain("estrategia v1"); expect(html).toContain("Con puntos por resolver · 3")
    expect(html).not.toContain("Topes de la planeación"); expect(html).not.toContain("US$ 1,50"); expect(html).not.toContain("Tope de planeación"); // 01-nov (punto 8 de Emilio): el panel del plan no muestra dinero; el dinero va en Dinero
     expect(html).toContain("136"); expect(html).toContain("Guayaquil · Olón")
    // la decisión pendiente: las marcas del chequeo y los dos botones con las palabras de la bandeja
    expect(html).toContain('data-apartado="decision"'); expect(html).not.toContain(">P3<"); expect(html).toContain("lleva nombres internos"); expect(html).toContain("La jefatura dejó desacuerdos")
    expect(html).toContain('data-accion="plan-aprobar-asi"'); expect(html).toContain("Aprobar el plan así"); expect(html).toContain('data-accion="plan-pedir-cambios"'); expect(html).toContain("Pedir cambios al plan")
    expect(html).not.toContain('data-editor="plan-cambios"') // el formulario del porqué no está abierto de entrada
    // fases · meta · redes · pilares · semana tipo · lo dicho · esperas
    expect(html).toMatch(/data-fase="senal"[^>]*aria-current="step"|aria-current="step"[^>]*data-fase="senal"/); expect(html).toContain("Juntar señal de medición")
    expect(html).toContain("115 por semana · visita al local"); expect(html).toContain("Instagram y Facebook (Meta)"); expect(html).toContain("45 %"); expect(html).toContain("Se mantiene la meta"); expect(html).toContain("Lo que el plan declara que no sabe (2)")
    expect(html).toContain("10 publicaciones por semana · 4 feed · 5 historias · 1 anuncio"); expect(html).toMatch(/data-red="instagram" data-rol="principal"/); expect(html).toContain("no se usa")
    expect(html).toContain("Encebollado y ceviche"); expect(html).toContain("40 %")
    expect(html).toContain('aria-label="La semana tipo"'); expect(html).toContain("08:00 IG"); expect(html).toContain("Esta estrategia no fija hitos."); expect(html).toContain("lo busca el cerebro del cliente"); expect(html).toContain("por una sede")
    expect(html).toContain('data-espera="espera_video"'); expect(html).toContain("3 esperas vivas en total"); expect(html).toContain("Lo que no se buscó, y por qué"); expect(html).toContain("competidores precio")
    expect(html).not.toMatch(/meta_ig|con_pendientes|espera_video(?![^<]*")|mantengo_la_meta/) // nada crudo de la base en el texto visible
    // CC6 · ciclo del plan: un plan ya aprobado dice su estado y no ofrece botones (la nota vieja de la bandeja se sigue mostrando como dato)
    const decidido = renderToStaticMarkup(createElement(PanelPlan, { onCerrar: () => {}, datosIniciales: { ...datos, documento: { ...datos.documento!, status: "approved" }, revision: { ...datos.revision!, status: "approved", decision: "Aprobado así" } } }))
    expect(decidido).not.toContain('data-accion="plan-aprobar-asi"'); expect(decidido).toContain("Aprobado → pasa al brief"); expect(decidido).toContain("Aprobado así")
    // sin nada: se dice
    const nada = renderToStaticMarkup(createElement(PanelPlan, { onCerrar: () => {}, datosIniciales: { ...datos, campana: null, estrategia: null, documento: null, revision: null, esperas: { vivas: 0, grupos: [], vencidas: { n: 0, grupos: [] } }, topes: [] } }))
    expect(nada).toContain("todavía no tiene plan de 90 días ni campaña")
    const c = readFileSync("components/nuevo/PanelPlan.tsx", "utf8")
    expect(c).toContain("await enviar(accion, cuerpo)") // CC6 · decide SOLO por las puertas del ciclo vía el tablero (servidor valida · plataforma hace)
    expect(c).not.toContain("el plan en sí no cambia por esto")
    expect(c).not.toMatch(/supabase|service_role|from\("hitl_queue"\)|method: "POST"/) // el panel no toca la base ni arma POSTs propios
    expect(c).toContain("void leer(cliente)") // tras decidir se relee
    expect(c).toContain('window.addEventListener("keydown", tecla, true)') // Esc cierra el plan y no la oficina
    expect(c).toContain("@media (prefers-reduced-motion:reduce)")
  })
  it("el cuadro «Plan de 90 días» abre encima (botón) y el panel de aplicaciones monta el plan con el cliente elegido", () => {
    const html = renderToStaticMarkup(createElement(PanelAplicaciones, { onCerrar: () => {}, datosIniciales: null }))
    expect(html).toMatch(/<button type="button" data-aplicacion="plan"[^>]*aria-haspopup="dialog"/)
    const c = readFileSync("components/nuevo/PanelAplicaciones.tsx", "utf8")
    expect(c).toContain("<PanelPlan onCerrar={volverAlInicio} clienteInicial={cliente} />")
    const a = readFileSync("app/api/plan/route.ts", "utf8")
    expect(a).toContain("exigirAdmin()"); expect(a).toContain('"force-dynamic"'); expect(a).toContain("no-store")
  })
})
