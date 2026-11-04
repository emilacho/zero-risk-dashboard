/**
 * /api/borrador · el borrador de «Tus cambios» (CC6 · 03-nov · contrato CC1 #872). Solo un administrador con sesión.
 * GET (leer) · PUT (guardar todo el borrador) · DELETE (borrar). El tablero no escribe la base: valida y pasa a la plataforma (`lib/borrador-del-dueno.ts`).
 */
import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/admin-guard"
import { pasarAlBorrador } from "@/lib/borrador-del-dueno"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function con(metodo: "GET" | "PUT" | "DELETE", req: Request) {
  const puerta = await exigirAdmin()
  if (!puerta.ok) return NextResponse.json({ ok: false, error: puerta.status === 401 ? "sin_sesion" : "sin_permiso" }, { status: puerta.status })
  const q = Object.fromEntries(new URL(req.url).searchParams.entries())
  const entrada = metodo === "PUT" ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : q
  const r = await pasarAlBorrador(metodo, entrada, { revisor: puerta.email ?? "emilio" })
  return NextResponse.json(r.cuerpo, { status: r.status })
}
export const GET = (req: Request) => con("GET", req)
export const PUT = (req: Request) => con("PUT", req)
export const DELETE = (req: Request) => con("DELETE", req)
