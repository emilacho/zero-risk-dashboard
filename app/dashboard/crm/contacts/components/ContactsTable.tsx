"use client"
import { useState } from "react"
import { PencilSimple, MagnifyingGlass } from "@phosphor-icons/react"
import { useContacts } from "../hooks/useContacts"
import type { Contact } from "../types"
import { TagChips } from "./TagChips"
import { ContactDrawer } from "./ContactDrawer"

const STRENGTH_LABELS: Record<string, string> = {
  weak: "weak",
  medium: "medium",
  strong: "strong",
  very_strong: "very strong",
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—"
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / (24 * 3600 * 1000))
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export function ContactsTable() {
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<Contact | null>(null)
  const [creating, setCreating] = useState(false)
  const { data, isLoading, error } = useContacts({ search })

  return (
    <section className="surface-card rim-instr p-5" data-rim="cyan">
      <div className="relative z-[2] flex flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Contactos
            </h2>
            <p className="num mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              {data?.total ?? 0} total · Stack V4 CRM nativo (client_champions)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlass
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="search name · email · role"
                className="w-64 rounded border border-[hsl(var(--border))] bg-transparent py-1.5 pl-7 pr-2 text-xs outline-none focus:border-[hsl(var(--foreground))]"
              />
            </div>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="rounded bg-[hsl(var(--foreground))] px-3 py-1.5 text-xs text-[hsl(var(--background))] hover:opacity-90"
            >
              + new contact
            </button>
          </div>
        </header>

        {isLoading ? (
          <SkeletonRows />
        ) : error ? (
          <div className="rounded border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/5 p-3 text-xs text-[hsl(var(--destructive))]">
            {(error as Error).message}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  {[
                    "name",
                    "role",
                    "email",
                    "tags",
                    "relationship",
                    "influence",
                    "last contact",
                    "actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="num py-2 pr-4 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[hsl(var(--border))]/40 last:border-0"
                  >
                    <td className="py-2.5 pr-4 align-top">
                      <span className="font-display font-medium">{c.champion_name}</span>
                    </td>
                    <td className="py-2.5 pr-4 align-top text-[hsl(var(--muted-foreground))]">
                      {c.champion_role ?? "—"}
                    </td>
                    <td className="py-2.5 pr-4 align-top text-[hsl(var(--muted-foreground))]">
                      {c.champion_email ?? "—"}
                    </td>
                    <td className="py-2.5 pr-4 align-top">
                      <TagChips contactId={c.id} tags={c.tags} editable />
                    </td>
                    <td className="py-2.5 pr-4 align-top text-[11px]">
                      {STRENGTH_LABELS[c.relationship_strength] ?? c.relationship_strength}
                    </td>
                    <td className="py-2.5 pr-4 align-top text-[11px]">
                      {c.influence_level}
                    </td>
                    <td className="num py-2.5 pr-4 align-top text-[11px] text-[hsl(var(--muted-foreground))]">
                      {formatRelative(c.last_contact_at)}
                    </td>
                    <td className="py-2.5 align-top">
                      <button
                        type="button"
                        aria-label={`edit ${c.champion_name}`}
                        onClick={() => setEditing(c)}
                        className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                      >
                        <PencilSimple size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {(data?.rows ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-xs text-[hsl(var(--muted-foreground))]">
                      No contacts yet. Click <span className="font-medium">+ new contact</span> to add the first one.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ContactDrawer
        open={!!editing}
        onClose={() => setEditing(null)}
        contact={editing}
      />
      <ContactDrawer
        open={creating}
        onClose={() => setCreating(false)}
        contact={null}
      />
    </section>
  )
}

function SkeletonRows() {
  return (
    <div className="space-y-2" aria-label="loading contacts">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-8 animate-pulse rounded bg-[hsl(var(--muted))]/30"
        />
      ))}
    </div>
  )
}
