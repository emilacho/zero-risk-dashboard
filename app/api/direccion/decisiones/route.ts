/**
 * GET /api/direccion/decisiones · Tu oficina (6.20): todo lo que espera la firma de Emilio, de cualquier departamento. Solo administrador. SOLO LECTURA:
 * el servidor lee la ruta certificada de la plataforma con la llave interna (que nunca llega al navegador) y devuelve la lista revisada.
 * 6.52 · agrega `pausados`: los clientes que Emilio puso en pausa (las «pausas que decidiste» de Riesgos). Sus decisiones van en un grupo plegado, fuera del
 * número «esperan tu firma». Si esa lectura falla, no se marca ninguno (el número no se achica a ciegas).
 * 04-nov · agrega a cada pregunta QUIÉN pregunta (oficina y empleado), leído de la puerta del dueño del cerebro. Si no se puede leer, la tarjeta no lo dice.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { leerDecisiones } from "@/lib/direccion-decisiones"
import { leerRiesgos } from "@/lib/direccion-riesgos"
import { quienPregunto } from "@/lib/decisiones-contestar"

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
  // quién pregunta: una lectura por cliente con preguntas (la plataforma lo trae si algún día lo agrega: entonces manda el suyo)
  const clientes = [...new Set(r.datos.decisiones.filter((d) => d.tipo === "pregunta_al_dueno" && d.client_id && !d.pregunta_de).map((d) => d.client_id as string))]
  const quienes = await Promise.all(clientes.map((c) => quienPregunto({}, c)))
  const porId = new Map(quienes.flatMap((m) => (m ? [...m.entries()] : [])))
  const decisiones = r.datos.decisiones.map((d) => (d.pregunta_de || !porId.has(d.id) ? d : { ...d, pregunta_de: porId.get(d.id)! }))
  return NextResponse.json({ ok: true, ...r.datos, decisiones, pausados }, { headers: { "Cache-Control": "no-store" } })
}
