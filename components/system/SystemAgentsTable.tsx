"use client"
/**
 * SystemAgentsTable · client island for /system/agents.
 *
 * Receives pre-serialized rows from the server component and renders via
 * the DataTable primitive (sortable + filterable + paginated + resizable).
 * Lumen v3 visual preserved · column defs replicate the prior <th>/<td>
 * structure 1-for-1.
 */
import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/DataTable"

export interface SystemAgentRow {
  id: string
  name: string
  display_name: string
  role: string
  model: string
  status: string
  dept: string
  sessions30d: number
  cost30d: number
  identity_chars: number
}

function fmtUsd(v: number) {
  if (v === 0) return "$0.000"
  if (Math.abs(v) < 1) return `$${v.toFixed(4)}`
  return `$${v.toFixed(2)}`
}

const columns: ColumnDef<SystemAgentRow>[] = [
  {
    id: "index",
    header: "#",
    cell: ({ row }) => (
      <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
        {row.index + 1}
      </span>
    ),
    enableSorting: false,
    enableColumnFilter: false,
    size: 48,
  },
  {
    accessorKey: "name",
    header: "slug",
    cell: ({ row }) => (
      <span
        className="font-mono text-[hsl(var(--accent))]"
        title={row.original.display_name}
      >
        {row.original.name}
      </span>
    ),
    size: 180,
  },
  {
    accessorKey: "role",
    header: "role",
    cell: ({ getValue }) => (
      <span className="num text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
        {String(getValue() ?? "")}
      </span>
    ),
    size: 160,
  },
  {
    accessorKey: "dept",
    header: "dept",
    cell: ({ row }) => {
      const dept = row.original.dept
      return dept === "—" ? (
        <span className="text-[hsl(var(--muted-foreground))]">—</span>
      ) : (
        <Link
          href={`/dept/${dept}`}
          className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:underline"
        >
          {dept}
        </Link>
      )
    },
    size: 100,
  },
  {
    accessorKey: "model",
    header: "model",
    cell: ({ getValue }) => (
      <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
        {String(getValue() ?? "")}
      </span>
    ),
    size: 160,
  },
  {
    accessorKey: "sessions30d",
    header: "sess 30d",
    cell: ({ getValue }) => (
      <span className="num text-right tabular-nums">{Number(getValue() ?? 0)}</span>
    ),
    size: 90,
  },
  {
    accessorKey: "cost30d",
    header: "cost 30d",
    cell: ({ getValue }) => (
      <span className="num text-right tabular-nums">{fmtUsd(Number(getValue() ?? 0))}</span>
    ),
    size: 100,
  },
  {
    accessorKey: "identity_chars",
    header: "id chars",
    cell: ({ getValue }) => (
      <span className="num text-right text-[10px] text-[hsl(var(--muted-foreground))]">
        {Number(getValue() ?? 0)}
      </span>
    ),
    size: 80,
  },
  {
    id: "open",
    header: "→",
    cell: ({ row }) => (
      <Link
        href={`/agents/${row.original.name}`}
        className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:text-foreground"
      >
        open
      </Link>
    ),
    enableSorting: false,
    enableColumnFilter: false,
    size: 60,
  },
]

export interface SystemAgentsTableProps {
  rows: SystemAgentRow[]
  totalCount: number
  active: number
}

export function SystemAgentsTable({ rows, totalCount, active }: SystemAgentsTableProps) {
  const utilization = totalCount > 0 ? ((active / totalCount) * 100).toFixed(1) : "0.0"
  return (
    <DataTable<SystemAgentRow>
      data={rows}
      columns={columns}
      filterPlaceholder="filter agents · slug, role, model..."
      pageSize={25}
      rim="cyan"
      statusLine={`${totalCount} agents · ${active} active 30d · utilization ${utilization}%`}
      emptyMessage="No agents match the filter."
    />
  )
}
