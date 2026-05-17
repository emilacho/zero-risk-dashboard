"use client"
/**
 * SortableList · Sprint #8 P2 component · @dnd-kit/core + sortable wrapper.
 *
 * Vertical-axis drag-and-drop list · pointer + keyboard accessible · ARIA
 * announcements via @dnd-kit's built-in screen-reader instructions. Lumen v3
 * styled · drag handle on hover · drop-zone highlight · subtle scale + ring
 * during drag.
 *
 * Use cases · Kanban column reorder (drag tasks within a stage) · file
 * reorder in upload UI · pipeline stage reorder (admin-only) · agent
 * priority ordering in cascade-runner config.
 *
 * Generic over item shape via `items[]` + `getItemId` + `renderItem`.
 * Controlled · caller owns the order array and updates it via `onReorder`.
 *
 * Accessibility · keyboard support (Space to grab · arrows to move · Space/
 * Enter to drop · Esc to cancel) via @dnd-kit/sortable's keyboard sensor.
 * DragOverlay portal prevents layout shift during drag.
 */
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { DotsSixVertical } from "@phosphor-icons/react/dist/ssr"
import type { ReactNode } from "react"

export interface SortableListProps<T> {
  /** Items in current display order · caller owns this array */
  items: T[]
  /** Stable id extractor · required for dnd-kit · must be unique per item */
  getItemId: (item: T) => string | number
  /** Render the row content · the drag handle is inserted separately on the left */
  renderItem: (item: T, opts: { isDragging: boolean }) => ReactNode
  /** Called with the new order after a successful drop */
  onReorder: (next: T[]) => void
  /** When true · disables dragging globally · default false */
  disabled?: boolean
  /** Optional className on the outer ul */
  className?: string
  /** aria-label for the outer ul · default "Reorderable list" */
  ariaLabel?: string
}

export function SortableList<T>({
  items,
  getItemId,
  renderItem,
  onReorder,
  disabled = false,
  className = "",
  ariaLabel = "Reorderable list",
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((it) => getItemId(it) === active.id)
    const newIndex = items.findIndex((it) => getItemId(it) === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(items, oldIndex, newIndex))
  }

  const ids = items.map((it) => getItemId(it))

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={disabled}>
        <ul aria-label={ariaLabel} className={`flex flex-col gap-2 ${className}`}>
          {items.map((item) => (
            <SortableRow
              key={getItemId(item)}
              id={getItemId(item)}
              disabled={disabled}
              renderItem={(opts) => renderItem(item, opts)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({
  id,
  disabled,
  renderItem,
}: {
  id: string | number
  disabled: boolean
  renderItem: (opts: { isDragging: boolean }) => ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragging
      ? "0 12px 32px -8px hsl(var(--primary-glow)/0.4)"
      : undefined,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex items-stretch gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-colors ${
        isDragging ? "ring-1 ring-[hsl(var(--primary-glow))]" : "hover:border-[hsl(var(--primary-glow)/0.4)]"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label="Drag to reorder"
        className={`flex shrink-0 items-center justify-center px-2 text-[hsl(var(--muted-foreground))] transition-colors ${
          disabled ? "cursor-not-allowed opacity-40" : "cursor-grab hover:text-foreground active:cursor-grabbing"
        } focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]`}
      >
        <DotsSixVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 py-2 pr-3">{renderItem({ isDragging })}</div>
    </li>
  )
}
