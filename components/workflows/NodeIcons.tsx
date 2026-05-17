/**
 * NodeIcons · custom inline SVG icons for workflow nodes.
 *
 * Zero deps · `currentColor` for hue inheritance · 20×20 viewBox so
 * they sit nicely in the 28-32px circle slot inside business nodes.
 * Picked per icon kind from `lib/n8n-node-translations.ts`.
 */
import type { IconKind } from "@/lib/n8n-node-translations"

interface IconProps {
  className?: string
  strokeWidth?: number
}

function Base({
  className,
  strokeWidth = 1.5,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  )
}

// ── agente · empleado virtual ──────────────────────────────
export function AgenteIcon(props: IconProps) {
  return (
    <Base {...props}>
      {/* head */}
      <circle cx="10" cy="6" r="3" />
      {/* body with collar (corbata) */}
      <path d="M4 18c0-3.5 2.5-6 6-6s6 2.5 6 6" />
      {/* tie */}
      <path d="M9 9.5l1 2 1-2" />
      <path d="M10 11.5v3" />
    </Base>
  )
}

// ── cliente · persona casual ───────────────────────────────
export function ClienteIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="10" cy="6" r="3" />
      <path d="M4 18c0-3.5 2.5-6 6-6s6 2.5 6 6" />
    </Base>
  )
}

// ── sistema externo · plug/cable ───────────────────────────
export function SistemaIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 4v3" />
      <path d="M14 4v3" />
      <rect x="5" y="7" width="10" height="6" rx="1" />
      <path d="M10 13v3" />
      <path d="M8 17h4" />
    </Base>
  )
}

// ── database · cabinet ─────────────────────────────────────
export function DatabaseIcon(props: IconProps) {
  return (
    <Base {...props}>
      <ellipse cx="10" cy="5" rx="6" ry="2" />
      <path d="M4 5v6c0 1.1 2.7 2 6 2s6-.9 6-2V5" />
      <path d="M4 11v4c0 1.1 2.7 2 6 2s6-.9 6-2v-4" />
    </Base>
  )
}

// ── decisión · branch ──────────────────────────────────────
export function DecisionIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="4" cy="10" r="1.5" />
      <circle cx="16" cy="5" r="1.5" />
      <circle cx="16" cy="15" r="1.5" />
      <path d="M5.5 10c2 0 4-1 6-3" />
      <path d="M5.5 10c2 0 4 1 6 3" />
    </Base>
  )
}

// ── notif · bell ───────────────────────────────────────────
export function NotifIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 12V9a5 5 0 1110 0v3l1.5 2H3.5L5 12z" />
      <path d="M8 16a2 2 0 004 0" />
    </Base>
  )
}

// ── schedule · clock ───────────────────────────────────────
export function ScheduleIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 6.5V10l2 1.5" />
    </Base>
  )
}

// ── email · mail ───────────────────────────────────────────
export function EmailIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="5" width="14" height="10" rx="1.5" />
      <path d="M3.5 6l6.5 5 6.5-5" />
    </Base>
  )
}

// ── api · cloud arrow ──────────────────────────────────────
export function ApiIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 14a3 3 0 010-6 4 4 0 017.5-1.5A3.5 3.5 0 0114.5 14H6z" />
      <path d="M10 10v4" />
      <path d="M8.5 12.5l1.5 1.5 1.5-1.5" />
    </Base>
  )
}

// ── function · code brackets ───────────────────────────────
export function FunctionIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 5l-3 5 3 5" />
      <path d="M13 5l3 5-3 5" />
      <path d="M11 4l-2 12" />
    </Base>
  )
}

// ── wait · hourglass ───────────────────────────────────────
export function WaitIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 4h8" />
      <path d="M6 16h8" />
      <path d="M6 4l4 5-4 7" />
      <path d="M14 4l-4 5 4 7" />
    </Base>
  )
}

// ── merge · joining lines ──────────────────────────────────
export function MergeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 5v3a3 3 0 003 3h4a3 3 0 013 3v1" />
      <path d="M15 13v3" />
      <circle cx="5" cy="5" r="1.5" />
      <circle cx="15" cy="16" r="1.5" />
    </Base>
  )
}

// ── split · diverging lines ────────────────────────────────
export function SplitIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M10 5v3" />
      <path d="M10 8c-2 0-4 1-4 4v3" />
      <path d="M10 8c2 0 4 1 4 4v3" />
      <circle cx="10" cy="5" r="1.5" />
      <circle cx="6" cy="16" r="1.5" />
      <circle cx="14" cy="16" r="1.5" />
    </Base>
  )
}

// ── unknown · dotted circle ────────────────────────────────
export function UnknownIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="10" cy="10" r="6.5" strokeDasharray="2 2" />
      <path d="M10 9v3" />
      <circle cx="10" cy="6.5" r="0.4" fill="currentColor" />
    </Base>
  )
}

// ── Registry · iconForKind ─────────────────────────────────
export function IconForKind({ kind, ...rest }: { kind: IconKind } & IconProps) {
  switch (kind) {
    case "agente":
      return <AgenteIcon {...rest} />
    case "cliente":
      return <ClienteIcon {...rest} />
    case "sistema":
      return <SistemaIcon {...rest} />
    case "database":
      return <DatabaseIcon {...rest} />
    case "decision":
      return <DecisionIcon {...rest} />
    case "notif":
      return <NotifIcon {...rest} />
    case "schedule":
      return <ScheduleIcon {...rest} />
    case "email":
      return <EmailIcon {...rest} />
    case "api":
      return <ApiIcon {...rest} />
    case "function":
      return <FunctionIcon {...rest} />
    case "wait":
      return <WaitIcon {...rest} />
    case "merge":
      return <MergeIcon {...rest} />
    case "split":
      return <SplitIcon {...rest} />
    default:
      return <UnknownIcon {...rest} />
  }
}
