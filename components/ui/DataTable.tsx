"use client"
/**
 * DataTable · Sprint #8 D2 P0 primitive · TanStack Table v8 integration.
 *
 * Lumen v3 compatible · keeps the surface-card rim-instr aesthetic ·
 * adds sortable headers (click to toggle asc/desc/clear) · global filter
 * input · pagination footer · column resize via header drag · accessible
 * via ARIA (table semantics + aria-sort on th).
 *
 * Used by · /system/agents (wired) · /system/workflows · /clients · /agents
 * (migration pattern documented in JSDoc per-route below).
 *
 * Server-component callers fetch rows + pass primitives. This file is a
 * client island. NO callback props · only primitives + Column<T>[] defs.
 */
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { useMemo, useState } from "react"

export interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  /** Optional global filter placeholder · default "Search..." */
  filterPlaceholder?: string
  /** Page size · default 25 · pass 0 to disable pagination */
  pageSize?: number
  /** When provided, enables click-row navigation. Returns href per row. */
  rowHref?: (row: T) => string | null
  /** Rim hue · matches Lumen rim-instr surface · default "cyan" */
  rim?: "cyan" | "violet" | "amber" | "emerald" | "rose"
  /** Status line above table · plain string · e.g. "59 agents · 12 active 30d" */
  statusLine?: string
  /** When true, sticky-positioned header inside scrollable body */
  stickyHeader?: boolean
  /** Empty-state copy when filtered result is 0 rows · default "No matches." */
  emptyMessage?: string
}

export function DataTable<T>({
  data,
  columns,
  filterPlaceholder = "Search...",
  pageSize = 25,
  rowHref,
  rim = "cyan",
  statusLine,
  stickyHeader = true,
  emptyMessage = "No matches.",
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState("")

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: pageSize > 0 ? getPaginationRowModel() : undefined,
    initialState: pageSize > 0 ? { pagination: { pageSize } } : undefined,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
  })

  const rowCount = table.getRowModel().rows.length
  const totalCount = data.length
  const paginated = pageSize > 0 && totalCount > pageSize
  const pageIdx = table.getState().pagination.pageIndex
  const pageCount = table.getPageCount()

  const ariaSortFor = useMemo(
    () => (col: { getIsSorted: () => false | "asc" | "desc" }) => {
      const s = col.getIsSorted()
      if (s === "asc") return "ascending" as const
      if (s === "desc") return "descending" as const
      return "none" as const
    },
    []
  )

  return (
    <div className="flex flex-col gap-4">
      {(statusLine || filterPlaceholder) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {statusLine && (
            <span className="eyebrow-chip">
              <span className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
              {statusLine} · showing {rowCount} of {totalCount}
            </span>
          )}
          <label className="flex items-center gap-2">
            <span className="sr-only">Filter rows</span>
            <input
              type="search"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={filterPlaceholder}
              className="w-64 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background)/0.6)] px-3 py-1.5 text-[12px] text-foreground placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
            />
          </label>
        </div>
      )}

      <div className="surface-card rim-instr overflow-hidden p-0" data-rim={rim}>
        <div
          className={
            stickyHeader
              ? "relative z-[2] max-h-[70vh] overflow-y-auto"
              : "relative z-[2] overflow-x-auto"
          }
        >
          <table className="w-full text-[12px]" role="table">
            <thead
              className={
                stickyHeader
                  ? "sticky top-0 bg-[hsl(var(--background)/0.92)] backdrop-blur"
                  : "bg-[hsl(var(--background)/0.92)]"
              }
            >
              {table.getHeaderGroups().map((hg) => (
                <tr
                  key={hg.id}
                  className="border-b-[0.5px] border-[hsl(var(--primary-glow)/0.18)] text-left"
                >
                  {hg.headers.map((header) => {
                    const canSort = header.column.getCanSort()
                    const sortState = header.column.getIsSorted()
                    return (
                      <th
                        key={header.id}
                        aria-sort={canSort ? ariaSortFor(header.column) : undefined}
                        className="relative px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]"
                        style={{ width: header.getSize() }}
                      >
                        {header.isPlaceholder ? null : (
                          <button
                            type="button"
                            disabled={!canSort}
                            onClick={header.column.getToggleSortingHandler()}
                            className={
                              canSort
                                ? "inline-flex items-center gap-1 hover:text-foreground"
                                : "inline-flex items-center gap-1 cursor-default"
                            }
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sortState === "asc" && <span aria-hidden>↑</span>}
                            {sortState === "desc" && <span aria-hidden>↓</span>}
                            {canSort && !sortState && (
                              <span aria-hidden className="opacity-30">↕</span>
                            )}
                          </button>
                        )}
                        {header.column.getCanResize() && (
                          <span
                            role="separator"
                            aria-orientation="vertical"
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none hover:bg-[hsl(var(--primary-glow)/0.4)]"
                          />
                        )}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-sm text-[hsl(var(--muted-foreground))]"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const href = rowHref?.(row.original)
                  return (
                    <tr
                      key={row.id}
                      data-href={href || undefined}
                      className="border-b-[0.5px] border-[hsl(var(--border)/0.4)] transition hover:bg-[hsl(var(--primary-glow)/0.04)]"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-2 align-middle">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {paginated && (
        <div className="flex items-center justify-between gap-3">
          <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
            page {pageIdx + 1} of {Math.max(pageCount, 1)} · {pageSize}/page · {totalCount} total
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-md border border-[hsl(var(--border))] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] hover:text-foreground disabled:opacity-40"
            >
              prev
            </button>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-md border border-[hsl(var(--border))] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] hover:text-foreground disabled:opacity-40"
            >
              next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
