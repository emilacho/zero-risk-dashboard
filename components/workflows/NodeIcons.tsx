/**
 * NodeIcons · STEP 7b · larger, illustrated inline SVG icons.
 *
 * Previous version used a 20×20 viewBox and rendered ~24px inside a
 * tight circle. STEP 7 brief asks for 56-80px icons inside a min
 * 180×120 node container with a clear "empleado virtual"/"cliente"/etc
 * reading. New viewBox is 64×64 with proper detail (silueta upper body
 * + suit + tie + briefcase for `agente` · door opening for `webhook` ·
 * laptop + cloud + arrow for `http` · etc).
 *
 * Same exported `IconForKind(...)` API · drop-in replacement of the
 * old icons · zero dep, currentColor for hue inheritance.
 */
import type { IconKind } from "@/lib/n8n-node-translations"

interface IconProps {
  className?: string
  /** Pixel size · default 56 · fits the 80×80 icon slot in the new node container */
  size?: number
  strokeWidth?: number
}

function Base({
  className,
  size = 56,
  strokeWidth = 1.5,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
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

// ── AGENTE · empleado virtual con corbata + maletín ────────
// Silueta busto · cabeza · cuello camisa · saco con solapa · corbata ·
// el maletín queda como un detalle a la derecha para que se lea como
// "el empleado virtual ejecutivo".
export function AgenteIcon(props: IconProps) {
  return (
    <Base {...props}>
      {/* head */}
      <circle cx="26" cy="18" r="8" />
      {/* neck */}
      <path d="M22 24v4" />
      <path d="M30 24v4" />
      {/* shoulders + jacket */}
      <path d="M8 56c0-10 8-18 18-18s18 8 18 18" />
      {/* shirt collar */}
      <path d="M22 28l4 4 4-4" />
      {/* tie */}
      <path d="M24.5 32l1.5 3 1.5-3" />
      <path d="M24.5 35l-0.6 8h4.2l-0.6-8" />
      {/* jacket lapel left + right */}
      <path d="M21 30l-3 8" />
      <path d="M31 30l3 8" />
      {/* briefcase · sits to the right */}
      <rect x="44" y="42" width="14" height="10" rx="1.2" />
      <path d="M48 42v-2.5a2 2 0 012-2h2a2 2 0 012 2V42" />
      <path d="M44 47h14" />
    </Base>
  )
}

// ── CLIENTE · persona casual sin corbata, brazos relajados ──
export function ClienteIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="32" cy="20" r="9" />
      {/* neck */}
      <path d="M28 28v3" />
      <path d="M36 28v3" />
      {/* casual shirt · no lapel · round collar */}
      <path d="M10 58c0-12 10-22 22-22s22 10 22 22" />
      {/* collar curve */}
      <path d="M26 33c2 3 10 3 12 0" />
    </Base>
  )
}

// ── WEBHOOK · door opening + handshake (llega cliente) ──────
export function WebhookIcon(props: IconProps) {
  return (
    <Base {...props}>
      {/* door frame */}
      <path d="M14 56V12h24" />
      <path d="M38 56V12" />
      <path d="M14 56h24" />
      {/* door swung open (parallelogram) */}
      <path d="M38 14l14-3v44l-14 3z" />
      {/* doorknob */}
      <circle cx="36" cy="34" r="1.2" fill="currentColor" />
      {/* handshake symbol below */}
      <path d="M18 50l4 2 6-3" />
    </Base>
  )
}

// ── SCHEDULE · reloj detallado con hora marcada ─────────────
export function ScheduleIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="32" cy="32" r="22" />
      <circle cx="32" cy="32" r="1.5" fill="currentColor" stroke="none" />
      {/* hour hand · 2 oclock */}
      <path d="M32 32l8 -4" />
      {/* minute hand · 12 */}
      <path d="M32 32V14" />
      {/* hour ticks */}
      <path d="M32 10v3" />
      <path d="M32 54v-3" />
      <path d="M10 32h3" />
      <path d="M54 32h-3" />
      <path d="M48.5 15.5l-2.1 2.1" />
      <path d="M15.5 48.5l2.1-2.1" />
      <path d="M48.5 48.5l-2.1-2.1" />
      <path d="M15.5 15.5l2.1 2.1" />
    </Base>
  )
}

// ── API · laptop + cloud + arrow (conexión externa) ─────────
export function ApiIcon(props: IconProps) {
  return (
    <Base {...props}>
      {/* laptop base */}
      <path d="M14 48h36" />
      {/* laptop screen */}
      <rect x="18" y="32" width="28" height="16" rx="1.2" />
      {/* cloud */}
      <path d="M30 18a5 5 0 010 -2 6 6 0 0112 2 4 4 0 011 8h-13a4 4 0 010-8z" />
      {/* arrow up · into cloud */}
      <path d="M32 32v-6" />
      <path d="M29 29l3-3 3 3" />
    </Base>
  )
}

// ── FUNCTION · calculator + magnifier (procesa data) ────────
export function FunctionIcon(props: IconProps) {
  return (
    <Base {...props}>
      {/* calculator body */}
      <rect x="10" y="14" width="28" height="36" rx="2" />
      {/* screen */}
      <rect x="14" y="18" width="20" height="8" rx="1" />
      <path d="M24 22l4 2" />
      {/* keypad dots · 3x3 */}
      <circle cx="18" cy="32" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="24" cy="32" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="30" cy="32" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="18" cy="38" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="24" cy="38" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="30" cy="38" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="18" cy="44" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="24" cy="44" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="30" cy="44" r="1.2" fill="currentColor" stroke="none" />
      {/* magnifier */}
      <circle cx="48" cy="34" r="6" />
      <path d="M52 38l4 4" />
    </Base>
  )
}

// ── DATABASE · 3D filing cabinet ────────────────────────────
export function DatabaseIcon(props: IconProps) {
  return (
    <Base {...props}>
      {/* cabinet body */}
      <rect x="12" y="10" width="40" height="44" rx="2" />
      {/* drawers */}
      <path d="M12 24h40" />
      <path d="M12 38h40" />
      {/* drawer handles */}
      <path d="M28 17h8" />
      <path d="M28 31h8" />
      <path d="M28 45h8" />
      {/* depth · pseudo-3D right side */}
      <path d="M52 10l4 -3v44l-4 3" />
    </Base>
  )
}

// ── SLACK / NOTIF · chat bubble con tail ────────────────────
export function NotifIcon(props: IconProps) {
  return (
    <Base {...props}>
      {/* main bubble */}
      <path d="M10 16a6 6 0 016-6h32a6 6 0 016 6v22a6 6 0 01-6 6H28l-10 8v-8h-2a6 6 0 01-6-6z" />
      {/* lines inside bubble · message */}
      <path d="M18 22h28" />
      <path d="M18 28h22" />
      <path d="M18 34h16" />
    </Base>
  )
}

// ── EMAIL · envelope con detalle de flap ────────────────────
export function EmailIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="8" y="14" width="48" height="36" rx="3" />
      {/* flap · open showing letter inside */}
      <path d="M8 18l24 18 24-18" />
      {/* tiny "@" hint inside */}
      <circle cx="32" cy="34" r="3.5" />
      <path d="M35.5 34v1.5a2 2 0 002 2" />
    </Base>
  )
}

// ── DECISION · balance / scale ──────────────────────────────
export function DecisionIcon(props: IconProps) {
  return (
    <Base {...props}>
      {/* pivot column */}
      <path d="M32 12v40" />
      <path d="M22 54h20" />
      {/* horizontal beam */}
      <path d="M14 20h36" />
      {/* left pan */}
      <path d="M10 20l-4 12h12l-4-12" />
      {/* right pan */}
      <path d="M50 20l-4 12h12l-4-12" />
      {/* hanging strings */}
      <path d="M14 20v-2" />
      <path d="M50 20v-2" />
    </Base>
  )
}

// ── CAMINO III / QA · magnifier over document ───────────────
export function CaminoQaIcon(props: IconProps) {
  return (
    <Base {...props}>
      {/* document */}
      <path d="M16 10h22l8 8v34a2 2 0 01-2 2H16a2 2 0 01-2-2V12a2 2 0 012-2z" />
      <path d="M38 10v8h8" />
      {/* lines on doc */}
      <path d="M20 22h14" />
      <path d="M20 28h18" />
      <path d="M20 34h10" />
      {/* magnifier over the doc · highlights "checking" */}
      <circle cx="40" cy="40" r="7" />
      <path d="M45 45l6 6" />
      {/* check tick inside magnifier */}
      <path d="M37 40l2.5 2.5 4 -4" />
    </Base>
  )
}

// ── WAIT · hourglass detallado ──────────────────────────────
export function WaitIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M18 10h28" />
      <path d="M18 54h28" />
      <path d="M18 10l14 18-14 16" />
      <path d="M46 10l-14 18 14 16" />
      {/* sand · top half */}
      <path d="M22 14l10 12 10-12" fill="currentColor" stroke="none" opacity="0.35" />
      {/* sand · grain falling */}
      <circle cx="32" cy="34" r="1" fill="currentColor" stroke="none" />
    </Base>
  )
}

// ── MERGE · joining lines ──────────────────────────────────
export function MergeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M14 10v14a8 8 0 008 8h20a8 8 0 018 8v8" />
      <path d="M50 48v6" />
      <circle cx="14" cy="10" r="3" />
      <circle cx="50" cy="54" r="3" />
    </Base>
  )
}

// ── SPLIT · diverging lines ────────────────────────────────
export function SplitIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M32 10v10" />
      <path d="M32 22c-8 0-14 6-14 14v14" />
      <path d="M32 22c8 0 14 6 14 14v14" />
      <circle cx="32" cy="10" r="3" />
      <circle cx="18" cy="54" r="3" />
      <circle cx="46" cy="54" r="3" />
    </Base>
  )
}

// ── SISTEMA · plug ─────────────────────────────────────────
export function SistemaIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M22 8v10" />
      <path d="M42 8v10" />
      <rect x="16" y="18" width="32" height="20" rx="2" />
      <path d="M32 38v8" />
      <path d="M24 50h16" />
      <path d="M28 56h8" />
    </Base>
  )
}

// ── UNKNOWN · dashed circle with question mark ─────────────
export function UnknownIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="32" cy="32" r="22" strokeDasharray="3 3" />
      <path d="M27 28a5 5 0 0110 0c0 3-5 4-5 7" />
      <circle cx="32" cy="42" r="1.4" fill="currentColor" stroke="none" />
    </Base>
  )
}

// ── Registry · iconForKind (extended with `webhook` and `camino_qa`)
export type ExtendedIconKind = IconKind | "webhook" | "camino_qa"

export function IconForKind({
  kind,
  ...rest
}: { kind: IconKind | ExtendedIconKind } & IconProps) {
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
    case "webhook":
      return <WebhookIcon {...rest} />
    case "camino_qa":
      return <CaminoQaIcon {...rest} />
    default:
      return <UnknownIcon {...rest} />
  }
}
