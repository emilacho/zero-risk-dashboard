/**
 * Campaign creator · Zod schema + types · shared server/client.
 */
import { z } from "zod"

export const CAMPAIGN_OBJECTIVES = [
  "OUTCOME_TRAFFIC",
  "OUTCOME_AWARENESS",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_LEADS",
  "OUTCOME_SALES",
  "OUTCOME_APP_PROMOTION",
] as const

export const AUDIENCE_PRESETS = [
  "Olón surfers (cliente piloto Náufrago)",
  "Guayaquil B2B industrial buyers (Seg Ind Pérez)",
  "Custom · define en audience_config jsonb",
] as const

export const CampaignDraftSchema = z.object({
  client_id: z.string().uuid({ message: "client_id must be a valid UUID" }),
  objective: z.enum(CAMPAIGN_OBJECTIVES),
  daily_budget_usd: z
    .number({ message: "daily_budget_usd must be a number" })
    .positive("daily_budget_usd > 0")
    .max(10_000, "daily_budget_usd cap $10k/day · enterprise-only"),
  duration_days: z
    .number({ message: "duration_days must be an integer" })
    .int("integer only")
    .min(1, "at least 1 day")
    .max(180, "max 180 days"),
  audience_preset: z.string().min(1).max(200),
  creative_count: z.number().int().min(1).max(20),
  destination_url: z.string().url({ message: "destination_url must be a URL" }),
})

export type CampaignDraft = z.infer<typeof CampaignDraftSchema>

export interface CampaignRow {
  id: string
  created_at: string
  client_id: string
  objective: string
  daily_budget_usd: number
  duration_days: number
  audience_preset: string
  creative_count: number
  destination_url: string
  status: string
  meta_campaign_id: string | null
  meta_adset_id: string | null
  meta_creative_ids: string[] | null
  meta_ad_ids: string[] | null
  meta_ads_manager_url: string | null
  error_message: string | null
}
