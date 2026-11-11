/**
 * POST /api/acciones/{accion} · lo que Emilio hace desde el tablero (rehacer una pieza, aprobar un plan, encender una oficina…). Solo un administrador con sesión.
 * El tablero no escribe la base: la acción se valida aquí y la hace la plataforma (que deja el rastro en `eventos_de_emilio`). La lógica vive en `lib/tablero-acciones.ts`.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { SOLO_DESDE_DECISIONES, ejecutarAccion } from "@/lib/tablero-acciones"
import { leerTopeDeLaFamilia } from "@/lib/tope-de-la-familia"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(req: Request, ctx: { params: Promise<{ accion: string }> }) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const { accion } = await ctx.params
  if (SOLO_DESDE_DECISIONES.includes(accion)) return NextResponse.json({ ok: false, error: "se_firma_en_decisiones", detalle: "Las firmas se hacen en Tu oficina › Decisiones, con sus cifras a la vista." }, { status: 409 })
  const cuerpo = await req.json().catch(() => ({}))
  // «rehacer» gasta hasta el tope de la familia de la pieza: lo lee el servidor (solo lectura)
  const r = await ejecutarAccion(accion, cuerpo, { revisor: puerta.email ?? "emilio", topeDeLaFamilia: leerTopeDeLaFamilia })
  return NextResponse.json(r.cuerpo, { status: r.status })
}
