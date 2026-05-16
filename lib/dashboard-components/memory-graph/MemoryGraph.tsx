'use client'
/**
 * MemoryGraph · ReactFlow canvas rendering the client-centric memory web.
 *
 * Lumen polish:
 *  - radial gradient backdrop (violet → cyan haze) behind the canvas
 *  - SVG gradient on edges via custom marker · neon stroke
 *  - cascade-flow edges (label="next") animated with stroke-dashoffset
 *  - hover-expand handled in each MemoryNode component
 *  - subtle dot grid background
 */
import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Edge,
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
  className?: string
}

// ── Deterministic layout (same as before · unchanged) ─────────────────
function layoutNodes(data: MemoryGraphData): MemoryGraphNode[] {
  const byKind: Record<MemoryNodeKind, MemoryNodeData[]> = {
    client: [],
    agent: [],
    workflow: [],
    tool: [],
  }
  for (const n of data.nodes) byKind[n.kind].push(n)

  const out: MemoryGraphNode[] = []
  const CX = 480
  const CY = 320

  byKind.client.forEach((n, i) => {
    out.push({ id: n.id, type: 'client', data: n, position: { x: CX - 100, y: CY - 40 + i * 100 } })
  })

  const agentCount = byKind.agent.length || 1
  const R1 = 280
  byKind.agent.forEach((n, i) => {
    const startAngle = -Math.PI / 2 + 0.2
    const arc = Math.PI + 0.6
    const t = agentCount === 1 ? 0.5 : i / (agentCount - 1)
    const angle = startAngle + t * arc
    out.push({
      id: n.id,
      type: 'agent',
      data: n,
      position: { x: CX + Math.cos(angle) * R1, y: CY + Math.sin(angle) * R1 },
    })
  })

  byKind.workflow.forEach((n, i) => {
    const x = 60 + (i % 2) * 240
    const y = 40 + Math.floor(i / 2) * 110
    out.push({ id: n.id, type: 'workflow', data: n, position: { x, y } })
  })

  byKind.tool.forEach((n, i) => {
    const x = 60 + (i % 3) * 200
    const y = CY + 200 + Math.floor(i / 3) * 80
    out.push({ id: n.id, type: 'tool', data: n, position: { x, y } })
  })

  return out
}

function buildEdges(data: MemoryGraphData): Edge[] {
  return data.edges.map((e) => {
    const cascade = e.label === 'next' || e.label === 'review'
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      labelStyle: {
        fontSize: 10,
        fill: 'hsl(0 0% 60%)',
        fontFamily: 'var(--font-mono), monospace',
      },
      labelBgStyle: {
        fill: 'hsl(240 8% 8%)',
        stroke: 'hsl(240 6% 18%)',
      },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
      style: {
        stroke: cascade ? 'hsl(263 80% 65%)' : 'hsl(187 70% 50% / 0.55)',
        strokeWidth: cascade ? 1.6 : 1.2,
      },
      animated: cascade,
      type: 'smoothstep',
    }
  })
}

export function MemoryGraph({
  data,
  height = 600,
  title = 'Memory graph · cliente · agentes · workflows · tools',
  className,
}: MemoryGraphProps) {
  const nodes = useMemo(() => layoutNodes(data), [data])
  const edges = useMemo(() => buildEdges(data), [data])

  return (
    <div data-glow="violet" className={['surface-card p-5', className ?? ''].join(' ')}>
      <div className="relative z-[2] flex flex-col gap-3">
        {title !== null ? (
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-base font-semibold tracking-tight">{title}</h3>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {nodes.length} nodos · {edges.length} relaciones
            </span>
          </div>
        ) : null}
        <div
          className="relative overflow-hidden rounded-xl border border-border bg-background/40"
          style={{ height }}
        >
          {/* Radial gradient backdrop · sits behind the ReactFlow viewport */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(70% 60% at 50% 40%, hsl(263 80% 30% / 0.22), transparent 60%), radial-gradient(60% 50% at 20% 90%, hsl(187 85% 30% / 0.18), transparent 60%)',
            }}
          />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={memoryNodeTypes}
            fitView
            minZoom={0.4}
            maxZoom={1.6}
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
            colorMode="dark"
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
          >
            <Background
              variant={BackgroundVariant.Dots}
              color="hsl(240 6% 22%)"
              gap={22}
              size={1}
            />
            <Controls
              position="bottom-right"
              showInteractive={false}
              style={{
                background: 'hsl(240 8% 8% / 0.9)',
                border: '1px solid hsl(240 6% 18%)',
                borderRadius: 8,
                backdropFilter: 'blur(8px)',
              }}
            />
            <MiniMap
              position="top-right"
              pannable
              zoomable
              nodeColor={(n) =>
                n.type === 'client' ? 'hsl(263 80% 65%)'
                : n.type === 'agent' ? 'hsl(187 85% 55%)'
                : n.type === 'workflow' ? 'hsl(45 95% 60%)'
                : 'hsl(240 5% 60%)'
              }
              maskColor="rgba(10,10,15,0.6)"
              style={{
                background: 'hsl(240 8% 8% / 0.9)',
                border: '1px solid hsl(240 6% 18%)',
                borderRadius: 8,
                backdropFilter: 'blur(8px)',
              }}
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}
