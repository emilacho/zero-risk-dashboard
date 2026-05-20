export const JOURNEY_STATES = [
  "discovery",
  "onboarding",
  "content",
  "optimizing",
  "reporting",
  "renewal",
  "churned",
] as const

export type JourneyState = (typeof JOURNEY_STATES)[number]

/**
 * Canonical UI labels per dispatch 2026-05-20 ·
 * DB check constraint locks the underlying value names · the labels here
 * are what the kanban columns display.
 */
export const STATE_LABEL: Record<JourneyState, string> = {
  discovery: "Discovery",
  onboarding: "Onboarding",
  content: "Production",
  optimizing: "Optimization",
  reporting: "Reporting",
  renewal: "Renewal",
  churned: "Churned",
}

export const STATE_HUE: Record<JourneyState, string> = {
  discovery: "cyan",
  onboarding: "emerald",
  content: "violet",
  optimizing: "amber",
  reporting: "blue",
  renewal: "fuchsia",
  churned: "muted",
}

export interface JourneyCard {
  id: string
  client_id: string
  client_slug: string | null
  client_name: string
  journey_state: JourneyState
  stage: string | null
  started_at: string
  last_activity_at: string | null
  current_step: number | null
  total_steps: number | null
  pending_hitl: number
  metadata: Record<string, unknown> | null
}

export interface PipelineResponse {
  ok: true
  columns: Record<JourneyState, JourneyCard[]>
  total: number
  states: JourneyState[]
}
