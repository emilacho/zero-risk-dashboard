'use client'
/**
 * StatsBar · monitoring-panel strip · home-hero v3.
 *
 * Five cells across · Datadog/Grafana aesthetic · mono-tech numerals ·
 * gradient hairline border that runs violet → cyan → rose.
 *
 * Pass real data via the `snapshot` prop. The renderer formats the
 * memory size (bytes) compactly and the lastSync as relative time.
 */
import { Cpu, Network, Database, Clock, HardDrive } from 'lucide-react'
import { formatRelativeTime } from '../utils/format'
import type { StatsBarSnapshot } from '../types'

export interface StatsBarProps {
  snapshot: StatsBarSnapshot
  className?: string
}

function fmtBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`
  if (bytes >= 1_000_000)     return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1_000)         return `${(bytes / 1_000).toFixed(1)} KB`
  return `${bytes} B`
}
function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

const CELLS = [
  {
    key: 'concepts',
    label: 'concepts',
    Icon: Cpu,
    hue: 'violet',
    sub: 'tracked entities',
  },
  {
    key: 'relationships',
    label: 'relationships',
    Icon: Network,
    hue: 'cyan',
    sub: 'edges in memory',
  },
  {
    key: 'sourcesIngested',
    label: 'sources ingested',
    Icon: Database,
    hue: 'orange',
    sub: 'tools + integrations',
  },
  {
    key: 'lastSync',
    label: 'last sync',
    Icon: Clock,
    hue: 'emerald',
    sub: null,
  },
  {
    key: 'memorySize',
    label: 'memory size',
    Icon: HardDrive,
    hue: 'rose',
    sub: 'vault on disk',
  },
] as const

export function StatsBar({ snapshot, className }: StatsBarProps) {
  const formatted = {
    concepts: fmtCount(snapshot.concepts),
    relationships: fmtCount(snapshot.relationships),
    sourcesIngested: snapshot.sourcesIngested.toString(),
    lastSync: formatRelativeTime(snapshot.lastSync),
    memorySize: fmtBytes(snapshot.memorySize),
  } as const

  return (
    <div className={['stats-bar', className ?? ''].join(' ')}>
      {CELLS.map(({ key, label, Icon, hue, sub }) => (
        <div key={key} className="stats-cell">
          <div className="stats-label">
            <Icon className="h-3 w-3" style={{ color: `hsl(var(--hue-${hue}))` }} />
            {label}
          </div>
          <div className="stats-value" suppressHydrationWarning={key === 'lastSync'}>
            {formatted[key as keyof typeof formatted]}
          </div>
          {sub ? <div className="stats-sub">{sub}</div> : null}
        </div>
      ))}
    </div>
  )
}
