/**
 * /api/campanas-archivadas · 28-nov (Emilio 17:35Z por Lenovo) · las campañas ARCHIVADAS del cliente, para mostrarlas debajo de los lugares
 * de campaña con su botón «Eliminar» (`components/nuevo/CampanasArchivadas.tsx`). Solo lectura · solo un administrador con sesión (un `client_viewer` recibe 403).
 *   · GET ?cliente=<id> → `{ ok, archivadas: [{ campana_id, nombre, archivada_en }] }`
 * Eliminar NO pasa por aquí: va por `/api/campana-archivo` (el mismo pedido que el «Eliminar» de una campaña viva).
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { campanasArchivadas } from "@/lib/flujo-de-campana"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const cliente = new URL(req.url).searchParams.get("cliente")
  if (!cliente || !/^[0-9a-f-]{36}$/i.test(cliente)) return NextResponse.json({ ok: false, error: "pedido_invalido" }, { status: 400 })
  try {
    return NextResponse.json({ ok: true, archivadas: await campanasArchivadas(getServiceRoleClient(), cliente) }, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: "base_no_responde", detalle: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}
