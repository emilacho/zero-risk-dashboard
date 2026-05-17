import { getServiceRoleClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

interface CoworkMsg {
  id: string
  created_at: string
  sender_user_id: string | null
  content: string
  status: string
}

async function loadInboxData() {
  const supa = getServiceRoleClient()
  const [hitl, cowork] = await Promise.all([
    supa
      .from("hitl_approvals")
      .select("id, status", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(20),
    supa
      .from("cowork_messages")
      .select("id, created_at, sender_user_id, content, status")
      .order("created_at", { ascending: false })
      .limit(20),
  ])
  return {
    hitlCount: hitl.count ?? 0,
    coworkMessages: (cowork.data ?? []) as CoworkMsg[],
  }
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return "just now"
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return `${Math.floor(ms / 86_400_000)}d ago`
}

export default async function SystemInboxTab() {
  const { hitlCount, coworkMessages } = await loadInboxData()
  const coworkPending = coworkMessages.filter((m) => m.status === "pending").length

  return (
    <div className="flex flex-col gap-6">
      <span className="eyebrow-chip">
        <span className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
        Inbox aggregator · HITL · Cowork chat · Slack · Sentry · UptimeRobot
      </span>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <InboxStat label="HITL pending" value={hitlCount} hue="rose" sub="hitl_approvals · status=pending" />
        <InboxStat
          label="Cowork pending"
          value={coworkPending}
          hue="cyan"
          sub={`${coworkMessages.length} total messages`}
        />
        <InboxStat label="Slack #equipo" value="—" hue="orange" sub="wire pending · Slack Web API" />
        <InboxStat label="Sentry 24h" value="—" hue="violet" sub="wire pending · Sentry API" />
        <InboxStat label="UptimeRobot" value="—" hue="emerald" sub="wire pending · UptimeRobot API" />
      </div>

      {/* Cowork messages list */}
      <section className="surface-card rim-instr p-5" data-rim="cyan">
        <div className="relative z-[2]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold tracking-tight">
              Cowork messages · {coworkMessages.length} recent
            </h2>
            <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
              POST /api/cowork/message · GET /api/cowork/messages?status=pending
            </span>
          </div>
          {coworkMessages.length === 0 ? (
            <p className="num text-xs text-[hsl(var(--muted-foreground))]">
              No Cowork messages yet · the floating chat button bottom-right
              writes here.
            </p>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border)/0.6)]">
              {coworkMessages.map((m) => (
                <li key={m.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="num text-[9px] uppercase tracking-[0.18em]"
                        style={{
                          color:
                            m.status === "pending"
                              ? "hsl(var(--danger))"
                              : m.status === "read"
                                ? "hsl(var(--hue-amber))"
                                : "hsl(var(--success))",
                        }}
                      >
                        {m.status}
                      </span>
                      <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
                        from {m.sender_user_id ?? "—"}
                      </span>
                    </div>
                    <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
                      {relativeTime(m.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-foreground/90">
                    {m.content.length > 200
                      ? m.content.slice(0, 200) + "…"
                      : m.content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* HITL placeholder */}
      <section className="surface-card rim-instr p-5" data-rim="rose">
        <div className="relative z-[2]">
          <h2 className="font-display text-base font-semibold tracking-tight">
            HITL queue · {hitlCount} items
          </h2>
          <p className="mt-2 text-[12px] text-[hsl(var(--muted-foreground))]">
            <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--danger))]">
              wire pending
            </span>{" "}
            · `hitl_approvals` table created STEP 1 · agent runtime needs
            to start inserting rows when revision_needed o approval-required
            verdicts fire from QA cascade.
          </p>
        </div>
      </section>
    </div>
  )
}

function InboxStat({
  label,
  value,
  hue,
  sub,
}: {
  label: string
  value: number | string
  hue: "violet" | "cyan" | "amber" | "emerald" | "rose" | "orange" | "purple" | "teal" | "sky" | "lime"
  sub: string
}) {
  return (
    <div
      className="surface-card rim-instr p-3"
      data-rim={hue}
      data-pop="true"
    >
      <div className="relative z-[2]">
        <p className="num text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
          {label}
        </p>
        <p className="num mt-1 font-display text-xl font-semibold tabular-nums">
          {value}
        </p>
        <p className="num mt-0.5 text-[9px] text-[hsl(var(--muted-foreground))]">{sub}</p>
      </div>
    </div>
  )
}
