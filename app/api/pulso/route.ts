import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { huellaDelPulso } from "@/lib/pulso"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/pulso → { huella }: cambia cuando cambia algo que las pantallas muestran. Solo administrador. */
export async function GET() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false }, { status: puerta.status })
  try { return NextResponse.json({ ok: true, huella: await huellaDelPulso(getServiceRoleClient()) }) } catch { return NextResponse.json({ ok: false }, { status: 500 }) }
}
