export const KANBAN_COLUMNS = [
  "discovery",
  "onboarding",
  "content",
  "optimizing",
  "reporting",
  "renewal",
] as const

export type KanbanColumn = (typeof KANBAN_COLUMNS)[number]

/**
 * Canonical UI labels per dispatch + Sprint 5 refactor (2026-05-21).
 * Source table is `client_journey_state` per decision doc
 * `pipeline-canonical-table-client-journey-state` 2026-05-21.
 */
export const COLUMN_LABEL: Record<KanbanColumn, string> = {
  discovery: "Discovery",
  onboarding: "Onboarding",
  content: "Production",
  optimizing: "Optimization",
  reporting: "Reporting",
  renewal: "Renewal",
}

export interface JourneyCard {
  id: string
  client_id: string
  client_slug: string | null
  client_name: string
  /** Source journey value (ONBOARD · CONTENT · OPTIMIZE · REPORT · RENEWAL). */
  journey: string
  /** Granular stage label (free-form text from L1). */
  current_stage: string | null
  /** active · paused · completed · failed. */
  status: string
  trigger_type: string | null
  trigger_source: string | null
  pending_hitl: number
  started_at: string
  last_activity_at: string | null
  completed_at: string | null
  /** The kanban column the row currently belongs to. */
  column: KanbanColumn
}

export interface PipelineResponse {
  ok: true
  columns: Record<KanbanColumn, JourneyCard[]>
  total: number
  states: KanbanColumn[]
  source_table: "client_journey_state"
}
