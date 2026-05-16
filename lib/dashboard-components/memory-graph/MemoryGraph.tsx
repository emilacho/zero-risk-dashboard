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

// ── Cardinal-zone grid-pack layout · v3 Phase 3 ────────────────────────
// Per CC#2 Jarvis research dispatch (refs 02 Cantina HUD bible, 04
// Perception, 08 SHIELD tri-up) · the screen edge is a sensor rim with
// fixed cardinal sectors. Each MemoryNodeKind owns a sector; within that
// sector we pack instances as a deterministic grid so there are zero
// overlaps regardless of count, and the graph reads as instrumentation
// not soup.
//
// Coordinates: agency-root anchors at (CX, CY). Each zone has an anchor
// (relative dx/dy) for its top-left grid origin and a preferred number
// of columns. Min spacing is enforced by NODE_W/NODE_H (the actual node
// renderer width inferred from MemoryNodes.tsx + 24px gutter).

const CX = 720
const CY = 480
const NODE_W = 188 // approx renderer width incl. handles
const NODE_H = 72  // approx renderer height
const GUTTER_X = 24
const GUTTER_Y = 36
const CELL_W = NODE_W + GUTTER_X
const CELL_H = NODE_H + GUTTER_Y

// Cardinal sector definitions · anchor is the top-left of the cluster
// grid's bounding box (relative to CX, CY). cols is the preferred column
// count; rows auto-derived from items.length.
interface SectorCfg {
  anchor: { dx: number; dy: number }
  cols: number
  label: string
  cardinal: string
}

const SECTORS: Record<MemoryNodeKind, SectorCfg> = {
  // L0 · center (special-cased below)
  'agency-root':   { anchor: { dx: -100, dy: -40 }, cols: 1, label: 'Agency', cardinal: '·' },
  // N · agents (the primary team) · 4 cols wide top center
  agent:           { anchor: { dx: -2 * CELL_W,      dy: -3.2 * CELL_H }, cols: 4, label: 'Agents',           cardinal: 'N' },
  // E · workflows (amber)
  workflow:        { anchor: { dx:  CELL_W * 1.2,    dy: -1.2 * CELL_H }, cols: 2, label: 'Workflows',         cardinal: 'E' },
  // W · clients (emerald)
  client:          { anchor: { dx: -CELL_W * 3.4,    dy: -1.2 * CELL_H }, cols: 2, label: 'Clients',           cardinal: 'W' },
  // S · tools (orange) · 4 cols wide bottom center
  tool:            { anchor: { dx: -2 * CELL_W,      dy:  CELL_H * 1.6  }, cols: 4, label: 'Tools',             cardinal: 'S' },
  // NE · brand-voice (rose)
  'brand-voice':   { anchor: { dx:  CELL_W * 1.2,    dy: -CELL_H * 3.4 }, cols: 2, label: 'Brand voice',       cardinal: 'NE' },
  // NW · playbooks (lime)
  playbook:        { anchor: { dx: -CELL_W * 3.4,    dy: -CELL_H * 3.4 }, cols: 2, label: 'Playbooks',         cardinal: 'NW' },
  // far-W (SW) · icp-segments (purple)
  'icp-segment':   { anchor: { dx: -CELL_W * 3.4,    dy:  CELL_H * 1.4 }, cols: 2, label: 'ICP segments',      cardinal: 'SW' },
  // SE · content-assets (teal)
  'content-asset': { anchor: { dx:  CELL_W * 1.2,    dy:  CELL_H * 1.4 }, cols: 2, label: 'Content assets',    cardinal: 'SE' },
  // bottom-center-left · team-members (sky) · between Clients and Tools
  'team-member':   { anchor: { dx: -CELL_W * 1.8,    dy:  CELL_H * 0.3 }, cols: 2, label: 'Team',              cardinal: 'S·W' },
  // bottom-center-right · revenue-stats (emerald variant) · between Tools and Workflows
  'revenue-stat':  { anchor: { dx:  CELL_W * 0.2,    dy:  CELL_H * 0.3 }, cols: 2, label: 'Revenue stats',     cardinal: 'S·E' },
}

interface SectorPlacement {
  kind: MemoryNodeKind
  label: string
  cardinal: string
  /** Center of the cluster bounding box · for floating pill anchor */
  centerX: number
  centerY: number
  /** Item count · drives pill badge */
  count: number
}

function layoutWithSectors(data: MemoryGraphData): {
  nodes: MemoryGraphNode[]
  placements: SectorPlacement[]
} {
  const byKind = new Map<MemoryNodeKind, MemoryNodeData[]>()
  for (const n of data.nodes) {
    const arr = byKind.get(n.kind) ?? []
    arr.push(n)
    byKind.set(n.kind, arr)
  }

  const out: MemoryGraphNode[] = []
  const placements: SectorPlacement[] = []

  // L0 · agency-root at center
  const roots = byKind.get('agency-root') ?? []
  roots.forEach((n, i) => {
    out.push({
      id: n.id,
      type: 'agency-root',
      data: n,
      position: { x: CX - 100, y: CY - 40 + i * 100 },
    })
  })

  // L1-L2 · sector grid-pack
  for (const [kindStr, cfg] of Object.entries(SECTORS) as Array<[MemoryNodeKind, SectorCfg]>) {
    const kind = kindStr as MemoryNodeKind
    if (kind === 'agency-root') continue
    const items = byKind.get(kind) ?? []
    if (items.length === 0) continue

    const cols = Math.max(1, Math.min(cfg.cols, items.length))
    const originX = CX + cfg.anchor.dx
    const originY = CY + cfg.anchor.dy

    items.forEach((n, idx) => {
      const r = Math.floor(idx / cols)
      const c = idx % cols
      out.push({
        id: n.id,
        type: kind,
        data: n,
        position: {
          x: originX + c * CELL_W,
          y: originY + r * CELL_H,
        },
      })
    })

    placements.push({
      kind,
      label: cfg.label,
      cardinal: cfg.cardinal,
      centerX: originX + ((cols - 1) * CELL_W) / 2 + NODE_W / 2,
      centerY: originY - 28, // pill sits 28px above the cluster top edge
      count: items.length,
    })
  }

  return { nodes: out, placements }
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
  const { nodes: dataNodes, placements } = useMemo(
    () => layoutWithSectors(data),
    [data],
  )
  const edges = useMemo(() => buildEdges(data), [data])

  // Inject sector pills as decorative graph nodes · they pan/zoom with
  // the canvas which is acceptable for a Lumen-style HUD layer. We cast
  // to MemoryGraphNode[] because the pill's `data` shape is intentionally
  // different from MemoryNodeData; the renderer registry in MemoryNodes
  // knows how to dispatch on `type: 'sector-pill'`.
  const nodes = useMemo<MemoryGraphNode[]>(() => {
    const pillNodes = placements.map((p) => ({
      id: `pill:${p.kind}`,
      type: 'sector-pill',
      data: {
        label: p.label,
        cardinal: p.cardinal,
        count: p.count,
      },
      position: { x: p.centerX - 90, y: p.centerY },
      draggable: false,
      selectable: false,
      zIndex: 1000,
    })) as unknown as MemoryGraphNode[]
    return [...dataNodes, ...pillNodes]
  }, [dataNodes, placements])

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
