/**
 * MANUAL PRIMERO (CC6 · 03-nov · encargo de Lenovo «el plan no se firma antes del manual», regla de Emilio 14:46Z).
 * Un plan no se firma antes de que el dueño apruebe el manual vigente del cliente: mientras tanto el plan no «espera tu firma», espera el manual.
 * Una regla para cualquier cliente. La puerta de la plataforma la aplica CC1 (`planDecidible`); aquí, lo que el tablero cuenta y muestra.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { quienValido } from "@/lib/manual-lector"
import { leerElCiclo } from "@/lib/plan"
import { estadoDeCampanaLegible } from "@/lib/lenguaje"
import type { PlanDelCliente } from "@/lib/plan-datos"

type Fila = Record<string, unknown>

/** el texto único (pizarrón y panel del Plan dicen lo mismo) */
export const PLAN_ESPERA_EL_MANUAL = "Plan: espera que apruebes el manual"

/**
 * ¿el dueño aprobó el manual VIGENTE (última versión) de cada cliente? true / false; null = no se pudo saber (o no tiene manual).
 * Si la lectura falla, todos quedan en null: no se esconde nada por un error.
 */
export async function manualAprobadoPorCliente(supa: SupabaseClient, clientes: string[]): Promise<Map<string, boolean | null>> {
  const ids = [...new Set(clientes.filter(Boolean))]
  const out = new Map<string, boolean | null>(ids.map((c) => [c, null]))
  if (!ids.length) return out
  const r = await supa.from("client_brand_books").select("client_id, version, human_validated, provenance_tag").in("client_id", ids).order("version", { ascending: false }).limit(1000)
  if (r.error) return out
  const visto = new Set<string>()
  for (const f of (r.data ?? []) as Fila[]) {
    const c = String(f.client_id)
    if (visto.has(c)) continue // la primera de cada cliente es la vigente (orden por versión, de mayor a menor)
    visto.add(c)
    out.set(c, quienValido(f as never) === "dueno")
  }
  return out
}

/** lo que de verdad espera la firma de Emilio: un plan de un cliente con el manual SIN aprobar no cuenta (lo que no se sabe, sí cuenta) */
export function esperaLaFirma(fila: { documento?: unknown; client_id?: unknown }, aprobado: Map<string, boolean | null>): boolean {
  if (fila.documento !== "plan") return true
  return aprobado.get(String(fila.client_id ?? "")) !== false
}

/** los días que el plan PROMETE: los de su nombre («Plan de 90 dias · …»); sin número, 90 (el producto se llama «Plan de 90 días») */
export function diasPrometidos(titulo: string | null | undefined): number {
  const m = String(titulo ?? "").match(/(\d{2,3})\s*d[ií]as/i)
  const n = m ? Number(m[1]) : NaN
  return Number.isFinite(n) && n > 0 ? n : 90
}

/** si el plan cubre menos de lo que promete, se dice en palabras simples (Lenovo 20:37Z: no se cambia el nombre del plan) */
export function coberturaDelPlan(dias: number, prometidos: number): string | null {
  if (!(dias > 0) || dias >= prometidos) return null
  const semanas = Math.round(dias / 7)
  const cuanto = dias % 7 === 0 ? `${semanas} ${semanas === 1 ? "semana" : "semanas"} (${dias} de los ${prometidos} días)` : `${dias} de los ${prometidos} días`
  return `Este plan solo cubre ${cuanto}.`
}

/**
 * EL ESTADO DEL PLAN EN UNA LÍNEA · UNA sola función para todo texto que diga en qué está el plan (corrección de Lenovo 21:15Z: la línea de la escena
 * decía «plan esperando tu decisión» con el manual sin aprobar). La usan la línea de contexto de la escena y la cabecera del Calendario; el pizarrón,
 * el panel y la barra del Plan dicen el mismo `PLAN_ESPERA_EL_MANUAL`. Manual primero: si el manual del cliente no está aprobado, eso manda.
 */
export function estadoDelPlan(p: Pick<PlanDelCliente, "documento" | "ciclo" | "campana" | "manual_aprobado">): { clave: string; texto: string } {
  if (p.manual_aprobado === false && (p.documento || p.campana)) return { clave: "espera_el_manual", texto: PLAN_ESPERA_EL_MANUAL.charAt(0).toLowerCase() + PLAN_ESPERA_EL_MANUAL.slice(1) }
  if (p.documento && p.ciclo) {
    switch (leerElCiclo(p.documento.status, p.ciclo).estado) {
      case "esperando_decision": return { clave: "esperando_decision", texto: "plan esperando tu decisión" }
      case "reescribiendo": return { clave: "reescribiendo", texto: "plan en reescritura" }
      case "en_revision": return { clave: "en_revision", texto: "plan en revisión de la jefatura" }
      case "aprobado": return { clave: "aprobado", texto: "plan aprobado · sigue el brief" }
      default: return { clave: "en_marcha", texto: "plan en marcha" }
    }
  }
  if (p.campana) return { clave: "campana", texto: `campaña ${estadoDeCampanaLegible(p.campana.estado)}` }
  return { clave: "sin_plan", texto: "todavía sin plan" }
}
