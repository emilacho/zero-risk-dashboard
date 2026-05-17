"use client"
/**
 * WorkflowSkeleton · n8n workflow visual panel · ReactFlow canvas with
 * translated business-language nodes + topological layered layout.
 *
 *   - Reads `nodes` + `connections` (n8n shape via REST API).
 *   - Translates each node.type → friendly label + icon kind via
 *     `lib/n8n-node-translations.ts`.
 *   - Layouts deterministically · BFS from triggers to outputs · one
 *     column per topological layer · vertical column stacks · no
 *     dagre dependency (zero new libs).
 *   - Highlights `activeNodeNames` (cyan pulse) · `doneNodeNames`
 *     (green + check) · `failedNodeNames` (red + alert).
 *
 * Stack canon · @xyflow/react (already installed for MemoryGraph).
 */
import { useMemo } from "react"
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { translateNodeType, type IconKind } from "@/lib/n8n-node-translations"
import { IconForKind } from "./NodeIcons"
import { Check, AlertTriangle } from "lucide-react"

// ── Types ──────────────────────────────────────────────────

export interface N8nNode {
  id: string
  name: string
  type: string
  position?: [number, number]
  parameters?: Record<string, unknown>
}

export interface N8nConnections {
  // n8n shape: { [sourceNodeName]: { main: [[{ node: targetNodeName, type, index }]] } }
  [sourceNode: string]: {
    main?: Array<Array<{ node: string; type?: string; index?: number }>>
  }
}

interface BusinessNodeData {
  name: string
  label: string
  description?: string
  iconKind: IconKind
  hue: string
  state: "idle" | "active" | "done" | "failed"
  [key: string]: unknown
}

type BusinessNode = Node<BusinessNodeData>

export interface WorkflowSkeletonProps {
  nodes: N8nNode[]
  connections: N8nConnections
  height?: number | string
  /** Names of nodes currently executing · cyan pulse */
  activeNodeNames?: string[]
  /** Names of nodes that completed successfully · green check */
  doneNodeNames?: string[]
  /** Names of nodes that failed · red alert */
  failedNodeNames?: string[]
  /** Phase 5.1 · invoked when user clicks a node · WorkflowLiveCanvas
   * passes a stable callback que abre NodeActivityDrawer. Both
   * components viven en el client tree · NO server→client serialization. */
  onNodeClick?: (info: { name: string; type: string }) => void
  className?: string
}

// ── Topological layered layout · BFS from triggers ─────────

interface LayoutResult {
  positions: Map<string, { x: number; y: number }>
  edges: Edge[]
}

const COL_W = 260
const ROW_H = 120
const ORIGIN_X = 60
const ORIGIN_Y = 60

function buildLayout(
  nodes: N8nNode[],
  connections: N8nConnections,
): LayoutResult {
  // Build adjacency · name → set of downstream node names
  const downstream = new Map<string, Set<string>>()
  for (const n of nodes) downstream.set(n.name, new Set())
  for (const [source, conn] of Object.entries(connections)) {
    for (const outputArr of conn.main ?? []) {
      for (const link of outputArr ?? []) {
        downstream.get(source)?.add(link.node)
      }
    }
  }
  // Reverse adjacency · count incoming for layer assignment
  const incoming = new Map<string, number>()
  for (const n of nodes) incoming.set(n.name, 0)
  for (const set of downstream.values()) {
    for (const target of set) {
      incoming.set(target, (incoming.get(target) ?? 0) + 1)
    }
  }
  // Layer assignment via Kahn's algorithm (BFS layering)
  const layer = new Map<string, number>()
  let frontier = nodes.filter((n) => (incoming.get(n.name) ?? 0) === 0).map((n) => n.name)
  if (frontier.length === 0 && nodes.length > 0) {
    // Cyclic or all-incoming · seed with first node
    frontier = [nodes[0].name]
  }
  let currentLayer = 0
  const seen = new Set<string>()
  while (frontier.length > 0 && currentLayer < 50 /* safety */) {
    const nextFrontier: string[] = []
    for (const name of frontier) {
      if (seen.has(name)) continue
      seen.add(name)
      layer.set(name, currentLayer)
      for (const dn of downstream.get(name) ?? []) {
        if (!seen.has(dn)) nextFrontier.push(dn)
      }
    }
    frontier = nextFrontier
    currentLayer++
  }
  // Any nodes still without a layer (orphans / cycles) · stuff into last layer
  for (const n of nodes) {
    if (!layer.has(n.name)) layer.set(n.name, currentLayer)
  }

  // Stack nodes within each layer · alphabetic by name for determinism
  const byLayer = new Map<number, string[]>()
  for (const [name, l] of layer.entries()) {
    const arr = byLayer.get(l) ?? []
    arr.push(name)
    byLayer.set(l, arr)
  }
  for (const arr of byLayer.values()) arr.sort()

  const positions = new Map<string, { x: number; y: number }>()
  for (const [l, arr] of byLayer.entries()) {
    arr.forEach((name, idx) => {
      positions.set(name, {
        x: ORIGIN_X + l * COL_W,
        y: ORIGIN_Y + idx * ROW_H,
      })
    })
  }

  // Build edges from connections (also handle the IF / Switch which
  // emit multiple `main` output arrays · one per branch)
  const edges: Edge[] = []
  for (const [source, conn] of Object.entries(connections)) {
    const outputs = conn.main ?? []
    outputs.forEach((outputArr, branchIdx) => {
      for (const link of outputArr ?? []) {
        edges.push({
          id: `${source}--${branchIdx}--${link.node}`,
          source,
          target: link.node,
          type: "default",
          animated: false,
          style: {
            stroke: "hsl(var(--primary-glow) / 0.5)",
            strokeWidth: 1.5,
          },
        })
      }
    })
  }

  return { positions, edges }
}

// ── Business node renderer ──────────────────────────────────

function BusinessNodeRenderer({ data }: NodeProps<BusinessNode>) {
  const stateColor: Record<BusinessNodeData["state"], string> = {
    idle: "hsl(var(--primary-glow) / 0.3)",
    active: "hsl(var(--accent))",
    done: "hsl(var(--success))",
    failed: "hsl(var(--danger))",
  }
  const stateBg: Record<BusinessNodeData["state"], string> = {
    idle: "hsl(var(--card) / 0.88)",
    active: "hsl(var(--accent) / 0.15)",
    done: "hsl(var(--success) / 0.12)",
    failed: "hsl(var(--danger) / 0.12)",
  }
  return (
    <div
      className="surface-card rim-instr w-[220px] p-3"
      data-rim={data.hue}
      style={{
        borderColor: stateColor[data.state],
        background: stateBg[data.state],
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "transparent", border: "none" }} />
      <div className="relative z-[2] flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border-[0.5px]"
            style={{
              borderColor: `hsl(var(--hue-${data.hue}) / 0.4)`,
              background: `hsl(var(--hue-${data.hue}) / 0.12)`,
              color: `hsl(var(--hue-${data.hue}))`,
            }}
          >
            <IconForKind kind={data.iconKind} />
          </span>
          {data.state === "active" ? (
            <span className="num inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--accent))]">
              <span className="animate-breathing inline-block h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />
              live
            </span>
          ) : data.state === "done" ? (
            <Check strokeWidth={2} className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
          ) : data.state === "failed" ? (
            <AlertTriangle strokeWidth={2} className="h-3.5 w-3.5 text-[hsl(var(--danger))]" />
          ) : null}
        </div>
        <p className="text-[12px] font-semibold leading-snug">{data.label}</p>
        <p className="num text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
          {data.name}
        </p>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: "transparent", border: "none" }} />
    </div>
  )
}

const nodeTypes = { business: BusinessNodeRenderer }

// ── Public component ────────────────────────────────────────

export function WorkflowSkeleton({
  nodes,
  connections,
  height = 600,
  activeNodeNames = [],
  doneNodeNames = [],
  failedNodeNames = [],
  onNodeClick,
  className,
}: WorkflowSkeletonProps) {
  const layout = useMemo(
    () => buildLayout(nodes, connections),
    [nodes, connections],
  )

  const activeSet = new Set(activeNodeNames)
  const doneSet = new Set(doneNodeNames)
  const failedSet = new Set(failedNodeNames)

  const businessNodes = useMemo<BusinessNode[]>(() => {
    return nodes.map((n) => {
      const t = translateNodeType(n.type)
      const pos = layout.positions.get(n.name) ?? { x: 0, y: 0 }
      const state: BusinessNodeData["state"] = failedSet.has(n.name)
        ? "failed"
        : activeSet.has(n.name)
          ? "active"
          : doneSet.has(n.name)
            ? "done"
            : "idle"
      return {
        id: n.id ?? n.name,
        type: "business",
        position: pos,
        data: {
          name: n.name,
          label: t.label,
          description: t.description,
          iconKind: t.icon,
          hue: t.hue,
          state,
        },
      }
    })
  }, [nodes, layout, activeSet, doneSet, failedSet])

  // Mark edges feeding into active/done nodes with the corresponding
  // colour + animation
  const styledEdges = useMemo<Edge[]>(() => {
    return layout.edges.map((e) => {
      const targetActive = activeSet.has(e.target)
      const targetDone = doneSet.has(e.target)
      const targetFailed = failedSet.has(e.target)
      const colour = targetFailed
        ? "hsl(var(--danger))"
        : targetActive
          ? "hsl(var(--accent))"
          : targetDone
            ? "hsl(var(--success))"
            : "hsl(var(--primary-glow) / 0.45)"
      return {
        ...e,
        animated: targetActive,
        style: {
          stroke: colour,
          strokeWidth: targetActive ? 2 : 1.5,
        },
      }
    })
  }, [layout.edges, activeSet, doneSet, failedSet])

  return (
    <div
      className={["relative overflow-hidden rounded-xl border-[0.5px] border-[hsl(var(--primary-glow)/0.18)] bg-[hsl(var(--background)/0.5)]", className ?? ""].join(" ")}
      style={{ height }}
    >
      <ReactFlow
        nodes={businessNodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={!!onNodeClick}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
        onlyRenderVisibleElements={false}
        onNodeClick={
          onNodeClick
            ? (_evt, n) => {
                const data = n.data as BusinessNodeData | undefined
                if (!data) return
                // Find original n8n node to get the type
                const orig = nodes.find((x) => x.name === data.name)
                onNodeClick({
                  name: data.name,
                  type: orig?.type ?? "unknown",
                })
              }
            : undefined
        }
      >
        <Background variant={BackgroundVariant.Dots} color="hsl(var(--border))" gap={22} size={1} />
        <Controls
          position="bottom-right"
          showInteractive={false}
          style={{
            background: "hsl(var(--card) / 0.9)",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            backdropFilter: "blur(8px)",
          }}
        />
        <MiniMap
          position="top-right"
          pannable
          zoomable
          nodeColor={(n) => {
            const data = n.data as BusinessNodeData | undefined
            if (!data) return "hsl(var(--muted-foreground))"
            return `hsl(var(--hue-${data.hue}))`
          }}
          maskColor="rgba(10,10,15,0.65)"
          style={{
            background: "hsl(var(--card) / 0.9)",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
          }}
        />
      </ReactFlow>
    </div>
  )
}
