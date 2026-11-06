/**
 * GET /api/direccion/riesgos · Tu oficina (6.21): riesgos y alarmas de toda la empresa (incidentes, fallas, topes, saldos, pausas). Solo administrador.
 * El servidor lee la ruta certificada de la plataforma con la llave interna (que nunca llega al navegador) y devuelve la lista revisada.
 * A la plataforma no le escribe nada. En la tabla de marcas del tablero sí: con una lectura completa, cierra las marcas «visto» de los riesgos que ya no están.
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { leerRiesgos } from "@/lib/direccion-riesgos"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { cerrarLasQueYaNoEstan, leerCierresDeRiesgos, leerVistosDeRiesgos } from "@/lib/riesgos-vistos"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const r = await leerRiesgos()
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status, headers: { "Cache-Control": "no-store" } })
  // Abiertas · Tomadas · Cerradas (Lenovo 06-nov): las marcas «visto» de los riesgos viven en la tabla de marcas del tablero. Si no se pueden leer, `vistos: null`
  // y el panel no inventa tomadas ni cerradas.
  // CC6 06-nov: la marca no sobrevive al cierre (un riesgo que vuelve entra Abierto) y con la lista incompleta no se cierra nada
  const supa = getServiceRoleClient()
  const vistos = await cerrarLasQueYaNoEstan(supa, r.datos.riesgos, await leerVistosDeRiesgos(supa), r.datos.completo)
  const cierres = await leerCierresDeRiesgos(supa)
  return NextResponse.json({ ok: true, ...r.datos, vistos, cierres }, { headers: { "Cache-Control": "no-store" } })
}
