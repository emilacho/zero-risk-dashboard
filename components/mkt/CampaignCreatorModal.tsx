"use client"
/**
 * CampaignCreatorModal · MKT campaign creator form.
 *
 *   - Radix dialog · trigger button "+ Nueva campaña"
 *   - react-hook-form + zod validation per `lib/campaigns.ts` schema
 *   - Submits to `/api/admin/campaigns/create` (admin auth in middleware
 *     · INTERNAL_API_KEY fallback for n8n)
 *   - Inline success panel · shows campaign_id + status + meta IDs (null
 *     until n8n consumes the queued row and creates real Meta campaign)
 *
 * NO function-prop callbacks crossing server→client boundary · the form
 * is fully client-side except the list which is pre-rendered server-side
 * and passed primitive prop arrays.
 */
import { useState, type FormEvent } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import {
  Send,
  Plus,
  Loader2,
  Check,
  X,
  ExternalLink,
  CircleAlert,
} from "lucide-react"
import {
  CAMPAIGN_OBJECTIVES,
  AUDIENCE_PRESETS,
  type CampaignRow,
} from "@/lib/campaigns"
import { CoworkContextChat } from "@/components/cowork/CoworkContextChat"

interface ClientOption {
  id: string
  name: string
}

interface CampaignCreatorModalProps {
  clients: ClientOption[]
}

export function CampaignCreatorModal({ clients }: CampaignCreatorModalProps) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<"idle" | "submitting" | "ok" | "error">("idle")
  const [resultCampaign, setResultCampaign] = useState<CampaignRow | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [errMsg, setErrMsg] = useState<string | null>(null)

  // Form state (controlled inputs · no react-hook-form to keep bundle
  // minimal · zod validation lives server-side via POST endpoint).
  const [clientId, setClientId] = useState(clients[0]?.id ?? "")
  const [objective, setObjective] = useState<(typeof CAMPAIGN_OBJECTIVES)[number]>("OUTCOME_TRAFFIC")
  const [dailyBudget, setDailyBudget] = useState("10")
  const [durationDays, setDurationDays] = useState("7")
  const [audiencePreset, setAudiencePreset] = useState<string>(AUDIENCE_PRESETS[0])
  const [creativeCount, setCreativeCount] = useState("3")
  const [destinationUrl, setDestinationUrl] = useState("https://naufrago.ec/menu")

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState("submitting")
    setErrors({})
    setErrMsg(null)

    const payload = {
      client_id: clientId,
      objective,
      daily_budget_usd: Number(dailyBudget),
      duration_days: Number(durationDays),
      audience_preset: audiencePreset,
      creative_count: Number(creativeCount),
      destination_url: destinationUrl,
    }

    try {
      const res = await fetch("/api/admin/campaigns/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as {
        ok: boolean
        campaign?: CampaignRow
        error?: string
        details?: { fieldErrors?: Record<string, string[]> }
      }
      if (!res.ok || !json.ok) {
        setState("error")
        if (json.details?.fieldErrors) {
          const flat: Record<string, string> = {}
          for (const [k, v] of Object.entries(json.details.fieldErrors)) {
            flat[k] = Array.isArray(v) ? v.join(" · ") : String(v)
          }
          setErrors(flat)
        }
        setErrMsg(json.error ?? `HTTP ${res.status}`)
        return
      }
      setResultCampaign(json.campaign ?? null)
      setState("ok")
    } catch (e) {
      setState("error")
      setErrMsg(e instanceof Error ? e.message : "network_error")
    }
  }

  function reset() {
    setState("idle")
    setResultCampaign(null)
    setErrors({})
    setErrMsg(null)
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="shimmer-btn inline-flex items-center gap-2"
        >
          <Plus strokeWidth={1.5} className="h-3.5 w-3.5" />
          Nueva campaña
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm data-[state=open]:animate-blur-fade" />
        <Dialog.Content
          className="surface-card rim-instr fixed left-1/2 top-1/2 z-[71] flex max-h-[90vh] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto p-6"
          data-rim="cyan"
        >
          <div className="relative z-[2]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p
                  className="num text-[10px] uppercase tracking-[0.22em]"
                  style={{ color: "hsl(var(--accent))" }}
                >
                  MKT · Brazo 3 build
                </p>
                <Dialog.Title className="font-display text-xl font-semibold tracking-tight">
                  Nueva campaña Meta Ads
                </Dialog.Title>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--primary-glow)/0.08)]"
                >
                  <X strokeWidth={1.5} className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            {state === "ok" && resultCampaign ? (
              <ResultPanel campaign={resultCampaign} onClose={() => setOpen(false)} />
            ) : (
              <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
                <Field
                  label="Cliente"
                  error={errors["client_id"]}
                >
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--card)/0.6)] px-3 py-2 text-sm outline-none transition focus:border-[hsl(var(--accent)/0.6)]"
                    required
                  >
                    {clients.length === 0 ? (
                      <option value="">(no clients · cleanup pending)</option>
                    ) : (
                      clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    )}
                  </select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Objetivo" error={errors["objective"]}>
                    <select
                      value={objective}
                      onChange={(e) => setObjective(e.target.value as typeof objective)}
                      className="w-full rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--card)/0.6)] px-3 py-2 text-sm outline-none transition focus:border-[hsl(var(--accent)/0.6)]"
                    >
                      {CAMPAIGN_OBJECTIVES.map((o) => (
                        <option key={o} value={o}>
                          {o.replace("OUTCOME_", "")}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Daily budget USD" error={errors["daily_budget_usd"]}>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={dailyBudget}
                      onChange={(e) => setDailyBudget(e.target.value)}
                      className="w-full rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--card)/0.6)] px-3 py-2 text-sm outline-none transition focus:border-[hsl(var(--accent)/0.6)]"
                    />
                  </Field>
                  <Field label="Duration (days)" error={errors["duration_days"]}>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="180"
                      value={durationDays}
                      onChange={(e) => setDurationDays(e.target.value)}
                      className="w-full rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--card)/0.6)] px-3 py-2 text-sm outline-none transition focus:border-[hsl(var(--accent)/0.6)]"
                    />
                  </Field>
                  <Field label="Creative count" error={errors["creative_count"]}>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="20"
                      value={creativeCount}
                      onChange={(e) => setCreativeCount(e.target.value)}
                      className="w-full rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--card)/0.6)] px-3 py-2 text-sm outline-none transition focus:border-[hsl(var(--accent)/0.6)]"
                    />
                  </Field>
                </div>

                <Field label="Audience preset" error={errors["audience_preset"]}>
                  <input
                    type="text"
                    value={audiencePreset}
                    onChange={(e) => setAudiencePreset(e.target.value)}
                    className="w-full rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--card)/0.6)] px-3 py-2 text-sm outline-none transition focus:border-[hsl(var(--accent)/0.6)]"
                  />
                  <div className="mt-1 flex flex-wrap gap-1">
                    {AUDIENCE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAudiencePreset(preset)}
                        className="num rounded-full border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.4)] px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--accent)/0.5)] hover:text-foreground"
                      >
                        {preset.split(" (")[0]}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Destination URL" error={errors["destination_url"]}>
                  <input
                    type="url"
                    value={destinationUrl}
                    onChange={(e) => setDestinationUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-md border-[0.5px] border-[hsl(var(--primary-glow)/0.3)] bg-[hsl(var(--card)/0.6)] px-3 py-2 text-sm outline-none transition focus:border-[hsl(var(--accent)/0.6)]"
                  />
                </Field>

                {state === "error" && errMsg ? (
                  <div className="flex items-start gap-2 rounded-md border-[0.5px] border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.08)] px-3 py-2 text-[11px] text-[hsl(var(--danger))]">
                    <CircleAlert strokeWidth={1.5} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{errMsg}</span>
                  </div>
                ) : null}

                <p className="num text-[10px] text-[hsl(var(--muted-foreground))]">
                  Status default · <code className="font-mono">draft</code> · queueable después · status=&apos;paused&apos; siempre cuando real
                  Meta API se llame (NO live auto-launch).
                </p>

                {/* STEP 8 · Cowork inline chat · contextual al cliente + form state */}
                {clientId ? (
                  <CoworkContextChat
                    channel="campaign_modal"
                    clientId={clientId}
                    clientName={clients.find((c) => c.id === clientId)?.name}
                    formState={{
                      client_id: clientId,
                      objective,
                      daily_budget_usd: Number(dailyBudget),
                      duration_days: Number(durationDays),
                      audience_preset: audiencePreset,
                      creative_count: Number(creativeCount),
                      destination_url: destinationUrl,
                    }}
                    onApplySuggestion={(updates) => {
                      if (typeof updates.objective === "string") {
                        const next = updates.objective as (typeof CAMPAIGN_OBJECTIVES)[number]
                        if (CAMPAIGN_OBJECTIVES.includes(next)) setObjective(next)
                      }
                      if (typeof updates.daily_budget_usd === "number") {
                        setDailyBudget(String(updates.daily_budget_usd))
                      }
                      if (typeof updates.duration_days === "number") {
                        setDurationDays(String(updates.duration_days))
                      }
                      if (typeof updates.audience_preset === "string") {
                        setAudiencePreset(updates.audience_preset)
                      }
                      if (typeof updates.creative_count === "number") {
                        setCreativeCount(String(updates.creative_count))
                      }
                      if (typeof updates.destination_url === "string") {
                        setDestinationUrl(updates.destination_url)
                      }
                    }}
                  />
                ) : null}

                <div className="mt-2 flex items-center justify-end gap-2">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="num rounded-md border-[0.5px] border-[hsl(var(--border))] px-3 py-2 text-[12px] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--primary-glow)/0.06)] hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={state === "submitting" || !clientId}
                    className="shimmer-btn inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {state === "submitting" ? (
                      <Loader2 strokeWidth={1.5} className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send strokeWidth={1.5} className="h-3.5 w-3.5" />
                    )}
                    Create draft
                  </button>
                </div>
              </form>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      {children}
      {error ? (
        <span className="num text-[10px] text-[hsl(var(--danger))]">{error}</span>
      ) : null}
    </label>
  )
}

function ResultPanel({
  campaign,
  onClose,
}: {
  campaign: CampaignRow
  onClose: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-md border-[0.5px] border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.08)] px-3 py-2">
        <Check strokeWidth={1.5} className="h-4 w-4 text-[hsl(var(--success))]" />
        <span className="text-[12px] text-[hsl(var(--success))]">
          Draft creado · status=<code className="font-mono">{campaign.status}</code>
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-[12px]">
        <Detail label="campaign_id" value={campaign.id.slice(0, 8) + "…"} />
        <Detail label="meta_campaign_id" value={campaign.meta_campaign_id ?? "—"} />
        <Detail label="meta_adset_id" value={campaign.meta_adset_id ?? "—"} />
        <Detail
          label="creatives"
          value={
            campaign.meta_creative_ids?.length
              ? campaign.meta_creative_ids.length + " IDs"
              : "—"
          }
        />
        <Detail
          label="ads"
          value={campaign.meta_ad_ids?.length ? campaign.meta_ad_ids.length + " IDs" : "—"}
        />
        <Detail label="status" value={campaign.status} />
      </dl>
      {campaign.meta_ads_manager_url ? (
        <a
          href={campaign.meta_ads_manager_url}
          target="_blank"
          rel="noreferrer"
          className="num inline-flex items-center gap-1 self-start text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:text-foreground"
        >
          open in Meta Ads Manager
          <ExternalLink strokeWidth={1.5} className="h-3 w-3" />
        </a>
      ) : (
        <p className="num text-[10px] text-[hsl(var(--muted-foreground))]">
          Meta IDs y Ads Manager URL aparecen cuando n8n workflow consuma
          el queued row (Brazo 3 build phase · Facebook App pending).
        </p>
      )}
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="num rounded-md border-[0.5px] border-[hsl(var(--border))] px-3 py-2 text-[12px] text-[hsl(var(--muted-foreground))] hover:text-foreground"
        >
          Close
        </button>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="num text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
        {label}
      </dt>
      <dd className="num text-[12px] tabular-nums">{value}</dd>
    </div>
  )
}
