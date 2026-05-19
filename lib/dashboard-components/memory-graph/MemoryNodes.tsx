'use client'
/**
 * MemoryNodes · v3 · 11 node kinds with neon glow + hover-expand.
 *
 * Each kind gets:
 *  - a category color (hue token)
 *  - a tiny icon glyph + label tag
 *  - hover scale + glow bloom
 *
 * Renderer registry exported as `memoryNodeTypes` for ReactFlow.
 *
 * Phase 3 · `sector-pill` is a non-data ornamental node type used to
 * label each cardinal cluster (AGENTS N, CLIENTS W, etc). It draws a
 * floating violet-glow pill above the cluster and carries the count.
 */
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { useState } from 'react'
import type { MemoryNodeData, MemoryNodeKind } from '../types'

export interface SectorPillData extends Record<string, unknown> {
  label: string
  cardinal: string
  count: number
}

export type MemoryGraphNode = Node<MemoryNodeData, MemoryNodeKind>

// Map node kind → CSS hue variable name. Drives glow + accent border.
const HUE: Record<MemoryNodeKind, string> = {
  'agency-root':   'var(--hue-violet)',
  client:          'var(--hue-emerald)',
  agent:           'var(--hue-cyan)',
  workflow:        'var(--hue-amber)',
  tool:            'var(--hue-orange)',
  'brand-voice':   'var(--hue-rose)',
  playbook:        'var(--hue-lime)',
  'icp-segment':   'var(--hue-purple)',
  'content-asset': 'var(--hue-teal)',
  'team-member':   'var(--hue-sky)',
  'revenue-stat':  'var(--hue-emerald)',
}

const LABEL_BG: Record<MemoryNodeKind, string> = {
  'agency-root':   'agency',
  client:          'cliente',
  agent:           'agent',
  workflow:        'workflow',
  tool:            'tool',
  'brand-voice':   'brand voice',
  playbook:        'playbook',
  'icp-segment':   'icp',
  'content-asset': 'content',
  'team-member':   'team',
  'revenue-stat':  'revenue',
}

function handleStyle(kind: MemoryNodeKind): React.CSSProperties {
  const c = `hsl(${HUE[kind]})`
  return {
    background: c,
    border: '2px solid hsl(var(--background))',
    width: 9,
    height: 9,
    boxShadow: `0 0 8px ${c}`,
  }
}

function commonShell(
  kind: MemoryNodeKind,
  hover: boolean,
  intensity: 'normal' | 'central' = 'normal',
): React.CSSProperties {
  const hue = HUE[kind]
  const baseShadow =
    intensity === 'central'
      ? `0 0 0 1px hsl(${hue} / 0.5), 0 0 40px 6px hsl(${hue} / 0.4)`
      : `0 0 0 1px hsl(${hue} / 0.35), 0 0 18px -4px hsl(${hue} / 0.4)`
  const hoverShadow =
    intensity === 'central'
      ? `0 0 0 1px hsl(${hue} / 0.65), 0 0 56px 8px hsl(${hue} / 0.55)`
      : `0 0 0 1px hsl(${hue} / 0.55), 0 0 26px 0 hsl(${hue} / 0.55)`
  return {
    position: 'relative',
    borderRadius: 14,
    border: `1px solid hsl(${hue} / 0.45)`,
    background:
      intensity === 'central'
        ? `linear-gradient(135deg, hsl(${hue} / 0.18), hsl(${hue} / 0.05)), hsl(var(--card))`
        : `linear-gradient(135deg, hsl(${hue} / 0.08), hsl(var(--card) / 0.95))`,
    boxShadow: hover ? hoverShadow : baseShadow,
    transform: hover ? 'scale(1.05)' : 'scale(1)',
    transition: 'transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
    color: 'hsl(var(--foreground))',
    fontFamily: 'inherit',
    zIndex: hover ? 10 : 1,
  }
}

function KindTag({ kind }: { kind: MemoryNodeKind }) {
  const hue = HUE[kind]
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 9,
        fontFamily: 'var(--font-mono), monospace',
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        color: `hsl(${hue})`,
        marginBottom: 4,
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          width: 5,
          height: 5,
          borderRadius: 999,
          background: `hsl(${hue})`,
          boxShadow: `0 0 6px hsl(${hue})`,
        }}
      />
      {LABEL_BG[kind]}
    </div>
  )
}

// ── Agency root · the central "Zero Risk Agency · MEMORY GRAPH" node ──
export function AgencyRootNode({ data }: NodeProps<MemoryGraphNode>) {
  const [hover, setHover] = useState(false)
  const hue = HUE['agency-root']
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...commonShell('agency-root', hover, 'central'),
        padding: '20px 26px',
        minWidth: 280,
      }}
    >
      {/* Triple radar ring · pure CSS · slow rotate */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: -16,
          borderRadius: 22,
          border: `1px dashed hsl(${hue} / 0.35)`,
          pointerEvents: 'none',
          animation: 'spin-slow 28s linear infinite',
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: -32,
          borderRadius: 28,
          border: `1px dotted hsl(${hue} / 0.18)`,
          pointerEvents: 'none',
          animation: 'spin-slow 56s linear infinite reverse',
        }}
      />
      <Handle type="target" position={Position.Left}  style={handleStyle('agency-root')} />
      <Handle type="source" position={Position.Right} style={handleStyle('agency-root')} />
      <Handle type="target" position={Position.Top}    style={handleStyle('agency-root')} id="top" />
      <Handle type="source" position={Position.Bottom} style={handleStyle('agency-root')} id="bottom" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span
          style={{
            width: 10, height: 10, borderRadius: 999,
            background: `hsl(${hue})`,
            boxShadow: `0 0 12px hsl(${hue})`,
            animation: 'pulse-dot 1.6s ease-in-out infinite',
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono), monospace',
            color: `hsl(${hue})`,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
          }}
        >
          memory graph · core
        </span>
      </div>
      <div style={{ fontFamily: 'var(--font-display), inherit', fontSize: 22, fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
        {data.label}
      </div>
      {data.meta?.tags?.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
          {data.meta.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              style={{
                fontSize: 9, fontFamily: 'var(--font-mono), monospace',
                color: `hsl(${hue})`, background: `hsl(${hue} / 0.1)`,
                border: `1px solid hsl(${hue} / 0.25)`,
                padding: '2px 6px', borderRadius: 999, letterSpacing: '0.06em',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ── Client node ───────────────────────────────────────────────────────
export function ClientNode({ data }: NodeProps<MemoryGraphNode>) {
  const [hover, setHover] = useState(false)
  const hue = HUE.client
  const health = typeof data.meta?.healthScore === 'number' ? data.meta.healthScore : null
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...commonShell('client', hover), padding: '10px 14px', minWidth: 180 }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle('client')} />
      <Handle type="source" position={Position.Right} style={handleStyle('client')} />
      <KindTag kind="client" />
      <div style={{ fontSize: 13, fontWeight: 600 }}>{data.label}</div>
      {data.meta?.industry ? (
        <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
          {data.meta.industry}
        </div>
      ) : null}
      {health != null ? (
        <div
          style={{
            marginTop: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 9,
            color: 'hsl(var(--muted-foreground))',
          }}
        >
          health
          <span style={{ color: `hsl(${hue})`, fontWeight: 600 }}>{health}/100</span>
        </div>
      ) : null}
    </div>
  )
}

// ── Agent node ────────────────────────────────────────────────────────
export function AgentNode({ data }: NodeProps<MemoryGraphNode>) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...commonShell('agent', hover), padding: '10px 14px', minWidth: 158 }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle('agent')} />
      <Handle type="source" position={Position.Right} style={handleStyle('agent')} />
      <KindTag kind="agent" />
      <div style={{ fontSize: 12, fontWeight: 600 }}>{data.label}</div>
      {data.meta?.model ? (
        <code
          style={{
            display: 'inline-block', marginTop: 4,
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 9.5,
            color: 'hsl(var(--muted-foreground))',
          }}
        >
          {data.meta.model}
        </code>
      ) : null}
    </div>
  )
}

// ── Workflow node ─────────────────────────────────────────────────────
export function WorkflowNode({ data }: NodeProps<MemoryGraphNode>) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...commonShell('workflow', hover), padding: '10px 14px', minWidth: 148 }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle('workflow')} />
      <Handle type="source" position={Position.Right} style={handleStyle('workflow')} />
      <KindTag kind="workflow" />
      <div style={{ fontSize: 12, fontWeight: 600 }}>{data.label}</div>
      {typeof data.meta?.runs24h === 'number' ? (
        <div
          style={{
            marginTop: 4, fontFamily: 'var(--font-mono), monospace', fontSize: 9.5,
            color: 'hsl(var(--muted-foreground))', fontVariantNumeric: 'tabular-nums',
          }}
        >
          {data.meta.runs24h} runs · 24h
        </div>
      ) : null}
    </div>
  )
}

// ── Tool node · with optional icon glyph prefix ────────────────────────
export function ToolNode({ data }: NodeProps<MemoryGraphNode>) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...commonShell('tool', hover), padding: '8px 14px', minWidth: 0, borderRadius: 999 }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle('tool')} />
      <Handle type="source" position={Position.Right} style={handleStyle('tool')} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {data.meta?.icon ? (
          <span aria-hidden style={{ fontSize: 11 }}>{data.meta.icon}</span>
        ) : null}
        <span
          style={{
            fontSize: 9, fontFamily: 'var(--font-mono), monospace',
            color: `hsl(${HUE.tool})`, textTransform: 'uppercase', letterSpacing: '0.12em',
          }}
        >
          tool
        </span>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{data.label}</span>
      </div>
    </div>
  )
}

// ── Brand-voice node (rose) ───────────────────────────────────────────
export function BrandVoiceNode({ data }: NodeProps<MemoryGraphNode>) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...commonShell('brand-voice', hover), padding: '10px 14px', minWidth: 168 }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle('brand-voice')} />
      <Handle type="source" position={Position.Right} style={handleStyle('brand-voice')} />
      <KindTag kind="brand-voice" />
      <div style={{ fontSize: 12, fontWeight: 600 }}>{data.label}</div>
      {data.meta?.vibe ? (
        <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', marginTop: 2, fontStyle: 'italic' }}>
          “{data.meta.vibe}”
        </div>
      ) : null}
    </div>
  )
}

// ── Playbook node (lime) ──────────────────────────────────────────────
export function PlaybookNode({ data }: NodeProps<MemoryGraphNode>) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...commonShell('playbook', hover), padding: '10px 14px', minWidth: 168 }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle('playbook')} />
      <Handle type="source" position={Position.Right} style={handleStyle('playbook')} />
      <KindTag kind="playbook" />
      <div style={{ fontSize: 12, fontWeight: 600 }}>{data.label}</div>
      {data.meta?.category ? (
        <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', marginTop: 2, fontFamily: 'var(--font-mono), monospace' }}>
          {data.meta.category}
        </div>
      ) : null}
    </div>
  )
}

// ── ICP segment node (purple) ─────────────────────────────────────────
export function IcpSegmentNode({ data }: NodeProps<MemoryGraphNode>) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...commonShell('icp-segment', hover), padding: '10px 14px', minWidth: 168 }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle('icp-segment')} />
      <Handle type="source" position={Position.Right} style={handleStyle('icp-segment')} />
      <KindTag kind="icp-segment" />
      <div style={{ fontSize: 12, fontWeight: 600 }}>{data.label}</div>
      {typeof data.meta?.count === 'number' ? (
        <div
          style={{
            marginTop: 4, fontFamily: 'var(--font-mono), monospace', fontSize: 10,
            color: 'hsl(var(--muted-foreground))', fontVariantNumeric: 'tabular-nums',
          }}
        >
          ≈ {data.meta.count.toLocaleString()} accounts
        </div>
      ) : null}
    </div>
  )
}

// ── Content asset node (teal) ─────────────────────────────────────────
export function ContentAssetNode({ data }: NodeProps<MemoryGraphNode>) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...commonShell('content-asset', hover), padding: '10px 14px', minWidth: 168 }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle('content-asset')} />
      <Handle type="source" position={Position.Right} style={handleStyle('content-asset')} />
      <KindTag kind="content-asset" />
      <div style={{ fontSize: 12, fontWeight: 600 }}>{data.label}</div>
      {data.meta?.surface_kind ? (
        <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', marginTop: 2, fontFamily: 'var(--font-mono), monospace' }}>
          {data.meta.surface_kind}
        </div>
      ) : null}
    </div>
  )
}

// ── Team member node (sky) ────────────────────────────────────────────
export function TeamMemberNode({ data }: NodeProps<MemoryGraphNode>) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...commonShell('team-member', hover), padding: '10px 14px', minWidth: 158 }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle('team-member')} />
      <Handle type="source" position={Position.Right} style={handleStyle('team-member')} />
      <KindTag kind="team-member" />
      <div style={{ fontSize: 12, fontWeight: 600 }}>{data.label}</div>
      {data.meta?.role ? (
        <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
          {data.meta.role}
        </div>
      ) : null}
    </div>
  )
}

// ── Revenue stat node (emerald) ───────────────────────────────────────
export function RevenueStatNode({ data }: NodeProps<MemoryGraphNode>) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...commonShell('revenue-stat', hover), padding: '10px 14px', minWidth: 158 }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle('revenue-stat')} />
      <Handle type="source" position={Position.Right} style={handleStyle('revenue-stat')} />
      <KindTag kind="revenue-stat" />
      <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{data.label}</div>
      {data.meta?.value != null ? (
        <div
          style={{
            marginTop: 2, fontFamily: 'var(--font-display), inherit',
            fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em',
            color: `hsl(${HUE['revenue-stat']})`,
          }}
        >
          {String(data.meta.value)}
        </div>
      ) : null}
    </div>
  )
}

// ── Registry passed to ReactFlow ──────────────────────────────────────
// ── Sector pill · floating cardinal label above each cluster ─────────
function SectorPillNode({ data }: NodeProps<Node<SectorPillData>>) {
  return (
    <div
      className="pointer-events-none flex select-none items-center gap-2 rounded-full border-[0.5px] px-3 py-1 shadow-[0_0_16px_-2px_hsl(var(--primary-glow)/0.55)] backdrop-blur-sm"
      style={{
        borderColor: 'hsl(var(--primary-glow) / 0.55)',
        background: 'hsl(var(--background) / 0.85)',
      }}
    >
      <span
        className="font-mono text-[9px] uppercase tracking-[0.22em]"
        style={{ color: 'hsl(var(--accent))' }}
      >
        {data.cardinal}
      </span>
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: 'hsl(var(--foreground))' }}
      >
        {data.label}
      </span>
      <span
        className="num text-[10px] tabular-nums"
        style={{ color: 'hsl(var(--muted-foreground))' }}
      >
        ×{data.count}
      </span>
    </div>
  )
}

export const memoryNodeTypes = {
  'agency-root':   AgencyRootNode,
  client:          ClientNode,
  agent:           AgentNode,
  workflow:        WorkflowNode,
  tool:            ToolNode,
  'brand-voice':   BrandVoiceNode,
  playbook:        PlaybookNode,
  'icp-segment':   IcpSegmentNode,
  'content-asset': ContentAssetNode,
  'team-member':   TeamMemberNode,
  'revenue-stat':  RevenueStatNode,
  'sector-pill':   SectorPillNode,
}
