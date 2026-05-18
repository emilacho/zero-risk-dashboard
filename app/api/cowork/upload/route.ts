/**
 * POST /api/cowork/upload · STEP 11 · file attachments for CoworkPromptBar.
 *
 * multipart/form-data ·
 *   files · one or more file inputs
 *   session_id · string · scopes the storage path
 *   channel · string · e.g. "home" · "campaign_modal"
 *
 * Persists to Supabase Storage bucket `cowork-uploads` ·
 * path · `{user_id}/{channel}/{session_id}/{ts}-{slug}-{name}`.
 * Returns the public-ish urls (signed for 24h since the bucket is
 * private by default) + mime type so the frontend can choose preview
 * shape.
 */
import { NextResponse } from "next/server"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { getSessionClient } from "@/lib/supabase-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const BUCKET = "cowork-uploads"
const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25MB per file · room for screenshots + small PDFs
const MAX_FILES_PER_REQ = 10

interface UploadResult {
  name: string
  size: number
  mime: string
  path: string
  url: string | null
}

function slugifyName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80)
}

export async function POST(req: Request) {
  // Auth · admin gate
  const supa = await getSessionClient()
  const { data: userRes } = await supa.auth.getUser()
  if (!userRes?.user) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 },
    )
  }
  const { data: roleRow } = await supa
    .from("app_roles")
    .select("role")
    .eq("user_id", userRes.user.id)
    .maybeSingle()
  if (roleRow?.role !== "admin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_multipart" },
      { status: 400 },
    )
  }

  const sessionId = String(form.get("session_id") ?? "").trim()
  const channel = String(form.get("channel") ?? "default").trim() || "default"
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "session_id_required" },
      { status: 400 },
    )
  }

  const files: File[] = []
  for (const [k, v] of form.entries()) {
    if (k === "files" && v instanceof File) files.push(v)
    if (k === "file" && v instanceof File) files.push(v)
  }
  if (files.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no_files_attached" },
      { status: 400 },
    )
  }
  if (files.length > MAX_FILES_PER_REQ) {
    return NextResponse.json(
      { ok: false, error: `too_many_files_max_${MAX_FILES_PER_REQ}` },
      { status: 400 },
    )
  }

  const svc = getServiceRoleClient()
  const results: UploadResult[] = []
  const errors: Array<{ name: string; error: string }> = []

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      errors.push({ name: file.name, error: "file_too_large_25mb_max" })
      continue
    }
    const ts = Date.now().toString(36)
    const safeName = slugifyName(file.name || "untitled")
    const path = `${userRes.user.id}/${channel}/${sessionId}/${ts}-${safeName}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await svc.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      })
    if (upErr) {
      errors.push({
        name: file.name,
        error: upErr.message.includes("Bucket not found")
          ? `bucket_${BUCKET}_missing · create it in Supabase Storage`
          : upErr.message,
      })
      continue
    }
    const { data: signed } = await svc.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24) // 24h
    results.push({
      name: file.name,
      size: file.size,
      mime: file.type || "application/octet-stream",
      path,
      url: signed?.signedUrl ?? null,
    })
  }

  return NextResponse.json({
    ok: errors.length === 0,
    uploaded: results,
    errors,
    count: results.length,
  })
}
