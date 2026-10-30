import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { pulsoDeLasPantallas } from "@/lib/pulso"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/pulso → { pulso: { general, gasto, alertas } }: cada huella cambia cuando cambia algo que esas pantallas muestran. Solo administrador. */
export async function GET() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false }, { status: puerta.status })
  try { return NextResponse.json({ ok: true, pulso: await pulsoDeLasPantallas(getServiceRoleClient()) }) } catch { return NextResponse.json({ ok: false }, { status: 500 }) }
}
