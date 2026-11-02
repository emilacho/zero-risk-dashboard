/**
 * GET /api/direccion/decisiones · Tu oficina (6.20): todo lo que espera la firma de Emilio, de cualquier departamento. Solo administrador. SOLO LECTURA:
 * el servidor lee la ruta certificada de la plataforma con la llave interna (que nunca llega al navegador) y devuelve la lista revisada.
 * 6.52 · agrega `pausados`: los clientes que Emilio puso en pausa (las «pausas que decidiste» de Riesgos). Sus decisiones van en un grupo plegado, fuera del
 * número «esperan tu firma». Si esa lectura falla, no se marca ninguno (el número no se achica a ciegas).
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { leerDecisiones } from "@/lib/direccion-decisiones"
import { leerRiesgos } from "@/lib/direccion-riesgos"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const sinNombres = (async () => new Response("{}", { status: 404 })) as unknown as typeof fetch // las pausas no necesitan los nombres de los procesos
  const [r, rs] = await Promise.all([leerDecisiones(), leerRiesgos({ procesosImpl: sinNombres }).catch(() => null)])
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status, headers: { "Cache-Control": "no-store" } })
  const vistos = new Set<string>()
  const pausados = rs?.ok ? rs.datos.decisiones_tuyas.flatMap((p) => (p.cliente && !vistos.has(p.cliente) && vistos.add(p.cliente) ? [{ cliente: p.cliente, motivo: p.detalle }] : [])) : []
  return NextResponse.json({ ok: true, ...r.datos, pausados }, { headers: { "Cache-Control": "no-store" } })
}
