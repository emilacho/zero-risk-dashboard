/**
 * `/api/estudio/{catalogo|piezas|pieza|cotizar|crear}` · la puerta del estudio de la cámara. Solo un administrador con sesión.
 * El tablero no llama a los proveedores ni guarda nada: reenvía a la plataforma con la llave interna (que nunca llega al navegador). Lógica en `lib/estudio.ts`.
 * `clientes` es la única lectura propia: la lista de clientes (id y nombre) para elegir a quién pertenece la pieza. SOLO LECTURA.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { clientesDelEstudio, type FilaDeCliente } from "@/lib/estudio-clientes"
import { alEstudio } from "@/lib/estudio"
import { getServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 800

const sinSesion = (status: 401 | 403) => NextResponse.json({ ok: false, error: status === 401 ? "sin_sesion" : "sin_permiso" }, { status })

export async function GET(req: Request, ctx: { params: Promise<{ ruta: string }> }) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return sinSesion(puerta.status)
  const { ruta } = await ctx.params
  if (ruta === "clientes") {
    const r = await getServiceRoleClient().from("clients").select("id, name, status").order("name", { ascending: true }).limit(500)
    if (r.error) return NextResponse.json({ ok: false, error: r.error.message }, { status: 502 })
    const clientes = clientesDelEstudio((r.data ?? []) as FilaDeCliente[])
    return NextResponse.json({ ok: true, clientes }, { headers: { "Cache-Control": "no-store" } })
  }
  const r = await alEstudio(ruta, "GET", new URL(req.url).search, null)
  return NextResponse.json(r.cuerpo, { status: r.status, headers: { "Cache-Control": "no-store" } })
}

export async function POST(req: Request, ctx: { params: Promise<{ ruta: string }> }) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return sinSesion(puerta.status)
  const { ruta } = await ctx.params
  const texto = await req.text()
  try { if (texto) JSON.parse(texto) } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }) }
  const r = await alEstudio(ruta, "POST", "", texto || "{}")
  return NextResponse.json(r.cuerpo, { status: r.status })
}
