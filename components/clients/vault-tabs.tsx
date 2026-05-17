/**
 * Vault tab bodies · 10 server components rendering light metadata
 * passed via props (loaded once in `loadClientVault`).
 *
 * Heavy assets · only thumbnails via Supabase public URLs · browser
 * lazy-loads via `<img>` attribute. Full-size preview is a simple
 * `<a target="_blank">` to the public URL · NO modal in v1 (Phase
 * 4.5 will add Radix Dialog preview · keep this scope tight).
 */
import {
  FileText,
  Image,
  VideoCamera,
  Cube,
  Globe,
  Camera,
  Sparkle,
  GitBranch,
  MagnifyingGlass,
  Pulse,
  ArrowSquareOut,
} from "@phosphor-icons/react"
import type {
  BrandSection,
  ImagesSection,
  ThreeDSection,
  LandingSection,
  QaSection,
  SocialSection,
  CascadeSection,
  AuditSection,
  VaultStorageObject,
} from "@/lib/vault"

function fmtBytes(n: number | null): string {
  if (n == null) return "—"
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—"
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return "just now"
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return `${Math.floor(ms / 86_400_000)}d ago`
}

function EmptyTile({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode
  title: string
  message: string
}) {
  return (
    <div className="rounded-lg border-[0.5px] border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/0.3)] p-8 text-center">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.4)] text-[hsl(var(--muted-foreground))]">
        {icon}
      </span>
      <p className="mt-3 font-display text-sm font-semibold">{title}</p>
      <p className="num mt-1 text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
        {message}
      </p>
    </div>
  )
}

function StorageGrid({ items, kind }: { items: VaultStorageObject[]; kind: "image" | "model" | "doc" }) {
  if (items.length === 0) {
    return (
      <EmptyTile
        icon={
          kind === "image" ? (
            <Image strokeWidth={1.5} className="h-4 w-4" aria-label="Image" />
          ) : kind === "model" ? (
            <Cube strokeWidth={1.5} className="h-4 w-4" />
          ) : (
            <FileText strokeWidth={1.5} className="h-4 w-4" />
          )
        }
        title="Sin archivos en este bucket"
        message="storage list returned 0 objects"
      />
    )
  }
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {items.map((o) => (
        <a
          key={o.path}
          href={o.publicUrl}
          target="_blank"
          rel="noreferrer"
          className="surface-card rim-instr group p-3 transition hover:scale-[1.01]"
          data-rim="violet"
          data-pop="true"
        >
          <div className="relative z-[2] flex flex-col gap-2">
            {kind === "image" && o.contentType?.startsWith("image/") ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-md border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.4)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={o.publicUrl}
                  alt={o.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : kind === "model" ? (
              <div className="flex aspect-[4/3] items-center justify-center rounded-md border-[0.5px] border-[hsl(var(--border))] bg-gradient-to-br from-[hsl(var(--hue-teal)/0.18)] to-[hsl(var(--hue-violet)/0.12)]">
                <Cube strokeWidth={1.5} className="h-10 w-10 text-[hsl(var(--hue-teal))]" />
              </div>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-md border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.4)]">
                <FileText
                  strokeWidth={1.5}
                  className="h-8 w-8 text-[hsl(var(--muted-foreground))]"
                />
              </div>
            )}
            <p
              className="truncate text-[12px] font-medium"
              title={o.name}
            >
              {o.name}
            </p>
            <div className="flex items-center justify-between text-[10px] text-[hsl(var(--muted-foreground))]">
              <span className="num tabular-nums">{fmtBytes(o.size)}</span>
              <span className="num">{fmtRelative(o.created_at)}</span>
            </div>
          </div>
        </a>
      ))}
    </div>
  )
}

// ── 1. Brand Documents ─────────────────────────────────────

export function BrandDocsTab({ data }: { data: BrandSection }) {
  const hasBrandVoice =
    data.brandVoice && Object.keys(data.brandVoice).length > 0
  const hasConfig = data.config && Object.keys(data.config).length > 0
  const hasColors =
    Array.isArray(data.brandColors) && data.brandColors.length > 0
  const hasFonts = Array.isArray(data.brandFonts) && data.brandFonts.length > 0

  if (!hasBrandVoice && !hasConfig && !hasColors && !hasFonts && !data.bookRow) {
    return (
      <EmptyTile
        icon={<FileText strokeWidth={1.5} className="h-4 w-4" />}
        title="Brand documents · pending"
        message="brand_voice + brand_books vacíos · onboarding form aún no procesado"
      />
    )
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {hasColors ? (
        <div className="surface-card rim-instr p-4" data-rim="rose">
          <div className="relative z-[2]">
            <h3 className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              Brand colors
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {(data.brandColors ?? []).map((c, i) => {
                const hex =
                  typeof c === "object" && c && "hex" in (c as Record<string, unknown>)
                    ? String((c as { hex: string }).hex)
                    : String(c)
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.4)] px-2 py-1"
                  >
                    <span
                      className="inline-block h-4 w-4 rounded"
                      style={{ background: hex }}
                    />
                    <code className="font-mono text-[11px]">{hex}</code>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
      {hasFonts ? (
        <div className="surface-card rim-instr p-4" data-rim="rose">
          <div className="relative z-[2]">
            <h3 className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              Brand fonts
            </h3>
            <ul className="mt-2 space-y-1 text-[12px]">
              {data.brandFonts!.map((f) => (
                <li key={f} className="font-mono">{f}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {hasBrandVoice ? (
        <div className="surface-card rim-instr md:col-span-2 p-4" data-rim="rose">
          <div className="relative z-[2]">
            <h3 className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              Brand voice
            </h3>
            <pre className="mt-2 max-h-[300px] overflow-y-auto rounded-md border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.4)] p-3 text-[10px] leading-relaxed">
              {JSON.stringify(data.brandVoice, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
      {hasConfig ? (
        <div className="surface-card rim-instr md:col-span-2 p-4" data-rim="rose">
          <div className="relative z-[2]">
            <h3 className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              Cliente config
            </h3>
            <pre className="mt-2 max-h-[200px] overflow-y-auto rounded-md border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.4)] p-3 text-[10px] leading-relaxed">
              {JSON.stringify(data.config, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
      {data.bookRow ? (
        <div className="surface-card rim-instr md:col-span-2 p-4" data-rim="rose">
          <div className="relative z-[2]">
            <h3 className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              Brand book · row
            </h3>
            <pre className="mt-2 max-h-[300px] overflow-y-auto rounded-md border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.4)] p-3 text-[10px] leading-relaxed">
              {JSON.stringify(data.bookRow, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── 2. Imágenes ────────────────────────────────────────────

export function ImagesTab({ data }: { data: ImagesSection }) {
  if (
    data.storageObjects.length === 0 &&
    data.agentImageGenerations.length === 0
  ) {
    return (
      <EmptyTile
        icon={<Image strokeWidth={1.5} className="h-4 w-4" aria-label="Image" />}
        title="Sin imágenes generadas"
        message="agent-images bucket vacío · GPT Image (Brazo 1) sin runs aún"
      />
    )
  }
  return (
    <div className="flex flex-col gap-5">
      {data.storageObjects.length > 0 ? (
        <div>
          <h3 className="num mb-2 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            Storage · agent-images bucket · {data.storageObjects.length} files
          </h3>
          <StorageGrid items={data.storageObjects} kind="image" />
        </div>
      ) : null}
      {data.agentImageGenerations.length > 0 ? (
        <div>
          <h3 className="num mb-2 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            Generation rows · agent_image_generations · {data.agentImageGenerations.length} entries
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.agentImageGenerations.map((g) => (
              <div
                key={g.id}
                className="surface-card rim-instr p-3"
                data-rim="violet"
              >
                <div className="relative z-[2]">
                  {g.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={g.image_url}
                      alt="generation"
                      loading="lazy"
                      className="aspect-[4/3] w-full rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center rounded-md bg-[hsl(var(--card)/0.4)]">
                      <Image strokeWidth={1.5} className="h-8 w-8 text-[hsl(var(--muted-foreground))]" aria-label="Image" />
                    </div>
                  )}
                  <p
                    className="num mt-2 text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]"
                    title={g.model ?? ""}
                  >
                    {g.model ?? "—"} · ${(g.cost_usd ?? 0).toFixed(4)}
                  </p>
                  {g.prompt ? (
                    <p
                      className="mt-1 line-clamp-2 text-[11px] text-foreground/85"
                      title={g.prompt}
                    >
                      {g.prompt}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── 3. Videos ──────────────────────────────────────────────

export function VideosTab() {
  return (
    <EmptyTile
      icon={<VideoCamera strokeWidth={1.5} className="h-4 w-4" />}
      title="VideoCamera pipeline · wire pending"
      message="Brazo Higgsfield Seedance + Veo · spec en /system/brazos · 0 generations todavía"
    />
  )
}

// ── 4. 3D Models ───────────────────────────────────────────

export function ThreeDModelsTab({ data }: { data: ThreeDSection }) {
  return <StorageGrid items={data.storageObjects} kind="model" />
}

// ── 5. Landing Pages ───────────────────────────────────────

export function LandingTab({ data }: { data: LandingSection }) {
  return (
    <div className="flex flex-col gap-4">
      {data.websiteUrl || data.domain ? (
        <div className="surface-card rim-instr p-4" data-rim="cyan">
          <div className="relative z-[2] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="num text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                Production site
              </p>
              <p className="mt-1 truncate text-[13px] font-semibold">
                {data.websiteUrl ?? data.domain}
              </p>
            </div>
            {data.websiteUrl ? (
              <a
                href={data.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="num inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:text-foreground"
              >
                open <ArrowSquareOut strokeWidth={1.5} className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
      {data.storageObjects.length > 0 ? (
        <StorageGrid items={data.storageObjects} kind="image" />
      ) : (
        <EmptyTile
          icon={<Globe strokeWidth={1.5} className="h-4 w-4" />}
          title="Sin screenshots de landing"
          message={`storage prefix ${"<slug>"}/landing vacío`}
        />
      )}
    </div>
  )
}

// ── 6. QA Evidence ─────────────────────────────────────────

export function QaEvidenceTab({ data }: { data: QaSection }) {
  if (data.storageObjects.length === 0) {
    return (
      <EmptyTile
        icon={<Camera strokeWidth={1.5} className="h-4 w-4" />}
        title="QA evidence · pending"
        message={`prefix ${data.topFolderName} vacío · CC#1 captures land aquí post-cascade ship`}
      />
    )
  }
  return (
    <div>
      <p className="num mb-3 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
        QA screenshots · {data.storageObjects.length} files · prefix{" "}
        <code className="font-mono">{data.topFolderName}</code>
      </p>
      <StorageGrid items={data.storageObjects} kind="image" />
    </div>
  )
}

// ── 7. Social Posts ────────────────────────────────────────

export function SocialPostsTab({ data }: { data: SocialSection }) {
  if (data.recentInvocations.length === 0) {
    return (
      <EmptyTile
        icon={<Sparkle strokeWidth={1.5} className="h-4 w-4" />}
        title="Sin posts sociales generados"
        message="content-creator + carousel-designer + social-media-strategist sin invocaciones recientes para este cliente"
      />
    )
  }
  return (
    <ul className="divide-y divide-[hsl(var(--border)/0.6)]">
      {data.recentInvocations.map((r) => (
        <li key={r.id} className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono text-[11px] text-[hsl(var(--accent))]">
                {r.agent_name ?? r.agent_id}
              </span>
              <span
                className="num text-[10px] uppercase tracking-[0.18em]"
                style={{
                  color:
                    r.status === "completed"
                      ? "hsl(var(--success))"
                      : r.status === "failed"
                        ? "hsl(var(--danger))"
                        : "hsl(var(--muted-foreground))",
                }}
              >
                {r.status}
              </span>
            </div>
            <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
              {fmtRelative(r.started_at)} · ${(r.cost_usd ?? 0).toFixed(4)}
            </span>
          </div>
          {r.metadata ? (
            <details className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
              <summary className="num cursor-pointer text-[10px] uppercase tracking-[0.16em] hover:text-foreground">
                metadata
              </summary>
              <pre className="mt-1 max-h-[200px] overflow-y-auto rounded-md border-[0.5px] border-[hsl(var(--border))] bg-[hsl(var(--card)/0.4)] p-2 text-[10px]">
                {JSON.stringify(r.metadata, null, 2)}
              </pre>
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

// ── 8. Cascade Outputs ─────────────────────────────────────

export function CascadeOutputsTab({ data }: { data: CascadeSection }) {
  if (data.runs.length === 0 && data.journeys.length === 0) {
    return (
      <EmptyTile
        icon={<GitBranch strokeWidth={1.5} className="h-4 w-4" />}
        title="Sin cascade runs · sin journeys activos"
        message="cascade_runs + journey_executions vacíos · platform runtime emisión pending"
      />
    )
  }
  return (
    <div className="flex flex-col gap-5">
      {data.journeys.length > 0 ? (
        <div>
          <h3 className="num mb-2 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            Active journeys · {data.journeys.length}
          </h3>
          <ul className="divide-y divide-[hsl(var(--border)/0.6)]">
            {data.journeys.map((j) => (
              <li key={j.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <span
                    className="num text-[10px] uppercase tracking-[0.18em]"
                    style={{ color: "hsl(var(--accent))" }}
                  >
                    {j.journey_state}
                  </span>
                  {j.stage ? (
                    <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
                      / {j.stage}
                    </span>
                  ) : null}
                </div>
                <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
                  active {fmtRelative(j.last_activity_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {data.runs.length > 0 ? (
        <div>
          <h3 className="num mb-2 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            Cascade runs · {data.runs.length} recent
          </h3>
          <ul className="divide-y divide-[hsl(var(--border)/0.6)]">
            {data.runs.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-[11px] text-[hsl(var(--accent))]">
                      {r.cascade_type ?? "—"}
                    </span>
                    <span
                      className="num text-[10px] uppercase tracking-[0.18em]"
                      style={{
                        color:
                          r.status === "completed"
                            ? "hsl(var(--success))"
                            : r.status === "failed"
                              ? "hsl(var(--danger))"
                              : "hsl(var(--accent))",
                      }}
                    >
                      {r.status}
                    </span>
                    <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
                      {r.stage_count ?? 0} stages · {r.failed_stages ?? 0} failed
                    </span>
                  </div>
                  <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
                    {fmtRelative(r.started_at)} · ${(r.total_cost_usd ?? 0).toFixed(4)}
                  </span>
                </div>
                {r.agents_invoked && r.agents_invoked.length > 0 ? (
                  <p className="num mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                    agents · {r.agents_invoked.join(" → ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

// ── 9. Apify Scrapes ───────────────────────────────────────

export function ApifyScrapesTab() {
  return (
    <EmptyTile
      icon={<MagnifyingGlass strokeWidth={1.5} className="h-4 w-4" />}
      title="Apify scrapes · wire pending"
      message="n8n Competitor Daily Monitor activa · scrapes raw + processed table pending · Brazo 2 spec"
    />
  )
}

// ── 10. Audit Trail ────────────────────────────────────────

export function AuditTrailTab({ data }: { data: AuditSection }) {
  if (data.recent.length === 0) {
    return (
      <EmptyTile
        icon={<Pulse strokeWidth={1.5} className="h-4 w-4" />}
        title="Sin invocaciones registradas"
        message="agent_invocations para este cliente · 0 rows · sin actividad agéntica todavía"
      />
    )
  }
  return (
    <div>
      <p className="num mb-3 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
        Audit · {data.totalCount} invocations total · showing last {data.recent.length}
      </p>
      <ul className="divide-y divide-[hsl(var(--border)/0.6)]">
        {data.recent.map((r) => (
          <li key={r.id} className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background:
                    r.status === "completed"
                      ? "hsl(var(--success))"
                      : r.status === "failed"
                        ? "hsl(var(--danger))"
                        : "hsl(var(--accent))",
                }}
              />
              <span className="font-mono text-[11px] text-[hsl(var(--accent))]">
                {r.agent_name ?? r.agent_id ?? "—"}
              </span>
              <span className="num text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                {r.model}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
                {((r.duration_ms ?? 0) / 1000).toFixed(1)}s
              </span>
              <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
                ${(r.cost_usd ?? 0).toFixed(4)}
              </span>
              <span className="num text-[10px] text-[hsl(var(--muted-foreground))]">
                {fmtRelative(r.started_at)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
