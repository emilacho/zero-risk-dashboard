"use client"
import { useEffect, useState } from "react"
import { X } from "@phosphor-icons/react"
import { useCreateContact, useUpdateContact, useDeleteContact } from "../hooks/useContacts"
import type { Contact } from "../types"

interface ContactDrawerProps {
  open: boolean
  onClose: () => void
  /** When provided, drawer renders in edit mode · when null, create mode. */
  contact: Contact | null
  defaultClientId?: string
}

const RELATIONSHIP_STRENGTHS = ["weak", "medium", "strong", "very_strong"] as const
const INFLUENCE_LEVELS = ["low", "medium", "high", "executive"] as const

export function ContactDrawer({ open, onClose, contact, defaultClientId }: ContactDrawerProps) {
  const isEdit = !!contact
  interface FormShape {
    client_id: string
    champion_name: string
    champion_role: string
    champion_email: string
    champion_phone: string
    relationship_strength: string
    influence_level: string
    notes: string
  }
  const [form, setForm] = useState<FormShape>({
    client_id: contact?.client_id ?? defaultClientId ?? "",
    champion_name: contact?.champion_name ?? "",
    champion_role: contact?.champion_role ?? "",
    champion_email: contact?.champion_email ?? "",
    champion_phone: contact?.champion_phone ?? "",
    relationship_strength: contact?.relationship_strength ?? "medium",
    influence_level: contact?.influence_level ?? "medium",
    notes: contact?.notes ?? "",
  })

  useEffect(() => {
    setForm({
      client_id: contact?.client_id ?? defaultClientId ?? "",
      champion_name: contact?.champion_name ?? "",
      champion_role: contact?.champion_role ?? "",
      champion_email: contact?.champion_email ?? "",
      champion_phone: contact?.champion_phone ?? "",
      relationship_strength: contact?.relationship_strength ?? "medium",
      influence_level: contact?.influence_level ?? "medium",
      notes: contact?.notes ?? "",
    })
  }, [contact, defaultClientId, open])

  const create = useCreateContact()
  const update = useUpdateContact()
  const remove = useDeleteContact()
  const pending = create.isPending || update.isPending || remove.isPending

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isEdit && contact) {
      await update.mutateAsync({
        id: contact.id,
        patch: {
          champion_name: form.champion_name,
          champion_role: form.champion_role || null,
          champion_email: form.champion_email || null,
          champion_phone: form.champion_phone || null,
          relationship_strength: form.relationship_strength as Contact["relationship_strength"],
          influence_level: form.influence_level as Contact["influence_level"],
          notes: form.notes || null,
        },
      })
    } else {
      if (!form.client_id || !form.champion_name) return
      await create.mutateAsync({
        client_id: form.client_id,
        champion_name: form.champion_name,
        champion_role: form.champion_role || null,
        champion_email: form.champion_email || null,
        champion_phone: form.champion_phone || null,
        relationship_strength: form.relationship_strength as Contact["relationship_strength"],
        influence_level: form.influence_level as Contact["influence_level"],
        notes: form.notes || null,
      })
    }
    onClose()
  }

  async function handleDelete() {
    if (!contact) return
    if (!confirm(`Delete ${contact.champion_name}? Tags + relationships are removed too.`)) return
    await remove.mutateAsync(contact.id)
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose()
      }}
    >
      <div
        aria-hidden
        className="flex-1 bg-black/40"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-[hsl(var(--background))] p-6 shadow-xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {isEdit ? "Edit contact" : "New contact"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="close drawer"
            className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            <X size={16} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
          {!isEdit ? (
            <Field label="Client ID *">
              <input
                required
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                placeholder="uuid of cliente"
                className="input"
              />
            </Field>
          ) : null}

          <Field label="Name *">
            <input
              required
              value={form.champion_name}
              onChange={(e) => setForm({ ...form, champion_name: e.target.value })}
              className="input"
            />
          </Field>

          <Field label="Role">
            <input
              value={form.champion_role}
              onChange={(e) => setForm({ ...form, champion_role: e.target.value })}
              className="input"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              value={form.champion_email}
              onChange={(e) => setForm({ ...form, champion_email: e.target.value })}
              className="input"
            />
          </Field>

          <Field label="Phone">
            <input
              value={form.champion_phone}
              onChange={(e) => setForm({ ...form, champion_phone: e.target.value })}
              className="input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Relationship">
              <select
                value={form.relationship_strength}
                onChange={(e) =>
                  setForm({ ...form, relationship_strength: e.target.value })
                }
                className="input"
              >
                {RELATIONSHIP_STRENGTHS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Influence">
              <select
                value={form.influence_level}
                onChange={(e) => setForm({ ...form, influence_level: e.target.value })}
                className="input"
              >
                {INFLUENCE_LEVELS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              rows={4}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input"
            />
          </Field>

          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
            {isEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--destructive))] hover:underline disabled:opacity-50"
              >
                delete
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="rounded border border-[hsl(var(--border))] px-3 py-1.5 text-xs hover:bg-[hsl(var(--muted))]/30 disabled:opacity-50"
              >
                cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded bg-[hsl(var(--foreground))] px-3 py-1.5 text-xs text-[hsl(var(--background))] hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "saving…" : isEdit ? "save" : "create"}
              </button>
            </div>
          </div>

          <style>{`
            .input {
              width: 100%;
              border: 1px solid hsl(var(--border));
              background: transparent;
              border-radius: 4px;
              padding: 6px 10px;
              font-size: 13px;
              outline: none;
            }
            .input:focus { border-color: hsl(var(--foreground)); }
          `}</style>
        </form>
      </aside>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      {children}
    </label>
  )
}
