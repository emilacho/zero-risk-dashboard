/**
 * POST /api/workflows/trigger?workflowId=...
 *
 * Admin-only manual trigger · calls n8n's
 * `/api/v1/workflows/{id}/run` to kick off an ad-hoc execution.
 * Some n8n setups expose the trigger via webhook URL instead · v1
 * returns 501 if `/run` is not supported by the n8n version (caller
 * should use the workflow's webhook URL directly).
 */
import { NextResponse } from "next/server"
import { getSessionClient } from "@/lib/supabase-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  // Admin auth
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

  const url = new URL(req.url)
  const workflowId = url.searchParams.get("workflowId")
  if (!workflowId) {
    return NextResponse.json(
      { ok: false, error: "workflowId required" },
      { status: 400 },
    )
  }

  const base = process.env.N8N_BASE_URL
  const key = process.env.N8N_API_KEY
  if (!base || !key) {
    return NextResponse.json(
      { ok: false, error: "n8n envs missing" },
      { status: 500 },
    )
  }

  try {
    // Some n8n versions expose POST /workflows/{id}/run with empty body
    // (manual trigger). Others require calling the webhook URL. We try
    // the run endpoint first.
    const res = await fetch(
      `${base.replace(/\/+$/, "")}/api/v1/workflows/${workflowId}/run`,
      {
        method: "POST",
        headers: {
          "X-N8N-API-KEY": key,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({}),
      },
    )
    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `n8n ${res.status} ${res.statusText} · si el workflow tiene Webhook trigger usar la URL del webhook directamente`,
        },
        { status: res.status === 404 ? 501 : 502 },
      )
    }
    const json = await res.json().catch(() => ({}))
    return NextResponse.json({ ok: true, n8n: json })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "trigger_failed" },
      { status: 502 },
    )
  }
}
