"use client"
import { useState } from "react"
import { ArrowSquareOut, PencilSimple, X, FloppyDisk } from "@phosphor-icons/react/dist/ssr"
import { useLandings, useUpdateLanding, type LandingRow } from "../hooks/useLandingsAdmin"

const PLATFORM_BASE_URL =
  process.env.NEXT_PUBLIC_PLATFORM_BASE_URL ?? "https://zero-risk-platform.vercel.app"

export function LandingsTable() {
  const [editing, setEditing] = useState<LandingRow | null>(null)
  const { data, isLoading, error } = useLandings()
  const updateMutation = useUpdateLanding()

  return (
    <section className="surface-card rim-instr p-5" data-rim="emerald">
      <div className="relative z-[2] flex flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Landings</h2>
            <p className="num mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              {data?.total ?? 0} total · /landings/[slug] · Stack V4 GHL-Out
            </p>
          </div>
        </header>

        {isLoading ? (
          <div className="grid gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-[hsl(var(--muted))]/40" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/5 p-3 text-xs text-[hsl(var(--destructive))]">
            {(error as Error).message}
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="rounded border border-dashed border-[hsl(var(--border))] p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
            No hay landings registradas todavía. Seed Náufrago vía script de prod-apply.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  {["slug", "title", "vertical", "sections", "status", "actions"].map((h) => (
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
                {data.rows.map((l) => (
                  <tr key={l.id} className="border-b border-[hsl(var(--border))]/50 hover:bg-[hsl(var(--muted))]/20">
                    <td className="num py-3 pr-4 font-mono text-xs">{l.slug}</td>
                    <td className="py-3 pr-4">
                      <div className="font-medium">{l.title}</div>
                      <div className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))] line-clamp-1">
                        {l.hero_headline}
                      </div>
                    </td>
                    <td className="num py-3 pr-4 text-xs text-[hsl(var(--muted-foreground))]">{l.vertical ?? "—"}</td>
                    <td className="num py-3 pr-4 font-mono text-xs">{l.sections.length}</td>
                    <td className="py-3 pr-4">
                      {l.is_active ? (
                        <span className="num inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-emerald-600">
                          <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse-dot" />
                          live
                        </span>
                      ) : (
                        <span className="num rounded bg-zinc-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                          inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <a
                          href={`${PLATFORM_BASE_URL}/landings/${l.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="num inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-foreground"
                        >
                          preview
                          <ArrowSquareOut size={10} />
                        </a>
                        <button
                          type="button"
                          onClick={() => setEditing(l)}
                          className="num inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-foreground"
                        >
                          <PencilSimple size={12} />
                          edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing ? (
        <LandingEditor
          landing={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await updateMutation.mutateAsync({ slug: editing.slug, patch })
            setEditing(null)
          }}
          isSaving={updateMutation.isPending}
        />
      ) : null}
    </section>
  )
}

function LandingEditor({
  landing,
  onClose,
  onSave,
  isSaving,
}: {
  landing: LandingRow
  onClose: () => void
  onSave: (patch: Partial<LandingRow>) => Promise<void>
  isSaving: boolean
}) {
  const [title, setTitle] = useState(landing.title)
  const [heroHeadline, setHeroHeadline] = useState(landing.hero_headline)
  const [heroSubhead, setHeroSubhead] = useState(landing.hero_subhead ?? "")
  const [ctaText, setCtaText] = useState(landing.cta_text)
  const [ctaUrl, setCtaUrl] = useState(landing.cta_url)
  const [sectionsJson, setSectionsJson] = useState(JSON.stringify(landing.sections, null, 2))
  const [isActive, setIsActive] = useState(landing.is_active)
  const [jsonError, setJsonError] = useState<string | null>(null)

  const handleSave = async () => {
    let sections: unknown[]
    try {
      sections = JSON.parse(sectionsJson)
      if (!Array.isArray(sections)) throw new Error("sections must be an array")
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : String(e))
      return
    }
    setJsonError(null)
    await onSave({
      title,
      hero_headline: heroHeadline,
      hero_subhead: heroSubhead || null,
      cta_text: ctaText,
      cta_url: ctaUrl,
      sections,
      is_active: isActive,
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <div
        className="surface-card max-h-[90vh] w-full max-w-4xl overflow-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold tracking-tight">Edit landing</h3>
            <p className="num mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              /landings/{landing.slug}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="rounded p-1 hover:bg-[hsl(var(--muted))]/40"
          >
            <X size={16} />
          </button>
        </header>

        <div className="grid gap-4">
          <Field label="title" value={title} onChange={setTitle} />
          <Field label="hero_headline" value={heroHeadline} onChange={setHeroHeadline} />
          <Field label="hero_subhead" value={heroSubhead} onChange={setHeroSubhead} multiline />
          <div className="grid grid-cols-2 gap-4">
            <Field label="cta_text" value={ctaText} onChange={setCtaText} />
            <Field label="cta_url" value={ctaUrl} onChange={setCtaUrl} />
          </div>
          <div>
            <label className="num mb-1 block text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              sections (JSON array)
            </label>
            <textarea
              value={sectionsJson}
              onChange={(e) => setSectionsJson(e.target.value)}
              rows={12}
              className="w-full rounded border border-[hsl(var(--border))] bg-transparent p-2 font-mono text-xs outline-none focus:border-[hsl(var(--foreground))]"
            />
            {jsonError ? (
              <p className="num mt-1 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--destructive))]">
                JSON · {jsonError}
              </p>
            ) : null}
          </div>
          <label className="num inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4"
            />
            is_active
          </label>
        </div>

        <footer className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="num rounded border border-[hsl(var(--border))] px-4 py-2 text-[10px] uppercase tracking-[0.18em] hover:border-[hsl(var(--foreground))]"
          >
            cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="num inline-flex items-center gap-1 rounded bg-[hsl(var(--foreground))] px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--background))] hover:opacity-90 disabled:opacity-50"
          >
            <FloppyDisk size={12} />
            {isSaving ? "saving…" : "save"}
          </button>
        </footer>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
}) {
  return (
    <div>
      <label className="num mb-1 block text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="w-full rounded border border-[hsl(var(--border))] bg-transparent p-2 text-sm outline-none focus:border-[hsl(var(--foreground))]"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border border-[hsl(var(--border))] bg-transparent p-2 text-sm outline-none focus:border-[hsl(var(--foreground))]"
        />
      )}
    </div>
  )
}
