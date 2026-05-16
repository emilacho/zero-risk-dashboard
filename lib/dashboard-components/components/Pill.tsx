/**
 * Pill · color-coded mini-tag with optional icon prefix.
 *
 * Used for tool tags (HubSpot · Notion · Slack · ClickUp · etc),
 * status indicators (active · paused · churned), category chips
 * (carousel · email · landing), and any inline mono-tech badge.
 *
 * `hue` drives the color. `icon` is an optional ReactNode rendered
 * before the label (e.g. a Lucide component or an emoji).
 *
 * Server-component-safe · no client hooks · no function props.
 */
import type { ReactNode } from 'react'

export type PillHue =
  | 'violet'
  | 'cyan'
  | 'amber'
  | 'emerald'
  | 'rose'
  | 'orange'
  | 'purple'
  | 'teal'
  | 'sky'
  | 'lime'
  | 'muted'

export interface PillProps {
  children: ReactNode
  hue?: PillHue
  icon?: ReactNode
  className?: string
  /** When true, renders as a button-like element (for filter chips). */
  asButton?: boolean
}

export function Pill({ children, hue = 'violet', icon, className, asButton }: PillProps) {
  const Cmp = asButton ? 'button' : 'span'
  return (
    <Cmp
      data-hue={hue}
      className={['pill', className ?? ''].filter(Boolean).join(' ')}
      type={asButton ? 'button' : undefined}
    >
      {icon ? <span className="pill-icon">{icon}</span> : null}
      <span>{children}</span>
    </Cmp>
  )
}

/**
 * Common tool catalog · maps slug → display name + hue + emoji prefix.
 * Used by ToolPill below and by graph nodes that want consistent branding.
 */
export const TOOL_CATALOG: Record<
  string,
  { label: string; hue: PillHue; icon: string }
> = {
  hubspot:    { label: 'HubSpot',     hue: 'orange',  icon: '🟧' },
  notion:     { label: 'Notion',      hue: 'muted',   icon: '◼' },
  slack:      { label: 'Slack',       hue: 'rose',    icon: '◆' },
  clickup:    { label: 'ClickUp',     hue: 'sky',     icon: '◯' },
  supabase:   { label: 'Supabase',    hue: 'emerald', icon: '⚡' },
  anthropic:  { label: 'Anthropic',   hue: 'violet',  icon: '⌬' },
  openai:     { label: 'OpenAI',      hue: 'teal',    icon: '✦' },
  vercel:     { label: 'Vercel',      hue: 'muted',   icon: '▲' },
  railway:    { label: 'Railway',     hue: 'purple',  icon: '◈' },
  ghl:        { label: 'GoHighLevel', hue: 'lime',    icon: '◉' },
  n8n:        { label: 'n8n',         hue: 'rose',    icon: '⬡' },
  sentry:     { label: 'Sentry',      hue: 'violet',  icon: '◐' },
  posthog:    { label: 'PostHog',     hue: 'orange',  icon: '◷' },
  apify:      { label: 'Apify',       hue: 'teal',    icon: '◼' },
  github:     { label: 'GitHub',      hue: 'muted',   icon: '◇' },
  figma:      { label: 'Figma',       hue: 'rose',    icon: '◐' },
  meta:       { label: 'Meta Ads',    hue: 'sky',     icon: '✦' },
  google:     { label: 'Google Ads',  hue: 'amber',   icon: '◆' },
  tiktok:     { label: 'TikTok Ads',  hue: 'cyan',    icon: '◆' },
  linkedin:   { label: 'LinkedIn',    hue: 'sky',     icon: '◼' },
  dataforseo: { label: 'DataForSEO',  hue: 'lime',    icon: '◔' },
  whisper:    { label: 'Whisper',     hue: 'teal',    icon: '◌' },
  ffmpeg:     { label: 'FFmpeg',      hue: 'purple',  icon: '▶' },
  higgsfield: { label: 'Higgsfield',  hue: 'rose',    icon: '◢' },
  elevenlabs: { label: 'ElevenLabs',  hue: 'amber',   icon: '◕' },
}

export interface ToolPillProps {
  /** Tool slug — case-insensitive · maps via TOOL_CATALOG. */
  tool: string
  className?: string
}

/**
 * ToolPill · resolves a tool slug to a branded chip via TOOL_CATALOG.
 * Falls back to a muted pill if the slug is unknown · the label is the
 * raw slug verbatim so users can spot drift.
 */
export function ToolPill({ tool, className }: ToolPillProps) {
  const entry = TOOL_CATALOG[tool.toLowerCase().trim()]
  if (!entry) {
    return (
      <Pill hue="muted" className={className}>
        {tool}
      </Pill>
    )
  }
  return (
    <Pill hue={entry.hue} icon={<span aria-hidden>{entry.icon}</span>} className={className}>
      {entry.label}
    </Pill>
  )
}
