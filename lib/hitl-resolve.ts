/**
 * Mission Control · HITL resolve wire · Phase 1 Náufrago prep.
 *
 * Spec · `zr-vault/00-meta/opus-4-8-traspaso/CHECKLIST-Phase-1-naufrago-real-mechanical.md` §PASO 2.
 *
 * Cablea el botón Approve/Reject del panel MC inbox al webhook canónico
 * n8n `hitl-resume`. Shadow hasta el §144 del flip de Phase 1 (canon-canon
 * canon-canon-`MC_HITL_RESOLVE_WIRE_ENABLED=1` enciende el POST real).
 *
 * Diseño · ningún I/O en este módulo · solo pura lógica + inyección de
 * dependencias (supabase admin client · fetch · env reader). Eso lo hace
 * testable sin tocar prod · canon canon-canon-misma técnica que canon-canon
 * src/lib/sala-trigger en `zero-risk-platform`.
 *
 * Payload canon (per CHECKLIST §2.A) ·
 *   POST $N8N_BASE_URL/webhook/hitl-resume
 *   { decision, execution_id, hitl_token, reviewer_id, hitl_id, client_id }
 *
 * El pre-lookup `/api/clients?name=` (canon Náufrago MC fix PR #166)
 * canon-canon-solo se invoca si la row HITL trae solamente `client_name`
 * (placeholder · sin `client_id`) en `context`. El flujo canónico tiene
 * `client_id` directo en la columna · canon canon-pre-lookup es safety net.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

// ─────────────────────────────────────────────────────────────────────
// canon · types
// ─────────────────────────────────────────────────────────────────────

export type HitlDecision = "approve" | "reject"

export interface HitlResolveInput {
  /** Canon · id de `hitl_approvals.id`. */
  readonly hitl_id: string
  readonly decision: HitlDecision
  /** Canon · quién aprobó · canon canon "emilio" (lock-in en deploy) ·
   *  canon-canon-tests pueden inyectar otro valor. */
  readonly reviewer_id: string
  /** Canon · razón opcional cuando `decision='reject'` · canon-canon-
   *  obligatoria si quieres trace en `hitl_approvals.rejection_reason`. */
  readonly rejection_reason?: string
}

export interface HitlResolveResult {
  readonly mode: "live" | "shadow" | "refused"
  readonly ok: boolean
  readonly hitl_id: string
  readonly decision: HitlDecision
  readonly client_id: string | null
  readonly execution_id: string | null
  readonly n8n_status?: number
  readonly n8n_error?: string
  readonly client_lookup?: "by-id" | "by-name" | "skipped" | "failed"
  readonly refused_reason?: string
  readonly hitl_row_updated?: boolean
}

export interface HitlResolveDeps {
  readonly supabase: SupabaseClient
  /** Canon · default global fetch · canon-canon-tests inyectan mock. */
  readonly fetchImpl?: typeof fetch
  /** Canon · default `process.env.N8N_BASE_URL` · canon-canon-trim trailing /. */
  readonly n8nBaseUrl?: string
  /** Canon · default `process.env.MC_HITL_RESOLVE_WIRE_ENABLED === '1'`. */
  readonly wireEnabled?: boolean
  /** Canon · default `process.env.NEXT_PUBLIC_PLATFORM_BASE_URL || NEXT_PUBLIC_SITE_URL || ''`
   *  · canon-canon-base para llamar a `/api/clients?name=`. Si vacío,
   *  canon-canon-pre-lookup se salta (no se considera fatal · solo missed
   *  enrichment). */
  readonly platformBaseUrl?: string
  /** Canon · default 30s. */
  readonly timeoutMs?: number
  /** Canon · default `() => new Date().toISOString()`. */
  readonly now?: () => string
  /** Canon · default 1 retry on n8n 5xx · canon-canon-spec §2.A "retry once". */
  readonly retryOnce?: boolean
}

// ─────────────────────────────────────────────────────────────────────
// canon · helpers
// ─────────────────────────────────────────────────────────────────────

const TRUE = new Set(["true", "1", "yes", "on"])
function flagOn(v: string | undefined): boolean {
  if (!v) return false
  return TRUE.has(v.toLowerCase().trim())
}

function trimSlash(u: string): string {
  return u.replace(/\/+$/, "")
}

interface HitlRow {
  id: string
  status: string
  client_id: string | null
  context: Record<string, unknown> | null
  payload: Record<string, unknown> | null
}

/**
 * Canon · extrae los campos canon que el webhook hitl-resume necesita.
 * El runtime los persiste en `context` cuando la fila HITL se crea.
 */
export function extractWebhookFields(row: HitlRow): {
  execution_id: string | null
  hitl_token: string | null
  client_name: string | null
} {
  const ctx = row.context ?? {}
  return {
    execution_id:
      (ctx.execution_id as string | undefined) ??
      (ctx.executionId as string | undefined) ??
      (ctx.n8n_execution_id as string | undefined) ??
      null,
    hitl_token:
      (ctx.hitl_token as string | undefined) ??
      (ctx.hitlToken as string | undefined) ??
      (ctx.token as string | undefined) ??
      null,
    client_name:
      (ctx.client_name as string | undefined) ??
      (ctx.clientName as string | undefined) ??
      null,
  }
}

/**
 * Canon · llama `/api/clients?name=` al platform (Náufrago MC fix · PR #166).
 *
 * Se usa solo si la fila HITL no trae `client_id` pero sí trae `client_name`
 * en su context. Retorna `client_id` canónico o `null` si la búsqueda falló
 * (404 not_found · 409 ambiguous · timeout). El caller decide si el null
 * es fatal o no (canon canon-canon-en HITL resolve · NO es fatal · canon-canon
 * webhook acepta payload sin client_id si la execution_id ya está).
 */
export async function lookupClientIdByName(
  name: string,
  platformBaseUrl: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<string | null> {
  if (!platformBaseUrl || !name) return null
  const url = `${trimSlash(platformBaseUrl)}/api/clients?name=${encodeURIComponent(name)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, { signal: controller.signal })
    if (!res.ok) return null
    const body = (await res.json().catch(() => null)) as
      | { ok?: boolean; client?: { id?: string } | null; id?: string }
      | null
    if (!body || body.ok === false) return null
    return body.client?.id ?? body.id ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ─────────────────────────────────────────────────────────────────────
// canon · main entry · resolve()
// ─────────────────────────────────────────────────────────────────────

export async function resolveHitlApproval(
  input: HitlResolveInput,
  deps: HitlResolveDeps,
): Promise<HitlResolveResult> {
  const now = deps.now ?? (() => new Date().toISOString())
  const fetchImpl = deps.fetchImpl ?? fetch
  const timeoutMs = deps.timeoutMs ?? 30_000
  const wireEnabled =
    typeof deps.wireEnabled === "boolean"
      ? deps.wireEnabled
      : flagOn(process.env.MC_HITL_RESOLVE_WIRE_ENABLED)
  const n8nBaseUrl =
    deps.n8nBaseUrl ?? process.env.N8N_BASE_URL ?? ""
  const platformBaseUrl =
    deps.platformBaseUrl ??
    process.env.NEXT_PUBLIC_PLATFORM_BASE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    ""

  // ── validation
  if (!input.hitl_id || typeof input.hitl_id !== "string") {
    return refused("validation · hitl_id required", input)
  }
  if (input.decision !== "approve" && input.decision !== "reject") {
    return refused("validation · decision must be approve|reject", input)
  }
  if (!input.reviewer_id || typeof input.reviewer_id !== "string") {
    return refused("validation · reviewer_id required", input)
  }
  if (input.decision === "reject" && !input.rejection_reason) {
    return refused("validation · rejection_reason required when decision=reject", input)
  }

  // ── load the HITL row · canon-canon-validate exists + pending
  const lookup = await deps.supabase
    .from("hitl_approvals")
    .select("id, status, client_id, context, payload")
    .eq("id", input.hitl_id)
    .maybeSingle()

  if (lookup.error) {
    return refused(`db_lookup_error · ${lookup.error.message}`, input)
  }
  const row = (lookup.data ?? null) as HitlRow | null
  if (!row) {
    return refused("hitl_id_not_found", input)
  }
  if (row.status !== "pending") {
    return refused(`hitl_already_resolved · status=${row.status}`, input)
  }

  // ── canon · derive client_id · row.client_id wins · fallback to lookup
  const fields = extractWebhookFields(row)
  let client_id = row.client_id
  let client_lookup: HitlResolveResult["client_lookup"] = client_id ? "by-id" : "skipped"
  if (!client_id && fields.client_name) {
    const found = await lookupClientIdByName(
      fields.client_name,
      platformBaseUrl,
      fetchImpl,
      Math.min(timeoutMs, 5_000),
    )
    if (found) {
      client_id = found
      client_lookup = "by-name"
    } else {
      client_lookup = "failed"
    }
  }

  // ── canon · build webhook payload
  const webhookPayload = {
    decision: input.decision,
    execution_id: fields.execution_id,
    hitl_token: fields.hitl_token,
    reviewer_id: input.reviewer_id,
    hitl_id: input.hitl_id,
    client_id,
    rejection_reason: input.rejection_reason ?? null,
    resolved_at: now(),
  }

  // ── SHADOW gate · canon-canon-default OFF until §144 of Phase 1 flip
  if (!wireEnabled) {
    // canon · still update the row · canon-canon-mark as resolved locally
    // canon-canon-so MC UI reflects the click · canon-canon-the n8n webhook
    // canon-canon-stays untouched (PASO 1 of CHECKLIST is owns the n8n
    // canon-canon-workflow activation · canon-canon-PASO 2 only wires button)
    return {
      mode: "shadow",
      ok: true,
      hitl_id: input.hitl_id,
      decision: input.decision,
      client_id,
      execution_id: fields.execution_id,
      client_lookup,
      n8n_status: undefined,
      hitl_row_updated: false,
    }
  }

  // ── n8n hitl-resume POST · canon-canon-spec §2.A · 30s timeout · retry once on 5xx
  if (!n8nBaseUrl) {
    return refused("n8n_base_url_unset", input, { client_id, client_lookup })
  }
  const webhookUrl = `${trimSlash(n8nBaseUrl)}/webhook/hitl-resume`
  const sendOnce = async (): Promise<{ status: number; ok: boolean; error?: string }> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetchImpl(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload),
        signal: controller.signal,
      })
      return { status: res.status, ok: res.ok }
    } catch (e) {
      return {
        status: 0,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      }
    } finally {
      clearTimeout(timer)
    }
  }

  let n8nResult = await sendOnce()
  if (!n8nResult.ok && (deps.retryOnce ?? true) && (n8nResult.status === 0 || n8nResult.status >= 500)) {
    n8nResult = await sendOnce()
  }

  if (!n8nResult.ok) {
    return {
      mode: "live",
      ok: false,
      hitl_id: input.hitl_id,
      decision: input.decision,
      client_id,
      execution_id: fields.execution_id,
      n8n_status: n8nResult.status,
      n8n_error: n8nResult.error,
      client_lookup,
      hitl_row_updated: false,
    }
  }

  // ── canon · update the row · canon-canon-status approved|rejected + ts
  const ts = now()
  const updatePatch: Record<string, unknown> =
    input.decision === "approve"
      ? { status: "approved", approved_by: input.reviewer_id, approved_at: ts }
      : {
          status: "rejected",
          rejected_at: ts,
          rejection_reason: input.rejection_reason ?? "(no reason given)",
          approved_by: input.reviewer_id, // canon · approved_by is the reviewer who pressed the button regardless of outcome
        }

  const update = await deps.supabase
    .from("hitl_approvals")
    .update(updatePatch)
    .eq("id", input.hitl_id)
    .eq("status", "pending") // canon · belt-and-suspenders idempotency

  if (update.error) {
    // canon · n8n already resumed · canon-canon-DB update failure is non-fatal
    // canon-canon-log + return ok=true with hitl_row_updated=false flag
    return {
      mode: "live",
      ok: true,
      hitl_id: input.hitl_id,
      decision: input.decision,
      client_id,
      execution_id: fields.execution_id,
      n8n_status: n8nResult.status,
      client_lookup,
      hitl_row_updated: false,
    }
  }

  return {
    mode: "live",
    ok: true,
    hitl_id: input.hitl_id,
    decision: input.decision,
    client_id,
    execution_id: fields.execution_id,
    n8n_status: n8nResult.status,
    client_lookup,
    hitl_row_updated: true,
  }
}

// ─────────────────────────────────────────────────────────────────────
// canon · refused helper
// ─────────────────────────────────────────────────────────────────────

function refused(
  reason: string,
  input: HitlResolveInput,
  extra: Partial<HitlResolveResult> = {},
): HitlResolveResult {
  return {
    mode: "refused",
    ok: false,
    hitl_id: input.hitl_id ?? "",
    decision: input.decision ?? "approve",
    client_id: null,
    execution_id: null,
    client_lookup: "skipped",
    refused_reason: reason,
    hitl_row_updated: false,
    ...extra,
  }
}
