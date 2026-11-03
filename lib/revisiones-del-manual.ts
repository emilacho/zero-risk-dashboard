/**
 * LAS REVISIONES DEL EDITOR DE UNA SECCIÓN DEL MANUAL (CC6 · 02-nov · auditoría de Lenovo, punto 3, aprobada por Emilio).
 * Antes salían en Piezas › Otras revisiones; ahora viven en el panel del Manual del cliente, en la sección a la que pertenecen, legibles:
 *  - sin el monólogo del agente («Voy a cargar el esquema del tool antes de llamarlo…»);
 *  - con los nombres de campo en español (`voice_description` → Voz de la marca);
 *  - con negritas y viñetas de verdad (no los ** a la vista);
 *  - con el costo de producirlas (la llamada del mismo empleado que terminó cuando nació la revisión; si no se encuentra, se dice).
 */
import type { SupabaseClient } from "@supabase/supabase-js"

export interface RevisionDelEditor { id: string; creada: string; agente: string | null; claves: string[]; texto: string; costo_usd: number | null; pista: string | null }
type Fila = Record<string, unknown>
const texto = (v: unknown): string => (typeof v === "string" ? v : "")

/** quita el monólogo del agente del principio: todo hasta la primera raya «---», o las frases de «voy a / tengo / emito / sección emitida…» */
export function sinMonologo(t: string): string {
  const s = t.replace(/\r/g, "")
  const raya = s.search(/\n\s*-{3,}\s*\n/)
  if (raya >= 0 && raya < 700) return s.slice(raya).replace(/^\s*\n\s*-{3,}\s*\n/, "").trim()
  let r = s.trimStart(), antes = ""
  while (r !== antes) { antes = r; r = r.replace(/^(voy a|tengo|emito|ahora|primero|listo|sección emitida|esto es lo que)[^.\n]*[.:]\s*/i, "") }
  return r.trim()
}

/** frases de monólogo que el agente deja en medio o al principio de la revisión: «Analizando…», «Sección emitida», «el consolidador la tiene», «aquí el resumen de lo que construí…» */
const MONOLOGO = /^(analizando|preparando|sección emitida|secci[oó]n entregada|el consolidador|aquí (está|va|el|te)|a continuación|resumen de lo que|esto es lo que)\b/i
/**
 * 03-nov (Lenovo) · el cuerpo de una revisión solo dice QUÉ cambió y POR QUÉ: sin monólogo, sin códigos de segmento (S1–S5), sin «ICP» ni nombres técnicos de empleados o piezas.
 */
export function limpiarParaLeer(t: string): string {
  const frases = (linea: string) => linea.split(/(?<=[.!?:])\s+/).filter((f) => !MONOLOGO.test(f.trim()))
  const lineas = t.replace(/\r/g, "").split("\n").map((l) => (/^\s*([-*•]|#{1,6})\s/.test(l) ? l : frases(l).join(" "))).map((l) => l
    .replace(/\s*\(\s*(?:S[1-9]\s*(?:[–\-,y/]\s*)?)+\)/gi, "")
    .replace(/\bS[1-9]\s*[–-]\s*S[1-9]\b/gi, "los segmentos")
    .replace(/\b(segmentos?) S[1-9]\b/gi, "$1")
    .replace(/\bS[1-9]\b/g, "ese segmento")
    .replace(/\bcliente ideal\s*\(\s*ICPs?\s*\)/gi, "cliente ideal")
    .replace(/\bICPs?\b/g, "cliente ideal")
    .replace(/[«"]?\b(?:content-creator|brand-strategist|editor-en-jefe|jefe-[a-z-]+|[a-z]+-[a-z]+-mesa)\b[»"]?/gi, "el equipo")
    .replace(/\bconsolidador\b/gi, "equipo")
    .replace(/\bbrand book\b/gi, "manual de la marca")
    .replace(/[ \t]{2,}/g, " ").trimEnd())
  return lineas.filter((l, i) => l.trim() || (i > 0 && lineas[i - 1].trim())).join("\n").trim()
}

/** nombres de campos del manual que el lector no lista (palabras, términos, mensajes…): en español, como los ve Emilio */
export const NOMBRES_DEL_MANUAL: Record<string, string> = {
  forbidden_words: "Palabras a evitar", required_terminology: "Términos propios", personalidad: "Personalidad", mensajes_clave: "Mensajes clave",
  palabras_con_intencion: "Palabras con intención", competitor_mentions_policy: "Política sobre competidores", apify_sources: "Fuentes de redes y mapas",
  materia_cliente: "Lo que se sabe del cliente", tagline_opciones: "Opciones de eslogan", valores: "Valores", nunca_hace: "Lo que la marca nunca dice o hace",
}
/** los nombres de campo entre comillas invertidas, en español (primero los del manual de arriba, luego la etiqueta del lector); el resto de comillas invertidas, fuera */
export function nombresEnEspanol(t: string, etiquetaDe: (clave: string) => { etiqueta: string }): string {
  return t.replace(/`([a-z][a-z0-9_]{2,40})`/g, (_m, k: string) => NOMBRES_DEL_MANUAL[k] ?? etiquetaDe(k).etiqueta).replace(/`([^`\n]{1,200})`/g, "«$1»").replace(/`/g, "")
}

/** las secciones de las que el empleado es dueño, según su encargo («Eres el DUEÑO de estas secciones…: a, b, c.»); si no, las que nombra en su texto */
export function clavesDeLaRevision(encargo: string, cuerpo: string): string[] {
  const m = /DUEÑO de estas secciones[^:]*:\s*([a-z0-9_,\s]+)\./i.exec(encargo)
  if (m) return m[1].split(",").map((x) => x.trim()).filter((x) => /^[a-z][a-z0-9_]{2,40}$/.test(x))
  return [...new Set([...cuerpo.matchAll(/`([a-z][a-z0-9_]{2,40})`/g)].map((x) => x[1]))]
}

/** el texto en bloques para pintarlo con formato: párrafos, viñetas y negritas */
export type Trozo = { texto: string; negrita: boolean }
export type Bloque = { tipo: "parrafo" | "vineta"; trozos: Trozo[] }
export function bloquesDelTexto(t: string): Bloque[] {
  const trozos = (linea: string): Trozo[] => linea.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((x) => (/^\*\*[^*]+\*\*$/.test(x) ? { texto: x.slice(2, -2), negrita: true } : { texto: x.replace(/\*\*/g, ""), negrita: false }))
  return t.split("\n").map((l) => l.trim()).filter((l) => l && !/^-{3,}$/.test(l)).map((l) => (/^[-*•]\s+/.test(l) ? { tipo: "vineta" as const, trozos: trozos(l.replace(/^[-*•]\s+/, "")) } : { tipo: "parrafo" as const, trozos: trozos(l.replace(/^#{1,6}\s*/, "")) }))
}

/** las revisiones del editor PENDIENTES del cliente, legibles y con su costo; si una lectura falla, la del costo queda en «sin dato» (no se inventa) */
export async function leerRevisionesDelEditor(supa: SupabaseClient, clienteId: string, etiquetaDe: (clave: string) => { clave: string; etiqueta: string }): Promise<RevisionDelEditor[]> {
  const r = await supa.from("hitl_queue").select("id, created_at, agent_name, output_preview, metadata").eq("client_id", clienteId).eq("type", "editor_escalation").eq("status", "pending").order("created_at", { ascending: false }).limit(20)
  if (r.error) throw new Error(`hitl_queue: ${r.error.message}`)
  const filas = (r.data ?? []) as Fila[]
  if (!filas.length) return []
  const desde = new Date(Math.min(...filas.map((f) => Date.parse(String(f.created_at)))) - 15 * 60_000).toISOString()
  const inv = await supa.from("agent_invocations").select("agent_name, ended_at, cost_usd").eq("client_id", clienteId).gte("ended_at", desde).limit(500)
  const llamadas = inv.error ? [] : ((inv.data ?? []) as Fila[])
  return filas.map((f) => {
    const meta = (f.metadata && typeof f.metadata === "object" ? f.metadata : {}) as Fila
    const ed = (meta.editor && typeof meta.editor === "object" ? meta.editor : {}) as Fila
    const crudo = texto(ed.full_content) || texto(f.output_preview)
    const creada = String(f.created_at), agente = f.agent_name ? String(f.agent_name) : null
    // la llamada del mismo empleado que terminó a menos de 1 minuto de nacer la revisión: lo que costó producirla
    const t0 = Date.parse(creada)
    const llamada = llamadas.filter((l) => String(l.agent_name) === agente && Math.abs(Date.parse(String(l.ended_at)) - t0) <= 60_000).sort((a, b) => Math.abs(Date.parse(String(a.ended_at)) - t0) - Math.abs(Date.parse(String(b.ended_at)) - t0))[0]
    const veredicto = (ed.editor_verdict && typeof ed.editor_verdict === "object" ? ed.editor_verdict : {}) as Fila
    const sinRevisores = Array.isArray(veredicto.issues) && veredicto.issues.some((x) => /unavailable/i.test(String(x)))
    return {
      id: String(f.id), creada, agente,
      claves: clavesDeLaRevision(texto(ed.original_task), crudo).map((k) => etiquetaDe(k).clave),
      texto: limpiarParaLeer(nombresEnEspanol(sinMonologo(crudo), etiquetaDe)),
      costo_usd: llamada && llamada.cost_usd != null ? Number(llamada.cost_usd) : null,
      pista: sinRevisores ? "Te llega para que lo veas; nadie marcó un problema." : null,
    }
  })
}
