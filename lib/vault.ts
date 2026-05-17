/**
 * Vault data layer · server-side helpers para `ClientVault` component.
 *
 * Goal · gather all artifacts for a single cliente · Storage objects +
 * Supabase table rows · sin loading binary content. Each list returns
 * lightweight metadata (path · name · size · created_at · public URL)
 * so the UI can render thumbnails lazy via `<img>` browser fetch.
 */
import { getServiceRoleClient } from "@/lib/supabase-server"

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""

export interface VaultStorageObject {
  path: string
  name: string
  size: number | null
  created_at: string | null
  contentType: string | null
  publicUrl: string
}

/**
 * Lists objects under a bucket prefix recursively (Storage v1 list is
 * non-recursive · we paginate folder children). For now we list the
 * top-level + a few hand-known subfolders relevant to Náufrago pilot.
 */
export async function listStoragePrefix(
  bucket: string,
  prefix: string,
  limit = 100,
): Promise<VaultStorageObject[]> {
  const supa = getServiceRoleClient()
  const { data, error } = await supa.storage.from(bucket).list(prefix, {
    limit,
    sortBy: { column: "created_at", order: "desc" },
  })
  if (error || !data) return []
  return data
    .filter((o) => o.name && !o.name.startsWith(".") && o.metadata)
    .map((o) => {
      const fullPath = prefix ? `${prefix}/${o.name}` : o.name
      const meta = o.metadata as Record<string, unknown> | null
      const size = (meta?.size as number | undefined) ?? null
      const contentType =
        (meta?.mimetype as string | undefined) ??
        (meta?.contentType as string | undefined) ??
        null
      return {
        path: fullPath,
        name: o.name,
        size,
        created_at: o.created_at ?? null,
        contentType,
        publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${fullPath}`,
      }
    })
}

/**
 * Recursively walks a prefix · 1-level depth typical use (e.g.
 * `client-websites/naufrago/3d-models/` returns the 10 GLB files).
 * For deeper trees (qa screenshots in 100s of frame folders) we
 * surface only the top folder · drill-down v2.
 */
export async function listStorageTree(
  bucket: string,
  prefix: string,
  maxFiles = 200,
): Promise<VaultStorageObject[]> {
  const top = await listStoragePrefix(bucket, prefix, maxFiles)
  const out: VaultStorageObject[] = []
  for (const obj of top) {
    if (obj.contentType) {
      out.push(obj)
    } else {
      // Looks like a folder · recurse one level
      const inner = await listStoragePrefix(bucket, obj.path, maxFiles)
      out.push(...inner)
      if (out.length >= maxFiles) break
    }
  }
  return out.slice(0, maxFiles)
}

export interface VaultCounts {
  brandDocs: number
  images: number
  videos: number
  threeDModels: number
  landing: number
  qaEvidence: number
  socialPosts: number
  cascades: number
  apifyScrapes: number
  audit: number
}

export interface ClientVaultBundle {
  counts: VaultCounts
  brand: BrandSection
  images: ImagesSection
  threeDModels: ThreeDSection
  landing: LandingSection
  qaEvidence: QaSection
  socialPosts: SocialSection
  cascades: CascadeSection
  audit: AuditSection
}

export interface BrandSection {
  brandVoice: Record<string, unknown> | null
  config: Record<string, unknown> | null
  brandColors: unknown[] | null
  brandFonts: string[] | null
  /** brand_books table row (if exists for cliente) */
  bookRow: Record<string, unknown> | null
}

export interface ImagesSection {
  storageObjects: VaultStorageObject[]
  agentImageGenerations: Array<{
    id: string
    created_at: string | null
    model: string | null
    cost_usd: number | null
    prompt: string | null
    image_url: string | null
    metadata: Record<string, unknown> | null
  }>
}

export interface ThreeDSection {
  storageObjects: VaultStorageObject[]
}

export interface LandingSection {
  storageObjects: VaultStorageObject[]
  websiteUrl: string | null
  domain: string | null
}

export interface QaSection {
  storageObjects: VaultStorageObject[]
  topFolderName: string
}

export interface SocialSection {
  recentInvocations: AuditRow[]
}

export interface CascadeSection {
  runs: Array<{
    id: string
    cascade_type: string | null
    status: string | null
    started_at: string | null
    completed_at: string | null
    total_cost_usd: number | null
    stage_count: number | null
    failed_stages: number | null
    agents_invoked: string[] | null
  }>
  journeys: Array<{
    id: string
    journey_state: string | null
    stage: string | null
    started_at: string | null
    last_activity_at: string | null
  }>
}

export interface AuditRow {
  id: string
  agent_id: string | null
  agent_name: string | null
  model: string | null
  started_at: string | null
  duration_ms: number | null
  cost_usd: number | null
  status: string | null
  metadata: Record<string, unknown> | null
}

export interface AuditSection {
  recent: AuditRow[]
  totalCount: number
}

/**
 * Fetch all vault data for a single cliente · server-side · ONE round
 * trip per source. Heavy storage content NOT inlined (URLs only).
 */
export async function loadClientVault(
  clientId: string,
  clientSlug: string,
): Promise<ClientVaultBundle> {
  const supa = getServiceRoleClient()

  // ── Storage prefixes by category ────────────────────────────
  const slugPrefix = clientSlug
  const [agentImages, threeDObjs, landingObjs, qaObjs] = await Promise.all([
    listStoragePrefix("agent-images", "", 80).catch(() => []),
    listStoragePrefix(
      "client-websites",
      `${slugPrefix}/3d-models`,
      40,
    ).catch(() => []),
    listStoragePrefix("client-websites", `${slugPrefix}/landing`, 30).catch(
      () => [],
    ),
    listStoragePrefix("client-websites", `${slugPrefix}/v2/qa`, 60).catch(
      () => [],
    ),
  ])

  // ── DB rows ─────────────────────────────────────────────────
  const [
    clientRow,
    bookRow,
    invocations,
    invocationsCount,
    imageGenerations,
    cascadeRuns,
    journeys,
  ] = await Promise.all([
    supa
      .from("clients")
      .select(
        "id, name, slug, website_url, domain, brand_voice, config, brand_colors, brand_fonts",
      )
      .eq("id", clientId)
      .maybeSingle(),
    supa
      .from("brand_books")
      .select("id, created_at, version, payload, model, cost_usd")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(
        (r) => r,
        () => ({ data: null, error: null }),
      ),
    supa
      .from("agent_invocations")
      .select(
        "id, agent_id, agent_name, model, started_at, duration_ms, cost_usd, status, metadata",
      )
      .eq("client_id", clientId)
      .order("started_at", { ascending: false })
      .limit(40),
    supa
      .from("agent_invocations")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
    supa
      .from("agent_image_generations")
      .select("id, created_at, model, cost_usd, prompt, image_url, metadata")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(40)
      .then(
        (r) => r,
        () => ({ data: [], error: null }),
      ),
    supa
      .from("cascade_runs")
      .select(
        "id, cascade_type, status, started_at, completed_at, total_cost_usd, stage_count, failed_stages, agents_invoked",
      )
      .eq("client_id", clientId)
      .order("started_at", { ascending: false })
      .limit(20),
    supa
      .from("journey_executions")
      .select("id, journey_state, stage, started_at, last_activity_at")
      .eq("client_id", clientId)
      .order("last_activity_at", { ascending: false })
      .limit(10),
  ])

  type SafeData<T> = { data: T | null }
  type SafeArray<T> = { data: T[] | null }
  const clientData = (clientRow as SafeData<Record<string, unknown>>).data
  const bookData = (bookRow as SafeData<Record<string, unknown>>).data
  const invs = (invocations.data ?? []) as AuditRow[]
  const imgs = ((imageGenerations as SafeArray<{
    id: string
    created_at: string | null
    model: string | null
    cost_usd: number | null
    prompt: string | null
    image_url: string | null
    metadata: Record<string, unknown> | null
  }>).data ?? [])
  const cruns = (cascadeRuns.data ?? []).map((r) => ({
    id: r.id as string,
    cascade_type: (r.cascade_type as string) ?? null,
    status: (r.status as string) ?? null,
    started_at: (r.started_at as string) ?? null,
    completed_at: (r.completed_at as string) ?? null,
    total_cost_usd: (r.total_cost_usd as number) ?? null,
    stage_count: (r.stage_count as number) ?? null,
    failed_stages: (r.failed_stages as number) ?? null,
    agents_invoked: (r.agents_invoked as string[]) ?? null,
  }))
  const jrns = (journeys.data ?? []).map((j) => ({
    id: j.id as string,
    journey_state: (j.journey_state as string) ?? null,
    stage: (j.stage as string) ?? null,
    started_at: (j.started_at as string) ?? null,
    last_activity_at: (j.last_activity_at as string) ?? null,
  }))

  // Social posts heuristic · agent_name LIKE %social% OR carousel-designer
  // OR content-creator with metadata.kind containing "post"/"caption"
  const socialInvocations = invs.filter((r) => {
    const name = (r.agent_name ?? "").toLowerCase()
    return (
      name.includes("social") ||
      name.includes("carousel") ||
      name === "content-creator" ||
      (r.metadata && JSON.stringify(r.metadata).toLowerCase().includes("caption"))
    )
  })

  return {
    counts: {
      brandDocs: (clientData?.brand_voice ? 1 : 0) + (bookData ? 1 : 0),
      images: agentImages.length + imgs.length,
      videos: 0,
      threeDModels: threeDObjs.length,
      landing: landingObjs.length + (clientData?.website_url ? 1 : 0),
      qaEvidence: qaObjs.length,
      socialPosts: socialInvocations.length,
      cascades: cruns.length,
      apifyScrapes: 0, // wire pending
      audit: invocationsCount.count ?? invs.length,
    },
    brand: {
      brandVoice: (clientData?.brand_voice as Record<string, unknown>) ?? null,
      config: (clientData?.config as Record<string, unknown>) ?? null,
      brandColors: (clientData?.brand_colors as unknown[]) ?? null,
      brandFonts: (clientData?.brand_fonts as string[]) ?? null,
      bookRow: bookData,
    },
    images: {
      storageObjects: agentImages,
      agentImageGenerations: imgs,
    },
    threeDModels: { storageObjects: threeDObjs },
    landing: {
      storageObjects: landingObjs,
      websiteUrl: (clientData?.website_url as string) ?? null,
      domain: (clientData?.domain as string) ?? null,
    },
    qaEvidence: { storageObjects: qaObjs, topFolderName: `${slugPrefix}/v2/qa` },
    socialPosts: { recentInvocations: socialInvocations },
    cascades: { runs: cruns, journeys: jrns },
    audit: { recent: invs, totalCount: invocationsCount.count ?? invs.length },
  }
}
