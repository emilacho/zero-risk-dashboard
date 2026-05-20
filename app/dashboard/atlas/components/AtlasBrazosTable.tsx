"use client"
/**
 * AtlasBrazosTable · Section 5 · 7 brazos canónicos del sistema.
 *
 * Brazos del sistema son las integraciones externas que ejecutan
 * acciones reales (ads · email · video · imagen · CRM · scraping ·
 * payments). Status cross-referenced con integrations-health donde
 * exista row, fallback "n/a" si no.
 */
import { useAtlasIntegrationsHealth } from "../hooks/useAtlasIntegrationsHealth"
import type { AtlasHealthRow } from "../types"
import { HEALTH_HUE, HEALTH_LABEL } from "../tokens"
import { AtlasStatusPill } from "./AtlasStatusPill"

interface Brazo {
  brazo: string
  provider: string
  evidence: string
  /** Names en integrations-health rows que validan este brazo · OR
   *  pattern · primera coincidencia wins. */
  healthKeys: string[]
}

const BRAZOS: Brazo[] = [
  {
    brazo: "Ads (Meta · Google · TikTok · LinkedIn)",
    provider: "API directa",
    evidence: "CLAUDE.md L257 · keys per cliente",
    healthKeys: ["Meta Ads", "Google Ads", "TikTok Ads"],
  },
  {
    brazo: "CRM + WhatsApp + Email",
    provider: "GoHighLevel Unlimited",
    evidence: "GHL_API_KEY env · STACK_FINAL_V3",
    healthKeys: ["GoHighLevel", "GHL"],
  },
  {
    brazo: "Imágenes",
    provider: "GPT Image 1.5 · Vercel AI Gateway",
    evidence: "STACK_FINAL_V3 · #1 LMArena",
    healthKeys: ["Vercel Platform", "OpenAI"],
  },
  {
    brazo: "Video",
    provider: "Higgsfield Seedance · Veo 3.1 (canon split)",
    evidence: "playbook video-ai-tool-selection · editor_en_jefe gate",
    healthKeys: ["Higgsfield"],
  },
  {
    brazo: "Competitive Intelligence",
    provider: "Apify scrapers + web_fetch + DataForSEO",
    evidence: "Apify pay-per-run · DataForSEO $0.0006/SERP",
    healthKeys: ["Apify"],
  },
  {
    brazo: "Delivery (food)",
    provider: "PedidosYa Courier · Rappi · UberEats (pluggable)",
    evidence: "client-sites R97 · CourierProvider interface",
    healthKeys: ["PedidosYa"],
  },
  {
    brazo: "Payments (LATAM)",
    provider: "Kushki · PayPhone (secondary)",
    evidence: "Kushki aprobado 2026-05-19 · alta in progress",
    healthKeys: ["Kushki"],
  },
]

function findHealthRow(
  rows: AtlasHealthRow[] | undefined,
  keys: string[],
): AtlasHealthRow | null {
  if (!rows) return null
  for (const key of keys) {
    const match = rows.find((r) =>
      r.name.toLowerCase().includes(key.toLowerCase()),
    )
    if (match) return match
  }
  return null
}

export function AtlasBrazosTable() {
  const { data } = useAtlasIntegrationsHealth()
  const rows = data?.rows

  return (
    <section
      className="surface-card rim-instr p-5"
      data-rim="cyan"
      aria-label="Brazos del sistema"
    >
      <div className="relative z-[2] flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Brazos del sistema
          </h2>
          <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            {BRAZOS.length} integraciones · canon
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="num py-2 pr-4 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                  brazo
                </th>
                <th className="num py-2 pr-4 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                  provider
                </th>
                <th className="num py-2 pr-4 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                  status
                </th>
                <th className="num py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                  evidencia
                </th>
              </tr>
            </thead>
            <tbody>
              {BRAZOS.map((b) => {
                const health = findHealthRow(rows, b.healthKeys)
                const hue = health ? HEALTH_HUE[health.status] : "muted"
                const label = health ? HEALTH_LABEL[health.status] : "n/a"
                return (
                  <tr
                    key={b.brazo}
                    className="border-b border-[hsl(var(--border))]/40 last:border-0"
                  >
                    <td className="py-2.5 pr-4 align-top">
                      <span className="font-display font-medium">{b.brazo}</span>
                    </td>
                    <td className="py-2.5 pr-4 align-top text-[hsl(var(--muted-foreground))]">
                      {b.provider}
                    </td>
                    <td className="py-2.5 pr-4 align-top">
                      <AtlasStatusPill hue={hue} size="sm">
                        {label}
                      </AtlasStatusPill>
                    </td>
                    <td className="num py-2.5 align-top text-[11px] text-[hsl(var(--muted-foreground))]">
                      {b.evidence}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
