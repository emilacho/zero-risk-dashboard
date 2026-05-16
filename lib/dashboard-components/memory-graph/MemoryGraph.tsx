'use client'
/**
 * MemoryGraph · v3 · agency-root-centered orbit layout.
 *
 * Layout:
 *   - agency-root in the geometric center
 *   - all other kinds arranged in concentric rings around it · each kind
 *     occupies its own angular band so the graph reads as orbits, not soup
 *   - curved bezier edges (ReactFlow `default` edge type) instead of
 *     smoothstep · multi-color per edge.kind via globals.css
 *
 * Two modes:
 *   - `chrome` (default) · gives the graph a surface-card wrapper + title
 *   - `fullscreen` · bare canvas filling the parent container (no chrome)
 */
import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Edge,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { memoryNodeTypes, type MemoryGraphNode } from './MemoryNodes'
import type { MemoryGraphData, MemoryNodeData, MemoryNodeKind } from '../types'

export interface MemoryGraphProps {
  data: MemoryGraphData
  /** Container height · ReactFlow needs a fixed h. */
  height?: number | string
  /** Title rendered above the canvas · pass null to suppress. */
  title?: string | null
  /** `chrome` wraps in a surface-card · `fullscreen` is bare canvas. */
  chrome?: 'chrome' | 'fullscreen'
  className?: string
}

// ── Orbit layout · angular band per kind ──────────────────────────────
const ORBIT_CONFIG: Record<MemoryNodeKind, { radius: number; angleStart: number; angleEnd: number }> = {
  // agency-root is rendered separately at center
  'agency-root':   { radius: 0,   angleStart: 0, angleEnd: 0 },
  // Right-band · agents (cyan) · the primary "team"
  agent:           { radius: 320, angleStart: -0.45, angleEnd:  0.55 },
  // Upper-right · workflows (amber)
  workflow:        { radius: 360, angleStart: -1.15, angleEnd: -0.55 },
  // Top · brand-voice (rose) + playbook (lime)
  'brand-voice':   { radius: 280, angleStart: -1.65, angleEnd: -1.20 },
  playbook:        { radius: 380, angleStart: -1.55, angleEnd: -1.05 },
  // Upper-left · clients (emerald)
  client:          { radius: 320, angleStart: -2.20, angleEnd: -1.65 },
  // Left · icp-segments (purple)
  'icp-segment':   { radius: 360, angleStart: -2.80, angleEnd: -2.25 },
  // Bottom-left · team-members (sky)
  'team-member':   { radius: 320, angleStart:  2.35, angleEnd:  2.85 },
  // Bottom · content-assets (teal)
  'content-asset': { radius: 360, angleStart:  1.65, angleEnd:  2.40 },
  // Bottom-right · tools (orange)
  tool:            { radius: 420, angleStart:  0.65, angleEnd:  1.65 },
  // Bottom-right inner · revenue-stats (emerald variant)
  'revenue-stat':  { radius: 260, angleStart:  0.65, angleEnd:  1.35 },
}

function layoutNodes(data: MemoryGraphData): MemoryGraphNode[] {
  const byKind = new Map<MemoryNodeKind, MemoryNodeData[]>()
  for (const n of data.nodes) {
    const arr = byKind.get(n.kind) ?? []
    arr.push(n)
    byKind.set(n.kind, arr)
  }

  const out: MemoryGraphNode[] = []
  const CX = 540
  const CY = 380

  // agency-root at center
  const roots = byKind.get('agency-root') ?? []
  roots.forEach((n, i) => {
    out.push({
      id: n.id,
      type: 'agency-root',
      data: n,
      position: { x: CX - 140, y: CY - 40 + i * 100 },
    })
  })

  // Each other kind into its angular band
  for (const [kind, cfg] of Object.entries(ORBIT_CONFIG) as Array<[MemoryNodeKind, typeof ORBIT_CONFIG[MemoryNodeKind]]>) {
    if (kind === 'agency-root') continue
    const items = byKind.get(kind) ?? []
    if (items.length === 0) continue
    const span = cfg.angleEnd - cfg.angleStart
    items.forEach((n, i) => {
      const t = items.length === 1 ? 0.5 : i / (items.length - 1)
      const angle = cfg.angleStart + t * span
      const x = CX + Math.cos(angle) * cfg.radius
      const y = CY + Math.sin(angle) * cfg.radius
      out.push({
        id: n.id,
        type: kind,
        data: n,
        position: { x, y },
      })
    })
  }

  return out
}

function buildEdges(data: MemoryGraphData): Edge[] {
  return data.edges.map((e) => {
    const kind = e.kind ?? (e.label === 'next' || e.label === 'review' ? 'review' : 'invokes')
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      // ReactFlow's `default` edge type renders a curved bezier · closer
      // to the Lumen memory-web aesthetic than smoothstep right-angles
      type: 'default',
      animated: kind === 'cascade' || kind === 'review',
      // We attach the kind via the className so globals.css can color
      // the path. ReactFlow surfaces className on the group <g>.
      className: `zr-edge-${kind}`,
      data: { kind },
      labelStyle: {
        fontSize: 9.5,
        fill: 'hsl(var(--muted-foreground))',
        fontFamily: 'var(--font-mono), monospace',
      },
      labelBgStyle: {
        fill: 'hsl(var(--card))',
        stroke: 'hsl(var(--border))',
      },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
    }
  })
}

const edgeTypes: EdgeTypes = {}

export function MemoryGraph({
  data,
  height = 720,
  title = 'Memory graph',
  chrome = 'chrome',
  className,
}: MemoryGraphProps) {
  const nodes = useMemo(() => layoutNodes(data), [data])
  const edges = useMemo(() => buildEdges(data), [data])

  const canvas = (
    <div
      className="relative overflow-hidden rounded-xl border border-border bg-background/30"
      style={{ height }}
    >
      {/* Radial backdrop · concentric violet/cyan/rose haze */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(60% 50% at 50% 50%, hsl(var(--hue-violet) / 0.18), transparent 60%),
            radial-gradient(80% 60% at 50% 50%, hsl(var(--hue-cyan) / 0.10), transparent 70%),
            radial-gradient(50% 40% at 90% 10%, hsl(var(--hue-rose) / 0.10), transparent 60%),
            radial-gradient(50% 40% at 10% 90%, hsl(var(--hue-teal) / 0.10), transparent 60%)
          `,
        }}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={memoryNodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.35}
        maxZoom={1.6}
        fitViewOptions={{ padding: 0.18 }}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        defaultEdgeOptions={{ type: 'default', animated: false }}
        onlyRenderVisibleElements={false}
      >
        <Background variant={BackgroundVariant.Dots} color="hsl(var(--border))" gap={22} size={1} />
        <Controls
          position="bottom-right"
          showInteractive={false}
          style={{
            background: 'hsl(var(--card) / 0.9)',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            backdropFilter: 'blur(8px)',
          }}
        />
        <MiniMap
          position="top-right"
          pannable
          zoomable
          nodeColor={(n) => {
            const k = (n.type ?? 'agent') as MemoryNodeKind
            const map: Record<MemoryNodeKind, string> = {
              'agency-root':   'hsl(263 80% 65%)',
              client:          'hsl(160 84% 50%)',
              agent:           'hsl(187 85% 55%)',
              workflow:        'hsl(40 95% 60%)',
              tool:            'hsl(25 95% 60%)',
              'brand-voice':   'hsl(330 80% 65%)',
              playbook:        'hsl(90 75% 55%)',
              'icp-segment':   'hsl(280 80% 65%)',
              'content-asset': 'hsl(173 80% 50%)',
              'team-member':   'hsl(205 90% 60%)',
              'revenue-stat':  'hsl(160 84% 50%)',
            }
            return map[k] ?? 'hsl(240 5% 60%)'
          }}
          maskColor="rgba(10,10,15,0.65)"
          style={{
            background: 'hsl(var(--card) / 0.9)',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            backdropFilter: 'blur(8px)',
          }}
        />
      </ReactFlow>
    </div>
  )

  if (chrome === 'fullscreen') {
    return <div className={className}>{canvas}</div>
  }
  return (
    <div data-hue="violet" className={['surface-card p-5', className ?? ''].join(' ')}>
      <div className="relative z-[2] flex flex-col gap-3">
        {title !== null ? (
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-base font-semibold tracking-tight">{title}</h3>
            <span className="text-[11px] text-muted-foreground tabular-nums font-mono">
              {nodes.length} concepts · {edges.length} relationships
            </span>
          </div>
        ) : null}
        {canvas}
      </div>
    </div>
  )
}
