"use client"
/**
 * WorkflowSkeleton · STEP 7 redesign · ReactFlow canvas with proper
 * Dagre LR auto-layout · 200×140 illustrated business-node containers
 * · 64px hand-drawn SVG icons · animated-particle edges (violet idle ·
 * cyan active · green done · red failed).
 *
 * Layout · @dagrejs/dagre (rankdir LR · per-rank stagger 60 ·
 * inter-node 24 · per-rank 80). Replaces the BFS layered layout from
 * Phase 5.
 *
 * Edges · custom AnimatedFlowEdge (SVG bezier + circle following the
 * path via <animateMotion href="#edgeId">). Particles render only when
 * the edge target is in `activeNodeNames`. Idle edges still render the
 * static bezier · cyan/red/green for state.
 *
 * Phase 4 regression-safe · all data passed across server→client is
 * primitives / serializable arrays. `onNodeClick` is a CLIENT-only
 * callback (this is a client component receiving a callback from
 * another client component, never from a server component).
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
  getBezierPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import dagre from "@dagrejs/dagre"
import { translateNodeType, type IconKind } from "@/lib/n8n-node-translations"
import { IconForKind } from "./NodeIcons"
import { Check, Warning } from "@phosphor-icons/react/dist/ssr"

// ── Types ──────────────────────────────────────────────────

export interface N8nNode {
  id: string
  name: string
  type: string
  position?: [number, number]
  parameters?: Record<string, unknown>
}

export interface N8nConnections {
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

interface FlowEdgeData {
  state: "idle" | "active" | "done" | "failed"
  [key: string]: unknown
}

type BusinessNode = Node<BusinessNodeData>
type FlowEdge = Edge<FlowEdgeData>

export interface WorkflowSkeletonProps {
  nodes: N8nNode[]
  connections: N8nConnections
  height?: number | string
  activeNodeNames?: string[]
  doneNodeNames?: string[]
  failedNodeNames?: string[]
  onNodeClick?: (info: { name: string; type: string }) => void
  className?: string
}

// ── Dagre LR layout ─────────────────────────────────────────
// Per port-25 dispatch spec · NODE_W/H bumped from STEP 7's 200×140 to
// 240×160 (min spec from dispatch) · icon scale-up 56→64 matched below.

const NODE_W = 240
const NODE_H = 160

interface LayoutResult {
  positions: Map<string, { x: number; y: number }>
  edges: FlowEdge[]
}

function buildLayout(
  nodes: N8nNode[],
  connections: N8nConnections,
): LayoutResult {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: "LR",
    nodesep: 32,
    ranksep: 88,
    edgesep: 18,
    marginx: 24,
    marginy: 24,
  })

  for (const n of nodes) {
    g.setNode(n.name, { width: NODE_W, height: NODE_H })
  }

  // Re-emit n8n connections as graph edges
  const rawEdges: FlowEdge[] = []
  for (const [source, conn] of Object.entries(connections)) {
    const outputs = conn.main ?? []
    outputs.forEach((outputArr, branchIdx) => {
      for (const link of outputArr ?? []) {
        if (!g.hasNode(source) || !g.hasNode(link.node)) continue
        const id = `${source}--${branchIdx}--${link.node}`
        g.setEdge(source, link.node)
        rawEdges.push({
          id,
          source,
          target: link.node,
          type: "animated-flow",
          data: { state: "idle" },
        })
      }
    })
  }

  dagre.layout(g)

  const positions = new Map<string, { x: number; y: number }>()
  for (const n of nodes) {
    const node = g.node(n.name)
    if (!node) {
      positions.set(n.name, { x: 0, y: 0 })
      continue
    }
    // dagre returns center · ReactFlow expects top-left
    positions.set(n.name, {
      x: node.x - NODE_W / 2,
      y: node.y - NODE_H / 2,
    })
  }

  return { positions, edges: rawEdges }
}

// ── Custom node renderer · 200×140 container with 64px icon ──

function BusinessNodeRenderer({ data }: NodeProps<BusinessNode>) {
  const stateBorder: Record<BusinessNodeData["state"], string> = {
    idle: "hsl(var(--primary-glow) / 0.45)",
    active: "hsl(var(--accent))",
    done: "hsl(var(--success))",
    failed: "hsl(var(--danger))",
  }
  const stateGlow: Record<BusinessNodeData["state"], string> = {
    idle: "hsl(var(--primary-glow) / 0.18)",
    active: "hsl(var(--accent) / 0.45)",
    done: "hsl(var(--success) / 0.35)",
    failed: "hsl(var(--danger) / 0.35)",
  }
  return (
    <div
      className="surface-card rim-instr flex flex-col items-center justify-center"
      data-rim={data.hue}
      style={{
        width: NODE_W,
        height: NODE_H,
        padding: "12px 14px",
        borderColor: stateBorder[data.state],
        boxShadow:
          data.state === "idle"
            ? `0 0 0 1px ${stateBorder[data.state]}, 0 0 18px -2px ${stateGlow[data.state]}`
            : `0 0 0 1.5px ${stateBorder[data.state]}, 0 0 28px -2px ${stateGlow[data.state]}`,
        transition: "box-shadow 220ms ease, border-color 220ms ease",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "transparent", border: "none", width: 1, height: 1 }}
      />
      {/* status dot · top-right */}
      <div className="absolute right-2 top-2 z-[2] flex items-center gap-1">
        {data.state === "active" ? (
          <>
            <span className="animate-breathing inline-block h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />
            <span className="num text-[8.5px] uppercase tracking-[0.16em] text-[hsl(var(--accent))]">
              live
            </span>
          </>
        ) : data.state === "done" ? (
          <Check strokeWidth={2.4} className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
        ) : data.state === "failed" ? (
          <Warning strokeWidth={2.4} className="h-3.5 w-3.5 text-[hsl(var(--danger))]" />
        ) : (
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[hsl(var(--muted-foreground)/0.5)]" />
        )}
      </div>

      <div className="relative z-[2] flex h-full w-full flex-col items-center justify-between gap-1.5">
        {/* big icon · top */}
        <span
          className="inline-flex items-center justify-center"
          style={{
            color: `hsl(var(--hue-${data.hue}))`,
          }}
        >
          <IconForKind kind={data.iconKind} size={64} strokeWidth={1.4} />
        </span>
        {/* business-language label · middle */}
        <p
          className="line-clamp-2 text-center text-[11.5px] font-semibold leading-[1.2] tracking-tight"
          title={data.label}
        >
          {data.label}
        </p>
        {/* node name · bottom · mono small */}
        <p
          className="num line-clamp-1 text-center text-[8.5px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]"
          title={data.name}
        >
          {data.name}
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: "transparent", border: "none", width: 1, height: 1 }}
      />
    </div>
  )
}

const nodeTypes = { business: BusinessNodeRenderer }

// ── Custom edge · animated SVG particles flowing source → target ───

function AnimatedFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<FlowEdge>) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })
  const state = data?.state ?? "idle"
  const stroke =
    state === "active"
      ? "hsl(var(--accent))"
      : state === "done"
        ? "hsl(var(--success))"
        : state === "failed"
          ? "hsl(var(--danger))"
          : "hsl(var(--primary-glow) / 0.42)"
  const width = state === "active" ? 2.4 : 1.6
  const pathId = `${id}-path`
  return (
    <g className="react-flow__edge-path">
      <path
        id={pathId}
        d={edgePath}
        stroke={stroke}
        strokeWidth={width}
        fill="none"
        strokeLinecap="round"
      />
      {/* drop shadow / glow when active */}
      {state === "active" ? (
        <path
          d={edgePath}
          stroke={stroke}
          strokeWidth={width + 6}
          fill="none"
          strokeLinecap="round"
          opacity={0.22}
        />
      ) : null}
      {/* Flow particles · two staggered circles for a continuous train */}
      {state === "active" || state === "idle" ? (
        <>
          <circle r={state === "active" ? 3 : 2} fill={stroke} opacity={state === "active" ? 1 : 0.55}>
            <animateMotion
              dur={state === "active" ? "1.6s" : "3.2s"}
              repeatCount="indefinite"
            >
              <mpath xlinkHref={`#${pathId}`} />
            </animateMotion>
          </circle>
          {state === "active" ? (
            <circle r={2} fill={stroke} opacity={0.7}>
              <animateMotion
                dur="1.6s"
                repeatCount="indefinite"
                begin="0.5s"
              >
                <mpath xlinkHref={`#${pathId}`} />
              </animateMotion>
            </circle>
          ) : null}
        </>
      ) : null}
    </g>
  )
}

const edgeTypes = { "animated-flow": AnimatedFlowEdge }

// ── Per-node icon override for QA/Camino agents ─────────────

function pickIconKindForNode(
  raw: { name: string; type: string },
  baseKind: IconKind,
): IconKind {
  const name = raw.name.toLowerCase()
  if (/qa|camino|reviewer|critic/.test(name) && /sdk|claude|agent/.test(raw.type.toLowerCase())) {
    return "camino_qa"
  }
  return baseKind
}

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
      const iconKind = pickIconKindForNode(n, t.icon)
      return {
        id: n.id ?? n.name,
        type: "business",
        position: pos,
        data: {
          name: n.name,
          label: t.label,
          description: t.description,
          iconKind,
          hue: t.hue,
          state,
        },
      }
    })
  }, [nodes, layout, activeSet, doneSet, failedSet])

  const styledEdges = useMemo<FlowEdge[]>(() => {
    return layout.edges.map((e) => {
      const targetActive = activeSet.has(e.target)
      const targetDone = doneSet.has(e.target)
      const targetFailed = failedSet.has(e.target)
      const state: FlowEdgeData["state"] = targetFailed
        ? "failed"
        : targetActive
          ? "active"
          : targetDone
            ? "done"
            : "idle"
      return { ...e, data: { state } }
    })
  }, [layout.edges, activeSet, doneSet, failedSet])

  return (
    <div
      className={[
        "relative overflow-hidden rounded-xl border-[0.5px] border-[hsl(var(--primary-glow)/0.18)] bg-[hsl(var(--background)/0.55)]",
        className ?? "",
      ].join(" ")}
      style={{ height }}
    >
      <ReactFlow
        nodes={businessNodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.18, includeHiddenNodes: false }}
        minZoom={0.25}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={!!onNodeClick}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
        onlyRenderVisibleElements={false}
        defaultEdgeOptions={{ type: "animated-flow" }}
        onNodeClick={
          onNodeClick
            ? (_evt, n) => {
                const data = n.data as BusinessNodeData | undefined
                if (!data) return
                const orig = nodes.find((x) => x.name === data.name)
                onNodeClick({ name: data.name, type: orig?.type ?? "unknown" })
              }
            : undefined
        }
      >
        <Background variant={BackgroundVariant.Dots} color="hsl(var(--border))" gap={24} size={1} />
        <Controls
          position="bottom-right"
          showInteractive={false}
          style={{
            background: "hsl(var(--card) / 0.92)",
            border: "1px solid hsl(var(--border))",
            borderRadius: 10,
            backdropFilter: "blur(8px)",
          }}
        />
        <MiniMap
          position="top-right"
          pannable
          zoomable
          nodeStrokeWidth={2}
          nodeColor={(n) => {
            const data = n.data as BusinessNodeData | undefined
            if (!data) return "hsl(var(--muted-foreground))"
            return `hsl(var(--hue-${data.hue}))`
          }}
          maskColor="rgba(10,10,15,0.65)"
          style={{
            background: "hsl(var(--card) / 0.92)",
            border: "1px solid hsl(var(--border))",
            borderRadius: 10,
          }}
        />
      </ReactFlow>
    </div>
  )
}
