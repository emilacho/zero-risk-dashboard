"use client"
import { useState } from "react"
import { X, Plus } from "@phosphor-icons/react"
import { useAssignTag, useUnassignTag } from "../hooks/useContacts"
import type { ContactTag } from "../types"

interface TagChipsProps {
  contactId: string
  tags: ContactTag[]
  /** When false, hide the add-tag input · used in compact table cells. */
  editable?: boolean
}

export function TagChips({ contactId, tags, editable = true }: TagChipsProps) {
  const [value, setValue] = useState("")
  const assign = useAssignTag()
  const unassign = useUnassignTag()

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.length === 0 && !editable ? (
        <span className="text-[11px] text-[hsl(var(--muted-foreground))]">—</span>
      ) : null}
      {tags.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 px-2 py-0.5 text-[11px] font-medium"
        >
          {t.tag}
          {editable ? (
            <button
              type="button"
              aria-label={`remove tag ${t.tag}`}
              onClick={() => unassign.mutate(t.id)}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            >
              <X size={10} weight="bold" />
            </button>
          ) : null}
        </span>
      ))}
      {editable ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const tag = value.trim()
            if (!tag) return
            assign.mutate({ contact_id: contactId, tag })
            setValue("")
          }}
          className="inline-flex items-center gap-1"
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="+ tag"
            className="w-20 rounded-full border border-dashed border-[hsl(var(--border))] bg-transparent px-2 py-0.5 text-[11px] outline-none focus:border-[hsl(var(--foreground))]"
          />
          {value.trim() ? (
            <button
              type="submit"
              aria-label="add tag"
              className="rounded-full p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              disabled={assign.isPending}
            >
              <Plus size={10} weight="bold" />
            </button>
          ) : null}
        </form>
      ) : null}
    </div>
  )
}
