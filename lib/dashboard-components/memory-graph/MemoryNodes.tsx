'use client'
/**
 * MemoryNodes · custom node renderers for the ReactFlow memory graph.
 *
 * Four kinds · client (central) · agent · workflow · tool. Lumen polish:
 *  - neon glow per node-kind (violet, cyan, amber, muted)
 *  - hover-expand: scales the node + reveals a brief meta line
 *  - gradient-fill handles
 *  - radar ring around the client node (animated)
 */
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { useState } from 'react'
import type { MemoryNodeData, MemoryNodeKind } from '../types'

export type MemoryGraphNode = Node<MemoryNodeData, MemoryNodeKind>

const HANDLE_FILL: Record<MemoryNodeKind, string> = {
  client:   'hsl(263 80% 65%)',
  agent:    'hsl(187 85% 55%)',
  workflow: 'hsl(45 95% 60%)',
  tool:     'hsl(240 5% 60%)',
}

function handle(kind: MemoryNodeKind): React.CSSProperties {
  return {
    background: HANDLE_FILL[kind],
    border: '2px solid hsl(240 10% 4%)',
    width: 9,
    height: 9,
    boxShadow: `0 0 8px ${HANDLE_FILL[kind]}`,
  }
}

// ── Client node · central · violet glow + radar pulse ──────────────────
export function ClientNode({ data }: NodeProps<MemoryGraphNode>) {
  const [hover, setHover] = useState(false)
  const health = typeof data.meta?.healthScore === 'number' ? data.meta.healthScore : null
  const healthColor =
    health == null ? 'hsl(240 5% 60%)'
    : health >= 75 ? 'hsl(160 84% 50%)'
    : health >= 50 ? 'hsl(40 95% 55%)'
    : 'hsl(0 75% 60%)'
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        padding: '14px 18px',
        minWidth: 220,
        borderRadius: 14,
        border: '1px solid hsl(263 80% 65% / 0.6)',
        background:
          'linear-gradient(135deg, hsl(263 80% 22% / 0.45), hsl(187 85% 22% / 0.25)), hsl(240 10% 8%)',
        boxShadow: hover
          ? '0 0 0 1px hsl(263 80% 65% / 0.5), 0 0 36px 4px hsl(263 80% 60% / 0.35)'
          : '0 0 0 1px hsl(263 80% 65% / 0.3), 0 0 24px -2px hsl(263 80% 60% / 0.3)',
        transform: hover ? 'scale(1.04)' : 'scale(1)',
        transition: 'transform 220ms cubic-bezier(.2,.7,.2,1), box-shadow 220ms ease',
        color: 'hsl(0 0% 96%)',
        fontFamily: 'inherit',
        zIndex: hover ? 10 : 1,
      }}
    >
      {/* Radar ring · two layers, offset · slow rotate */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: -10,
          borderRadius: 18,
          border: '1px dashed hsl(263 80% 65% / 0.35)',
          pointerEvents: 'none',
          animation: 'spin-slow 24s linear infinite',
        }}
      />
      <Handle type="target" position={Position.Left} style={handle('client')} />
      <Handle type="source" position={Position.Right} style={handle('client')} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            width: 8, height: 8, borderRadius: 999,
            background: 'hsl(263 80% 65%)',
            boxShadow: '0 0 12px hsl(263 90% 60%)',
            animation: 'pulse-glow 2s ease-in-out infinite',
          }}
        />
        <span
          style={{
            fontSize: 10,
            color: 'hsl(263 80% 78%)',
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            fontFamily: 'var(--font-mono), monospace',
          }}
        >
          cliente
        </span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-display), inherit', letterSpacing: '-0.01em' }}>
        {data.label}
      </div>
      {data.meta?.industry ? (
        <div style={{ fontSize: 11, color: 'hsl(0 0% 70%)', marginTop: 4 }}>{data.meta.industry}</div>
      ) : null}
      {health != null ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 9, color: 'hsl(0 0% 55%)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 3 }}>
            health · {health}/100
          </div>
          <div style={{ height: 4, borderRadius: 999, background: 'hsl(240 6% 16%)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${health}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${healthColor}, hsl(187 85% 55%))`,
                transition: 'width 600ms ease',
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── Agent node · cyan accent + hover-expand ───────────────────────────
export function AgentNode({ data }: NodeProps<MemoryGraphNode>) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        padding: '10px 14px',
        minWidth: 168,
        borderRadius: 12,
        border: '1px solid hsl(240 6% 16%)',
        borderLeft: '2px solid hsl(187 85% 55%)',
        background: 'hsl(240 8% 9% / 0.95)',
        boxShadow: hover
          ? '0 0 0 1px hsl(187 85% 55% / 0.5), 0 0 22px -2px hsl(187 95% 50% / 0.55)'
          : 'none',
        transform: hover ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform 220ms cubic-bezier(.2,.7,.2,1), box-shadow 220ms ease',
        color: 'hsl(0 0% 96%)',
        zIndex: hover ? 10 : 1,
      }}
    >
      <Handle type="target" position={Position.Left} style={handle('agent')} />
      <Handle type="source" position={Position.Right} style={handle('agent')} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 9, color: 'hsl(187 85% 70%)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--font-mono), monospace' }}>
          agent
        </span>
        {data.meta?.role ? (
          <span style={{ fontSize: 9, color: 'hsl(0 0% 55%)' }}>· {data.meta.role}</span>
        ) : null}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{data.label}</div>
      {data.meta?.model ? (
        <code
          style={{
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 10,
            color: 'hsl(0 0% 60%)',
            marginTop: 4,
            display: 'inline-block',
          }}
        >
          {data.meta.model}
        </code>
      ) : null}
    </div>
  )
}

// ── Workflow node · amber accent ──────────────────────────────────────
export function WorkflowNode({ data }: NodeProps<MemoryGraphNode>) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        padding: '10px 14px',
        minWidth: 150,
        borderRadius: 12,
        border: '1px solid hsl(240 6% 16%)',
        borderLeft: '2px solid hsl(45 95% 60%)',
        background: 'hsl(240 8% 9% / 0.95)',
        boxShadow: hover
          ? '0 0 0 1px hsl(45 95% 60% / 0.45), 0 0 22px -2px hsl(45 95% 55% / 0.45)'
          : 'none',
        transform: hover ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform 220ms cubic-bezier(.2,.7,.2,1), box-shadow 220ms ease',
        color: 'hsl(0 0% 96%)',
        zIndex: hover ? 10 : 1,
      }}
    >
      <Handle type="target" position={Position.Left} style={handle('workflow')} />
      <Handle type="source" position={Position.Right} style={handle('workflow')} />
      <div style={{ fontSize: 9, color: 'hsl(45 95% 70%)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4, fontFamily: 'var(--font-mono), monospace' }}>
        workflow
      </div>
      <div style={{ fontSize: 12, fontWeight: 500 }}>{data.label}</div>
      {typeof data.meta?.runs24h === 'number' ? (
        <div style={{ fontSize: 10, color: 'hsl(0 0% 60%)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
          {data.meta.runs24h} runs · 24h
        </div>
      ) : null}
    </div>
  )
}

// ── Tool node · muted · pill-shaped ───────────────────────────────────
export function ToolNode({ data }: NodeProps<MemoryGraphNode>) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        padding: '8px 14px',
        borderRadius: 999,
        border: '1px solid hsl(240 6% 16%)',
        background: 'hsl(240 6% 14% / 0.95)',
        boxShadow: hover ? '0 0 0 1px hsl(240 5% 60% / 0.5), 0 0 18px -2px hsl(240 5% 60% / 0.4)' : 'none',
        transform: hover ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform 220ms cubic-bezier(.2,.7,.2,1), box-shadow 220ms ease',
        color: 'hsl(0 0% 96%)',
        zIndex: hover ? 10 : 1,
      }}
    >
      <Handle type="target" position={Position.Left} style={handle('tool')} />
      <Handle type="source" position={Position.Right} style={handle('tool')} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 9, color: 'hsl(0 0% 55%)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--font-mono), monospace' }}>
          tool
        </span>
        <span style={{ fontSize: 12, fontWeight: 500 }}>{data.label}</span>
      </div>
      {data.meta?.surface ? (
        <div style={{ fontSize: 9, color: 'hsl(0 0% 55%)', marginTop: 2 }}>{data.meta.surface}</div>
      ) : null}
    </div>
  )
}

// ── Registry passed to ReactFlow ──────────────────────────────────────
export const memoryNodeTypes = {
  client: ClientNode,
  agent: AgentNode,
  workflow: WorkflowNode,
  tool: ToolNode,
}
