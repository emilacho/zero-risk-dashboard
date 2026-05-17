/**
 * n8n workflow business-language descriptions · port from mission-control PR #25.
 *
 * Companion to `lib/n8n-workflow-titles.ts` (which handles workflow NAME
 * translation). This module returns a 1-2 line conversational Spanish
 * description ("QUÉ HACE") suitable for Emilio + future cliente surfaces.
 *
 * Lookup order:
 *   1 · workflow_id (n8n internal id · most stable when known)
 *   2 · raw_title verbatim match (lowercased)
 *   3 · translated_title verbatim match
 *   4 · null · UI hides the QUÉ HACE section
 *
 * Style guide:
 *   - 1-2 sentences max · 25-50 words total
 *   - Conversational · "tu" not "usted"
 *   - Concrete value verbs · "pausa", "espía", "arma", "documenta"
 *   - Avoid agent jargon · prefer "el sistema" o "los agentes"
 *   - Schedule cue first when relevant · "cada noche..." · "cuando entra cliente nuevo..."
 *
 * Phase 4 regression-safe · pure function · zero React imports · zero
 * callbacks · safe inside RSC / server components / client.
 */

/** Description map keyed by TRANSLATED title (post translateWorkflowTitle pass). */
const DESCRIPTIONS_BY_TRANSLATED: Record<string, string> = {
  "Optimizador Meta Ads · Diario 3am":
    "Cada noche revisa tus campañas activas · pausa las que pierden plata · sube presupuesto a las ganadoras.",
  "Monitoreo Competencia · Diario 6am":
    "Cada mañana espía qué hacen tus competidores en Instagram y Meta Ads · te avisa si encuentra algo importante.",
  "Onboarding Cliente · Cascade Landing":
    "Cuando entra cliente nuevo · arma su brand book · crea landing · escribe carruseles IG · todo automático.",
  "Onboarding Cliente E2E · Trigger Venta Cerrada":
    "Apenas se cierra una venta en GHL · dispara onboarding completo · auto-discovery · brand · primer campaign.",
  "Onboarding Cliente E2E":
    "Apenas se cierra una venta · dispara onboarding completo · auto-discovery · brand · primer campaign.",
  "Onboarding · alta de cliente":
    "Automatiza la alta inicial del cliente · datos básicos · brand discovery · setup carpeta Storage.",
  "Onboarding · pipeline completo":
    "Pipeline de onboarding end-to-end · auto-discovery + brand book + landing + primer campaign · sin intervención manual.",
  "Aprendizaje Sistémico · Semanal Lunes 9am":
    "Cada lunes los agentes revisan resultados de la semana · documentan qué funcionó · ajustan estrategia.",
  "Publicador Social Multi-Plataforma":
    "Publica el mismo contenido en Instagram · Facebook · TikTok · X · adapta formato por canal · todo en un solo paso.",
  "Refresco Creativo · Cada 6 horas":
    "Cada 6 horas detecta creativos quemados (CTR bajo · CPM alto) · pide al agente creativo nuevas variantes automáticamente.",
  "Ciclo de revisión creativa · cada 6 horas":
    "Cada 6 horas detecta creativos quemados (CTR bajo · CPM alto) · pide al agente creativo nuevas variantes automáticamente.",
  "Vigilante de Costos · Real-time":
    "Monitorea gasto Anthropic + Meta Ads + GHL en tiempo real · te avisa si algo se dispara fuera de presupuesto.",
  "Recolector Métricas Campañas":
    "Diariamente jala métricas de Meta + Google + TikTok Ads · las guarda para que el optimizador y los reportes las usen.",
  "Resumen Operativo · Diario":
    "Cada mañana te manda un resumen · campañas activas · spend del día · alertas · próximas tareas HITL.",
  "Escalación Pipeline Fallido":
    "Si un pipeline de cliente falla · te notifica + diagnóstica el error + propone fix sin que pierdas tiempo buscando.",
  "Recordatorio HITL · Tareas Pausadas":
    "Si una tarea está esperando tu revisión >24h · te recuerda · evita que se acumulen aprobaciones pendientes.",
  "Reanudación Pipeline · Demoras":
    "Detecta pipelines atascados >2h sin movimiento · les hace pull-and-resume automático · escala si vuelve a trabarse.",
  "Lead a Pipeline · Auto-Routing":
    "Cuando entra un lead nuevo · lo clasifica · arma su pipeline inicial · asigna prioridad · sin intervención manual.",
  "Captura de leads":
    "Captura leads desde formularios + landing pages + chatbots · los normaliza · los manda al pipeline correspondiente.",
  "Captura de leads · CRM":
    "Captura leads y los sincroniza directo al CRM (GoHighLevel) · sin perder data · campos auto-mapeados.",
  "Reporte QBR · Mensual":
    "Cada fin de mes arma reporte QBR para cada cliente · qué se hizo · qué resultados · qué viene · listo para enviar.",
  "Descubrimiento de marca":
    "Cuando un cliente entra · auto-explora su website + IG + competidores · arma propuesta de brand book inicial.",
  "Descubrimiento de Marca":
    "Cuando un cliente entra · auto-explora su website + IG + competidores · arma propuesta de brand book inicial.",
  "Brief Creativo de Anuncios":
    "Antes de cada campaña nueva · arma brief creativo completo · audiencia · ángulos · referencias · CTA · listo para creativo.",
  "Ruteo Publicación de Contenido":
    "Toma contenido aprobado y decide dónde publicarlo · IG feed · stories · TikTok · LinkedIn · según target del cliente.",
  "Meta-Agente · Cron Semanal":
    "El meta-agente coordina el aprendizaje sistémico de todos los demás agentes · 1 vez por semana · ajusta prompts.",
  "Atribución Closed-Loop":
    "Conecta cada conversión con el creativo + canal + campaign que la generó · cierra el loop atribución → optimización.",
  "Score de Salud del Cliente":
    "Calcula score de salud por cliente · NPS · engagement · pagos · uso · señala los que necesitan check-in proactivo.",
  "Creador Campañas Meta Ads":
    "Crea campañas Meta Ads completas (campaign + adset + ad) desde un brief · audiencia · creativo · budget · todo listo.",
  "Orquestador maestro de jornadas":
    "Coordina jornadas multi-agente complejas · asigna tareas · monitorea progreso · re-arma si algo se traba.",
  "Cascada principal · multi-agente":
    "Cascada principal de la agencia · brand → market → creative → web → content → editor · entrega bundle completo.",
  "Cascada · monitor diario":
    "Cada día revisa que la cascada principal corra OK · alerta si algún paso queda atascado >1h.",
  "Monitor diario":
    "Polling diario · health-check de pipelines + agentes + integraciones externas · alerta si algo se rompió.",
  "Camino III · QA tres-de-N":
    "Sistema de QA · 3 reviewers (jefe-client-success + brand-strategist + editor-en-jefe) votan sobre el output · si 2+ aprueban · pasa.",
  "Generador de playbooks":
    "Genera playbooks reusables a partir de cascadas exitosas · convierte ejecución única en blueprint replicable.",
  "Inteligencia competitiva":
    "Recolecta inteligencia competitiva multi-canal · ads · landing · social · pricing · arma reporte semanal.",
  "NEXUS · orquestador 7 fases":
    "Orquestador NEXUS · 7 fases de campaign · planning → research → creative → review → launch → monitor → optimize.",
  "Generador de campaign briefs":
    "Genera briefs de campaña completos · audiencia · objetivo · creativo · presupuesto · KPIs · todo en formato standard.",
  "Pasarela de aprobación · HITL":
    "Pasarela human-in-the-loop · pausa workflows hasta que un humano apruebe los outputs sensibles.",
}

/** Description map keyed by raw n8n title (fallback when translation didn't match). */
const DESCRIPTIONS_BY_RAW: Record<string, string> = {
  // Populate when a raw title needs override before translation normalizes it.
}

/** Description map keyed by workflow ID (most stable · use when known). */
const DESCRIPTIONS_BY_WORKFLOW_ID: Record<string, string> = {
  // Populate when workflow_id-specific overrides are needed · empty by default.
}

interface DescriptionLookup {
  workflow_id?: string | null
  raw_title?: string | null
  translated_title?: string | null
}

/**
 * Return the agency-friendly description for a workflow.
 *
 * Lookup order · workflow_id → raw_title → translated_title → null.
 *
 * Returns null when no description is registered · UI should hide the
 * "QUÉ HACE" section rather than show placeholder text.
 */
export function getWorkflowDescription(lookup: DescriptionLookup): string | null {
  if (lookup.workflow_id) {
    const byId = DESCRIPTIONS_BY_WORKFLOW_ID[lookup.workflow_id]
    if (byId) return byId
  }
  if (lookup.raw_title) {
    const byRaw = DESCRIPTIONS_BY_RAW[lookup.raw_title.trim().toLowerCase()]
    if (byRaw) return byRaw
  }
  if (lookup.translated_title) {
    const byTranslated = DESCRIPTIONS_BY_TRANSLATED[lookup.translated_title.trim()]
    if (byTranslated) return byTranslated
  }
  return null
}

/** Total count of registered descriptions · surface coverage metric. */
export function getDescriptionCoverageCount(): number {
  return (
    Object.keys(DESCRIPTIONS_BY_WORKFLOW_ID).length +
    Object.keys(DESCRIPTIONS_BY_RAW).length +
    Object.keys(DESCRIPTIONS_BY_TRANSLATED).length
  )
}

/** All known translated titles that have descriptions · debugging affordance. */
export function listDescribedTitles(): string[] {
  return Object.keys(DESCRIPTIONS_BY_TRANSLATED).sort()
}
