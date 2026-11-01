/**
 * POST /api/cowork/pedido · el botón «Dejar como pedido» del cuadro de chat de /nuevo.
 *
 * Solo ANOTA: una fila en `cowork_messages` (status `pending`, metadata.tipo `pedido_para_lenovo`) para que Lenovo la lea en su primera vuelta.
 * No despacha nada a n8n, no llama a ningún agente y no avisa a Slack (regla de «menos ruido»). Solo administrador.
 */
import { NextResponse } from "next/server"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { getSessionClient } from "@/lib/supabase-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const supa = await getSessionClient()
  const { data: userRes } = await supa.auth.getUser()
  if (!userRes?.user) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 })
  const { data: roleRow } = await supa.from("app_roles").select("role").eq("user_id", userRes.user.id).maybeSingle()
  if (roleRow?.role !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })

  let body: { titulo?: unknown; detalle?: unknown; session_id?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }
  const titulo = typeof body.titulo === "string" ? body.titulo.trim() : ""
  const detalle = typeof body.detalle === "string" ? body.detalle.trim() : ""
  if (!titulo || !detalle || titulo.length > 140 || detalle.length > 1500) {
    return NextResponse.json({ ok: false, error: "titulo_o_detalle_invalido" }, { status: 400 })
  }
  const sessionId = typeof body.session_id === "string" ? body.session_id.slice(0, 80) : null

  const svc = getServiceRoleClient()
  const { data, error } = await svc
    .from("cowork_messages")
    .insert({
      content: `PEDIDO · ${titulo}\n\n${detalle}`,
      sender_user_id: `dashboard:${userRes.user.id}`,
      status: "pending",
      metadata: { tipo: "pedido_para_lenovo", titulo, detalle, session_id: sessionId, origen: "chat-de-oficinas" },
    })
    .select("id, created_at")
    .single()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id, created_at: data.created_at })
}
